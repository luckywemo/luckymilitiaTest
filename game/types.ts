/**
 * Shared game type definitions.
 * Extracted from MainScene to improve modularity and type safety.
 */

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

export interface BotData {
  id: string;
  team: 'alpha' | 'bravo';
  x: number;
  y: number;
  angle: number;
  weaponKey: string;
  name?: string;
}

export interface RemotePlayerData {
  id?: string;
  x: number;
  y: number;
  angle: number;
  name: string;
  team: 'alpha' | 'bravo';
}

export interface LuckBoxData {
  id: string;
  x: number;
  y: number;
}

export interface WeaponBoxData {
  id: string;
  x: number;
  y: number;
}

export interface WeaponItemData {
  id: string;
  x: number;
  y: number;
  weaponKey: string;
}

export interface TeamScores {
  alpha: number;
  bravo: number;
}

export interface GameStats {
  hp: number;
  maxHp: number;
  shield: number;
  ammo: number;
  maxAmmo: number;
  weaponKey: string;
  weaponName: string;
  weaponMode?: string;
  isInfinite: boolean | undefined;
  abilityCooldown: number;
  abilityMaxCooldown: number;
  kills: number;
  targetValue: number;
  points: number;
  teamScores: TeamScores;
  mode: string;
  isOver: boolean;
  playerPos: { x: number; y: number; rotation: number };
  entities: MinimapEntity[];
  lives: number;
  maxLives: number;
  survivalTimer: number;
  collectedItems: number;
  shotsFired: number;
  shotsHit: number;
  missionTime: number;
  missionStarted: boolean;
  ping: number;
  mpPeerCount: number;
  items: WorldItem[];
  objectives: ObjectiveMarker[];
  isPaused: boolean;
  musicMuted: boolean;
  sfxMuted: boolean;
}

export interface WorldItem {
  x: number;
  y: number;
  type: 'luck' | 'weapon' | 'intel' | 'weapon_drop';
}

export interface ObjectiveMarker {
  x: number;
  y: number;
  type: 'hardpoint' | 'extraction' | 'survival';
}

export interface MinimapEntity {
  x: number;
  y: number;
  team: string;
  type?: string;
}

export type NetworkMessageType =
  | 'sync'
  | 'fire'
  | 'score_update'
  | 'hp_move'
  | 'spawn_bot'
  | 'spawn_box'
  | 'spawn_item'
  | 'destroy_object'
  | 'bot_sync'
  | 'game_over'
  | 'initial_sync';

export interface SyncMessage {
  type: 'sync';
  x: number;
  y: number;
  angle: number;
  name: string;
  team: 'alpha' | 'bravo';
  id?: string;
}

export interface FireMessage {
  type: 'fire';
  x: number;
  y: number;
  angle: number;
  weaponKey: string;
  team: 'alpha' | 'bravo';
}

export interface ScoreUpdateMessage {
  type: 'score_update';
  scores: TeamScores;
}

export interface HardpointMoveMessage {
  type: 'hp_move';
  x: number;
  y: number;
}

export interface SpawnBotMessage extends BotData {
  type: 'spawn_bot';
}

export interface SpawnBoxMessage {
  type: 'spawn_box';
  boxType: 'luck' | 'weapon';
  id: string;
  x: number;
  y: number;
}

export interface SpawnItemMessage {
  type: 'spawn_item';
  id: string;
  weaponKey: string;
  x: number;
  y: number;
}

export interface DestroyObjectMessage {
  type: 'destroy_object';
  id: string;
}

export interface BotSyncMessage {
  type: 'bot_sync';
  bots: BotData[];
}

export interface GameOverMessage {
  type: 'game_over';
  winner: string;
}

export interface InitialSyncMessage {
  type: 'initial_sync';
  bots: BotData[];
  luckBoxes: LuckBoxData[];
  weaponBoxes: WeaponBoxData[];
  itemData: WeaponItemData[];
  scores: TeamScores;
}

export type NetworkMessage =
  | SyncMessage
  | FireMessage
  | ScoreUpdateMessage
  | HardpointMoveMessage
  | SpawnBotMessage
  | SpawnBoxMessage
  | SpawnItemMessage
  | DestroyObjectMessage
  | BotSyncMessage
  | GameOverMessage
  | InitialSyncMessage;
