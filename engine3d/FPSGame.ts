import * as THREE from 'three';
import type { FPSGameEvents, FPSGameStats, WeaponKey, EnemyType, GameSettings, LoadoutConfig, CharacterClass, ArmorType, GrenadeType, UpgradeType, PlayerProgression, PerkType, KillstreakRewardType, WaveObjective, WaveModifier, Achievement, DominationZoneUI, MapType, BattlefieldConfig } from './types';
import { WEAPONS, DEFAULT_SETTINGS, DEFAULT_LOADOUT, CHARACTERS, ARMORS, GRENADES, UPGRADES, PERKS, KILLSTREAK_REWARDS, DEFAULT_OBJECTIVE, getWaveModifier, ACHIEVEMENTS, QUICK_CHAT_OPTIONS, BATTLEFIELDS } from './types';
import { MultiplayerClient, type GameMode, type PlayerState } from './MultiplayerClient';
import { RemotePlayer } from './RemotePlayer';

interface Enemy {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  headMesh: THREE.Mesh;
  hpBar: THREE.Sprite;
  hp: number;
  maxHp: number;
  type: EnemyType;
  state: 'idle' | 'patrol' | 'chase' | 'attack' | 'search' | 'retreat' | 'flank' | 'cover' | 'suppress';
  stateTimer: number;
  strafeDir: number;
  hitFlash: number;
  dead: boolean;
  deathTimer: number;
  lastShot: number;
  patrolTarget: THREE.Vector3;
  speed: number;
  damage: number;
  fireRate: number;
  optimalRange: number;
  coverPos: THREE.Vector3 | null;
  isMiniBoss: boolean;
  reviveTimer: number;
  downed: boolean;
  footstepTimer: number;
  lastKnownPlayerPos: THREE.Vector3 | null;
  losCheckTimer: number;
  hasLOS: boolean;
  deathDir: THREE.Vector3 | null;
  isBoss: boolean;
  enraged: boolean;
  weakSpotHit: boolean;
  isElite: boolean;
}

interface Barrel {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  exploded: boolean;
}

interface Pickup {
  mesh: THREE.Mesh;
  type: 'health' | 'ammo' | 'armor' | 'weapon';
  weaponKey?: WeaponKey;
  armorType?: ArmorType;
  taken: boolean;
  bobOffset: number;
}

interface Grenade {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  fuse: number;
}

interface BulletDecal {
  mesh: THREE.Mesh;
  lifetime: number;
}

interface PoolItem {
  mesh: THREE.Mesh;
  active: boolean;
  lifetime: number;
}

const ENEMY_CONFIG: Record<EnemyType, { hp: number; speed: number; damage: number; fireRate: number; range: number; color: number; visorColor: number; scale: number; weapon: 'rifle' | 'shotgun' | 'lmg' | 'sniper' }> = {
  grunt: { hp: 100, speed: 2.5, damage: 8, fireRate: 800, range: 20, color: 0x3a4a2a, visorColor: 0xff4400, scale: 1, weapon: 'rifle' },
  rifleman: { hp: 150, speed: 2.0, damage: 12, fireRate: 600, range: 25, color: 0x2a3a1a, visorColor: 0xff6600, scale: 1.05, weapon: 'rifle' },
  shotgunner: { hp: 120, speed: 3.5, damage: 20, fireRate: 1000, range: 8, color: 0x4a3a1a, visorColor: 0xffaa00, scale: 1.1, weapon: 'shotgun' },
  heavy: { hp: 300, speed: 1.2, damage: 15, fireRate: 400, range: 22, color: 0x1a1a1a, visorColor: 0xff0000, scale: 1.3, weapon: 'lmg' },
  sniper: { hp: 80, speed: 1.5, damage: 35, fireRate: 2000, range: 40, color: 0x2a2a3a, visorColor: 0xff0000, scale: 0.95, weapon: 'sniper' },
  charger: { hp: 80, speed: 6.0, damage: 25, fireRate: 600, range: 3, color: 0x5a1a1a, visorColor: 0xff00ff, scale: 0.9, weapon: 'rifle' },
  bomber: { hp: 60, speed: 3.0, damage: 50, fireRate: 9999, range: 4, color: 0x3a2a0a, visorColor: 0xffff00, scale: 1.0, weapon: 'rifle' },
  medic: { hp: 120, speed: 2.0, damage: 5, fireRate: 1500, range: 18, color: 0x1a3a3a, visorColor: 0x00ffff, scale: 1.0, weapon: 'rifle' },
  boss: { hp: 800, speed: 2.0, damage: 35, fireRate: 600, range: 25, color: 0x8a1a1a, visorColor: 0xff0000, scale: 2.5, weapon: 'lmg' },
};

export class FPSGame {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private animationId = 0;

  private keys: Record<string, boolean> = {};
  private isLocked = false;
  private yaw = 0;
  private pitch = 0;

  private enemies: Enemy[] = [];
  private tracers: THREE.Mesh[] = [];
  private muzzleLight: THREE.PointLight | null = null;
  private muzzleMesh: THREE.Mesh | null = null;
  private muzzleTimeout: ReturnType<typeof setTimeout> | null = null;
  private weaponGroup: THREE.Group | null = null;
  private lastShot = 0;

  private recoil = 0;
  private walkCycle = 0;
  private time = 0;
  private flashlight: THREE.SpotLight | null = null;
  private flashlightOn = true;

  private hp = 100;
  private maxHp = 100;
  private currentWeapon: WeaponKey = 'smg';
  private ammo: Record<WeaponKey, number> = { pistol: 12, smg: 30, shotgun: 6, rifle: 30, lmg: 100, sniper: 10, dmr: 20, launcher: 6, plasma: 20 };
  private reserveAmmo: Record<WeaponKey, number> = { pistol: 999, smg: 90, shotgun: 18, rifle: 90, lmg: 200, sniper: 30, dmr: 60, launcher: 18, plasma: 60 };
  private reloading = false;
  private reloadTimer = 0;
  private grenades = 3;
  private isADS = false;
  private isCrouching = false;
  private isSprinting = false;
  private slideTimer = 0;
  private slideVel = new THREE.Vector3();
  private damageCooldown = 0;
  private dead = false;
  private healthRegenTimer = 0;
  private stamina = 100;
  private maxStamina = 100;
  private staminaRegenTimer = 0;
  private leanDir: 'left' | 'right' | null = null;
  private leanAmount = 0;
  private crosshairSpread = 0;
  private killstreak = 0;
  private score = 0;
  private headshots = 0;
  private damageDealt = 0;
  private damageTaken = 0;
  private suppressedTimer = 0;
  private vaultCooldown = 0;
  private bulletDecals: BulletDecal[] = [];
  private tracerPool: PoolItem[] = [];
  private sparkPool: PoolItem[] = [];
  private shellCasings: { mesh: THREE.Mesh; vel: THREE.Vector3; lifetime: number; active: boolean }[] = [];
  private dustParticles: { mesh: THREE.Points; vel: Float32Array; lifetime: number; active: boolean }[] = [];
  private rainParticles: THREE.Points | null = null;
  private ambientTimer = 0;
  private heartbeatTimer = 0;
  private nearbyEnemyAngle: number | null = null;
  // Dynamic difficulty
  private difficultyMult = 1.0;
  private waveStartTime = 0;
  private waveClearTimes: number[] = [];
  // Weapon sway
  private weaponSwayX = 0;
  private weaponSwayY = 0;
  private weaponSwayTargetX = 0;
  private weaponSwayTargetY = 0;
  private reloadAnimProgress = 0;
  private mouseDeltaX = 0;
  private mouseDeltaY = 0;
  // Jump / gravity
  private verticalVel = 0;
  private isGrounded = true;
  private jumpRequested = false;
  // Mobile touch input
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchLookX = 0;
  private touchLookY = 0;
  private touchFiring = false;
  private touchADS = false;
  private touchSprint = false;
  private gyroYaw = 0;
  private gyroPitch = 0;
  private autoFireEnabled = false;
  private meleeCooldown = 0;
  private aimAssistStrength = 0;
  // Score multiplier chain
  private scoreMultiplier = 1;
  private comboTimer = 0;
  private comboKills = 0;
  // Boss wave
  private isBossWave = false;
  private bossEnemy: Enemy | null = null;
  // Wave tracking for bonuses
  private waveDamageTaken = 0;
  private waveHeadshots = 0;
  // Muzzle flash light
  private muzzleFlashLight: THREE.PointLight | null = null;
  private muzzleFlashTimer = 0;
  // Blood pools
  private bloodPools: { mesh: THREE.Mesh; lifetime: number }[] = [];
  // Destructible cover
  private destructibleCover: { mesh: THREE.Mesh; hp: number; maxHp: number; pieces: THREE.Mesh[] }[] = [];
  // Light switches
  private lightSwitches: { mesh: THREE.Mesh; light: THREE.PointLight; on: boolean }[] = [];
  // Screen effects
  private screenFlashIntensity = 0;
  private screenFlashColor = 0xff0000;
  // Dynamic music
  private musicLayer: 'calm' | 'tension' | 'combat' | 'critical' = 'calm';
  private musicGain: GainNode | null = null;
  private musicOsc: OscillatorNode | null = null;
  private musicOsc2: OscillatorNode | null = null;
  private musicTimer = 0;

  // Multiplayer
  private mpClient: MultiplayerClient | null = null;
  private remotePlayers: Map<string, RemotePlayer> = new Map();
  private mpMode: GameMode | null = null;
  private mpScoreLimit = 0;
  private mpRespawnTimer = 0;
  private mpScores: Record<string, { kills: number; deaths: number; score: number; team: string }> = {};
  private mpTeamScores: { alpha: number; bravo: number } = { alpha: 0, bravo: 0 };
  private mpGameOver = false;
  private mpSpawnProtectTimer = 0;
  private mpKillerId: string | null = null;
  private mpDeathCamTimer = 0;
  private mpDeathCamTarget: THREE.Vector3 = new THREE.Vector3();
  private mpPreMatchCountdown = 0;
  private mpLastHitBy: string | null = null;
  private mpLastHitWeapon: string = 'smg';
  private mpLastHitHeadshot = false;
  private mpRemoteBlood: { mesh: THREE.Mesh; velocity: THREE.Vector3; lifetime: number }[] = [];

  // Wave modifiers
  private currentWaveModifier: WaveModifier | null = null;
  // Elite enemies
  private isEliteWave = false;
  // Achievements
  private unlockedAchievements: Set<string> = new Set();
  private totalMeleeKills = 0;
  // Spectator mode
  private mpSpectatorIndex = 0;
  private mpSpectatorTarget: string | null = null;
  // Weapon swap animation
  private weaponSwapAnim = 0;
  // Adaptive quality
  private fpsHistory: number[] = [];
  private fpsAccum = 0;
  private fpsSampleCount = 0;
  private adaptiveQualityLevel = 2; // 0=low, 1=medium, 2=high
  // Domination zones
  private dominationZones: { id: string; mesh: THREE.Mesh; ringMesh: THREE.Mesh; pos: THREE.Vector3; radius: number; team: 'alpha' | 'bravo' | 'neutral'; progress: number; contested: boolean }[] = [];
  // Kill confirm sound cooldown
  private lastKillConfirmTime = 0;

  private barrels: Barrel[] = [];
  private pickups: Pickup[] = [];
  private grenadesList: Grenade[] = [];
  private collidables: THREE.Mesh[] = [];
  private colliderBoxes: Map<THREE.Mesh, THREE.Box3> = new Map();

  private wave = 1;
  private waveKillCount = 0;
  private waveSpawnTimer = 0;
  private hpBarCanvas: HTMLCanvasElement | null = null;
  private hpBarCtx: CanvasRenderingContext2D | null = null;
  private hpBarTex: THREE.CanvasTexture | null = null;
  private mouseHeld = false;
  private started = false;
  private muzzleLightTimer = 0;
  private mapType: MapType = 'urban_desert';
  private mapConfig: BattlefieldConfig;
  private safeZoneTimer = 0;
  private safeZoneActive = false;
  private velX = 0;
  private velZ = 0;
  private targetVelX = 0;
  private targetVelZ = 0;
  private sprintAccel = 0;
  private cameraShake = 0;
  private landingDip = 0;
  private strafeTilt = 0;
  private _shakeX = 0;
  private _shakeY = 0;
  private footstepCooldown = 0;
  private perk: PerkType = 'none';
  private uavTimer = 0;
  private gunshipTimer = 0;
  private gunshipMesh: THREE.Group | null = null;
  private supplyDropBoostTimer = 0;
  private juggernautShield = 0;
  private currentObjective: WaveObjective = { ...DEFAULT_OBJECTIVE };
  private damageNumberId = 0;
  private hitMarkerId = 0;
  private killstreakRewardsEarned: KillstreakRewardType[] = [];

  private stats: FPSGameStats;
  private events: FPSGameEvents;
  private audioCtx: AudioContext | null = null;
  private enemyFlashLight: THREE.PointLight | null = null;
  private settings: GameSettings;
  private loadout: LoadoutConfig;
  private characterCfg = CHARACTERS.assault;
  private armorCfg = ARMORS.light;
  private grenadeCfg = GRENADES.frag;
  private weaponUpgrades: Partial<Record<UpgradeType, number>> = {};
  private damageMult = 1.0;
  private reloadMult = 1.0;
  private damageReduction = 0;

  constructor(container: HTMLElement, events: FPSGameEvents = {}, settings?: GameSettings, loadout?: LoadoutConfig, progression?: PlayerProgression, mapType?: MapType) {
    this.container = container;
    this.events = events;
    this.settings = settings || DEFAULT_SETTINGS;
    this.loadout = loadout || DEFAULT_LOADOUT;
    this.mapType = mapType || 'urban_desert';
    this.mapConfig = BATTLEFIELDS[this.mapType];
    this.characterCfg = CHARACTERS[this.loadout.character];
    this.armorCfg = ARMORS[this.loadout.armor];
    this.grenadeCfg = GRENADES[this.loadout.grenadeType];
    this.currentWeapon = this.loadout.primaryWeapon;
    this.weaponUpgrades = progression?.weaponUpgrades?.[this.loadout.primaryWeapon] || {};
    this.damageMult = this.characterCfg.damageMult;
    this.reloadMult = this.characterCfg.reloadMult;
    this.damageReduction = this.armorCfg.damageReduction;
    this.perk = this.loadout.perk;
    if (this.perk === 'doubletap') { this.damageMult *= 1.15; }
    if (this.perk === 'fasthands') { this.reloadMult *= 0.7; }
    this.audioCtx = typeof window !== 'undefined' ? new (window.AudioContext || (window as any).webkitAudioContext)() : null;
    // Apply character + armor stats
    this.hp = this.characterCfg.baseHp + this.armorCfg.hpBonus;
    this.maxHp = this.hp;
    if (this.perk === 'juggernaut') { this.hp += 50; this.maxHp = this.hp; this.juggernautShield = 20; }
    this.stamina = this.characterCfg.baseStamina;
    this.maxStamina = this.stamina;
    this.grenades = this.loadout.grenadeCount;
    // Apply weapon upgrades to ammo
    const magUpgrade = this.weaponUpgrades.magSize || 0;
    const w = WEAPONS[this.currentWeapon];
    const upgradedMagSize = Math.round(w.magSize * (1 + magUpgrade * UPGRADES.magSize.effectPerLevel));
    this.ammo[this.currentWeapon] = upgradedMagSize;
    // Scavenger perk: +50% reserve ammo
    if (this.perk === 'scavenger') {
      (Object.keys(this.reserveAmmo) as WeaponKey[]).forEach(k => { this.reserveAmmo[k] = Math.round(this.reserveAmmo[k] * 1.5); });
    }
    this.stats = { kills: 0, shotsFired: 0, shotsHit: 0, hp: this.hp, maxHp: this.maxHp, stamina: this.stamina, maxStamina: this.maxStamina, ammo: this.ammo[this.currentWeapon], magSize: upgradedMagSize, weaponName: w.name, weaponKey: this.currentWeapon, grenades: this.grenades, wave: 1, enemiesAlive: 0, killstreak: 0, score: 0, headshots: 0, damageDealt: 0, damageTaken: 0, compassEnemy: null, crosshairSpread: 0, isLeaning: null, suppressed: false, radarBlips: [], radarObjective: null, uavActive: false, scoreMultiplier: 1, comboTimer: 0, isBossWave: false, bossHp: 0, bossMaxHp: 0, waveDamageTaken: 0, waveHeadshots: 0, waveStartTime: 0, isEliteWave: false, waveModifier: null, spectatorTarget: null, lowAmmo: false, dominationZones: [], safeZoneTimer: 0, currentMap: this.mapConfig.name, isADS: false };
    this.init();
  }

  private init() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.mapConfig.skyColor);
    this.scene.fog = new THREE.FogExp2(this.mapConfig.fogColor, this.mapConfig.fogDensity);

    this.camera = new THREE.PerspectiveCamera(this.settings.fov, this.container.clientWidth / this.container.clientHeight, 0.01, 1000);
    this.camera.position.set(0, 1.7, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.4;
    this.container.appendChild(this.renderer.domElement);

    // Lighting — map-specific
    const ambient = new THREE.HemisphereLight(this.mapConfig.ambientColor, 0x2a2a22, this.mapConfig.ambientIntensity);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(this.mapConfig.dirLightColor, this.mapConfig.dirLightIntensity);
    dirLight.position.set(...this.mapConfig.dirLightPos);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 140;
    dirLight.shadow.camera.left = -60;
    dirLight.shadow.camera.right = 60;
    dirLight.shadow.camera.top = 60;
    dirLight.shadow.camera.bottom = -60;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(this.mapConfig.fillColor, this.mapConfig.fillIntensity);
    fillLight.position.set(-20, 25, -25);
    this.scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(this.mapConfig.rimColor, this.mapConfig.rimIntensity);
    rimLight.position.set(0, 5, -30);
    this.scene.add(rimLight);

    // Build world — map-specific
    this.buildMapWorld();

    this.buildWeapon();
    this.buildMuzzleFlash();
    this.buildFlashlight();

    this.muzzleLight = new THREE.PointLight(0xffaa00, 0, 8);
    this.muzzleLight.position.set(0.18, -0.15, -0.55);
    this.camera.add(this.muzzleLight);
    this.scene.add(this.camera);

    // Reusable enemy muzzle flash light (hidden by default)
    this.enemyFlashLight = new THREE.PointLight(0xff6600, 0, 8, 2);
    this.enemyFlashLight.visible = false;
    this.scene.add(this.enemyFlashLight);

    // Enemies & pickups — spawned on start(), not during init

    // Weather particles — map-specific
    this.buildWeather();

    // Object pools
    this.initObjectPools();

    this.bindInput();
    new ResizeObserver(() => this.onResize()).observe(this.container);
    this.animate();
  }

  // ─── BATTLEFIELD ───

  private buildWeather() {
    if (this.mapConfig.weather === 'none') return;
    const count = this.mapConfig.weather === 'blizzard' ? 1200 : this.mapConfig.weather === 'sandstorm' ? 600 : this.mapConfig.weather === 'neon' ? 500 : 800;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = Math.random() * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      if (this.mapConfig.weather === 'blizzard') {
        velocities[i] = 3 + Math.random() * 5;
      } else if (this.mapConfig.weather === 'sandstorm') {
        velocities[i] = 8 + Math.random() * 6;
      } else if (this.mapConfig.weather === 'neon') {
        velocities[i] = 1 + Math.random() * 2;
      } else {
        velocities[i] = 15 + Math.random() * 10;
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const size = this.mapConfig.weather === 'blizzard' ? 0.12 : this.mapConfig.weather === 'sandstorm' ? 0.1 : this.mapConfig.weather === 'neon' ? 0.15 : 0.06;
    const opacity = this.mapConfig.weather === 'fog' ? 0.15 : this.mapConfig.weather === 'neon' ? 0.3 : 0.4;
    const mat = new THREE.PointsMaterial({ color: this.mapConfig.weatherColor, size, transparent: true, opacity });
    this.rainParticles = new THREE.Points(geo, mat);
    this.rainParticles.userData.velocities = velocities;
    this.scene.add(this.rainParticles);
  }

  private updateWeather(dt: number) {
    if (!this.rainParticles) return;
    const pos = this.rainParticles.geometry.attributes.position.array as Float32Array;
    const vel = this.rainParticles.userData.velocities as Float32Array;
    const count = pos.length / 3;
    const px = this.camera.position.x;
    const pz = this.camera.position.z;
    for (let i = 0; i < count; i++) {
      if (this.mapConfig.weather === 'neon') {
        // Neon particles drift slowly and laterally, reset when too far
        pos[i * 3] += Math.sin(this.time * 0.5 + i) * vel[i] * dt;
        pos[i * 3 + 1] += Math.cos(this.time * 0.3 + i) * vel[i] * 0.5 * dt;
        pos[i * 3 + 2] += Math.cos(this.time * 0.4 + i) * vel[i] * dt;
        if (Math.abs(pos[i * 3] - px) > 30 || pos[i * 3 + 1] < 0 || pos[i * 3 + 1] > 30) {
          pos[i * 3] = px + (Math.random() - 0.5) * 50;
          pos[i * 3 + 1] = Math.random() * 30;
          pos[i * 3 + 2] = pz + (Math.random() - 0.5) * 50;
        }
      } else {
        pos[i * 3 + 1] -= vel[i] * dt;
        if (this.mapConfig.weather === 'sandstorm' || this.mapConfig.weather === 'blizzard') {
          pos[i * 3] += Math.sin(this.time + i) * 2 * dt;
        }
        if (pos[i * 3 + 1] < 0) {
          pos[i * 3] = px + (Math.random() - 0.5) * 50;
          pos[i * 3 + 1] = 25 + Math.random() * 5;
          pos[i * 3 + 2] = pz + (Math.random() - 0.5) * 50;
        }
      }
    }
    this.rainParticles.geometry.attributes.position.needsUpdate = true;
  }

  private buildMapWorld() {
    switch (this.mapType) {
      case 'urban_desert': this.buildUrbanDesertMap(); break;
      case 'jungle': this.buildJungleMap(); break;
      case 'cyberpunk': this.buildCyberpunkMap(); break;
    }
  }

  // ─── URBAN DESERT MAP ───

  private buildUrbanDesertMap() {
    this.buildFloor();
    this.buildWalls();
    this.buildCover();
    this.buildCatwalks();
    this.buildContainers();
    this.buildBarrels();
    this.buildSandbags();
    this.buildAtmosphericLights();
    this.buildLightSwitches();

    // Sand dunes — subtle elevation in open areas
    const duneMat = new THREE.MeshStandardMaterial({ color: 0xb89858, roughness: 0.95 });
    for (let i = 0; i < 6; i++) {
      const r = 12 + Math.random() * 30;
      const a = Math.random() * Math.PI * 2;
      const dune = new THREE.Mesh(new THREE.SphereGeometry(2 + Math.random() * 3, 8, 4), duneMat);
      dune.position.set(Math.cos(a) * r, -1, Math.sin(a) * r);
      dune.scale.y = 0.3;
      dune.receiveShadow = true;
      this.scene.add(dune);
    }

    // Military tents — camo netting
    const tentMat = new THREE.MeshStandardMaterial({ color: 0x5a6a3a, roughness: 0.8 });
    const tentPositions = [
      { x: -15, z: -10, rot: 0.3 }, { x: 15, z: 10, rot: -0.5 }, { x: 0, z: 0, rot: 0 },
    ];
    tentPositions.forEach((tp) => {
      const tent = new THREE.Mesh(new THREE.ConeGeometry(2.5, 2.5, 4), tentMat);
      tent.position.set(tp.x, 1.25, tp.z);
      tent.rotation.y = tp.rot;
      tent.castShadow = true; tent.receiveShadow = true;
      this.scene.add(tent);
      const coll = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.5, 3.5), tentMat);
      coll.position.set(tp.x, 1.25, tp.z);
      coll.rotation.y = tp.rot;
      coll.visible = false;
      this.scene.add(coll);
      this.collidables.push(coll);
    });

    // Watchtowers at corners
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, roughness: 0.85 });
    const towerPositions = [
      { x: -22, z: -22 }, { x: 22, z: 22 },
    ];
    towerPositions.forEach((tp) => {
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8, 0.3), towerMat);
        leg.position.set(tp.x + Math.cos(ang) * 1.2, 4, tp.z + Math.sin(ang) * 1.2);
        leg.castShadow = true;
        this.scene.add(leg);
        this.collidables.push(leg);
      }
      const platform = new THREE.Mesh(new THREE.BoxGeometry(3, 0.3, 3), towerMat);
      platform.position.set(tp.x, 8, tp.z);
      platform.castShadow = true; platform.receiveShadow = true;
      this.scene.add(platform);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.5, 1.5, 4), towerMat);
      roof.position.set(tp.x, 9, tp.z);
      roof.castShadow = true;
      this.scene.add(roof);
    });

    // Sky dome
    const skyGeo = new THREE.SphereGeometry(200, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: this.mapConfig.skyColor, side: THREE.BackSide, transparent: true, opacity: 0.9 });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.y = 50;
    this.scene.add(sky);
  }

  // ─── JUNGLE MAP ───

  private buildJungleMap() {
    // Dark soil floor
    const floorMat = new THREE.MeshStandardMaterial({ color: this.mapConfig.floorColor, roughness: 0.9, metalness: 0.05 });
    const floorGeo = new THREE.PlaneGeometry(90, 90);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // River — dark water strip through the middle
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x1a3a3a, roughness: 0.3, metalness: 0.6, transparent: true, opacity: 0.8 });
    const river = new THREE.Mesh(new THREE.PlaneGeometry(8, 70), waterMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(0, 0.02, 0);
    this.scene.add(river);

    // Perimeter — dense vegetation walls
    const vegMat = new THREE.MeshStandardMaterial({ color: 0x1a2a0a, roughness: 0.95 });
    const perim = 22;
    const perims = [
      { x: 0, z: -perim, w: perim * 2, d: 2, h: 6 },
      { x: 0, z: perim, w: perim * 2, d: 2, h: 6 },
      { x: -perim, z: 0, w: 2, d: perim * 2, h: 6 },
      { x: perim, z: 0, w: 2, d: perim * 2, h: 6 },
    ];
    perims.forEach((p) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), vegMat);
      wall.position.set(p.x, p.h / 2, p.z);
      wall.castShadow = true; wall.receiveShadow = true;
      this.scene.add(wall);
      this.collidables.push(wall);
    });

    // Trees — tall trunks with canopy
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2a4a1a, roughness: 0.95 });
    for (let i = 0; i < 25; i++) {
      const r = 5 + Math.random() * 14;
      const a = Math.random() * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) < 5) continue; // Keep river clear
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 8, 6), trunkMat);
      trunk.position.set(x, 4, z);
      trunk.castShadow = true;
      this.scene.add(trunk);
      this.collidables.push(trunk);
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(3 + Math.random() * 2, 6, 5), leafMat);
      canopy.position.set(x, 8 + Math.random() * 2, z);
      canopy.castShadow = true;
      this.scene.add(canopy);
    }

    // Wooden structures — huts
    const hutMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.85 });
    const hutPositions = [
      { x: -12, z: -8, rot: 0.3 }, { x: 12, z: 8, rot: -0.5 },
      { x: -8, z: 12, rot: 1.0 }, { x: 10, z: -12, rot: 0.8 },
    ];
    hutPositions.forEach((hp) => {
      const hut = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), hutMat);
      hut.position.set(hp.x, 1.5, hp.z);
      hut.rotation.y = hp.rot;
      hut.castShadow = true; hut.receiveShadow = true;
      this.scene.add(hut);
      this.collidables.push(hut);
      // Thatched roof
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3.5, 2, 4), new THREE.MeshStandardMaterial({ color: 0x4a3a1a, roughness: 0.95 }));
      roof.position.set(hp.x, 4, hp.z);
      roof.rotation.y = hp.rot;
      roof.castShadow = true;
      this.scene.add(roof);
    });

    // Bushes — low cover
    const bushMat = new THREE.MeshStandardMaterial({ color: 0x2a3a1a, roughness: 0.95 });
    for (let i = 0; i < 20; i++) {
      const r = 3 + Math.random() * 16;
      const a = Math.random() * Math.PI * 2;
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.8 + Math.random() * 0.6, 6, 5), bushMat);
      bush.position.set(Math.cos(a) * r, 0.5, Math.sin(a) * r);
      bush.castShadow = true; bush.receiveShadow = true;
      this.scene.add(bush);
      this.collidables.push(bush);
    }

    this.buildBarrels();

    // Sky dome
    const skyGeo = new THREE.SphereGeometry(200, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: this.mapConfig.skyColor, side: THREE.BackSide, transparent: true, opacity: 0.85 });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.y = 50;
    this.scene.add(sky);
  }

  // ─── CYBERPUNK MAP ───

  private buildCyberpunkMap() {
    // Dark metal floor with neon grid
    const floorMat = new THREE.MeshStandardMaterial({ color: this.mapConfig.floorColor, roughness: 0.4, metalness: 0.6 });
    const floorGeo = new THREE.PlaneGeometry(100, 100);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Neon grid overlay
    const grid = new THREE.GridHelper(100, 50, 0x00ffaa, 0x1a0a2a);
    grid.position.y = 0.01;
    grid.material.transparent = true;
    (grid.material as THREE.Material).opacity = 0.3;
    this.scene.add(grid);

    // Perimeter — tall concrete walls with neon trim
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.6, metalness: 0.4 });
    const neonMat = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 0.8 });
    const perim = 25;
    const perims = [
      { x: 0, z: -perim, w: perim * 2, d: 1, h: 8 },
      { x: 0, z: perim, w: perim * 2, d: 1, h: 8 },
      { x: -perim, z: 0, w: 1, d: perim * 2, h: 8 },
      { x: perim, z: 0, w: 1, d: perim * 2, h: 8 },
    ];
    perims.forEach((p) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), wallMat);
      wall.position.set(p.x, p.h / 2, p.z);
      wall.castShadow = true; wall.receiveShadow = true;
      this.scene.add(wall);
      this.collidables.push(wall);
      // Neon strip at top
      const strip = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.2, p.d), neonMat);
      strip.position.set(p.x, p.h - 0.5, p.z);
      this.scene.add(strip);
    });

    // Buildings — tall blocks with neon accents
    const bldgMat = new THREE.MeshStandardMaterial({ color: 0x2a1a3a, roughness: 0.5, metalness: 0.5 });
    const bldgNeonMat = new THREE.MeshStandardMaterial({ color: 0x00ffaa, emissive: 0x00ffaa, emissiveIntensity: 0.6 });
    const bldgPositions = [
      { x: -16, z: -12, w: 6, h: 12, d: 6 }, { x: 16, z: 12, w: 6, h: 10, d: 6 },
      { x: -12, z: 14, w: 5, h: 14, d: 5 }, { x: 14, z: -14, w: 5, h: 11, d: 5 },
      { x: 0, z: -18, w: 8, h: 16, d: 4 },
    ];
    bldgPositions.forEach((bp) => {
      const bldg = new THREE.Mesh(new THREE.BoxGeometry(bp.w, bp.h, bp.d), bldgMat);
      bldg.position.set(bp.x, bp.h / 2, bp.z);
      bldg.castShadow = true; bldg.receiveShadow = true;
      this.scene.add(bldg);
      this.collidables.push(bldg);
      // Neon window strips
      for (let s = 1; s < Math.floor(bp.h / 3); s++) {
        const window = new THREE.Mesh(new THREE.BoxGeometry(bp.w * 0.8, 0.15, 0.1), bldgNeonMat);
        window.position.set(bp.x, s * 3, bp.z + bp.d / 2 + 0.05);
        this.scene.add(window);
      }
    });

    // Elevated catwalks — metal grating with neon rails
    const catwalkMat = new THREE.MeshStandardMaterial({ color: 0x3a3a4a, roughness: 0.4, metalness: 0.7 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0xff00ff, emissive: 0xff00ff, emissiveIntensity: 0.5 });
    const catwalkPositions = [
      { x: 0, z: -5, w: 16, d: 2 }, { x: 0, z: 5, w: 16, d: 2 },
      { x: -8, z: 0, w: 2, d: 16 }, { x: 8, z: 0, w: 2, d: 16 },
    ];
    catwalkPositions.forEach((cp) => {
      const catwalk = new THREE.Mesh(new THREE.BoxGeometry(cp.w, 0.2, cp.d), catwalkMat);
      catwalk.position.set(cp.x, 5, cp.z);
      catwalk.castShadow = true; catwalk.receiveShadow = true;
      this.scene.add(catwalk);
      this.collidables.push(catwalk);
      // Neon rails
      const rail1 = new THREE.Mesh(new THREE.BoxGeometry(cp.w, 0.08, 0.08), railMat);
      rail1.position.set(cp.x, 5.5, cp.z - cp.d / 2);
      this.scene.add(rail1);
      const rail2 = new THREE.Mesh(new THREE.BoxGeometry(cp.w, 0.08, 0.08), railMat);
      rail2.position.set(cp.x, 5.5, cp.z + cp.d / 2);
      this.scene.add(rail2);
      // Support pillars
      for (let s = -1; s <= 1; s += 2) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 0.3), catwalkMat);
        pillar.position.set(cp.x + s * (cp.w / 2 - 0.5), 2.5, cp.z);
        pillar.castShadow = true;
        this.scene.add(pillar);
        this.collidables.push(pillar);
      }
    });

    // Neon light poles with point lights
    const poleColors = [0xff00ff, 0x00ffaa, 0x00aaff, 0xff0066];
    const polePositions = [
      { x: -18, z: -18 }, { x: 18, z: 18 }, { x: -18, z: 18 }, { x: 18, z: -18 },
    ];
    polePositions.forEach((pp, i) => {
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.4, metalness: 0.7 });
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8, 8), poleMat);
      pole.position.set(pp.x, 4, pp.z);
      pole.castShadow = true;
      this.scene.add(pole);
      this.collidables.push(pole);
      const color = poleColors[i % poleColors.length];
      const lightMat = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.0 });
      const fixture = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.3, 0.6), lightMat);
      fixture.position.set(pp.x, 8, pp.z);
      this.scene.add(fixture);
      const ptLight = new THREE.PointLight(color, 1.2, 18);
      ptLight.position.set(pp.x, 7.8, pp.z);
      this.scene.add(ptLight);
    });

    // Holographic billboards — glowing planes
    const holoMat1 = new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const holoMat2 = new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
    const holoPositions = [
      { x: -24, z: 0, w: 6, h: 4, mat: holoMat1 }, { x: 24, z: 0, w: 6, h: 4, mat: holoMat2 },
    ];
    holoPositions.forEach((hp) => {
      const holo = new THREE.Mesh(new THREE.PlaneGeometry(hp.w, hp.h), hp.mat);
      holo.position.set(hp.x, 6, hp.z);
      holo.rotation.y = Math.PI / 2;
      this.scene.add(holo);
    });

    this.buildContainers();
    this.buildBarrels();

    // Sky dome — dark with neon tint
    const skyGeo = new THREE.SphereGeometry(200, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({ color: this.mapConfig.skyColor, side: THREE.BackSide, transparent: true, opacity: 0.95 });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.y = 50;
    this.scene.add(sky);
  }

  // ─── SANDBAGS (shared) ───

  private buildSandbags() {
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.95, metalness: 0.05 });
    const sandbagDarkMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.95, metalness: 0.05 });
    const sandbagPositions = [
      { x: -8, z: -5, rot: 0.3 }, { x: 8, z: 5, rot: -0.2 },
      { x: -3, z: 8, rot: 1.2 }, { x: 3, z: -8, rot: 0.8 },
    ];
    sandbagPositions.forEach((sp) => {
      const group = new THREE.Group();
      group.position.set(sp.x, 0, sp.z);
      group.rotation.y = sp.rot;
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          const mat = (row + col) % 2 === 0 ? sandbagMat : sandbagDarkMat;
          const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.3), mat);
          bag.position.set((col - 1.5) * 0.52 + (row % 2) * 0.15, 0.12 + row * 0.24, (row % 2) * 0.08);
          bag.rotation.set((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.08);
          bag.castShadow = true; bag.receiveShadow = true;
          group.add(bag);
        }
      }
      this.scene.add(group);
      const collider = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.5), sandbagMat);
      collider.position.set(sp.x, 0.4, sp.z);
      collider.rotation.y = sp.rot;
      collider.visible = false;
      this.scene.add(collider);
      this.collidables.push(collider);
    });
  }

  private initObjectPools() {
    // Pre-allocate 20 tracer meshes
    const tracerGeo = new THREE.CylinderGeometry(0.004, 0.004, 1, 4);
    const tracerMat = new THREE.MeshBasicMaterial({ color: 0xffdd55, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 20; i++) {
      const mesh = new THREE.Mesh(tracerGeo, tracerMat.clone());
      mesh.visible = false;
      this.scene.add(mesh);
      this.tracerPool.push({ mesh, active: false, lifetime: 0 });
    }
    // Pre-allocate 15 spark systems
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
    const sparkMat = new THREE.PointsMaterial({ color: 0xffaa00, size: 0.04, transparent: true, opacity: 0, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 15; i++) {
      const points = new THREE.Points(sparkGeo, sparkMat.clone());
      points.visible = false;
      this.scene.add(points);
      this.sparkPool.push({ mesh: points as unknown as THREE.Mesh, active: false, lifetime: 0 });
    }
    // Pre-allocate 10 shell casing meshes
    const shellGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.025, 6);
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xccaa44, metalness: 0.8, roughness: 0.3, emissive: 0x442200, emissiveIntensity: 0.2 });
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(shellGeo, shellMat.clone());
      mesh.visible = false;
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.shellCasings.push({ mesh, vel: new THREE.Vector3(), lifetime: 0, active: false });
    }
    // Pre-allocate 8 dust particle systems
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
    const dustMat = new THREE.PointsMaterial({ color: 0x8a7a6a, size: 0.08, transparent: true, opacity: 0, depthWrite: false });
    for (let i = 0; i < 8; i++) {
      const points = new THREE.Points(dustGeo, dustMat.clone());
      points.visible = false;
      this.scene.add(points);
      this.dustParticles.push({ mesh: points, vel: new Float32Array(12 * 3), lifetime: 0, active: false });
    }
  }

  private getPoolItem(pool: PoolItem[]): PoolItem | null {
    for (const item of pool) {
      if (!item.active) return item;
    }
    return null;
  }

  private buildFloor() {
    const floorGeo = new THREE.PlaneGeometry(80, 80);
    const floorMat = new THREE.MeshStandardMaterial({ color: this.mapConfig.floorColor, roughness: 0.75, metalness: 0.2 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Subtle tactical grid
    const grid = new THREE.GridHelper(80, 80, 0x3a3a42, 0x222228);
    grid.position.y = 0.01;
    grid.material.transparent = true;
    (grid.material as THREE.Material).opacity = 0.12;
    this.scene.add(grid);

    // Scattered battlefield debris — rocks, shell casings, broken concrete
    const rockGeo = new THREE.DodecahedronGeometry(0.15, 0);
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.9, metalness: 0.1 });
    const scrapMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.7, metalness: 0.3 });
    for (let i = 0; i < 60; i++) {
      const isRock = Math.random() > 0.4;
      const mesh = new THREE.Mesh(rockGeo, isRock ? rockMat : scrapMat);
      const r = 3 + Math.random() * 34;
      const a = Math.random() * Math.PI * 2;
      mesh.position.set(Math.cos(a) * r, 0.05 + Math.random() * 0.05, Math.sin(a) * r);
      mesh.scale.setScalar(0.5 + Math.random() * 1.2);
      mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      mesh.castShadow = true; mesh.receiveShadow = true;
      this.scene.add(mesh);
    }

    // Lower tunnel floor
    const tunnelFloor = new THREE.Mesh(new THREE.PlaneGeometry(6, 16), floorMat);
    tunnelFloor.rotation.x = -Math.PI / 2;
    tunnelFloor.position.set(0, -3, -10);
    tunnelFloor.receiveShadow = true;
    this.scene.add(tunnelFloor);
  }

  private buildWalls() {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.65, metalness: 0.3 });
    const perimeter = [
      { x: 0, z: -25, w: 50, d: 1, h: 5 },
      { x: 0, z: 25, w: 50, d: 1, h: 5 },
      { x: -25, z: 0, w: 1, d: 50, h: 5 },
      { x: 25, z: 0, w: 1, d: 50, h: 5 },
    ];
    perimeter.forEach((p) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), wallMat);
      wall.position.set(p.x, p.h / 2, p.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      this.collidables.push(wall);
    });

    // Interior walls — creating rooms and corridors
    const interior = [
      { x: -10, z: -8, w: 10, d: 1, h: 4 },
      { x: 10, z: 8, w: 10, d: 1, h: 4 },
      { x: -8, z: 10, w: 1, d: 10, h: 4 },
      { x: 8, z: -10, w: 1, d: 10, h: 4 },
      { x: -15, z: 5, w: 1, d: 8, h: 4 },
      { x: 15, z: -5, w: 1, d: 8, h: 4 },
    ];
    interior.forEach((p) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), wallMat);
      wall.position.set(p.x, p.h / 2, p.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      this.collidables.push(wall);
    });

    // Tunnel walls
    const tunnelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1e, roughness: 0.9 });
    const tunnelWalls = [
      { x: -3.5, z: -10, w: 1, d: 16 },
      { x: 3.5, z: -10, w: 1, d: 16 },
    ];
    tunnelWalls.forEach((p) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(p.w, 3, p.d), tunnelMat);
      wall.position.set(p.x, -1.5, p.z);
      this.scene.add(wall);
      this.collidables.push(wall);
    });

    // Tunnel ceiling
    const tunnelCeil = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 16), tunnelMat);
    tunnelCeil.position.set(0, 0, -10);
    this.scene.add(tunnelCeil);

    // Ramp from surface to tunnel
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 4), tunnelMat);
    ramp.position.set(0, -1.5, -3);
    ramp.rotation.x = -0.6;
    this.scene.add(ramp);

    // Sky dome — overcast battlefield gradient
    const skyGeo = new THREE.SphereGeometry(200, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      color: 0x0a0a10,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.9,
    });
    const sky = new THREE.Mesh(skyGeo, skyMat);
    sky.position.y = 50;
    this.scene.add(sky);
  }

  private buildCover() {
    const crateMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.85 });
    const crateDarkMat = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.8 });
    const placements = [
      { x: -12, z: -12 }, { x: -10, z: -13 }, { x: 12, z: 10 }, { x: 14, z: 11 },
      { x: -12, z: 12 }, { x: 10, z: -12 }, { x: 0, z: 16 },
      { x: -16, z: 0 }, { x: 16, z: 0 }, { x: 5, z: 5 }, { x: -5, z: -5 },
    ];
    placements.forEach((p, idx) => {
      const isDestructible = idx % 3 === 0;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 2), crateMat);
      crate.position.set(p.x, 0.75, p.z);
      crate.castShadow = true;
      crate.receiveShadow = true;
      crate.userData.isDestructible = isDestructible;
      this.scene.add(crate);
      this.collidables.push(crate);
      if (isDestructible) {
        this.destructibleCover.push({ mesh: crate, hp: 100, maxHp: 100, pieces: [] });
      }
      // Add plank seams (dark lines on edges)
      const seam1 = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.04, 0.06), crateDarkMat);
      seam1.position.set(p.x, 0.75, p.z + 1);
      this.scene.add(seam1);
      const seam2 = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.04, 0.06), crateDarkMat);
      seam2.position.set(p.x, 0.75, p.z - 1);
      this.scene.add(seam2);
      const seam3 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 2.02), crateDarkMat);
      seam3.position.set(p.x + 1, 0.75, p.z);
      this.scene.add(seam3);
      const seam4 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 2.02), crateDarkMat);
      seam4.position.set(p.x - 1, 0.75, p.z);
      this.scene.add(seam4);
      // Metal corner reinforcements
      for (let c = 0; c < 4; c++) {
        const cx = p.x + (c < 2 ? 1 : -1) * 0.98;
        const cz = p.z + (c % 2 === 0 ? 1 : -1) * 0.98;
        const corner = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.52, 0.08), crateDarkMat);
        corner.position.set(cx, 0.75, cz);
        this.scene.add(corner);
      }
    });

    // Low walls for crouch cover
    const lowMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.7, metalness: 0.3 });
    const lowWalls = [
      { x: -6, z: 3, w: 4, d: 0.5 },
      { x: 6, z: -3, w: 4, d: 0.5 },
      { x: 3, z: 12, w: 0.5, d: 4 },
      { x: -3, z: -12, w: 0.5, d: 4 },
    ];
    lowWalls.forEach((p) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.8, p.d), lowMat);
      wall.position.set(p.x, 0.4, p.z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.scene.add(wall);
      this.collidables.push(wall);
      // Top edge detail
      const topEdge = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.1, 0.06, p.d + 0.1), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5, metalness: 0.5 }));
      topEdge.position.set(p.x, 0.83, p.z);
      this.scene.add(topEdge);
    });

    // Sandbag barricades — stacked bags in irregular rows
    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x6b5a3a, roughness: 0.95, metalness: 0.05 });
    const sandbagDarkMat = new THREE.MeshStandardMaterial({ color: 0x5a4a2a, roughness: 0.95, metalness: 0.05 });
    const sandbagPositions = [
      { x: -8, z: -5, rot: 0.3 },
      { x: 8, z: 5, rot: -0.2 },
      { x: -3, z: 8, rot: 1.2 },
      { x: 3, z: -8, rot: 0.8 },
    ];
    sandbagPositions.forEach((sp) => {
      const group = new THREE.Group();
      group.position.set(sp.x, 0, sp.z);
      group.rotation.y = sp.rot;
      // 3 rows of 4 bags each, staggered
      for (let row = 0; row < 3; row++) {
        for (let col = 0; col < 4; col++) {
          const mat = (row + col) % 2 === 0 ? sandbagMat : sandbagDarkMat;
          const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.3), mat);
          bag.position.set(
            (col - 1.5) * 0.52 + (row % 2) * 0.15,
            0.12 + row * 0.24,
            (row % 2) * 0.08,
          );
          bag.rotation.set(
            (Math.random() - 0.5) * 0.1,
            (Math.random() - 0.5) * 0.15,
            (Math.random() - 0.5) * 0.08,
          );
          bag.castShadow = true;
          bag.receiveShadow = true;
          group.add(bag);
        }
      }
      this.scene.add(group);
      // Add a collider for the whole stack
      const collider = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.5), sandbagMat);
      collider.position.set(sp.x, 0.4, sp.z);
      collider.rotation.y = sp.rot;
      collider.visible = false;
      this.scene.add(collider);
      this.collidables.push(collider);
    });

    // Concrete barriers — jersey barriers
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x5a5a5e, roughness: 0.9, metalness: 0.1 });
    const barrierPositions = [
      { x: 0, z: -6, rot: 0 },
      { x: 0, z: 6, rot: 0 },
      { x: -14, z: 0, rot: Math.PI / 2 },
      { x: 14, z: 0, rot: Math.PI / 2 },
    ];
    barrierPositions.forEach((bp) => {
      const barrier = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.0, 0.6), concreteMat);
      barrier.position.set(bp.x, 0.5, bp.z);
      barrier.rotation.y = bp.rot;
      barrier.castShadow = true;
      barrier.receiveShadow = true;
      this.scene.add(barrier);
      this.collidables.push(barrier);
      // Top bevel detail
      const bevel = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.45), new THREE.MeshStandardMaterial({ color: 0x4a4a4e, roughness: 0.9 }));
      bevel.position.set(bp.x, 1.02, bp.z);
      bevel.rotation.y = bp.rot;
      this.scene.add(bevel);
      // Yellow hazard stripe
      const stripeMat = new THREE.MeshStandardMaterial({ color: 0xccaa00, roughness: 0.6, emissive: 0x332200, emissiveIntensity: 0.3 });
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.62), stripeMat);
      stripe.position.set(bp.x, 0.75, bp.z);
      stripe.rotation.y = bp.rot;
      this.scene.add(stripe);
    });
  }

  private buildCatwalks() {
    const catMat = new THREE.MeshStandardMaterial({ color: 0x444450, roughness: 0.5, metalness: 0.6 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x666670, roughness: 0.4, metalness: 0.7 });

    // Catwalk 1 — along east wall
    const cat1 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 16), catMat);
    cat1.position.set(18, 4, 0);
    cat1.castShadow = true;
    cat1.receiveShadow = true;
    this.scene.add(cat1);
    this.collidables.push(cat1);

    // Railings catwalk 1
    for (let z = -7; z <= 7; z += 2) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1, 0.08), railMat);
      post.position.set(19, 4.6, z);
      this.scene.add(post);
    }
    const rail1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 16), railMat);
    rail1.position.set(19, 5, 0);
    this.scene.add(rail1);

    // Catwalk 2 — along west wall
    const cat2 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 16), catMat);
    cat2.position.set(-18, 4, 0);
    cat2.castShadow = true;
    cat2.receiveShadow = true;
    this.scene.add(cat2);
    this.collidables.push(cat2);

    for (let z = -7; z <= 7; z += 2) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1, 0.08), railMat);
      post.position.set(-19, 4.6, z);
      this.scene.add(post);
    }
    const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 16), railMat);
    rail2.position.set(-19, 5, 0);
    this.scene.add(rail2);

    // Stairs to catwalk 1
    for (let i = 0; i < 6; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 0.5), catMat);
      step.position.set(16, 0.7 * (i + 1), 8 - i * 0.5);
      step.castShadow = true;
      this.scene.add(step);
      this.collidables.push(step);
    }

    // Stairs to catwalk 2
    for (let i = 0; i < 6; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 0.5), catMat);
      step.position.set(-16, 0.7 * (i + 1), -8 + i * 0.5);
      step.castShadow = true;
      this.scene.add(step);
      this.collidables.push(step);
    }
  }

  private buildContainers() {
    const colors = [0x2a4a6a, 0x6a3a2a, 0x3a5a3a, 0x5a5a3a];
    const containerMat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.5 });
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.6 });

    const placements = [
      { x: -14, z: -16, w: 6, h: 3, d: 2.5, color: 0 },
      { x: -14, z: -13, w: 6, h: 3, d: 2.5, color: 1 },
      { x: 14, z: 16, w: 6, h: 3, d: 2.5, color: 2 },
      { x: 14, z: 13, w: 6, h: 3, d: 2.5, color: 3 },
      { x: 8, z: -16, w: 2.5, h: 3, d: 6, color: 0 },
      { x: -8, z: 16, w: 2.5, h: 3, d: 6, color: 1 },
      { x: 0, z: -18, w: 2.5, h: 3, d: 6, color: 2 },
    ];

    placements.forEach((p) => {
      const mat = containerMat.clone();
      mat.color.setHex(colors[p.color]);
      const container = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), mat);
      container.position.set(p.x, p.h / 2, p.z);
      container.castShadow = true;
      container.receiveShadow = true;
      this.scene.add(container);
      this.collidables.push(container);
      // Corrugated ribs on the long sides
      const isLongX = p.w > p.d;
      const ribCount = Math.floor((isLongX ? p.w : p.d) / 0.4);
      for (let r = 0; r < ribCount; r++) {
        const offset = (r / (ribCount - 1) - 0.5) * (isLongX ? p.w : p.d);
        const ribGeo = isLongX
          ? new THREE.BoxGeometry(0.03, p.h * 0.95, p.d + 0.02)
          : new THREE.BoxGeometry(p.w + 0.02, p.h * 0.95, 0.03);
        const rib = new THREE.Mesh(ribGeo, ribMat);
        if (isLongX) rib.position.set(p.x + offset, p.h / 2, p.z);
        else rib.position.set(p.x, p.h / 2, p.z + offset);
        this.scene.add(rib);
      }
      // Door outline on front face
      const doorFrame = new THREE.Mesh(new THREE.BoxGeometry(
        isLongX ? 1.2 : p.w + 0.05,
        2.2,
        isLongX ? p.d + 0.05 : 1.2
      ), ribMat);
      doorFrame.position.set(p.x, 1.1, p.z + (isLongX ? p.d / 2 : 0));
      if (!isLongX) doorFrame.position.set(p.x, 1.1, p.z + p.d / 2);
      this.scene.add(doorFrame);
    });
  }

  private buildBarrels() {
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0xaa2222, roughness: 0.4, metalness: 0.6, emissive: 0x330000, emissiveIntensity: 0.3 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.3, metalness: 0.8 });
    const positions = [
      { x: -6, z: -6 }, { x: -5.5, z: -5 }, { x: 6, z: 6 },
      { x: 13, z: -3 }, { x: -13, z: 3 }, { x: 3, z: 15 },
    ];
    positions.forEach((p) => {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 1.2, 16), barrelMat.clone());
      barrel.position.set(p.x, 0.6, p.z);
      barrel.castShadow = true;
      barrel.receiveShadow = true;
      barrel.userData.isBarrel = true;
      this.scene.add(barrel);
      this.collidables.push(barrel);
      this.barrels.push({ mesh: barrel, pos: barrel.position.clone(), exploded: false });
      // Reinforcement rings (top + bottom)
      const ringTop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 16), ringMat);
      ringTop.position.set(p.x, 1.05, p.z); ringTop.rotation.x = Math.PI / 2;
      this.scene.add(ringTop);
      const ringBot = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.03, 6, 16), ringMat);
      ringBot.position.set(p.x, 0.15, p.z); ringBot.rotation.x = Math.PI / 2;
      this.scene.add(ringBot);
      // Hazard cap on top
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0xffaa00, roughness: 0.3, metalness: 0.5, emissive: 0x442200, emissiveIntensity: 0.2 }));
      cap.position.set(p.x, 1.23, p.z);
      this.scene.add(cap);
    });
  }

  private buildAtmosphericLights() {
    // Team-colored accent strips — only 2 total (one per team)
    const orangeLight = new THREE.PointLight(0xf97316, 3.5, 25, 1.5);
    orangeLight.position.set(-22, 3.5, -20);
    this.scene.add(orangeLight);

    const cyanLight = new THREE.PointLight(0x22d3ee, 3.5, 25, 1.5);
    cyanLight.position.set(22, 3.5, -20);
    this.scene.add(cyanLight);

    // Ceiling lights — reduced to 4 key positions, no flicker for perf
    const flickerPositions = [
      { x: 0, z: 0 }, { x: -12, z: -8 }, { x: 12, z: 8 }, { x: 0, z: -12 },
    ];
    flickerPositions.forEach((p) => {
      const light = new THREE.PointLight(0xffeecc, 2.0, 30, 1.0);
      light.position.set(p.x, 4.8, p.z);
      this.scene.add(light);

      // Visible light fixture (no shadow, emissive only)
      const fixture = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.1, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xffeecc })
      );
      fixture.position.set(p.x, 4.9, p.z);
      this.scene.add(fixture);
    });

    // Single tunnel light
    const tunnelLight = new THREE.PointLight(0xffaa44, 1.5, 12, 1.5);
    tunnelLight.position.set(0, -0.2, -10);
    this.scene.add(tunnelLight);
  }

  private buildLightSwitches() {
    const switchPositions = [
      { x: -8, z: -18 }, { x: 8, z: 18 },
    ];
    switchPositions.forEach((p) => {
      const switchLight = new THREE.PointLight(0xffeecc, 2.0, 15, 1.5);
      switchLight.position.set(p.x, 3, p.z);
      this.scene.add(switchLight);

      const switchMesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.4, 0.1),
        new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x444400 })
      );
      switchMesh.position.set(p.x, 1.2, p.z);
      switchMesh.userData.isLightSwitch = true;
      this.scene.add(switchMesh);
      this.collidables.push(switchMesh);
      this.lightSwitches.push({ mesh: switchMesh, light: switchLight, on: true });
    });
  }

  private toggleLightSwitch(pos: THREE.Vector3) {
    const sw = this.lightSwitches.find(s => s.mesh.position.distanceTo(pos) < 2.5);
    if (sw) {
      sw.on = !sw.on;
      sw.light.intensity = sw.on ? 2.0 : 0;
      (sw.mesh.material as THREE.MeshStandardMaterial).emissive.setHex(sw.on ? 0x444400 : 0x000000);
    }
  }

  // ─── WEAPON ───

  private buildMuzzleFlash() {
    const geo = new THREE.PlaneGeometry(0.35, 0.35);
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(255, 255, 200, 1)');
    grad.addColorStop(0.3, 'rgba(255, 160, 40, 0.8)');
    grad.addColorStop(1, 'rgba(255, 80, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.muzzleMesh = new THREE.Mesh(geo, mat);
    this.muzzleMesh.visible = false;
    this.camera.add(this.muzzleMesh);
  }

  private buildWeapon() {
    this.rebuildWeaponModel();
  }

  private buildHand(material: THREE.Material, isRight: boolean): THREE.Group {
    const hand = new THREE.Group();
    const side = isRight ? 1 : -1;

    // Palm
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.07), material);
    palm.position.set(side * 0.01, 0, 0);
    hand.add(palm);

    // Fingers curled around grip
    const fingerGeo = new THREE.BoxGeometry(0.014, 0.034, 0.012);
    const fingerMat = material;
    for (let i = 0; i < 4; i++) {
      const fx = (i - 1.5) * 0.013;
      const finger = new THREE.Mesh(fingerGeo, fingerMat);
      finger.position.set(fx, -0.02, 0.03);
      finger.rotation.x = 0.55;
      hand.add(finger);
      // fingertip
      const tip = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.018, 0.012), fingerMat);
      tip.position.set(fx, -0.01, 0.058);
      tip.rotation.x = 0.15;
      hand.add(tip);
    }

    // Thumb
    const thumbBase = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.03, 0.025), material);
    thumbBase.position.set(side * 0.025, 0.01, 0.02);
    thumbBase.rotation.z = side * 0.4;
    thumbBase.rotation.y = side * 0.25;
    hand.add(thumbBase);
    const thumbTip = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.02, 0.02), material);
    thumbTip.position.set(side * 0.035, 0.015, 0.04);
    thumbTip.rotation.z = side * 0.6;
    hand.add(thumbTip);

    // Wrist + forearm sleeve
    const sleeveMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.8 });
    const wrist = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.1, 8), sleeveMat);
    wrist.position.set(0, -0.01, 0.09);
    wrist.rotation.x = 0.4;
    hand.add(wrist);
    // Forearm segment
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 8), sleeveMat);
    forearm.position.set(side * 0.005, -0.03, 0.2);
    forearm.rotation.x = 0.55;
    hand.add(forearm);
    // Elbow joint
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), sleeveMat);
    elbow.position.set(side * 0.008, -0.04, 0.3);
    hand.add(elbow);

    return hand;
  }

  private rebuildWeaponModel() {
    // Remove old weapon group
    if (this.weaponGroup) {
      this.camera.remove(this.weaponGroup);
      this.weaponGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) child.material.dispose();
        }
      });
    }

    const group = new THREE.Group();
    const key = this.currentWeapon;
    const w = WEAPONS[key];

    // Shared materials
    const blackSteel = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, metalness: 0.9, roughness: 0.2 });
    const darkSteel = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.85, roughness: 0.25 });
    const midSteel = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.35 });
    const polymer = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.3, roughness: 0.6 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4220, metalness: 0.1, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.7, metalness: 0.1 });

    // ── HANDS (visible on all weapons) ──
    // Right hand (trigger hand) — wraps around pistol grip
    const rHand = this.buildHand(gloveMat, true);
    rHand.position.set(-0.055, -0.05, -0.05);
    rHand.rotation.set(-0.25, -0.1, 0.15);

    // Left hand (foregrip hand) — position varies per weapon
    let lHandZ = -0.42;
    let lHandY = -0.02;

    if (key === 'pistol') {
      // ── M9 PISTOL ──
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.22), blackSteel);
      slide.position.set(0, 0.02, -0.14);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.04, 0.14), darkSteel);
      frame.position.set(0, -0.02, -0.1);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8), midSteel);
      barrel.rotation.x = -Math.PI / 2;
      barrel.position.set(0, 0.03, -0.26);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.16, 0.07), polymer);
      grip.position.set(0, -0.1, -0.05);
      grip.rotation.x = -0.15;
      const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.004, 4, 8, Math.PI), darkSteel);
      trigger.position.set(0, -0.04, -0.08);
      trigger.rotation.x = Math.PI / 2;
      const sightF = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.015, 0.01), darkSteel);
      sightF.position.set(0, 0.06, -0.24);
      const sightR = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.02, 0.015), darkSteel);
      sightR.position.set(0, 0.06, -0.05);
      // Pistol: left hand supports from below
      lHandZ = -0.12;
      lHandY = -0.08;
      group.add(slide, frame, barrel, grip, trigger, sightF, sightR);
    } else if (key === 'shotgun') {
      // ── REMINGTON 870 SHOTGUN ──
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.2), blackSteel);
      receiver.position.set(0, 0.02, -0.18);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.55, 12), darkSteel);
      barrel.rotation.x = -Math.PI / 2;
      barrel.position.set(0, 0.05, -0.5);
      // Magazine tube
      const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.4, 8), midSteel);
      magTube.rotation.x = -Math.PI / 2;
      magTube.position.set(0, -0.01, -0.45);
      // Wooden pump
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.12, 10), woodMat);
      pump.rotation.x = -Math.PI / 2;
      pump.position.set(0, 0.0, -0.38);
      // Wooden stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.22), woodMat);
      stock.position.set(0, -0.02, 0.02);
      const stockGrip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.14, 0.06), woodMat);
      stockGrip.position.set(0, -0.08, -0.06);
      stockGrip.rotation.x = -0.2;
      // Bead sight
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), midSteel);
      bead.position.set(0, 0.08, -0.72);
      lHandZ = -0.38;
      lHandY = 0.0;
      group.add(receiver, barrel, magTube, pump, stock, stockGrip, bead);
    } else if (key === 'rifle') {
      // ── AK-74 ASSAULT RIFLE ──
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.26), blackSteel);
      receiver.position.set(0, 0.02, -0.2);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.016, 0.4, 12), darkSteel);
      barrel.rotation.x = -Math.PI / 2;
      barrel.position.set(0, 0.04, -0.5);
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.07, 0.18), woodMat);
      handguard.position.set(0, 0.02, -0.38);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.18, 0.08), polymer);
      mag.position.set(0, -0.1, -0.22);
      mag.rotation.x = 0.1;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), polymer);
      grip.position.set(0, -0.06, -0.08);
      grip.rotation.x = -0.25;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.22), woodMat);
      stock.position.set(0, 0.03, 0.1);
      const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 0.06, 8), midSteel);
      flashHider.rotation.x = -Math.PI / 2;
      flashHider.position.set(0, 0.04, -0.7);
      lHandZ = -0.38;
      lHandY = 0.0;
      group.add(receiver, barrel, handguard, mag, grip, stock, flashHider);
    } else if (key === 'sniper') {
      // ── M82 BARRETT SNIPER ──
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.35), blackSteel);
      receiver.position.set(0, 0.02, -0.22);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.55, 12), darkSteel);
      barrel.rotation.x = -Math.PI / 2;
      barrel.position.set(0, 0.04, -0.6);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.06), polymer);
      mag.position.set(0, -0.08, -0.22);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), polymer);
      grip.position.set(0, -0.06, -0.08);
      grip.rotation.x = -0.25;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.28), polymer);
      stock.position.set(0, 0.04, 0.14);
      const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.16), polymer);
      cheekRest.position.set(0, 0.09, 0.12);
      // Large scope
      const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 12), blackSteel);
      scopeBody.rotation.x = -Math.PI / 2;
      scopeBody.position.set(0, 0.1, -0.22);
      const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.02, 12), new THREE.MeshBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.6 }));
      scopeLens.position.set(0, 0.1, -0.32);
      scopeLens.rotation.y = Math.PI;
      const muzzleBrake = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.08, 8), midSteel);
      muzzleBrake.rotation.x = -Math.PI / 2;
      muzzleBrake.position.set(0, 0.04, -0.88);
      lHandZ = -0.5;
      lHandY = 0.02;
      group.add(receiver, barrel, mag, grip, stock, cheekRest, scopeBody, scopeLens, muzzleBrake);
    } else if (key === 'dmr') {
      // ── MK14 EBR DMR ──
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.3), blackSteel);
      receiver.position.set(0, 0.02, -0.22);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.45, 12), darkSteel);
      barrel.rotation.x = -Math.PI / 2;
      barrel.position.set(0, 0.04, -0.55);
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.2), polymer);
      handguard.position.set(0, 0.02, -0.42);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.07), polymer);
      mag.position.set(0, -0.09, -0.22);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), polymer);
      grip.position.set(0, -0.06, -0.08);
      grip.rotation.x = -0.25;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.24), polymer);
      stock.position.set(0, 0.03, 0.12);
      // Medium scope
      const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 12), blackSteel);
      scopeBody.rotation.x = -Math.PI / 2;
      scopeBody.position.set(0, 0.09, -0.22);
      const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.018, 12), new THREE.MeshBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.5 }));
      scopeLens.position.set(0, 0.09, -0.3);
      scopeLens.rotation.y = Math.PI;
      lHandZ = -0.42;
      lHandY = 0.0;
      group.add(receiver, barrel, handguard, mag, grip, stock, scopeBody, scopeLens);
    } else if (key === 'lmg') {
      // ── M249 SAW LMG ──
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.32), blackSteel);
      receiver.position.set(0, 0.02, -0.22);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.5, 12), darkSteel);
      barrel.rotation.x = -Math.PI / 2;
      barrel.position.set(0, 0.04, -0.58);
      const heatShield = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.2), midSteel);
      heatShield.position.set(0, 0.05, -0.42);
      // Box magazine
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.12), polymer);
      mag.position.set(0, -0.08, -0.22);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), polymer);
      grip.position.set(0, -0.06, -0.08);
      grip.rotation.x = -0.25;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.2), polymer);
      stock.position.set(0, 0.03, 0.1);
      const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4), midSteel);
      bipodL.position.set(-0.05, -0.08, -0.6); bipodL.rotation.z = 0.4;
      const bipodR = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4), midSteel);
      bipodR.position.set(0.05, -0.08, -0.6); bipodR.rotation.z = -0.4;
      lHandZ = -0.45;
      lHandY = 0.0;
      group.add(receiver, barrel, heatShield, mag, grip, stock, bipodL, bipodR);
    } else if (key === 'launcher') {
      // ── M32 GRENADE LAUNCHER ──
      const receiver = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.3, 12), blackSteel);
      receiver.rotation.x = -Math.PI / 2;
      receiver.position.set(0, 0.02, -0.2);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.25, 12), darkSteel);
      barrel.rotation.x = -Math.PI / 2;
      barrel.position.set(0, 0.02, -0.48);
      // Revolving cylinder
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 6), midSteel);
      cyl.rotation.z = Math.PI / 2;
      cyl.position.set(0, -0.02, -0.32);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.14, 0.05), polymer);
      grip.position.set(0, -0.08, -0.08);
      grip.rotation.x = -0.3;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.18), polymer);
      stock.position.set(0, 0.03, 0.08);
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.02), darkSteel);
      sight.position.set(0, 0.08, -0.2);
      lHandZ = -0.38;
      lHandY = -0.02;
      group.add(receiver, barrel, cyl, grip, stock, sight);
    } else if (key === 'plasma') {
      // ── X-ION REPEATER PLASMA ──
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.28), new THREE.MeshStandardMaterial({ color: 0x1a1a3a, metalness: 0.8, roughness: 0.3, emissive: 0x220044, emissiveIntensity: 0.3 }));
      receiver.position.set(0, 0.02, -0.2);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.35, 12), new THREE.MeshStandardMaterial({ color: 0x2a2a4a, metalness: 0.7, roughness: 0.3, emissive: 0xff00ff, emissiveIntensity: 0.2 }));
      barrel.rotation.x = -Math.PI / 2;
      barrel.position.set(0, 0.04, -0.5);
      // Energy cell magazine
      const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x3a0055, metalness: 0.5, roughness: 0.4, emissive: 0xaa00ff, emissiveIntensity: 0.4 }));
      mag.position.set(0, -0.08, -0.22);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.6 }));
      grip.position.set(0, -0.06, -0.08);
      grip.rotation.x = -0.25;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.16), new THREE.MeshStandardMaterial({ color: 0x1a1a2a, roughness: 0.6 }));
      stock.position.set(0, 0.03, 0.08);
      // Glowing energy core
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 8), new THREE.MeshBasicMaterial({ color: 0xff00ff }));
      core.position.set(0, 0.06, -0.32);
      lHandZ = -0.42;
      lHandY = 0.0;
      group.add(receiver, barrel, mag, grip, stock, core);
    } else {
      // ── MP5 SMG (default) ──
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.28), blackSteel);
      receiver.position.set(0, 0.02, -0.2);
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.35, 12), darkSteel);
      barrel.rotation.x = -Math.PI / 2;
      barrel.position.set(0, 0.04, -0.5);
      // Handguard / foregrip
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 0.16), polymer);
      handguard.position.set(0, 0.02, -0.42);
      // Curved magazine
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.16, 0.07), polymer);
      mag.position.set(0, -0.08, -0.22);
      mag.rotation.x = 0.12;
      // Pistol grip
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, 0.05), polymer);
      grip.position.set(0, -0.06, -0.08);
      grip.rotation.x = -0.25;
      // Collapsible stock
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.18), polymer);
      stock.position.set(0, 0.03, 0.08);
      // Charging handle
      const charge = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.05, 6), midSteel);
      charge.rotation.z = Math.PI / 2;
      charge.position.set(0.04, 0.07, -0.18);
      // Rail with red dot
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.12), darkSteel);
      rail.position.set(0, 0.08, -0.2);
      const redDot = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.03, 0.04), blackSteel);
      redDot.position.set(0, 0.1, -0.2);
      const dotLens = new THREE.Mesh(new THREE.CircleGeometry(0.008, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      dotLens.position.set(0, 0.1, -0.18);
      // Suppressor
      const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 12), darkSteel);
      suppressor.rotation.x = -Math.PI / 2;
      suppressor.position.set(0, 0.04, -0.68);
      lHandZ = -0.42;
      lHandY = 0.02;
      group.add(receiver, barrel, handguard, mag, grip, stock, charge, rail, redDot, dotLens, suppressor);
    }

    // Left hand (foregrip)
    const lHand = this.buildHand(gloveMat, false);
    lHand.position.set(0.055, lHandY + 0.02, lHandZ);
    lHand.rotation.set(-0.2, 0.1, -0.1);

    group.add(rHand, lHand);

    // Position weapon in view — more centered for realistic ADS
    const adsX = this.isADS ? 0 : 0.16;
    const adsY = this.isADS ? -0.09 : -0.19;
    group.position.set(adsX, adsY, -0.32);
    group.rotation.set(0, this.isADS ? 0 : 0.06, -0.04);
    this.camera.add(group);
    this.weaponGroup = group;
  }

  private buildFlashlight() {
    const spot = new THREE.SpotLight(0xfff4e5, 4, 30, Math.PI / 5, 0.6, 1.5);
    spot.position.set(0.2, -0.2, 0.3);
    spot.target.position.set(0, 0, -10);
    spot.castShadow = false;
    spot.shadow.mapSize.width = 1024;
    spot.shadow.mapSize.height = 1024;
    spot.shadow.bias = -0.0001;
    this.camera.add(spot);
    this.camera.add(spot.target);
    this.flashlight = spot;
  }

  // ─── ENEMIES ───

  private createHealthBar(): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 64, 8);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(2, 2, 60, 4);

    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.8, 0.12, 1);
    sprite.position.set(0, 1.5, 0);
    return sprite;
  }

  private buildEnemyWeapon(type: EnemyType): THREE.Group {
    const group = new THREE.Group();
    const darkMetal = new THREE.MeshStandardMaterial({ color: 0x0e0e0e, metalness: 0.9, roughness: 0.2 });
    const midMetal = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.8, roughness: 0.3 });
    const lightMetal = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.7, roughness: 0.35 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.65, metalness: 0.15 });
    const polymerMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.3, roughness: 0.6 });

    if (type === 'shotgunner') {
      // Shotgun: long barrel + pump + wooden stock + bead sight
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.72, 12), darkMetal);
      barrel.rotation.x = -Math.PI / 2; barrel.position.z = 0.38;
      const magTube = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.5, 8), midMetal);
      magTube.rotation.x = -Math.PI / 2; magTube.position.set(0, -0.025, 0.35);
      const pump = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 10), woodMat);
      pump.rotation.x = -Math.PI / 2; pump.position.set(0, -0.01, 0.22);
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.2), darkMetal);
      receiver.position.set(0, 0, 0.05);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.22), woodMat);
      stock.position.set(0, -0.03, -0.14); stock.rotation.x = 0.08;
      const stockGrip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.13, 0.05), woodMat);
      stockGrip.position.set(0, -0.08, -0.02); stockGrip.rotation.x = -0.2;
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), lightMetal);
      bead.position.set(0, 0.04, 0.72);
      group.add(barrel, magTube, pump, receiver, stock, stockGrip, bead);
    } else if (type === 'heavy') {
      // LMG: big receiver + thick barrel + ammo box + carry handle
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.32), darkMetal);
      receiver.position.z = 0.06;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.6, 10), midMetal);
      barrel.rotation.x = -Math.PI / 2; barrel.position.set(0, 0.03, 0.45);
      const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.06, 8), darkMetal);
      flashHider.rotation.x = -Math.PI / 2; flashHider.position.set(0, 0.03, 0.72);
      const ammoBox = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.14), new THREE.MeshStandardMaterial({ color: 0x3a5a2a, roughness: 0.7 }));
      ammoBox.position.set(0, -0.09, 0.06);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.11, 0.2), polymerMat);
      stock.position.set(0, -0.01, -0.16);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.11, 0.05), polymerMat);
      grip.position.set(0, -0.09, -0.05); grip.rotation.x = -0.3;
      const carryHandle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 4, 8, Math.PI), midMetal);
      carryHandle.position.set(0, 0.1, 0.08); carryHandle.rotation.x = Math.PI / 2;
      group.add(receiver, barrel, flashHider, ammoBox, stock, grip, carryHandle);
    } else if (type === 'sniper') {
      // Sniper rifle: long barrel + scope + bipod + suppressor
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.3), darkMetal);
      receiver.position.z = 0.0;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 0.65, 10), midMetal);
      barrel.rotation.x = -Math.PI / 2; barrel.position.set(0, 0.02, 0.45);
      const suppressor = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.15, 12), darkMetal);
      suppressor.rotation.x = -Math.PI / 2; suppressor.position.set(0, 0.02, 0.72);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.13, 0.28), new THREE.MeshStandardMaterial({ color: 0x2a2a1a, roughness: 0.5 }));
      stock.position.set(0, -0.03, -0.2); stock.rotation.x = 0.05;
      const cheekRest = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.15), polymerMat);
      cheekRest.position.set(0, 0.04, -0.15);
      // Scope
      const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.18, 10), darkMetal);
      scopeBody.rotation.x = -Math.PI / 2; scopeBody.position.set(0, 0.09, 0.02);
      const scopeRing1 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.02, 10), midMetal);
      scopeRing1.rotation.x = -Math.PI / 2; scopeRing1.position.set(0, 0.09, -0.04);
      const scopeRing2 = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.02, 10), midMetal);
      scopeRing2.rotation.x = -Math.PI / 2; scopeRing2.position.set(0, 0.09, 0.08);
      const scopeLens = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
      scopeLens.position.set(0, 0.09, 0.11); scopeLens.rotation.y = Math.PI;
      // Bipod
      const bipodL = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4), midMetal);
      bipodL.position.set(-0.05, -0.09, 0.38); bipodL.rotation.z = 0.4;
      const bipodR = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 4), midMetal);
      bipodR.position.set(0.05, -0.09, 0.38); bipodR.rotation.z = -0.4;
      group.add(receiver, barrel, suppressor, stock, cheekRest, scopeBody, scopeRing1, scopeRing2, scopeLens, bipodL, bipodR);
    } else {
      // Assault rifle (grunt + rifleman): receiver + barrel + handguard + mag + grip + stock + red dot + flash hider
      const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.24), darkMetal);
      receiver.position.z = 0.0;
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.42, 10), midMetal);
      barrel.rotation.x = -Math.PI / 2; barrel.position.set(0, 0.03, 0.32);
      const flashHider = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 8), darkMetal);
      flashHider.rotation.x = -Math.PI / 2; flashHider.position.set(0, 0.03, 0.52);
      const handguard = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.055, 0.2), midMetal);
      handguard.position.set(0, 0.02, 0.22);
      const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.18), darkMetal);
      railTop.position.set(0, 0.055, 0.18);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.18, 0.07), polymerMat);
      mag.position.set(0, -0.11, 0.02); mag.rotation.x = 0.12;
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.045), polymerMat);
      grip.position.set(0, -0.08, -0.08); grip.rotation.x = -0.25;
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.07, 0.18), polymerMat);
      stock.position.set(0, 0.02, -0.18);
      const trigger = new THREE.Mesh(new THREE.TorusGeometry(0.01, 0.003, 4, 6, Math.PI), midMetal);
      trigger.position.set(0, -0.04, -0.04); trigger.rotation.x = Math.PI / 2;
      // Red dot sight
      const sightBase = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.05), midMetal);
      sightBase.position.set(0, 0.07, 0.0);
      const sightDot = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
      sightDot.position.set(0, 0.085, 0.0);
      group.add(receiver, barrel, flashHider, handguard, railTop, mag, grip, stock, trigger, sightBase, sightDot);
    }

    return group;
  }

  private buildEnemyModel(type: EnemyType): THREE.Group {
    const group = new THREE.Group();
    const cfg = ENEMY_CONFIG[type];
    const s = cfg.scale;

    // Materials — more realistic military colors
    const uniformMat = new THREE.MeshStandardMaterial({ color: cfg.color, roughness: 0.65, metalness: 0.25 });
    const vestMat = new THREE.MeshStandardMaterial({ color: 0x15150f, roughness: 0.45, metalness: 0.55 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x9a7a5a, roughness: 0.85 });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x1a1a14, roughness: 0.35, metalness: 0.65 });
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x0a0a08, roughness: 0.6, metalness: 0.15 });
    const gearMat = new THREE.MeshStandardMaterial({ color: 0x2a2a1a, roughness: 0.7, metalness: 0.25 });
    const gloveMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.1 });
    const beltMat = new THREE.MeshStandardMaterial({ color: 0x1a1a10, roughness: 0.5, metalness: 0.3 });

    const allMeshes: THREE.Mesh[] = [];

    // ── HEAD + NECK ──
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.08 * s, 0.08 * s, 6), skinMat);
    neck.position.y = 1.5 * s;
    allMeshes.push(neck);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 14, 12), skinMat);
    head.position.y = 1.62 * s;
    head.userData.isHead = true;
    allMeshes.push(head);

    // Type-specific headgear
    if (type === 'heavy') {
      // Heavy: full ballistic helmet with face shield
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.7), helmetMat);
      helmet.position.y = 1.68 * s;
      helmet.userData.isHead = true;
      allMeshes.push(helmet);
      // Face shield
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * s, 0.14 * s, 0.1 * s, 12, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, transparent: true, opacity: 0.6, metalness: 0.8, roughness: 0.2 }));
      shield.position.set(0, 1.58 * s, 0.08 * s);
      shield.userData.isHead = true;
      allMeshes.push(shield);
    } else if (type === 'sniper') {
      // Sniper: ghillie hood
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.18 * s, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2a3a1a, roughness: 1.0, transparent: true, opacity: 0.85 }));
      hood.position.y = 1.65 * s;
      hood.userData.isHead = true;
      allMeshes.push(hood);
      // Ghillie strands
      for (let i = 0; i < 6; i++) {
        const strand = new THREE.Mesh(new THREE.ConeGeometry(0.02 * s, 0.08 * s, 4), new THREE.MeshStandardMaterial({ color: 0x1a2a0a, roughness: 1.0 }));
        strand.position.set((Math.random() - 0.5) * 0.3 * s, 1.7 * s + Math.random() * 0.1, (Math.random() - 0.5) * 0.3 * s);
        strand.rotation.set(Math.random() * 0.3, Math.random() * Math.PI, Math.random() * 0.3);
        allMeshes.push(strand);
      }
    } else if (type === 'grunt' || type === 'rifleman') {
      // Combat helmet with rim
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), helmetMat);
      helmet.position.y = 1.68 * s;
      helmet.userData.isHead = true;
      allMeshes.push(helmet);
      const helmetRim = new THREE.Mesh(new THREE.TorusGeometry(0.15 * s, 0.018 * s, 4, 14), helmetMat);
      helmetRim.position.y = 1.62 * s; helmetRim.rotation.x = Math.PI / 2;
      allMeshes.push(helmetRim);
      // NVG mount
      const nvg = new THREE.Mesh(new THREE.BoxGeometry(0.04 * s, 0.03 * s, 0.04 * s), gearMat);
      nvg.position.set(0, 1.7 * s, 0.14 * s);
      allMeshes.push(nvg);
    } else {
      // Shotgunner: beanie cap
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.15 * s, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2.5), new THREE.MeshStandardMaterial({ color: 0x1a1a14, roughness: 0.8 }));
      cap.position.y = 1.66 * s;
      cap.userData.isHead = true;
      allMeshes.push(cap);
    }

    // Visor / glowing eyes (all types)
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.04 * s, 0.03 * s), new THREE.MeshBasicMaterial({ color: cfg.visorColor }));
    visor.position.set(0, 1.6 * s, 0.12 * s);
    allMeshes.push(visor);

    // ── TORSO / VEST ──
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.4 * s, 0.52 * s, 0.24 * s), uniformMat);
    torso.position.y = 1.15 * s;
    allMeshes.push(torso);

    // Tactical vest — plate carrier
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.36 * s, 0.42 * s, 0.05 * s), vestMat);
    vest.position.set(0, 1.15 * s, 0.13 * s);
    allMeshes.push(vest);

    // Vest pouches (2 chest + 2 waist)
    for (let i = 0; i < 4; i++) {
      const px = (i % 2 === 0 ? -1 : 1) * (0.1 + (i < 2 ? 0 : 0.06)) * s;
      const py = (i < 2 ? 1.22 : 0.98) * s;
      const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.09 * s, 0.1 * s, 0.05 * s), gearMat);
      pouch.position.set(px, py, 0.15 * s);
      allMeshes.push(pouch);
    }

    // Backpack
    const backpack = new THREE.Mesh(new THREE.BoxGeometry(0.28 * s, 0.38 * s, 0.16 * s), gearMat);
    backpack.position.set(0, 1.1 * s, -0.16 * s);
    allMeshes.push(backpack);

    // Ammo belt around waist
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.2 * s, 0.03 * s, 4, 16), beltMat);
    belt.position.y = 0.88 * s; belt.rotation.x = Math.PI / 2;
    allMeshes.push(belt);

    // ── ARMS (posed gripping weapon) ──
    // Right arm (trigger hand) — reaches down to grip
    const upperArmR = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.05 * s, 0.28 * s, 8), uniformMat);
    upperArmR.position.set(0.24 * s, 1.2 * s, 0.04 * s); upperArmR.rotation.z = -0.2; upperArmR.rotation.x = -0.15;
    allMeshes.push(upperArmR);
    const elbowR = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 6, 6), uniformMat);
    elbowR.position.set(0.18 * s, 1.0 * s, 0.1 * s);
    allMeshes.push(elbowR);
    const forearmR = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.04 * s, 0.26 * s, 8), uniformMat);
    forearmR.position.set(0.1 * s, 0.88 * s, 0.22 * s); forearmR.rotation.x = -1.1; forearmR.rotation.z = -0.15;
    allMeshes.push(forearmR);
    const handR = this.buildHand(gloveMat, true);
    handR.scale.setScalar(s * 1.2);
    handR.position.set(0.04 * s, 0.82 * s, 0.34 * s);
    handR.rotation.x = -1.2;

    // Left arm (foregrip hand) — reaches forward
    const upperArmL = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.05 * s, 0.28 * s, 8), uniformMat);
    upperArmL.position.set(-0.24 * s, 1.2 * s, 0.04 * s); upperArmL.rotation.z = 0.2; upperArmL.rotation.x = -0.15;
    allMeshes.push(upperArmL);
    const elbowL = new THREE.Mesh(new THREE.SphereGeometry(0.055 * s, 6, 6), uniformMat);
    elbowL.position.set(-0.18 * s, 1.0 * s, 0.1 * s);
    allMeshes.push(elbowL);
    const forearmL = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * s, 0.04 * s, 0.26 * s, 8), uniformMat);
    forearmL.position.set(-0.1 * s, 0.88 * s, 0.22 * s); forearmL.rotation.x = -1.1; forearmL.rotation.z = 0.15;
    allMeshes.push(forearmL);
    const handL = this.buildHand(gloveMat, false);
    handL.scale.setScalar(s * 1.2);
    handL.position.set(-0.04 * s, 0.82 * s, 0.34 * s);
    handL.rotation.x = -1.2;

    // Shoulder pads
    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 8, 6), vestMat);
    shoulderL.position.set(-0.22 * s, 1.36 * s, 0);
    allMeshes.push(shoulderL);
    const shoulderR = new THREE.Mesh(new THREE.SphereGeometry(0.09 * s, 8, 6), vestMat);
    shoulderR.position.set(0.22 * s, 1.36 * s, 0);
    allMeshes.push(shoulderR);

    // ── LEGS ──
    // Left leg
    const upperLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.085 * s, 0.065 * s, 0.4 * s, 8), uniformMat);
    upperLegL.position.set(-0.11 * s, 0.65 * s, 0);
    allMeshes.push(upperLegL);
    const kneePadL = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.08 * s, 0.08 * s), vestMat);
    kneePadL.position.set(-0.11 * s, 0.46 * s, 0.04 * s);
    allMeshes.push(kneePadL);
    const lowerLegL = new THREE.Mesh(new THREE.CylinderGeometry(0.065 * s, 0.045 * s, 0.38 * s, 8), uniformMat);
    lowerLegL.position.set(-0.11 * s, 0.22 * s, 0);
    allMeshes.push(lowerLegL);
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.07 * s, 0.22 * s), bootMat);
    bootL.position.set(-0.11 * s, 0.035 * s, 0.03 * s);
    allMeshes.push(bootL);

    // Right leg
    const upperLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.085 * s, 0.065 * s, 0.4 * s, 8), uniformMat);
    upperLegR.position.set(0.11 * s, 0.65 * s, 0);
    allMeshes.push(upperLegR);
    const kneePadR = new THREE.Mesh(new THREE.BoxGeometry(0.1 * s, 0.08 * s, 0.08 * s), vestMat);
    kneePadR.position.set(0.11 * s, 0.46 * s, 0.04 * s);
    allMeshes.push(kneePadR);
    const lowerLegR = new THREE.Mesh(new THREE.CylinderGeometry(0.065 * s, 0.045 * s, 0.38 * s, 8), uniformMat);
    lowerLegR.position.set(0.11 * s, 0.22 * s, 0);
    allMeshes.push(lowerLegR);
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, 0.07 * s, 0.22 * s), bootMat);
    bootR.position.set(0.11 * s, 0.035 * s, 0.03 * s);
    allMeshes.push(bootR);

    // ── WEAPON (held in hands) ──
    const weapon = this.buildEnemyWeapon(type);
    weapon.position.set(0, 0.82 * s, 0.34 * s);
    weapon.traverse((child) => {
      if (child instanceof THREE.Mesh) { allMeshes.push(child); }
    });

    // ── TYPE-SPECIFIC EXTRAS ──
    if (type === 'heavy') {
      // Extra chest armor plate
      const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.46 * s, 0.36 * s, 0.06 * s), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.25, metalness: 0.8 }));
      chestPlate.position.set(0, 1.15 * s, 0.16 * s);
      allMeshes.push(chestPlate);
      // Neck guard
      const neckGuard = new THREE.Mesh(new THREE.BoxGeometry(0.18 * s, 0.08 * s, 0.08 * s), vestMat);
      neckGuard.position.set(0, 1.44 * s, -0.02 * s);
      allMeshes.push(neckGuard);
      // Thigh holsters
      const holsterL = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.15 * s, 0.05 * s), gearMat);
      holsterL.position.set(-0.16 * s, 0.55 * s, 0.02 * s);
      allMeshes.push(holsterL);
      const holsterR = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.15 * s, 0.05 * s), gearMat);
      holsterR.position.set(0.16 * s, 0.55 * s, 0.02 * s);
      allMeshes.push(holsterR);
    }

    if (type === 'sniper') {
      // Ghillie suit overlay on torso
      const ghillie = new THREE.Mesh(new THREE.SphereGeometry(0.32 * s, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2a3a1a, roughness: 1.0, transparent: true, opacity: 0.65 }));
      ghillie.position.y = 1.1 * s;
      allMeshes.push(ghillie);
      // Ghillie strands on body
      for (let i = 0; i < 8; i++) {
        const strand = new THREE.Mesh(new THREE.ConeGeometry(0.015 * s, 0.06 * s, 4), new THREE.MeshStandardMaterial({ color: 0x1a2a0a, roughness: 1.0 }));
        strand.position.set((Math.random() - 0.5) * 0.35 * s, 1.0 * s + Math.random() * 0.4 * s, (Math.random() - 0.5) * 0.25 * s);
        strand.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
        allMeshes.push(strand);
      }
    }

    if (type === 'shotgunner') {
      // Bandolier with shells across chest
      const bandolier = new THREE.Mesh(new THREE.TorusGeometry(0.22 * s, 0.02 * s, 4, 16, Math.PI), gearMat);
      bandolier.position.set(0, 1.2 * s, 0.12 * s);
      bandolier.rotation.x = Math.PI / 2 + 0.3;
      bandolier.rotation.z = 0.4;
      allMeshes.push(bandolier);
      // Red shotgun shells on bandolier
      for (let i = 0; i < 6; i++) {
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * s, 0.012 * s, 0.04 * s, 5), new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.4 }));
        const angle = (i / 6) * Math.PI;
        shell.position.set(Math.cos(angle) * 0.22 * s, 1.2 * s + Math.sin(angle) * 0.1 * s, 0.14 * s);
        shell.rotation.z = angle + Math.PI / 2;
        allMeshes.push(shell);
      }
    }

    if (type === 'rifleman') {
      // Extra ammo pouches on belt
      for (let i = 0; i < 3; i++) {
        const pouch = new THREE.Mesh(new THREE.BoxGeometry(0.06 * s, 0.08 * s, 0.04 * s), gearMat);
        pouch.position.set(-0.1 * s + i * 0.08 * s, 0.82 * s, 0.13 * s);
        allMeshes.push(pouch);
      }
      // Radio on back
      const radio = new THREE.Mesh(new THREE.BoxGeometry(0.08 * s, 0.1 * s, 0.04 * s), new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.4, metalness: 0.5 }));
      radio.position.set(0.12 * s, 1.2 * s, -0.14 * s);
      allMeshes.push(radio);
    }

    // Add all meshes to group — no castShadow for perf
    allMeshes.forEach((m) => { m.castShadow = false; group.add(m); });
    // Add hand groups (their child meshes are registered for hit detection below)
    group.add(handR, handL);
    handR.traverse((child) => { if (child instanceof THREE.Mesh) { child.castShadow = false; allMeshes.push(child); } });
    handL.traverse((child) => { if (child instanceof THREE.Mesh) { child.castShadow = false; allMeshes.push(child); } });
    group.add(weapon);

    // Store meshes for hit detection
    group.userData.meshes = allMeshes;
    group.userData.headMesh = head;

    return group;
  }

  private spawnEnemies() {
    this.isBossWave = this.wave % 5 === 0;
    this.waveStartTime = performance.now();
    this.waveDamageTaken = 0;
    this.waveHeadshots = 0;
    // Apply wave modifier
    this.currentWaveModifier = getWaveModifier(this.wave);
    this.isEliteWave = !this.isBossWave && this.wave >= 3 && this.wave % 3 === 0;
    if (this.currentWaveModifier) {
      this.events.onWaveModifier?.(this.currentWaveModifier);
      // Apply fog of war
      if (this.currentWaveModifier.type === 'fogOfWar') {
        this.scene.fog = new THREE.FogExp2(this.mapConfig.fogColor, 0.06);
      } else {
        this.scene.fog = new THREE.FogExp2(this.mapConfig.fogColor, this.mapConfig.fogDensity);
      }
    } else {
      this.scene.fog = new THREE.FogExp2(this.mapConfig.fogColor, this.mapConfig.fogDensity);
    }
    const types: EnemyType[] = this.getWaveComposition(this.wave);
    // Boss wave: spawn boss + fewer adds
    if (this.isBossWave) {
      types.unshift('boss');
    }
    types.forEach((type, i) => {
      const group = this.buildEnemyModel(type);
      const angle = (i / types.length) * Math.PI * 2;
      const radius = 15 + Math.random() * 5;
      const pos = new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      if (type === 'sniper') { pos.y = 4; pos.x = Math.sign(pos.x) * 18; }
      group.position.copy(pos);
      this.scene.add(group);

      const hpBar = this.createHealthBar();
      group.add(hpBar);

      const meshes = (group.userData.meshes as THREE.Mesh[]) || [group.children[0] as THREE.Mesh];
      const headMesh = (group.userData.headMesh as THREE.Mesh) || meshes[0];
      const cfg = ENEMY_CONFIG[type];
      const isBoss = type === 'boss';
      const isMiniBoss = !isBoss && this.wave % 5 === 0 && i === 1;
      // Elite enemy: 1-2 per wave on elite waves, not on boss waves
      const isElite = !isBoss && !isMiniBoss && this.isEliteWave && (i === 0 || i === Math.floor(types.length / 2));
      const hpMult = isBoss ? 1 : isMiniBoss ? 3 : isElite ? 2 : 1;
      const enemy: Enemy = {
        group, meshes, headMesh, hpBar,
        hp: Math.round(cfg.hp * hpMult * this.difficultyMult), maxHp: Math.round(cfg.hp * hpMult * this.difficultyMult), type,
        state: 'patrol', stateTimer: 0,
        strafeDir: Math.random() > 0.5 ? 1 : -1,
        hitFlash: 0, dead: false, deathTimer: 0, lastShot: 0,
        patrolTarget: new THREE.Vector3((Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30),
        speed: cfg.speed * (0.8 + this.difficultyMult * 0.3) * (this.currentWaveModifier?.type === 'fastEnemies' ? 1.4 : 1), damage: Math.round((isBoss ? cfg.damage : isMiniBoss ? cfg.damage * 1.5 : isElite ? cfg.damage * 1.3 : cfg.damage) * this.difficultyMult * (this.currentWaveModifier?.type === 'enemyEnrage' ? 1.5 : 1)), fireRate: Math.round(cfg.fireRate / this.difficultyMult), optimalRange: cfg.range,
        coverPos: null, isMiniBoss, reviveTimer: 0, downed: false, footstepTimer: 0, lastKnownPlayerPos: null,
        losCheckTimer: 0, hasLOS: false,
        deathDir: null, isBoss, enraged: false, weakSpotHit: false, isElite,
      };
      if (isBoss) {
        group.scale.multiplyScalar(cfg.scale);
        this.bossEnemy = enemy;
        this.events.onBossWave?.('WARLORD');
      } else if (isMiniBoss) {
        group.scale.multiplyScalar(1.5);
      } else if (isElite) {
        group.scale.multiplyScalar(1.25);
        // Tint elite enemies with a purple glow
        meshes.forEach(m => {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat && mat.emissive) {
            mat.emissive.setHex(0x6b21a8);
            mat.emissiveIntensity = 0.4;
          }
        });
      }
      this.enemies.push(enemy);
    });
  }

  private getWaveComposition(wave: number): EnemyType[] {
    const base: EnemyType[] = ['grunt', 'grunt', 'rifleman'];
    if (wave >= 2) base.push('shotgunner');
    if (wave >= 3) base.push('heavy');
    if (wave >= 4) base.push('sniper');
    if (wave >= 5) base.push('grunt', 'rifleman');
    if (wave >= 6) base.push('charger');
    if (wave >= 7) base.push('heavy', 'sniper');
    if (wave >= 8) base.push('bomber');
    if (wave >= 9) base.push('medic');
    if (wave >= 10) base.push('grunt', 'rifleman', 'shotgunner', 'charger');
    if (wave >= 12) base.push('bomber', 'medic', 'charger');
    // Mini-boss wave every 5th wave — first enemy is a boss
    if (wave % 5 === 0) base.unshift('heavy');
    // Apply map-specific enemy bias — duplicate biased types to increase their frequency
    const bias = this.mapConfig.enemyBias;
    for (const [type, weight] of Object.entries(bias)) {
      const t = type as EnemyType;
      const extra = Math.round((weight || 1) - 1);
      for (let i = 0; i < extra; i++) base.push(t);
    }
    return base;
  }

  private updateWaves(dt: number) {
    // Update objective
    this.updateObjective(dt);

    const aliveCount = this.enemies.filter((e) => !e.dead).length;
    if (aliveCount === 0) {
      this.waveSpawnTimer += dt;
      if (this.waveSpawnTimer > 3) {
        // Track previous wave clear time for difficulty
        if (this.waveStartTime > 0) {
          const clearTime = (performance.now() - this.waveStartTime) / 1000;
          this.waveClearTimes.push(clearTime);
          if (this.waveClearTimes.length > 5) this.waveClearTimes.shift();
          // Adjust difficulty: fast clears + low damage taken = harder
          const avgClear = this.waveClearTimes.reduce((a, b) => a + b, 0) / this.waveClearTimes.length;
          const kd = this.stats.kills / Math.max(1, this.damageTaken / 50);
          if (avgClear < 20 && this.damageTaken < 100) this.difficultyMult = Math.min(2.0, this.difficultyMult + 0.15);
          else if (avgClear > 45 || this.damageTaken > 300) this.difficultyMult = Math.max(0.7, this.difficultyMult - 0.1);

          // Wave bonuses
          const waveKills = this.waveKillCount;
          // No-damage bonus
          if (this.waveDamageTaken === 0) {
            this.score += 500;
            this.events.onWaveBonus?.({ text: 'NO DAMAGE BONUS', score: 500 });
            this.unlockAchievement('untouchable');
          }
          // All headshots bonus
          if (waveKills > 0 && this.waveHeadshots === waveKills) {
            this.score += 1000;
            this.events.onWaveBonus?.({ text: 'ALL HEADSHOTS BONUS', score: 1000 });
          }
          // Speed clear bonus
          if (clearTime < 30 && waveKills > 0) {
            this.score += 300;
            this.events.onWaveBonus?.({ text: 'SPEED CLEAR BONUS', score: 300 });
          }
        }
        this.waveStartTime = performance.now();
        this.wave++;
        this.waveSpawnTimer = 0;
        this.waveKillCount = 0;
        this.killstreakRewardsEarned = []; // Reset killstreak rewards per wave
        // Generate objective for new wave
        this.generateWaveObjective();
        this.events.onWaveStart?.(this.wave, this.currentObjective);
        // Remove dead enemies from array
        this.enemies = this.enemies.filter((e) => {
          if (e.dead) { this.scene.remove(e.group); return false; }
          return true;
        });
        this.spawnEnemies();
      }
    }
  }

  private generateWaveObjective() {
    const w = this.wave;
    if (w % 5 === 0) {
      // Boss wave — eliminate
      this.currentObjective = { type: 'eliminate', text: `Eliminate the mini-boss (Wave ${w})`, timer: 0, targetPos: null, progress: 0, maxProgress: 1, completed: false, failed: false };
    } else if (w % 4 === 0) {
      // Extract — reach a zone within time limit
      const angle = Math.random() * Math.PI * 2;
      const pos = { x: Math.cos(angle) * 15, z: Math.sin(angle) * 15 };
      this.currentObjective = { type: 'extract', text: 'Reach the extraction zone!', timer: 30, targetPos: pos, progress: 0, maxProgress: 1, completed: false, failed: false };
    } else if (w % 3 === 0) {
      // Defend — stay near a point
      const angle = Math.random() * Math.PI * 2;
      const pos = { x: Math.cos(angle) * 10, z: Math.sin(angle) * 10 };
      this.currentObjective = { type: 'defend', text: 'Defend the position!', timer: 45, targetPos: pos, progress: 0, maxProgress: 45, completed: false, failed: false };
    } else {
      // Survive
      this.currentObjective = { type: 'survive', text: `Survive wave ${w}`, timer: 0, targetPos: null, progress: 0, maxProgress: 1, completed: false, failed: false };
    }
  }

  private updateObjective(dt: number) {
    if (this.currentObjective.completed || this.currentObjective.failed) return;

    if (this.currentObjective.type === 'extract' && this.currentObjective.targetPos) {
      this.currentObjective.timer -= dt;
      const dx = this.camera.position.x - this.currentObjective.targetPos.x;
      const dz = this.camera.position.z - this.currentObjective.targetPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 3) {
        this.currentObjective.completed = true;
        this.score += 500;
        this.events.onObjectiveUpdate?.(this.currentObjective);
      } else if (this.currentObjective.timer <= 0) {
        this.currentObjective.failed = true;
        this.events.onObjectiveUpdate?.(this.currentObjective);
      }
    } else if (this.currentObjective.type === 'defend' && this.currentObjective.targetPos) {
      this.currentObjective.timer -= dt;
      const dx = this.camera.position.x - this.currentObjective.targetPos.x;
      const dz = this.camera.position.z - this.currentObjective.targetPos.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 5) {
        this.currentObjective.progress += dt;
      }
      if (this.currentObjective.progress >= this.currentObjective.maxProgress) {
        this.currentObjective.completed = true;
        this.score += 500;
        this.events.onObjectiveUpdate?.(this.currentObjective);
      } else if (this.currentObjective.timer <= 0) {
        this.currentObjective.failed = true;
        this.events.onObjectiveUpdate?.(this.currentObjective);
      }
    } else if (this.currentObjective.type === 'eliminate') {
      // Check if mini-boss is dead
      const aliveBoss = this.enemies.some(e => !e.dead && e.isMiniBoss);
      if (!aliveBoss && this.enemies.length > 0) {
        this.currentObjective.completed = true;
        this.score += 500;
        this.events.onObjectiveUpdate?.(this.currentObjective);
      }
    }
    // 'survive' type is completed when all enemies are dead (handled by wave progression)
  }

  // ─── PICKUPS ───

  private spawnPickups() {
    const healthMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00ff00, emissiveIntensity: 0.3 });
    const ammoMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, emissive: 0xf97316, emissiveIntensity: 0.2 });
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x4a4a6a, emissive: 0x00aaff, emissiveIntensity: 0.4, metalness: 0.7, roughness: 0.3 });
    const weaponMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, emissive: 0xff00ff, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.2 });

    const healthPos = [
      { x: -16, z: -16 }, { x: 16, z: 16 }, { x: 0, z: -14 },
    ];
    healthPos.forEach((p) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.4), healthMat.clone());
      mesh.position.set(p.x, 0.5, p.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.pickups.push({ mesh, type: 'health', taken: false, bobOffset: Math.random() * Math.PI * 2 });
    });

    const ammoPos = [
      { x: 16, z: -16 }, { x: -16, z: 16 }, { x: 0, z: 14 },
    ];
    ammoPos.forEach((p) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), ammoMat.clone());
      mesh.position.set(p.x, 0.4, p.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.pickups.push({ mesh, type: 'ammo', taken: false, bobOffset: Math.random() * Math.PI * 2 });
    });

    // Armor pickups — medium and heavy vests
    const armorPickups: { x: number; z: number; armor: ArmorType }[] = [
      { x: -10, z: 10, armor: 'medium' },
      { x: 10, z: -10, armor: 'heavy' },
    ];
    armorPickups.forEach((ap) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.3), armorMat.clone());
      mesh.position.set(ap.x, 0.5, ap.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.pickups.push({ mesh, type: 'armor', armorType: ap.armor, taken: false, bobOffset: Math.random() * Math.PI * 2 });
    });

    // Weapon pickups — random weapons scattered on the map
    const weaponPool: WeaponKey[] = ['rifle', 'sniper', 'shotgun', 'lmg', 'dmr', 'plasma'];
    const weaponPos = [
      { x: -20, z: 0 }, { x: 20, z: 0 }, { x: 0, z: 20 },
    ];
    weaponPos.forEach((wp, i) => {
      const wKey = weaponPool[i % weaponPool.length];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.25, 0.15), weaponMat.clone());
      mesh.position.set(wp.x, 0.4, wp.z);
      mesh.castShadow = true;
      this.scene.add(mesh);
      this.pickups.push({ mesh, type: 'weapon', weaponKey: wKey, taken: false, bobOffset: Math.random() * Math.PI * 2 });
    });
  }

  // ─── INPUT ───

  private bindInput() {
    document.addEventListener('pointerlockchange', () => {
      this.isLocked = !!document.pointerLockElement;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.isLocked) return;
      const sens = (this.isADS ? 0.0005 : 0.0012) * (this.isADS ? this.settings.scopeSensitivity : this.settings.lookSensitivity);
      this.yaw -= e.movementX * sens;
      this.pitch -= e.movementY * sens;
      this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
      this.mouseDeltaX += e.movementX * sens;
      this.mouseDeltaY += e.movementY * sens;
    });

    document.addEventListener('keydown', (e) => {
      // Prevent browser default for all game keys to avoid interference
      const gameKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'KeyC', 'KeyQ', 'KeyE', 'KeyR', 'KeyF', 'KeyG', 'KeyV', 'Digit1', 'Digit2', 'Digit3', 'Tab'];
      if (gameKeys.includes(e.code)) e.preventDefault();
      if (this.dead) return;
      this.keys[e.code] = true;
      if (e.code === 'KeyF') {
        const nearSwitch = this.lightSwitches.some(s => s.mesh.position.distanceTo(this.camera.position) < 2.5);
        if (nearSwitch) this.toggleLightSwitch(this.camera.position);
        else this.toggleFlashlight();
      }
      if (e.code === 'KeyR') this.startReload();
      if (e.code === 'Digit1') this.switchWeapon(this.loadout.secondaryWeapon);
      if (e.code === 'Digit2') this.switchWeapon(this.loadout.primaryWeapon);
      if (e.code === 'KeyG') this.throwGrenade();
      if (e.code === 'KeyC') this.isCrouching = !this.isCrouching;
      if (e.code === 'KeyQ') this.leanDir = 'left';
      if (e.code === 'KeyE') this.leanDir = 'right';
      if (e.code === 'Space') { this.tryJump(); }
      if (e.code === 'KeyV') this.meleeAttack();
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'KeyQ' && this.leanDir === 'left') this.leanDir = null;
      if (e.code === 'KeyE' && this.leanDir === 'right') this.leanDir = null;
    });

    document.addEventListener('mousedown', (e) => {
      if (!this.isLocked || this.dead) return;
      if (e.button === 0) { this.fire(); this.mouseHeld = true; }
      if (e.button === 2) this.isADS = true;
    });

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseHeld = false;
      if (e.button === 2) this.isADS = false;
    });

    document.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ─── AUDIO ───

  private playShootSound() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const vol = this.settings.sfxVolume * 0.08;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = this.currentWeapon === 'shotgun' ? 'square' : 'sawtooth';
    const freq = this.currentWeapon === 'pistol' ? 200 : this.currentWeapon === 'shotgun' ? 120 : 160;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
  }

  private playHitSound() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const vol = this.settings.sfxVolume * 0.05;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  }

  private playExplosionSound() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const vol = this.settings.sfxVolume * 0.15;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.4);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  private playReloadSound() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const vol = this.settings.sfxVolume * 0.06;
    // Two clicks — mag out, mag in
    for (let i = 0; i < 2; i++) {
      const t = ctx.currentTime + i * (this.currentWeapon === 'shotgun' ? 0.4 : 0.3);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(50, t + 0.05);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  private playKillConfirmSound(killstreak: number) {
    if (!this.audioCtx) return;
    const now = performance.now();
    if (now - this.lastKillConfirmTime < 200) return;
    this.lastKillConfirmTime = now;
    const ctx = this.audioCtx;
    const vol = this.settings.sfxVolume * 0.1;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Pitch scales with killstreak: base 600Hz, +100Hz per streak
    const freq = 600 + Math.min(killstreak * 100, 800);
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  private checkAchievements(isHeadshot: boolean, enemy: Enemy) {
    if (this.stats.kills === 1) this.unlockAchievement('firstBlood');
    if (this.stats.kills >= 100) this.unlockAchievement('centurion');
    if (this.headshots >= 50) this.unlockAchievement('headhunter');
    if (this.killstreak >= 5) this.unlockAchievement('killstreak5');
    if (this.killstreak >= 10) this.unlockAchievement('killstreak10');
    if (this.wave >= 10) this.unlockAchievement('wave10');
    if (this.wave >= 20) this.unlockAchievement('wave20');
    if (this.stats.shotsFired > 20 && this.stats.shotsHit / this.stats.shotsFired >= 0.8) this.unlockAchievement('sharpshooter');
    if (this.currentWeapon === 'sniper' && !this.isADS) this.unlockAchievement('noScope');
  }

  private unlockAchievement(id: string) {
    if (this.unlockedAchievements.has(id)) return;
    this.unlockedAchievements.add(id);
    const ach = ACHIEVEMENTS.find(a => a.id === id);
    if (ach) this.events.onAchievement?.(ach);
  }

  private playPositionalSound(pos: THREE.Vector3, freq: number, type: OscillatorType, volume: number, duration: number) {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const dist = this.camera.position.distanceTo(pos);
    if (dist > 40) return;
    const pan = Math.max(-1, Math.min(1, (pos.x - this.camera.position.x) / 20));
    const attenuation = Math.max(0, 1 - dist / 40) * volume * this.settings.sfxVolume;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.3, ctx.currentTime + duration);
    gain.gain.setValueAtTime(attenuation, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain).connect(panner).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  private playEnemyShootSound(pos: THREE.Vector3) {
    this.playPositionalSound(pos, 140, 'sawtooth', 0.06, 0.1);
  }

  private playFootstepSound(pos: THREE.Vector3) {
    this.playPositionalSound(pos, 80, 'triangle', 0.03, 0.06);
  }

  private playHeartbeat() {
    if (!this.audioCtx) return;
    const ctx = this.audioCtx;
    const vol = this.settings.sfxVolume * 0.1;
    for (let i = 0; i < 2; i++) {
      const t = ctx.currentTime + i * 0.15;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(60, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  }

  private updateMusic(dt: number) {
    if (!this.audioCtx) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.5;

    const enemiesNear = this.enemies.filter(e => !e.dead && e.group.position.distanceTo(this.camera.position) < 15).length;
    const lowHP = this.hp < 30;
    let target: 'calm' | 'tension' | 'combat' | 'critical' = 'calm';
    if (lowHP) target = 'critical';
    else if (enemiesNear > 3) target = 'combat';
    else if (enemiesNear > 0) target = 'tension';

    if (target === this.musicLayer) return;
    this.musicLayer = target;

    const ctx = this.audioCtx;
    const vol = this.settings.sfxVolume * 0.03;
    const freqs: Record<typeof target, [number, number]> = {
      calm: [110, 165],
      tension: [130, 195],
      combat: [165, 220],
      critical: [220, 277],
    };
    const [f1, f2] = freqs[target];

    if (this.musicOsc) { this.musicOsc.stop(); this.musicOsc = null; }
    if (this.musicOsc2) { this.musicOsc2.stop(); this.musicOsc2 = null; }
    if (this.musicGain) { this.musicGain.disconnect(); this.musicGain = null; }

    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    this.musicGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.0);

    this.musicOsc = ctx.createOscillator();
    this.musicOsc.type = target === 'critical' ? 'sawtooth' : 'sine';
    this.musicOsc.frequency.value = f1;
    this.musicOsc.connect(this.musicGain).connect(ctx.destination);
    this.musicOsc.start();

    this.musicOsc2 = ctx.createOscillator();
    this.musicOsc2.type = 'triangle';
    this.musicOsc2.frequency.value = f2;
    this.musicOsc2.connect(this.musicGain).connect(ctx.destination);
    this.musicOsc2.start();
  }

  private playAmbientWarfare() {
    if (!this.audioCtx) return;
    // Distant explosion rumble
    const pos = new THREE.Vector3(
      this.camera.position.x + (Math.random() - 0.5) * 60,
      0,
      this.camera.position.z + (Math.random() - 0.5) * 60
    );
    this.playPositionalSound(pos, 50, 'sawtooth', 0.04, 0.5);
  }

  // ─── EFFECTS ───

  private createBloodVFX(point: THREE.Vector3, dir: THREE.Vector3) {
    const item = this.getPoolItem(this.sparkPool);
    if (!item) return;
    const points = item.mesh as unknown as THREE.Points;
    const geo = points.geometry;
    const pos = geo.attributes.position.array as Float32Array;
    const count = 8;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = point.x + (Math.random() - 0.5) * 0.1;
      pos[i * 3 + 1] = point.y + (Math.random() - 0.5) * 0.1;
      pos[i * 3 + 2] = point.z + (Math.random() - 0.5) * 0.1;
    }
    geo.attributes.position.needsUpdate = true;
    const mat = points.material as THREE.PointsMaterial;
    mat.color.setHex(0x8a0a0a);
    mat.opacity = 1;
    points.visible = true;
    item.active = true;
    item.lifetime = 0.4;
  }

  private createBloodPool(pos: THREE.Vector3) {
    const geo = new THREE.CircleGeometry(0.4 + Math.random() * 0.3, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x5a0505, transparent: true, opacity: 0.7, side: THREE.DoubleSide });
    const pool = new THREE.Mesh(geo, mat);
    pool.position.copy(pos);
    pool.position.y = 0.01;
    pool.rotation.x = -Math.PI / 2;
    this.scene.add(pool);
    this.bloodPools.push({ mesh: pool, lifetime: 10 });
  }

  private spawnPickup(pos: THREE.Vector3, type: 'health' | 'ammo') {
    const geo = type === 'health'
      ? new THREE.BoxGeometry(0.4, 0.4, 0.4)
      : new THREE.BoxGeometry(0.35, 0.35, 0.5);
    const mat = new THREE.MeshBasicMaterial({ color: type === 'health' ? 0x00ff44 : 0x4488ff });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.position.y = 0.3;
    this.scene.add(mesh);
    this.pickups.push({ mesh, type, taken: false, bobOffset: Math.random() * Math.PI * 2 });
  }

  private createImpactSparks(point: THREE.Vector3) {
    const item = this.getPoolItem(this.sparkPool);
    if (!item) return;
    const points = item.mesh as unknown as THREE.Points;
    const geo = points.geometry;
    const pos = geo.attributes.position.array as Float32Array;
    const count = 8;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = point.x;
      pos[i * 3 + 1] = point.y;
      pos[i * 3 + 2] = point.z;
    }
    geo.attributes.position.needsUpdate = true;
    const mat = points.material as THREE.PointsMaterial;
    mat.opacity = 1;
    points.visible = true;
    item.active = true;
    item.lifetime = 0.3;
    // Also spawn dust cloud
    this.createImpactDust(point);
  }

  private ejectShell() {
    const casing = this.shellCasings.find((s) => !s.active);
    if (!casing) return;
    // Eject from right side of weapon, roughly at camera position + offset
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    const pos = this.camera.position.clone()
      .add(fwd.clone().multiplyScalar(0.3))
      .add(right.clone().multiplyScalar(0.12))
      .add(up.clone().multiplyScalar(-0.05));
    casing.mesh.position.copy(pos);
    casing.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
    casing.vel.set(
      right.x * (1.5 + Math.random()) + up.x * 0.5,
      right.y * (1.5 + Math.random()) + up.y * 0.5 + 1.0,
      right.z * (1.5 + Math.random()) + up.z * 0.5,
    );
    casing.lifetime = 2.0;
    casing.active = true;
    casing.mesh.visible = true;
  }

  private createImpactDust(point: THREE.Vector3) {
    const dust = this.dustParticles.find((d) => !d.active);
    if (!dust) return;
    const geo = dust.mesh.geometry;
    const pos = geo.attributes.position.array as Float32Array;
    for (let i = 0; i < 12; i++) {
      pos[i * 3] = point.x;
      pos[i * 3 + 1] = point.y;
      pos[i * 3 + 2] = point.z;
      const angle = (i / 12) * Math.PI * 2;
      dust.vel[i * 3] = Math.cos(angle) * (1 + Math.random() * 2);
      dust.vel[i * 3 + 1] = 0.5 + Math.random() * 1.5;
      dust.vel[i * 3 + 2] = Math.sin(angle) * (1 + Math.random() * 2);
    }
    geo.attributes.position.needsUpdate = true;
    const mat = dust.mesh.material as THREE.PointsMaterial;
    mat.opacity = 0.7;
    dust.mesh.visible = true;
    dust.lifetime = 0.6;
    dust.active = true;
  }

  private createExplosion(pos: THREE.Vector3) {
    // Shockwave ring
    const ringGeo = new THREE.RingGeometry(0.3, 0.5, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.8, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.rotation.x = -Math.PI / 2;
    this.scene.add(ring);

    // Fireball
    const ballGeo = new THREE.SphereGeometry(0.5, 12, 12);
    const ballMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.copy(pos);
    this.scene.add(ball);

    // Light
    const light = new THREE.PointLight(0xff6600, 8, 15, 2);
    light.position.copy(pos);
    this.scene.add(light);

    this.playExplosionSound();

    // Damage nearby enemies
    this.enemies.forEach((enemy) => {
      if (enemy.dead) return;
      const d = enemy.group.position.distanceTo(pos);
      if (d < 5) {
        enemy.hp -= (1 - d / 5) * 80;
        enemy.hitFlash = 0.3;
        if (enemy.hp <= 0 && !enemy.dead) {
          enemy.dead = true;
          enemy.deathTimer = 2.0;
          this.stats.kills++;
          this.waveKillCount++;
          this.killstreak++;
          this.score += 100;
          this.events.onKill?.(enemy.type, false);
          this.events.onScorePopup?.({ id: Date.now() + Math.random(), text: '+100 BOOM', x: 50, y: 50 });
          enemy.hpBar.visible = false;
        } else {
          this.updateHealthBar(enemy);
        }
      }
    });

    // Damage player if close
    const dPlayer = this.camera.position.distanceTo(pos);
    if (dPlayer < 5) {
      this.takeDamage((1 - dPlayer / 5) * 40, pos);
    }

    // Chain explode nearby barrels
    this.barrels.forEach((b) => {
      if (b.exploded) return;
      if (b.pos.distanceTo(pos) < 4) {
        setTimeout(() => this.explodeBarrel(b), 100);
      }
    });

    const start = performance.now();
    const animate = () => {
      const elapsed = (performance.now() - start) / 1000;
      if (elapsed > 0.5) {
        this.scene.remove(ring); this.scene.remove(ball); this.scene.remove(light);
        ringGeo.dispose(); ringMat.dispose(); ballGeo.dispose(); ballMat.dispose();
        return;
      }
      const t = elapsed / 0.5;
      ring.scale.setScalar(1 + t * 8);
      ringMat.opacity = 0.8 * (1 - t);
      ball.scale.setScalar(1 + t * 3);
      ballMat.opacity = 0.9 * (1 - t);
      light.intensity = 8 * (1 - t);
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }

  // ─── KILLSTREAK REWARDS ───

  private triggerKillstreakReward(streak: number) {
    let reward: KillstreakRewardType | null = null;
    if (streak >= 10) reward = 'gunship';
    else if (streak >= 7) reward = 'supplydrop';
    else if (streak >= 5) reward = 'airstrike';
    else if (streak >= 3) reward = 'uav';
    if (!reward || this.killstreakRewardsEarned.includes(reward)) return;
    this.killstreakRewardsEarned.push(reward);
    this.events.onKillstreakReward?.(reward);

    if (reward === 'uav') {
      this.uavTimer = 10;
    } else if (reward === 'airstrike') {
      this.callAirstrike();
    } else if (reward === 'supplydrop') {
      this.callSupplyDrop();
    } else if (reward === 'gunship') {
      this.spawnGunship();
    }
  }

  private callAirstrike() {
    // Bombard area in front of player with explosions
    const center = this.camera.position.clone();
    const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    center.add(fwd.multiplyScalar(15));
    let delay = 0;
    for (let i = 0; i < 8; i++) {
      setTimeout(() => {
        const pos = center.clone();
        pos.x += (Math.random() - 0.5) * 12;
        pos.z += (Math.random() - 0.5) * 12;
        this.createExplosion(pos);
        // Damage enemies near explosion
        this.enemies.forEach(e => {
          if (e.dead) return;
          const d = e.group.position.distanceTo(pos);
          if (d < 6) { e.hp -= 80 * (1 - d / 6); if (e.hp <= 0 && !e.dead) { e.dead = true; e.deathTimer = 2.0; this.stats.kills++; this.waveKillCount++; this.score += 100; e.hpBar.visible = false; } }
        });
      }, delay);
      delay += 200;
    }
  }

  private callSupplyDrop() {
    // Full heal, refill ammo, damage boost for 15s
    this.hp = this.maxHp;
    (Object.keys(this.ammo) as WeaponKey[]).forEach(k => {
      const w = WEAPONS[k];
      const upgradedMag = Math.round(w.magSize * (1 + (this.weaponUpgrades.magSize || 0) * UPGRADES.magSize.effectPerLevel));
      this.ammo[k] = upgradedMag;
    });
    this.supplyDropBoostTimer = 15;
    this.grenades = this.loadout.grenadeCount;
    this.updateStats();
  }

  private spawnGunship() {
    this.gunshipTimer = 15;
    this.gunshipMesh = new THREE.Group();
    // Simple helicopter shape
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.8, 2, 4, 8), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 }));
    body.rotation.z = Math.PI / 2;
    this.gunshipMesh.add(body);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 0.5), new THREE.MeshStandardMaterial({ color: 0x222222, transparent: true, opacity: 0.6 }));
    rotor.position.y = 0.8;
    this.gunshipMesh.add(rotor);
    this.gunshipMesh.position.set(0, 12, 0);
    this.scene.add(this.gunshipMesh);
  }

  private updateGunship(dt: number) {
    if (this.gunshipTimer <= 0 || !this.gunshipMesh) return;
    this.gunshipTimer -= dt;
    // Circle around the map
    const angle = this.time * 0.5;
    this.gunshipMesh.position.x = Math.cos(angle) * 18;
    this.gunshipMesh.position.z = Math.sin(angle) * 18;
    this.gunshipMesh.position.y = 12;
    this.gunshipMesh.rotation.y = -angle + Math.PI / 2;
    // Shoot at nearest enemy every 0.5s
    if (Math.floor(this.time * 2) !== Math.floor((this.time - dt) * 2)) {
      const alive = this.enemies.filter(e => !e.dead);
      if (alive.length > 0) {
        const nearest = alive.reduce((a, b) => a.group.position.distanceTo(this.camera.position) < b.group.position.distanceTo(this.camera.position) ? a : b);
        nearest.hp -= 60;
        if (nearest.hp <= 0) { nearest.dead = true; nearest.deathTimer = 2.0; this.stats.kills++; this.waveKillCount++; this.score += 80; nearest.hpBar.visible = false; }
        this.createExplosion(nearest.group.position.clone());
      }
    }
    if (this.gunshipTimer <= 0 && this.gunshipMesh) {
      this.scene.remove(this.gunshipMesh);
      this.gunshipMesh = null;
    }
  }

  // ─── COMBAT ───

  private fire() {
    if (this.dead || this.reloading) return;
    const w = WEAPONS[this.currentWeapon];
    const now = performance.now();
    const effectiveFireRate = this.perk === 'doubletap' ? w.fireRate * 0.8 : w.fireRate;
    if (now - this.lastShot < effectiveFireRate) return;
    if (this.ammo[this.currentWeapon] <= 0) { this.startReload(); return; }

    this.lastShot = now;
    this.ammo[this.currentWeapon]--;
    this.stats.shotsFired++;
    // Recoil pattern — cycle through pattern based on shots fired
    const pattern = w.recoilPattern;
    const recoilIdx = (this.stats.shotsFired - 1) % pattern.length;
    const [recoilX, recoilY] = pattern[recoilIdx];
    const recoilUpgrade = this.weaponUpgrades.recoil || 0;
    const recoilMult = 1 - recoilUpgrade * UPGRADES.recoil.effectPerLevel;
    this.recoil = Math.min(this.recoil + 0.04 * recoilMult, 0.18);
    this.pitch += recoilY * 0.002 * recoilMult;
    this.yaw += recoilX * 0.002 * recoilMult;
    this.crosshairSpread = Math.min(this.crosshairSpread + 0.15, 1.0);
    this.flashMuzzle();
    this.playShootSound();
    if (this.currentWeapon !== 'shotgun' && this.currentWeapon !== 'launcher') {
      this.ejectShell();
    }

    const barrelOrigin = this.camera.position.clone();
    const baseDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    barrelOrigin.add(baseDir.clone().multiplyScalar(0.5));

    // Aim assist — nudge direction toward nearest enemy (mobile)
    if (this.aimAssistStrength > 0) {
      const assist = this.getAimAssistCorrection();
      if (assist.yaw !== 0 || assist.pitch !== 0) {
        const assistQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(assist.pitch, assist.yaw, 0, 'YXZ')
        );
        baseDir.applyQuaternion(assistQuat).normalize();
      }
    }

    for (let p = 0; p < w.pellets; p++) {
      const dir = baseDir.clone();
      const spreadUpgrade = this.weaponUpgrades.spread || 0;
      const adsSpreadReduction = this.isADS ? (this.currentWeapon === 'sniper' ? 0.05 : this.currentWeapon === 'dmr' ? 0.3 : 0.5) : 1;
      const spreadMult = (this.suppressedTimer > 0 ? 1.5 : 1) * (1 - spreadUpgrade * UPGRADES.spread.effectPerLevel) * adsSpreadReduction;
      dir.x += (Math.random() - 0.5) * w.spread * spreadMult;
      dir.y += (Math.random() - 0.5) * w.spread * spreadMult;
      dir.normalize();

      const ray = new THREE.Raycaster(barrelOrigin, dir);
      const enemyMeshes = this.enemies.filter((e) => !e.dead).flatMap((e) => e.meshes);
      const remoteMeshes: THREE.Object3D[] = [];
      this.remotePlayers.forEach(rp => { if (!rp.isDead) remoteMeshes.push(rp.group); });
      const hits = ray.intersectObjects([...enemyMeshes, ...remoteMeshes, ...this.collidables]);
      const endPoint = barrelOrigin.clone().add(dir.clone().multiplyScalar(50));

      if (hits.length > 0) {
        const hit = hits[0];
        endPoint.copy(hit.point);

        // Check barrel hit
        if (hit.object.userData.isBarrel) {
          const barrel = this.barrels.find((b) => b.mesh === hit.object);
          if (barrel && !barrel.exploded) this.explodeBarrel(barrel);
        }

        const enemy = this.enemies.find((e) => e.meshes.includes(hit.object as THREE.Mesh));
        if (enemy) {
          const isHeadshot = !!(hit.object.userData.isHead);
          const dmgUpgrade = this.weaponUpgrades.damage || 0;
          const dmgMult = this.damageMult * (1 + dmgUpgrade * UPGRADES.damage.effectPerLevel);
          const supplyBoost = this.supplyDropBoostTimer > 0 ? 1.5 : 1;
          const modifierBoost = this.currentWaveModifier?.type === 'doubleDamage' ? 2 : this.currentWaveModifier?.type === 'glassCannon' ? 3 : 1;
          const dmg = Math.round((isHeadshot ? w.damage * 2.5 : w.damage) * dmgMult * supplyBoost * modifierBoost);
          enemy.hp -= dmg;
          this.damageDealt += dmg;
          enemy.hitFlash = 0.3;
          enemy.group.position.add(dir.clone().multiplyScalar(0.1));
          this.stats.shotsHit++;
          this.playHitSound();
          this.events.onHit?.(isHeadshot);
          this.createImpactSparks(hit.point);
          this.createBloodVFX(hit.point, dir);
          if (navigator.vibrate) navigator.vibrate(isHeadshot ? [10, 20, 30] : 15);

          // Boss enrage at 30% HP
          if (enemy.isBoss && !enemy.enraged && enemy.hp < enemy.maxHp * 0.3) {
            enemy.enraged = true;
            enemy.speed *= 1.5;
            enemy.damage = Math.round(enemy.damage * 1.5);
            enemy.fireRate = Math.round(enemy.fireRate * 0.6);
          }

          // Hit marker
          this.hitMarkerId++;
          this.events.onHitMarker?.({ id: this.hitMarkerId, isHeadshot, isKill: enemy.hp <= 0 });

          // Damage number — project enemy position to screen
          const screenPos = enemy.group.position.clone();
          screenPos.y += 1.5;
          screenPos.project(this.camera);
          const sx = (screenPos.x * 0.5 + 0.5) * 100;
          const sy = (-screenPos.y * 0.5 + 0.5) * 100;
          this.damageNumberId++;
          this.events.onDamageNumber?.({ id: this.damageNumberId, value: dmg, x: sx, y: sy, isHeadshot, isKill: enemy.hp <= 0 });

          // Alert nearby enemies
          this.enemies.forEach((other) => {
            if (other.dead || other === enemy) return;
            const d = other.group.position.distanceTo(enemy.group.position);
            if (d < 15) other.state = 'chase';
          });

          if (enemy.hp <= 0 && !enemy.dead) {
            enemy.dead = true;
            enemy.deathTimer = 2.0;
            enemy.deathDir = dir.clone();
            this.stats.kills++;
            this.waveKillCount++;
            this.killstreak++;
            this.comboKills++;
            // Score multiplier chain: 1x → 2x (3 kills) → 3x (6) → 4x (10) → 5x (15)
            this.scoreMultiplier = this.comboKills >= 15 ? 5 : this.comboKills >= 10 ? 4 : this.comboKills >= 6 ? 3 : this.comboKills >= 3 ? 2 : 1;
            this.comboTimer = 5; // 5 seconds to maintain combo
            this.events.onCombo?.(this.scoreMultiplier);
            const basePoints = isHeadshot ? 150 : 100;
            const points = basePoints * this.scoreMultiplier;
            this.score += points;
            if (isHeadshot) { this.headshots++; this.waveHeadshots++; }
            this.damageDealt += dmg;
            this.createBloodPool(enemy.group.position.clone());
            this.events.onKill?.(enemy.type, isHeadshot);
            if (navigator.vibrate) navigator.vibrate(isHeadshot ? [20, 30, 20, 30, 60] : [30, 40, 60]);
            this.events.onScorePopup?.({ id: Date.now() + Math.random(), text: `+${points}${this.scoreMultiplier > 1 ? ' x' + this.scoreMultiplier : ''}${isHeadshot ? ' HS' : ''}`, x: 50 + (Math.random() - 0.5) * 10, y: 50 + (Math.random() - 0.5) * 10 });
            if (this.killstreak === 3 || this.killstreak === 5 || this.killstreak === 7 || this.killstreak === 10) {
              this.events.onKillstreak?.(this.killstreak);
              this.triggerKillstreakReward(this.killstreak);
            }
            // Kill confirmation sound — pitch scales with killstreak
            this.playKillConfirmSound(this.killstreak);
            this.events.onKillConfirm?.(this.killstreak);
            // Check achievements
            this.checkAchievements(isHeadshot, enemy);
            // Boss death — drop upgrade crate, screen shake
            if (enemy.isBoss) {
              this.bossEnemy = null;
              this.cameraShake = 0.3;
              this.spawnPickup(enemy.group.position.clone(), 'health');
              this.spawnPickup(enemy.group.position.clone().add(new THREE.Vector3(2, 0, 0)), 'ammo');
              this.score += 500;
              this.events.onScorePopup?.({ id: Date.now() + Math.random(), text: 'BOSS DOWN +500', x: 50, y: 40 });
              this.unlockAchievement('bossSlayer');
            }
            // Scavenger perk: restore some ammo on kill
            if (this.perk === 'scavenger') {
              this.reserveAmmo[this.currentWeapon] = Math.min(this.reserveAmmo[this.currentWeapon] + Math.round(WEAPONS[this.currentWeapon].magSize * 0.3), 999);
            }
            // Hide health bar immediately
            enemy.hpBar.visible = false;
          } else {
            this.updateHealthBar(enemy);
          }
        } else if (this.mpClient && hit.object.userData.isHead !== undefined) {
          // Check if hit belongs to a remote player
          let hitRp: RemotePlayer | null = null;
          this.remotePlayers.forEach(rp => {
            if (rp.group.children.includes(hit.object) || hit.object === rp.head || hit.object === rp.body) {
              hitRp = rp;
            }
          });
          if (hitRp) {
            const isHeadshot = !!(hit.object.userData.isHead);
            const dmgUpgrade = this.weaponUpgrades.damage || 0;
            const dmgMult = this.damageMult * (1 + dmgUpgrade * UPGRADES.damage.effectPerLevel);
            const dmg = Math.round((isHeadshot ? w.damage * 2.5 : w.damage) * dmgMult);
            this.mpClient.sendHit({ fromId: this.mpClient.myId, toId: hitRp.id, damage: dmg, isHeadshot, timestamp: Date.now() });
            hitRp.takeHit();
            this.events.onHitMarker?.({ id: this.hitMarkerId++, isKill: false, isHeadshot });
            this.events.onDamageNumber?.({ id: Date.now() + Math.random(), value: dmg, x: 50, y: 45, isHeadshot, isKill: false });
            this.spawnTracer(barrelOrigin, hit.point);
          }
        } else {
          this.createImpactSparks(hit.point);
          // Bullet decal on walls/surfaces
          if (hit.face) {
            const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
            this.createBulletDecal(hit.point, normal);
          }
          // Destructible cover damage
          if (hit.object.userData.isDestructible) {
            this.damageCover(hit.object as THREE.Mesh, w.damage, hit.point);
          }
        }
      }

      this.spawnTracer(barrelOrigin, endPoint);
      // Broadcast shot to multiplayer
      if (this.mpClient && this.mpClient.isConnected) {
        this.mpClient.sendShot({
          fromId: this.mpClient.myId,
          originX: barrelOrigin.x, originY: barrelOrigin.y, originZ: barrelOrigin.z,
          dirX: dir.x, dirY: dir.y, dirZ: dir.z,
          weapon: this.currentWeapon,
          timestamp: Date.now(),
        });
      }
    }

    this.updateStats();
  }

  private startReload() {
    if (this.reloading) return;
    const w = WEAPONS[this.currentWeapon];
    if (this.ammo[this.currentWeapon] >= w.magSize) return;
    if (this.reserveAmmo[this.currentWeapon] <= 0) return;
    this.reloading = true;
    const isEmpty = this.ammo[this.currentWeapon] === 0;
    const baseReloadTime = this.currentWeapon === 'shotgun' ? (isEmpty ? 2.0 : 1.5) : (isEmpty ? 1.6 : 1.2);
    const reloadUpgrade = this.weaponUpgrades.reloadSpeed || 0;
    this.reloadTimer = baseReloadTime * this.reloadMult * (1 - reloadUpgrade * UPGRADES.reloadSpeed.effectPerLevel);
    this.reloadAnimProgress = 0;
    this.playReloadSound();
    this.events.onReloadStart?.();
  }

  private finishReload() {
    const w = WEAPONS[this.currentWeapon];
    const upgradedMagSize = Math.round(w.magSize * (1 + (this.weaponUpgrades.magSize || 0) * UPGRADES.magSize.effectPerLevel));
    const needed = upgradedMagSize - this.ammo[this.currentWeapon];
    const taken = Math.min(needed, this.reserveAmmo[this.currentWeapon]);
    this.ammo[this.currentWeapon] += taken;
    this.reserveAmmo[this.currentWeapon] -= taken;
    this.reloading = false;
    this.updateStats();
    this.events.onReloadComplete?.();
  }

  private tryVault() {
    if (this.vaultCooldown > 0 || this.dead) return;
    const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const checkPos = this.camera.position.clone().add(fwd.multiplyScalar(1.2));
    for (const col of this.collidables) {
      let box = this.colliderBoxes.get(col);
      if (!box) {
        box = new THREE.Box3().setFromObject(col);
        this.colliderBoxes.set(col, box);
      }
      if (checkPos.x > box.min.x - 0.3 && checkPos.x < box.max.x + 0.3 &&
          checkPos.z > box.min.z - 0.3 && checkPos.z < box.max.z + 0.3) {
        const top = box.max.y;
        if (top > this.camera.position.y - 1.5 && top < this.camera.position.y + 0.8) {
          // Vaultable — boost player up and forward
          this.camera.position.y = top + 0.3;
          this.camera.position.add(fwd.clone().multiplyScalar(1.5));
          this.vaultCooldown = 1.0;
          this.landingDip = 0.15;
          return;
        }
      }
    }
  }

  private tryJump() {
    if (this.dead) return;
    // Try vault first — if near a low obstacle, vault over it
    if (this.vaultCooldown <= 0) {
      const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      const checkPos = this.camera.position.clone().add(fwd.multiplyScalar(1.2));
      for (const col of this.collidables) {
        let box = this.colliderBoxes.get(col);
        if (!box) { box = new THREE.Box3().setFromObject(col); this.colliderBoxes.set(col, box); }
        if (checkPos.x > box.min.x - 0.3 && checkPos.x < box.max.x + 0.3 &&
            checkPos.z > box.min.z - 0.3 && checkPos.z < box.max.z + 0.3) {
          const top = box.max.y;
          if (top > this.camera.position.y - 1.5 && top < this.camera.position.y + 0.8) {
            this.camera.position.y = top + 0.3;
            this.camera.position.add(fwd.clone().multiplyScalar(1.5));
            this.vaultCooldown = 1.0;
            this.landingDip = 0.15;
            return;
          }
        }
      }
    }
    // Otherwise jump
    if (this.isGrounded) {
      const jumpVel = this.currentWaveModifier?.type === 'lowGravity' ? 10.0 : 6.0;
      this.verticalVel = jumpVel;
      this.isGrounded = false;
    }
  }

  // ─── Mobile touch input API ───
  public setTouchMove(x: number, y: number) { this.touchMoveX = x; this.touchMoveY = y; }
  public setTouchLook(x: number, y: number) { this.touchLookX = x; this.touchLookY = y; }
  public setTouchFiring(firing: boolean) { this.touchFiring = firing; if (firing && !this.dead) this.fire(); }
  public setTouchADS(ads: boolean) { this.touchADS = ads; this.isADS = ads; }
  public setTouchSprint(sprint: boolean) { this.touchSprint = sprint; }
  public setGyroLook(yaw: number, pitch: number) { this.gyroYaw = yaw; this.gyroPitch = pitch; }
  public setAutoFire(enabled: boolean) { this.autoFireEnabled = enabled; }
  public setAimAssist(strength: number) { this.aimAssistStrength = Math.max(0, Math.min(1, strength)); }
  public setLocked(locked: boolean) { this.isLocked = locked; }
  public getScreenFlash(): { intensity: number; color: number } { return { intensity: this.screenFlashIntensity, color: this.screenFlashColor }; }
  public setLean(dir: 'left' | 'right' | null) { this.leanDir = dir; }
  public touchJump() { this.tryJump(); }
  public touchReload() { this.startReload(); }
  public touchCrouch() { this.isCrouching = !this.isCrouching; }
  public touchGrenade() { this.throwGrenade(); }
  public touchSwitchWeapon() {
    const keys = Object.keys(this.ammo) as WeaponKey[];
    const idx = keys.indexOf(this.currentWeapon);
    this.switchWeapon(keys[(idx + 1) % keys.length]);
  }
  public touchMelee() { this.meleeAttack(); }
  public touchQuickScope() {
    if (this.dead) return;
    this.isADS = true;
    this.touchADS = true;
    // Fire after a short delay to simulate quick-scope
    setTimeout(() => {
      if (!this.dead) {
        this.fire();
        this.isADS = false;
        this.touchADS = false;
      }
    }, 150);
  }

  private getAimAssistCorrection(): { yaw: number; pitch: number } {
    if (this.aimAssistStrength <= 0) return { yaw: 0, pitch: 0 };
    const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const origin = this.camera.position.clone();
    let bestEnemy: Enemy | null = null;
    let bestScore = 0;
    const maxAngle = this.isADS ? 0.25 : 0.15; // radians — tighter cone when ADS
    const maxDist = 60;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const toEnemy = new THREE.Vector3().subVectors(e.group.position, origin);
      const dist = toEnemy.length();
      if (dist > maxDist) continue;
      toEnemy.normalize();
      const dot = fwd.dot(toEnemy);
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      if (angle > maxAngle) continue;
      // Score: closer to crosshair and closer in distance = higher
      const score = (1 - angle / maxAngle) * (1 - dist / maxDist);
      if (score > bestScore) { bestScore = score; bestEnemy = e; }
    }
    if (!bestEnemy) return { yaw: 0, pitch: 0 };
    // Compute yaw/pitch correction toward enemy
    const targetPos = bestEnemy.group.position.clone();
    targetPos.y += 1.0; // aim at chest height
    const dx = targetPos.x - origin.x;
    const dy = targetPos.y - origin.y;
    const dz = targetPos.z - origin.z;
    const targetYaw = Math.atan2(-dx, -dz);
    const horizDist = Math.sqrt(dx * dx + dz * dz);
    const targetPitch = Math.atan2(dy, horizDist);
    let yawDiff = targetYaw - this.yaw;
    // Normalize to [-PI, PI]
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    const pitchDiff = targetPitch - this.pitch;
    // Strength scales with score and setting
    const strength = this.aimAssistStrength * bestScore * 0.4;
    return { yaw: yawDiff * strength, pitch: pitchDiff * strength };
  }

  private meleeAttack() {
    if (this.dead || this.meleeCooldown > 0) return;
    this.meleeCooldown = 0.8;
    // Lunge camera forward slightly
    this.cameraShake = Math.min(this.cameraShake + 0.08, 0.15);
    // Find nearest enemy within 2.5 units in front
    const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const barrelOrigin = this.camera.position.clone().add(fwd.clone().multiplyScalar(0.5));
    let nearestEnemy: Enemy | null = null;
    let nearestDist = 2.8;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = barrelOrigin.distanceTo(e.group.position);
      if (d < nearestDist) {
        // Check enemy is roughly in front
        const toEnemy = new THREE.Vector3().subVectors(e.group.position, barrelOrigin).normalize();
        if (fwd.dot(toEnemy) > 0.5) {
          nearestDist = d;
          nearestEnemy = e;
        }
      }
    }
    if (nearestEnemy) {
      const dmg = 80;
      nearestEnemy.hp -= dmg;
      this.damageDealt += dmg;
      nearestEnemy.hitFlash = 0.5;
      this.stats.shotsHit++;
      this.events.onHit?.(false);
      this.events.onDamageNumber?.({ id: this.damageNumberId++, value: dmg, x: 50, y: 45, isHeadshot: false, isKill: nearestEnemy.hp <= 0 });
      if (nearestEnemy.hp <= 0) {
        nearestEnemy.dead = true;
        nearestEnemy.deathTimer = 2.0;
        this.stats.kills++;
        this.waveKillCount++;
        this.killstreak++;
        this.score += 100;
        this.headshots++;
        this.totalMeleeKills++;
        if (this.totalMeleeKills >= 10) this.unlockAchievement('meleeMaster');
        this.playKillConfirmSound(this.killstreak);
        nearestEnemy.hpBar.visible = false;
        this.events.onKill?.(nearestEnemy.type, false);
        this.events.onHitMarker?.({ id: this.hitMarkerId++, isKill: true, isHeadshot: false });
        if (this.killstreak === 3 || this.killstreak === 5 || this.killstreak === 7 || this.killstreak === 10) {
          this.events.onKillstreak?.(this.killstreak);
          this.triggerKillstreakReward(this.killstreak);
        }
      } else {
        this.events.onHitMarker?.({ id: this.hitMarkerId++, isKill: false, isHeadshot: false });
      }
      this.updateHealthBar(nearestEnemy);
      this.createImpactSparks(nearestEnemy.group.position.clone());
      this.updateStats();
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate([20, 30, 20, 30, 40]);
    }
  }

  private damageCover(mesh: THREE.Mesh, dmg: number, hitPoint: THREE.Vector3) {
    const cover = this.destructibleCover.find(c => c.mesh === mesh);
    if (!cover) return;
    cover.hp -= dmg;
    // Visual feedback — darken as it takes damage
    const mat = cover.mesh.material as THREE.MeshStandardMaterial;
    const damageRatio = 1 - (cover.hp / cover.maxHp);
    mat.color.setRGB(0x5a / 255 * (1 - damageRatio * 0.5), 0x4a / 255 * (1 - damageRatio * 0.5), 0x3a / 255 * (1 - damageRatio * 0.5));
    if (cover.hp <= 0) {
      // Shatter into pieces
      this.scene.remove(cover.mesh);
      const idx = this.collidables.indexOf(cover.mesh);
      if (idx >= 0) this.collidables.splice(idx, 1);
      // Spawn debris particles
      for (let i = 0; i < 6; i++) {
        const piece = new THREE.Mesh(
          new THREE.BoxGeometry(0.3 + Math.random() * 0.3, 0.2 + Math.random() * 0.2, 0.3 + Math.random() * 0.3),
          new THREE.MeshStandardMaterial({ color: 0x3a2a1a })
        );
        piece.position.copy(hitPoint).add(new THREE.Vector3((Math.random() - 0.5) * 1.5, Math.random() * 0.5, (Math.random() - 0.5) * 1.5));
        piece.userData.velocity = new THREE.Vector3((Math.random() - 0.5) * 4, 2 + Math.random() * 3, (Math.random() - 0.5) * 4);
        piece.userData.lifetime = 2;
        this.scene.add(piece);
        cover.pieces.push(piece);
      }
      this.createImpactSparks(hitPoint);
    }
  }

  private createBulletDecal(point: THREE.Vector3, normal: THREE.Vector3) {
    const geo = new THREE.CircleGeometry(0.04, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.8 });
    const decal = new THREE.Mesh(geo, mat);
    decal.position.copy(point).add(normal.multiplyScalar(0.01));
    decal.lookAt(point.clone().add(normal));
    this.scene.add(decal);
    this.bulletDecals.push({ mesh: decal, lifetime: 15 });
    // Limit decals to 30
    if (this.bulletDecals.length > 30) {
      const old = this.bulletDecals.shift();
      if (old) { this.scene.remove(old.mesh); (old.mesh.material as THREE.Material).dispose(); }
    }
  }

  private updateBulletDecals(dt: number) {
    for (let i = this.bulletDecals.length - 1; i >= 0; i--) {
      this.bulletDecals[i].lifetime -= dt;
      if (this.bulletDecals[i].lifetime < 2) {
        const mat = this.bulletDecals[i].mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = (this.bulletDecals[i].lifetime / 2) * 0.8;
      }
      if (this.bulletDecals[i].lifetime <= 0) {
        this.scene.remove(this.bulletDecals[i].mesh);
        (this.bulletDecals[i].mesh.material as THREE.Material).dispose();
        this.bulletDecals.splice(i, 1);
      }
    }
  }

  private switchWeapon(key: WeaponKey) {
    if (this.currentWeapon === key || this.reloading) return;
    this.weaponSwapAnim = 0.3; // 300ms swap animation
    const swapDelay = this.perk === 'fasthands' ? 100 : 200;
    setTimeout(() => {
      this.currentWeapon = key;
      this.reloading = false;
      this.rebuildWeaponModel();
      this.updateStats();
    }, swapDelay);
  }

  private throwGrenade() {
    if (this.grenades <= 0 || this.dead) return;
    this.grenades--;
    const geo = new THREE.SphereGeometry(0.08, 8, 8);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a4a2a, roughness: 0.6 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(this.camera.position);
    const dir = new THREE.Vector3(0, 0.3, -1).applyQuaternion(this.camera.quaternion).normalize();
    const vel = dir.multiplyScalar(12);
    this.scene.add(mesh);
    this.grenadesList.push({ mesh, vel, fuse: 2.5 });
    this.updateStats();
  }

  private updateGrenades(dt: number) {
    this.grenadesList = this.grenadesList.filter((g) => {
      g.fuse -= dt;
      g.vel.y -= 9.8 * dt;
      g.mesh.position.add(g.vel.clone().multiplyScalar(dt));

      // Ground bounce
      if (g.mesh.position.y < 0.1) {
        g.mesh.position.y = 0.1;
        g.vel.y *= -0.4;
        g.vel.x *= 0.7;
        g.vel.z *= 0.7;
      }

      if (g.fuse <= 0) {
        this.createExplosion(g.mesh.position.clone());
        this.scene.remove(g.mesh);
        return false;
      }
      return true;
    });
  }

  private explodeBarrel(barrel: Barrel) {
    if (barrel.exploded) return;
    barrel.exploded = true;
    this.scene.remove(barrel.mesh);
    this.createExplosion(barrel.pos.clone());
  }

  private updateHealthBar(enemy: Enemy) {
    const pct = Math.max(0, enemy.hp / enemy.maxHp);
    if (!this.hpBarCanvas) {
      this.hpBarCanvas = document.createElement('canvas');
      this.hpBarCanvas.width = 64;
      this.hpBarCanvas.height = 8;
      this.hpBarCtx = this.hpBarCanvas.getContext('2d')!;
      this.hpBarTex = new THREE.CanvasTexture(this.hpBarCanvas);
    }
    const ctx = this.hpBarCtx!;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, 64, 8);
    ctx.fillStyle = pct > 0.5 ? '#22c55e' : pct > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(2, 2, Math.max(0, 60 * pct), 4);
    this.hpBarTex!.needsUpdate = true;
    const spriteMat = enemy.hpBar.material as THREE.SpriteMaterial;
    if (!spriteMat.map) {
      spriteMat.map = this.hpBarTex;
    }
  }

  private spawnTracer(start: THREE.Vector3, end: THREE.Vector3) {
    const item = this.getPoolItem(this.tracerPool);
    if (!item) return;
    const dist = start.distanceTo(end);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const mesh = item.mesh;
    mesh.scale.set(1, dist, 1);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.opacity = 0.9;
    mesh.visible = true;
    item.active = true;
    item.lifetime = 0.06;
  }

  private flashMuzzle() {
    if (!this.muzzleLight || !this.muzzleMesh) return;
    // Position muzzle flash at barrel tip per weapon
    const w = this.currentWeapon;
    const flashZ = w === 'pistol' ? -0.4 : w === 'shotgun' ? -0.85 : -0.8;
    const flashY = w === 'pistol' ? -0.13 : w === 'shotgun' ? -0.13 : -0.14;
    const flashX = this.isADS ? 0 : 0.14;
    this.muzzleMesh.position.set(flashX, flashY, flashZ);
    this.muzzleLight.position.set(flashX, flashY, flashZ);
    this.muzzleLight.intensity = 22;
    this.muzzleLight.distance = 18;
    this.muzzleLightTimer = 0.08;
    this.muzzleMesh.visible = true;
    this.muzzleMesh.rotation.z = Math.random() * Math.PI;
    this.muzzleMesh.scale.setScalar(1.2 + Math.random() * 0.6);
    this.cameraShake = Math.min(this.cameraShake + (w === 'pistol' ? 0.025 : w === 'sniper' || w === 'launcher' ? 0.09 : 0.04), 0.18);
    if (this.muzzleTimeout) clearTimeout(this.muzzleTimeout);
    this.muzzleTimeout = setTimeout(() => {
      if (this.muzzleMesh) this.muzzleMesh.visible = false;
    }, 45);
  }

  private toggleFlashlight() {
    this.flashlightOn = !this.flashlightOn;
    if (this.flashlight) this.flashlight.intensity = this.flashlightOn ? 4 : 0;
  }

  // ─── PLAYER DAMAGE ───

  private takeDamage(amount: number, sourcePos: THREE.Vector3) {
    if (this.dead || this.damageCooldown > 0 || this.safeZoneActive) return;
    let dmg = amount * (1 - this.damageReduction);
    // Glass cannon modifier: player takes lethal damage
    if (this.currentWaveModifier?.type === 'glassCannon') {
      dmg = this.hp; // Instant death
    }
    // Juggernaut shield absorbs first 20 damage
    if (this.juggernautShield > 0) {
      const absorbed = Math.min(this.juggernautShield, dmg);
      this.juggernautShield -= absorbed;
      dmg -= absorbed;
    }
    if (dmg <= 0) return;
    this.hp -= dmg;
    this.damageCooldown = 0.3;
    this.healthRegenTimer = 0;
    this.damageTaken += dmg;
    this.killstreak = 0;
    this.scoreMultiplier = 1;
    this.comboKills = 0;
    this.comboTimer = 0;
    this.events.onCombo?.(1);
    this.waveDamageTaken += dmg;
    this.suppressedTimer = 1.5;
    // Screen flash — red on damage
    this.screenFlashIntensity = 1;
    this.screenFlashColor = 0xff0000;
    // Haptic feedback — damage taken
    if (navigator.vibrate) navigator.vibrate([40, 50, 40, 50, 80]);
    const dir = new THREE.Vector3().subVectors(sourcePos, this.camera.position);
    const angle = Math.atan2(dir.x, dir.z);
    this.events.onDamage?.(angle);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.events.onDeath?.();
      // Multiplayer: send kill event with last hitter as killer
      if (this.mpClient && this.mpClient.isConnected && this.mpLastHitBy && !this.mpGameOver) {
        this.mpClient.sendKill({
          killerId: this.mpLastHitBy,
          victimId: this.mpClient.myId,
          weapon: this.mpLastHitWeapon,
          isHeadshot: this.mpLastHitHeadshot,
          timestamp: Date.now(),
        });
        this.mpRespawnTimer = 3;
        // Death cam — look at killer
        const killer = this.remotePlayers.get(this.mpLastHitBy);
        if (killer) {
          this.mpDeathCamTarget.copy(killer.group.position);
          this.mpDeathCamTimer = 2;
        }
        this.mpLastHitBy = null;
      }
    }
    this.updateStats();
  }

  // ─── STATS ───

  private updateStats() {
    const w = WEAPONS[this.currentWeapon];
    // Find nearest enemy for compass
    let nearestAngle: number | null = null;
    let nearestDist = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = this.camera.position.distanceTo(e.group.position);
      if (d < nearestDist && d < 30) {
        nearestDist = d;
        const dir = new THREE.Vector3().subVectors(e.group.position, this.camera.position);
        nearestAngle = Math.atan2(dir.x, dir.z);
      }
    }
    this.nearbyEnemyAngle = nearestAngle;
    this.stats = {
      kills: this.stats.kills,
      shotsFired: this.stats.shotsFired,
      shotsHit: this.stats.shotsHit,
      hp: Math.ceil(this.hp),
      maxHp: this.maxHp,
      stamina: Math.ceil(this.stamina),
      maxStamina: this.maxStamina,
      ammo: this.ammo[this.currentWeapon],
      magSize: Math.round(w.magSize * (1 + (this.weaponUpgrades.magSize || 0) * UPGRADES.magSize.effectPerLevel)),
      weaponName: w.name,
      weaponKey: this.currentWeapon,
      grenades: this.grenades,
      wave: this.wave,
      enemiesAlive: this.enemies.filter((e) => !e.dead).length,
      killstreak: this.killstreak,
      score: this.score,
      headshots: this.headshots,
      damageDealt: Math.round(this.damageDealt),
      damageTaken: Math.round(this.damageTaken),
      compassEnemy: nearestAngle,
      crosshairSpread: this.crosshairSpread,
      isLeaning: this.leanDir,
      suppressed: this.suppressedTimer > 0,
      radarBlips: this.uavTimer > 0
        ? this.enemies.filter(e => !e.dead).map(e => ({ x: e.group.position.x - this.camera.position.x, z: e.group.position.z - this.camera.position.z, type: e.type, isBoss: e.isMiniBoss }))
        : this.enemies.filter(e => !e.dead && e.group.position.distanceTo(this.camera.position) < 12).map(e => ({ x: e.group.position.x - this.camera.position.x, z: e.group.position.z - this.camera.position.z, type: e.type, isBoss: e.isMiniBoss })),
      radarObjective: this.currentObjective.targetPos
        ? { x: this.currentObjective.targetPos.x - this.camera.position.x, z: this.currentObjective.targetPos.z - this.camera.position.z, type: this.currentObjective.type }
        : null,
      uavActive: this.uavTimer > 0,
      scoreMultiplier: this.scoreMultiplier,
      comboTimer: this.comboTimer,
      isBossWave: this.isBossWave,
      bossHp: this.bossEnemy ? this.bossEnemy.hp : 0,
      bossMaxHp: this.bossEnemy ? this.bossEnemy.maxHp : 0,
      waveDamageTaken: Math.round(this.waveDamageTaken),
      waveHeadshots: this.waveHeadshots,
      waveStartTime: this.waveStartTime,
      isEliteWave: this.isEliteWave,
      waveModifier: this.currentWaveModifier,
      spectatorTarget: this.mpSpectatorTarget ? (() => {
        const rp = this.remotePlayers.get(this.mpSpectatorTarget);
        return rp ? { name: rp.name, team: rp.team } : null;
      })() : null,
      lowAmmo: this.ammo[this.currentWeapon] <= Math.ceil(this.stats.magSize * 0.25),
      dominationZones: this.dominationZones.map(z => ({ id: z.id, x: z.pos.x - this.camera.position.x, z: z.pos.z - this.camera.position.z, radius: z.radius, team: z.team, progress: z.progress, contested: z.contested })),
      safeZoneTimer: Math.ceil(this.safeZoneTimer),
      currentMap: this.mapConfig.name,
      isADS: this.isADS,
    };
    this.events.onStatsUpdate?.(this.stats);
  }

  // ─── MOVEMENT ───

  private updateMovement(dt: number) {
    if (this.dead) {
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.updateAI(dt);
      return;
    }

    this.damageCooldown = Math.max(0, this.damageCooldown - dt);
    this.suppressedTimer = Math.max(0, this.suppressedTimer - dt);
    this.vaultCooldown = Math.max(0, this.vaultCooldown - dt);
    this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);

    // Safe zone countdown
    if (this.safeZoneActive) {
      this.safeZoneTimer -= dt;
      if (this.safeZoneTimer <= 0) {
        this.safeZoneActive = false;
        this.safeZoneTimer = 0;
        this.events.onSafeZoneEnd?.();
      }
    }

    // Combo timer decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.scoreMultiplier = 1;
        this.comboKills = 0;
        this.events.onCombo?.(1);
      }
    }

    // Screen flash decay
    this.screenFlashIntensity = Math.max(0, this.screenFlashIntensity - dt * 3);

    // Blood pool lifetime decay
    this.bloodPools = this.bloodPools.filter(bp => {
      bp.lifetime -= dt;
      if (bp.lifetime <= 0) {
        this.scene.remove(bp.mesh);
        (bp.mesh.material as THREE.Material).dispose();
        (bp.mesh.geometry as THREE.BufferGeometry).dispose();
        return false;
      }
      // Fade out
      (bp.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, bp.lifetime / 10);
      return true;
    });

    // Destructible cover debris physics
    this.destructibleCover.forEach(cover => {
      cover.pieces = cover.pieces.filter(piece => {
        const vel = piece.userData.velocity as THREE.Vector3;
        piece.position.add(vel.clone().multiplyScalar(dt));
        vel.y -= 9.8 * dt;
        if (piece.position.y < 0.1) { piece.position.y = 0.1; vel.y *= -0.3; vel.x *= 0.5; vel.z *= 0.5; }
        piece.userData.lifetime -= dt;
        if (piece.userData.lifetime <= 0) {
          this.scene.remove(piece);
          (piece.material as THREE.Material).dispose();
          (piece.geometry as THREE.BufferGeometry).dispose();
          return false;
        }
        return true;
      });
    });

    // Crosshair spread recovery
    this.crosshairSpread = Math.max(0, this.crosshairSpread - dt * 3);

    // Lean interpolation
    const targetLean = this.leanDir === 'left' ? -0.5 : this.leanDir === 'right' ? 0.5 : 0;
    this.leanAmount += (targetLean - this.leanAmount) * 8 * dt;

    // Heartbeat when low HP
    if (this.hp < 30) {
      this.heartbeatTimer += dt;
      if (this.heartbeatTimer > 1.2) {
        this.heartbeatTimer = 0;
        this.playHeartbeat();
      }
    }

    // Ambient warfare sounds
    this.ambientTimer += dt;
    if (this.ambientTimer > 5 + Math.random() * 8) {
      this.ambientTimer = 0;
      this.playAmbientWarfare();
    }

    // Dynamic music
    this.updateMusic(dt);

    // Weather
    this.updateWeather(dt);

    // Bullet decals
    this.updateBulletDecals(dt);

    // Health regen — after 5s without damage, regen 5hp/s up to 75% of max
    if (this.hp < this.maxHp * 0.75) {
      this.healthRegenTimer += dt;
      if (this.healthRegenTimer > 5) {
        const prevHp = Math.ceil(this.hp);
        this.hp = Math.min(this.maxHp * 0.75, this.hp + 5 * dt);
        if (Math.ceil(this.hp) !== prevHp) this.updateStats();
      }
    } else {
      this.healthRegenTimer = 0;
    }

    // Stamina system — sprint drains stamina, regen when not sprinting
    if (this.isSprinting) {
      this.stamina = Math.max(0, this.stamina - 25 * dt);
      this.staminaRegenTimer = 0;
      if (this.stamina <= 0) this.isSprinting = false;
    } else {
      this.staminaRegenTimer += dt;
      if (this.staminaRegenTimer > 1.5) {
        this.stamina = Math.min(this.maxStamina, this.stamina + 20 * dt);
      }
    }

    // Reload timer
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) this.finishReload();
    }

    // Sprint check — requires stamina
    this.isSprinting = ((this.keys['ShiftLeft'] && this.keys['KeyW']) || (this.touchSprint && this.touchMoveY < -0.3)) && !this.isCrouching && !this.isADS && this.stamina > 0;

    // Slide
    if (this.slideTimer > 0) {
      this.slideTimer -= dt;
      this.camera.position.add(this.slideVel.clone().multiplyScalar(dt));
      this.slideVel.multiplyScalar(0.92);
      if (this.slideTimer <= 0) this.isCrouching = true;
    } else if (this.isSprinting && this.keys['ControlLeft'] && this.slideTimer <= 0) {
      // Initiate slide
      this.slideTimer = 0.8;
      const fwd = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      this.slideVel = fwd.multiplyScalar(10);
    }

    // Sprint acceleration curve — ease into sprint
    const sprintTarget = this.isSprinting ? 1 : 0;
    this.sprintAccel += (sprintTarget - this.sprintAccel) * 6 * dt;
    let speed = this.characterCfg.baseSpeed * this.armorCfg.speedMult;
    if (this.isCrouching) speed *= 0.4;
    else if (this.isSprinting) speed *= 1.0 + 0.5 * this.sprintAccel;
    if (this.isADS) speed *= 0.5;

      // Input direction
    const inputDir = new THREE.Vector3();
    let moving = false;

    if (this.slideTimer <= 0) {
      if (this.keys['KeyW']) inputDir.z -= 1;
      if (this.keys['KeyS']) inputDir.z += 1;
      if (this.keys['KeyA']) inputDir.x -= 1;
      if (this.keys['KeyD']) inputDir.x += 1;
      // Touch movement input
      if (this.touchMoveY < -0.1) inputDir.z -= 1;
      if (this.touchMoveY > 0.1) inputDir.z += 1;
      if (this.touchMoveX < -0.1) inputDir.x -= 1;
      if (this.touchMoveX > 0.1) inputDir.x += 1;

      if (inputDir.length() > 0) {
        moving = true;
        inputDir.normalize();
        // Target velocity in local space
        this.targetVelX = inputDir.x * speed;
        this.targetVelZ = inputDir.z * speed;
      } else {
        this.targetVelX = 0;
        this.targetVelZ = 0;
      }

      // Smooth acceleration / deceleration
      const accelRate = moving ? 12 : 8;
      this.velX += (this.targetVelX - this.velX) * accelRate * dt;
      this.velZ += (this.targetVelZ - this.velZ) * accelRate * dt;

      // Apply movement in world space
      const moveDir = new THREE.Vector3(this.velX, 0, this.velZ).multiplyScalar(dt);
      moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

      const next = this.camera.position.clone().add(moveDir);
      next.x = Math.max(-24, Math.min(24, next.x));
      next.z = Math.max(-24, Math.min(24, next.z));

      // Collision with collidables — check X and Z separately to allow sliding along walls
      for (const col of this.collidables) {
        let box = this.colliderBoxes.get(col);
        if (!box) {
          box = new THREE.Box3().setFromObject(col);
          this.colliderBoxes.set(col, box);
        }
        // Try X movement only
        const tryX = this.camera.position.x + moveDir.x;
        if (tryX > box.min.x - 0.5 && tryX < box.max.x + 0.5 &&
            this.camera.position.z > box.min.z - 0.5 && this.camera.position.z < box.max.z + 0.5) {
          const top = box.max.y;
          if (this.camera.position.y >= top - 0.1) {
            // Can walk on top — allow
          } else {
            next.x = this.camera.position.x;
          }
        }
        // Try Z movement only
        const tryZ = this.camera.position.z + moveDir.z;
        if (this.camera.position.x > box.min.x - 0.5 && this.camera.position.x < box.max.x + 0.5 &&
            tryZ > box.min.z - 0.5 && tryZ < box.max.z + 0.5) {
          const top = box.max.y;
          if (this.camera.position.y >= top - 0.1) {
            // Can walk on top — allow
          } else {
            next.z = this.camera.position.z;
          }
        }
      }

      // Footstep cycle and camera bob
      const currentSpeed = Math.sqrt(this.velX * this.velX + this.velZ * this.velZ);
      if (currentSpeed > 0.5) {
        this.walkCycle += dt * (this.isSprinting ? 14 : 10);
        // Footstep sound
        if (Math.sin(this.walkCycle) > 0.98 && this.footstepCooldown <= 0) {
          this.playFootstepSound(this.camera.position);
          this.footstepCooldown = this.isSprinting ? 0.3 : 0.45;
        }
      }
      this.footstepCooldown = Math.max(0, (this.footstepCooldown || 0) - dt);

      // Strafe tilt — lean camera slightly when strafing
      const strafeTarget = this.velX / speed * 0.03;
      this.strafeTilt += (strafeTarget - this.strafeTilt) * 6 * dt;

      const baseY = this.isCrouching ? 1.2 : 1.7;
      const bobAmount = this.isSprinting ? 0.04 : 0.02;
      const bobY = moving && this.isGrounded ? Math.sin(this.walkCycle) * bobAmount : 0;
      // Camera shake from shooting
      const shakeX = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake : 0;
      const shakeY = this.cameraShake > 0 ? (Math.random() - 0.5) * this.cameraShake : 0;

      // Jump / gravity physics
      if (!this.isGrounded) {
        this.verticalVel -= 18 * dt; // gravity
        this.camera.position.y += this.verticalVel * dt;
        if (this.camera.position.y <= baseY) {
          this.camera.position.y = baseY;
          this.verticalVel = 0;
          this.isGrounded = true;
          this.landingDip = Math.min(0.2, Math.abs(this.verticalVel) * 0.02);
          if (navigator.vibrate) navigator.vibrate([10, 20, 10]);
        }
      }

      next.y = this.isGrounded ? (baseY + bobY - this.landingDip) : this.camera.position.y;
      this.camera.position.copy(next);
      // Store shake for camera rotation application
      this._shakeX = shakeX;
      this._shakeY = shakeY;
    }

    // FOV for ADS / sprint — weapon-specific zoom for sniper scope
    const baseFOV = this.settings.fov;
    let adsZoom = 0.6;
    if (this.currentWeapon === 'sniper') adsZoom = 0.22;
    else if (this.currentWeapon === 'dmr') adsZoom = 0.45;
    const targetFOV = this.isADS ? baseFOV * adsZoom : this.isSprinting ? baseFOV * 1.13 : baseFOV;
    this.camera.fov += (targetFOV - this.camera.fov) * 8 * dt;
    this.camera.updateProjectionMatrix();

    // Camera rotation with lean offset + strafe tilt + shake
    // Touch look input
    if (Math.abs(this.touchLookX) > 0.01 || Math.abs(this.touchLookY) > 0.01) {
      const sens = this.isADS ? this.settings.scopeSensitivity : this.settings.lookSensitivity;
      const touchSens = 0.003 * sens;
      this.yaw -= this.touchLookX * touchSens;
      this.pitch -= this.touchLookY * touchSens;
      this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
      this.mouseDeltaX += this.touchLookX * touchSens;
      this.mouseDeltaY += this.touchLookY * touchSens;
    }
    // Gyro aim — fine adjustments via device tilt
    if (this.settings.gyroAim && (Math.abs(this.gyroYaw) > 0.001 || Math.abs(this.gyroPitch) > 0.001)) {
      const gyroSens = this.isADS ? this.settings.scopeSensitivity * 0.5 : this.settings.lookSensitivity * 0.3;
      this.yaw -= this.gyroYaw * gyroSens;
      this.pitch -= this.gyroPitch * gyroSens;
      this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
    }
    // Aim assist magnetism — when ADS, gently pull toward nearest enemy
    if (this.aimAssistStrength > 0 && this.isADS) {
      const assist = this.getAimAssistCorrection();
      this.yaw += assist.yaw;
      this.pitch += assist.pitch;
      this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
    }
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw + this.recoil * 0.3 + (this._shakeX || 0);
    this.camera.rotation.x = this.pitch + this.recoil * 0.5 + (this._shakeY || 0);
    this.camera.rotation.z = this.leanAmount * 0.15 + this.strafeTilt;

    // Apply lean position offset
    const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    this.camera.position.add(right.multiplyScalar(this.leanAmount * 0.3 - (this.camera.position.x > 0 ? 0 : 0)));

    // Recoil recovery
    this.recoil = Math.max(0, this.recoil - dt * 3);
    const bob = moving ? Math.sin(this.walkCycle) * 0.01 : 0;
    // Weapon idle sway — breathing pattern when standing still
    const breathIntensity = moving ? 1 : 2.5;
    const swayX = Math.sin(this.time * 1.5) * 0.005 * breathIntensity * (this.isADS ? 0.3 : 1);
    const swayY = Math.cos(this.time * 1.3) * 0.004 * breathIntensity * (this.isADS ? 0.3 : 1);
    // Subtle breathing rotation when idle
    const breathRotX = moving ? 0 : Math.sin(this.time * 0.8) * 0.008 * (this.isADS ? 0.2 : 1);
    const breathRotZ = moving ? 0 : Math.cos(this.time * 0.6) * 0.006 * (this.isADS ? 0.2 : 1);

    // Procedural weapon sway from mouse look — lag behind camera rotation
    this.weaponSwayTargetX = this.mouseDeltaX * 0.015;
    this.weaponSwayTargetY = -this.mouseDeltaY * 0.015;
    this.weaponSwayX += (this.weaponSwayTargetX - this.weaponSwayX) * 6 * dt;
    this.weaponSwayY += (this.weaponSwayTargetY - this.weaponSwayY) * 6 * dt;
    // Decay mouse delta
    this.mouseDeltaX *= 0.8;
    this.mouseDeltaY *= 0.8;

    // Reload animation — dip weapon down and rotate
    let reloadDipY = 0;
    let reloadRotX = 0;
    if (this.reloading) {
      this.reloadAnimProgress = Math.min(1, this.reloadAnimProgress + dt * 2);
      const p = this.reloadAnimProgress;
      // Dip down in first half, come back up in second half
      const dip = p < 0.5 ? p * 2 : (1 - p) * 2;
      reloadDipY = -dip * 0.15;
      reloadRotX = dip * 0.8;
    } else {
      this.reloadAnimProgress = 0;
    }

    if (this.weaponGroup) {
      const adsX = this.isADS ? 0 : 0.16;
      const adsY = this.isADS ? -0.09 : -0.19;
      this.weaponGroup.position.set(
        adsX + swayX + this.weaponSwayX,
        adsY - this.recoil * 0.2 + bob + swayY + this.weaponSwayY + reloadDipY,
        -0.32 - this.recoil * 0.8
      );
      this.weaponGroup.rotation.set(
        this.recoil * 0.5 + reloadRotX + breathRotX,
        this.isADS ? 0 : 0.06 + this.weaponSwayX * 0.5,
        -0.04 + swayX * 2 + this.weaponSwayY + breathRotZ
      );
    }

    // Auto-fire for auto weapons (mouse or touch)
    if ((this.mouseHeld || this.touchFiring) && this.isLocked && !this.dead) {
      const w = WEAPONS[this.currentWeapon];
      if (w.auto) this.fire();
    }
    // Auto-fire assist — fires when crosshair is on enemy (mobile)
    if (this.autoFireEnabled && this.isLocked && !this.dead && !this.reloading) {
      const w = WEAPONS[this.currentWeapon];
      const now = performance.now();
      const effectiveFireRate = this.perk === 'doubletap' ? w.fireRate * 0.8 : w.fireRate;
      if (now - this.lastShot >= effectiveFireRate) {
        // Check if crosshair is near an enemy
        const ray = new THREE.Raycaster();
        const dir = new THREE.Vector3();
        this.camera.getWorldDirection(dir);
        ray.set(this.camera.position, dir);
        ray.far = 100;
        let hitEnemy = false;
        for (const e of this.enemies) {
          if (e.dead) continue;
          const hit = ray.intersectObject(e.group, true);
          if (hit.length > 0) { hitEnemy = true; break; }
        }
        if (hitEnemy) this.fire();
      }
    }

    // Pickups
    this.checkPickups();

    // Grenades
    this.updateGrenades(dt);

    // Pickup bob
    this.pickups.forEach((p) => {
      if (!p.taken) {
        p.mesh.position.y = 0.5 + Math.sin(this.time * 3 + p.bobOffset) * 0.1;
        p.mesh.rotation.y += dt * 1.5;
      }
    });

    // Enemies hold position during safe zone
    if (!this.safeZoneActive) {
      this.updateAI(dt);
      this.updateWaves(dt);
    }
  }

  private checkPickups() {
    this.pickups.forEach((p) => {
      if (p.taken) return;
      const d = this.camera.position.distanceTo(p.mesh.position);
      if (d < 2.0) {
        if (p.type === 'health') {
          this.hp = Math.min(this.maxHp, this.hp + 50);
          p.taken = true;
          this.scene.remove(p.mesh);
        } else if (p.type === 'ammo') {
          this.reserveAmmo.smg += 30;
          this.reserveAmmo.shotgun += 6;
          this.reserveAmmo.rifle += 30;
          this.reserveAmmo.sniper += 5;
          this.reserveAmmo.dmr += 10;
          this.reserveAmmo.lmg += 30;
          this.reserveAmmo.launcher += 2;
          this.reserveAmmo.plasma += 10;
          this.reserveAmmo.pistol = 999;
          p.taken = true;
          this.scene.remove(p.mesh);
        } else if (p.type === 'armor' && p.armorType) {
          const newArmor = ARMORS[p.armorType];
          this.armorCfg = newArmor;
          this.damageReduction = newArmor.damageReduction;
          const oldHpRatio = this.hp / this.maxHp;
          this.maxHp = this.characterCfg.baseHp + newArmor.hpBonus;
          if (this.perk === 'juggernaut') this.maxHp += 50;
          this.hp = Math.min(this.maxHp, Math.round(this.maxHp * oldHpRatio) + 25);
          p.taken = true;
          this.scene.remove(p.mesh);
        } else if (p.type === 'weapon' && p.weaponKey) {
          const wKey = p.weaponKey;
          if (this.currentWeapon === wKey) return;
          this.currentWeapon = wKey;
          const w = WEAPONS[wKey];
          const upgradedMag = Math.round(w.magSize * (1 + (this.weaponUpgrades.magSize || 0) * UPGRADES.magSize.effectPerLevel));
          this.ammo[wKey] = upgradedMag;
          this.buildWeapon();
          p.taken = true;
          this.scene.remove(p.mesh);
        }
        this.updateStats();
      }
    });
  }

  // ─── AI ───

  private updateAI(dt: number) {
    this.enemies.forEach((enemy, index) => {
      if (enemy.dead) {
        // Ragdoll death — fall in direction of last hit
        if (enemy.deathTimer > 0) {
          enemy.deathTimer -= dt;
          const t = 1 - enemy.deathTimer / 2.0;
          // Fall direction based on hit direction
          if (enemy.deathDir) {
            const fallAngle = Math.atan2(enemy.deathDir.x, enemy.deathDir.z);
            enemy.group.rotation.x = Math.min(t * 1.5, Math.PI / 2);
            enemy.group.rotation.z = Math.sin(t * Math.PI) * 0.3 * Math.sign(enemy.deathDir.x);
            enemy.group.rotation.y = fallAngle;
          } else {
            enemy.group.rotation.x = Math.min(t * 1.5, Math.PI / 2);
          }
          enemy.group.position.y -= dt * 0.5;
          // Fade out meshes
          const fade = Math.max(0, enemy.deathTimer / 2.0);
          enemy.meshes.forEach((m) => {
            const mat = m.material as THREE.MeshStandardMaterial;
            if (mat.transparent !== undefined) {
              mat.transparent = true;
              mat.opacity = fade;
            }
          });
          if (enemy.deathTimer <= 0) {
            this.scene.remove(enemy.group);
          }
        }
        return;
      }
      const dist = this.camera.position.distanceTo(enemy.group.position);
      const toPlayer = new THREE.Vector3().subVectors(this.camera.position, enemy.group.position).normalize();

      // State machine — enhanced with flank, cover, suppress
      if (dist < enemy.optimalRange + 5) {
        if (enemy.state !== 'attack' && enemy.state !== 'flank' && enemy.state !== 'cover' && enemy.state !== 'suppress') {
          // Assign role based on type and index
          if (enemy.type === 'heavy' && index % 3 === 0) {
            enemy.state = 'suppress';
          } else if ((enemy.type === 'grunt' || enemy.type === 'shotgunner') && enemy.stateTimer > 3) {
            enemy.state = 'flank';
            enemy.stateTimer = 0;
            // Pick flank direction
            enemy.strafeDir = Math.random() > 0.5 ? 1 : -1;
          } else if (enemy.type === 'rifleman' && Math.random() < 0.3 && enemy.stateTimer > 5) {
            enemy.state = 'cover';
            enemy.stateTimer = 0;
            // Find nearest cover
            enemy.coverPos = this.findNearestCover(enemy.group.position);
          } else {
            enemy.state = 'attack';
          }
        }
      } else if (dist < (this.perk === 'ghost' ? 15 : 30)) {
        enemy.state = 'chase';
      } else {
        if (enemy.state !== 'patrol') enemy.state = 'patrol';
      }

      // Retreat if low HP
      if (enemy.hp < enemy.maxHp * 0.25 && enemy.type !== 'heavy') {
        enemy.state = 'retreat';
      }

      enemy.stateTimer += dt;
      const forward = toPlayer.clone();
      const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
      let move = new THREE.Vector3();

      // Footstep sounds
      enemy.footstepTimer += dt;
      const stepInterval = enemy.isMiniBoss ? 0.4 : 0.6 / (enemy.speed / 2);
      if (enemy.footstepTimer > stepInterval && (enemy.state === 'chase' || enemy.state === 'flank' || enemy.state === 'attack')) {
        enemy.footstepTimer = 0;
        this.playFootstepSound(enemy.group.position);
      }

      switch (enemy.state) {
        case 'patrol':
          const toPatrol = new THREE.Vector3().subVectors(enemy.patrolTarget, enemy.group.position);
          if (toPatrol.length() < 2 || enemy.stateTimer > 8) {
            enemy.patrolTarget.set((Math.random() - 0.5) * 30, 0, (Math.random() - 0.5) * 30);
            enemy.stateTimer = 0;
          }
          move = toPatrol.normalize().multiplyScalar(enemy.speed * 0.5 * dt);
          break;

        case 'chase':
          move = forward.multiplyScalar(enemy.speed * dt);
          break;

        case 'attack':
          // Maintain optimal range
          if (dist > enemy.optimalRange) {
            move = forward.multiplyScalar(enemy.speed * dt);
          } else if (dist < enemy.optimalRange - 3) {
            move = forward.multiplyScalar(-enemy.speed * dt);
          }
          // Strafe
          enemy.strafeDir = Math.sin(enemy.stateTimer * 1.5) > 0 ? 1 : -1;
          move.add(right.multiplyScalar(enemy.strafeDir * enemy.speed * 0.7 * dt));
          break;

        case 'flank':
          // Move to the side to surround player, switch to attack after 4s
          if (enemy.stateTimer > 4) {
            enemy.state = 'attack';
            enemy.stateTimer = 0;
          }
          move = right.multiplyScalar(enemy.strafeDir * enemy.speed * 1.2 * dt);
          // Also close distance slightly
          if (dist > enemy.optimalRange) move.add(forward.multiplyScalar(enemy.speed * 0.5 * dt));
          break;

        case 'cover':
          // Move to cover position, pop out to shoot periodically
          if (enemy.coverPos) {
            const toCover = new THREE.Vector3().subVectors(enemy.coverPos, enemy.group.position);
            if (toCover.length() < 1.5) {
              // In cover — stay for 2s then attack
              if (enemy.stateTimer > 2) {
                enemy.state = 'attack';
                enemy.stateTimer = 0;
              }
            } else {
              move = toCover.normalize().multiplyScalar(enemy.speed * dt);
            }
          } else {
            enemy.state = 'attack';
          }
          break;

        case 'suppress':
          // Heavy fires rapidly while slowly advancing, doesn't strafe
          if (dist > enemy.optimalRange) {
            move = forward.multiplyScalar(enemy.speed * 0.5 * dt);
          }
          break;

        case 'retreat':
          move = forward.multiplyScalar(-enemy.speed * 1.2 * dt);
          break;
      }

      // ── Special enemy behaviors ──

      // Charger: sprint directly at player, melee damage on contact
      if (enemy.type === 'charger') {
        enemy.state = 'chase';
        move = forward.multiplyScalar(enemy.speed * dt);
        if (dist < 2.5) {
          const now = performance.now();
          if (now - enemy.lastShot > enemy.fireRate) {
            enemy.lastShot = now;
            this.takeDamage(enemy.damage, enemy.group.position);
            this.cameraShake = Math.min(this.cameraShake + 0.15, 0.2);
          }
        }
      }

      // Bomber: chase player, explode on proximity or death
      if (enemy.type === 'bomber') {
        enemy.state = 'chase';
        move = forward.multiplyScalar(enemy.speed * dt);
        // Glow pulse
        const pulse = 0.5 + Math.sin(this.time * 8) * 0.5;
        enemy.meshes.forEach(m => {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat.emissive) { mat.emissive.setRGB(pulse, pulse * 0.3, 0); mat.emissiveIntensity = pulse; }
        });
        if (dist < 3.5) {
          // Detonate
          this.createExplosion(enemy.group.position.clone());
          this.takeDamage(enemy.damage, enemy.group.position);
          this.cameraShake = Math.min(this.cameraShake + 0.3, 0.3);
          enemy.hp = 0;
          enemy.dead = true;
          enemy.deathTimer = 1.0;
          this.stats.kills++;
          this.waveKillCount++;
          this.score += 100;
          enemy.hpBar.visible = false;
        }
      }

      // Medic: heal nearby allies periodically
      if (enemy.type === 'medic' && !enemy.dead) {
        if (dist > enemy.optimalRange) enemy.state = 'chase';
        else enemy.state = 'attack';
        // Heal aura every 3s
        const now = performance.now();
        if (now - enemy.lastShot > 3000) {
          enemy.lastShot = now;
          this.enemies.forEach(other => {
            if (other === enemy || other.dead || other.hp >= other.maxHp) return;
            const d = other.group.position.distanceTo(enemy.group.position);
            if (d < 8) {
              other.hp = Math.min(other.maxHp, other.hp + 30);
              this.updateHealthBar(other);
            }
          });
        }
      }

      // Sniper doesn't move much
      if (enemy.type === 'sniper' && enemy.state === 'attack') {
        move.multiplyScalar(0.1);
      }

      enemy.group.position.add(move);
      enemy.group.position.x = Math.max(-23, Math.min(23, enemy.group.position.x));
      enemy.group.position.z = Math.max(-23, Math.min(23, enemy.group.position.z));

      // Enemy collision with cover
      for (const col of this.collidables) {
        let box = this.colliderBoxes.get(col);
        if (!box) {
          box = new THREE.Box3().setFromObject(col);
          this.colliderBoxes.set(col, box);
        }
        const ep = enemy.group.position;
        if (ep.x > box.min.x - 0.5 && ep.x < box.max.x + 0.5 && ep.z > box.min.z - 0.5 && ep.z < box.max.z + 0.5) {
          if (ep.y < box.max.y - 0.5) {
            // Push enemy out along the shorter axis
            const dxMin = Math.abs(ep.x - box.min.x);
            const dxMax = Math.abs(ep.x - box.max.x);
            const dzMin = Math.abs(ep.z - box.min.z);
            const dzMax = Math.abs(ep.z - box.max.z);
            const minPen = Math.min(dxMin, dxMax, dzMin, dzMax);
            if (minPen === dxMin) ep.x = box.min.x - 0.5;
            else if (minPen === dxMax) ep.x = box.max.x + 0.5;
            else if (minPen === dzMin) ep.z = box.min.z - 0.5;
            else ep.z = box.max.z + 0.5;
          }
        }
      }

      // Keep sniper elevated
      if (enemy.type === 'sniper') {
        enemy.group.position.y = 4;
      } else {
        const bob = Math.abs(Math.sin((this.time + index) * 6)) * 0.05;
        enemy.group.position.y = bob;
      }

      // Smooth yaw
      const targetYaw = Math.atan2(toPlayer.x, toPlayer.z) + Math.PI;
      let yawDiff = targetYaw - enemy.group.rotation.y;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      enemy.group.rotation.y += yawDiff * 5 * dt;
      enemy.group.rotation.z = Math.sin((this.time + index) * 2) * 0.03;

      // Hit flash — apply to all body meshes
      if (enemy.hitFlash > 0) {
        enemy.hitFlash -= dt;
        const flash = enemy.hitFlash;
        enemy.meshes.forEach((m) => {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat.emissive) {
            mat.emissive.setRGB(flash * 3, flash * 3, flash * 3);
            mat.emissiveIntensity = flash * 2;
          }
        });
      } else {
        enemy.meshes.forEach((m) => {
          const mat = m.material as THREE.MeshStandardMaterial;
          if (mat.emissive) {
            mat.emissive.setRGB(0, 0, 0);
            mat.emissiveIntensity = 0;
          }
        });
      }

      // Enemy shooting — enhanced with suppression effect
      if ((enemy.state === 'attack' || enemy.state === 'suppress' || enemy.state === 'cover') && dist < enemy.optimalRange + 5) {
        const now = performance.now();
        const fireRate = enemy.state === 'suppress' ? enemy.fireRate * 0.6 : enemy.fireRate;
        if (now - enemy.lastShot > fireRate) {
          enemy.lastShot = now;

          // Throttled LOS check — only raycast every 0.2s, cache result
          enemy.losCheckTimer -= dt;
          if (enemy.losCheckTimer <= 0) {
            enemy.losCheckTimer = 0.2;
            const enemyEyePos = enemy.group.position.clone();
            enemyEyePos.y += 1.5;
            const dirToPlayer = new THREE.Vector3().subVectors(this.camera.position, enemyEyePos).normalize();
            const ray = new THREE.Raycaster(enemyEyePos, dirToPlayer, 0, dist);
            const hits = ray.intersectObjects(this.collidables, true);
            enemy.hasLOS = hits.length === 0 || hits[0].distance > dist - 1;
          }

          if (enemy.hasLOS) {
            // Has LOS — shoot
            const enemyEyePos = enemy.group.position.clone();
            enemyEyePos.y += 1.5;
            const dirToPlayer = new THREE.Vector3().subVectors(this.camera.position, enemyEyePos).normalize();
            this.spawnEnemyTracer(enemyEyePos, this.camera.position.clone());
            // Enemy muzzle flash
            const flashPos = enemyEyePos.clone().add(dirToPlayer.clone().multiplyScalar(0.8));
            this.createEnemyMuzzleFlash(flashPos);
            this.playEnemyShootSound(enemy.group.position);
            // Accuracy based on distance, type, and player suppression
            let accuracy = enemy.type === 'sniper' ? 0.7 : enemy.type === 'heavy' ? 0.4 : 0.55;
            if (enemy.isMiniBoss) accuracy += 0.1;
            // Suppression: if player is suppressed, enemies are more accurate
            const dmg = enemy.damage * (0.5 + Math.random() * 0.5);
            if (Math.random() < accuracy) {
              this.takeDamage(dmg, enemy.group.position);
            } else {
              // Near miss — suppress the player
              this.suppressedTimer = Math.max(this.suppressedTimer, 1.0);
              // Bullet crack sound — enemy bullet passed close
              this.playPositionalSound(enemy.group.position, 2000, 'square', 0.08, 0.05);
              // Blue screen tint when suppressed
              this.screenFlashIntensity = Math.max(this.screenFlashIntensity, 0.3);
              this.screenFlashColor = 0x0044aa;
            }
          }
        }
      }
    });
  }

  private createEnemyMuzzleFlash(pos: THREE.Vector3) {
    if (!this.enemyFlashLight) return;
    this.enemyFlashLight.position.copy(pos);
    this.enemyFlashLight.intensity = 6;
    this.enemyFlashLight.visible = true;
    this.createImpactSparks(pos);
    setTimeout(() => { if (this.enemyFlashLight) this.enemyFlashLight.visible = false; }, 50);
  }

  private findNearestCover(fromPos: THREE.Vector3): THREE.Vector3 | null {
    let nearest: THREE.Vector3 | null = null;
    let nearestDist = Infinity;
    for (const col of this.collidables) {
      const box = this.colliderBoxes.get(col) || new THREE.Box3().setFromObject(col);
      this.colliderBoxes.set(col, box);
      const center = new THREE.Vector3();
      box.getCenter(center);
      const d = fromPos.distanceTo(center);
      if (d < nearestDist && d > 3 && d < 15) {
        nearestDist = d;
        // Position behind cover relative to player
        const toPlayer = new THREE.Vector3().subVectors(this.camera.position, center).normalize();
        nearest = center.clone().add(toPlayer.multiplyScalar(-2));
      }
    }
    return nearest;
  }

  private spawnEnemyTracer(start: THREE.Vector3, end: THREE.Vector3) {
    const item = this.getPoolItem(this.tracerPool);
    if (!item) return;
    const dist = start.distanceTo(end);
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const mesh = item.mesh;
    mesh.scale.set(1.5, dist, 1.5);
    mesh.position.copy(mid);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.setHex(0xff3333);
    mat.opacity = 0.7;
    mesh.visible = true;
    item.active = true;
    item.lifetime = 0.08;
  }

  // ─── MULTIPLAYER ───

  initMultiplayer(client: MultiplayerClient, mode: GameMode, scoreLimit: number) {
    this.mpClient = client;
    this.mpMode = mode;
    this.mpScoreLimit = scoreLimit;
    this.mpPreMatchCountdown = 3;

    this.mpClient.on('player_joined', (msg) => {
      const rp = new RemotePlayer({ id: msg.id, name: msg.name, team: msg.team });
      rp.triggerSpawnProtection(3);
      this.scene.add(rp.group);
      this.remotePlayers.set(msg.id, rp);
    });

    this.mpClient.on('player_left', (msg) => {
      const rp = this.remotePlayers.get(msg.id);
      if (rp) {
        rp.setDisconnected(true);
        // Remove after 10 seconds
        setTimeout(() => {
          if (this.remotePlayers.get(msg.id) === rp) {
            this.scene.remove(rp.group);
            rp.dispose();
            this.remotePlayers.delete(msg.id);
          }
        }, 10000);
      }
    });

    this.mpClient.on('sync', (msg) => {
      const rp = this.remotePlayers.get(msg.id);
      const state = msg.state as PlayerState;
      if (!rp) {
        const newRp = new RemotePlayer({ id: msg.id, name: state.name, team: state.team });
        this.scene.add(newRp.group);
        this.remotePlayers.set(msg.id, newRp);
        newRp.setTargetState(state.x, state.y, state.z, state.yaw, state.isDead, state.hp);
      } else {
        rp.setTargetState(state.x, state.y, state.z, state.yaw, state.isDead, state.hp);
        rp.kills = state.kills;
        rp.deaths = state.deaths;
        rp.score = state.score;
        // Clear disconnected flag if we receive sync again
        if (rp.isDisconnected) rp.setDisconnected(false);
      }
    });

    this.mpClient.on('shot', (msg) => {
      const origin = new THREE.Vector3(msg.originX, msg.originY, msg.originZ);
      const dir = new THREE.Vector3(msg.dirX, msg.dirY, msg.dirZ).normalize();
      const endPt = origin.clone().add(dir.multiplyScalar(50));
      this.spawnTracer(origin, endPt);
      this.createEnemyMuzzleFlash(origin);
    });

    this.mpClient.on('hit', (msg) => {
      if (msg.toId === this.mpClient!.myId) {
        // Track who hit us last for kill credit
        this.mpLastHitBy = msg.fromId;
        this.mpLastHitHeadshot = msg.isHeadshot;
        // Apply damage (respect spawn protection)
        if (this.mpSpawnProtectTimer <= 0) {
          this.takeDamage(msg.damage, new THREE.Vector3(0, 0, 0));
        }
        this.events.onMpHit?.(msg.fromId, msg.damage, msg.isHeadshot);
      }
      // Spawn blood particles on remote player hit
      const rp = this.remotePlayers.get(msg.toId);
      if (rp) {
        rp.takeHit();
        const bloodPos = rp.group.position.clone();
        bloodPos.y += 1.0;
        const particles = rp.spawnBloodParticles(bloodPos);
        particles.forEach(p => {
          this.scene.add(p);
          this.mpRemoteBlood.push({ mesh: p, velocity: p.userData.velocity, lifetime: p.userData.lifetime });
        });
      }
    });

    this.mpClient.on('kill', (msg) => {
      this.events.onMpKill?.(msg.killerId, msg.victimId, msg.weapon, msg.isHeadshot);
      if (msg.victimId === this.mpClient!.myId) {
        this.dead = true;
        this.mpRespawnTimer = 3;
        this.events.onDeath?.();
        // Death cam — look at killer
        const killer = this.remotePlayers.get(msg.killerId);
        if (killer) {
          this.mpDeathCamTarget.copy(killer.group.position);
          this.mpDeathCamTimer = 2;
        }
      }
      const rp = this.remotePlayers.get(msg.victimId);
      if (rp) { rp.isDead = true; rp.deaths++; }
      const killer = this.remotePlayers.get(msg.killerId);
      if (killer) { killer.kills++; killer.score += msg.isHeadshot ? 150 : 100; }
    });

    this.mpClient.on('score_update', (msg) => {
      this.mpScores = msg.scores;
      this.mpTeamScores.alpha = 0;
      this.mpTeamScores.bravo = 0;
      Object.values(this.mpScores).forEach((s: any) => {
        if (s.team === 'alpha') this.mpTeamScores.alpha += s.score;
        else this.mpTeamScores.bravo += s.score;
      });
      this.events.onMpScoreUpdate?.(this.mpScores);
      // Check win condition
      if (this.mpMode === 'tdm' || this.mpMode === '1v1') {
        if (this.mpTeamScores.alpha >= this.mpScoreLimit || this.mpTeamScores.bravo >= this.mpScoreLimit) {
          const winner = this.mpTeamScores.alpha > this.mpTeamScores.bravo ? 'alpha' : 'bravo';
          this.mpGameOver = true;
          this.events.onMpGameOver?.(winner, this.mpScores);
          if (this.mpClient!.isHosting) this.mpClient!.sendGameOver(winner, this.mpScores);
        }
      }
    });

    this.mpClient.on('respawn', (msg) => {
      if (msg.id === this.mpClient!.myId) {
        this.hp = this.maxHp;
        this.dead = false;
        this.camera.position.set(msg.x, msg.y, msg.z);
        this.mpSpawnProtectTimer = 3;
        this.mpDeathCamTimer = 0;
      }
      const rp = this.remotePlayers.get(msg.id);
      if (rp) { rp.isDead = false; rp.hp = 100; rp.triggerSpawnProtection(3); }
    });

    this.mpClient.on('game_over', (msg) => {
      this.mpGameOver = true;
      this.events.onMpGameOver?.(msg.winner, msg.scores);
    });

    this.mpClient.on('ping', (msg) => {
      const rp = this.remotePlayers.get(msg.id);
      if (rp) rp.ping = msg.ping;
    });
  }

  private updateRemotePlayers(dt: number) {
    this.remotePlayers.forEach(rp => {
      rp.update(dt);
      // Footstep audio
      if (rp.getFootstepTrigger()) {
        this.playPositionalSound(rp.group.position, 800, 'sine', 0.03, 0.08);
      }
    });
  }

  private updateRemoteBlood(dt: number) {
    for (let i = this.mpRemoteBlood.length - 1; i >= 0; i--) {
      const b = this.mpRemoteBlood[i];
      b.lifetime -= dt;
      if (b.lifetime <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.mpRemoteBlood.splice(i, 1);
      } else {
        b.velocity.y -= 9.8 * dt;
        b.mesh.position.add(b.velocity.clone().multiplyScalar(dt));
        if (b.mesh.position.y < 0) {
          b.mesh.position.y = 0;
          b.velocity.set(0, 0, 0);
        }
        (b.mesh.material as THREE.MeshBasicMaterial).opacity = b.lifetime / 0.5;
      }
    }
  }

  private updateMpDeathCam(dt: number) {
    if (this.mpDeathCamTimer > 0) {
      this.mpDeathCamTimer -= dt;
      // Slowly rotate camera to look at killer
      const lookDir = new THREE.Vector3().subVectors(this.mpDeathCamTarget, this.camera.position).normalize();
      const targetYaw = Math.atan2(lookDir.x, lookDir.z);
      let yawDiff = targetYaw - this.yaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      this.yaw += yawDiff * Math.min(1, dt * 2);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
    }
  }

  private updateMpSpawnProtect(dt: number) {
    if (this.mpSpawnProtectTimer > 0) {
      this.mpSpawnProtectTimer -= dt;
    }
  }

  private updateMpPreMatch(dt: number) {
    if (this.mpPreMatchCountdown > 0) {
      this.mpPreMatchCountdown -= dt;
      if (this.mpPreMatchCountdown <= 0) {
        this.mpSpawnProtectTimer = 3;
      }
    }
  }

  getMpPreMatchCountdown(): number {
    return Math.ceil(this.mpPreMatchCountdown);
  }

  getMpSpawnProtectTimer(): number {
    return this.mpSpawnProtectTimer;
  }

  getRemotePlayerList(): { id: string; name: string; team: string; kills: number; deaths: number; score: number; ping: number; dead: boolean }[] {
    const list: { id: string; name: string; team: string; kills: number; deaths: number; score: number; ping: number; dead: boolean }[] = [];
    this.remotePlayers.forEach(rp => {
      list.push({ id: rp.id, name: rp.name, team: rp.team, kills: rp.kills, deaths: rp.deaths, score: rp.score, ping: rp.ping, dead: rp.isDead });
    });
    return list;
  }

  private updateMpSync() {
    if (!this.mpClient || !this.mpClient.isConnected) return;
    this.mpClient.setLocalState({
      x: this.camera.position.x,
      y: this.camera.position.y,
      z: this.camera.position.z,
      yaw: this.yaw,
      pitch: this.pitch,
      hp: this.hp,
      weapon: this.currentWeapon,
      isFiring: this.touchFiring,
      isADS: this.isADS,
      isCrouching: this.isCrouching,
      isDead: this.dead,
    });
  }

  private updateMpRespawn(dt: number) {
    if (!this.mpClient || !this.dead || this.mpGameOver) return;
    this.mpRespawnTimer -= dt;
    if (this.mpRespawnTimer <= 0) {
      const spawnX = (Math.random() - 0.5) * 20;
      const spawnZ = (Math.random() - 0.5) * 20;
      const spawnY = 1.7;
      this.hp = this.maxHp;
      this.dead = false;
      this.camera.position.set(spawnX, spawnY, spawnZ);
      this.mpClient.sendRespawn(spawnX, spawnY, spawnZ);
    }
  }

  private fireAtRemotePlayer(origin: THREE.Vector3, dir: THREE.Vector3, dmg: number, isHeadshot: boolean): boolean {
    if (!this.mpClient) return false;
    const ray = new THREE.Raycaster(origin, dir.normalize(), 0, 100);
    let closestRp: RemotePlayer | null = null;
    let closestDist = Infinity;

    this.remotePlayers.forEach(rp => {
      if (rp.isDead) return;
      // Only hit enemies (different team for TDM/Domination, everyone for FFA)
      const isEnemy = this.mpMode === 'ffa' || rp.team !== this.mpClient!.myTeam;
      if (!isEnemy) return;
      const hit = ray.intersectObject(rp.group, true);
      if (hit.length > 0 && hit[0].distance < closestDist) {
        closestDist = hit[0].distance;
        closestRp = rp;
      }
    });

    if (closestRp) {
      this.mpClient.sendHit({
        fromId: this.mpClient.myId,
        toId: closestRp.id,
        damage: dmg,
        isHeadshot,
        timestamp: Date.now(),
      });
      closestRp.takeHit();
      return true;
    }
    return false;
  }

  // ─── LOOP ───

  private onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private animate = () => {
    this.animationId = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    if (this.started && !this.dead) {
      this.updateMovement(dt);
    }
    // Multiplayer updates
    this.updateRemotePlayers(dt);
    this.updateMpSync();
    this.updateMpRespawn(dt);
    this.updateMpDeathCam(dt);
    this.updateMpSpawnProtect(dt);
    this.updateMpPreMatch(dt);
    this.updateRemoteBlood(dt);
    // Killstreak reward updates
    if (this.uavTimer > 0) this.uavTimer = Math.max(0, this.uavTimer - dt);
    if (this.supplyDropBoostTimer > 0) this.supplyDropBoostTimer = Math.max(0, this.supplyDropBoostTimer - dt);
    if (this.gunshipTimer > 0) this.updateGunship(dt);
    // Muzzle flash light decay
    if (this.muzzleLightTimer > 0) {
      this.muzzleLightTimer -= dt;
      if (this.muzzleLight && this.muzzleLightTimer <= 0) this.muzzleLight.intensity = 0;
    }
    // Camera shake decay
    if (this.cameraShake > 0) this.cameraShake = Math.max(0, this.cameraShake - dt * 3);
    // Landing dip recovery
    if (this.landingDip > 0) this.landingDip = Math.max(0, this.landingDip - dt * 4);
    // Pool item decay — tracers and sparks
    for (const item of this.tracerPool) {
      if (item.active) {
        item.lifetime -= dt;
        if (item.lifetime <= 0) { item.active = false; item.mesh.visible = false; }
        else { (item.mesh.material as THREE.MeshBasicMaterial).opacity = item.lifetime / 0.06 * 0.9; }
      }
    }
    for (const item of this.sparkPool) {
      if (item.active) {
        item.lifetime -= dt;
        if (item.lifetime <= 0) { item.active = false; item.mesh.visible = false; }
      }
    }
    // Shell casing physics
    for (const casing of this.shellCasings) {
      if (casing.active) {
        casing.lifetime -= dt;
        casing.vel.y -= 9.8 * dt;
        casing.mesh.position.add(casing.vel.clone().multiplyScalar(dt));
        casing.mesh.rotation.x += dt * 8;
        casing.mesh.rotation.z += dt * 6;
        // Bounce on ground
        if (casing.mesh.position.y < 0.02) {
          casing.mesh.position.y = 0.02;
          casing.vel.y *= -0.3;
          casing.vel.x *= 0.5;
          casing.vel.z *= 0.5;
        }
        if (casing.lifetime <= 0) {
          casing.active = false;
          casing.mesh.visible = false;
        }
      }
    }
    // Dust particle update
    for (const dust of this.dustParticles) {
      if (dust.active) {
        dust.lifetime -= dt;
        const pos = dust.mesh.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < 12; i++) {
          pos[i * 3] += dust.vel[i * 3] * dt;
          pos[i * 3 + 1] += dust.vel[i * 3 + 1] * dt;
          pos[i * 3 + 2] += dust.vel[i * 3 + 2] * dt;
          dust.vel[i * 3 + 1] -= 3.0 * dt;
        }
        dust.mesh.geometry.attributes.position.needsUpdate = true;
        const mat = dust.mesh.material as THREE.PointsMaterial;
        mat.opacity = Math.max(0, dust.lifetime / 0.6) * 0.7;
        if (dust.lifetime <= 0) {
          dust.active = false;
          dust.mesh.visible = false;
        }
      }
    }
    // Weapon swap animation decay
    if (this.weaponSwapAnim > 0) {
      this.weaponSwapAnim = Math.max(0, this.weaponSwapAnim - dt);
      if (this.weaponGroup) {
        const t = this.weaponSwapAnim / 0.3;
        this.weaponGroup.position.y = -t * 0.3;
        this.weaponGroup.rotation.x = t * 0.5;
      }
    }
    // Adaptive quality monitoring
    this.fpsAccum += dt;
    this.fpsSampleCount++;
    if (this.fpsAccum >= 1.0) {
      const avgFps = this.fpsSampleCount / this.fpsAccum;
      this.fpsHistory.push(avgFps);
      if (this.fpsHistory.length > 10) this.fpsHistory.shift();
      this.fpsAccum = 0;
      this.fpsSampleCount = 0;
      const recentAvg = this.fpsHistory.reduce((a, b) => a + b, 0) / this.fpsHistory.length;
      if (recentAvg < 30 && this.adaptiveQualityLevel > 0) {
        this.adaptiveQualityLevel--;
        this.applyAdaptiveQuality();
      } else if (recentAvg > 55 && this.adaptiveQualityLevel < 2) {
        this.adaptiveQualityLevel++;
        this.applyAdaptiveQuality();
      }
    }
    // Domination zone updates (MP only)
    this.updateDominationZones(dt);
    // Suppression effect — check for nearby enemy bullets
    this.updateSuppression(dt);
    // Only render when game is active (not behind loadout/briefing overlays)
    if (this.started || this.dead) {
      this.renderer.render(this.scene, this.camera);
    }
  };

  start() {
    if (this.started) return;
    this.started = true;
    // Randomize player spawn point
    const spawns = this.mapConfig.spawnPoints;
    const spawn = spawns[Math.floor(Math.random() * spawns.length)];
    this.camera.position.set(spawn.x, 1.7, spawn.z);
    // Activate 10-second safe zone
    this.safeZoneTimer = 10;
    this.safeZoneActive = true;
    // Spawn enemies and pickups when game actually starts
    this.spawnEnemies();
    this.spawnPickups();
    // On mobile, pointer lock is not available — set isLocked manually
    if (!('pointerLockElement' in document) || !(document.documentElement?.requestPointerLock)) {
      this.isLocked = true;
    }
  }

  stop() { this.started = false; }

  private applyAdaptiveQuality() {
    if (this.adaptiveQualityLevel === 0) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 0.5));
      this.scene.fog = new THREE.FogExp2(0x1a1a24, 0.03);
    } else if (this.adaptiveQualityLevel === 1) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 0.75));
      this.scene.fog = new THREE.FogExp2(0x1a1a24, 0.02);
    } else {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
      this.scene.fog = new THREE.FogExp2(0x1a1a24, this.currentWaveModifier?.type === 'fogOfWar' ? 0.06 : 0.018);
    }
  }

  private updateDominationZones(dt: number) {
    if (this.dominationZones.length === 0) return;
    for (const zone of this.dominationZones) {
      // Check if player is in zone
      const playerInZone = this.camera.position.distanceTo(zone.pos) < zone.radius;
      // Check if any remote players are in zone
      let alphaCount = 0;
      let bravoCount = 0;
      if (playerInZone) {
        if (this.mpClient?.myTeam === 'alpha') alphaCount++;
        else if (this.mpClient?.myTeam === 'bravo') bravoCount++;
      }
      this.remotePlayers.forEach(rp => {
        if (rp.isDead) return;
        if (rp.group.position.distanceTo(zone.pos) < zone.radius) {
          if (rp.team === 'alpha') alphaCount++;
          else if (rp.team === 'bravo') bravoCount++;
        }
      });
      zone.contested = alphaCount > 0 && bravoCount > 0;
      if (!zone.contested) {
        if (alphaCount > 0 && zone.team !== 'alpha') {
          zone.progress = Math.min(100, zone.progress + dt * 20);
          if (zone.progress >= 100) { zone.team = 'alpha'; zone.progress = 0; }
        } else if (bravoCount > 0 && zone.team !== 'bravo') {
          zone.progress = Math.min(100, zone.progress + dt * 20);
          if (zone.progress >= 100) { zone.team = 'bravo'; zone.progress = 0; }
        } else if (alphaCount === 0 && bravoCount === 0 && zone.progress > 0) {
          zone.progress = Math.max(0, zone.progress - dt * 10);
        }
      }
      // Update visual ring color
      const ringMat = zone.ringMesh.material as THREE.MeshBasicMaterial;
      const targetColor = zone.team === 'alpha' ? 0xf97316 : zone.team === 'bravo' ? 0x22d3ee : 0x666666;
      ringMat.color.setHex(targetColor);
      ringMat.opacity = zone.contested ? 0.5 : 0.3;
      // Scale ring based on capture progress
      const scale = 1 + (zone.progress / 100) * 0.1;
      zone.ringMesh.scale.set(scale, 1, scale);
    }
    // Emit UI update
    const uiZones: DominationZoneUI[] = this.dominationZones.map(z => ({
      id: z.id, x: z.pos.x - this.camera.position.x, z: z.pos.z - this.camera.position.z,
      radius: z.radius, team: z.team, progress: z.progress, contested: z.contested,
    }));
    this.events.onDominationZone?.(uiZones);
  }

  public createDominationZones() {
    const positions = [
      { x: 0, z: 0 },
      { x: 12, z: 8 },
      { x: -12, z: -8 },
    ];
    positions.forEach((p, i) => {
      const geo = new THREE.CircleGeometry(4, 32);
      const mat = new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.2, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(p.x, 0.02, p.z);
      this.scene.add(mesh);
      // Ring outline
      const ringGeo = new THREE.RingGeometry(3.8, 4.2, 32);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.set(p.x, 0.03, p.z);
      this.scene.add(ringMesh);
      this.dominationZones.push({
        id: `zone_${i}`, mesh, ringMesh,
        pos: new THREE.Vector3(p.x, 0, p.z), radius: 4,
        team: 'neutral', progress: 0, contested: false,
      });
    });
  }

  private updateSuppression(dt: number) {
    if (this.dead) return;
    // Check for enemy bullets near player — increase suppression
    let nearBullets = 0;
    for (const e of this.enemies) {
      if (e.dead || e.lastShot === 0) continue;
      const dist = e.group.position.distanceTo(this.camera.position);
      if (dist < 8 && performance.now() - e.lastShot < 500) {
        nearBullets++;
      }
    }
    if (nearBullets > 0) {
      this.suppressedTimer = Math.min(this.suppressedTimer + dt * nearBullets * 0.5, 3);
      // Add crosshair spread when suppressed
      this.crosshairSpread = Math.min(this.crosshairSpread + dt * 0.3, 1.0);
    }
  }

  public cycleSpectator() {
    if (!this.mpClient || !this.mpClient.isConnected) return;
    const aliveTeammates = Array.from(this.remotePlayers.values()).filter(
      rp => !rp.isDead && rp.team === this.mpClient!.myTeam
    );
    if (aliveTeammates.length === 0) return;
    this.mpSpectatorIndex = (this.mpSpectatorIndex + 1) % aliveTeammates.length;
    const target = aliveTeammates[this.mpSpectatorIndex];
    this.mpSpectatorTarget = target.id;
    this.events.onSpectatorSwitch?.(target.name, target.team);
    // Move camera to spectator target
    this.camera.position.copy(target.group.position);
    this.camera.position.y += 1.7;
  }

  public sendQuickChat(messageId: string) {
    if (!this.mpClient || !this.mpClient.isConnected) return;
    const msg = QUICK_CHAT_OPTIONS.find(o => o.id === messageId);
    if (!msg) return;
    this.mpClient.broadcastMessage({ type: 'quickchat', message: msg.label, sender: this.mpClient.myName });
    this.events.onQuickChat?.(msg.label, this.mpClient.myName);
  }

  destroy() {
    cancelAnimationFrame(this.animationId);
    // Cleanup multiplayer
    this.remotePlayers.forEach(rp => { this.scene.remove(rp.group); rp.dispose(); });
    this.remotePlayers.clear();
    this.mpRemoteBlood.forEach(b => { this.scene.remove(b.mesh); b.mesh.geometry.dispose(); (b.mesh.material as THREE.Material).dispose(); });
    this.mpRemoteBlood = [];
    if (this.mpClient) { this.mpClient.destroy(); this.mpClient = null; }
    // Cleanup music
    if (this.musicOsc) { try { this.musicOsc.stop(); } catch {} this.musicOsc = null; }
    if (this.musicOsc2) { try { this.musicOsc2.stop(); } catch {} this.musicOsc2 = null; }
    if (this.musicGain) { this.musicGain.disconnect(); this.musicGain = null; }
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
