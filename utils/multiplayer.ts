import Peer from 'peerjs';

// Helper to dispatch logs to DebugConsole
export const mpLog = (message: string, type: 'info' | 'error' | 'success' = 'info') => {
    console.log(`[MP] ${message}`); // Keep console log for devtools
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('MULTIPLAYER_LOG', {
            detail: { message, type }
        }));
    }
};

/**
 * Standardized PeerJS Configuration for Lucky Militia
 * Optimized for cross-device support (Cloud Signaling + Robust ICE)
 */

const iceConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' },
        { urls: 'stun:stun.relay.metered.ca:80' },
        {
            urls: 'turn:global.relay.metered.ca:80',
            username: '85b76da0eabdfe52173995f4',
            credential: '7O3/by5C5OZALQ/5',
        },
        {
            urls: 'turn:global.relay.metered.ca:80?transport=tcp',
            username: '85b76da0eabdfe52173995f4',
            credential: '7O3/by5C5OZALQ/5',
        },
        {
            urls: 'turn:global.relay.metered.ca:443',
            username: '85b76da0eabdfe52173995f4',
            credential: '7O3/by5C5OZALQ/5',
        },
        {
            urls: 'turns:global.relay.metered.ca:443?transport=tcp',
            username: '85b76da0eabdfe52173995f4',
            credential: '7O3/by5C5OZALQ/5',
        }
    ],
    iceTransportPolicy: 'all' as RTCIceTransportPolicy,
    iceCandidatePoolSize: 10,
};

export const PEER_CONFIG = {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    debug: 2,
    config: iceConfig
};

/**
 * Generates a sanitized room code for PeerJS IDs
 */
export const getPeerId = (type: 'SCTR' | 'GAME', roomCode: string) => {
    return `LM-${type}-${roomCode}`;
};

/**
 * Creates a resilient host GAME peer. Retries with a random suffix if the
 * deterministic ID is still registered on the PeerJS cloud server.
 */
export const createGamePeer = (roomCode: string): Promise<{ peer: Peer; hostPeerId: string }> => {
    const base = getPeerId('GAME', roomCode);

    const attempt = (id: string, tryCount: number): Promise<{ peer: Peer; hostPeerId: string }> => {
        return new Promise((resolve, reject) => {
            let settled = false;
            const peer = new Peer(id, PEER_CONFIG);

            const timeout = setTimeout(() => {
                if (settled) return;
                settled = true;
                peer.destroy();
                reject(new Error('GAME peer creation timed out'));
            }, 10000);

            peer.on('open', (openId) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                resolve({ peer, hostPeerId: openId });
            });

            peer.on('error', (err) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeout);
                if (err.type === 'unavailable-id' && tryCount < 5) {
                    peer.destroy();
                    const suffix = Math.random().toString(36).slice(2, 8);
                    attempt(`${base}-${suffix}`, tryCount + 1).then(resolve).catch(reject);
                } else {
                    peer.destroy();
                    reject(err);
                }
            });
        });
    };

    return attempt(base, 0);
};

/**
 * Common status messages for ICE states
 */
export const getStatusFromIceState = (state: RTCIceConnectionState): string => {
    switch (state) {
        case 'checking': return 'ESTABLISHING_UPLINK...';
        case 'connected':
        case 'completed': return 'SIGNAL_ACQUIRED';
        case 'failed': return 'LINK_FAILED (NAT_BLOCK)';
        case 'disconnected': return 'SIGNAL_LOST';
        case 'closed': return 'UPLINK_CLOSED';
        default: return state.toUpperCase();
    }
};
