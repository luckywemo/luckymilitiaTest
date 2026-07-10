import { useState, useEffect, useRef } from 'react';
import Peer, { DataConnection } from 'peerjs';
import { PEER_CONFIG, getPeerId, getStatusFromIceState, mpLog, createGamePeer } from '../utils/multiplayer';
import { MPMatchMode, MPMap, MPConfig } from '../App';

export interface SquadMember {
    name: string;
    team: 'alpha' | 'bravo';
    id: string;
    isReady?: boolean;
    ping?: number;
}

export interface ChatMessage {
    sender: string;
    text: string;
    timestamp: number;
}

interface UseMultiplayerProps {
    playerName: string;
    mpMatchMode: MPMatchMode;
    mpMap: MPMap;
    scoreLimit: number;
    alphaBots: number;
    bravoBots: number;
    onGameStart: (roomCode: string, isHost: boolean, squad: SquadMember[], mpConfig: MPConfig) => void;
}

export function useMultiplayer({
    playerName,
    mpMatchMode,
    mpMap,
    scoreLimit,
    alphaBots,
    bravoBots,
    onGameStart
}: UseMultiplayerProps) {
    const [activeRoom, setActiveRoom] = useState<string | null>(null);
    const [isHost, setIsHost] = useState(false);
    const [squad, setSquad] = useState<SquadMember[]>([{ name: playerName, team: 'alpha', id: 'host', isReady: true, ping: 0 }]);
    const [statusMsg, setStatusMsg] = useState('OFFLINE');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    const peerRef = useRef<Peer | null>(null);
    const connections = useRef<DataConnection[]>([]);
    const squadRef = useRef<SquadMember[]>(squad);
    const pingsRef = useRef<Record<string, number>>({});

    useEffect(() => {
        squadRef.current = squad;
    }, [squad]);

    // Handle Ping Intervals (starts/stops when activeRoom changes)
    useEffect(() => {
        let pingInterval: ReturnType<typeof setInterval>;
        
        if (activeRoom) {
            pingInterval = setInterval(() => {
                const now = Date.now();
                connections.current.forEach(c => {
                    if (c.open) c.send({ type: 'ping', timestamp: now });
                });
            }, 2000);
        }

        return () => {
            if (pingInterval) clearInterval(pingInterval);
        };
    }, [activeRoom]);

    // Cleanup peer ONLY on component unmount (not on activeRoom changes)
    useEffect(() => {
        return () => {
            if (peerRef.current) {
                mpLog('Disconnecting: Cleaning up local peer session', 'info');
                peerRef.current.destroy();
                peerRef.current = null;
            }
        };
    }, []);

    // Sync name changes to connected peers
    useEffect(() => {
        if (!activeRoom) return;

        if (isHost) {
            setSquad((prev) => {
                const next = prev.map(m => m.id === 'host' ? { ...m, name: playerName } : m);
                broadcastSquad(next);
                return next;
            });
        } else {
            const conn = connections.current[0];
            if (conn && conn.open) {
                conn.send({ type: 'update_name', name: playerName });
            }
        }
    }, [playerName, activeRoom, isHost]);

    const broadcastSquad = (newList: SquadMember[]) => {
        connections.current.forEach(c => {
            if (c.open) {
                c.send({ type: 'sync_squad', squad: newList });
            }
        });
    };

    const handleCreateRoom = (preferredCode?: string, attempt = 0) => {
        const urlParams = new URLSearchParams(window.location.search);
        let code = preferredCode || urlParams.get('room') || undefined;
        // On retry, always generate a fresh random code to avoid stale/unavailable IDs
        if (!code || attempt > 0) code = Math.floor(1000 + Math.random() * 9000).toString();

        mpLog(`=== ROOM CREATION ===\nGenerated Code: ${code}\nIsHost: ${isHost}\nAttempt: ${attempt}\nURL Room Param: ${urlParams.get('room')}`, 'info');

        setIsHost(true);
        setActiveRoom(code);
        setSquad([{ name: playerName, team: 'alpha', id: 'host', isReady: true, ping: 0 }]);
        setStatusMsg('TRANSMITTING...');
        mpLog(`Initializing Host Session for Room ${code}...`, 'info');

        try {
            const peerId = getPeerId('SCTR', code);
            mpLog(`Creating host peer with ID: ${peerId}`, 'info');
            peerRef.current = new Peer(peerId, PEER_CONFIG);

            peerRef.current.on('error', (err) => {
                console.error('[Multiplayer] Host error:', err);
                mpLog(`HOST_ERR: ${err.type} - ${err.message}`, 'error');
                if (err.type === 'peer-unavailable') {
                    setStatusMsg('ROOM_NOT_FOUND');
                } else if (err.type === 'unavailable-id') {
                    setStatusMsg('CODE_COLLISION_RETRY');
                    if (attempt < 3) {
                        mpLog(`Room ID collision, retrying with new code...`, 'info');
                        peerRef.current?.destroy();
                        peerRef.current = null;
                        setTimeout(() => handleCreateRoom(undefined, attempt + 1), 500);
                    }
                } else {
                    setStatusMsg(`SERVER_ERR: ${err.type}`);
                }
            });

            peerRef.current.on('open', (id) => {
                console.log('[Multiplayer] Host ready:', id);
                mpLog(`HOST_READY: ID=${id}. Waiting for peers on signaling server...`, 'success');
                setStatusMsg('BROADCASTING');
            });

            peerRef.current.on('connection', (conn) => {
                mpLog(`Incoming connection request from ${conn.peer}...`, 'info');

                conn.on('open', () => {
                    mpLog(`Connection established with ${conn.peer}`, 'success');
                    connections.current.push(conn);
                    conn.send({
                        type: 'welcome',
                        squad: squadRef.current,
                        settings: { mpMatchMode, mpMap, scoreLimit, alphaBots, bravoBots }
                    });

                    // @ts-ignore
                    const pc = conn.peerConnection as RTCPeerConnection;
                    if (pc) {
                        pc.addEventListener('iceconnectionstatechange', () => {
                            const state = pc.iceConnectionState;
                            mpLog(`ICE State (${conn.peer}): ${state}`, state === 'failed' ? 'error' : 'info');
                            if (state === 'failed') setStatusMsg('CLIENT_LINK_FAILED');
                        });
                    }
                });

                conn.on('data', (rawData: unknown) => {
                    const data = rawData as Record<string, any>;
                    if (data.type === 'join') {
                        mpLog(`Player ${data.name} joined squad`, 'success');
                        setSquad((prev) => {
                            const next = [...prev.filter(m => m.id !== conn.peer), { name: data.name, team: data.team, id: conn.peer, isReady: false, ping: 0 }];
                            broadcastSquad(next);
                            return next;
                        });
                    }
                    if (data.type === 'switch_team') {
                        setSquad((prev) => {
                            const next = prev.map(m => m.id === conn.peer ? { ...m, team: data.team } : m);
                            broadcastSquad(next);
                            return next;
                        });
                    }
                    if (data.type === 'update_name') {
                        setSquad((prev) => {
                            const next = prev.map(m => m.id === conn.peer ? { ...m, name: data.name } : m);
                            broadcastSquad(next);
                            return next;
                        });
                    }
                    if (data.type === 'toggle_ready') {
                        setSquad((prev) => {
                            const next = prev.map(m => m.id === conn.peer ? { ...m, isReady: !m.isReady } : m);
                            broadcastSquad(next);
                            return next;
                        });
                    }
                    if (data.type === 'chat') {
                        const newMsg = { sender: data.sender, text: data.text, timestamp: Date.now() };
                        setChatMessages(prev => [...prev.slice(-49), newMsg]);
                        connections.current.forEach(c => { if (c.open && c.peer !== conn.peer) c.send(data) });
                    }
                    if (data.type === 'ping') {
                        conn.send({ type: 'pong', timestamp: data.timestamp });
                    }
                    if (data.type === 'pong') {
                        const rtt = Date.now() - data.timestamp;
                        pingsRef.current[conn.peer] = Math.floor(rtt / 2);
                        setSquad(prev => prev.map(m => m.id === conn.peer ? { ...m, ping: pingsRef.current[conn.peer] } : m));
                        // No need to broadcast ping updates immediately to avoid noise, wait for next action
                    }
                });

                conn.on('close', () => {
                    mpLog(`Connection closed: ${conn.peer}`, 'info');
                    connections.current = connections.current.filter(c => c !== conn);
                    setSquad(prev => {
                        const next = prev.filter(m => m.id !== conn.peer);
                        broadcastSquad(next);
                        return next;
                    });
                });
            });
        } catch (e: any) {
            mpLog(`CRITICAL HOST ERR: ${e.message}`, 'error');
        }
    };

    const handleJoinRoom = (code: string) => {
        if (code.length !== 4) {
            mpLog(`Invalid room code length: ${code.length} (expected 4)`, 'error');
            return;
        }
        
        mpLog(`=== ROOM JOIN ===\nRoom Code: ${code}\nPlayer Name: ${playerName}`, 'info');
        
        setIsHost(false);
        setActiveRoom(code);
        setStatusMsg('LINKING...');
        mpLog(`Initializing Client for Room ${code}...`, 'info');

        try {
            peerRef.current = new Peer(PEER_CONFIG);

            peerRef.current.on('error', (err) => {
                console.error('[Multiplayer] Client error:', err);
                mpLog(`CLIENT_ERR: ${err.type} - ${err.message}`, 'error');
                // Don't kill state immediately, might be a temporary network blip
                setStatusMsg(`PEER ERR: ${err.type}`);
            });

            peerRef.current.on('open', (id) => {
                mpLog(`Client Peer Created: ${id}. Locating Host...`, 'info');
                const hostId = getPeerId('SCTR', code);
                mpLog(`Attempting to connect to host: ${hostId}`, 'info');
                connectToHostWithRetry(hostId, 0);
            });
        } catch (e: any) {
            mpLog(`CRITICAL CLIENT ERR: ${e.message}`, 'error');
        }
    };

    const connectToHostWithRetry = (hostId: string, attempt: number) => {
        if (!peerRef.current) return;

        const MAX_ATTEMPTS = 10;
        const BASE_DELAY = 1000;

        if (attempt >= MAX_ATTEMPTS) {
            setStatusMsg('CONNECTION_TIMEOUT');
            mpLog(`Connection timed out after ${MAX_ATTEMPTS} attempts. Host not reachable.`, 'error');
            return;
        }

        setStatusMsg(attempt === 0 ? 'LINKING...' : `RETRYING (${attempt + 1}/${MAX_ATTEMPTS})...`);
        mpLog(`Connecting to Host: ${hostId} (Attempt ${attempt + 1}/${MAX_ATTEMPTS})...`, 'info');

        const conn = peerRef.current.connect(hostId, { reliable: true });
        mpLog(`Created connection object to ${hostId}`, 'info');

        // Set a timeout to verify connection
        const timeoutId = setTimeout(() => {
            if (!connections.current.some(c => c.peer === hostId && c.open)) {
                mpLog(`Connection attempt ${attempt + 1} timed out (no open event).`, 'error');
                // Close the stalled connection attempt if it exists
                conn.close();
                const delay = BASE_DELAY * Math.pow(1.5, attempt); // Exponential backoff
                setTimeout(() => connectToHostWithRetry(hostId, attempt + 1), delay);
            }
        }, 8000); // 8s timeout per attempt (ICE gathering can take 5-10s)

        conn.on('error', (err) => {
            clearTimeout(timeoutId);
            conn.close();
            console.error('[Multiplayer] Connection error:', err);
            mpLog(`CONN_ERR: ${err.type} - ${err.message} — retrying...`, 'error');
            setStatusMsg('LINK_FAILED'); // Will be overwritten by retry or timeout
            const delay = BASE_DELAY * Math.pow(1.5, attempt);
            setTimeout(() => connectToHostWithRetry(hostId, attempt + 1), delay);
        });

        conn.on('open', () => {
            clearTimeout(timeoutId);
            mpLog('Connection to Host OPEN! Sending Join Request...', 'success');
            connections.current = [conn];
            setStatusMsg('CONNECTED');
            
            const joinData = { type: 'join', name: playerName, team: 'bravo' };
            mpLog(`Sending join packet: ${JSON.stringify(joinData)}`, 'info');
            conn.send(joinData);

            // @ts-ignore
            const pc = conn.peerConnection as RTCPeerConnection;
            if (pc) {
                pc.addEventListener('iceconnectionstatechange', () => {
                    const state = pc.iceConnectionState;
                    mpLog(`ICE State: ${state}`, state === 'failed' ? 'error' : 'info');
                    setStatusMsg(getStatusFromIceState(state));
                });
            }
        });

        conn.on('data', (rawData: unknown) => {
            const data = rawData as Record<string, any>;
            if (data.type === 'sync_squad' || data.type === 'welcome') {
                if (data.type === 'welcome') mpLog('Joined Squad Successfully', 'success');
                setSquad(data.squad);
            }
            if (data.type === 'start') {
                mpLog('Game Start signal received!', 'success');
                onGameStart(activeRoom!, false, data.squad, data.mpConfig);
            }
            if (data.type === 'update_name') {
                setSquad((prev) => prev.map(m => m.id === data.id ? { ...m, name: data.name } : m));
            }
            if (data.type === 'chat') {
                setChatMessages(prev => [...prev.slice(-49), { sender: data.sender, text: data.text, timestamp: Date.now() }]);
            }
            if (data.type === 'ping') {
                conn.send({ type: 'pong', timestamp: data.timestamp });
            }
            if (data.type === 'pong') {
                const rtt = Date.now() - data.timestamp;
                const myPing = Math.floor(rtt / 2);
                setSquad(prev => prev.map(m => (m.name === playerName && !isHost) ? { ...m, ping: myPing } : m));
            }
        });

        conn.on('close', () => {
            mpLog('Connection to Host closed.', 'error');
            setStatusMsg('DISCONNECTED');
            setActiveRoom(null);
        });
    };

    const switchTeam = () => {
        const myId = isHost ? 'host' : (peerRef.current?.id || '');
        const myMember = squadRef.current.find(m => m.id === myId || (m.name === playerName && !isHost));
        if (!myMember) return;
        const nextTeam: 'alpha' | 'bravo' = myMember.team === 'alpha' ? 'bravo' : 'alpha';

        if (isHost) {
            setSquad((prev) => {
                const next = prev.map(m => m.id === 'host' ? { ...m, team: nextTeam } : m);
                broadcastSquad(next);
                return next;
            });
        } else {
            const conn = connections.current[0];
            if (conn && conn.open) conn.send({ type: 'switch_team', name: playerName, team: nextTeam });
        }
    };

    const toggleReady = () => {
        if (isHost) return; // Host is always implicitly ready for deployment UI purposes
        const conn = connections.current[0];
        if (conn && conn.open) conn.send({ type: 'toggle_ready' });
    };

    const sendChatMessage = (text: string) => {
        const newMsg = { sender: playerName, text, timestamp: Date.now() };
        setChatMessages(prev => [...prev.slice(-49), newMsg]);
        
        if (isHost) {
            connections.current.forEach(c => {
                if (c.open) c.send({ type: 'chat', sender: playerName, text });
            });
        } else {
            const conn = connections.current[0];
            if (conn && conn.open) conn.send({ type: 'chat', sender: playerName, text });
        }
    };

    const initiateStart = (config: MPConfig) => {
        if (!isHost || !activeRoom) return;
        mpLog('Creating host game peer before broadcast...', 'info');

        createGamePeer(activeRoom)
            .then(({ peer, hostPeerId }) => {
                mpLog(`Game peer ready: ${hostPeerId}`, 'success');

                // Stash the open peer for MainScene so the host doesn't have to
                // recreate it while clients are already trying to connect.
                if (typeof window !== 'undefined') {
                    (window as any).__mpGamePeer = peer;
                    (window as any).__pendingGameConnections = [];
                    peer.on('connection', (conn) => {
                        (window as any).__pendingGameConnections.push(conn);
                    });
                }

                const startConfig = { ...config, hostPeerId };

                mpLog('Broadcasting Game Start to squad...', 'info');
                connections.current.forEach(c => {
                    if (c.open) c.send({
                        type: 'start',
                        squad: squadRef.current,
                        mpConfig: startConfig
                    });
                });

                // Give the start packet a moment to leave the data channel, then
                // the host transitions into the game.
                setTimeout(() => {
                    mpLog('Host launching game...', 'info');
                    onGameStart(activeRoom, true, squadRef.current, startConfig);
                }, 1200);
            })
            .catch((err) => {
                mpLog(`Failed to create game peer: ${err?.message || err?.type || err}`, 'error');
            });
    };

    return {
        activeRoom,
        isHost,
        squad,
        statusMsg,
        chatMessages,
        handleCreateRoom,
        handleJoinRoom,
        switchTeam,
        toggleReady,
        sendChatMessage,
        initiateStart,
        setSquad,
        setActiveRoom
    };
}
