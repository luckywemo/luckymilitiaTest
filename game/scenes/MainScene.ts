import Phaser from 'phaser';
import Peer, { DataConnection } from 'peerjs';
import { PEER_CONFIG, getPeerId } from '../../utils/multiplayer';
import { CharacterClass, MissionConfig, MPConfig } from '../../App';

export interface WeaponConfig {
  name: string;
  fireRate: number;
  damage: number;
  recoil: number;
  bullets: number;
  spread: number;
  projectileScale: number;
  projectileTint: number;
  maxAmmo: number;
  isInfinite?: boolean;
  key: string;
  icon: string;
  type: 'kinetic' | 'energy' | 'explosive';
  category: 'pistol' | 'rifle' | 'heavy';
  homing?: boolean;
  speed?: number;
}

export const WEAPONS_CONFIG: Record<string, WeaponConfig> = {
  pistol: { name: 'M9 SIDEARM', fireRate: 350, damage: 15, recoil: 150, bullets: 1, spread: 0.02, projectileScale: 0.8, projectileTint: 0xffcc00, maxAmmo: 999, isInfinite: true, key: 'pistol', icon: '🔫', type: 'kinetic', category: 'pistol', speed: 2000 },
  smg: { name: 'MP5 TACTICAL', fireRate: 100, damage: 10, recoil: 80, bullets: 1, spread: 0.12, projectileScale: 0.6, projectileTint: 0xffaa00, maxAmmo: 45, key: 'smg', icon: '⚔️', type: 'kinetic', category: 'rifle', speed: 2200 },
  shotgun: { name: '870 BREACHER', fireRate: 900, damage: 20, recoil: 2200, bullets: 8, spread: 0.9, projectileScale: 0.9, projectileTint: 0xff4444, maxAmmo: 8, key: 'shotgun', icon: '🔥', type: 'kinetic', category: 'heavy', speed: 1800 },
  launcher: { name: 'M32 GL', fireRate: 1500, damage: 80, recoil: 1200, bullets: 1, spread: 0, projectileScale: 2.5, projectileTint: 0xf97316, maxAmmo: 6, key: 'launcher', icon: '🚀', type: 'explosive', category: 'heavy', speed: 1200 },
  railgun: { name: 'XM-25 RAIL', fireRate: 2000, damage: 150, recoil: 1500, bullets: 1, spread: 0, projectileScale: 4.0, projectileTint: 0x00ffff, maxAmmo: 3, key: 'railgun', icon: '⚡', type: 'energy', category: 'heavy', speed: 4000 },
  plasma: { name: 'X-ION REPEATER', fireRate: 200, damage: 30, recoil: 200, bullets: 1, spread: 0.05, projectileScale: 1.8, projectileTint: 0xff00ff, maxAmmo: 20, key: 'plasma', icon: '🔮', type: 'energy', category: 'rifle', speed: 1600 }
};

const teamColors = { alpha: '#f97316', bravo: '#22d3ee' };

export class MainScene extends Phaser.Scene {
  public declare add: Phaser.GameObjects.GameObjectFactory;
  public declare physics: Phaser.Physics.Arcade.ArcadePhysics;
  public declare cameras: Phaser.Cameras.Scene2D.CameraManager;
  public declare time: Phaser.Time.Clock;
  public declare cache: Phaser.Cache.CacheManager;

  public declare make: Phaser.GameObjects.GameObjectCreator;
  public declare tweens: Phaser.Tweens.TweenManager;
  public declare load: Phaser.Loader.LoaderPlugin;

  public player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private playerShadow!: Phaser.GameObjects.Sprite;
  private playerLabel!: Phaser.GameObjects.Text;
  private weaponLabel!: Phaser.GameObjects.Text;
  private playerHpBar!: Phaser.GameObjects.Graphics;
  private unitAuras!: Phaser.GameObjects.Graphics;
  private hitMarker!: Phaser.GameObjects.Image;
  private playerLight!: Phaser.GameObjects.Light;

  private map!: Phaser.Tilemaps.Tilemap;
  private floorLayer!: Phaser.Tilemaps.TilemapLayer;
  private wallLayer!: Phaser.Tilemaps.TilemapLayer;

  private bullets!: Phaser.Physics.Arcade.Group;
  private aiBots!: Phaser.Physics.Arcade.Group;
  private otherPlayersGroup!: Phaser.Physics.Arcade.Group;
  private luckBoxes!: Phaser.Physics.Arcade.Group;
  private weaponBoxes!: Phaser.Physics.Arcade.Group;
  private weaponItems!: Phaser.Physics.Arcade.Group;
  private hardpointZone!: Phaser.GameObjects.Arc;
  private hardpointCenter = { x: 1000, y: 1000 };

  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  private otherPlayers = new Map<string, Phaser.Types.Physics.Arcade.SpriteWithDynamicBody>();
  private otherLabels = new Map<string, Phaser.GameObjects.Text>();
  private botLabels = new Map<string, Phaser.GameObjects.Text>();

  private playerName = 'Guest';
  private playerTeam: 'alpha' | 'bravo' = 'alpha';
  private characterClass: CharacterClass = 'STRIKER';
  private currentWeapon: WeaponConfig = WEAPONS_CONFIG.pistol;
  private health = 100;
  private maxHealth = 100;
  private shield = 100;
  private maxShield = 100;
  private lastFired = 0;
  private kills = 0;
  private deaths = 0;
  private lives = 3;
  private maxLives = 3;
  private points = 0;
  private ammo = 0;
  private isRespawning = false;
  private isMissionOver = false;
  private abilityCooldown = 0;
  private mission?: MissionConfig;
  private mpConfig?: MPConfig;
  private roomId: string | null = null;
  private isHost = false;
  private seededRnd!: Phaser.Math.RandomDataGenerator;
  private rngSeed: number = 0;
  private nextRnd!: () => number;
  private rndBetween!: (min: number, max: number) => number;

  private teamScores = { alpha: 0, bravo: 0 };
  private safeZoneTimer = 0;
  private invulnerabilityTimer = 0;
  private spawnPoint = { x: 1000, y: 1000 };

  public audioEnabled = true;
  public difficultyModifier = 1;
  public virtualInput = { moveX: 0, moveY: 0, aimAngle: null as number | null, isFiring: false, isAbility: false };

  private muzzleEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private explosionEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private abilityEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;
  private bloodEmitter!: Phaser.GameObjects.Particles.ParticleEmitter;

  // Operation Blackout: New Mission State
  private collectedItems = 0;
  private survivalTimer = 0;
  private dataDrives!: Phaser.Physics.Arcade.Group;
  private tileHP = new Map<string, number>();

  // New Audio & AI Steering State
  private currentMusic: Phaser.Sound.BaseSound | null = null;
  private ambientLoops: Phaser.Sound.BaseSound[] = [];
  private audioInitialized = false;
  private playlist: string[] = ['bg_track_1'];
  private currentTrackIndex: number = 0;
  private botLastPositions: Map<string, { x: number, y: number, time: number }> = new Map();

  constructor() {
    super('MainScene');
  }

  init(data: any) {
    this.playerName = data.playerName;
    this.characterClass = data.characterClass || 'STRIKER';
    this.mission = data.mission;
    this.mpConfig = data.mpConfig;
    this.roomId = data.roomId;
    this.isHost = data.isHost;

    if (data.squad) {
      const myMember = data.squad.find((m: any) => m.name === this.playerName);
      if (myMember) this.playerTeam = myMember.team;
    }

    this.maxHealth = this.characterClass === 'TITAN' ? 200 : this.characterClass === 'GHOST' ? 100 : 150;
    this.health = this.maxHealth;
    this.maxShield = 100;
    this.shield = this.maxShield;
    this.ammo = this.currentWeapon.maxAmmo;
    this.audioEnabled = data.audioEnabled !== undefined ? data.audioEnabled : true;
    this.difficultyModifier = data.difficultyModifier || 1;
    this.teamScores = { alpha: 0, bravo: 0 };
    this.kills = 0;
    this.points = 0;
    this.lives = this.mission ? 3 : 999;
    this.maxLives = this.mission ? 3 : 999;
    this.isMissionOver = false;

    // Mission Type Init
    this.collectedItems = 0;
    if (this.mission && this.mission.type === 'SURVIVAL') {
      this.survivalTimer = this.mission.targetValue; // targetValue is seconds
    } else {
      this.survivalTimer = 0;
    }

    // Safety fallback for mission goals
    if (this.mission && (!this.mission.targetValue || this.mission.targetValue <= 0)) {
        this.mission.targetValue = 5; // Default safe goal
    }
  }

  preload() {
    if (!this.audioEnabled) return;
    const audioFiles = [
      { key: 'sfx_pistol', path: '/assets/audio/pistol.wav' },
      { key: 'sfx_shotgun', path: '/assets/audio/shotgun.wav' },
      { key: 'sfx_hit_flesh', path: '/assets/audio/squit.wav' },
      { key: 'sfx_powerup', path: '/assets/audio/p-chi.wav' },
      { key: 'sfx_boost', path: '/assets/audio/thrust.mp3' },
      { key: 'sfx_death_human', path: '/assets/audio/alien-death.flac' },
      { key: 'sfx_victory', path: '/assets/audio/level-complete.wav' },
      { key: 'bg_track_1', path: '/assets/audio/bg-music.mp3' }, // Optimized MP3 version
    ];
    audioFiles.forEach(({ key, path }) => {
      if (!this.cache.audio.exists(key)) {
        this.load.audio(key, path);
      }
    });
  }

  create() {
    window.dispatchEvent(new CustomEvent('SCENE_READY'));

    // Fix browser autoplay restrictions: Resume audio context on first interaction
    this.input.once('pointerdown', () => {
      const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
      if (soundManager.context && soundManager.context.state === 'suspended') {
        soundManager.context.resume().then(() => {
          console.log('[Audio] Context resumed successfully');
          this.initAudio();
        });
      }
    });

    // Initialize audio if context is already running (only once)
    const soundManager = this.sound as Phaser.Sound.WebAudioSoundManager;
    if (soundManager.context && soundManager.context.state === 'running') {
      this.initAudio();
    }

    // Initialize seeded random for consistent map generation
    // Initialize custom LCG for guaranteed deterministic map generation across devices
    // Phaser's internal RNG can vary by implementation. We use a simple LCG here.
    const seedString = this.roomId || 'mission-seed';
    let hash = 0;
    for (let i = 0; i < seedString.length; i++) {
      hash = ((hash << 5) - hash) + seedString.charCodeAt(i);
      hash |= 0; // Convert to 32bit integer
    }
    this.rngSeed = Math.abs(hash);

    // Helper for next random integer
    this.nextRnd = () => {
      this.rngSeed = (this.rngSeed * 1664525 + 1013904223) % 4294967296;
      return this.rngSeed / 4294967296;
    };

    // Helper for range [min, max]
    this.rndBetween = (min: number, max: number) => {
      return Math.floor(this.nextRnd() * (max - min + 1)) + min;
    };

    console.log(`[LCG] Initialized with seed: ${this.roomId} -> Hash: ${this.rngSeed}`);

    this.seededRnd = new Phaser.Math.RandomDataGenerator([this.roomId || 'mission-seed']); // Keep for legacy callbacks or non-critical RNG if needed, but we will use custom for map.

    // Dynamic Lighting Disabled for compatibility
    // this.lights.enable();
    // this.lights.setAmbientColor(0x3a3a3a);

    this.physics.world.setBounds(0, 0, 2000, 2000);
    
    this.setupTextures();
    this.add.tileSprite(1000, 1000, 2000, 2000, 'floor_tile').setDepth(-10);
    this.createArena();

    this.bullets = this.physics.add.group({ defaultKey: 'bullet', maxSize: 400 });
    this.aiBots = this.physics.add.group();
    this.otherPlayersGroup = this.physics.add.group({ immovable: true });
    this.luckBoxes = this.physics.add.group();
    this.weaponBoxes = this.physics.add.group();
    this.weaponItems = this.physics.add.group();
    this.dataDrives = this.physics.add.group();
    this.unitAuras = this.add.graphics().setDepth(1);

    if (this.mpConfig?.mode === 'HARDPOINT') {
      this.hardpointZone = this.add.circle(1000, 1000, 128, 0xffffff, 0.1).setDepth(-1).setStrokeStyle(2, 0xffffff);
    }

    const initialTex = `hum_${this.characterClass.toLowerCase()}_${this.currentWeapon.category}`;
    this.playerShadow = this.add.sprite(this.spawnPoint.x, this.spawnPoint.y, 'shadow').setAlpha(0.3).setScale(1.5);
    this.player = this.physics.add.sprite(this.spawnPoint.x, this.spawnPoint.y, initialTex);
    this.player.setCollideWorldBounds(true).setDrag(4500).setCircle(22, 10, 10).setDepth(10);
    this.player.setData('team', this.playerTeam);

    const speedMult = this.characterClass === 'GHOST' ? 1.4 : this.characterClass === 'TITAN' ? 0.8 : 1.1;
    this.player.setMaxVelocity(750 * speedMult);

    this.setupUIElements();
    this.setupEmitters();
    this.setupPhysics();

    // Initialize 5-second safe zone at battle start
    this.safeZoneTimer = 5000;

    if (this.roomId) this.initMultiplayer();

    this.cameras.main.startFollow(this.player, true, 1, 1);
    // Camera bounds removed to allow centering on player near edges

    if (this.isHost && this.mpConfig) {
      for (let i = 0; i < this.mpConfig.alphaBots; i++) this.spawnAIBot('alpha');
      for (let i = 0; i < this.mpConfig.bravoBots; i++) this.spawnAIBot('bravo');

      // Backfill notification
      const totalBots = this.mpConfig.alphaBots + this.mpConfig.bravoBots;
      if (totalBots > 0) {
        this.time.delayedCall(1500, () => {
          this.showFloatingText(this.player.x, this.player.y - 120, `AI_BACKFILL: ${this.mpConfig!.alphaBots}α + ${this.mpConfig!.bravoBots}β UNITS_DEPLOYED`, '#22d3ee');
        });
      }
    } else if (this.mission) {
      const botCount = Math.floor(8 * this.difficultyModifier);
      for (let i = 0; i < botCount; i++) this.spawnAIBot('bravo');

      this.time.delayedCall(1500, () => {
        this.showFloatingText(this.player.x, this.player.y - 120, `HOSTILES_DETECTED: ${botCount} UNITS`, '#ff4444');
      });

      if (this.mission.type === 'EXTRACTION') {
        this.spawnExtractionItems();
      }
    }

    if (!this.roomId || this.isHost) {
      this.time.addEvent({ delay: 10000, callback: () => this.spawnLuckBox(), loop: true });
      this.time.addEvent({ delay: 15000, callback: () => this.spawnWeaponBox(), loop: true });
    }

    window.addEventListener('weapon_swap', ((e: CustomEvent) => this.swapWeapon(e.detail.key)) as any);

    // SIGNAL UI: Dismiss loading overlay (with slight delay to ensure listener is active)
    setTimeout(() => {
        window.dispatchEvent(new CustomEvent('SCENE_READY'));
    }, 500);
  }



  private initMultiplayer() {
    if (this.isHost) {
      // Host creates a GAME peer with a different ID pattern to avoid conflict with Lobby peer
      this.updateConnectionStatus('INITIALIZING HOST...', '#ffff00');
      const gamePeerId = getPeerId('GAME', this.roomId!);
      console.log('[MainScene] Host creating game peer:', gamePeerId);
      this.peer = new Peer(gamePeerId, PEER_CONFIG);

      this.peer.on('open', (id) => {
        console.log('[MainScene] Host game peer ready:', id);
        this.updateConnectionStatus('HOST READY: WAITING FOR PLAYERS', '#00ff00');
      });

      this.peer.on('error', (err) => {
        console.error('[MainScene] Host peer error:', err);
        this.updateConnectionStatus(`HOST ERROR: ${err.type}`, '#ff0000');
      });

      this.peer.on('connection', (conn) => {
        console.log('[MainScene] Host received game connection from:', conn.peer);
        this.handleConnection(conn);
      });
    } else {
      // Client creates a peer and connects to the host's GAME peer
      this.updateConnectionStatus('INITIALIZING CLIENT...', '#ffff00');
      console.log('[MainScene] Client creating peer to connect to game...');
      this.peer = new Peer(PEER_CONFIG);

      this.peer.on('open', (id) => {
        console.log('[MainScene] Client peer ready:', id);
        this.updateConnectionStatus('CLIENT READY: CONNECTING TO HOST...', '#ffff00');
        if (this.roomId) {
          this.connectToHostWithRetry(0);
        }
      });

      this.peer.on('error', (err) => {
        console.error('[MainScene] Client peer error:', err);
        this.updateConnectionStatus(`PEER ERROR: ${err.type}`, '#ff0000');
      });

      this.peer.on('connection', (conn) => this.handleConnection(conn));
    }
  }

  private connectToHostWithRetry(attempt: number) {
    const maxAttempts = 5;
    const baseDelay = 1000; // 1 second

    if (attempt >= maxAttempts) {
      console.error('[MainScene] Failed to connect after', maxAttempts, 'attempts');
      this.updateConnectionStatus('CONNECTION FAILED (TIMEOUT)', '#ff0000');
      return;
    }

    const gamePeerId = getPeerId('GAME', this.roomId!);
    console.log(`[MainScene] Client connecting to host (attempt ${attempt + 1}/${maxAttempts}):`, gamePeerId);
    this.updateConnectionStatus(`CONNECTING TO HOST (ATTEMPT ${attempt + 1})...`, '#ffff00');

    const conn = this.peer!.connect(gamePeerId, { reliable: true });

    // Set a timeout to check if connection opened
    const connectionTimeout = setTimeout(() => {
      if (!this.connections.has(conn.peer)) {
        console.log('[MainScene] Connection timeout, retrying...');
        const delay = baseDelay * Math.pow(2, attempt);
        this.updateConnectionStatus(`TIMEOUT. RETRYING IN ${delay}ms...`, '#ffaa00');
        setTimeout(() => this.connectToHostWithRetry(attempt + 1), delay);
      }
    }, 15000); // Increased timeout for cross-region signaling

    conn.on('open', () => {
      clearTimeout(connectionTimeout);
      console.log('[MainScene] Successfully connected to host on attempt', attempt + 1);
      this.updateConnectionStatus('CONNECTED TO HOST', '#00ff00');
      this.handleConnection(conn);

      // Hide label after successful connection + 3s
      this.time.delayedCall(3000, () => {
        if (this.connectionLabel) this.connectionLabel.setVisible(false);
      });
    });

    // Helper to log low-level ICE state
    if (conn.peerConnection) {
      conn.peerConnection.oniceconnectionstatechange = () => {
        const state = conn.peerConnection.iceConnectionState;
        console.log(`[ICE STATE] ${state}`);
        if (state === 'checking') {
          this.updateConnectionStatus('NAT TRAVERSAL (CHECKING)...', '#00ffff');
        } else if (state === 'connected' || state === 'completed') {
          this.updateConnectionStatus('P2P LINK CONFIRMED', '#00ff00');
        } else if (state === 'failed' || state === 'disconnected') {
          this.updateConnectionStatus('NAT/FIREWALL ERROR', '#ff0000');
          console.error('[MainScene] ICE Connection Failed! Potential NAT/Firewall issue.');
        }
      };
    }

    conn.on('error', (err) => {
      clearTimeout(connectionTimeout);
      console.error('[MainScene] Connection error:', err);
      const delay = baseDelay * Math.pow(2, attempt);
      this.updateConnectionStatus(`CONN ERROR. RETRYING...`, '#ff0000');
      setTimeout(() => this.connectToHostWithRetry(attempt + 1), delay);
    });
  }

  private handleConnection(conn: DataConnection) {
    const setupConn = () => {
      this.connections.set(conn.peer, conn);
      if (this.isHost) {
        const botData = this.aiBots.getChildren().map((bot: any) => ({
          id: bot.getData('id'),
          x: bot.x, y: bot.y, angle: bot.rotation,
          weaponKey: bot.getData('weaponKey'), team: bot.getData('team')
        }));
        const luckData = this.luckBoxes.getChildren().map((b: any) => ({ id: b.getData('id'), x: b.x, y: b.y }));
        const weaponData = this.weaponBoxes.getChildren().map((b: any) => ({ id: b.getData('id'), x: b.x, y: b.y }));
        const itemData = this.weaponItems.getChildren().map((i: any) => ({ id: i.getData('id'), x: i.x, y: i.y, weaponKey: i.getData('weaponKey') }));
        conn.send({ type: 'initial_sync', bots: botData, luckBoxes: luckData, weaponBoxes: weaponData, itemData, scores: this.teamScores });
      }
    };

    if (conn.open) {
      setupConn();
    } else {
      conn.on('open', setupConn);
    }

    conn.on('data', (data: any) => {
      if (data.type === 'sync') this.syncRemotePlayer(conn.peer, data);
      else if (data.type === 'fire') {
        this.spawnBullet(data.x, data.y, data.angle, data.weaponKey, conn.peer, data.team);
        if (this.isHost) this.connections.forEach(c => { if (c.peer !== conn.peer) c.send(data); });
      }
      else if (data.type === 'score_update') this.teamScores = data.scores;
      else if (data.type === 'hp_move') this.moveHardpoint(data.x, data.y);
      else if (data.type === 'spawn_bot') this.createRemoteBot(data);
      else if (data.type === 'spawn_box') this.createRemoteBox(data);
      else if (data.type === 'spawn_item') this.createRemoteItem(data);
      else if (data.type === 'destroy_object') this.destroyRemoteObject(data);
      else if (data.type === 'bot_sync') this.syncBots(data.bots);
      else if (data.type === 'game_over') {
        this.isMissionOver = true;
        this.playSound('sfx_victory', 0.4, false);
        window.dispatchEvent(new CustomEvent('MISSION_COMPLETE', { detail: { winner: data.winner, kills: this.kills, points: this.points } }));
      }
      else if (data.type === 'initial_sync') {
        this.teamScores = data.scores;
        data.bots.forEach((b: any) => this.createRemoteBot(b));
        data.luckBoxes.forEach((b: any) => this.createRemoteBox({ ...b, boxType: 'luck' }));
        data.weaponBoxes.forEach((b: any) => this.createRemoteBox({ ...b, boxType: 'weapon' }));
        if (data.itemData) data.itemData.forEach((i: any) => this.createRemoteItem(i));
      }
    });

    conn.on('close', () => {
      this.otherPlayers.get(conn.peer)?.destroy();
      this.otherLabels.get(conn.peer)?.destroy();
      this.otherPlayers.delete(conn.peer);
      this.otherLabels.delete(conn.peer);
    });
  }

  private syncRemotePlayer(id: string, data: any) {
    if (this.isHost) {
      this.connections.forEach(c => { if (c.peer !== id) c.send({ ...data, id }); });
    }
    const targetId = data.id || id;
    let p = this.otherPlayers.get(targetId);
    let l = this.otherLabels.get(targetId);
    if (!p) {
      p = this.physics.add.sprite(data.x, data.y, `hum_striker_pistol`);
      p.setDepth(9).setData('team', data.team).setCircle(22, 10, 10);

      // Init interpolation targets
      p.setData('targetX', data.x);
      p.setData('targetY', data.y);
      p.setData('targetAngle', data.angle);

      this.otherPlayers.set(targetId, p);
      this.otherPlayersGroup.add(p);
      const teamColor = data.team === 'alpha' ? '#f97316' : '#22d3ee';
      const teamPrefix = data.team === 'alpha' ? '[ALPHA] ' : '[BRAVO] ';
      l = this.add.text(data.x, data.y - 60, teamPrefix + data.name, { fontSize: '12px', color: teamColor, fontStyle: 'bold', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(20);
      this.otherLabels.set(targetId, l);
    }

    // Update targets for interpolation
    p.setData('targetX', data.x);
    p.setData('targetY', data.y);
    p.setData('targetAngle', data.angle);
    p.setData('targetX', data.x);
    p.setData('targetY', data.y);
    p.setData('targetAngle', data.angle);
    p.setData('name', data.name);
    p.setTint(data.team === 'alpha' ? 0xf97316 : 0x22d3ee);
  }

  private updateRemotePlayers(delta: number) {
    const lerpFactor = 0.2; // Adjust for smoothness (0.1 = slow/smooth, 0.5 = snappy)

    this.otherPlayers.forEach((p, id) => {
      const tx = p.getData('targetX');
      const ty = p.getData('targetY');
      const ta = p.getData('targetAngle');

      if (tx !== undefined && ty !== undefined) {
        // Interpolate position
        p.x = Phaser.Math.Linear(p.x, tx, lerpFactor);
        p.y = Phaser.Math.Linear(p.y, ty, lerpFactor);

        // Intepolate rotation
        if (ta !== undefined) {
          const currentAngle = p.rotation;
          // handle angle wrapping
          let diff = ta - currentAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          p.rotation = Phaser.Math.Linear(currentAngle, currentAngle + diff, lerpFactor);
        }

        // Update label position
        const l = this.otherLabels.get(id);
        if (l) l.setPosition(p.x, p.y - 60);

        // Update shadow (if any) - assuming shadow is attached or managed in update loop?
        // Current code manages playerShadow but not remote shadows explicitly in update AFAIK. 
        // We will stick to label and sprite.
      }
    });
  }

  private connectionLabel!: Phaser.GameObjects.Text;

  private setupUIElements() {
    const teamColor = this.playerTeam === 'alpha' ? '#f97316' : '#22d3ee';
    const teamPrefix = this.playerTeam === 'alpha' ? '[ALPHA] ' : '[BRAVO] ';
    this.playerLabel = this.add.text(0, 0, teamPrefix + this.playerName, { fontSize: '13px', fontStyle: '800', color: teamColor, fontFamily: 'monospace' }).setOrigin(0.5).setDepth(20);
    this.weaponLabel = this.add.text(0, 0, this.currentWeapon.name, { fontSize: '10px', fontStyle: 'bold', color: '#ffffff', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(20);
    this.playerHpBar = this.add.graphics().setDepth(20);
    this.hitMarker = this.add.image(0, 0, 'hit_marker').setAlpha(0).setScrollFactor(0).setDepth(200).setScale(0.8);

    // Connection Status Label (Top Right)
    this.connectionLabel = this.add.text(1980, 20, 'CONNECTING...', {
      fontSize: '14px',
      fontFamily: 'monospace',
      color: '#ffff00',
      backgroundColor: '#00000080'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);

    if (!this.roomId) this.connectionLabel.setVisible(false);
  }

  private updateConnectionStatus(status: string, color: string = '#ffffff') {
    if (!this.connectionLabel) return;
    this.connectionLabel.setText(status);
    this.connectionLabel.setColor(color);
  }

  private initAudio() {
    if (!this.audioEnabled || this.audioInitialized) return;
    this.audioInitialized = true;

    // 1. Initialize Music Playlist
    this.playNextTrack();

    // 2. Setup Ambient Layers (Spatial)
    try {
        const ambientLoop = this.sound.add('sfx_powerup', { volume: 0.05, loop: true }); 
        ambientLoop.play();
        this.ambientLoops.push(ambientLoop);
    } catch (e) {
        console.warn('[Audio] Ambient loop setup failed:', e);
    }
  }

  private playNextTrack() {
    if (!this.audioEnabled) return;

    const trackKey = this.playlist[this.currentTrackIndex];
    if (this.cache.audio.exists(trackKey)) {
        if (this.currentMusic) this.currentMusic.stop();
        
        this.currentMusic = this.sound.add(trackKey, { volume: 0.1, loop: false });
        this.currentMusic.play();
        this.currentMusic.once('complete', () => {
            this.currentTrackIndex = (this.currentTrackIndex + 1) % this.playlist.length;
            this.playNextTrack();
        });
    }
  }

  private playSound(key: string, volume = 0.5, randomizePitch = true) {
    if (!this.audioEnabled || !this.cache.audio.exists(key)) return;
    this.sound.play(key, { volume, detune: randomizePitch ? Phaser.Math.Between(-200, 200) : 0 });
  }

  private playSpatialSound(key: string, sourceX: number, sourceY: number, baseVolume = 0.5, randomizePitch = true) {
    if (!this.audioEnabled || !this.cache.audio.exists(key) || !this.player) return;
    
    // Calculate Distance for Volume Attenuation
    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, sourceX, sourceY);
    const maxDistance = 1400; // Sounds past this are silent
    
    if (distance > maxDistance) return;

    // Linear Attenuation squared for steep drop-off
    const distanceFactor = Math.max(0, 1 - (distance / maxDistance));
    const volume = baseVolume * (distanceFactor * distanceFactor);

    // Calculate Stereo Panning (Left/Right)
    const panRange = 800; // Distance at which sound is fully panned left/right
    const dx = sourceX - this.player.x;
    const pan = Phaser.Math.Clamp(dx / panRange, -1, 1);

    this.sound.play(key, { 
      volume, 
      pan,
      detune: randomizePitch ? Phaser.Math.Between(-200, 200) : 0 
    });
  }

  private setupTextures() {
    const g = this.add.graphics({ x: 0, y: 0 }).setVisible(false);
    g.fillStyle(0x000000, 0.4).fillCircle(32, 32, 28).generateTexture('shadow', 64, 64).clear();
    g.lineStyle(2, 0xffffff).lineBetween(0, 0, 15, 15).lineBetween(15, 0, 0, 15).generateTexture('hit_marker', 15, 15).clear();
    g.fillStyle(0xffffff).fillRect(0, 0, 3, 3).generateTexture('spark', 3, 3).clear();
    g.fillStyle(0xff0000).fillCircle(3, 3, 3).generateTexture('blood_drop', 6, 6).clear();

    const drawHumanoid = (key: string, bodyColor: number, visorColor: number, category: string) => {
      const cx = 32, cy = 32;
      g.clear();
      g.fillStyle(visorColor, 0.3).fillCircle(cx, cy, 28);
      g.lineStyle(2, visorColor).strokeCircle(cx, cy, 24);
      g.fillStyle(bodyColor).fillCircle(cx, cy, 22);
      g.fillStyle(0x2a2a2a).fillRect(cx - 10, cy - 6, 20, 16);
      g.fillStyle(0x3a3a3a).fillCircle(cx, cy - 4, 14);
      g.fillStyle(visorColor).fillRect(cx + 4, cy - 10, 12, 10);
      g.fillStyle(0xc9a06c).fillRect(cx + 2, cy + 6, 12, 6);
      g.fillStyle(0x555555);
      if (category === 'pistol') g.fillRect(cx + 12, cy + 4, 18, 8);
      else if (category === 'rifle') g.fillRect(cx + 4, cy + 4, 34, 8);
      else g.fillRect(cx + 2, cy + 0, 42, 14);
      g.generateTexture(key, 80, 80);
    };

    const classes: CharacterClass[] = ['STRIKER', 'GHOST', 'TITAN'];
    const colors = { STRIKER: 0x5a8a1a, GHOST: 0x4a4a55, TITAN: 0x7a3a10 };
    const visors = { STRIKER: 0xf97316, GHOST: 0x22d3ee, TITAN: 0xef4444 };
    classes.forEach(c => ['pistol', 'rifle', 'heavy'].forEach(cat => drawHumanoid(`hum_${c.toLowerCase()}_${cat}`, colors[c], visors[c], cat)));

    const ts = this.add.graphics({ x: 0, y: 0 }).setVisible(false);
    ts.fillStyle(0x3a3530).fillRect(64, 0, 64, 64);
    ts.lineStyle(2, 0x1a1a1a).strokeRect(66, 2, 60, 60);
    ts.lineStyle(4, 0x4a4540).strokeRect(70, 6, 52, 52);
    ts.fillStyle(0x5a5550).fillRect(128, 0, 64, 64);
    ts.lineStyle(2, 0xf97316, 0.6).strokeCircle(160, 32, 20);
    ts.lineStyle(3, 0xf97316, 0.4).lineBetween(128, 0, 192, 64).lineBetween(192, 0, 128, 64);
    ts.fillStyle(0x111111).fillRect(192, 0, 64, 64);
    ts.lineStyle(1, 0x2a3040, 0.3).strokeRect(192, 0, 64, 64);
    ts.generateTexture('tactical_tiles', 320, 64);

    g.clear().fillStyle(0x1a1a1e).fillRect(0, 0, 256, 256).lineStyle(2, 0x333338, 0.5).strokeRect(0, 0, 256, 256).generateTexture('floor_tile', 256, 256);
    g.clear().fillStyle(0xffff88).fillCircle(3, 3, 3).generateTexture('bullet', 8, 8);
    g.clear().fillStyle(0x0a0a0a).fillRoundedRect(0, 0, 48, 48, 6).generateTexture('luck_box', 48, 48);
    g.clear().fillStyle(0x00ffff, 0.8).fillRoundedRect(0, 0, 48, 48, 6).lineStyle(4, 0xffffff).strokeRoundedRect(4, 4, 40, 40, 4).generateTexture('weapon_box', 48, 48);
    g.clear().fillStyle(0x8b5cf6).fillRoundedRect(0, 0, 32, 48, 4).lineStyle(2, 0xffffff).strokeRoundedRect(4, 4, 24, 16, 2).generateTexture('data_drive', 32, 48);
    
    g.destroy();
    ts.destroy();
  }

  private setupEmitters() {
    this.muzzleEmitter = this.add.particles(0, 0, 'spark', { speed: 400, scale: { start: 1.5, end: 0 }, lifespan: 200, emitting: false, blendMode: 'ADD' });
    this.explosionEmitter = this.add.particles(0, 0, 'spark', { speed: { min: 200, max: 600 }, scale: { start: 2, end: 0 }, lifespan: 300, emitting: false, blendMode: 'ADD' });
    this.abilityEmitter = this.add.particles(0, 0, 'bullet', { scale: { start: 0.1, end: 5 }, alpha: { start: 0.6, end: 0 }, lifespan: 600, emitting: false, blendMode: 'ADD' });
    this.bloodEmitter = this.add.particles(0, 0, 'blood_drop', { speed: { min: 50, max: 300 }, scale: { start: 1, end: 0 }, alpha: { start: 1, end: 0 }, lifespan: 800, emitting: false });
  }

  private setupPhysics() {
    this.physics.add.collider(this.player, this.wallLayer);
    this.physics.add.collider(this.aiBots, this.wallLayer);
    this.physics.add.collider(this.player, this.aiBots);
    this.physics.add.collider(this.player, this.otherPlayersGroup);
    this.physics.add.collider(this.aiBots, this.aiBots);

    this.physics.add.collider(this.bullets, this.wallLayer, (bullet: any, tile: any) => {
      if (tile.index === 2) { // Destructible
        this.handleTileDamage(tile);
      }
      this.createExplosion(bullet.x, bullet.y, 4, 0xffaa00);
      bullet.setActive(false).setVisible(false).body.stop();
    });

    this.physics.add.overlap(this.bullets, this.weaponBoxes, (bullet: any, box: any) => {
      this.activateWeaponBox(box);
      bullet.setActive(false).setVisible(false).body.stop();
    });

    this.physics.add.overlap(this.bullets, this.luckBoxes, (bullet: any, box: any) => {
      this.collectLuckBox(box);
      bullet.setActive(false).setVisible(false).body.stop();
    });

    this.physics.add.overlap(this.aiBots, this.bullets, (bot: any, b: any) => {
      if (b.getData('team') !== bot.getData('team')) {
        this.applyDamage(bot, b.getData('damage'), b.getData('ownerTeam'));
        this.createExplosion(b.x, b.y, 4, 0xff0000);
        this.playSpatialSound('sfx_hit_flesh', bot.x, bot.y, 0.4);
        b.setActive(false).setVisible(false).body.stop();
      }
    });

    this.physics.add.overlap(this.player, this.bullets, (p: any, b: any) => {
      if (b.getData('team') !== this.playerTeam) {
        this.takeDamage(b.getData('damage'));
        this.createExplosion(b.x, b.y, 4, 0xff0000);
        b.setActive(false).setVisible(false).body.stop();
      }
    });

    this.physics.add.overlap(this.player, this.luckBoxes, (p, box: any) => this.collectLuckBox(box));
    this.physics.add.overlap(this.player, this.weaponBoxes, (p, box: any) => this.activateWeaponBox(box));
    this.physics.add.overlap(this.player, this.weaponItems, (p, item: any) => this.collectWeaponItem(item));
    this.physics.add.overlap(this.player, this.dataDrives, (p, item: any) => this.collectDataDrive(item));
  }

  update(time: number, delta: number) {
    if (this.isMissionOver) return;

    if (!this.isRespawning) {
      this.handleInput();
      this.handleCombat(time);
      this.resolveUnitOverlaps();

      if (this.abilityCooldown > 0) this.abilityCooldown -= delta;

      // Update Survival Timer
      if (this.mission && this.mission.type === 'SURVIVAL') {
        this.survivalTimer -= delta / 1000;
        if (this.survivalTimer < 0) this.survivalTimer = 0;
      }

      if (this.safeZoneTimer > 0) this.safeZoneTimer -= delta;
      if (this.invulnerabilityTimer > 0) {
        this.invulnerabilityTimer -= delta;
        this.player.setAlpha(Math.sin(time * 0.05) > 0 ? 0.3 : 1.0);
      } else {
        this.player.setAlpha(1.0);
      }

      // Sync HUD Data
      const hudStats = {
        ...this.getGameStats(), // existing stats
        survivalTimer: Math.ceil(this.survivalTimer),
        collectedItems: this.collectedItems,
        mode: this.mission ? this.mission.type : 'MULTIPLAYER'
      };
      // We'll update the global object later or via a specific method, 
      // primarily we rely on the object reference or interval in GameContainer.
      // For now, let's just make sure we update the specific logic.

      // playerLight disabled
      // if (this.playerLight && this.player) {
      //    this.playerLight.x = this.player.x;
      //    this.playerLight.y = this.player.y;
      // }

      if (this.roomId && time % 50 < 10) {
        this.connections.forEach(c => c.send({ type: 'sync', x: this.player.x, y: this.player.y, angle: this.player.rotation, name: this.playerName, team: this.playerTeam }));
      }


      if (this.isHost && this.roomId && time % 100 < 10) {
        const botData = this.aiBots.getChildren().map((bot: any) => ({
          id: bot.getData('id'),
          x: bot.x, y: bot.y, angle: bot.rotation,
          weaponKey: bot.getData('weaponKey'), team: bot.getData('team')
        }));
        this.connections.forEach(c => c.send({ type: 'bot_sync', bots: botData }));
      }
    }

    if (this.isHost && this.mpConfig?.mode === 'HARDPOINT') this.updateHardpoint(time);

    this.playerShadow.setPosition(this.player.x + 6, this.player.y + 6);
    if (this.isHost || !this.roomId) this.updateAIBots(time);

    // Interpolate remote players
    if (this.roomId) this.updateRemotePlayers(delta);

    this.updateAuras();
    this.updateHUD();
    this.checkWinCondition();

    this.playerLabel.setPosition(this.player.x, this.player.y - 60);
    this.weaponLabel.setPosition(this.player.x, this.player.y - 75);
    this.drawHealthBar();

    if (this.shield < this.maxShield) this.shield += 0.08 * (delta / 16.6);
  }

  private checkWinCondition() {
    if (this.mission && !this.isMissionOver) {
      let victory = false;

      if (this.mission.type === 'ELIMINATION') {
        if (this.kills >= this.mission.targetValue) victory = true;
      } else if (this.mission.type === 'SURVIVAL') {
        if (this.survivalTimer <= 0) victory = true;
      } else if (this.mission.type === 'EXTRACTION') {
        if (this.collectedItems >= this.mission.targetValue) victory = true;
      }

      if (victory) {
        this.isMissionOver = true;
        this.player.body.stop();
        this.player.body.enable = false;
        this.playSound('sfx_victory', 0.4, false);
        window.dispatchEvent(new CustomEvent('MISSION_COMPLETE', { detail: { kills: this.kills, points: this.points } }));
      }
    }

    if (this.mpConfig && this.isHost && !this.isMissionOver) {
      if (this.teamScores.alpha >= this.mpConfig.scoreLimit || this.teamScores.bravo >= this.mpConfig.scoreLimit) {
        this.isMissionOver = true;
        const winner = this.teamScores.alpha >= this.mpConfig.scoreLimit ? 'ALPHA' : 'BRAVO';
        this.playSound('sfx_victory', 0.4, false);
        if (this.roomId) this.connections.forEach(c => c.send({ type: 'game_over', winner }));
        window.dispatchEvent(new CustomEvent('MISSION_COMPLETE', { detail: { winner, alpha: this.teamScores.alpha, bravo: this.teamScores.bravo, kills: this.kills, points: this.points } }));
      }
    }
  }

  private resolveUnitOverlaps() {
    const units = [this.player, ...this.aiBots.getChildren(), ...this.otherPlayers.values()];
    const minDist = 44;
    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const u1 = units[i] as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
        const u2 = units[j] as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
        if (!u1.active || !u2.active || !u1.body || !u2.body) continue;
        const dx = u2.x - u1.x;
        const dy = u2.y - u1.y;
        const distanceSq = dx * dx + dy * dy;
        if (distanceSq < minDist * minDist) {
          const distance = Math.sqrt(distanceSq);
          const overlap = minDist - distance;
          const pushX = (dx / (distance || 1)) * (overlap * 0.5);
          const pushY = (dy / (distance || 1)) * (overlap * 0.5);
          u1.x -= pushX; u1.y -= pushY; u2.x += pushX; u2.y += pushY;
        }
      }
    }
  }

  private getGameStats() {
    // Helper to return current state for HUD
    return {
      hp: this.health,
      maxHp: this.maxHealth,
      shield: this.shield,
      ammo: this.ammo,
      maxAmmo: this.currentWeapon.maxAmmo,
      weaponKey: this.currentWeapon.key,
      weaponName: this.currentWeapon.name,
      isInfinite: this.currentWeapon.isInfinite,
      abilityCooldown: this.abilityCooldown,
      kills: this.kills,
      targetValue: this.mission ? this.mission.targetValue : 0,
      points: this.points,
      teamScores: this.teamScores,
      mode: this.mission ? this.mission.type : 'MULTIPLAYER',
      isOver: this.isMissionOver,
      playerPos: { x: this.player.x, y: this.player.y, rotation: this.player.rotation },
      entities: this.getMinimapEntities(),
      lives: this.lives,
      maxLives: this.maxLives,
      survivalTimer: Math.ceil(this.survivalTimer),
      collectedItems: this.collectedItems
    };
  }

  public updateGameStatsObj() {
    (window as any).gameStats = this.getGameStats();
  }

  private getMinimapEntities() {
    const drives = this.dataDrives ? this.dataDrives.getChildren().filter((d: any) => d.active).map((d: any) => ({ x: d.x, y: d.y, team: 'neutral', type: 'objective' })) : [];
    return [
      ...this.aiBots.getChildren().map((b: any) => ({ x: b.x, y: b.y, team: b.getData('team') })),
      ...this.otherPlayersGroup.getChildren().map((p: any) => ({ x: p.x, y: p.y, team: p.getData('team') })),
      ...drives
    ];
  }


  private handleInput() {
    const { moveX, moveY, aimAngle, isAbility } = this.virtualInput;
    const speed = this.characterClass === 'GHOST' ? 450 : this.characterClass === 'TITAN' ? 300 : 380;
    if (moveX !== 0 || moveY !== 0) {
      this.player.setVelocity(moveX * speed, moveY * speed);
      if (aimAngle === null) this.player.rotation = Math.atan2(moveY, moveX);
    } else {
      this.player.setVelocity(0, 0);
    }
    if (aimAngle !== null) this.player.rotation = aimAngle;
    if (isAbility && this.abilityCooldown <= 0) this.triggerAbility();
  }

  private triggerAbility() {
    this.abilityCooldown = 6000;
    this.abilityEmitter.emitParticleAt(this.player.x, this.player.y, 1);
    this.cameras.main.shake(200, 0.015);
    this.playSpatialSound('sfx_boost', this.player.x, this.player.y, 0.5);
    const angle = this.player.rotation;
    this.physics.velocityFromRotation(angle, 1500, this.player.body.velocity);
  }

  private handleCombat(time: number) {
    if (this.virtualInput.isFiring && time > this.lastFired) {
      if (this.ammo <= 0 && !this.currentWeapon.isInfinite) {
        this.swapWeapon('pistol');
        this.showFloatingText(this.player.x, this.player.y - 100, "AMMO_DEPLETED: CYCLING_FALLBACK", "#ff0000");
        return;
      }
      const angle = this.virtualInput.aimAngle !== null ? this.virtualInput.aimAngle : this.player.rotation;
      this.muzzleEmitter.emitParticleAt(this.player.x + Math.cos(angle) * 45, this.player.y + Math.sin(angle) * 45, 8);
      for (let i = 0; i < this.currentWeapon.bullets; i++) {
        const spread = (Math.random() - 0.5) * this.currentWeapon.spread;
        this.spawnBullet(this.player.x, this.player.y, angle + spread, this.currentWeapon.key, 'player', this.playerTeam);
      }
      const recoilForce = this.currentWeapon.recoil;
      if (recoilForce > 0) {
        const recoilAngle = angle + Math.PI;
        this.physics.velocityFromRotation(recoilAngle, recoilForce * 0.45, this.player.body.velocity);
      }
      if (this.roomId) this.connections.forEach(c => c.send({ type: 'fire', x: this.player.x, y: this.player.y, angle, weaponKey: this.currentWeapon.key, team: this.playerTeam }));
      this.playSpatialSound(this.currentWeapon.category === 'pistol' ? 'sfx_pistol' : 'sfx_shotgun', this.player.x, this.player.y, 0.4);
      this.lastFired = time + this.currentWeapon.fireRate;
      if (!this.currentWeapon.isInfinite) {
        this.ammo--;
        if (this.ammo <= 0 && this.currentWeapon.key !== 'pistol') this.time.delayedCall(100, () => this.swapWeapon('pistol'));
      }
      this.cameras.main.shake(100, 0.004 * (recoilForce / 1000));
    }
  }

  private spawnBullet(x: number, y: number, angle: number, weaponKey: string, owner: string, team: 'alpha' | 'bravo') {
    const config = WEAPONS_CONFIG[weaponKey] || WEAPONS_CONFIG.pistol;
    const b = this.bullets.get(x, y);
    if (b) {
      b.setActive(true).setVisible(true).enableBody(true, x, y, true, true);
      b.setTint(team === 'alpha' ? 0xf97316 : 0x22d3ee).setScale(config.projectileScale * 1.5);
      b.setData('owner', owner).setData('team', team).setData('damage', config.damage).setData('ownerTeam', team);
      this.physics.velocityFromRotation(angle, config.speed || 1500, b.body.velocity);
      b.rotation = angle;
    }
  }

  private spawnAIBot(team: 'alpha' | 'bravo', id?: string) {
    if (this.isMissionOver) return;
    const botId = id || `bot_${team}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const x = this.isHost ? Phaser.Math.Between(100, 1900) : 0;
    const y = this.isHost ? Phaser.Math.Between(100, 1900) : 0;
    const bot = this.aiBots.create(x, y, 'hum_striker_pistol');
    const baseHp = 100 * this.difficultyModifier;
    const botName = `UNIT_${botId.split('_').pop()}`;

    bot.setTint(team === 'alpha' ? 0xf97316 : 0x22d3ee).setDepth(10)
      .setData('id', botId)
      .setData('name', botName)
      .setData('maxHp', baseHp)
      .setData('hp', baseHp)
      .setData('team', team)
      .setData('lastShot', 0)
      .setData('weaponKey', 'pistol')
      .setData('currentTarget', null)
      .setData('targetAcquiredTime', 0)
      .setData('reactionDelay', Phaser.Math.Between(300, 800) / this.difficultyModifier);
    bot.body.setCircle(22, 10, 10);

    const teamColor = team === 'alpha' ? 0xf97316 : 0x22d3ee;
    const teamPrefix = team === 'alpha' ? '[ALPHA] ' : '[BRAVO] ';
    const label = this.add.text(x, y - 50, teamPrefix + botName, { fontSize: '10px', color: '#' + teamColor.toString(16), fontStyle: 'bold', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(20);
    this.botLabels.set(botId, label);

    if (this.isHost && this.roomId) this.connections.forEach(c => c.send({ type: 'spawn_bot', id: botId, team, x, y, name: botName }));
  }

  private createRemoteBot(data: any) {
    if (this.aiBots.getChildren().find((b: any) => b.getData('id') === data.id)) return;
    const bot = this.aiBots.create(data.x, data.y, 'hum_striker_pistol');
    const botName = data.name || `UNIT_${data.id.split('_').pop()}`;
    const baseHp = 100 * this.difficultyModifier;

    bot.setTint(data.team === 'alpha' ? 0xf97316 : 0x22d3ee).setDepth(10)
      .setData('id', data.id)
      .setData('team', data.team)
      .setData('name', botName)
      .setData('maxHp', baseHp)
      .setData('hp', baseHp)
      .setData('lastShot', 0)
      .setData('weaponKey', 'pistol')
      .setData('currentTarget', null)
      .setData('targetAcquiredTime', 0)
      .setData('reactionDelay', Phaser.Math.Between(300, 800) / this.difficultyModifier);
    bot.body.setCircle(22, 10, 10);

    const teamColor = data.team === 'alpha' ? 0xf97316 : 0x22d3ee;
    const teamPrefix = data.team === 'alpha' ? '[ALPHA] ' : '[BRAVO] ';
    const label = this.add.text(data.x, data.y - 50, teamPrefix + botName, { fontSize: '10px', color: '#' + teamColor.toString(16), fontStyle: 'bold', fontFamily: 'monospace' }).setOrigin(0.5).setDepth(20);
    this.botLabels.set(data.id, label);
  }

  private syncBots(botData: any[]) {
    botData.forEach(data => {
      const bot = this.aiBots.getChildren().find((b: any) => b.getData('id') === data.id) as any;
      if (bot) {
        bot.setPosition(data.x, data.y);
        bot.rotation = data.angle;
        if (bot.getData('weaponKey') !== data.weaponKey) {
          bot.setData('weaponKey', data.weaponKey);
          bot.setTexture(`hum_striker_${WEAPONS_CONFIG[data.weaponKey].category}`);
        }
      } else {
        this.createRemoteBot(data);
      }
    });
  }

  private hasLineOfSight(fromX: number, fromY: number, toX: number, toY: number): boolean {
    // Create a line from bot to target
    const ray = new Phaser.Geom.Line(fromX, fromY, toX, toY);
    // Check if ray intersects any wall tile
    const wallTiles = this.wallLayer.getTilesWithinShape(ray);
    for (const tile of wallTiles) {
      if (tile.index !== -1 && tile.index !== 3) { // 3 is floor, others are walls
        return false;
      }
    }
    return true; // Clear line of sight
  }


  private updateAIBots(time: number) {
    if (!this.isHost) return;
    if (this.isMissionOver) { this.aiBots.getChildren().forEach((bot: any) => bot.body.stop()); return; }

    this.aiBots.getChildren().forEach((bot: any) => {
      const team = bot.getData('team');
      const botHp = bot.getData('hp');
      const maxHp = bot.getData('maxHp');
      const healthPercent = botHp / maxHp;

      // 1. FIND TARGETS
      let nearestTarget: any = null;
      let minDist = 800;

      // Collect all potential targets
      if (this.playerTeam !== team) {
        const d = Phaser.Math.Distance.Between(bot.x, bot.y, this.player.x, this.player.y);
        if (d < minDist) { nearestTarget = this.player; minDist = d; }
      }

      this.otherPlayers.forEach(p => {
        if (p.getData('team') !== team) {
          const d = Phaser.Math.Distance.Between(bot.x, bot.y, p.x, p.y);
          if (d < minDist) { nearestTarget = p; minDist = d; }
        }
      });

      this.aiBots.getChildren().forEach((otherBot: any) => {
        if (otherBot !== bot && otherBot.getData('team') !== team) {
          const d = Phaser.Math.Distance.Between(bot.x, bot.y, otherBot.x, otherBot.y);
          if (d < minDist) { nearestTarget = otherBot; minDist = d; }
        }
      });

      // 2. TACTICAL FORCES
      let finalForceX = 0;
      let finalForceY = 0;
      let moveSpeed = 160 * (0.8 + this.difficultyModifier * 0.2);

      // A. Bullet Avoidance Force
      const avoidance = this.getBulletAvoidanceForce(bot);
      finalForceX += avoidance.x * 2.5;
      finalForceY += avoidance.y * 2.5;

      // B. Obstacle Avoidance Force (Tilemap Whiskers)
      const obstacleAvoidance = this.getObstacleAvoidanceForce(bot);
      finalForceX += obstacleAvoidance.x * 3.0;
      finalForceY += obstacleAvoidance.y * 3.0;

      // C. Teammate Separation (Tactical Distancing)
      this.aiBots.getChildren().forEach((teammate: any) => {
        if (teammate !== bot && teammate.getData('team') === team) {
          const dist = Phaser.Math.Distance.Between(bot.x, bot.y, teammate.x, teammate.y);
          if (dist < 120) { // Increased distance for tactical pacing
            const angle = Phaser.Math.Angle.Between(teammate.x, teammate.y, bot.x, bot.y);
            const weight = (120 - dist) / 120;
            finalForceX += Math.cos(angle) * weight * 1.5;
            finalForceY += Math.sin(angle) * weight * 1.5;
          }
        }
      });

      if (nearestTarget) {
        // C. Target Force (Movement relative to enemy)
        const targetAngle = Phaser.Math.Angle.Between(bot.x, bot.y, nearestTarget.x, nearestTarget.y);

        if (healthPercent < 0.35) {
          // RETREAT/SEEK COVER
          const coverPos = this.findCoverPosition(bot, nearestTarget);
          if (coverPos) {
            const coverAngle = Phaser.Math.Angle.Between(bot.x, bot.y, coverPos.x, coverPos.y);
            finalForceX += Math.cos(coverAngle) * 1.5;
            finalForceY += Math.sin(coverAngle) * 1.5;
            moveSpeed *= 1.2;
          } else {
            // Backup if no cover: move away
            finalForceX -= Math.cos(targetAngle) * 1.2;
            finalForceY -= Math.sin(targetAngle) * 1.2;
          }
        } else {
          // OFFENSIVE ENGAGEMENT
          const wKey = bot.getData('weaponKey');
          const optimalRange = wKey === 'shotgun' ? 150 : wKey === 'smg' ? 350 : 450;

          if (minDist > optimalRange + 50) {
            // Close in
            finalForceX += Math.cos(targetAngle);
            finalForceY += Math.sin(targetAngle);
          } else if (minDist < optimalRange - 50) {
            // Back up
            finalForceX -= Math.cos(targetAngle);
            finalForceY -= Math.sin(targetAngle);
          }

          // D. Strafing (Jittery movement)
          const strafeDirection = (bot.getData('id').charCodeAt(0) % 2 === 0 ? 1 : -1);
          const strafeAngle = targetAngle + (Math.PI / 2) * strafeDirection;
          const jitter = Math.sin(time * 0.005 + bot.getData('id').length) * 0.5;
          finalForceX += Math.cos(strafeAngle + jitter) * 0.8;
          finalForceY += Math.sin(strafeAngle + jitter) * 0.8;
        }

        // 3. OBJECTIVE FORCE (Hardpoint)
        if (this.mpConfig?.mode === 'HARDPOINT') {
          const objDist = Phaser.Math.Distance.Between(bot.x, bot.y, this.hardpointCenter.x, this.hardpointCenter.y);
          const objAngle = Phaser.Math.Angle.Between(bot.x, bot.y, this.hardpointCenter.x, this.hardpointCenter.y);
          // Only pull to objective if not in immediate danger or already close to target
          const objPriority = (healthPercent > 0.5 && minDist > 300) ? 1.2 : 0.4;
          finalForceX += Math.cos(objAngle) * objPriority;
          finalForceY += Math.sin(objAngle) * objPriority;
        }

        // Apply movement
        if ((finalForceX !== 0 || finalForceY !== 0) && !isNaN(finalForceX) && !isNaN(finalForceY)) {
          const finalAngle = Math.atan2(finalForceY, finalForceX);
          
          // Stuck Detection logic
          const botId = bot.getData('id');
          const lastPos = this.botLastPositions.get(botId);
          if (lastPos && time > lastPos.time + 1000) {
              const distTraveled = Phaser.Math.Distance.Between(lastPos.x, lastPos.y, bot.x, bot.y);
              if (distTraveled < 10 && (finalForceX !== 0 || finalForceY !== 0)) {
                  // Bot is stuck! Apply recovery impulse
                  const recoveryAngle = finalAngle + (Math.random() > 0.5 ? Math.PI : -Math.PI) * 0.5;
                  bot.body.velocity.x = Math.cos(recoveryAngle) * moveSpeed * 1.5;
                  bot.body.velocity.y = Math.sin(recoveryAngle) * moveSpeed * 1.5;
                  this.botLastPositions.set(botId, { x: bot.x, y: bot.y, time: time + 500 });
                  return; // Skip standard force for this frame
              }
              this.botLastPositions.set(botId, { x: bot.x, y: bot.y, time: time });
          } else if (!lastPos) {
              this.botLastPositions.set(botId, { x: bot.x, y: bot.y, time: time });
          }

          this.physics.velocityFromRotation(finalAngle, moveSpeed, bot.body.velocity);
        }

        // 4. AIMING & SHOOTING
        const aimAngle = Phaser.Math.Angle.Between(bot.x, bot.y, nearestTarget.x, nearestTarget.y);
        bot.rotation = aimAngle;

        const wConfig = WEAPONS_CONFIG[bot.getData('weaponKey')] || WEAPONS_CONFIG.pistol;
        const delay = Math.max(0.7, 2.2 / this.difficultyModifier);

        if (time > bot.getData('lastShot') + wConfig.fireRate * delay) {
          const hasLOS = this.hasLineOfSight(bot.x, bot.y, nearestTarget.x, nearestTarget.y);
          const targetInSafeZone = this.safeZoneTimer > 0 && (nearestTarget === this.player);

          if (minDist < 800 && hasLOS && !targetInSafeZone && healthPercent > 0.15) {
            const baseAimError = (minDist / 800) * 0.35;
            const difficultyFactor = 1 - (this.difficultyModifier - 1) * 0.25;
            const aimError = baseAimError * difficultyFactor;

            for (let i = 0; i < wConfig.bullets; i++) {
              const finalAngle = aimAngle + (Math.random() - 0.5) * (wConfig.spread + aimError);
              this.spawnBullet(bot.x, bot.y, finalAngle, wConfig.key, 'bot', team);
            }
            bot.setData('lastShot', time);
            this.playSpatialSound(wConfig.category === 'pistol' ? 'sfx_pistol' : 'sfx_shotgun', bot.x, bot.y, 0.4);
          }
        }
      } else {
        // PATROL behavior (when no target)
        if (!bot.getData('patrolTarget') || Math.random() < 0.005) {
          bot.setData('patrolTarget', { x: Phaser.Math.Between(300, 1700), y: Phaser.Math.Between(300, 1700) });
        }
        const patrol = bot.getData('patrolTarget');
        const patrolAngle = Phaser.Math.Angle.Between(bot.x, bot.y, patrol.x, patrol.y);
        this.physics.velocityFromRotation(patrolAngle, 80, bot.body.velocity);
        bot.rotation = patrolAngle;
      }

      // Update label
      const label = this.botLabels.get(bot.getData('id'));
      if (label) label.setPosition(bot.x, bot.y - 50);
    });
  }

  private getObstacleAvoidanceForce(bot: any): Phaser.Math.Vector2 {
    const force = new Phaser.Math.Vector2(0, 0);
    const lookAhead = 80;
    const velocity = bot.body.velocity;
    const speed = velocity.length();
    
    if (speed < 1) return force;

    // Whiskers: Forward, Left, Right
    const angle = Math.atan2(velocity.y, velocity.x);
    const checkAngles = [0, -Math.PI / 4, Math.PI / 4];
    
    checkAngles.forEach(offset => {
        const checkX = bot.x + Math.cos(angle + offset) * lookAhead;
        const checkY = bot.y + Math.sin(angle + offset) * lookAhead;
        
        if (this.wallLayer) {
            const tile = this.wallLayer.getTileAtWorldXY(checkX, checkY);
            if (tile && (tile.index === 1 || tile.index === 2)) {
                // Found wall! Push away from it
                const awayAngle = angle + offset + Math.PI;
                force.x += Math.cos(awayAngle) * 2.0;
                force.y += Math.sin(awayAngle) * 2.0;
            }
        }
    });

    return force;
  }

  private getBulletAvoidanceForce(bot: any): Phaser.Math.Vector2 {
    const force = new Phaser.Math.Vector2(0, 0);
    const detectionRadius = 150;
    const botTeam = bot.getData('team');

    this.bullets.getChildren().forEach((b: any) => {
      if (b.active && b.getData('team') !== botTeam) {
        const dist = Phaser.Math.Distance.Between(bot.x, bot.y, b.x, b.y);
        if (dist < detectionRadius) {
          // Calculate perpendicular vector to bullet velocity
          const bulletVel = b.body.velocity;
          const toBullet = new Phaser.Math.Vector2(b.x - bot.x, b.y - bot.y);

          // Dot product to see if bullet is moving towards bot
          const dot = bulletVel.x * (-toBullet.x) + bulletVel.y * (-toBullet.y);
          if (dot > 0) {
            // Perpendicular avoidance
            const perpX = -bulletVel.y;
            const perpY = bulletVel.x;
            const side = (toBullet.x * perpX + toBullet.y * perpY) > 0 ? 1 : -1;

            force.x += (perpX * side) / dist;
            force.y += (perpY * side) / dist;
          }
        }
      }
    });

    return force.normalize();
  }

  private findCoverPosition(bot: any, target: any): { x: number, y: number } | null {
    const nearbyTiles = this.wallLayer.getTilesWithinWorldXY(bot.x - 400, bot.y - 400, 800, 800);
    const wallTiles = nearbyTiles.filter(t => t.index !== -1 && t.index !== 3);
    
    let bestCoverPos = null;
    let maxSafety = 0;

    wallTiles.forEach((tile: any) => {
      // Logic: Position yourself so the tile is between you and the target
      const wallCenterX = tile.pixelX + 32;
      const wallCenterY = tile.pixelY + 32;
      const angleToTarget = Phaser.Math.Angle.Between(wallCenterX, wallCenterY, target.x, target.y);
      const coverX = wallCenterX + Math.cos(angleToTarget + Math.PI) * 45;
      const coverY = wallCenterY + Math.sin(angleToTarget + Math.PI) * 45;

      // Check if this position is actually safe (blocks LOS)
      if (!this.hasLineOfSight(coverX, coverY, target.x, target.y)) {
        const dist = Phaser.Math.Distance.Between(bot.x, bot.y, coverX, coverY);
        const safety = 1000 / (dist + 1); // Prefer closer cover
        if (safety > maxSafety) {
          maxSafety = safety;
          bestCoverPos = { x: coverX, y: coverY };
        }
      }
    });

    return bestCoverPos;
  }

  private updateHardpoint(time: number) {
    if (this.isMissionOver) return;
    if (time % 1000 < 20) {
      let alphaIn = this.physics.overlap(this.hardpointZone, this.player) && this.playerTeam === 'alpha' ? 1 : 0;
      let bravoIn = this.physics.overlap(this.hardpointZone, this.player) && this.playerTeam === 'bravo' ? 1 : 0;
      this.otherPlayers.forEach(p => { if (this.physics.overlap(this.hardpointZone, p)) { if (p.getData('team') === 'alpha') alphaIn++; else bravoIn++; } });
      if (alphaIn > bravoIn) this.teamScores.alpha++; else if (bravoIn > alphaIn) this.teamScores.bravo++;
      this.connections.forEach(c => c.send({ type: 'score_update', scores: this.teamScores }));
    }
    if (time % 30000 < 20) {
      this.hardpointCenter = { x: Phaser.Math.Between(400, 1600), y: Phaser.Math.Between(400, 1600) };
      this.moveHardpoint(this.hardpointCenter.x, this.hardpointCenter.y);
      this.connections.forEach(c => c.send({ type: 'hp_move', x: this.hardpointCenter.x, y: this.hardpointCenter.y }));
    }
  }

  private moveHardpoint(x: number, y: number) {
    if (this.hardpointZone) { this.hardpointZone.setPosition(x, y); this.showFloatingText(x, y, "HARDPOINT_RELOCATED", "#ffffff"); }
  }

  private takeDamage(dmg: number) {
    if (this.invulnerabilityTimer > 0 || this.safeZoneTimer > 0 || this.isRespawning || this.isMissionOver) return;
    const scaledDmg = dmg * (0.7 + this.difficultyModifier * 0.3);
    if (this.shield > 0) {
      const remaining = Math.max(0, scaledDmg - this.shield);
      this.shield = Math.max(0, this.shield - scaledDmg);
      this.health -= remaining;
    } else this.health -= scaledDmg;
    this.invulnerabilityTimer = 400;
    this.playSound('sfx_hit_flesh', 0.8);
    if (this.health <= 0) {
      this.deaths++; if (this.mission) this.lives--;
      this.isRespawning = true;
      this.playSound('sfx_death_human', 0.9);
      this.player.body.stop();
      this.bloodEmitter.emitParticleAt(this.player.x, this.player.y, 25);
      this.explosionEmitter.emitParticleAt(this.player.x, this.player.y, 15);
      this.player.setVisible(false);
      this.time.delayedCall(1500, () => {
        if (this.isMissionOver) return;
        if (this.mission && this.lives <= 0) {
          this.isMissionOver = true;
          window.dispatchEvent(new CustomEvent('MISSION_COMPLETE', { detail: { failed: true, reason: 'OUT_OF_LIVES' } }));
          return;
        }
        this.health = this.maxHealth; this.shield = this.maxShield;
        this.player.setPosition(1000, 1000).setVisible(true).setAlpha(1);
        this.isRespawning = false; this.safeZoneTimer = 2000;
      });
    }
  }

  private handleTileDamage(tile: Phaser.Tilemaps.Tile) {
    const key = `${tile.x},${tile.y}`;
    const currentHP = this.tileHP.get(key) || 100;
    const newHP = currentHP - 25; 

    if (newHP <= 0) {
      this.tileHP.delete(key);
      this.wallLayer.removeTileAt(tile.x, tile.y);
      this.createExplosion(tile.pixelX + 32, tile.pixelY + 32, 20, 0x44403c);
      this.showFloatingText(tile.pixelX + 32, tile.pixelY + 32, "COVER_BREACHED", "#f97316");
      this.playSound('sfx_impact', 0.5);
    } else {
      this.tileHP.set(key, newHP);
      // Visual feedback for hit (light flash) - DISABLED for compatibility
      // const flash = this.lights.addLight(tile.pixelX + 32, tile.pixelY + 32, 100).setIntensity(2).setColor(0xf97316);
      // this.tweens.add({ targets: flash, intensity: 0, duration: 100, onComplete: () => this.lights.removeLight(flash) });
    }
  }

  private applyDamage(target: any, dmg: number, sourceTeam: 'alpha' | 'beta') {
    const hp = target.getData('hp') - dmg;
    target.setData('hp', hp);
    if (hp <= 0) {
      this.bloodEmitter.emitParticleAt(target.x, target.y, 20);
      this.explosionEmitter.emitParticleAt(target.x, target.y, 10);
      const id = target.getData('id');
      const label = this.botLabels.get(id);
      if (label) { label.destroy(); this.botLabels.delete(id); }
      if (this.isHost && this.roomId) this.connections.forEach(c => c.send({ type: 'destroy_object', id }));
      target.destroy();
      if (sourceTeam === this.playerTeam) { this.kills++; this.points += 100; }
      if (this.isHost && !this.isMissionOver) {
        if (this.mpConfig?.mode === 'TDM' || this.mpConfig?.mode === 'FFA') {
          this.teamScores[sourceTeam]++;
          this.connections.forEach(c => c.send({ type: 'score_update', scores: this.teamScores }));
        }
        this.time.delayedCall(3000, () => this.spawnAIBot(target.getData('team')));
      }
    }
  }

  private createArena() {
    this.map = this.make.tilemap({ tileWidth: 64, tileHeight: 64, width: 32, height: 32 });
    const tileset = this.map.addTilesetImage('tactical_tiles', 'tactical_tiles', 64, 64, 0, 0);
    
    if (!tileset) return;

    this.floorLayer = this.map.createBlankLayer('floor', tileset);
    this.wallLayer = this.map.createBlankLayer('walls', tileset);

    // 1. Fill Floor
    this.floorLayer?.fill(3); // Index 3 is floor

    // 2. Build Bounds
    for (let i = 0; i < 32; i++) {
      this.wallLayer?.putTileAt(1, i, 0);
      this.wallLayer?.putTileAt(1, i, 31);
      this.wallLayer?.putTileAt(1, 0, i);
      this.wallLayer?.putTileAt(1, 31, i);
    }

    // 3. Generate Map Content based on seed or mode
    const mapMode = this.mpConfig?.map || 'URBAN_RUINS';
    const seed = this.mpConfig?.mapSeed || 'DEFAULT';
    // Simple determinism using seed
    const pseudoRandom = (s: string) => {
        let hash = 0;
        for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash) + s.charCodeAt(i);
        return Math.abs(hash % 100) / 100;
    };

    if (mapMode === 'URBAN_RUINS') {
      for (let i = 0; i < 40; i++) {
        const x = Math.floor(pseudoRandom(seed + i + 'x') * 28) + 2;
        const y = Math.floor(pseudoRandom(seed + i + 'y') * 28) + 2;
        // Don't spawn wall right on player spawn
        if (Math.abs(x - 15) > 3 || Math.abs(y - 15) > 3) {
            this.wallLayer?.putTileAt(pseudoRandom(seed + i + 't') > 0.3 ? 1 : 2, x, y);
        }
      }
    } else if (mapMode === 'THE_PIT') {
        for (let i = 0; i < 16; i++) {
            const a = (i / 16) * Math.PI * 2;
            const tx = Math.floor(16 + Math.cos(a) * 8);
            const ty = Math.floor(16 + Math.sin(a) * 8);
            this.wallLayer?.putTileAt(1, tx, ty);
        }
    } else {
        // OUTPOST_X: Corridor style
        for (let i = 5; i < 27; i++) {
            this.wallLayer?.putTileAt(1, 8, i);
            this.wallLayer?.putTileAt(1, 24, i);
        }
    }

    this.wallLayer?.setCollision([1, 2]);
    // this.wallLayer?.setPipeline('Light2D');
    // this.floorLayer?.setPipeline('Light2D');
  }

  private createExplosion(x: number, y: number, particles: number = 8, color: number = 0xffaa00) {
    this.explosionEmitter.emitParticleAt(x, y, particles);
    // Dynamic light effects disabled for compatibility
  }

  private spawnLuckBox() {
    if (this.isMissionOver) return;
    const x = Phaser.Math.Between(300, 1700), y = Phaser.Math.Between(300, 1700), id = `luck_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.luckBoxes.create(x, y, 'luck_box').setData('id', id).setDepth(5);
    if (this.isHost && this.roomId) this.connections.forEach(c => c.send({ type: 'spawn_box', boxType: 'luck', id, x, y }));
  }

  private spawnWeaponBox() {
    if (this.isMissionOver) return;
    const x = Phaser.Math.Between(300, 1700), y = Phaser.Math.Between(300, 1700), id = `weapon_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const box = this.weaponBoxes.create(x, y, 'weapon_box').setData('id', id).setDepth(5);
    this.tweens.add({ targets: box, scale: 1.1, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (this.isHost && this.roomId) this.connections.forEach(c => c.send({ type: 'spawn_box', boxType: 'weapon', id, x, y }));
  }

  private createRemoteBox(data: any) {
    const group = data.boxType === 'luck' ? this.luckBoxes : this.weaponBoxes;
    if (group.getChildren().find((b: any) => b.getData('id') === data.id)) return;
    group.create(data.x, data.y, data.boxType === 'luck' ? 'luck_box' : 'weapon_box').setData('id', data.id).setDepth(5);
  }

  private createRemoteItem(data: any) {
    if (this.weaponItems.getChildren().find((i: any) => i.getData('id') === data.id)) return;
    const item = this.add.text(data.x, data.y, WEAPONS_CONFIG[data.weaponKey].icon, { fontSize: '32px' }).setOrigin(0.5);
    this.physics.add.existing(item); this.weaponItems.add(item);
    item.setData('weaponKey', data.weaponKey).setData('id', data.id);
  }

  private destroyRemoteObject(data: any) {
    const all = [...this.aiBots.getChildren(), ...this.luckBoxes.getChildren(), ...this.weaponBoxes.getChildren(), ...this.weaponItems.getChildren()];
    all.find((o: any) => o.getData('id') === data.id)?.destroy();
  }

  private collectLuckBox(box: any) {
    const id = box.getData('id'); this.createExplosion(box.x, box.y, 8, 0x00ffff);
    this.ammo = this.currentWeapon.maxAmmo; this.health = Math.min(this.health + 50, this.maxHealth);
    this.points += 25; this.playSpatialSound('sfx_powerup', box.x, box.y, 0.6);
    this.showFloatingText(box.x, box.y, "RESOURCES_RESTORED +25", "#f97316");
    if (this.roomId) this.connections.forEach(c => c.send({ type: 'destroy_object', id }));
    box.destroy();
  }

  private activateWeaponBox(box: any) {
    const id = box.getData('id'); this.createExplosion(box.x, box.y, 10, 0x00ffff);
    const keys = Object.keys(WEAPONS_CONFIG); const key = keys[Phaser.Math.Between(0, keys.length - 1)];
    const config = WEAPONS_CONFIG[key]; const itemId = `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const item = this.add.text(box.x, box.y, config.icon, { fontSize: '32px' }).setOrigin(0.5);
    this.physics.add.existing(item); this.weaponItems.add(item);
    item.setData('weaponKey', key).setData('id', itemId);
    if (this.roomId) {
      if (this.isHost) this.connections.forEach(c => c.send({ type: 'spawn_item', id: itemId, weaponKey: key, x: box.x, y: box.y }));
      this.connections.forEach(c => c.send({ type: 'destroy_object', id }));
    }
    this.tweens.add({ targets: item, y: box.y - 15, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    box.destroy();
  }

  private spawnExtractionItems() {
    if (!this.mission) return;
    const count = this.mission.targetValue;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(100, 1900);
      const y = Phaser.Math.Between(100, 1900);
      const drive = this.dataDrives.create(x, y, 'data_drive');
      drive.setDepth(5).setImmovable(true);
      this.tweens.add({
        targets: drive,
        y: y - 10,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  private collectDataDrive(item: any) {
    item.destroy();
    this.collectedItems++;
    this.points += 500;
    this.playSound('sfx_powerup', 0.6);
    this.showFloatingText(this.player.x, this.player.y - 80, "INTEL SECURED", "#8b5cf6");
  }

  private collectWeaponItem(item: any) {
    this.swapWeapon(item.getData('weaponKey')); this.points += 50; this.playSound('sfx_powerup', 0.8);
    this.showFloatingText(item.x, item.y, "HARDWARE_SYNCHRONIZED +50", "#00ffff");
    if (this.roomId) this.connections.forEach(c => c.send({ type: 'destroy_object', id: item.getData('id') }));
    item.destroy();
  }

  private showFloatingText(x: number, y: number, text: string, color: string) {
    const t = this.add.text(x, y, text, { fontSize: '12px', fontStyle: '900', color, backgroundColor: '#000000', padding: { x: 5, y: 3 }, fontFamily: 'monospace' }).setOrigin(0.5).setDepth(100);
    this.tweens.add({ targets: t, y: y - 80, alpha: 0, duration: 1200, onComplete: () => t.destroy() });
  }

  private updateAuras() {
    this.unitAuras.clear();
    const drawAura = (unit: any, team: string) => {
      if (!unit.active) return;
      const color = team === 'alpha' ? 0xf97316 : 0x22d3ee;
      this.unitAuras.lineStyle(2, color, 0.5); this.unitAuras.strokeCircle(unit.x, unit.y, 35);
      this.unitAuras.fillStyle(color, 0.1); this.unitAuras.fillCircle(unit.x, unit.y, 35);
    };
    drawAura(this.player, this.playerTeam);
    this.otherPlayers.forEach(p => drawAura(p, p.getData('team')));
    this.aiBots.getChildren().forEach((b: any) => drawAura(b, b.getData('team')));
  }

  private swapWeapon(key: string) {
    const config = WEAPONS_CONFIG[key];
    if (config) {
      this.currentWeapon = config; this.ammo = config.maxAmmo;
      this.playSound('sfx_powerup', 0.4); // Weapon swap sound
      this.tweens.add({ targets: this.player, scaleX: 1.25, scaleY: 1.25, duration: 80, yoyo: true, ease: 'Sine.easeInOut' });
      this.abilityEmitter.emitParticleAt(this.player.x, this.player.y, 1);
      this.showFloatingText(this.player.x, this.player.y - 40, `${config.icon} ${config.name} EQUIPPED`, teamColors[this.playerTeam]);
      this.weaponLabel.setText(config.name); this.player.setTexture(`hum_${this.characterClass.toLowerCase()}_${config.category}`);
    }
  }

  private drawHealthBar() {
    this.playerHpBar.clear();
    const hpPercent = this.health / this.maxHealth;
    this.playerHpBar.fillStyle(0x000000, 0.5).fillRect(this.player.x - 25, this.player.y - 45, 50, 6);
    this.playerHpBar.fillStyle(hpPercent > 0.3 ? 0x10b981 : 0xef4444).fillRect(this.player.x - 25, this.player.y - 45, hpPercent * 50, 6);
  }

  private updateHUD() {
    this.updateGameStatsObj();
  }
}
