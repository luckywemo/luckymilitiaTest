import Peer from 'peerjs';
import { PEER_CONFIG, getPeerId, mpLog } from '../utils/multiplayer';

export type GameMode = 'tdm' | 'ffa' | '1v1' | 'domination' | 'hardpoint';

export interface PlayerState {
  id: string;
  name: string;
  team: 'alpha' | 'bravo';
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  weapon: string;
  isFiring: boolean;
  isADS: boolean;
  isCrouching: boolean;
  isDead: boolean;
  kills: number;
  deaths: number;
  score: number;
}

export interface ShotEvent {
  fromId: string;
  originX: number; originY: number; originZ: number;
  dirX: number; dirY: number; dirZ: number;
  weapon: string;
  timestamp: number;
}

export interface HitEvent {
  fromId: string;
  toId: string;
  damage: number;
  isHeadshot: boolean;
  timestamp: number;
}

export interface KillEvent {
  killerId: string;
  victimId: string;
  weapon: string;
  isHeadshot: boolean;
  timestamp: number;
}

export interface CaptureZone {
  id: string;
  x: number; z: number;
  radius: number;
  team: 'alpha' | 'bravo' | 'neutral';
  progress: number; // 0-100
}

export interface MPConfig {
  mode: GameMode;
  scoreLimit: number;
  hostPeerId: string;
  mapSeed: string;
}

interface MPMessage {
  type: string;
  [key: string]: any;
}

type MessageHandler = (msg: any) => void;

export class MultiplayerClient {
  private peer: Peer | null = null;
  private connections: Map<string, any> = new Map();
  private isHost = false;
  private roomCode: string | null = null;
  private playerName = '';
  private team: 'alpha' | 'bravo' = 'alpha';
  private config: MPConfig | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private currentState: PlayerState | null = null;
  private remoteStates: Map<string, PlayerState> = new Map();
  private captureZones: CaptureZone[] = [];

  on(event: string, handler: MessageHandler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event)!.push(handler);
  }

  private emit(event: string, msg: any) {
    const handlers = this.handlers.get(event);
    if (handlers) handlers.forEach(h => h(msg));
  }

  get isConnected(): boolean { return this.connections.size > 0; }
  get isHosting(): boolean { return this.isHost; }
  get room(): string | null { return this.roomCode; }
  get mode(): GameMode | null { return this.config?.mode || null; }
  get remotePlayers(): PlayerState[] { return Array.from(this.remoteStates.values()); }
  get zones(): CaptureZone[] { return this.captureZones; }
  get myId(): string { return this.peer?.id || ''; }
  get myTeam(): 'alpha' | 'bravo' { return this.team; }
  get myName(): string { return this.playerName; }

  broadcastMessage(data: Record<string, unknown>) {
    this.broadcast(data as MPMessage);
  }

  setLocalState(state: Partial<PlayerState>) {
    if (this.currentState) {
      Object.assign(this.currentState, state);
    }
  }

  createRoom(playerName: string, mode: GameMode, scoreLimit: number): string {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    this.playerName = playerName;
    this.isHost = true;
    this.roomCode = code;
    this.team = 'alpha';

    const peerId = getPeerId('FPS3D', code);
    mpLog(`Creating 3D host peer: ${peerId}`, 'info');

    this.peer = new Peer(peerId, PEER_CONFIG);

    this.peer.on('open', (id) => {
      mpLog(`3D Host ready: ${id}`, 'success');
      this.config = { mode, scoreLimit, hostPeerId: id, mapSeed: code };
      this.currentState = this.makeInitialState(id);
      this.emit('host_ready', { code, peerId: id });
      this.startSync();
      this.startPing();
    });

    this.peer.on('error', (err: any) => {
      mpLog(`Host error: ${err.type} - ${err.message}`, 'error');
      this.emit('error', { error: err });
    });

    this.peer.on('connection', (conn: any) => {
      this.handleIncomingConnection(conn);
    });

    return code;
  }

  joinRoom(code: string, playerName: string): void {
    this.playerName = playerName;
    this.isHost = false;
    this.roomCode = code;
    this.team = 'bravo';

    mpLog(`Joining 3D room: ${code}`, 'info');
    this.peer = new Peer(PEER_CONFIG);

    this.peer.on('open', (id) => {
      mpLog(`Client peer ready: ${id}, connecting to host...`, 'info');
      this.currentState = this.makeInitialState(id);
      this.connectToHost(getPeerId('FPS3D', code));
    });

    this.peer.on('error', (err: any) => {
      mpLog(`Client error: ${err.type} - ${err.message}`, 'error');
      this.emit('error', { error: err });
    });
  }

  private connectToHost(hostId: string, attempt = 0) {
    if (!this.peer || attempt >= 10) {
      this.emit('error', { error: { message: 'Connection timeout' } });
      return;
    }

    const conn = this.peer.connect(hostId, { reliable: true });
    const timeout = setTimeout(() => {
      if (!this.connections.has(hostId)) {
        conn.close();
        const delay = 1000 * Math.pow(1.5, attempt);
        setTimeout(() => this.connectToHost(hostId, attempt + 1), delay);
      }
    }, 8000);

    conn.on('open', () => {
      clearTimeout(timeout);
      mpLog('Connected to 3D host', 'success');
      this.connections.set(hostId, conn);
      conn.send({ type: 'join', name: this.playerName, team: this.team });
      this.startSync();
      this.startPing();
      this.emit('connected', {});
    });

    conn.on('data', (data: any) => this.handleMessage(hostId, data));

    conn.on('close', () => {
      clearTimeout(timeout);
      this.connections.delete(hostId);
      this.remoteStates.clear();
      this.emit('disconnected', {});
    });

    conn.on('error', () => {
      clearTimeout(timeout);
      const delay = 1000 * Math.pow(1.5, attempt);
      setTimeout(() => this.connectToHost(hostId, attempt + 1), delay);
    });
  }

  private handleIncomingConnection(conn: any) {
    mpLog(`Incoming 3D connection: ${conn.peer}`, 'info');

    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      mpLog(`Connection established: ${conn.peer}`, 'success');
      this.emit('connected', {});
    });

    conn.on('data', (data: any) => this.handleMessage(conn.peer, data));

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.remoteStates.delete(conn.peer);
      this.emit('player_left', { id: conn.peer });
    });
  }

  private handleMessage(fromId: string, data: MPMessage) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'join':
        this.remoteStates.set(fromId, this.makeInitialState(fromId, data.name, data.team));
        this.emit('player_joined', { id: fromId, name: data.name, team: data.team });
        if (this.isHost) {
          this.broadcast({ type: 'config', config: this.config });
          this.broadcast({ type: 'player_list', players: this.getAllStates() });
        }
        break;

      case 'config':
        this.config = data.config;
        this.emit('config', { config: data.config });
        break;

      case 'player_list':
        const list = data.players as PlayerState[];
        list.forEach(p => {
          if (p.id !== this.myId) this.remoteStates.set(p.id, p);
        });
        this.emit('player_list', { players: list });
        break;

      case 'sync':
        const existing = this.remoteStates.get(fromId);
        if (existing) {
          Object.assign(existing, data.state);
        } else {
          this.remoteStates.set(fromId, data.state as PlayerState);
        }
        this.emit('sync', { id: fromId, state: data.state });
        break;

      case 'shot':
        this.emit('shot', data as unknown as ShotEvent & MPMessage);
        if (this.isHost) this.broadcast(data, fromId);
        break;

      case 'hit':
        this.emit('hit', data as unknown as HitEvent & MPMessage);
        if (this.isHost) this.broadcast(data, fromId);
        break;

      case 'kill':
        this.emit('kill', data as unknown as KillEvent & MPMessage);
        if (this.isHost) this.broadcast(data, fromId);
        // Update scores
        if (this.isHost && this.config) {
          const killer = this.remoteStates.get(data.killerId) || this.currentState;
          if (killer) {
            killer.kills++;
            killer.score += data.isHeadshot ? 150 : 100;
            this.emit('score_update', { scores: this.getAllScores() });
            this.broadcast({ type: 'score_update', scores: this.getAllScores() });
          }
        }
        break;

      case 'score_update':
        this.emit('score_update', { scores: data.scores });
        break;

      case 'zone_update':
        this.captureZones = data.zones;
        this.emit('zone_update', { zones: data.zones });
        break;

      case 'respawn':
        this.emit('respawn', { id: data.id, x: data.x, y: data.y, z: data.z });
        break;

      case 'game_over':
        this.emit('game_over', { winner: data.winner, scores: data.scores });
        break;

      case 'ping':
        if (this.isHost) this.sendTo(fromId, { type: 'pong', t: data.t });
        break;

      case 'pong':
        const ping = Date.now() - data.t;
        this.emit('ping', { id: fromId, ping });
        break;
    }
  }

  private makeInitialState(id: string, name?: string, team?: 'alpha' | 'bravo'): PlayerState {
    return {
      id,
      name: name || this.playerName,
      team: team || this.team,
      x: 0, y: 1.7, z: 0,
      yaw: 0, pitch: 0,
      hp: 100,
      weapon: 'smg',
      isFiring: false, isADS: false, isCrouching: false, isDead: false,
      kills: 0, deaths: 0, score: 0,
    };
  }

  private getAllStates(): PlayerState[] {
    const all = Array.from(this.remoteStates.values());
    if (this.currentState) all.push(this.currentState);
    return all;
  }

  private getAllScores(): Record<string, { kills: number; deaths: number; score: number; team: string }> {
    const scores: Record<string, any> = {};
    this.getAllStates().forEach(p => {
      scores[p.id] = { kills: p.kills, deaths: p.deaths, score: p.score, team: p.team };
    });
    return scores;
  }

  private broadcast(data: MPMessage, excludeId?: string) {
    this.connections.forEach((conn, id) => {
      if (conn.open && id !== excludeId) {
        try { conn.send(data); } catch (e) { mpLog(`Broadcast error: ${e}`, 'error'); }
      }
    });
  }

  private sendTo(id: string, data: MPMessage) {
    const conn = this.connections.get(id);
    if (conn && conn.open) {
      try { conn.send(data); } catch (e) { mpLog(`Send error: ${e}`, 'error'); }
    }
  }

  sendShot(shot: ShotEvent) {
    const msg = { type: 'shot', ...shot } as MPMessage;
    this.broadcast(msg);
  }

  sendHit(hit: HitEvent) {
    const msg = { type: 'hit', ...hit } as MPMessage;
    this.broadcast(msg);
  }

  sendKill(kill: KillEvent) {
    const msg = { type: 'kill', ...kill } as MPMessage;
    this.broadcast(msg);
  }

  sendRespawn(x: number, y: number, z: number) {
    const msg = { type: 'respawn', id: this.myId, x, y, z } as MPMessage;
    this.broadcast(msg);
  }

  sendGameOver(winner: string, scores: any) {
    const msg = { type: 'game_over', winner, scores } as MPMessage;
    this.broadcast(msg);
  }

  private startSync() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (this.currentState && this.connections.size > 0) {
        this.broadcast({ type: 'sync', state: this.currentState });
      }
    }, 50); // 20Hz sync rate
  }

  private startPing() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      this.connections.forEach((conn, id) => {
        if (conn.open) {
          try { conn.send({ type: 'ping', t: Date.now() }); } catch {}
        }
      });
    }, 2000);
  }

  setTeam(team: 'alpha' | 'bravo') {
    this.team = team;
    if (this.currentState) this.currentState.team = team;
    this.broadcast({ type: 'team_switch', id: this.myId, team });
  }

  destroy() {
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.connections.forEach(conn => { try { conn.close(); } catch {} });
    this.connections.clear();
    if (this.peer) { try { this.peer.destroy(); } catch {} this.peer = null; }
    this.remoteStates.clear();
    this.handlers.clear();
  }
}
