export type WeaponKey = 'pistol' | 'smg' | 'shotgun' | 'rifle' | 'lmg' | 'sniper' | 'dmr' | 'launcher' | 'plasma';

export type WeaponCategory = 'pistol' | 'smg' | 'assault' | 'marksman' | 'sniper' | 'shotgun' | 'lmg' | 'launcher' | 'energy';

// ─── BATTLEFIELD MAPS ───

export type MapType = 'urban_desert' | 'jungle' | 'cyberpunk';

export interface SpawnPoint { x: number; z: number; }

export interface BattlefieldConfig {
  id: MapType;
  name: string;
  description: string;
  icon: string;
  skyColor: number;
  fogColor: number;
  fogDensity: number;
  floorColor: number;
  ambientColor: number;
  ambientIntensity: number;
  dirLightColor: number;
  dirLightIntensity: number;
  dirLightPos: [number, number, number];
  fillColor: number;
  fillIntensity: number;
  rimColor: number;
  rimIntensity: number;
  weather: 'rain' | 'sandstorm' | 'fog' | 'blizzard' | 'neon' | 'none';
  weatherColor: number;
  recommendedWeapons: string[];
  enemyBias: Partial<Record<EnemyType, number>>;
  spawnPoints: SpawnPoint[];
  size: number;
}

export const BATTLEFIELDS: Record<MapType, BattlefieldConfig> = {
  urban_desert: {
    id: 'urban_desert',
    name: 'URBAN DESERT',
    description: 'Sand-swept city ruins with tight corridors, collapsed buildings, and open market squares. Sandstorm reduces visibility. Mix of CQC and mid-range.',
    icon: '🏜',
    skyColor: 0xddb877,
    fogColor: 0xddc888,
    fogDensity: 0.016,
    floorColor: 0xc4a868,
    ambientColor: 0xddbb88,
    ambientIntensity: 0.6,
    dirLightColor: 0xfff0cc,
    dirLightIntensity: 4.0,
    dirLightPos: [40, 50, 10],
    fillColor: 0xccaa66,
    fillIntensity: 0.6,
    rimColor: 0xddcc88,
    rimIntensity: 0.4,
    weather: 'sandstorm',
    weatherColor: 0xddc888,
    recommendedWeapons: ['smg', 'shotgun', 'rifle'],
    enemyBias: { rifleman: 1.4, shotgunner: 1.3, sniper: 1.2 },
    spawnPoints: [
      { x: 0, z: 0 }, { x: -15, z: -15 }, { x: 15, z: 15 }, { x: -15, z: 15 },
      { x: 15, z: -15 }, { x: 0, z: 18 }, { x: -18, z: 0 }, { x: 18, z: 0 },
      { x: -8, z: 8 }, { x: 8, z: -8 },
    ],
    size: 55,
  },
  jungle: {
    id: 'jungle',
    name: 'TERRESTRIAL JUNGLE',
    description: 'Dense foliage with wooden structures, rivers, and elevated tree platforms. Heavy fog limits visibility. Close-quarters ambush territory.',
    icon: '🌴',
    skyColor: 0x1a2a1a,
    fogColor: 0x2a3a2a,
    fogDensity: 0.035,
    floorColor: 0x2a3a1a,
    ambientColor: 0x4a6a3a,
    ambientIntensity: 0.5,
    dirLightColor: 0x88aa66,
    dirLightIntensity: 2.5,
    dirLightPos: [20, 40, 15],
    fillColor: 0x3a5a2a,
    fillIntensity: 0.7,
    rimColor: 0x5a7a3a,
    rimIntensity: 0.5,
    weather: 'fog',
    weatherColor: 0x4a6a3a,
    recommendedWeapons: ['shotgun', 'smg', 'pistol'],
    enemyBias: { charger: 1.5, bomber: 1.3, shotgunner: 1.2 },
    spawnPoints: [
      { x: 0, z: 0 }, { x: -12, z: -12 }, { x: 12, z: 12 }, { x: -12, z: 12 },
      { x: 12, z: -12 }, { x: 0, z: 15 }, { x: -15, z: 0 }, { x: 15, z: 0 },
      { x: -6, z: 6 }, { x: 6, z: -6 },
    ],
    size: 45,
  },
  cyberpunk: {
    id: 'cyberpunk',
    name: 'NEON CITY',
    description: 'Cyberpunk megacity with neon-lit alleys, holographic billboards, and elevated catwalks. Rain and neon haze. Vertical combat with energy weapons.',
    icon: '🌃',
    skyColor: 0x0a0a1a,
    fogColor: 0x1a0a2a,
    fogDensity: 0.025,
    floorColor: 0x1a1a2a,
    ambientColor: 0x4a2a6a,
    ambientIntensity: 0.5,
    dirLightColor: 0xaa66ff,
    dirLightIntensity: 2.0,
    dirLightPos: [15, 35, 15],
    fillColor: 0x2a1a4a,
    fillIntensity: 0.9,
    rimColor: 0x00ffaa,
    rimIntensity: 0.8,
    weather: 'neon',
    weatherColor: 0xff00ff,
    recommendedWeapons: ['plasma', 'smg', 'rifle'],
    enemyBias: { sniper: 1.4, charger: 1.3, rifleman: 1.2 },
    spawnPoints: [
      { x: 0, z: 0 }, { x: -14, z: -14 }, { x: 14, z: 14 }, { x: -14, z: 14 },
      { x: 14, z: -14 }, { x: 0, z: 16 }, { x: -16, z: 0 }, { x: 16, z: 0 },
      { x: -7, z: 7 }, { x: 7, z: -7 },
    ],
    size: 50,
  },
};

export interface WeaponAbility {
  name: string;
  description: string;
}

export interface WeaponConfig {
  key: WeaponKey;
  name: string;
  damage: number;
  fireRate: number;
  magSize: number;
  pellets: number;
  spread: number;
  auto: boolean;
  recoilPattern: number[][];
  unlockLevel: number;
  cost: number;
  category: WeaponCategory;
  abilities: WeaponAbility[];
}

export const WEAPONS: Record<WeaponKey, WeaponConfig> = {
  pistol: { key: 'pistol', name: 'M9 SIDEARM', damage: 25, fireRate: 300, magSize: 12, pellets: 1, spread: 0.01, auto: false, recoilPattern: [[0, -1], [0.3, -0.8], [-0.2, -0.6]], unlockLevel: 1, cost: 0, category: 'pistol', abilities: [
    { name: 'Sidearm', description: 'Always available, infinite reserve ammo' },
    { name: 'Quick Draw', description: 'Fastest weapon swap speed' },
  ] },
  smg: { key: 'smg', name: 'MP5 TACTICAL', damage: 18, fireRate: 90, magSize: 30, pellets: 1, spread: 0.04, auto: true, recoilPattern: [[0, -0.8], [0.5, -0.6], [-0.4, -0.5], [0.3, -0.4], [-0.3, -0.3]], unlockLevel: 1, cost: 0, category: 'smg', abilities: [
    { name: 'High Mobility', description: 'Minimal movement penalty while firing' },
    { name: 'Rapid Fire', description: 'Fastest full-auto fire rate' },
    { name: 'Close Range', description: 'Reduced damage at long range' },
  ] },
  shotgun: { key: 'shotgun', name: '870 BREACHER', damage: 15, fireRate: 700, magSize: 6, pellets: 8, spread: 0.12, auto: false, recoilPattern: [[0, -2], [0.5, -1.5], [-0.5, -1]], unlockLevel: 2, cost: 500, category: 'shotgun', abilities: [
    { name: 'Spread Shot', description: '8 pellets per shell for close-range devastation' },
    { name: 'Breacher', description: 'High stagger chance on hit' },
    { name: 'Short Range', description: 'Severe damage falloff past 10m' },
  ] },
  rifle: { key: 'rifle', name: 'AK-74 ASSAULT', damage: 30, fireRate: 120, magSize: 30, pellets: 1, spread: 0.025, auto: true, recoilPattern: [[0, -1.2], [0.4, -1], [-0.3, -0.8], [0.2, -0.6], [-0.2, -0.5]], unlockLevel: 3, cost: 1200, category: 'assault', abilities: [
    { name: 'Versatile', description: 'Balanced damage at all ranges' },
    { name: 'Controllable Recoil', description: 'Predictable vertical recoil pattern' },
    { name: 'Auto Fire', description: 'Full-auto with moderate spread' },
  ] },
  lmg: { key: 'lmg', name: 'M249 SAW', damage: 22, fireRate: 80, magSize: 100, pellets: 1, spread: 0.05, auto: true, recoilPattern: [[0, -0.6], [0.3, -0.5], [-0.2, -0.4], [0.15, -0.3], [-0.15, -0.3]], unlockLevel: 5, cost: 2500, category: 'lmg', abilities: [
    { name: 'Sustained Fire', description: '100-round belt, longest suppressive fire' },
    { name: 'Suppression', description: 'Bullets near enemies reduce their accuracy' },
    { name: 'Heavy', description: 'Reduced movement speed while firing' },
  ] },
  sniper: { key: 'sniper', name: 'M82 BARRETT', damage: 100, fireRate: 1200, magSize: 10, pellets: 1, spread: 0.005, auto: false, recoilPattern: [[0, -4], [0.5, -3], [-0.5, -2.5]], unlockLevel: 7, cost: 4000, category: 'sniper', abilities: [
    { name: 'One Shot', description: 'Lethal headshots at any range' },
    { name: 'Penetration', description: 'Rounds penetrate cover and multiple enemies' },
    { name: 'High Zoom', description: 'Powerful scope with 8x magnification' },
  ] },
  dmr: { key: 'dmr', name: 'MK14 EBR', damage: 55, fireRate: 400, magSize: 20, pellets: 1, spread: 0.015, auto: false, recoilPattern: [[0, -2], [0.3, -1.5], [-0.3, -1.2]], unlockLevel: 4, cost: 2000, category: 'marksman', abilities: [
    { name: 'Semi-Auto Precision', description: 'Fast follow-up shots with moderate damage' },
    { name: 'Medium Zoom', description: '4x scope for mid-range engagements' },
    { name: 'Agile', description: 'Can fire while moving with minimal penalty' },
  ] },
  launcher: { key: 'launcher', name: 'M32 GL', damage: 80, fireRate: 1500, magSize: 6, pellets: 1, spread: 0, auto: false, recoilPattern: [[0, -3], [0.3, -2]], unlockLevel: 6, cost: 3000, category: 'launcher', abilities: [
    { name: 'Area Damage', description: 'Explosive rounds deal splash damage' },
    { name: 'Anti-Armor', description: 'Ignores enemy damage reduction' },
    { name: 'Slow Fire', description: 'Long reload and fire delay' },
  ] },
  plasma: { key: 'plasma', name: 'X-ION REPEATER', damage: 30, fireRate: 200, magSize: 20, pellets: 1, spread: 0.05, auto: true, recoilPattern: [[0, -0.5], [0.2, -0.4], [-0.2, -0.3]], unlockLevel: 8, cost: 5000, category: 'energy', abilities: [
    { name: 'Energy Rounds', description: 'Plasma bolts ignore armor entirely' },
    { name: 'No Bullet Drop', description: 'Perfectly flat trajectory at any range' },
    { name: 'Overheat', description: 'Firing too rapidly causes temporary cooldown' },
  ] },
};

export const WEAPON_CATEGORIES: { key: WeaponCategory; label: string; icon: string; description: string }[] = [
  { key: 'pistol', label: 'SIDEARMS', icon: '🔫', description: 'Backup weapons with infinite ammo' },
  { key: 'smg', label: 'SMGs', icon: '🔫', description: 'High mobility, rapid fire, close range' },
  { key: 'assault', label: 'ASSAULT RIFLES', icon: '🔫', description: 'Versatile, balanced at all ranges' },
  { key: 'marksman', label: 'MARKSMAN RIFLES', icon: '🎯', description: 'Semi-auto precision for mid-range' },
  { key: 'sniper', label: 'SNIPER RIFLES', icon: '🎯', description: 'One-shot lethality at extreme range' },
  { key: 'shotgun', label: 'SHOTGUNS', icon: '💥', description: 'Close-range spread devastation' },
  { key: 'lmg', label: 'LMGs', icon: '🔫', description: 'Sustained suppressive fire' },
  { key: 'launcher', label: 'LAUNCHERS', icon: '🚀', description: 'Explosive area damage' },
  { key: 'energy', label: 'ENERGY', icon: '⚡', description: 'Advanced plasma weaponry' },
];

export type EnemyType = 'grunt' | 'rifleman' | 'shotgunner' | 'heavy' | 'sniper' | 'charger' | 'bomber' | 'medic' | 'boss' | 'drone' | 'tank';

export interface FPSGameStats {
  kills: number;
  shotsFired: number;
  shotsHit: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  ammo: number;
  magSize: number;
  weaponName: string;
  weaponKey: WeaponKey;
  grenades: number;
  wave: number;
  enemiesAlive: number;
  killstreak: number;
  score: number;
  headshots: number;
  damageDealt: number;
  damageTaken: number;
  compassEnemy: number | null;
  crosshairSpread: number;
  isLeaning: 'left' | 'right' | null;
  suppressed: boolean;
  radarBlips: RadarBlip[];
  radarObjective: { x: number; z: number; type: string } | null;
  uavActive: boolean;
  scoreMultiplier: number;
  comboTimer: number;
  isBossWave: boolean;
  bossHp: number;
  bossMaxHp: number;
  waveDamageTaken: number;
  waveHeadshots: number;
  waveStartTime: number;
  isEliteWave: boolean;
  waveModifier: WaveModifier | null;
  spectatorTarget: { name: string; team: string } | null;
  lowAmmo: boolean;
  dominationZones: DominationZoneUI[];
  safeZoneTimer: number;
  currentMap: string;
  isADS: boolean;
}

export interface RadarBlip {
  x: number;
  z: number;
  type: EnemyType;
  isBoss: boolean;
}

export interface ScorePopup {
  id: number;
  text: string;
  x: number;
  y: number;
}

export interface GameSettings {
  mouseSensitivity: number;
  lookSensitivity: number;
  scopeSensitivity: number;
  fov: number;
  masterVolume: number;
  sfxVolume: number;
  autoFire: boolean;
  gyroAim: boolean;
  hudScale: number;
  buttonOpacity: number;
  buttonSize: number;
  joystickOpacity: number;
  joystickSize: number;
  tiltLook: boolean;
  tiltSensitivity: number;
  hudPreset: 'standard' | 'classic' | 'inverted' | 'magnified' | 'essentials';
  adsToggle: boolean;
  sensitivityCurve: number;
}

export const DEFAULT_SETTINGS: GameSettings = {
  mouseSensitivity: 1,
  lookSensitivity: 1.0,
  scopeSensitivity: 0.5,
  fov: 75,
  masterVolume: 0.7,
  sfxVolume: 0.8,
  autoFire: false,
  gyroAim: false,
  hudScale: 1.0,
  buttonOpacity: 0.75,
  buttonSize: 1.0,
  joystickOpacity: 0.5,
  joystickSize: 1.0,
  tiltLook: false,
  tiltSensitivity: 1.0,
  hudPreset: 'standard',
  adsToggle: false,
  sensitivityCurve: 1.5,
};

export interface DamageNumber {
  id: number;
  value: number;
  x: number;
  y: number;
  isHeadshot: boolean;
  isKill: boolean;
}

export interface HitMarker {
  id: number;
  isHeadshot: boolean;
  isKill: boolean;
}

export interface FPSGameEvents {
  onKill?: (enemyType: EnemyType, headshot: boolean) => void;
  onHit?: (headshot: boolean) => void;
  onStatsUpdate?: (stats: FPSGameStats) => void;
  onDamage?: (direction: number) => void;
  onDeath?: () => void;
  onScorePopup?: (popup: ScorePopup) => void;
  onKillstreak?: (streak: number) => void;
  onWaveStart?: (wave: number, objective?: WaveObjective) => void;
  onReloadStart?: () => void;
  onReloadComplete?: () => void;
  onDamageNumber?: (dmg: DamageNumber) => void;
  onHitMarker?: (marker: HitMarker) => void;
  onKillstreakReward?: (reward: KillstreakRewardType) => void;
  onObjectiveUpdate?: (obj: WaveObjective) => void;
  onCombo?: (multiplier: number) => void;
  onBossWave?: (bossName: string) => void;
  onWaveBonus?: (bonus: { text: string; score: number }) => void;
  onMpKill?: (killer: string, victim: string, weapon: string, headshot: boolean) => void;
  onMpHit?: (fromId: string, damage: number, headshot: boolean) => void;
  onMpScoreUpdate?: (scores: Record<string, { kills: number; deaths: number; score: number; team: string }>) => void;
  onMpZoneUpdate?: (zones: any[]) => void;
  onMpGameOver?: (winner: string, scores: any) => void;
  onAchievement?: (achievement: Achievement) => void;
  onWaveModifier?: (modifier: WaveModifier) => void;
  onSpectatorSwitch?: (targetName: string, targetTeam: string) => void;
  onKillConfirm?: (killstreak: number) => void;
  onQuickChat?: (message: string, sender: string) => void;
  onDominationZone?: (zones: DominationZoneUI[]) => void;
  onSafeZoneEnd?: () => void;
}

// ─── WAVE MODIFIERS ───

export type WaveModifierType = 'doubleDamage' | 'fogOfWar' | 'lowGravity' | 'enemyEnrage' | 'fastEnemies' | 'glassCannon';

export interface WaveModifier {
  type: WaveModifierType;
  name: string;
  description: string;
  color: string;
}

export const WAVE_MODIFIERS: WaveModifier[] = [
  { type: 'doubleDamage', name: 'DOUBLE DAMAGE', description: 'All weapon damage doubled', color: '#f97316' },
  { type: 'fogOfWar', name: 'FOG OF WAR', description: 'Reduced visibility, no radar', color: '#64748b' },
  { type: 'lowGravity', name: 'LOW GRAVITY', description: 'Reduced gravity, higher jumps', color: '#22d3ee' },
  { type: 'enemyEnrage', name: 'ENRAGED ENEMIES', description: 'Enemies deal 50% more damage', color: '#ef4444' },
  { type: 'fastEnemies', name: 'SPEED DEMONS', description: 'Enemies move 40% faster', color: '#fbbf24' },
  { type: 'glassCannon', name: 'GLASS CANNON', description: 'You deal 3x damage but die in 1 hit', color: '#a855f7' },
];

export function getWaveModifier(wave: number): WaveModifier | null {
  if (wave < 3) return null;
  if (wave % 5 === 0) return null; // Boss waves don't get modifiers
  const seed = wave * 13 + 7;
  const idx = seed % WAVE_MODIFIERS.length;
  return WAVE_MODIFIERS[idx];
}

// ─── ACHIEVEMENTS ───

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'firstBlood', name: 'FIRST BLOOD', description: 'Get your first kill', icon: '🩸' },
  { id: 'centurion', name: 'CENTURION', description: 'Reach 100 total kills', icon: '💯' },
  { id: 'headhunter', name: 'HEADHUNTER', description: 'Get 50 headshots in one match', icon: '🎯' },
  { id: 'untouchable', name: 'UNTOUCHABLE', description: 'Clear a wave without taking damage', icon: '🛡️' },
  { id: 'killstreak5', name: 'RAMPAGE', description: 'Get a 5 killstreak', icon: '🔥' },
  { id: 'killstreak10', name: 'GODLIKE', description: 'Get a 10 killstreak', icon: '⚡' },
  { id: 'wave10', name: 'SURVIVOR', description: 'Reach wave 10', icon: '🌊' },
  { id: 'wave20', name: 'VETERAN', description: 'Reach wave 20', icon: '🎖️' },
  { id: 'sharpshooter', name: 'SHARPSHOOTER', description: 'Achieve 80%+ accuracy in a match', icon: '🔫' },
  { id: 'bossSlayer', name: 'BOSS SLAYER', description: 'Defeat a boss', icon: '👑' },
  { id: 'noScope', name: 'NO SCOPE', description: 'Get a kill with sniper without ADS', icon: '🔭' },
  { id: 'meleeMaster', name: 'MELEE MASTER', description: 'Get 10 melee kills', icon: '🔪' },
];

// ─── QUICK CHAT ───

export interface QuickChatOption {
  id: string;
  label: string;
  icon: string;
}

export const QUICK_CHAT_OPTIONS: QuickChatOption[] = [
  { id: 'enemy', label: 'Enemy spotted', icon: '⚠️' },
  { id: 'backup', label: 'Need backup', icon: '🆘' },
  { id: 'pushing', label: 'Pushing', icon: '➡️' },
  { id: 'retreat', label: 'Retreat', icon: '↩️' },
  { id: 'regroup', label: 'Regroup', icon: '🔄' },
  { id: 'nice', label: 'Nice shot', icon: '👏' },
  { id: 'cover', label: 'Cover me', icon: '🛡️' },
  { id: 'flank', label: 'Flanking', icon: '↪️' },
];

// ─── DOMINATION ZONES ───

export interface DominationZoneUI {
  id: string;
  x: number;
  z: number;
  radius: number;
  team: 'alpha' | 'bravo' | 'neutral';
  progress: number;
  contested: boolean;
}

// ─── CHARACTER CLASSES ───

export type CharacterClass = 'assault' | 'recon' | 'heavy' | 'medic';

export interface CharacterConfig {
  key: CharacterClass;
  name: string;
  description: string;
  baseHp: number;
  baseSpeed: number;
  baseStamina: number;
  damageMult: number;
  reloadMult: number;
  unlockLevel: number;
}

export const CHARACTERS: Record<CharacterClass, CharacterConfig> = {
  assault: { key: 'assault', name: 'ASSAULT', description: 'Balanced fighter with standard stats and faster reloads.', baseHp: 100, baseSpeed: 6, baseStamina: 100, damageMult: 1.0, reloadMult: 0.85, unlockLevel: 1 },
  recon: { key: 'recon', name: 'RECON', description: 'Fast and agile, lower HP but high stamina and speed.', baseHp: 75, baseSpeed: 8, baseStamina: 150, damageMult: 1.1, reloadMult: 0.9, unlockLevel: 1 },
  heavy: { key: 'heavy', name: 'HEAVY', description: 'Tank class with high HP and damage resistance, but slow.', baseHp: 150, baseSpeed: 4.5, baseStamina: 80, damageMult: 0.95, reloadMult: 1.0, unlockLevel: 3 },
  medic: { key: 'medic', name: 'MEDIC', description: 'Support class with faster health regen and balanced stats.', baseHp: 90, baseSpeed: 6.5, baseStamina: 120, damageMult: 1.0, reloadMult: 0.8, unlockLevel: 5 },
};

// ─── ARMOR TYPES ───

export type ArmorType = 'light' | 'medium' | 'heavy' | 'none';

export interface ArmorConfig {
  key: ArmorType;
  name: string;
  description: string;
  hpBonus: number;
  speedMult: number;
  damageReduction: number;
  cost: number;
  unlockLevel: number;
}

export const ARMORS: Record<ArmorType, ArmorConfig> = {
  none: { key: 'none', name: 'NO ARMOR', description: 'No protection, maximum speed.', hpBonus: 0, speedMult: 1.1, damageReduction: 0, cost: 0, unlockLevel: 1 },
  light: { key: 'light', name: 'LIGHT VEST', description: 'Light kevlar vest, minor protection.', hpBonus: 25, speedMult: 1.0, damageReduction: 0.1, cost: 300, unlockLevel: 1 },
  medium: { key: 'medium', name: 'MEDIUM PLATE', description: 'Standard combat armor, balanced protection.', hpBonus: 50, speedMult: 0.9, damageReduction: 0.2, cost: 800, unlockLevel: 2 },
  heavy: { key: 'heavy', name: 'HEAVY EXO', description: 'Heavy exo-suit, maximum protection but slow.', hpBonus: 100, speedMult: 0.75, damageReduction: 0.35, cost: 2000, unlockLevel: 4 },
};

// ─── GRENADE TYPES ───

export type GrenadeType = 'frag' | 'smoke' | 'flashbang' | 'incendiary';

export interface GrenadeConfig {
  key: GrenadeType;
  name: string;
  description: string;
  damage: number;
  radius: number;
  effect: 'explosion' | 'smoke' | 'flash' | 'fire';
  cost: number;
  unlockLevel: number;
}

export const GRENADES: Record<GrenadeType, GrenadeConfig> = {
  frag: { key: 'frag', name: 'FRAG', description: 'Standard explosive grenade.', damage: 80, radius: 5, effect: 'explosion', cost: 0, unlockLevel: 1 },
  smoke: { key: 'smoke', name: 'SMOKE', description: 'Creates smoke screen for cover.', damage: 0, radius: 6, effect: 'smoke', cost: 200, unlockLevel: 2 },
  flashbang: { key: 'flashbang', name: 'FLASHBANG', description: 'Disorients enemies with bright flash.', damage: 0, radius: 8, effect: 'flash', cost: 350, unlockLevel: 3 },
  incendiary: { key: 'incendiary', name: 'INCENDIARY', description: 'Burns area with fire over time.', damage: 120, radius: 4, effect: 'fire', cost: 600, unlockLevel: 4 },
};

// ─── WEAPON UPGRADES ───

export type UpgradeType = 'damage' | 'reloadSpeed' | 'magSize' | 'recoil' | 'spread';

export interface UpgradeConfig {
  key: UpgradeType;
  name: string;
  description: string;
  maxLevel: number;
  costPerLevel: number;
  effectPerLevel: number;
}

export const UPGRADES: Record<UpgradeType, UpgradeConfig> = {
  damage: { key: 'damage', name: 'DAMAGE', description: '+10% damage per level', maxLevel: 5, costPerLevel: 400, effectPerLevel: 0.1 },
  reloadSpeed: { key: 'reloadSpeed', name: 'RELOAD SPEED', description: '-15% reload time per level', maxLevel: 5, costPerLevel: 300, effectPerLevel: 0.15 },
  magSize: { key: 'magSize', name: 'MAG SIZE', description: '+20% magazine capacity per level', maxLevel: 5, costPerLevel: 350, effectPerLevel: 0.2 },
  recoil: { key: 'recoil', name: 'RECOIL CONTROL', description: '-20% recoil per level', maxLevel: 5, costPerLevel: 300, effectPerLevel: 0.2 },
  spread: { key: 'spread', name: 'ACCURACY', description: '-15% spread per level', maxLevel: 5, costPerLevel: 250, effectPerLevel: 0.15 },
};

// ─── PLAYER PROGRESSION ───

export interface LoginStreak {
  lastLogin: string;
  currentStreak: number;
  lastClaimed: string;
  totalLogins: number;
}

export interface WeeklyChallenge {
  id: string;
  description: string;
  target: number;
  reward: number;
  type: 'headshots' | 'melee' | 'waves' | 'kills' | 'matches' | 'score';
}

export interface WeeklyChallengeState {
  weekStart: string;
  challenges: { challenge: WeeklyChallenge; progress: number; completed: boolean }[];
}

export interface PrestigeInfo {
  level: number;
  badges: string[];
}

export interface PlayerProgression {
  level: number;
  xp: number;
  battleSpoils: number;
  unlockedWeapons: WeaponKey[];
  unlockedArmors: ArmorType[];
  unlockedGrenades: GrenadeType[];
  unlockedCharacters: CharacterClass[];
  unlockedPerks: PerkType[];
  weaponUpgrades: Partial<Record<WeaponKey, Partial<Record<UpgradeType, number>>>>;
  totalKills: number;
  totalScore: number;
  matchesPlayed: number;
  bestWave: number;
  weaponKills: Partial<Record<WeaponKey, number>>;
  dailyChallenges: DailyChallengeState;
  loginStreak: LoginStreak;
  weeklyChallenges: WeeklyChallengeState;
  prestige: PrestigeInfo;
  hasSeenTutorial: boolean;
  totalHeadshots: number;
  totalDeaths: number;
  totalMeleeKills: number;
}

export const DEFAULT_PROGRESSION: PlayerProgression = {
  level: 1,
  xp: 0,
  battleSpoils: 0,
  unlockedWeapons: ['pistol', 'smg'],
  unlockedArmors: ['none', 'light'],
  unlockedGrenades: ['frag'],
  unlockedCharacters: ['assault', 'recon'],
  unlockedPerks: ['none'],
  weaponUpgrades: {},
  totalKills: 0,
  totalScore: 0,
  matchesPlayed: 0,
  bestWave: 1,
  weaponKills: {},
  dailyChallenges: { date: '', challenges: [] },
  loginStreak: { lastLogin: '', currentStreak: 0, lastClaimed: '', totalLogins: 0 },
  weeklyChallenges: { weekStart: '', challenges: [] },
  prestige: { level: 0, badges: [] },
  hasSeenTutorial: false,
  totalHeadshots: 0,
  totalDeaths: 0,
  totalMeleeKills: 0,
};

export function xpForLevel(level: number): number {
  return 100 + (level - 1) * 50;
}

export function loadProgression(): PlayerProgression {
  try {
    const saved = localStorage.getItem('lm_progression');
    if (saved) return { ...DEFAULT_PROGRESSION, ...JSON.parse(saved) };
  } catch {}
  return { ...DEFAULT_PROGRESSION };
}

export function saveProgression(p: PlayerProgression) {
  try {
    localStorage.setItem('lm_progression', JSON.stringify(p));
  } catch {}
}

export function addXp(p: PlayerProgression, xp: number): PlayerProgression {
  let newP = { ...p, xp: p.xp + xp };
  while (newP.xp >= xpForLevel(newP.level)) {
    newP.xp -= xpForLevel(newP.level);
    newP.level++;
    newP.battleSpoils += 200;
  }
  return newP;
}

// ─── LOADOUT CONFIG ───

export interface LoadoutConfig {
  character: CharacterClass;
  armor: ArmorType;
  primaryWeapon: WeaponKey;
  secondaryWeapon: WeaponKey;
  grenadeType: GrenadeType;
  grenadeCount: number;
  perk: PerkType;
}

export const DEFAULT_LOADOUT: LoadoutConfig = {
  character: 'assault',
  armor: 'light',
  primaryWeapon: 'smg',
  secondaryWeapon: 'pistol',
  grenadeType: 'frag',
  grenadeCount: 3,
  perk: 'none',
};

// ─── PERK SYSTEM ───

export type PerkType = 'none' | 'scavenger' | 'fasthands' | 'juggernaut' | 'ghost' | 'doubletap';

export interface PerkConfig {
  key: PerkType;
  name: string;
  description: string;
  unlockLevel: number;
  cost: number;
}

export const PERKS: Record<PerkType, PerkConfig> = {
  none: { key: 'none', name: 'NONE', description: 'No perk equipped.', unlockLevel: 1, cost: 0 },
  scavenger: { key: 'scavenger', name: 'SCAVENGER', description: 'Pick up ammo from dead enemies. +50% reserve ammo.', unlockLevel: 1, cost: 400 },
  fasthands: { key: 'fasthands', name: 'FAST HANDS', description: 'Swap weapons 50% faster. Reload 30% faster.', unlockLevel: 2, cost: 600 },
  juggernaut: { key: 'juggernaut', name: 'JUGGERNAUT', description: '+50 HP. Ignore first 20 damage each life.', unlockLevel: 3, cost: 1000 },
  ghost: { key: 'ghost', name: 'GHOST', description: 'Enemies detect you 50% slower. Quieter footsteps.', unlockLevel: 4, cost: 800 },
  doubletap: { key: 'doubletap', name: 'DOUBLE TAP', description: '+20% fire rate. +15% damage.', unlockLevel: 5, cost: 1200 },
};

// ─── KILLSTREAK REWARDS ───

export type KillstreakRewardType = 'uav' | 'airstrike' | 'supplydrop' | 'gunship';

export interface KillstreakRewardConfig {
  key: KillstreakRewardType;
  name: string;
  description: string;
  requiredStreak: number;
}

export const KILLSTREAK_REWARDS: Record<KillstreakRewardType, KillstreakRewardConfig> = {
  uav: { key: 'uav', name: 'UAV SCAN', description: 'Reveals enemy positions on compass for 10 seconds.', requiredStreak: 3 },
  airstrike: { key: 'airstrike', name: 'AIRSTRIKE', description: 'Call in explosive barrage on marked area.', requiredStreak: 5 },
  supplydrop: { key: 'supplydrop', name: 'SUPPLY DROP', description: 'Heals, refills ammo, temporary damage boost.', requiredStreak: 7 },
  gunship: { key: 'gunship', name: 'GUNSHIP', description: 'AI helicopter circles map shooting enemies for 15 seconds.', requiredStreak: 10 },
};

// ─── WAVE OBJECTIVES ───

export type WaveObjectiveType = 'survive' | 'defend' | 'eliminate' | 'extract';

export interface WaveObjective {
  type: WaveObjectiveType;
  text: string;
  timer: number;
  targetPos: { x: number; z: number } | null;
  progress: number;
  maxProgress: number;
  completed: boolean;
  failed: boolean;
}

export const DEFAULT_OBJECTIVE: WaveObjective = {
  type: 'survive',
  text: 'Survive the wave',
  timer: 0,
  targetPos: null,
  progress: 0,
  maxProgress: 1,
  completed: false,
  failed: false,
};

// ─── DAILY CHALLENGES ───

export interface DailyChallenge {
  id: string;
  description: string;
  target: number;
  reward: number;
  type: 'headshots' | 'melee' | 'waves' | 'kills' | 'nodamage';
}

export interface DailyChallengeState {
  date: string;
  challenges: { challenge: DailyChallenge; progress: number; completed: boolean }[];
}

export const DAILY_CHALLENGE_POOL: DailyChallenge[] = [
  { id: 'hs15', description: 'Get 15 headshots', target: 15, reward: 300, type: 'headshots' },
  { id: 'hs30', description: 'Get 30 headshots', target: 30, reward: 500, type: 'headshots' },
  { id: 'melee5', description: 'Melee 5 enemies', target: 5, reward: 250, type: 'melee' },
  { id: 'melee10', description: 'Melee 10 enemies', target: 10, reward: 400, type: 'melee' },
  { id: 'wave5', description: 'Reach wave 5', target: 5, reward: 300, type: 'waves' },
  { id: 'wave10', description: 'Reach wave 10', target: 10, reward: 600, type: 'waves' },
  { id: 'kills25', description: 'Get 25 kills', target: 25, reward: 250, type: 'kills' },
  { id: 'kills50', description: 'Get 50 kills', target: 50, reward: 500, type: 'kills' },
  { id: 'nodmg3', description: 'Clear 3 waves without taking damage', target: 3, reward: 500, type: 'nodamage' },
];

export function getDailyChallenges(): { challenge: DailyChallenge; progress: number; completed: boolean }[] {
  const today = new Date().toDateString();
  // Deterministic selection based on date
  const seed = today.charCodeAt(0) + today.charCodeAt(1) + today.charCodeAt(2);
  const pool = [...DAILY_CHALLENGE_POOL];
  const selected: DailyChallenge[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = (seed + i * 7) % pool.length;
    selected.push(pool.splice(idx, 1)[0]);
  }
  return selected.map(challenge => ({ challenge, progress: 0, completed: false }));
}

// ─── WEEKLY CHALLENGES ───

export const WEEKLY_CHALLENGE_POOL: WeeklyChallenge[] = [
  { id: 'wk_hs50', description: 'Get 50 headshots this week', target: 50, reward: 1000, type: 'headshots' },
  { id: 'wk_hs100', description: 'Get 100 headshots this week', target: 100, reward: 2000, type: 'headshots' },
  { id: 'wk_melee20', description: 'Melee 20 enemies this week', target: 20, reward: 800, type: 'melee' },
  { id: 'wk_kills200', description: 'Get 200 kills this week', target: 200, reward: 1500, type: 'kills' },
  { id: 'wk_kills500', description: 'Get 500 kills this week', target: 500, reward: 3000, type: 'kills' },
  { id: 'wk_wave15', description: 'Reach wave 15', target: 15, reward: 1200, type: 'waves' },
  { id: 'wk_matches10', description: 'Play 10 matches this week', target: 10, reward: 600, type: 'matches' },
  { id: 'wk_score10k', description: 'Earn 10,000 score this week', target: 10000, reward: 2000, type: 'score' },
];

export function getWeekStart(): string {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day;
  const sunday = new Date(now.getFullYear(), now.getMonth(), diff);
  return sunday.toDateString();
}

export function getWeeklyChallenges(): { challenge: WeeklyChallenge; progress: number; completed: boolean }[] {
  const weekStart = getWeekStart();
  const seed = weekStart.charCodeAt(0) + weekStart.charCodeAt(1) + weekStart.charCodeAt(2);
  const pool = [...WEEKLY_CHALLENGE_POOL];
  const selected: WeeklyChallenge[] = [];
  for (let i = 0; i < 4; i++) {
    const idx = (seed + i * 5) % pool.length;
    selected.push(pool.splice(idx, 1)[0]);
  }
  return selected.map(challenge => ({ challenge, progress: 0, completed: false }));
}

// ─── LOGIN STREAK REWARDS ───

export const LOGIN_REWARDS: { day: number; spoils: number; label: string }[] = [
  { day: 1, spoils: 50, label: 'Day 1 — 50 Spoils' },
  { day: 2, spoils: 75, label: 'Day 2 — 75 Spoils' },
  { day: 3, spoils: 100, label: 'Day 3 — 100 Spoils' },
  { day: 4, spoils: 150, label: 'Day 4 — 150 Spoils' },
  { day: 5, spoils: 200, label: 'Day 5 — 200 Spoils' },
  { day: 6, spoils: 300, label: 'Day 6 — 300 Spoils' },
  { day: 7, spoils: 500, label: 'Day 7 — 500 Spoils + BONUS CRATE' },
];

export function claimLoginReward(p: PlayerProgression): { progression: PlayerProgression; reward: { spoils: number; day: number } | null } {
  const today = new Date().toDateString();
  if (p.loginStreak.lastClaimed === today) return { progression: p, reward: null };
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const newStreak = p.loginStreak.lastLogin === yesterday ? p.loginStreak.currentStreak + 1 : 1;
  const dayIndex = Math.min(newStreak - 1, LOGIN_REWARDS.length - 1);
  const reward = LOGIN_REWARDS[dayIndex];
  const updated: PlayerProgression = {
    ...p,
    loginStreak: {
      lastLogin: today,
      currentStreak: newStreak,
      lastClaimed: today,
      totalLogins: p.loginStreak.totalLogins + 1,
    },
    battleSpoils: p.battleSpoils + reward.spoils,
  };
  return { progression: updated, reward: { spoils: reward.spoils, day: newStreak } };
}

// ─── PRESTIGE SYSTEM ───

export const MAX_LEVEL = 50;
export const PRESTIGE_BADGES = ['🥉', '🥈', '🥇', '💎', '👑', '🔥', '⭐', '🏆'];

export function canPrestige(p: PlayerProgression): boolean {
  return p.level >= MAX_LEVEL;
}

export function doPrestige(p: PlayerProgression): PlayerProgression {
  if (!canPrestige(p)) return p;
  const badgeIndex = Math.min(p.prestige.level, PRESTIGE_BADGES.length - 1);
  return {
    ...DEFAULT_PROGRESSION,
    battleSpoils: p.battleSpoils + 1000,
    totalKills: p.totalKills,
    totalScore: p.totalScore,
    totalHeadshots: p.totalHeadshots,
    totalDeaths: p.totalDeaths,
    totalMeleeKills: p.totalMeleeKills,
    matchesPlayed: p.matchesPlayed,
    bestWave: p.bestWave,
    weaponKills: p.weaponKills,
    prestige: {
      level: p.prestige.level + 1,
      badges: [...p.prestige.badges, PRESTIGE_BADGES[badgeIndex]],
    },
    hasSeenTutorial: true,
  };
}

// ─── ENEMY CONFIG ───

export interface EnemyConfig {
  type: EnemyType;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  fireRate: number;
  color: number;
  scale: number;
  isBoss?: boolean;
}

export const ENEMY_CONFIG: Record<EnemyType, EnemyConfig> = {
  grunt: { type: 'grunt', name: 'GRUNT', hp: 50, damage: 8, speed: 3, fireRate: 1500, color: 0x4a5a3a, scale: 1 },
  rifleman: { type: 'rifleman', name: 'RIFLEMAN', hp: 80, damage: 15, speed: 2.5, fireRate: 1000, color: 0x3a4a5a, scale: 1 },
  shotgunner: { type: 'shotgunner', name: 'SHOTGUNNER', hp: 100, damage: 25, speed: 3.5, fireRate: 2000, color: 0x5a3a3a, scale: 1.1 },
  heavy: { type: 'heavy', name: 'HEAVY GUNNER', hp: 200, damage: 20, speed: 1.5, fireRate: 800, color: 0x2a2a2a, scale: 1.3 },
  sniper: { type: 'sniper', name: 'SNIPER', hp: 60, damage: 40, speed: 1.8, fireRate: 2500, color: 0x3a3a5a, scale: 1 },
  charger: { type: 'charger', name: 'CHARGER', hp: 70, damage: 30, speed: 7, fireRate: 600, color: 0x5a2a2a, scale: 1 },
  bomber: { type: 'bomber', name: 'BOMBER', hp: 60, damage: 60, speed: 3, fireRate: 9999, color: 0x4a2a0a, scale: 1 },
  medic: { type: 'medic', name: 'MEDIC', hp: 80, damage: 5, speed: 2.5, fireRate: 2000, color: 0x2a4a2a, scale: 1 },
  boss: { type: 'boss', name: 'WARLORD', hp: 800, damage: 35, speed: 2, fireRate: 600, color: 0x8a1a1a, scale: 2.5, isBoss: true },
  drone: { type: 'drone', name: 'COMBAT DRONE', hp: 40, damage: 12, speed: 5, fireRate: 800, color: 0x1a3a4a, scale: 0.7 },
  tank: { type: 'tank', name: 'TANK', hp: 500, damage: 50, speed: 1, fireRate: 1500, color: 0x3a3a2a, scale: 2, isBoss: true },
};

// ─── WEAPON MASTERY ───

export interface WeaponMasteryLevel {
  kills: number;
  name: string;
  camo: string;
}

export const WEAPON_MASTERY: WeaponMasteryLevel[] = [
  { kills: 0, name: 'STANDARD', camo: 'default' },
  { kills: 50, name: 'BRONZE', camo: 'bronze' },
  { kills: 100, name: 'SILVER', camo: 'silver' },
  { kills: 150, name: 'GOLD', camo: 'gold' },
  { kills: 250, name: 'DIAMOND', camo: 'diamond' },
];
