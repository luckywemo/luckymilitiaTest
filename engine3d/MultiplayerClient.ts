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
  seq: number;
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

interface TimestampedState {
  state: PlayerState;
  recvTime: number;
}

const INTERP_DELAY = 100;
const MAX_BUFFER = 6;
const RECONNECT_MAX = 5;
const RECONNECT_BASE_DELAY = 1000;

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

  private stateBuffer: Map<string, TimestampedState[]> = new Map();
  private pings: Map<string, number> = new Map();
  private seq = 0;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectionHealth: Map<string, { lastRecv: number; missed: number }> = new Map();
  private healthInterval: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

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
  get ping(): number {
    const vals = Array.from(this.pings.values());
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }

  broadcastMessage(data: Record<string, unknown>) {
    this.broadcast(data as MPMessage);
  }

  setLocalState(state: Partial<PlayerState>) {
    if (this.currentState) {
      Object.assign(this.currentState, state);
      this.currentState.seq = ++this.seq;
    }
  }

  getInterpolatedState(id: string, renderTime: number): PlayerState | null {
    const buffer = this.stateBuffer.get(id);
    if (!buffer || buffer.length < 2) {
      return this.remoteStates.get(id) || null;
    }
    const targetTime = renderTime - INTERP_DELAY;
    let s0: TimestampedState | null = null;
    let s1: TimestampedState | null = null;
    for (let i = 0; i < buffer.length - 1; i++) {
      if (buffer[i].recvTime <= targetTime && buffer[i + 1].recvTime >= targetTime) {
        s0 = buffer[i];
        s1 = buffer[i + 1];
        break;
      }
    }
    if (!s0 || !s1) {
      return buffer[buffer.length - 1].state;
    }
    const span = s1.recvTime - s0.recvTime;
    const t = span > 0 ? (targetTime - s0.recvTime) / span : 1;
    const a = s0.state, b = s1.state;
    return {
      ...b,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
      yaw: a.yaw + (b.yaw - a.yaw) * t,
    };
  }

  createRoom(playerName: string, mode: GameMode, scoreLimit: number): string {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    this.playerName = playerName;
    this.isHost = true;
    this.roomCode = code;
    this.team = 'alpha';
    this.destroyed = false;

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
      this.startHealthCheck();
    });

    this.peer.on('error', (err: any) => {
      mpLog(`Host error: ${err.type} - ${err.message}`, 'error');
      if (err.type === 'unavailable-id' && !this.destroyed) {
        mpLog('Host ID collision, retrying with new code...', 'info');
        this.peer?.destroy();
        this.peer = null;
        setTimeout(() => this.createRoom(playerName, mode, scoreLimit), 500);
        return;
      }
      this.emit('error', { error: err });
    });

    this.peer.on('disconnected', () => {
      mpLog('Host peer disconnected from signaling, attempting reconnect...', 'info');
      if (!this.destroyed) this.peer?.reconnect();
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
    this.destroyed = false;
    this.reconnectAttempts = 0;

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

    this.peer.on('disconnected', () => {
      mpLog('Client peer disconnected from signaling, attempting reconnect...', 'info');
      if (!this.destroyed) this.peer?.reconnect();
    });
  }

  private connectToHost(hostId: string, attempt = 0) {
    if (!this.peer || attempt >= RECONNECT_MAX) {
      this.emit('error', { error: { message: 'Connection timeout' } });
      this.emit('reconnect_failed', {});
      return;
    }

    const conn = this.peer.connect(hostId, { reliable: true });
    const timeout = setTimeout(() => {
      if (!this.connections.has(hostId)) {
        conn.close();
        this.scheduleReconnect(hostId, attempt);
      }
    }, 8000);

    conn.on('open', () => {
      clearTimeout(timeout);
      this.reconnectAttempts = 0;
      mpLog('Connected to 3D host', 'success');
      this.connections.set(hostId, conn);
      this.connectionHealth.set(hostId, { lastRecv: Date.now(), missed: 0 });
      conn.send({ type: 'join', name: this.playerName, team: this.team });
      this.startSync();
      this.startPing();
      this.startHealthCheck();
      this.emit('connected', {});
    });

    conn.on('data', (data: any) => this.handleMessage(hostId, data));

    conn.on('close', () => {
      clearTimeout(timeout);
      this.connections.delete(hostId);
      this.connectionHealth.delete(hostId);
      this.emit('disconnected', {});
      if (!this.destroyed && this.roomCode) {
        this.scheduleReconnect(hostId, 0);
      }
    });

    conn.on('error', () => {
      clearTimeout(timeout);
      this.scheduleReconnect(hostId, attempt);
    });
  }

  private scheduleReconnect(hostId: string, attempt: number) {
    if (this.destroyed || attempt >= RECONNECT_MAX) {
      mpLog(`Reconnect failed after ${RECONNECT_MAX} attempts`, 'error');
      this.emit('reconnect_failed', {});
      return;
    }
    this.reconnectAttempts = attempt + 1;
    const delay = RECONNECT_BASE_DELAY * Math.pow(1.5, attempt);
    mpLog(`Scheduling reconnect attempt ${this.reconnectAttempts}/${RECONNECT_MAX} in ${Math.round(delay)}ms`, 'info');
    this.emit('reconnecting', { attempt: this.reconnectAttempts, maxAttempts: RECONNECT_MAX });
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (!this.destroyed && this.peer) {
        if (!this.peer.destroyed) {
          this.connectToHost(hostId, attempt + 1);
        } else {
          this.peer = new Peer(PEER_CONFIG);
          this.peer.on('open', () => {
            this.currentState = this.makeInitialState(this.peer!.id);
            this.connectToHost(hostId, attempt + 1);
          });
          this.peer.on('error', (err: any) => {
            this.emit('error', { error: err });
          });
        }
      }
    }, delay);
  }

  private handleIncomingConnection(conn: any) {
    mpLog(`Incoming 3D connection: ${conn.peer}`, 'info');

    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
      this.connectionHealth.set(conn.peer, { lastRecv: Date.now(), missed: 0 });
      mpLog(`Connection established: ${conn.peer}`, 'success');
      this.emit('connected', {});
    });

    conn.on('data', (data: any) => this.handleMessage(conn.peer, data));

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      this.connectionHealth.delete(conn.peer);
      this.stateBuffer.delete(conn.peer);
      this.remoteStates.delete(conn.peer);
      this.emit('player_left', { id: conn.peer });
    });
  }

  private handleMessage(fromId: string, data: MPMessage) {
    if (!data || !data.type) return;

    const health = this.connectionHealth.get(fromId);
    if (health) {
      health.lastRecv = Date.now();
      health.missed = 0;
    }

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

      case 'sync': {
        const state = data.state as PlayerState;
        const existing = this.remoteStates.get(fromId);
        if (existing) {
          Object.assign(existing, state);
        } else {
          this.remoteStates.set(fromId, state);
        }
        const now = performance.now();
        let buf = this.stateBuffer.get(fromId);
        if (!buf) { buf = []; this.stateBuffer.set(fromId, buf); }
        buf.push({ state: { ...state }, recvTime: now });
        if (buf.length > MAX_BUFFER) buf.shift();
        this.emit('sync', { id: fromId, state });
        break;
      }

      case 'shot':
        this.emit('shot', data as unknown as ShotEvent & MPMessage);
        if (this.isHost) this.broadcast(data, fromId);
        break;

      case 'hit': {
        const hitData = data as unknown as HitEvent & MPMessage;
        if (this.isHost) {
          const target = this.remoteStates.get(hitData.toId) || (hitData.toId === this.myId ? this.currentState : null);
          if (target && !target.isDead && target.hp > 0) {
            target.hp -= hitData.damage;
            if (target.hp <= 0) {
              target.isDead = true;
              target.deaths++;
              const killer = this.remoteStates.get(hitData.fromId) || (hitData.fromId === this.myId ? this.currentState : null);
              if (killer) {
                killer.kills++;
                killer.score += hitData.isHeadshot ? 150 : 100;
              }
              const killMsg = { type: 'kill', killerId: hitData.fromId, victimId: hitData.toId, weapon: data.weapon || '', isHeadshot: hitData.isHeadshot, timestamp: Date.now() } as MPMessage;
              this.emit('kill', killMsg as any);
              this.broadcast(killMsg);
              this.emit('score_update', { scores: this.getAllScores() });
              this.broadcast({ type: 'score_update', scores: this.getAllScores() });
            } else {
              this.broadcast({ type: 'hit_confirm', toId: hitData.toId, hp: target.hp }, fromId);
              this.sendTo(hitData.fromId, { type: 'hit_confirm', toId: hitData.toId, hp: target.hp });
            }
          }
        }
        this.emit('hit', hitData);
        break;
      }

      case 'hit_confirm': {
        const target = this.remoteStates.get(data.toId) || (data.toId === this.myId ? this.currentState : null);
        if (target) target.hp = data.hp;
        break;
      }

      case 'kill':
        this.emit('kill', data as unknown as KillEvent & MPMessage);
        if (this.isHost) this.broadcast(data, fromId);
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

      case 'pong': {
        const ping = Date.now() - data.t;
        this.pings.set(fromId, ping);
        this.emit('ping', { id: fromId, ping });
        break;
      }
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
      seq: 0,
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

  private startHealthCheck() {
    if (this.healthInterval) clearInterval(this.healthInterval);
    this.healthInterval = setInterval(() => {
      const now = Date.now();
      this.connectionHealth.forEach((health, id) => {
        const elapsed = now - health.lastRecv;
        if (elapsed > 6000) {
          health.missed++;
          mpLog(`Connection ${id} missed heartbeat (${health.missed})`, 'error');
          if (health.missed >= 3) {
            const conn = this.connections.get(id);
            if (conn) { try { conn.close(); } catch {} }
            this.connections.delete(id);
            this.connectionHealth.delete(id);
            this.stateBuffer.delete(id);
            this.remoteStates.delete(id);
            this.emit('player_left', { id });
          }
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
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.syncInterval) clearInterval(this.syncInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.healthInterval) clearInterval(this.healthInterval);
    this.connections.forEach(conn => { try { conn.close(); } catch {} });
    this.connections.clear();
    this.connectionHealth.clear();
    this.stateBuffer.clear();
    if (this.peer) { try { this.peer.destroy(); } catch {} this.peer = null; }
    this.remoteStates.clear();
    this.pings.clear();
    this.handlers.clear();
  }
}
