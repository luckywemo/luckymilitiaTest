import React, { useEffect, useRef, useState } from 'react';
import { FPSGame } from './FPSGame';
import { LoadoutScreen } from './LoadoutScreen';
import { MultiplayerClient, type GameMode } from './MultiplayerClient';
import { DailyRewards } from '../components/DailyRewards';
import Leaderboard from '../components/Leaderboard';
import { PrestigePanel } from '../components/PrestigePanel';
import { TutorialOverlay } from '../components/TutorialOverlay';
import { WeeklyChallenges } from '../components/WeeklyChallenges';
import type { FPSGameStats, EnemyType, ScorePopup, GameSettings, LoadoutConfig, PlayerProgression, DamageNumber, HitMarker, WaveObjective, KillstreakRewardType, Achievement, WaveModifier, DominationZoneUI, MapType } from './types';
import { DEFAULT_SETTINGS, DEFAULT_LOADOUT, loadProgression, saveProgression, addXp, xpForLevel, KILLSTREAK_REWARDS, getDailyChallenges, getWeeklyChallenges, getWeekStart, claimLoginReward, WEAPON_MASTERY, QUICK_CHAT_OPTIONS, ARMORS, WEAPONS, CHARACTERS, GRENADES, PERKS, BATTLEFIELDS, MAX_LEVEL, PRESTIGE_BADGES, canPrestige, doPrestige } from './types';

interface Game3DProps {
  onExit?: () => void;
  onKill?: () => void;
  onMatchEnd?: (stats: FPSGameStats, progression?: PlayerProgression) => void;
  missionName?: string;
  missionObjective?: string;
  missionType?: string;
}

interface FeedItem {
  id: number;
  text: string;
}

const ENEMY_LABELS: Record<EnemyType, string> = {
  grunt: 'GRUNT',
  rifleman: 'RIFLEMAN',
  shotgunner: 'SHOTGUNNER',
  heavy: 'HEAVY',
  sniper: 'SNIPER',
  charger: 'CHARGER',
  bomber: 'BOMBER',
  medic: 'MEDIC',
  boss: 'WARLORD',
  drone: 'DRONE',
  tank: 'TANK',
};

// ─── Mobile HUD icon SVGs ───
const icons = {
  fire: <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20C12 20 8 16 8 11C8 7 10 4 12 2C14 4 16 7 16 11C16 16 12 20 12 20Z"/><path d="M15 22C17 19 18 16 17 13"/><path d="M9 13C8 16 9 19 11 22"/></g>,
  scope: <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 6V10M12 14V18M18 12H14M10 12H6M15.5 15.5L17 17M17 7L15.5 8.5M8.5 15.5L7 17M7 7L8.5 8.5"/></g>,
  reload: <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4V2M12 22V20M20 12H22M2 12H4M18.36 5.64L19.78 4.22M4.22 19.78L5.64 18.36M18.36 18.36L19.78 19.78M4.22 4.22L5.64 5.64"/><path d="M12 15A3 3 0 1 0 12 9A3 3 0 1 0 12 15Z"/><path d="M12 15L16 15"/></g>,
  jump: <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21V10M12 10L7 15M12 10L17 15"/><path d="M6 4H18"/></g>,
  crouch: <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 18H14C16 18 18 16 18 14V10"/><path d="M15 18L12 21L9 18"/><path d="M18 13L22 13"/></g>,
  knife: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 22L16 12C18 10 18 7 16 5L20 2C22 4 22 9 19 12L9 22"/><path d="M8 22H4"/></g>,
  grenade: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="7"/><path d="M13 6V4H17L18 2"/><path d="M16 10L14 8"/></g>,
  swap: <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 11L3 8L8 5"/><path d="M16 13L21 16L16 19"/><path d="M3 8H13C16 8 18 10 19 12"/><path d="M21 16H11C8 16 6 14 5 12"/></g>,
  quickScope: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2V5M12 19V22M2 12H5M19 12H22"/><path d="M12 9V15"/></g>,
  autoOn: <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10H10V4H4Z"/><path d="M14 14H20V20H14Z"/><path d="M14 6L20 6"/><path d="M4 18H10"/></g>,
  autoOff: <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10H10V4H4Z"/><path d="M14 14H20V20H14Z"/><path d="M14 6L20 6"/><path d="M4 18H10"/></g>,
  leanLeft: <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6L4 12L8 18"/><path d="M4 12H16"/><path d="M20 6V18"/></g>,
  leanRight: <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 6L20 12L16 18"/><path d="M20 12H8"/><path d="M4 6V18"/></g>,
  gear: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15C19.8 15.8 19.4 16.6 18.6 16.8L17.4 17.1C17.1 17.7 16.7 18.2 16.2 18.7L16.6 19.9C17.1 20.7 16.4 21.5 15.7 21.2L14.6 20.6C14 20.9 13.4 21.1 12.7 21.2L12.3 22.5C12.1 23.3 11 23.3 10.7 22.5L10.3 21.2C9.7 21.1 9.1 20.9 8.5 20.6L7.4 21.2C6.6 21.5 5.9 20.7 6.3 19.9L6.8 18.7C6.3 18.2 5.9 17.7 5.6 17.1L4.4 16.8C3.6 16.6 3.2 15.8 3.6 15L4.6 14.3C4.5 13.8 4.5 13.2 4.6 12.7L3.6 12C3.2 11.2 3.6 10.4 4.4 10.2L5.6 9.9C5.9 9.3 6.3 8.8 6.8 8.3L6.4 7.1C5.9 6.3 6.6 5.5 7.3 5.8L8.4 6.4C9 6.1 9.6 5.9 10.3 5.8L10.7 4.5C10.9 3.7 12 3.7 12.3 4.5L12.7 5.8C13.3 5.9 13.9 6.1 14.5 6.4L15.6 5.8C16.4 5.5 17.1 6.3 16.7 7.1L16.2 8.3C16.7 8.8 17.1 9.3 17.4 9.9L18.6 10.2C19.4 10.4 19.8 11.2 19.4 12L18.4 12.7C18.5 13.2 18.5 13.8 18.4 14.3L19.4 15Z"/></g>,
  sprint: <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 4C13 5.1 13.9 6 15 6C16.1 6 17 5.1 17 4"/><path d="M5 12L9 8L13 12L9 18L13 22"/><path d="M9 8L5 4"/><path d="M15 14L19 10L22 13"/></g>,
  emote: <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14"/><circle cx="9" cy="9" r="0.5" fill="currentColor"/><circle cx="15" cy="9" r="0.5" fill="currentColor"/></g>,
};

const CHAR_COLORS: Record<string, string> = {
  assault: '#f97316', recon: '#22d3ee', heavy: '#dc2626', medic: '#22c55e',
};

const CHAR_ICONS: Record<string, React.ReactNode> = {
  assault: <path d="M28 18 L36 18 L36 28 L46 28 L46 36 L36 36 L36 46 L28 46 L28 36 L18 36 L18 28 L28 28 Z" fill={CHAR_COLORS.assault}/>,
  recon: <path d="M32 16 L40 32 L28 32 L36 48 L28 48 L20 32 L32 32 L24 16 Z" fill={CHAR_COLORS.recon}/>,
  heavy: <path d="M32 16 L42 20 L42 30 L48 30 L48 38 L42 38 L42 48 L22 48 L22 38 L16 38 L16 30 L22 30 L22 20 Z" fill={CHAR_COLORS.heavy}/>,
  medic: <path d="M28 20 L36 20 L36 28 L44 28 L44 36 L36 36 L36 44 L28 44 L28 36 L20 36 L20 28 L28 28 Z" fill={CHAR_COLORS.medic}/>,
};

const HudButton: React.FC<{
  size: number;
  opacity: number;
  scale?: number;
  icon: React.ReactNode;
  activeColor?: string;
  borderColor?: string;
  onClick?: () => void;
  onDown?: () => void;
  onUp?: () => void;
  onDrag?: (dx: number, dy: number) => void;
}> = ({ size, opacity, scale = 1, icon, activeColor, borderColor, onClick, onDown, onUp, onDrag }) => {
  const [active, setActive] = useState(false);
  const lastDragPos = useRef<{ x: number; y: number } | null>(null);
  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(true);
    const t = 'touches' in e ? e.changedTouches[0] : e;
    lastDragPos.current = { x: t.clientX, y: t.clientY };
    onDown?.();
    onClick?.();
  };
  const handleMove = (e: React.TouchEvent) => {
    if (!active || !onDrag || !lastDragPos.current) return;
    e.preventDefault();
    e.stopPropagation();
    const t = e.changedTouches[0];
    const dx = t.clientX - lastDragPos.current.x;
    const dy = t.clientY - lastDragPos.current.y;
    lastDragPos.current = { x: t.clientX, y: t.clientY };
    onDrag(dx, dy);
  };
  const handleEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(false);
    lastDragPos.current = null;
    onUp?.();
  };
  return (
    <button
      className="rounded-full flex items-center justify-center touch-none transition-transform"
      style={{
        width: size * scale,
        height: size * scale,
        background: active ? (activeColor || 'rgba(249,115,22,0.5)') : `rgba(28,25,23,${0.55 * opacity})`,
        border: `2px solid ${active ? (borderColor || 'rgba(249,115,22,0.9)') : `rgba(120,113,108,${0.5 * opacity})`}`,
        boxShadow: `0 0 ${10 * opacity}px rgba(0,0,0,0.5)`,
        color: '#fff',
        opacity: 0.9 + opacity * 0.1,
        transform: active ? 'scale(0.92)' : 'scale(1)',
      }}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
    >
      <svg width={size * scale * 0.5} height={size * scale * 0.5} viewBox="0 0 24 24" style={{ opacity: 0.9 }}>
        {icon}
      </svg>
    </button>
  );
};

function allPlayersSort(scores: Record<string, any>): { id: string; name: string; kills: number; deaths: number; score: number; team: string }[] {
  return Object.entries(scores).map(([id, s]: [string, any]) => ({ id, name: s.name || 'UNKNOWN', kills: s.kills || 0, deaths: s.deaths || 0, score: s.score || 0, team: s.team || 'alpha' })).sort((a, b) => b.score - a.score);
}

export const Game3D: React.FC<Game3DProps> = ({ onExit, onKill, onMatchEnd, missionName, missionObjective, missionType }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<FPSGame | null>(null);
  const loadoutRef = useRef<LoadoutConfig>(DEFAULT_LOADOUT);
  const progressionRef = useRef<PlayerProgression>(loadProgression());
  const statsRef = useRef<FPSGameStats>({ kills: 0, shotsFired: 0, shotsHit: 0, hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, ammo: 30, magSize: 30, weaponName: 'MP5 TACTICAL', weaponKey: 'smg', grenades: 3, wave: 1, enemiesAlive: 0, killstreak: 0, score: 0, headshots: 0, damageDealt: 0, damageTaken: 0, compassEnemy: null, crosshairSpread: 0, isLeaning: null, suppressed: false, radarBlips: [], radarObjective: null, uavActive: false, scoreMultiplier: 1, comboTimer: 0, isBossWave: false, bossHp: 0, bossMaxHp: 0, waveDamageTaken: 0, waveHeadshots: 0, waveStartTime: 0, isEliteWave: false, waveModifier: null, spectatorTarget: null, lowAmmo: false, dominationZones: [], safeZoneTimer: 0, currentMap: '', isADS: false });
  const settingsRef = useRef<GameSettings>(DEFAULT_SETTINGS);
  const statsDirtyRef = useRef(false);
  const [stats, setStats] = useState<FPSGameStats>(statsRef.current);
  const [isLocked, setIsLocked] = useState(false);
  const [hit, setHit] = useState(false);
  const [headshot, setHeadshot] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [damageDir, setDamageDir] = useState<number | null>(null);
  const [dead, setDead] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [scorePopups, setScorePopups] = useState<ScorePopup[]>([]);
  const [killstreak, setKillstreak] = useState(0);
  const [waveAnnounce, setWaveAnnounce] = useState<number | null>(null);
  const [damageNumbers, setDamageNumbers] = useState<DamageNumber[]>([]);
  const [hitMarkers, setHitMarkers] = useState<HitMarker[]>([]);
  const [killstreakReward, setKillstreakReward] = useState<KillstreakRewardType | null>(null);
  const [objective, setObjective] = useState<WaveObjective | null>(null);
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [showStats, setShowStats] = useState(false);
  const [showBriefing, setShowBriefing] = useState(!!missionName);
  const [showLoadout, setShowLoadout] = useState(!missionName ? false : false);
  const [showModeSelect, setShowModeSelect] = useState(true);
  const [showMapSelect, setShowMapSelect] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [loadingTip, setLoadingTip] = useState('');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [selectedMap, setSelectedMap] = useState<MapType>('urban_desert');
  const [safeZoneTimer, setSafeZoneTimer] = useState(0);
  const [combatEngaged, setCombatEngaged] = useState(false);
  const [showSafeZoneLoadout, setShowSafeZoneLoadout] = useState(false);
  const [killstreakBanner, setKillstreakBanner] = useState<string | null>(null);
  const [showDailyRewards, setShowDailyRewards] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showPrestige, setShowPrestige] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showWeekly, setShowWeekly] = useState(false);
  const [loginRewardToast, setLoginRewardToast] = useState<string | null>(null);
  const wakeLockRef = useRef<any>(null);
  const [loadout, setLoadout] = useState<LoadoutConfig>(DEFAULT_LOADOUT);
  const [progression, setProgression] = useState<PlayerProgression>(() => loadProgression());
  const [isMobile] = useState(() => typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tiltCalibration = useRef<{ beta: number; gamma: number }>({ beta: 0, gamma: 0 });

  // Sync refs so the game instance always has fresh data without recreating
  useEffect(() => { loadoutRef.current = loadout; }, [loadout]);
  useEffect(() => { progressionRef.current = progression; }, [progression]);
  useEffect(() => { settingsRef.current = settings; }, [settings]);

  // Auto-claim login reward on mount
  useEffect(() => {
    const { progression: updated, reward } = claimLoginReward(progressionRef.current);
    if (reward) {
      saveProgression(updated);
      setProgression(updated);
      setLoginRewardToast(`Daily login: Day ${reward.day} — +${reward.spoils} Spoils!`);
      setTimeout(() => setLoginRewardToast(null), 5000);
    }
  }, []);

  // Show tutorial on first play
  useEffect(() => {
    if (!progressionRef.current.hasSeenTutorial) {
      setShowTutorial(true);
    }
  }, []);
  const moveJoyRef = useRef<{ id: number | null; startX: number; startY: number; baseX: number; baseY: number }>({ id: null, startX: 0, startY: 0, baseX: 0, baseY: 0 });
  const lookJoyRef = useRef<{ id: number | null; lastX: number; lastY: number; startY: number; startTime: number }>({ id: null, lastX: 0, lastY: 0, startY: 0, startTime: 0 });
  const lastMoveTapRef = useRef(0);
  const [joyPos, setJoyPos] = useState<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const [autoFire, setAutoFire] = useState(false);
  const [comboMult, setComboMult] = useState(1);
  const [bossWaveName, setBossWaveName] = useState<string | null>(null);
  const [waveBonus, setWaveBonus] = useState<{ text: string; score: number } | null>(null);
  const [screenFlash, setScreenFlash] = useState<{ intensity: number; color: number } | null>(null);
  // Multiplayer state
  const mpClientRef = useRef<MultiplayerClient | null>(null);
  const [mpLobby, setMpLobby] = useState(false);
  const [mpRoomCode, setMpRoomCode] = useState('');
  const [mpMode, setMpMode] = useState<GameMode>('tdm');
  const [mpScoreLimit, setMpScoreLimit] = useState(3000);
  const [mpStatus, setMpStatus] = useState('');
  const [mpScores, setMpScores] = useState<Record<string, { kills: number; deaths: number; score: number; team: string }>>({});
  const [mpKillFeed, setMpKillFeed] = useState<{ id: number; killer: string; victim: string; weapon: string; headshot: boolean }[]>([]);
  const [mpGameOver, setMpGameOver] = useState<{ winner: string; scores: any } | null>(null);
  const [mpPlayerName] = useState(() => `OP-${Math.floor(Math.random() * 9000 + 1000)}`);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [preMatchCountdown, setPreMatchCountdown] = useState(0);
  const [spawnProtect, setSpawnProtect] = useState(0);
  const [remotePlayerList, setRemotePlayerList] = useState<{ id: string; name: string; team: string; kills: number; deaths: number; score: number; ping: number; dead: boolean }[]>([]);
  // Achievement toasts
  const [achievementToasts, setAchievementToasts] = useState<{ id: string; achievement: Achievement; timestamp: number }[]>([]);
  // Wave modifier banner
  const [waveModifierBanner, setWaveModifierBanner] = useState<WaveModifier | null>(null);
  // Quick chat wheel
  const [showQuickChat, setShowQuickChat] = useState(false);
  // Spectator mode
  const [spectatorInfo, setSpectatorInfo] = useState<{ name: string; team: string } | null>(null);
  // Domination zones
  const [dominationZones, setDominationZones] = useState<DominationZoneUI[]>([]);
  // Killcam state
  const [showKillcam, setShowKillcam] = useState(false);
  // Weapon swap animation state
  const [weaponSwapAnim, setWeaponSwapAnim] = useState(false);
  // Objective notification banner
  const [objectiveBanner, setObjectiveBanner] = useState<string | null>(null);
  // Audio context for hitmarker sounds
  const audioCtxRef = useRef<AudioContext | null>(null);

  const addFeed = (text: string) => {
    setFeed((prev) => [{ id: Date.now(), text }, ...prev].slice(0, 5));
  };

  useEffect(() => {
    if (!containerRef.current) return;

    gameRef.current = new FPSGame(containerRef.current, {
      onKill: (enemyType: EnemyType, hs: boolean) => {
        onKill?.();
        addFeed(`✓ ${ENEMY_LABELS[enemyType]} ELIMINATED${hs ? ' ⚡' : ''}`);
      },
      onHit: (hs: boolean) => {
        setHit(true);
        if (hs) { setHeadshot(true); addFeed('⚡ HEADSHOT'); }
        setTimeout(() => { setHit(false); setHeadshot(false); }, hs ? 300 : 100);
        // Hitmarker audio — distinct pitch for headshot vs body shot
        try {
          if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          const ctx = audioCtxRef.current;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.frequency.value = hs ? 1400 : 800;
          osc.type = 'square';
          gain.gain.setValueAtTime(0.08, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (hs ? 0.12 : 0.06));
          osc.start(); osc.stop(ctx.currentTime + (hs ? 0.12 : 0.06));
        } catch {}
      },
      onStatsUpdate: (newStats) => {
        if (newStats.weaponKey !== statsRef.current.weaponKey) {
          setWeaponSwapAnim(true);
          setTimeout(() => setWeaponSwapAnim(false), 300);
        }
        // Keep the ref hot for game logic, but DON'T call setState here.
        // This fires on every shot/hit/pickup; pushing a ~40-field object into
        // React state at that rate re-renders the whole HUD and is the main
        // source of the mid-match stutter. The 100ms poller flushes it instead.
        statsRef.current = newStats;
        statsDirtyRef.current = true;
      },
      onDamage: (direction: number) => {
        setDamageDir(direction);
        setTimeout(() => setDamageDir(null), 600);
      },
      onDeath: () => {
        // Show killcam first, then AAR after 2.5s
        setShowKillcam(true);
        setTimeout(() => {
          setShowKillcam(false);
          setDead(true);
          setShowStats(true);
        }, 2500);
        // Unlock pointer on mobile
        if (typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0)) {
          window.dispatchEvent(new Event('mobile-unlock'));
        } else {
          document.exitPointerLock?.();
        }
        // Save progression: XP from kills/score, battle spoils from score
        const s = statsRef.current;
        const p = progressionRef.current;
        const xpGained = s.kills * 50 + s.score * 2 + s.wave * 100;
        const spoilsGained = Math.round(s.score * 1.5 + s.kills * 20);
        const newP = addXp(p, xpGained);
        // Track weapon kills for mastery
        const weaponKills = { ...newP.weaponKills };
        weaponKills[s.weaponKey] = (weaponKills[s.weaponKey] || 0) + s.kills;
        // Update daily challenges
        const today = new Date().toDateString();
        let dailyState = newP.dailyChallenges;
        if (dailyState.date !== today) {
          dailyState = { date: today, challenges: getDailyChallenges() };
        }
        dailyState.challenges.forEach(c => {
          if (c.completed) return;
          if (c.challenge.type === 'headshots') c.progress = Math.min(c.challenge.target, c.progress + s.headshots);
          else if (c.challenge.type === 'kills') c.progress = Math.min(c.challenge.target, c.progress + s.kills);
          else if (c.challenge.type === 'waves') c.progress = Math.min(c.challenge.target, c.progress + s.wave);
          if (c.progress >= c.challenge.target) {
            c.completed = true;
            addFeed(`★ DAILY CHALLENGE COMPLETE +${c.challenge.reward} ★`);
          }
        });
        // Update weekly challenges
        const currentWeek = getWeekStart();
        let weeklyState = newP.weeklyChallenges;
        if (weeklyState.weekStart !== currentWeek) {
          weeklyState = { weekStart: currentWeek, challenges: getWeeklyChallenges() };
        }
        weeklyState.challenges.forEach(c => {
          if (c.completed) return;
          if (c.challenge.type === 'headshots') c.progress = Math.min(c.challenge.target, c.progress + s.headshots);
          else if (c.challenge.type === 'kills') c.progress = Math.min(c.challenge.target, c.progress + s.kills);
          else if (c.challenge.type === 'waves') c.progress = Math.min(c.challenge.target, c.progress + s.wave);
          else if (c.challenge.type === 'matches') c.progress = Math.min(c.challenge.target, c.progress + 1);
          else if (c.challenge.type === 'score') c.progress = Math.min(c.challenge.target, c.progress + s.score);
          if (c.progress >= c.challenge.target) {
            c.completed = true;
            addFeed(`★ WEEKLY CHALLENGE COMPLETE +${c.challenge.reward} ★`);
          }
        });
        const updated = { ...newP, battleSpoils: newP.battleSpoils + spoilsGained, totalKills: newP.totalKills + s.kills, totalScore: newP.totalScore + s.score, matchesPlayed: newP.matchesPlayed + 1, bestWave: Math.max(newP.bestWave, s.wave), weaponKills, dailyChallenges: dailyState, weeklyChallenges: weeklyState, totalHeadshots: newP.totalHeadshots + s.headshots, totalDeaths: newP.totalDeaths + 1, totalMeleeKills: newP.totalMeleeKills + (s.kills > 0 ? 0 : 0) };
        saveProgression(updated);
        setProgression(updated);
      },
      onScorePopup: (popup: ScorePopup) => {
        setScorePopups((prev) => [...prev, popup].slice(-5));
        setTimeout(() => {
          setScorePopups((prev) => prev.filter((p) => p.id !== popup.id));
        }, 1500);
      },
      onKillstreak: (streak: number) => {
        setKillstreak(streak);
        const labels: Record<number, string> = { 3: 'TRIPLE KILL', 5: 'RAMPAGE', 7: 'UNSTOPPABLE', 10: 'GODLIKE' };
        if (labels[streak]) {
          addFeed(`★ ${labels[streak]} ★`);
          setKillstreakBanner(labels[streak]);
          setTimeout(() => setKillstreakBanner(null), 2500);
        }
        setTimeout(() => setKillstreak(0), 2000);
      },
      onWaveStart: (wave: number, obj?: WaveObjective) => {
        setWaveAnnounce(wave);
        if (obj) {
          setObjective(obj);
          setObjectiveBanner(`NEW OBJECTIVE: ${obj.text}`);
          setTimeout(() => setObjectiveBanner(null), 3000);
        }
        setTimeout(() => setWaveAnnounce(null), 2500);
      },
      onReloadStart: () => setReloading(true),
      onReloadComplete: () => setReloading(false),
      onDamageNumber: (dmg: DamageNumber) => {
        setDamageNumbers((prev) => [...prev, dmg].slice(-12));
        setTimeout(() => setDamageNumbers((prev) => prev.filter((d) => d.id !== dmg.id)), 1000);
      },
      onHitMarker: (marker: HitMarker) => {
        setHitMarkers((prev) => [...prev, marker].slice(-4));
        setTimeout(() => setHitMarkers((prev) => prev.filter((m) => m.id !== marker.id)), 400);
      },
      onKillstreakReward: (reward: KillstreakRewardType) => {
        setKillstreakReward(reward);
        addFeed(`★ ${KILLSTREAK_REWARDS[reward].name} DEPLOYED ★`);
        setTimeout(() => setKillstreakReward(null), 3000);
      },
      onObjectiveUpdate: (obj: WaveObjective) => {
        setObjective({ ...obj });
        if (obj.completed) {
          addFeed('★ OBJECTIVE COMPLETE +500 ★');
          setObjectiveBanner('SECTOR CLEARED');
          setTimeout(() => setObjectiveBanner(null), 3000);
        } else if (obj.failed) {
          addFeed('✗ OBJECTIVE FAILED ✗');
          setObjectiveBanner('OBJECTIVE FAILED');
          setTimeout(() => setObjectiveBanner(null), 3000);
        }
      },
      onCombo: (mult: number) => setComboMult(mult),
      onBossWave: (name: string) => {
        setBossWaveName(name);
        setTimeout(() => setBossWaveName(null), 4000);
      },
      onWaveBonus: (bonus: { text: string; score: number }) => {
        setWaveBonus(bonus);
        addFeed(`★ ${bonus.text} +${bonus.score} ★`);
        setTimeout(() => setWaveBonus(null), 3000);
      },
      onMpKill: (killer: string, victim: string, weapon: string, headshot: boolean) => {
        const entry = { id: Date.now(), killer, victim, weapon, headshot };
        setMpKillFeed(prev => [entry, ...prev].slice(0, 6));
      },
      onMpHit: (_fromId: string, _damage: number, headshot: boolean) => {
        setHit(headshot);
        setHeadshot(headshot);
        setTimeout(() => { setHit(false); setHeadshot(false); }, 200);
      },
      onMpScoreUpdate: (scores) => setMpScores(scores),
      onMpZoneUpdate: () => {},
      onMpGameOver: (winner, scores) => {
        setMpGameOver({ winner, scores });
        setShowStats(true);
      },
      onAchievement: (achievement: Achievement) => {
        const toastId = `${achievement.id}-${Date.now()}`;
        setAchievementToasts(prev => [...prev, { id: toastId, achievement, timestamp: Date.now() }]);
        addFeed(`★ ${achievement.name} UNLOCKED ★`);
        setTimeout(() => {
          setAchievementToasts(prev => prev.filter(t => t.id !== toastId));
        }, 5000);
      },
      onWaveModifier: (modifier: WaveModifier) => {
        setWaveModifierBanner(modifier);
        setTimeout(() => setWaveModifierBanner(null), 4000);
      },
      onSpectatorSwitch: (name: string, team: string) => {
        setSpectatorInfo({ name, team });
      },
      onKillConfirm: (_killstreak: number) => {
        // Sound is handled in FPSGame; this is for UI if needed
      },
      onQuickChat: (message: string, _sender: string) => {
        addFeed(`💬 ${message}`);
      },
      onDominationZone: (zones: DominationZoneUI[]) => {
        setDominationZones(zones);
      },
      onSafeZoneEnd: () => {
        setSafeZoneTimer(0);
        setShowSafeZoneLoadout(false);
        setCombatEngaged(true);
        setTimeout(() => setCombatEngaged(false), 2000);
        lockPointer();
      },
    }, settingsRef.current, loadoutRef.current, progressionRef.current, selectedMap);

    const handleLockChange = () => {
      setIsLocked(!!document.pointerLockElement);
    };
    document.addEventListener('pointerlockchange', handleLockChange);

    // Mobile fallback: pointer lock doesn't work on mobile browsers
    // Detect mobile and provide a way to set isLocked without pointer lock
    const isMobileDevice = typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0);
    const handleMobileLock = () => {
      setIsLocked(true);
      gameRef.current?.setLocked(true);
    };
    const handleMobileUnlock = () => {
      setIsLocked(false);
      gameRef.current?.setLocked(false);
    };
    if (isMobileDevice) {
      window.addEventListener('mobile-lock', handleMobileLock);
      window.addEventListener('mobile-unlock', handleMobileUnlock);
    }

    // Enable aim assist on mobile
    if (typeof window !== 'undefined' && (('ontouchstart' in window) || navigator.maxTouchPoints > 0)) {
      gameRef.current?.setAimAssist(0.5);
    }

    // Poll screen flash + multiplayer state. CRITICAL: only setState when the
    // value actually changed, otherwise every tick forces a full re-render of
    // the entire HUD tree and causes the mid-game stutter/hang.
    const flashInterval = setInterval(() => {
      const g = gameRef.current;
      if (!g) return;

      // Flush accumulated stats at a controlled 10Hz instead of on every shot.
      if (statsDirtyRef.current) {
        statsDirtyRef.current = false;
        const s = statsRef.current;
        setStats(s);
        setReloading(prev => (prev !== (s.ammo === 0) ? s.ammo === 0 : prev));
        setSafeZoneTimer(prev => (prev !== s.safeZoneTimer ? s.safeZoneTimer : prev));
      }

      const flash = g.getScreenFlash();
      const nextFlash = flash.intensity > 0 ? flash : null;
      if (nextFlash === null) {
        setScreenFlash(prev => (prev === null ? prev : null));
      } else {
        setScreenFlash(prev =>
          prev && prev.intensity === nextFlash.intensity && prev.color === nextFlash.color
            ? prev
            : nextFlash
        );
      }

      const countdown = g.getMpPreMatchCountdown();
      setPreMatchCountdown(prev => (prev === countdown ? prev : countdown));

      const protect = Math.ceil(g.getMpSpawnProtectTimer());
      setSpawnProtect(prev => (Math.ceil(prev) === protect ? prev : protect));

      // Remote player list allocates a new array every tick — bail out early in
      // single player and shallow-compare otherwise.
      const list = g.getRemotePlayerList();
      setRemotePlayerList(prev => {
        if (prev.length === 0 && list.length === 0) return prev;
        if (prev.length !== list.length) return list;
        for (let i = 0; i < list.length; i++) {
          const a = prev[i], b = list[i];
          if (a.id !== b.id || a.kills !== b.kills || a.deaths !== b.deaths ||
              a.score !== b.score || a.ping !== b.ping || a.dead !== b.dead) {
            return list;
          }
        }
        return prev;
      });
    }, 100);

    // TAB key for scoreboard
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setShowScoreboard(true);
      }
      if (e.code === 'KeyZ' && isLocked && !dead) {
        e.preventDefault();
        setShowQuickChat(true);
      }
      if (e.code === 'KeyX' && dead && mpLobby) {
        e.preventDefault();
        gameRef.current?.cycleSpectator();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setShowScoreboard(false);
      }
      if (e.code === 'KeyZ') {
        setShowQuickChat(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Fullscreen change listener
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      clearInterval(flashInterval);
      document.removeEventListener('pointerlockchange', handleLockChange);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('mobile-lock', handleMobileLock);
      window.removeEventListener('mobile-unlock', handleMobileUnlock);
      mpClientRef.current?.destroy();
      mpClientRef.current = null;
      gameRef.current?.destroy();
      gameRef.current = null;
    };
  }, [onKill, selectedMap]);

  // Sync settings to game instance without recreating
  useEffect(() => {
    gameRef.current?.updateSettings(settingsRef.current);
  }, [settings]);

  // Sync autoFire to game instance
  useEffect(() => {
    gameRef.current?.setAutoFire(autoFire);
  }, [autoFire]);

  // Sync gyro/tilt listeners
  useEffect(() => {
    if (!gameRef.current) return;
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (!gameRef.current) return;
      if (settings.tiltLook) {
        const gamma = e.gamma || 0;
        const beta = e.beta || 0;
        const dGamma = gamma - tiltCalibration.current.gamma;
        const dBeta = beta - tiltCalibration.current.beta;
        const sens = settings.tiltSensitivity * 0.003;
        gameRef.current.setTouchLook(dGamma * sens * 20, -dBeta * sens * 20);
      } else if (settings.gyroAim) {
        const yaw = (e.gamma || 0) / 90;
        const pitch = (e.beta || 0) / 180;
        gameRef.current.setGyroLook(yaw * 0.02, pitch * 0.02);
      }
    };
    if (settings.gyroAim || settings.tiltLook) {
      window.addEventListener('deviceorientation', handleOrientation);
      return () => window.removeEventListener('deviceorientation', handleOrientation);
    }
  }, [settings.gyroAim, settings.tiltLook]);

  // Screen wake lock — prevent screen from sleeping during gameplay
  useEffect(() => {
    if (isLocked && !dead && 'wakeLock' in navigator) {
      (navigator as any).wakeLock?.request('screen').then((wl: any) => { wakeLockRef.current = wl; }).catch(() => {});
    }
    return () => {
      if (wakeLockRef.current) { wakeLockRef.current.release?.(); wakeLockRef.current = null; }
    };
  }, [isLocked, dead]);

  const enterBattlefield = () => {
    setShowBriefing(false);
    setShowMapSelect(false);
    setShowLoading(true);
  };

  // Loading screen transition — COD style deploying screen
  useEffect(() => {
    if (!showLoading) return;
    const LOADING_TIPS = [
      'Headshots deal 2.5x damage — aim for the head',
      'Use cover to break line of sight and recover health',
      'Reload during safe zones to stay combat-ready',
      'Sprint with SHIFT to reposition quickly',
      'Lean around corners with Q/E to shoot from cover',
      'Grenades clear grouped enemies — cook before throwing',
      'Crouch reduces your profile and improves accuracy',
      'Watch the radar for enemy positions when UAV is active',
    ];
    let tipIdx = 0;
    let progress = 0;
    const tipInterval = setInterval(() => {
      tipIdx = (tipIdx + 1) % LOADING_TIPS.length;
      setLoadingTip(LOADING_TIPS[tipIdx]);
    }, 1500);
    const progressInterval = setInterval(() => {
      progress += Math.random() * 25 + 15;
      if (progress >= 100) {
        progress = 100;
        clearInterval(progressInterval);
        clearInterval(tipInterval);
        setTimeout(() => {
          setShowLoading(false);
          gameRef.current?.start();
          if (isMobile) {
            window.dispatchEvent(new Event('mobile-lock'));
          } else {
            containerRef.current?.requestPointerLock?.();
          }
        }, 300);
      }
      setLoadingProgress(Math.min(100, progress));
    }, 150);
    return () => { clearInterval(tipInterval); clearInterval(progressInterval); };
  }, [showLoading]);

  const lockPointer = () => {
    if (isMobile) {
      window.dispatchEvent(new Event('mobile-lock'));
    } else {
      containerRef.current?.requestPointerLock?.();
    }
  };

  const unlockPointer = () => {
    if (isMobile) {
      window.dispatchEvent(new Event('mobile-unlock'));
    } else {
      document.exitPointerLock?.();
    }
  };

  const healthPct = (stats.hp / stats.maxHp) * 100;
  const ammoPct = (stats.ammo / stats.magSize) * 100;

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
      if (el.requestFullscreen) el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      const doc = document as Document & { webkitExitFullscreen?: () => void };
      if (doc.exitFullscreen) doc.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
    }
  };

  return (
    <div className="relative w-full bg-black overflow-hidden font-mono select-none" style={{ height: '100dvh' }}>
      {/* Multiplayer Lobby */}
      {mpLobby && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-50 overflow-y-auto py-4">
          <div className="w-full max-w-md p-4 sm:p-6">
            <div className="text-center mb-6">
              <div className="text-[10px] text-stone-500 font-black tracking-[0.4em] mb-1">MULTIPLAYER</div>
              <div className="text-3xl font-black text-orange-500 tracking-[0.15em] drop-shadow-[0_0_15px_rgba(249,115,22,0.6)]">3D COMBAT</div>
            </div>

            {/* Mode selection */}
            <div className="mb-4">
              <div className="text-[8px] text-stone-500 font-black tracking-widest mb-2">GAME MODE</div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { mode: 'tdm', label: 'TDM', desc: 'Team Deathmatch' },
                  { mode: 'ffa', label: 'FFA', desc: 'Free-for-All' },
                  { mode: '1v1', label: '1V1', desc: 'Duel' },
                ] as { mode: GameMode; label: string; desc: string }[]).map(m => (
                  <button
                    key={m.mode}
                    onClick={() => setMpMode(m.mode)}
                    className={`p-2 rounded border text-center transition-all ${mpMode === m.mode ? 'bg-orange-600/30 border-orange-500 text-white' : 'bg-stone-900/60 border-stone-700 text-stone-400 hover:border-stone-500'}`}
                  >
                    <div className="text-xs font-black">{m.label}</div>
                    <div className="text-[7px] tracking-wider">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Score limit */}
            <div className="mb-4">
              <div className="text-[8px] text-stone-500 font-black tracking-widest mb-2">SCORE LIMIT: {mpScoreLimit}</div>
              <input
                type="range"
                min={1000}
                max={10000}
                step={500}
                value={mpScoreLimit}
                onChange={e => setMpScoreLimit(Number(e.target.value))}
                className="w-full accent-orange-500"
              />
            </div>

            {/* Create room */}
            <button
              onClick={() => {
                const client = new MultiplayerClient();
                mpClientRef.current = client;
                const code = client.createRoom(mpPlayerName, mpMode, mpScoreLimit);
                setMpRoomCode(code);
                setMpStatus('BROADCASTING');
                client.on('host_ready', () => setMpStatus('WAITING FOR PLAYERS'));
                client.on('player_joined', () => setMpStatus('PLAYER JOINED'));
                client.on('reconnecting', (msg: any) => setMpStatus(`RECONNECTING ${msg.attempt}/${msg.maxAttempts}...`));
                client.on('reconnect_failed', () => setMpStatus('RECONNECT FAILED'));
                client.on('error', (msg: any) => setMpStatus(`ERROR: ${msg.error?.message || 'unknown'}`));
              }}
              className="w-full py-3 mb-3 bg-orange-600 hover:bg-orange-500 text-white text-sm font-black uppercase tracking-widest rounded transition-colors"
            >
              CREATE ROOM
            </button>

            {/* Room code display */}
            {mpRoomCode && (
              <div className="text-center mb-3">
                <div className="text-[8px] text-stone-500 font-black tracking-widest mb-1">ROOM CODE</div>
                <div className="text-2xl font-black text-orange-400 tracking-[0.3em]">{mpRoomCode}</div>
                <div className="text-[8px] text-stone-600 mt-1">Share this code with your opponent</div>
                <div className="text-[8px] text-cyan-400 mt-1">{mpStatus}</div>
              </div>
            )}

            {/* Join room */}
            <div className="border-t border-stone-700 pt-4">
              <div className="text-[8px] text-stone-500 font-black tracking-widest mb-2">JOIN ROOM</div>
              <div className="flex gap-2">
                <input
                  type="text"
                  maxLength={4}
                  placeholder="CODE"
                  value={mpRoomCode}
                  onChange={e => setMpRoomCode(e.target.value.toUpperCase())}
                  className="flex-1 px-3 py-2 bg-stone-900 border border-stone-700 rounded text-white text-center text-lg font-black tracking-[0.3em] uppercase focus:border-orange-500 outline-none"
                />
                <button
                  onClick={() => {
                    if (mpRoomCode.length !== 4) return;
                    const client = new MultiplayerClient();
                    mpClientRef.current = client;
                    client.joinRoom(mpRoomCode, mpPlayerName);
                    setMpStatus('CONNECTING...');
                    client.on('connected', () => setMpStatus('CONNECTED'));
                    client.on('config', (msg: any) => {
                      setMpMode(msg.config.mode);
                      setMpScoreLimit(msg.config.scoreLimit);
                    });
                    client.on('reconnecting', (msg: any) => setMpStatus(`RECONNECTING ${msg.attempt}/${msg.maxAttempts}...`));
                    client.on('reconnect_failed', () => setMpStatus('RECONNECT FAILED'));
                    client.on('error', (msg: any) => setMpStatus(`ERROR: ${msg.error?.message || 'unknown'}`));
                  }}
                  className="px-4 py-2 bg-stone-800 hover:bg-cyan-600 text-white text-xs font-black uppercase tracking-widest rounded border border-cyan-500/50 transition-colors"
                >
                  JOIN
                </button>
              </div>
            </div>

            {/* Start game / Back */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  if (mpClientRef.current && mpRoomCode) {
                    gameRef.current?.initMultiplayer(mpClientRef.current, mpMode, mpScoreLimit);
                    setMpLobby(false);
                    setShowLoadout(false);
                    setShowBriefing(false);
                    gameRef.current?.start();
                    lockPointer();
                  }
                }}
                disabled={!mpClientRef.current}
                className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:bg-stone-800 disabled:text-stone-600 text-white text-xs font-black uppercase tracking-widest rounded transition-colors"
              >
                DEPLOY
              </button>
              <button
                onClick={() => { setMpLobby(false); setShowLoadout(true); }}
                disabled={!mpClientRef.current}
                className="px-4 py-2 bg-stone-800 hover:bg-orange-600/80 disabled:bg-stone-900 disabled:text-stone-600 text-white text-xs font-black uppercase tracking-widest rounded border border-orange-500/40 transition-colors"
              >
                LOADOUT
              </button>
              <button
                onClick={() => {
                  mpClientRef.current?.destroy();
                  mpClientRef.current = null;
                  setMpLobby(false);
                  setMpRoomCode('');
                  setMpStatus('');
                  setShowModeSelect(true);
                }}
                className="px-4 py-2 bg-stone-900 hover:bg-red-600/80 text-white text-xs font-black uppercase tracking-widest rounded border border-red-500/50 transition-colors"
              >
                BACK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COD-style Mode Select — BO6 lobby layout */}
      {showModeSelect && (
        <div className="absolute inset-0 flex flex-col bg-black z-50 pointer-events-auto font-mono overflow-hidden" style={{ animation: 'fadeInScale 0.4s ease-out' }}>
          <style>{`
            @keyframes modeCardIn { 0% { opacity: 0; transform: translateY(30px) scale(0.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes modeGlow { 0%, 100% { box-shadow: 0 0 12px rgba(249,115,22,0.2); } 50% { box-shadow: 0 0 24px rgba(249,115,22,0.4); } }
            @keyframes modePulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
            @keyframes lobbySlideIn { 0% { opacity: 0; transform: translateX(-20px); } 100% { opacity: 1; transform: translateX(0); } }
            @keyframes lobbySlideRight { 0% { opacity: 0; transform: translateX(20px); } 100% { opacity: 1; transform: translateX(0); } }
            @keyframes lobbySlideUp { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
          `}</style>
          {/* Background grid */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(249,115,22,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.5) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }} />
          <div className="absolute inset-0 opacity-10" style={{ background: 'radial-gradient(circle at 50% 30%, rgba(249,115,22,0.15), transparent 60%)' }} />

          {/* ─── TOP-LEFT: Player Profile Card (BO6 style) ─── */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20" style={{ animation: 'lobbySlideIn 0.5s ease-out' }}>
            <div className="flex items-center gap-2 sm:gap-3 bg-stone-950/80 backdrop-blur-md rounded-xl p-2 sm:p-3 border border-stone-700/40 shadow-xl shadow-black/50">
              {/* Rank insignia */}
              <div className="relative w-10 h-10 sm:w-14 sm:h-14 rounded-lg flex items-center justify-center shrink-0" style={{ background: `linear-gradient(135deg, ${CHAR_COLORS[loadout.character]}33, rgba(0,0,0,0.6))`, border: `2px solid ${CHAR_COLORS[loadout.character]}66` }}>
                <svg width="24" height="24" viewBox="0 0 64 64" className="sm:w-8 sm:h-8">{CHAR_ICONS[loadout.character]}</svg>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-600 border-2 border-stone-900 flex items-center justify-center">
                  <span className="text-[8px] sm:text-[9px] font-black text-white leading-none">{progression.level}</span>
                </div>
              </div>
              <div className="w-28 sm:w-40">
                <div className="text-[8px] sm:text-[10px] text-stone-500 font-black tracking-widest uppercase">Operator</div>
                <div className="text-xs sm:text-sm font-black text-white tracking-wide truncate">{loadout.character.toUpperCase()}</div>
                {/* XP bar */}
                <div className="mt-1 sm:mt-1.5 w-full h-1 sm:h-1.5 bg-stone-800 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all" style={{ width: `${Math.min(100, ((progression.xp % (progression.level * 500)) / (progression.level * 500)) * 100)}%` }} />
                </div>
                <div className="flex justify-between text-[6px] sm:text-[7px] text-stone-600 font-bold mt-0.5">
                  <span>LVL {progression.level}</span>
                  <span className="hidden sm:inline">{progression.xp % (progression.level * 500)} / {progression.level * 500} XP</span>
                  <span className="sm:hidden">{progression.xp % (progression.level * 500)}/{progression.level * 500}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── TOP-RIGHT: Quick Join + Settings (BO6 style) ─── */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex flex-col gap-1.5 sm:gap-2 items-end" style={{ animation: 'lobbySlideRight 0.5s ease-out' }}>
            <button
              onClick={() => { setShowModeSelect(false); setMpLobby(true); }}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-stone-950/80 hover:bg-blue-600/60 backdrop-blur-md text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg border border-blue-500/40 transition-all hover:scale-105 shadow-lg"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="sm:w-3.5 sm:h-3.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              <span className="hidden sm:inline">Quick Join</span>
              <span className="sm:hidden">MP</span>
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-950/60 hover:bg-stone-800 text-stone-400 text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-lg border border-stone-700/50 transition-all"
            >
              ⚙ <span className="hidden sm:inline">Settings</span>
            </button>
          </div>

          {/* ─── TOP-CENTER: Quick Play bar ─── */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2" style={{ animation: 'lobbySlideIn 0.5s ease-out' }}>
            <button
              onClick={() => { setShowModeSelect(false); if (missionName) { setShowBriefing(true); } else { enterBattlefield(); } }}
              className="px-4 sm:px-6 py-1.5 sm:py-2 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest rounded-lg border border-orange-400/40 transition-all hover:scale-105 shadow-lg shadow-orange-600/30"
            >
              ⚡ Quick Play
            </button>
            <button
              onClick={() => { setShowModeSelect(false); setShowMapSelect(true); }}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-stone-950/80 hover:bg-stone-800 text-stone-400 text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-lg border border-stone-700/50 transition-all"
            >
              🗺 <span className="hidden sm:inline">Map: {BATTLEFIELDS[selectedMap].name}</span><span className="sm:hidden">Map</span>
            </button>
          </div>

          {/* ─── CENTER: Mode cards ─── */}
          <div className="flex-1 flex items-center justify-center px-4 overflow-y-auto py-8">
            <div className="relative z-10 text-center max-w-2xl w-full">
              {/* Title */}
              <div className="mb-6" style={{ animation: 'modeCardIn 0.4s ease-out' }}>
                <div className="text-[10px] text-stone-500 font-black tracking-[0.5em] mb-2" style={{ animation: 'modePulse 2s ease-in-out infinite' }}>SELECT GAME MODE</div>
                <div className="text-3xl sm:text-5xl font-black text-orange-500 tracking-[0.2em]" style={{ textShadow: '0 0 30px rgba(249,115,22,0.5)' }}>LUCKY MILITIA</div>
                <div className="w-32 h-px bg-gradient-to-r from-orange-500/60 to-transparent mx-auto mt-3" />
              </div>

              {/* Mode cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-6">
                {/* Campaign */}
                <button
                  onClick={() => { setShowModeSelect(false); setShowLoadout(true); }}
                  className="group relative p-5 bg-gradient-to-b from-stone-900/80 to-black/60 rounded-xl border border-orange-900/30 hover:border-orange-500/60 transition-all hover:scale-105 text-left"
                  style={{ animation: 'modeCardIn 0.5s ease-out', animationDelay: '0.1s', animationFillMode: 'both' }}
                >
                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-orange-500" style={{ animation: 'modePulse 1.5s ease-in-out infinite' }} />
                  <div className="mb-3">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <div className="text-base font-black text-white tracking-wider uppercase mb-1">Campaign</div>
                  <div className="text-[9px] text-stone-500 font-bold tracking-widest uppercase mb-2">Solo Mission</div>
                  <div className="text-[10px] text-stone-400 leading-relaxed">Execute tactical missions across multiple theaters. Briefing included.</div>
                  <div className="mt-3 text-[8px] text-orange-400 font-black tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">▶ Deploy</div>
                </button>

                {/* Survival */}
                <button
                  onClick={() => { setShowModeSelect(false); setShowLoadout(true); }}
                  className="group relative p-5 bg-gradient-to-b from-stone-900/80 to-black/60 rounded-xl border border-red-900/30 hover:border-red-500/60 transition-all hover:scale-105 text-left"
                  style={{ animation: 'modeCardIn 0.5s ease-out', animationDelay: '0.2s', animationFillMode: 'both' }}
                >
                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-red-500" style={{ animation: 'modePulse 1.5s ease-in-out infinite' }} />
                  <div className="mb-3">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                  <div className="text-base font-black text-white tracking-wider uppercase mb-1">Survival</div>
                  <div className="text-[9px] text-stone-500 font-bold tracking-widest uppercase mb-2">Endless Waves</div>
                  <div className="text-[10px] text-stone-400 leading-relaxed">Hold the line against escalating enemy waves. No extraction.</div>
                  <div className="mt-3 text-[8px] text-red-400 font-black tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">▶ Deploy</div>
                </button>

                {/* Multiplayer */}
                <button
                  onClick={() => { setShowModeSelect(false); setMpLobby(true); }}
                  className="group relative p-5 bg-gradient-to-b from-stone-900/80 to-black/60 rounded-xl border border-blue-900/30 hover:border-blue-500/60 transition-all hover:scale-105 text-left"
                  style={{ animation: 'modeCardIn 0.5s ease-out', animationDelay: '0.3s', animationFillMode: 'both' }}
                >
                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-blue-500" style={{ animation: 'modePulse 1.5s ease-in-out infinite' }} />
                  <div className="mb-3">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                    </svg>
                  </div>
                  <div className="text-base font-black text-white tracking-wider uppercase mb-1">Multiplayer</div>
                  <div className="text-[9px] text-stone-500 font-bold tracking-widest uppercase mb-2">Online Combat</div>
                  <div className="text-[10px] text-stone-400 leading-relaxed">Battle other operators in TDM, FFA, or 1v1 duels.</div>
                  <div className="mt-3 text-[8px] text-blue-400 font-black tracking-widest uppercase opacity-0 group-hover:opacity-100 transition-opacity">▶ Deploy</div>
                </button>
              </div>

              {/* Player stats strip */}
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[7px] sm:text-[8px] text-stone-600 font-black tracking-widest uppercase" style={{ animation: 'modeCardIn 0.6s ease-out', animationDelay: '0.4s', animationFillMode: 'both' }}>
                <span>Kills <span className="text-orange-400">{progression.totalKills}</span></span>
                <span className="text-stone-700">|</span>
                <span>Matches <span className="text-orange-400">{progression.matchesPlayed}</span></span>
                <span className="text-stone-700">|</span>
                <span>Best Wave <span className="text-orange-400">{progression.bestWave}</span></span>
                <span className="text-stone-700">|</span>
                <span>Spoils <span className="text-yellow-400">{progression.battleSpoils}</span></span>
              </div>
            </div>
          </div>

          {/* ─── BOTTOM-LEFT: Challenges tracker (BO6 style expandable) ─── */}
          <div className="absolute bottom-4 left-4 z-20 max-w-xs" style={{ animation: 'lobbySlideUp 0.6s ease-out', animationDelay: '0.3s', animationFillMode: 'both' }}>
            <div className="bg-stone-950/80 backdrop-blur-md rounded-xl p-3 border border-stone-700/40 shadow-xl shadow-black/50">
              <div className="text-[8px] text-stone-500 font-black tracking-[0.3em] uppercase mb-2">▼ Daily Challenges</div>
              {progression.dailyChallenges.challenges.slice(0, 3).map((c, i) => (
                <div key={i} className="mb-1.5 last:mb-0">
                  <div className="flex justify-between text-[9px] text-stone-300 mb-0.5">
                    <span className={`truncate ${c.completed ? 'text-green-400 line-through' : ''}`}>{c.challenge.description}</span>
                    <span className="text-yellow-400 ml-2 shrink-0">+{c.challenge.reward}</span>
                  </div>
                  <div className="w-full h-1 bg-stone-800 rounded-full overflow-hidden">
                    <div className={`h-full ${c.completed ? 'bg-green-500' : 'bg-blue-500'} transition-all rounded-full`} style={{ width: `${Math.min(100, (c.progress / c.challenge.target) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ─── BOTTOM: XP bar + meta buttons ─── */}
          <div className="absolute bottom-0 left-0 right-0 z-20 px-3 sm:px-4 pb-3 sm:pb-4" style={{ animation: 'lobbySlideUp 0.6s ease-out', animationDelay: '0.4s', animationFillMode: 'both' }}>
            {/* XP Bar */}
            <div className="flex items-center gap-2 sm:gap-3 mb-2 max-w-2xl mx-auto">
              <div className="flex items-center gap-1.5">
                {progression.prestige.level > 0 && (
                  <span className="text-sm sm:text-base">{PRESTIGE_BADGES[Math.min(progression.prestige.level - 1, PRESTIGE_BADGES.length - 1)]}</span>
                )}
                <span className="text-[9px] sm:text-[10px] font-black text-orange-400 tracking-widest">LV{progression.level}</span>
              </div>
              <div className="flex-1 h-2.5 bg-stone-900 rounded-full overflow-hidden border border-stone-700/50">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all"
                  style={{ width: `${Math.min(100, (progression.xp / xpForLevel(progression.level)) * 100)}%` }}
                />
              </div>
              <span className="text-[8px] sm:text-[9px] text-stone-500 font-mono whitespace-nowrap">{progression.xp}/{xpForLevel(progression.level)} XP</span>
              <div className="flex items-center gap-1 text-yellow-400">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L15 9L22 9L17 14L19 21L12 17L5 21L7 14L2 9L9 9L12 2Z"/></svg>
                <span className="text-[9px] sm:text-[10px] font-black">{progression.battleSpoils.toLocaleString()}</span>
              </div>
            </div>
            {/* Meta buttons */}
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
              <button
                onClick={() => setShowDailyRewards(true)}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-950/80 hover:bg-orange-600/40 text-stone-400 hover:text-white text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-lg border border-stone-700/50 hover:border-orange-500/40 transition-all"
              >
                🎁 <span className="hidden sm:inline">Daily</span>
              </button>
              <button
                onClick={() => setShowWeekly(true)}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-950/80 hover:bg-blue-600/40 text-stone-400 hover:text-white text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-lg border border-stone-700/50 hover:border-blue-500/40 transition-all"
              >
                📋 <span className="hidden sm:inline">Weekly</span>
              </button>
              <button
                onClick={() => setShowLeaderboard(true)}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-950/80 hover:bg-yellow-600/40 text-stone-400 hover:text-white text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-lg border border-stone-700/50 hover:border-yellow-500/40 transition-all"
              >
                🏆 <span className="hidden sm:inline">Ranks</span>
              </button>
              <button
                onClick={() => setShowPrestige(true)}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-950/80 hover:bg-purple-600/40 text-stone-400 hover:text-white text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-lg border border-stone-700/50 hover:border-purple-500/40 transition-all"
              >
                {canPrestige(progression) ? '⭐ ' : '🎖️ '}<span className="hidden sm:inline">Prestige</span>
              </button>
              {onExit && (
                <button
                  onClick={() => onExit()}
                  className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-900/60 hover:bg-stone-800 text-stone-500 text-[8px] sm:text-[9px] font-black uppercase tracking-widest rounded-lg border border-stone-700/50 transition-all"
                >
                  ← <span className="hidden sm:inline">Exit</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Loadout screen — COD style arsenal/operator customization */}
      {showLoadout && (
        <LoadoutScreen
          progression={progression}
          loadout={loadout}
          onDeploy={(newLoadout) => { setLoadout(newLoadout); loadoutRef.current = newLoadout; setShowLoadout(false); if (mpClientRef.current) { setMpLobby(true); } else if (missionName) { setShowBriefing(true); } else { enterBattlefield(); } }}
          onProgressionChange={setProgression}
          onExit={() => { setShowLoadout(false); setShowModeSelect(true); }}
        />
      )}
      {showLoadout && (
        <button
          onClick={() => { setShowLoadout(false); setMpLobby(true); }}
          className="fixed bottom-6 right-6 z-50 px-6 py-3 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase tracking-widest rounded-lg shadow-lg shadow-orange-600/30 transition-colors"
        >
          ⚔ MULTIPLAYER
        </button>
      )}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Multiplayer in-game HUD — kill feed with slide-in animation */}
      {isLocked && mpKillFeed.length > 0 && (
        <div className="absolute top-4 right-4 z-30 space-y-1 pointer-events-none">
          <style>{`
            @keyframes kfSlideIn { 0% { opacity: 0; transform: translateX(20px); } 100% { opacity: 1; transform: translateX(0); } }
          `}</style>
          {mpKillFeed.map(kf => (
            <div key={kf.id} className="text-[10px] font-black tracking-wider bg-black/60 px-2 py-1 rounded" style={{ animation: 'kfSlideIn 0.3s ease-out' }}>
              <span className="text-orange-400">{kf.killer.slice(0, 8)}</span>
              <span className="text-stone-500"> {kf.headshot ? '☠' : '✖'} </span>
              <span className="text-cyan-400">{kf.victim.slice(0, 8)}</span>
              <span className="text-stone-600 ml-1">{kf.weapon.toUpperCase()}</span>
            </div>
          ))}
        </div>
      )}

      {/* Multiplayer in-game HUD — team scores */}
      {isLocked && mpClientRef.current && Object.keys(mpScores).length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="flex items-center gap-4 bg-black/60 px-4 py-1 rounded-lg">
            <span className="text-orange-400 font-black text-sm">ALPHA</span>
            <span className="text-white font-black text-lg">
              {Object.values(mpScores).filter((s: any) => s.team === 'alpha').reduce((sum: number, s: any) => sum + s.score, 0)}
            </span>
            <span className="text-stone-600 text-xs">VS</span>
            <span className="text-white font-black text-lg">
              {Object.values(mpScores).filter((s: any) => s.team === 'bravo').reduce((sum: number, s: any) => sum + s.score, 0)}
            </span>
            <span className="text-cyan-400 font-black text-sm">BRAVO</span>
          </div>
        </div>
      )}

      {/* Multiplayer game over screen */}
      {mpGameOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50">
          <div className="text-center max-w-lg px-6">
            <div className="text-[10px] text-stone-500 font-black tracking-[0.4em] mb-2">MATCH OVER</div>
            <div className={`text-3xl sm:text-5xl font-black tracking-[0.15em] mb-6 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)] ${mpGameOver.winner === 'alpha' ? 'text-orange-500' : 'text-cyan-400'}`}>
              {mpGameOver.winner.toUpperCase()} WINS
            </div>
            {Object.entries(mpGameOver.scores).map(([id, s]: [string, any]) => (
              <div key={id} className="flex justify-between text-sm text-stone-300 mb-1">
                <span className={s.team === 'alpha' ? 'text-orange-400' : 'text-cyan-400'}>{id.slice(0, 8)}</span>
                <span>K: {s.kills} D: {s.deaths} Score: {s.score}</span>
              </div>
            ))}
            <button
              onClick={() => {
                mpClientRef.current?.destroy();
                mpClientRef.current = null;
                setMpGameOver(null);
                setMpLobby(false);
                setShowStats(false);
                setShowModeSelect(true);
                setMpKillFeed([]);
                setMpScores({});
              }}
              className="mt-6 px-8 py-2 bg-stone-900/80 hover:bg-orange-600/80 text-white text-xs font-black uppercase tracking-widest rounded border border-orange-500/50"
            >
              ← Main Menu
            </button>
          </div>
        </div>
      )}

      {/* Spawn protection indicator */}
      {isLocked && spawnProtect > 0 && preMatchCountdown === 0 && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
          <div className="text-center">
            <div className="text-cyan-400 text-xs font-black tracking-widest animate-pulse">⬡ SPAWN PROTECTION {Math.ceil(spawnProtect)}s</div>
          </div>
        </div>
      )}

      {/* Scoreboard (TAB) */}
      {isLocked && showScoreboard && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-40 pointer-events-none">
          <div className="w-full max-w-2xl p-6">
            <div className="text-center mb-4">
              <div className="text-[10px] text-stone-500 font-black tracking-[0.4em]">SCOREBOARD</div>
              <div className="text-xl font-black text-white tracking-widest">[TAB] HOLD</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Alpha team */}
              <div>
                <div className="text-orange-500 font-black text-sm tracking-widest mb-2 border-b border-orange-600/50 pb-1">ALPHA</div>
                {remotePlayerList.filter(p => p.team === 'alpha').map(p => (
                  <div key={p.id} className="flex justify-between text-xs text-stone-300 py-1">
                    <span className={p.dead ? 'text-stone-600 line-through' : 'text-orange-300'}>
                      {p.name.slice(0, 12)} {p.dead && '☠'}
                    </span>
                    <span className="text-stone-400">{p.kills}/{p.deaths} | {p.score} | {p.ping}ms</span>
                  </div>
                ))}
              </div>
              {/* Bravo team */}
              <div>
                <div className="text-cyan-400 font-black text-sm tracking-widest mb-2 border-b border-cyan-600/50 pb-1">BRAVO</div>
                {remotePlayerList.filter(p => p.team === 'bravo').map(p => (
                  <div key={p.id} className="flex justify-between text-xs text-stone-300 py-1">
                    <span className={p.dead ? 'text-stone-600 line-through' : 'text-cyan-300'}>
                      {p.name.slice(0, 12)} {p.dead && '☠'}
                    </span>
                    <span className="text-stone-400">{p.kills}/{p.deaths} | {p.score} | {p.ping}ms</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile pause/fullscreen buttons — top-right corner */}
      {isMobile && isLocked && !dead && (
        <div className="absolute top-2 right-2 z-40 flex gap-1.5">
          <button
            onClick={() => { setPaused(true); gameRef.current?.stop(); unlockPointer(); }}
            className="w-9 h-9 rounded-lg bg-stone-900/70 backdrop-blur-sm border border-stone-700/50 flex items-center justify-center text-stone-400 hover:text-orange-400 transition-colors"
            title="Pause"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
          </button>
          <button
            onClick={toggleFullscreen}
            className="w-9 h-9 rounded-lg bg-stone-900/70 backdrop-blur-sm border border-stone-700/50 flex items-center justify-center text-stone-400 hover:text-orange-400 transition-colors"
            title="Fullscreen"
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8V5a2 2 0 0 1 2-2h3m6 0h3a2 2 0 0 1 2 2v3m0 6v3a2 2 0 0 1-2 2h-3m-6 0H5a2 2 0 0 1-2-2v-3"/>
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Sniper scope overlay — replaces crosshair when ADS with sniper */}
      {isLocked && stats?.isADS && stats?.weaponKey === 'sniper' && !dead && (
        <div className="absolute inset-0 pointer-events-none z-30">
          {/* Black vignette — 4 bars around scope circle instead of clipPath for performance */}
          <div className="absolute top-0 left-0 right-0 bg-black/90" style={{ height: 'calc(50% - 300px)', maxHeight: '50vh' }} />
          <div className="absolute bottom-0 left-0 right-0 bg-black/90" style={{ height: 'calc(50% - 300px)', maxHeight: '50vh' }} />
          <div className="absolute top-0 bottom-0 left-0 bg-black/90" style={{ width: 'calc(50% - 300px)', maxWidth: '50vw' }} />
          <div className="absolute top-0 bottom-0 right-0 bg-black/90" style={{ width: 'calc(50% - 300px)', maxWidth: '50vw' }} />
          {/* Scope circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black/90" style={{
            width: '600px', height: '600px', maxWidth: '90vh', maxHeight: '90vh',
            boxShadow: '0 0 0 4px rgba(80,80,80,0.4), inset 0 0 40px rgba(0,0,0,0.6)',
          }}>
            {/* Crosshair lines */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-black/60" />
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black/60" />
            {/* Center dot */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-red-500 rounded-full" style={{ boxShadow: '0 0 4px rgba(255,0,0,0.8)' }} />
            {/* Mil dots on horizontal line */}
            {[0.2, 0.35, 0.65, 0.8].map((p) => (
              <div key={p} className="absolute top-1/2 w-1 h-1 bg-black/50 rounded-full" style={{ left: `${p * 100}%`, transform: 'translate(-50%, -50%)' }} />
            ))}
            {/* Mil dots on vertical line */}
            {[0.2, 0.35, 0.65, 0.8].map((p) => (
              <div key={`v${p}`} className="absolute left-1/2 w-1 h-1 bg-black/50 rounded-full" style={{ top: `${p * 100}%`, transform: 'translate(-50%, -50%)' }} />
            ))}
          </div>
        </div>
      )}

      {/* Dynamic crosshair — expands with spread (hidden when sniper scope is active) */}
      {!(isLocked && stats?.isADS && stats?.weaponKey === 'sniper' && !dead) && (
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
        <div className="relative" style={{ width: '80px', height: '80px' }}>
          {stats.suppressed ? (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 border-2 border-red-500/50 rounded-full animate-pulse" />
          ) : (
            <>
              {/* Center dot */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-0.5 bg-white/90 rounded-full" style={{ boxShadow: '0 0 3px rgba(255,255,255,0.8)' }} />
              {/* Dynamic circle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 border border-white/20 rounded-full transition-all duration-100" style={{ width: `${18 + stats.crosshairSpread * 32}px`, height: `${18 + stats.crosshairSpread * 32}px` }} />
              {/* Hash marks — 4 directional lines with gap */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: `${28 + stats.crosshairSpread * 24}px`, height: '2px' }}>
                <div className="absolute left-0 top-0 bg-white/70 rounded-full" style={{ width: `${6 + stats.crosshairSpread * 5}px`, height: '100%', boxShadow: '0 0 2px rgba(255,255,255,0.4)' }} />
                <div className="absolute right-0 top-0 bg-white/70 rounded-full" style={{ width: `${6 + stats.crosshairSpread * 5}px`, height: '100%', boxShadow: '0 0 2px rgba(255,255,255,0.4)' }} />
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width: '2px', height: `${28 + stats.crosshairSpread * 24}px` }}>
                <div className="absolute top-0 left-0 bg-white/70 rounded-full" style={{ width: '100%', height: `${6 + stats.crosshairSpread * 5}px`, boxShadow: '0 0 2px rgba(255,255,255,0.4)' }} />
                <div className="absolute bottom-0 left-0 bg-white/70 rounded-full" style={{ width: '100%', height: `${6 + stats.crosshairSpread * 5}px`, boxShadow: '0 0 2px rgba(255,255,255,0.4)' }} />
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* Screen flash overlay — red on damage, blue when suppressed */}
      {isLocked && stats.hp > 0 && (
        <div
          className="absolute inset-0 pointer-events-none z-40 transition-opacity"
          style={{
            backgroundColor: `#${screenFlash?.color.toString(16).padStart(6, '0') || 'ff0000'}`,
            opacity: screenFlash ? screenFlash.intensity * 0.3 : 0,
          }}
        />
      )}

      {/* Low HP red vignette with heartbeat pulse */}
      {isLocked && stats.hp > 0 && stats.hp < 30 && (
        <div className="absolute inset-0 pointer-events-none z-30" style={{ animation: 'heartbeat 1.2s ease-in-out infinite', boxShadow: 'inset 0 0 120px 40px rgba(180,0,0,0.4)' }}>
          <style>{`
            @keyframes heartbeat { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
          `}</style>
        </div>
      )}

      {/* Killcam overlay — COD-style death replay */}
      {showKillcam && !dead && (
        <div className="absolute inset-0 z-40 pointer-events-none" style={{ animation: 'fadeInScale 0.3s ease-out' }}>
          <style>{`
            @keyframes killcamScan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
            @keyframes killcamFlicker { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
          `}</style>
          {/* Dark vignette */}
          <div className="absolute inset-0 bg-black/40" />
          {/* Scanline effect */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute left-0 right-0 h-24 opacity-20" style={{ background: 'linear-gradient(180deg, transparent, rgba(239,68,68,0.6), transparent)', animation: 'killcamScan 2s linear infinite' }} />
          </div>
          {/* Red tint */}
          <div className="absolute inset-0" style={{ boxShadow: 'inset 0 0 80px rgba(180,0,0,0.5)' }} />
          {/* KILLCAM label */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 text-center" style={{ animation: 'killcamFlicker 0.5s ease-in-out infinite' }}>
            <div className="text-[10px] text-red-400 font-black tracking-[0.5em] mb-2">▶ KILLCAM ◀</div>
            <div className="text-2xl sm:text-3xl font-black text-red-500 tracking-[0.3em]" style={{ textShadow: '0 0 20px rgba(239,68,68,0.8)' }}>YOU WERE KILLED</div>
            <div className="text-[10px] text-stone-400 font-mono tracking-widest mt-2 uppercase">Replaying last moments...</div>
          </div>
        </div>
      )}

      {/* Objective notification banner — COD-style slide-in */}
      {objectiveBanner && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <style>{`
            @keyframes objBannerIn { 0% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); } 20% { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateX(-50%) translateY(-10px); } }
          `}</style>
          <div className="bg-stone-950/80 backdrop-blur-md border-l-4 border-orange-500 rounded-r-lg px-6 py-3 shadow-xl shadow-black/60" style={{ animation: 'objBannerIn 3s ease-out forwards' }}>
            <div className="text-[8px] text-orange-500/70 font-black tracking-[0.3em] uppercase mb-0.5">▼ Objective Update</div>
            <div className="text-sm font-black text-white tracking-widest uppercase">{objectiveBanner}</div>
          </div>
        </div>
      )}

      {/* Weapon swap animation — quick slide effect */}
      {weaponSwapAnim && (
        <div className="absolute bottom-1/3 right-1/4 z-30 pointer-events-none">
          <style>{`
            @keyframes weaponSwapIn { 0% { opacity: 0; transform: translateX(40px) rotate(-5deg); } 50% { opacity: 1; transform: translateX(0) rotate(0deg); } 100% { opacity: 0; transform: translateX(-20px) rotate(3deg); } }
          `}</style>
          <div className="text-2xl font-black text-orange-400 tracking-widest" style={{ animation: 'weaponSwapIn 0.3s ease-out forwards', textShadow: '0 0 12px rgba(249,115,22,0.6)' }}>
            {stats.weaponName}
          </div>
        </div>
      )}

      {/* Scorestreak progress bar — COD-style */}
      {isLocked && !dead && stats.killstreak >= 0 && (
        <div className={`absolute z-20 pointer-events-none ${isMobile ? 'top-44 right-3' : 'bottom-24 right-5'}`}>
          <div className="bg-stone-950/60 backdrop-blur-sm rounded-lg px-2.5 py-1.5 border border-stone-700/40 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-[7px] text-stone-500 font-black tracking-widest uppercase">Streak</span>
              <span className="text-xs font-black text-orange-400">{stats.killstreak}</span>
              <div className="w-16 h-1 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (stats.killstreak / 10) * 100)}%`,
                    background: stats.killstreak >= 7 ? 'linear-gradient(90deg, #ff00ff, #ff4444)' : stats.killstreak >= 5 ? 'linear-gradient(90deg, #ff8800, #ffaa00)' : stats.killstreak >= 3 ? 'linear-gradient(90deg, #f97316, #fbbf24)' : 'linear-gradient(90deg, #525252, #78716c)',
                    boxShadow: stats.killstreak >= 5 ? '0 0 6px rgba(249,115,22,0.5)' : 'none',
                  }}
                />
              </div>
            </div>
            {stats.killstreak >= 3 && stats.killstreak < 10 && (
              <div className="text-[6px] text-stone-500 font-bold tracking-widest mt-0.5 text-right">
                Next: {stats.killstreak < 5 ? 'RAMPAGE' : stats.killstreak < 7 ? 'UNSTOPPABLE' : 'GODLIKE'}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Blood screen overlay — intensifies with recent damage */}
      {isLocked && !dead && screenFlash && screenFlash.intensity > 0.3 && (
        <div
          className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-500"
          style={{
            opacity: screenFlash.intensity * 0.6,
            background: 'radial-gradient(ellipse at center, transparent 20%, rgba(120,0,0,0.7) 100%)',
          }}
        />
      )}

      {/* Low ammo warning — flashing red border on ammo counter */}
      {isLocked && !dead && stats.lowAmmo && !reloading && (
        <div className={`absolute z-20 pointer-events-none ${isMobile ? 'top-52 right-3' : 'bottom-5 right-5'}`}>
          <style>{`@keyframes lowAmmoFlash { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }`}</style>
          <div className="text-[8px] text-red-500 font-black tracking-widest uppercase" style={{ animation: 'lowAmmoFlash 0.8s ease-in-out infinite' }}>
            ⚠ LOW AMMO{!isMobile ? ' — PRESS R' : ''}
          </div>
        </div>
      )}

      {/* Combo multiplier */}
      {isLocked && comboMult > 1 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="text-2xl font-black text-orange-400 tracking-widest drop-shadow-[0_0_10px_rgba(249,115,22,0.8)]">
            {comboMult}x COMBO
          </div>
          <div className="mt-1 w-32 h-1 bg-stone-800 rounded-full overflow-hidden mx-auto">
            <div className="h-full bg-orange-500 transition-all" style={{ width: `${(stats.comboTimer / 5) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Boss HP bar */}
      {isLocked && stats.isBossWave && stats.bossMaxHp > 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-72 sm:w-80 max-w-[90vw]">
          <div className="text-center text-xs font-black text-red-500 tracking-[0.3em] mb-1 drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]">
            ⚠ WARLORD {stats.bossHp < stats.bossMaxHp * 0.3 ? '— ENRAGED' : ''} ⚠
          </div>
          <div className="h-3 bg-stone-900/80 rounded-full overflow-hidden border border-red-900/50">
            <div
              className="h-full bg-gradient-to-r from-red-700 to-red-500 transition-all"
              style={{ width: `${(stats.bossHp / stats.bossMaxHp) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Boss wave announcement */}
      {bossWaveName && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
          <div className="text-center animate-pulse">
            <div className="text-[10px] text-red-500 font-black tracking-[0.5em] mb-2">⚠ BOSS WAVE ⚠</div>
            <div className="text-3xl sm:text-5xl font-black text-red-600 tracking-[0.2em] drop-shadow-[0_0_20px_rgba(255,0,0,0.8)]">{bossWaveName}</div>
          </div>
        </div>
      )}

      {/* Wave bonus notification */}
      {waveBonus && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="text-center">
            <div className="text-2xl font-black text-yellow-400 tracking-widest drop-shadow-[0_0_10px_rgba(250,204,21,0.8)]">{waveBonus.text}</div>
            <div className="text-lg font-black text-yellow-300">+{waveBonus.score}</div>
          </div>
        </div>
      )}

      {/* Score popups */}
      {scorePopups.map((popup) => (
        <div
          key={popup.id}
          className="absolute pointer-events-none z-30 text-orange-400 text-lg font-black tracking-wider animate-bounce"
          style={{ left: `${popup.x}%`, top: `${popup.y}%`, transform: 'translate(-50%, -50%)' }}
        >
          {popup.text}
        </div>
      ))}

      {/* Killstreak indicator — small counter */}
      {killstreak > 0 && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="text-2xl font-black text-orange-500 tracking-[0.2em] drop-shadow-[0_0_10px_rgba(249,115,22,0.8)] animate-pulse">
            {killstreak}x KILLSTREAK
          </div>
        </div>
      )}

      {/* Killstreak banner — animated slide-in with tier colors */}
      {killstreakBanner && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <style>{`
            @keyframes ksSlideIn { 0% { opacity: 0; transform: translateX(-60px) scale(0.8); } 20% { opacity: 1; transform: translateX(0) scale(1.1); } 30% { transform: translateX(0) scale(1); } 80% { opacity: 1; transform: translateX(0) scale(1); } 100% { opacity: 0; transform: translateX(60px) scale(0.9); } }
            @keyframes ksGlow { 0%, 100% { filter: drop-shadow(0 0 10px currentColor); } 50% { filter: drop-shadow(0 0 25px currentColor); } }
            @keyframes ksShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
          `}</style>
          <div
            className="text-center"
            style={{ animation: 'ksSlideIn 2.5s ease-out forwards' }}
          >
            <div className="text-[10px] font-black tracking-[0.5em] mb-1" style={{ color: killstreakBanner === 'GODLIKE' ? '#ff00ff' : killstreakBanner === 'UNSTOPPABLE' ? '#ff4444' : killstreakBanner === 'RAMPAGE' ? '#ff8800' : '#fbbf24' }}>
              ★ KILLSTREAK ★
            </div>
            <div
              className="text-5xl font-black tracking-[0.2em]"
              style={{
                color: killstreakBanner === 'GODLIKE' ? '#ff00ff' : killstreakBanner === 'UNSTOPPABLE' ? '#ff4444' : killstreakBanner === 'RAMPAGE' ? '#ff8800' : '#fbbf24',
                animation: 'ksGlow 1s ease-in-out infinite',
              }}
            >
              {killstreakBanner}
            </div>
            <div className="mt-2 mx-auto h-0.5 w-32 rounded-full" style={{
              background: `linear-gradient(90deg, transparent, ${killstreakBanner === 'GODLIKE' ? '#ff00ff' : killstreakBanner === 'UNSTOPPABLE' ? '#ff4444' : killstreakBanner === 'RAMPAGE' ? '#ff8800' : '#fbbf24'}, transparent)`,
              animation: 'ksShimmer 1.5s linear infinite',
              backgroundSize: '200% 100%',
            }} />
          </div>
        </div>
      )}

      {/* Wave announcement */}
      {waveAnnounce !== null && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <div className="text-center">
            <div className="text-3xl sm:text-5xl font-black text-white tracking-[0.3em] drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">
              WAVE {waveAnnounce}
            </div>
            {waveAnnounce % 5 === 0 && (
              <div className="text-lg font-black text-red-500 tracking-[0.2em] mt-2 animate-pulse">
                ⚠ ELITE WAVE ⚠
              </div>
            )}
            {objective && (
              <div className="text-sm font-bold text-orange-400 tracking-widest mt-3 uppercase">
                {objective.text}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hit markers — X on crosshair with scale pulse */}
      {hitMarkers.map((m) => (
        <div
          key={m.id}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
          style={{ animation: 'hitMarkerPulse 0.4s ease-out forwards' }}
        >
          <style>{`
            @keyframes hitMarkerPulse {
              0% { opacity: 0; transform: translate(-50%, -50%) scale(1.5); }
              30% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
              100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
            }
          `}</style>
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" style={{ filter: m.isKill ? 'drop-shadow(0 0 6px rgba(239,68,68,0.8))' : m.isHeadshot ? 'drop-shadow(0 0 6px rgba(251,191,36,0.8))' : 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' }}>
            <line x1="8" y1="8" x2="16" y2="16" stroke={m.isKill ? '#ef4444' : m.isHeadshot ? '#fbbf24' : '#ffffff'} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="32" y1="8" x2="24" y2="16" stroke={m.isKill ? '#ef4444' : m.isHeadshot ? '#fbbf24' : '#ffffff'} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="8" y1="32" x2="16" y2="24" stroke={m.isKill ? '#ef4444' : m.isHeadshot ? '#fbbf24' : '#ffffff'} strokeWidth="2.5" strokeLinecap="round" />
            <line x1="32" y1="32" x2="24" y2="24" stroke={m.isKill ? '#ef4444' : m.isHeadshot ? '#fbbf24' : '#ffffff'} strokeWidth="2.5" strokeLinecap="round" />
            {m.isKill && <circle cx="20" cy="20" r="6" stroke="#ef4444" strokeWidth="2" fill="none" />}
          </svg>
        </div>
      ))}

      {/* Damage numbers */}
      {damageNumbers.map((d) => (
        <div
          key={d.id}
          className="absolute pointer-events-none z-30 font-black text-sm"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            transform: 'translate(-50%, -50%)',
            color: d.isKill ? '#ef4444' : d.isHeadshot ? '#fbbf24' : '#ffffff',
            textShadow: '0 0 4px rgba(0,0,0,0.8)',
            animation: 'floatUp 1s ease-out forwards',
          }}
        >
          {d.isHeadshot && !d.isKill ? 'HS ' : ''}{d.value}{d.isKill ? ' ✖' : ''}
        </div>
      ))}

      {/* Safe zone countdown overlay */}
      {safeZoneTimer > 0 && isLocked && !dead && !showSafeZoneLoadout && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
          <style>{`
            @keyframes safeZonePulse { 0%, 100% { opacity: 0.6; transform: scale(1); } 50% { opacity: 1; transform: scale(1.05); } }
          `}</style>
          <div className="text-center" style={{ animation: 'safeZonePulse 1s ease-in-out infinite' }}>
            <div className="text-[10px] font-black tracking-[0.5em] text-cyan-400 mb-2 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
              🛡 SAFE ZONE 🛡
            </div>
            <div className="text-4xl sm:text-6xl font-black text-cyan-300 tracking-wider drop-shadow-[0_0_15px_rgba(34,211,238,0.9)]">
              {safeZoneTimer}
            </div>
            <div className="text-[9px] font-bold tracking-[0.3em] text-cyan-500/70 mt-2 mb-4">
              ENEMIES PASSIVE • YOU ARE INVULNERABLE
            </div>
            <button
              onClick={() => { setShowSafeZoneLoadout(true); unlockPointer(); }}
              className="pointer-events-auto px-6 py-2 bg-cyan-900/60 hover:bg-cyan-800/80 text-cyan-300 text-[10px] font-black uppercase tracking-widest rounded-lg border border-cyan-700/50 transition-all hover:scale-105"
            >
              ⚙ Change Loadout
            </button>
          </div>
        </div>
      )}

      {/* Safe zone loadout change overlay */}
      {showSafeZoneLoadout && safeZoneTimer > 0 && !dead && (
        <div className="absolute inset-0 z-50 pointer-events-auto">
          <LoadoutScreen
            progression={progression}
            loadout={loadout}
            onDeploy={(newLoadout) => { setLoadout(newLoadout); setShowSafeZoneLoadout(false); lockPointer(); }}
            onProgressionChange={setProgression}
          />
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-cyan-900/80 rounded-lg border border-cyan-700/50 px-4 py-2 pointer-events-none">
            <span className="text-cyan-300 text-xs font-black tracking-widest">🛡 SAFE ZONE: {safeZoneTimer}s</span>
          </div>
        </div>
      )}

      {/* Safe zone ended notification */}
      {combatEngaged && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-40 pointer-events-none" style={{ animation: 'fadeOut 2s ease-out forwards' }}>
          <div className="text-center">
            <div className="text-3xl font-black text-red-500 tracking-[0.3em] drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">
              ⚠ COMBAT ENGAGED ⚠
            </div>
          </div>
        </div>
      )}

      {/* Killstreak reward banner */}
      {killstreakReward && (
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
          <div className="text-center" style={{ animation: 'fadeOut 3s ease-out forwards' }}>
            <div className="text-3xl font-black text-orange-500 tracking-[0.3em] drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]">
              {KILLSTREAK_REWARDS[killstreakReward].name}
            </div>
            <div className="text-xs text-stone-300 mt-1 tracking-widest">
              {KILLSTREAK_REWARDS[killstreakReward].description}
            </div>
          </div>
        </div>
      )}

      {/* Wave objective tracker — improved with glow */}
      {objective && !objective.completed && !objective.failed && isLocked && !dead && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="bg-black/60 backdrop-blur-sm border border-orange-500/30 rounded-lg px-4 py-2 text-center shadow-lg shadow-black/40">
            <div className="text-xs font-black text-orange-400 tracking-widest uppercase" style={{ textShadow: '0 0 8px rgba(249,115,22,0.4)' }}>
              {objective.type === 'extract' || objective.type === 'defend' ? `⏱ ${Math.ceil(objective.timer)}s` : objective.text}
            </div>
            {objective.type === 'defend' && (
              <div className="w-36 h-1.5 bg-stone-800 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-200" style={{ width: `${(objective.progress / objective.maxProgress) * 100}%`, boxShadow: '0 0 6px rgba(249,115,22,0.5)' }} />
              </div>
            )}
            {objective.type === 'extract' && (
              <div className="text-[10px] text-stone-400 mt-0.5 animate-pulse">Reach the marked zone</div>
            )}
            {objective.type === 'survive' && (
              <div className="w-36 h-1 bg-stone-800 rounded-full mt-1.5 overflow-hidden">
                <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: `${Math.min(100, (1 - objective.progress / objective.maxProgress) * 100)}%` }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suppression overlay */}
      {stats.suppressed && !dead && (
        <div className="absolute inset-0 pointer-events-none z-10" style={{ boxShadow: 'inset 0 0 60px rgba(200, 100, 0, 0.3)' }} />
      )}

      {/* Lean indicator */}
      {stats.isLeaning && (
        <div className="absolute top-1/2 left-5 -translate-y-1/2 z-20 pointer-events-none">
          <div className="text-[9px] text-cyan-400 font-black tracking-widest">
            LEAN {stats.isLeaning.toUpperCase()}
          </div>
        </div>
      )}

      {/* Damage direction indicator with pulse */}
      {damageDir !== null && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
          <div
            className="absolute"
            style={{
              transform: `rotate(${damageDir}rad)`,
              transformOrigin: 'center',
              animation: 'hitDirPulse 0.6s ease-out forwards',
              ['--dir' as string]: `${damageDir}rad`,
            }}
          >
            <div className="w-0 h-0 border-l-[30px] border-r-[30px] border-b-[40px] border-l-transparent border-r-transparent border-b-red-500/60" style={{ marginLeft: '-30px', marginTop: '-120px' }} />
          </div>
        </div>
      )
      }

      {/* Low-health vignette with heartbeat pulse */}
      {!dead && healthPct < 30 && (
        <div
          className="absolute inset-0 pointer-events-none z-10 transition-opacity duration-300"
          style={{
            animation: 'hbVignette 1.2s ease-in-out infinite',
            boxShadow: `inset 0 0 ${100 + (30 - healthPct) * 4}px rgba(180, 0, 0, ${0.3 + (30 - healthPct) * 0.02})`,
          }}
        >
          <style>{`
            @keyframes hbVignette { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }
          `}</style>
        </div>
      )}

      {/* After Action Report — COD-style post-match stats */}
      {dead && showStats && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-40 pointer-events-auto overflow-y-auto py-8" style={{ animation: 'fadeInScale 0.4s ease-out' }}>
          <style>{`
            @keyframes xpFill { from { width: 0%; } }
            @keyframes aarSlideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>
          <div className="text-center max-w-lg w-full px-3 sm:px-4" style={{ animation: 'aarSlideIn 0.5s ease-out' }}>
            {/* AAR Header */}
            <div className="mb-6">
              <div className="text-[10px] text-stone-500 font-black tracking-[0.5em] mb-1">AFTER ACTION REPORT</div>
              <div className={`font-black uppercase tracking-[0.3em] text-red-500 ${isMobile ? 'text-4xl' : 'text-6xl'}`} style={{ textShadow: '0 0 25px rgba(239,68,68,0.6), 0 0 50px rgba(239,68,68,0.3)' }}>KIA</div>
              <div className="text-sm text-stone-500 font-mono tracking-[0.2em] mt-1 uppercase">Eliminated in action — Wave {stats.wave}</div>
            </div>

            {/* Primary stats — 3 large cards */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-stone-900/80 backdrop-blur-sm rounded-xl p-3 border border-stone-700/50 shadow-lg">
                <div className="text-[8px] text-stone-500 font-black tracking-widest uppercase mb-1">Kills</div>
                <div className="text-3xl font-black text-orange-500" style={{ textShadow: '0 0 10px rgba(249,115,22,0.3)' }}>{stats.kills}</div>
              </div>
              <div className="bg-stone-900/80 backdrop-blur-sm rounded-xl p-3 border border-stone-700/50 shadow-lg">
                <div className="text-[8px] text-stone-500 font-black tracking-widest uppercase mb-1">Score</div>
                <div className="text-3xl font-black text-orange-500" style={{ textShadow: '0 0 10px rgba(249,115,22,0.3)' }}>{stats.score}</div>
              </div>
              <div className="bg-stone-900/80 backdrop-blur-sm rounded-xl p-3 border border-stone-700/50 shadow-lg">
                <div className="text-[8px] text-stone-500 font-black tracking-widest uppercase mb-1">Wave</div>
                <div className="text-3xl font-black text-white">{stats.wave}</div>
              </div>
            </div>

            {/* Combat stats — 2x3 grid */}
            <div className="grid grid-cols-2 gap-2 mb-4 text-left">
              <div className="bg-stone-900/60 backdrop-blur-sm rounded-lg p-2.5 border border-stone-800/60">
                <div className="text-[8px] text-stone-500 font-black tracking-widest uppercase">Accuracy</div>
                <div className="text-lg font-black text-white">{stats.shotsFired > 0 ? Math.round((stats.shotsHit / stats.shotsFired) * 100) : 0}%</div>
                <div className="text-[8px] text-stone-600">{stats.shotsHit}/{stats.shotsFired} hits</div>
              </div>
              <div className="bg-stone-900/60 backdrop-blur-sm rounded-lg p-2.5 border border-stone-800/60">
                <div className="text-[8px] text-stone-500 font-black tracking-widest uppercase">Headshot %</div>
                <div className="text-lg font-black text-white">{stats.kills > 0 ? Math.round((stats.headshots / stats.kills) * 100) : 0}%</div>
                <div className="text-[8px] text-stone-600">{stats.headshots} headshots</div>
              </div>
              <div className="bg-stone-900/60 backdrop-blur-sm rounded-lg p-2.5 border border-stone-800/60">
                <div className="text-[8px] text-stone-500 font-black tracking-widest uppercase">Dmg Dealt</div>
                <div className="text-lg font-black text-green-500">{stats.damageDealt}</div>
              </div>
              <div className="bg-stone-900/60 backdrop-blur-sm rounded-lg p-2.5 border border-stone-800/60">
                <div className="text-[8px] text-stone-500 font-black tracking-widest uppercase">Dmg Taken</div>
                <div className="text-lg font-black text-red-500">{stats.damageTaken}</div>
              </div>
              <div className="bg-stone-900/60 backdrop-blur-sm rounded-lg p-2.5 border border-stone-800/60">
                <div className="text-[8px] text-stone-500 font-black tracking-widest uppercase">Best Streak</div>
                <div className="text-lg font-black text-yellow-500">{stats.killstreak}</div>
              </div>
              <div className="bg-stone-900/60 backdrop-blur-sm rounded-lg p-2.5 border border-stone-800/60">
                <div className="text-[8px] text-stone-500 font-black tracking-widest uppercase">Weapon</div>
                <div className="text-sm font-black text-white truncate">{stats.weaponName}</div>
              </div>
            </div>

            {/* XP Bar — COD style animated fill */}
            {(() => {
              const xpGained = stats.kills * 50 + stats.score * 2 + stats.wave * 100;
              const spoilsGained = Math.round(stats.score * 1.5 + stats.kills * 20);
              const currentLevelXp = progression.xp;
              const xpForNext = progression.level * 500;
              const xpIntoLevel = currentLevelXp % xpForNext;
              const xpPct = Math.min(100, (xpIntoLevel / xpForNext) * 100);
              return (
                <div className="bg-stone-900/80 backdrop-blur-sm rounded-xl p-3 border border-orange-900/40 mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="text-[8px] text-stone-500 font-black tracking-widest uppercase">Level {progression.level}</div>
                    <div className="text-[8px] text-orange-400 font-black tracking-widest">+{xpGained} XP</div>
                  </div>
                  <div className="w-full h-3 bg-stone-800 rounded-full overflow-hidden border border-stone-700/50 mb-1">
                    <div
                      className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-1000"
                      style={{ width: `${xpPct}%`, animation: 'xpFill 1.2s ease-out', boxShadow: '0 0 8px rgba(249,115,22,0.5)' }}
                    />
                  </div>
                  <div className="flex justify-between text-[8px] text-stone-600 font-bold">
                    <span>{xpIntoLevel} XP</span>
                    <span>{xpForNext} XP</span>
                  </div>
                  <div className="border-t border-stone-700 mt-2 pt-2 space-y-1">
                    <div className="flex justify-between text-xs text-stone-300">
                      <span>Kills XP</span><span className="text-orange-400">+{stats.kills * 50}</span>
                    </div>
                    <div className="flex justify-between text-xs text-stone-300">
                      <span>Score XP</span><span className="text-orange-400">+{stats.score * 2}</span>
                    </div>
                    <div className="flex justify-between text-xs text-stone-300">
                      <span>Wave XP</span><span className="text-orange-400">+{stats.wave * 100}</span>
                    </div>
                    <div className="flex justify-between text-xs text-stone-300">
                      <span>Battle Spoils</span><span className="text-yellow-400">+{spoilsGained}</span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Medals / Achievements earned — COD style */}
            {(() => {
              const earnedMedals: { icon: string; name: string; desc: string }[] = [];
              if (stats.headshots >= 10) earnedMedals.push({ icon: '🎯', name: 'HEADHUNTER', desc: '10+ headshots' });
              if (stats.killstreak >= 5) earnedMedals.push({ icon: '🔥', name: 'RAMPAGE', desc: '5 killstreak' });
              if (stats.killstreak >= 10) earnedMedals.push({ icon: '⚡', name: 'GODLIKE', desc: '10 killstreak' });
              if (stats.wave >= 10) earnedMedals.push({ icon: '🌊', name: 'SURVIVOR', desc: 'Reached wave 10' });
              if (stats.wave >= 20) earnedMedals.push({ icon: '🎖️', name: 'VETERAN', desc: 'Reached wave 20' });
              if (stats.shotsFired > 0 && (stats.shotsHit / stats.shotsFired) >= 0.8) earnedMedals.push({ icon: '🔫', name: 'SHARPSHOOTER', desc: '80%+ accuracy' });
              if (stats.damageTaken === 0 && stats.kills > 0) earnedMedals.push({ icon: '🛡️', name: 'UNTOUCHABLE', desc: 'No damage taken' });
              if (stats.kills >= 50) earnedMedals.push({ icon: '💯', name: 'CENTURION', desc: '50+ kills' });
              if (earnedMedals.length === 0) return null;
              return (
                <div className="bg-stone-900/80 rounded-xl p-3 border border-yellow-900/40 mb-4" style={{ animation: 'aarSlideIn 0.6s ease-out 0.3s both' }}>
                  <div className="text-[8px] text-yellow-500 font-black tracking-widest mb-2 uppercase">▼ Medals Earned</div>
                  <div className="flex flex-wrap gap-2">
                    {earnedMedals.map((m, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-stone-800/60 rounded-lg px-2 py-1.5 border border-yellow-800/30" style={{ animation: `aarSlideIn 0.4s ease-out ${0.4 + i * 0.1}s both` }}>
                        <span className="text-lg">{m.icon}</span>
                        <div>
                          <div className="text-[9px] font-black text-yellow-400 tracking-wider uppercase">{m.name}</div>
                          <div className="text-[7px] text-stone-500">{m.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Match Bonus XP — COD style completion reward */}
            {(() => {
              const matchBonus = 500 + stats.wave * 50;
              return (
                <div className="bg-gradient-to-r from-orange-950/40 to-stone-900/80 rounded-xl p-3 border border-orange-800/30 mb-4 flex items-center justify-between" style={{ animation: 'aarSlideIn 0.5s ease-out 0.2s both' }}>
                  <div className="flex items-center gap-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#f97316"><path d="M12 2L15 9L22 9L17 14L19 21L12 17L5 21L7 14L2 9L9 9L12 2Z"/></svg>
                    <div>
                      <div className="text-[8px] text-stone-500 font-black tracking-widest uppercase">Match Bonus</div>
                      <div className="text-[9px] text-stone-400">Completion reward</div>
                    </div>
                  </div>
                  <div className="text-xl font-black text-orange-400" style={{ textShadow: '0 0 8px rgba(249,115,22,0.4)' }}>+{matchBonus} XP</div>
                </div>
              );
            })()}

            {/* Daily challenges progress */}
            {progression.dailyChallenges.challenges.length > 0 && (
              <div className="bg-stone-900/80 rounded p-3 border border-blue-900/50 mb-4 text-left">
                <div className="text-[8px] text-stone-500 font-black tracking-widest mb-2">DAILY CHALLENGES</div>
                {progression.dailyChallenges.challenges.map((c, i) => (
                  <div key={i} className="mb-2">
                    <div className="flex justify-between text-[10px] text-stone-300 mb-1">
                      <span className={c.completed ? 'text-green-400 line-through' : ''}>{c.challenge.description}</span>
                      <span className="text-yellow-400">+{c.challenge.reward}</span>
                    </div>
                    <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${c.completed ? 'bg-green-500' : 'bg-blue-500'} transition-all`}
                        style={{ width: `${Math.min(100, (c.progress / c.challenge.target) * 100)}%` }}
                      />
                    </div>
                    <div className="text-[8px] text-stone-600 text-right mt-0.5">{c.progress}/{c.challenge.target}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Weapon mastery */}
            {progression.weaponKills[stats.weaponKey] !== undefined && (
              <div className="bg-stone-900/80 rounded p-3 border border-stone-700 mb-6 text-left">
                <div className="text-[8px] text-stone-500 font-black tracking-widest mb-2">WEAPON MASTERY — {stats.weaponName}</div>
                {(() => {
                  const kills = progression.weaponKills[stats.weaponKey] || 0;
                  const nextMastery = WEAPON_MASTERY.find(m => kills < m.kills);
                  const currentMastery = [...WEAPON_MASTERY].reverse().find(m => kills >= m.kills);
                  return (
                    <>
                      <div className="flex justify-between text-xs text-stone-300 mb-1">
                        <span>{currentMastery ? currentMastery.name : 'STANDARD'}</span>
                        <span className="text-orange-400">{kills} kills</span>
                      </div>
                      {nextMastery && (
                        <>
                          <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                            <div className="h-full bg-orange-500 transition-all" style={{ width: `${(kills / nextMastery.kills) * 100}%` }} />
                          </div>
                          <div className="text-[8px] text-stone-600 mt-0.5">Next: {nextMastery.name} at {nextMastery.kills} kills</div>
                        </>
                      )}
                      {!nextMastery && <div className="text-[8px] text-yellow-500 mt-0.5">★ MAX MASTERY ACHIEVED ★</div>}
                      {/* Weapon XP bar — separate from player XP */}
                      <div className="mt-2 pt-2 border-t border-stone-700/50">
                        <div className="flex justify-between text-[8px] text-stone-500 font-bold mb-1">
                          <span>WEAPON XP</span>
                          <span className="text-orange-400">+{stats.kills * 30} WXP</span>
                        </div>
                        <div className="w-full h-1.5 bg-stone-800 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-600 to-cyan-400 rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, ((kills % 100) / 100) * 100)}%`, animation: 'xpFill 1s ease-out' }} />
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* Action buttons — COD style */}
            <div className="flex gap-3 justify-center mt-6">
              {onExit && (
                <button
                  onClick={() => { setDead(false); setShowStats(false); setShowModeSelect(true); }}
                  className="px-8 py-3 bg-stone-900/80 hover:bg-red-600/80 text-white text-xs font-black uppercase tracking-widest rounded-lg border border-red-500/40 transition-all hover:scale-105"
                >
                  ← Main Menu
                </button>
              )}
              <button
                onClick={() => {
                  setDead(false);
                  setShowStats(false);
                  setShowLoadout(true);
                  setStats({ kills: 0, shotsFired: 0, shotsHit: 0, hp: 100, maxHp: 100, stamina: 100, maxStamina: 100, ammo: 30, magSize: 30, weaponName: 'MP5 TACTICAL', weaponKey: 'smg', grenades: 3, wave: 1, enemiesAlive: 0, killstreak: 0, score: 0, headshots: 0, damageDealt: 0, damageTaken: 0, compassEnemy: null, crosshairSpread: 0, isLeaning: null, suppressed: false, radarBlips: [], radarObjective: null, uavActive: false, scoreMultiplier: 1, comboTimer: 0, isBossWave: false, bossHp: 0, bossMaxHp: 0, waveDamageTaken: 0, waveHeadshots: 0, waveStartTime: 0, isEliteWave: false, waveModifier: null, spectatorTarget: null, lowAmmo: false, dominationZones: [], safeZoneTimer: 0, currentMap: '', isADS: false });
                }}
                className="px-12 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-xs font-black uppercase tracking-[0.3em] rounded-lg border border-orange-400/40 transition-all hover:scale-105 shadow-lg shadow-orange-600/30"
              >
                Redeploy →
              </button>
              {onMatchEnd && (
                <button
                  onClick={() => onMatchEnd(stats, progression)}
                  className="px-8 py-2.5 bg-stone-700/80 hover:bg-stone-600 text-white text-xs font-black uppercase tracking-widest rounded-lg border border-stone-500/40 transition-all hover:scale-105"
                >
                  Submit Stats
                </button>
              )}
              <button
                onClick={() => {
                  const text = `🎮 LUCKY MILITIA — Match Results\n\n💀 Kills: ${stats.kills}\n🎯 Headshots: ${stats.headshots}\n🔥 Best Streak: ${stats.killstreak}\n📊 Score: ${stats.score}\n🌊 Wave: ${stats.wave}\n🔫 Weapon: ${stats.weaponName}\n⭐ Level: ${progression.level}${progression.prestige.level > 0 ? ' (P' + progression.prestige.level + ')' : ''}\n\nPlay now: https://luckymilitia.xyz`;
                  if (navigator.share) {
                    navigator.share({ title: 'Lucky Militia — Match Results', text }).catch(() => {});
                  } else {
                    navigator.clipboard?.writeText(text);
                    addFeed('★ MATCH RESULTS COPIED TO CLIPBOARD ★');
                  }
                }}
                className="px-6 py-2.5 bg-blue-600/60 hover:bg-blue-500 text-white text-xs font-black uppercase tracking-widest rounded-lg border border-blue-400/40 transition-all hover:scale-105"
              >
                📤 Share
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hit marker */}
      {hit && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
          <div className={headshot ? 'text-red-500 text-3xl font-black rotate-45' : 'text-orange-500 text-2xl font-black rotate-45'}>✕</div>
        </div>
      )}

      {/* Top-center wave counter — compact pill */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <div className="flex items-center gap-3 bg-stone-950/70 backdrop-blur-sm rounded-full px-4 py-1.5 border border-stone-700/60 shadow-lg shadow-black/50">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse" style={{ boxShadow: '0 0 4px rgba(249,115,22,0.8)' }} />
            <span className="text-[8px] text-stone-500 font-black tracking-[0.25em] uppercase">Wave</span>
            <span className="text-xl font-black text-white tracking-wider leading-none">{stats.wave}</span>
          </div>
          <div className="w-px h-4 bg-stone-700" />
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-stone-500 font-black tracking-widest uppercase">Hostiles</span>
            <span className="text-sm font-black text-red-400 leading-none">{stats.enemiesAlive}</span>
          </div>
        </div>
      </div>

      {/* Top team status bar — reference style avatars + score (desktop only, offset for minimap) */}
      {!isMobile && (
      <div className="absolute top-3 left-36 right-4 z-20 pointer-events-none">
        <div className="flex items-center justify-between">
          {/* Friendly team */}
          <div className="flex items-center gap-1.5">
            <div className="flex -space-x-2">
              <div className="w-9 h-9 rounded-full border-2 border-stone-800 overflow-hidden" style={{ background: CHAR_COLORS[loadout.character] }}>
                <svg width="36" height="36" viewBox="0 0 64 64">{CHAR_ICONS[loadout.character]}</svg>
              </div>
              {[0, 1, 2].map(i => (
                <div key={i} className="w-9 h-9 rounded-full border-2 border-stone-800 bg-stone-800/80 overflow-hidden flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-stone-600/60" />
                </div>
              ))}
            </div>
            <span className="text-sm font-black text-cyan-400 ml-1">{stats.kills}</span>
          </div>
          {/* Center score / timer */}
          <div className="flex flex-col items-center">
            <div className="bg-stone-950/70 backdrop-blur-sm rounded-full px-4 py-1 border border-stone-700/50 shadow-lg shadow-black/40">
              <span className="text-lg font-black text-white tracking-widest" style={{ textShadow: '0 0 8px rgba(249,115,22,0.4)' }}>
                {String(Math.floor(((Date.now() / 1000) % 3600) / 60)).padStart(2, '0')}:{String(Math.floor((Date.now() / 1000) % 60)).padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[8px] text-cyan-400 font-black tracking-widest uppercase">Alpha {stats.kills}</span>
              <span className="text-[8px] text-stone-500 font-black">-</span>
              <span className="text-[8px] text-red-400 font-black tracking-widest uppercase">Bravo {stats.enemiesAlive}</span>
            </div>
          </div>
          {/* Enemy team */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-red-400 mr-1">{stats.enemiesAlive}</span>
            <div className="flex -space-x-2">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="w-9 h-9 rounded-full border-2 border-stone-800 bg-stone-800/80 overflow-hidden flex items-center justify-center">
                  <div className="w-5 h-5 rounded-full bg-stone-600/60" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Kill feed — COD style top-right (mobile: below pause buttons) */}
      <div className={`absolute z-20 flex flex-col gap-1.5 pointer-events-none items-end ${isMobile ? 'top-12 right-2' : 'top-4 right-4'}`}>
        {missionName && isLocked && !showBriefing && (
          <div className="mb-1 bg-stone-950/70 backdrop-blur-sm rounded-lg border border-orange-500/20 px-3 py-1.5 shadow-lg shadow-black/40">
            <div className="text-[7px] text-stone-500 font-black tracking-[0.25em] uppercase mb-0.5">Objective</div>
            <div className="text-[10px] text-orange-400 font-bold tracking-wide">{missionObjective || 'Eliminate all hostiles'}</div>
          </div>
        )}
        {feed.map((item) => (
          <div
            key={item.id}
            className="text-[10px] font-black tracking-wider text-right text-orange-400 uppercase bg-stone-950/60 backdrop-blur-sm rounded-lg px-2.5 py-1 border-r-2 border-orange-500/60 shadow-sm"
            style={{ animation: 'slideInRight 0.3s ease-out' }}
          >
            {item.text}
          </div>
        ))}
      </div>

      {/* Bottom-left character status — COD style health/armor bottom-left (mobile: raised above joystick) */}
      <div className={`absolute z-20 pointer-events-none ${isMobile ? 'bottom-[110px] left-3' : 'bottom-5 left-5'}`}>
        <div className={`flex items-center gap-3 bg-stone-950/60 backdrop-blur-md rounded-xl p-2.5 border border-stone-700/40 shadow-xl shadow-black/50 ${isMobile ? '!p-1.5 !gap-2' : ''}`}>
          {/* Character portrait */}
          <div className={`relative rounded-lg overflow-hidden border border-stone-600/40 ${isMobile ? 'w-8 h-8' : 'w-14 h-14'}`} style={{ background: `linear-gradient(135deg, ${CHAR_COLORS[loadout.character]}44, transparent)` }}>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg width={isMobile ? 24 : 36} height={isMobile ? 24 : 36} viewBox="0 0 64 64">
                {CHAR_ICONS[loadout.character]}
              </svg>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-stone-800/60">
              <div className="h-full bg-cyan-400" style={{ width: `${(stats.stamina / stats.maxStamina) * 100}%` }} />
            </div>
          </div>
          <div className={isMobile ? 'w-24' : 'w-36'}>
            {/* Health */}
            <div className="flex items-center justify-between mb-0.5">
              <span className={`font-black leading-none ${healthPct < 30 ? 'text-red-400' : 'text-stone-200'} ${isMobile ? 'text-sm' : 'text-lg'}`}>{stats.hp}<span className="text-[10px] text-stone-500 ml-0.5">/{stats.maxHp}</span></span>
              <span className="text-[8px] text-stone-500 font-black tracking-[0.2em] uppercase">HP</span>
            </div>
            <div className={`bg-stone-900/80 rounded-full overflow-hidden border border-stone-800/80 mb-1.5 ${isMobile ? 'h-1.5' : 'h-2'}`}>
              <div
                className={`h-full rounded-full transition-all duration-200 ${healthPct < 30 ? 'bg-gradient-to-r from-red-700 to-red-500' : healthPct < 60 ? 'bg-gradient-to-r from-orange-600 to-orange-400' : 'bg-gradient-to-r from-cyan-600 to-cyan-400'}`}
                style={{ width: `${healthPct}%`, boxShadow: healthPct < 30 ? '0 0 12px rgba(220,38,38,0.6)' : '0 0 8px rgba(6,182,212,0.4)' }}
              />
            </div>
            {/* Shield */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-stone-500 font-black tracking-[0.15em] uppercase">ARMOR</span>
              <div className="flex-1 h-1.5 bg-stone-900/80 rounded-full overflow-hidden border border-stone-800/80">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all"
                  style={{ width: `${Math.min(100, ARMORS[loadout.armor].damageReduction * 100 * 2.5)}%`, boxShadow: '0 0 4px rgba(59,130,246,0.4)' }}
                />
              </div>
            </div>
            {/* Grenades — hidden on mobile to save space */}
            {!isMobile && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="text-[8px] text-stone-500 font-black tracking-widest uppercase">FRAG</span>
              <div className="flex gap-1">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-2.5 h-3 rounded-sm border transition-all ${i < stats.grenades ? 'bg-green-600/80 border-green-400/60' : 'bg-stone-900 border-stone-800'}`}
                    style={{ boxShadow: i < stats.grenades ? '0 0 4px rgba(34,197,94,0.3)' : 'none' }}
                  />
                ))}
              </div>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom-right weapon/ammo panel — glassmorphic (mobile: hidden, shown in compact top-right) */}
      {!isMobile && (
      <div className="absolute bottom-5 right-5 z-20 pointer-events-none">
        <div className="bg-stone-950/60 backdrop-blur-md rounded-xl p-3 border border-stone-700/40 shadow-xl shadow-black/50 text-right">
          {reloading ? (
            <div className="text-orange-400 text-base font-black tracking-[0.2em] animate-pulse mb-1" style={{ textShadow: '0 0 8px rgba(249,115,22,0.5)' }}>RELOADING</div>
          ) : (
            <div className="flex items-baseline justify-end gap-1.5">
              <span className={`text-4xl font-black leading-none tracking-tighter ${stats.ammo <= 5 ? 'text-red-500' : 'text-orange-500'}`} style={{ textShadow: stats.ammo <= 5 ? '0 0 12px rgba(239,68,68,0.5)' : '0 0 10px rgba(249,115,22,0.3)' }}>{stats.ammo}</span>
              <span className="text-stone-600 text-sm font-black tracking-widest">/ {stats.magSize}</span>
            </div>
          )}
          <div className="text-[9px] text-stone-400 font-black tracking-[0.25em] mt-1 uppercase">{stats.weaponName}</div>
          <div className="mt-2 flex gap-1 justify-end">
            <div className={`px-2 py-0.5 text-[8px] font-black tracking-wider rounded-md transition-all ${stats.weaponKey === loadout.primaryWeapon ? 'bg-orange-600/80 text-white border border-orange-400/40' : 'bg-stone-900/80 text-stone-600 border border-stone-800'}`}>
              2 {loadout.primaryWeapon.toUpperCase()}
            </div>
            <div className={`px-2 py-0.5 text-[8px] font-black tracking-wider rounded-md transition-all ${stats.weaponKey === loadout.secondaryWeapon ? 'bg-orange-600/80 text-white border border-orange-400/40' : 'bg-stone-900/80 text-stone-600 border border-stone-800'}`}>
              1 {loadout.secondaryWeapon.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Mobile compact weapon/ammo — COD style bottom-right, above fire button */}
      {isMobile && isLocked && !dead && (
        <div className="absolute bottom-[185px] right-4 z-20 pointer-events-none">
          <div className="bg-stone-950/60 backdrop-blur-md rounded-lg px-2 py-1 border border-stone-700/40 text-right">
            {reloading ? (
              <div className="text-orange-400 text-[10px] font-black tracking-widest animate-pulse">RELOADING</div>
            ) : (
              <div className="flex items-baseline justify-end gap-1">
                <span className={`text-xl font-black leading-none ${stats.ammo <= 5 ? 'text-red-500' : 'text-orange-500'}`}>{stats.ammo}</span>
                <span className="text-stone-600 text-[10px] font-black">/ {stats.magSize}</span>
              </div>
            )}
            <div className="text-[7px] text-stone-400 font-black tracking-widest uppercase truncate max-w-[100px]">{stats.weaponName}</div>
          </div>
        </div>
      )}

      {/* Scorestreak reward icons — COD mobile style, above weapon panel */}
      {isLocked && !dead && (
        <div className={`absolute z-20 pointer-events-none flex gap-1.5 ${isMobile ? 'top-32 right-3' : 'bottom-[90px] right-5'}`}>
          {Object.values(KILLSTREAK_REWARDS).map((reward) => {
            const earned = stats.killstreak >= reward.requiredStreak;
            const progress = Math.min(1, stats.killstreak / reward.requiredStreak);
            return (
              <div key={reward.key} className={`relative rounded-lg border transition-all ${earned ? 'bg-orange-950/60 border-orange-500/60 shadow-lg shadow-orange-600/20' : 'bg-stone-950/60 border-stone-700/40'}`} style={{ width: isMobile ? '28px' : '36px', height: isMobile ? '28px' : '36px' }}>
                {/* Icon */}
                <div className="absolute inset-0 flex items-center justify-center">
                  {reward.key === 'uav' && <svg width={isMobile ? 14 : 18} height={isMobile ? 14 : 18} viewBox="0 0 24 24" fill="none" stroke={earned ? '#f97316' : '#525252'} strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3"/></svg>}
                  {reward.key === 'airstrike' && <svg width={isMobile ? 14 : 18} height={isMobile ? 14 : 18} viewBox="0 0 24 24" fill="none" stroke={earned ? '#f97316' : '#525252'} strokeWidth="2"><path d="M22 2L2 22M22 2l-7 7M2 22l7-7"/><circle cx="14" cy="10" r="2"/></svg>}
                  {reward.key === 'supplydrop' && <svg width={isMobile ? 14 : 18} height={isMobile ? 14 : 18} viewBox="0 0 24 24" fill="none" stroke={earned ? '#f97316' : '#525252'} strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>}
                  {reward.key === 'gunship' && <svg width={isMobile ? 14 : 18} height={isMobile ? 14 : 18} viewBox="0 0 24 24" fill="none" stroke={earned ? '#f97316' : '#525252'} strokeWidth="2"><path d="M12 2L2 12l10 10 10-10L12 2zM12 6l6 6-6 6-6-6 6-6z"/></svg>}
                </div>
                {/* Progress ring */}
                {!earned && (
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" stroke="#f97316" strokeWidth="1.5" strokeDasharray={`${progress * 100} 100`} pathLength="100" opacity="0.5" />
                  </svg>
                )}
                {/* Required streak label */}
                <div className={`absolute -bottom-3.5 left-1/2 -translate-x-1/2 text-[6px] font-black tracking-wider ${earned ? 'text-orange-400' : 'text-stone-600'}`}>{reward.requiredStreak}</div>
                {/* Earned pulse */}
                {earned && <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
              </div>
            );
          })}
        </div>
      )}

      {/* End op button — subtle pill (desktop: right-center, mobile: top-left small) */}
      <button
        onClick={() => {
          const xpGained = stats.kills * 50 + stats.score * 2 + stats.wave * 100;
          const spoilsGained = Math.round(stats.score * 1.5 + stats.kills * 20);
          const newP = addXp(progression, xpGained);
          const updated = { ...newP, battleSpoils: newP.battleSpoils + spoilsGained, totalKills: newP.totalKills + stats.kills, totalScore: newP.totalScore + stats.score, matchesPlayed: newP.matchesPlayed + 1, bestWave: Math.max(newP.bestWave, stats.wave) };
          saveProgression(updated); setProgression(updated);
          setShowStats(true); setDead(true);
          unlockPointer();
        }}
        className={`z-20 px-3 py-1.5 bg-stone-950/60 backdrop-blur-sm hover:bg-orange-600/80 text-stone-500 hover:text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-lg border border-stone-700/50 hover:border-orange-500/50 transition-all ${isMobile ? 'absolute top-2 left-1/2 -translate-x-1/2 text-[8px] px-2 py-1' : 'absolute top-1/2 right-4 -translate-y-1/2'}`}
      >
        End Op
      </button>

      {/* Compass bar — MW2019 style with degree ticks and objective markers */}
      {isLocked && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className={`relative bg-stone-950/70 backdrop-blur-sm rounded-lg border border-stone-700/50 overflow-hidden shadow-lg shadow-black/40 ${isMobile ? 'w-48 h-5' : 'w-72 h-6'}`}>
            {/* Center marker */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-full bg-orange-500/70" style={{ boxShadow: '0 0 4px rgba(249,115,22,0.5)' }} />
            {/* Degree ticks */}
            <div className="absolute top-0 left-0 w-full h-full flex items-center">
              {[0, 45, 90, 135, 180, 225, 270, 315].map(deg => (
                <div key={deg} className="absolute flex flex-col items-center" style={{ left: `${(deg / 360) * 100}%`, transform: 'translateX(-50%)' }}>
                  <div className="w-px h-1.5 bg-stone-600/60" />
                </div>
              ))}
            </div>
            {/* Cardinal directions */}
            <div className="absolute top-0 left-0 flex items-center justify-between w-full h-full px-3 text-[8px] text-stone-500 font-black tracking-widest">
              <span>N</span><span>W</span><span>S</span><span>E</span>
            </div>
            {/* Enemy marker on compass */}
            {stats.compassEnemy !== null && (
              <div
                className="absolute top-0.5 w-2 h-4 bg-red-500/80 rounded-sm"
                style={{ left: `${50 + Math.sin(stats.compassEnemy) * 45}%`, transform: 'translateX(-50%)', boxShadow: '0 0 4px rgba(239,68,68,0.6)' }}
              />
            )}
            {/* Objective marker on compass */}
            {stats.radarObjective && (
              <div
                className="absolute top-0.5 w-2.5 h-4 flex items-center justify-center"
                style={{ left: `${50 + Math.atan2(stats.radarObjective.x, -stats.radarObjective.z) / Math.PI * 50}%`, transform: 'translateX(-50%)' }}
              >
                <div className="w-2 h-2 border border-orange-400 rotate-45" style={{ boxShadow: '0 0 4px rgba(249,115,22,0.6)' }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Minimap / Radar — COD style top-left */}
      {isLocked && (
        <div className="absolute top-3 left-3 z-20 pointer-events-none">
          <div className={`relative rounded-full bg-stone-950/80 backdrop-blur-sm border-2 border-stone-700/60 overflow-hidden shadow-lg shadow-black/50 ${isMobile ? 'w-20 h-20' : 'w-28 h-28'}`}>
            {/* Grid lines */}
            <div className="absolute top-1/2 left-0 w-full h-px bg-stone-700/30" />
            <div className="absolute left-1/2 top-0 h-full w-px bg-stone-700/30" />
            {/* Range rings */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-stone-700/20" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border border-stone-700/10" />
            {/* Player arrow (center, pointing up) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0"
              style={{ borderLeft: '4px solid transparent', borderRight: '4px solid transparent', borderBottom: '8px solid #f97316', filter: 'drop-shadow(0 0 3px rgba(249,115,22,0.6))' }}
            />
            {/* Enemy blips */}
            {stats.radarBlips.map((blip, i) => {
              const scale = 2.2;
              const px = Math.max(-50, Math.min(50, blip.x * scale));
              const py = Math.max(-50, Math.min(50, blip.z * scale));
              const color = blip.isBoss ? '#ff00ff' : blip.type === 'charger' ? '#ff00aa' : blip.type === 'bomber' ? '#ffaa00' : blip.type === 'medic' ? '#00ffff' : blip.type === 'sniper' ? '#ff0000' : blip.type === 'heavy' ? '#ff6600' : '#ff4444';
              const size = blip.isBoss ? 6 : 4;
              return (
                <div key={i} className="absolute rounded-full"
                  style={{
                    left: `calc(50% + ${px}px)`, top: `calc(50% + ${py}px)`,
                    width: size, height: size, backgroundColor: color,
                    transform: 'translate(-50%, -50%)',
                    boxShadow: `0 0 4px ${color}`,
                  }}
                />
              );
            })}
            {/* Objective marker */}
            {stats.radarObjective && (
              <div className="absolute"
                style={{
                  left: `calc(50% + ${Math.max(-50, Math.min(50, stats.radarObjective.x * 2.2))}px)`,
                  top: `calc(50% + ${Math.max(-50, Math.min(50, stats.radarObjective.z * 2.2))}px)`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                <div className="w-3 h-3 border-2 border-green-400 rounded-sm" style={{ boxShadow: '0 0 6px #22c55e' }} />
              </div>
            )}
            {/* UAV sweep */}
            {stats.uavActive && (
              <div className="absolute top-1/2 left-1/2 w-full h-full origin-center"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 0deg, rgba(34,197,94,0.2) 30deg, transparent 60deg)',
                  animation: 'radarSweep 2s linear infinite',
                }}
              />
            )}
            {stats.uavActive && (
              <div className="absolute top-0.5 left-1/2 -translate-x-1/2 text-[7px] text-green-400 font-black tracking-widest" style={{ textShadow: '0 0 3px rgba(34,197,94,0.6)' }}>UAV</div>
            )}
          </div>
          <div className="text-center text-[7px] text-stone-600 font-mono mt-0.5 tracking-widest">RADAR</div>
        </div>
      )}

      {/* Mobile touch controls — COD Mobile style dual-sided layout */}
      {isLocked && isMobile && (
        <>
          {/* ── LEFT SIDE: Move joystick + left fire/ADS cluster ── */}

          {/* Dynamic left joystick — appears wherever left thumb touches in lower-left zone */}
          <div
            className="absolute bottom-0 left-0 w-[38%] h-[50%] z-10 touch-none"
            style={{ pointerEvents: 'auto' }}
            onTouchStart={(e) => {
              const t = e.changedTouches[0];
              moveJoyRef.current = { id: t.identifier, startX: t.clientX, startY: t.clientY, baseX: t.clientX, baseY: t.clientY };
              setJoyPos({ x: t.clientX, y: t.clientY, active: true });
              if (navigator.vibrate) navigator.vibrate(10);
              const now = Date.now();
              if (now - lastMoveTapRef.current < 300) {
                gameRef.current?.setTouchSprint(true);
                if (navigator.vibrate) navigator.vibrate(20);
              }
              lastMoveTapRef.current = now;
            }}
            onTouchMove={(e) => {
              const t = Array.from(e.changedTouches).find(t => t.identifier === moveJoyRef.current.id);
              if (!t) return;
              const maxR = 50 * settings.joystickSize;
              const dx = t.clientX - moveJoyRef.current.baseX;
              const dy = t.clientY - moveJoyRef.current.baseY;
              const len = Math.sqrt(dx * dx + dy * dy);
              const clampedLen = Math.min(len, maxR);
              const nx = len > 0 ? (dx / len) * clampedLen : 0;
              const ny = len > 0 ? (dy / len) * clampedLen : 0;
              gameRef.current?.setTouchMove(nx / maxR, ny / maxR);
              setJoyPos({ x: moveJoyRef.current.baseX + nx, y: moveJoyRef.current.baseY + ny, active: true });
            }}
            onTouchEnd={(e) => {
              const t = Array.from(e.changedTouches).find(t => t.identifier === moveJoyRef.current.id);
              if (!t) return;
              moveJoyRef.current.id = null;
              gameRef.current?.setTouchMove(0, 0);
              gameRef.current?.setTouchSprint(false);
              setJoyPos({ x: 0, y: 0, active: false });
            }}
          >
            {joyPos.active && (
              <div className="absolute pointer-events-none" style={{ left: joyPos.x - 60 * settings.joystickSize, top: joyPos.y - 60 * settings.joystickSize }}>
                <div
                  className="relative rounded-full border-2 backdrop-blur-sm flex items-center justify-center"
                  style={{
                    width: 120 * settings.joystickSize,
                    height: 120 * settings.joystickSize,
                    background: `rgba(6,182,212,${0.12 * settings.joystickOpacity})`,
                    borderColor: `rgba(34,211,238,${0.5 * settings.joystickOpacity})`,
                    boxShadow: `0 0 ${16 * settings.joystickOpacity}px rgba(34,211,238,${0.25 * settings.joystickOpacity})`,
                  }}
                >
                  <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 120 120" style={{ opacity: settings.joystickOpacity }}>
                    <path d="M60 12 L66 24 L54 24 Z" fill="rgba(34,211,238,0.7)" />
                    <path d="M60 108 L54 96 L66 96 Z" fill="rgba(34,211,238,0.7)" />
                    <path d="M12 60 L24 54 L24 66 Z" fill="rgba(34,211,238,0.7)" />
                    <path d="M108 60 L96 54 L96 66 Z" fill="rgba(34,211,238,0.7)" />
                  </svg>
                  <div
                    className="rounded-full bg-cyan-400/60 border border-cyan-300/70"
                    style={{
                      width: 44 * settings.joystickSize,
                      height: 44 * settings.joystickSize,
                      transform: `translate(${(joyPos.x - moveJoyRef.current.baseX) * (24 * settings.joystickSize) / (50 * settings.joystickSize)}px, ${(joyPos.y - moveJoyRef.current.baseY) * (24 * settings.joystickSize) / (50 * settings.joystickSize)}px)`,
                    }}
                  />
                </div>
              </div>
            )}
            {!joyPos.active && (
              <div
                className="absolute bottom-10 left-8 rounded-full border-2 backdrop-blur-sm flex items-center justify-center pointer-events-none"
                style={{
                  width: 100 * settings.joystickSize,
                  height: 100 * settings.joystickSize,
                  background: `rgba(6,182,212,${0.08 * settings.joystickOpacity})`,
                  borderColor: `rgba(34,211,238,${0.35 * settings.joystickOpacity})`,
                }}
              >
                <svg width={40 * settings.joystickSize} height={40 * settings.joystickSize} viewBox="0 0 120 120" style={{ opacity: settings.joystickOpacity }}>
                  <path d="M60 12 L66 24 L54 24 Z" fill="rgba(34,211,238,0.5)" />
                  <path d="M60 108 L54 96 L66 96 Z" fill="rgba(34,211,238,0.5)" />
                  <path d="M12 60 L24 54 L24 66 Z" fill="rgba(34,211,238,0.5)" />
                  <path d="M108 60 L96 54 L96 66 Z" fill="rgba(34,211,238,0.5)" />
                </svg>
              </div>
            )}
          </div>

          {/* Left-side action buttons — stacked vertically on far left edge */}
          <div className="absolute bottom-0 left-0 z-30 touch-none">
            {/* Reload — bottom-left, above joystick hint */}
            <div className="absolute bottom-[130px] left-3">
              <HudButton size={48} opacity={settings.buttonOpacity} scale={settings.buttonSize} activeColor="rgba(34,197,94,0.4)" borderColor="rgba(74,222,128,0.6)" icon={icons.reload} onClick={() => { gameRef.current?.touchReload(); if (navigator.vibrate) navigator.vibrate(20); }} />
            </div>
            {/* Grenade — above reload */}
            <div className="absolute bottom-[190px] left-3">
              <HudButton size={44} opacity={settings.buttonOpacity} scale={settings.buttonSize} activeColor="rgba(34,197,94,0.4)" borderColor="rgba(74,222,128,0.6)" icon={icons.grenade} onClick={() => { gameRef.current?.touchGrenade(); if (navigator.vibrate) navigator.vibrate(20); }} />
            </div>
            {/* Sprint — above grenade */}
            <div className="absolute bottom-[246px] left-3">
              <HudButton size={40} opacity={settings.buttonOpacity} scale={settings.buttonSize} activeColor="rgba(34,211,238,0.4)" borderColor="rgba(34,211,238,0.7)" icon={icons.sprint} onClick={() => { gameRef.current?.setTouchSprint(true); setTimeout(() => gameRef.current?.setTouchSprint(false), 3000); if (navigator.vibrate) navigator.vibrate(15); }} />
            </div>
            {/* Lean left — top-left area */}
            <div className="absolute top-28 left-3">
              <HudButton size={36} opacity={settings.buttonOpacity} scale={settings.buttonSize} icon={icons.leanLeft} onDown={() => { gameRef.current?.setLean('left'); if (navigator.vibrate) navigator.vibrate(10); }} onUp={() => gameRef.current?.setLean(null)} />
            </div>
            {/* Lean right — next to lean left */}
            <div className="absolute top-28 left-[48px]">
              <HudButton size={36} opacity={settings.buttonOpacity} scale={settings.buttonSize} icon={icons.leanRight} onDown={() => { gameRef.current?.setLean('right'); if (navigator.vibrate) navigator.vibrate(10); }} onUp={() => gameRef.current?.setLean(null)} />
            </div>
            {/* Emote — next to lean */}
            <div className="absolute top-28 left-[96px]">
              <HudButton size={36} opacity={settings.buttonOpacity} scale={settings.buttonSize} icon={icons.emote} onClick={() => { if (navigator.vibrate) navigator.vibrate(15); }} />
            </div>
          </div>

          {/* ── CENTER: Look swipe zone (between left and right button clusters) ── */}
          <div
            className="absolute bottom-0 left-[38%] right-[38%] h-[55%] z-10 touch-none"
            style={{ pointerEvents: 'auto' }}
            onTouchStart={(e) => {
              const t = e.changedTouches[0];
              lookJoyRef.current = { id: t.identifier, lastX: t.clientX, lastY: t.clientY, startY: t.clientY, startTime: Date.now() };
            }}
            onTouchMove={(e) => {
              const t = Array.from(e.changedTouches).find(t => t.identifier === lookJoyRef.current.id);
              if (!t) return;
              const dx = t.clientX - lookJoyRef.current.lastX;
              const dy = t.clientY - lookJoyRef.current.lastY;
              gameRef.current?.setTouchLook(dx, dy);
              lookJoyRef.current.lastX = t.clientX;
              lookJoyRef.current.lastY = t.clientY;
            }}
            onTouchEnd={(e) => {
              const t = Array.from(e.changedTouches).find(t => t.identifier === lookJoyRef.current.id);
              if (!t) return;
              const swipeDist = t.clientY - lookJoyRef.current.startY;
              const swipeTime = Date.now() - lookJoyRef.current.startTime;
              if (swipeDist > 120 && swipeTime < 400) {
                gameRef.current?.touchReload();
                if (navigator.vibrate) navigator.vibrate(30);
              }
              if (swipeDist < -100 && swipeTime < 300) {
                gameRef.current?.touchJump();
                if (navigator.vibrate) navigator.vibrate(20);
              }
              lookJoyRef.current.id = null;
              gameRef.current?.setTouchLook(0, 0);
            }}
          />

          {/* ── RIGHT SIDE: Fire + action buttons ── */}
          <div className="absolute bottom-0 right-0 z-30 touch-none">
            {/* RIGHT fire+aim+scope button — combined like COD Mobile: hold to fire + ADS + aim assist, drag to look */}
            <div className="absolute bottom-5 right-4">
              <HudButton size={72} opacity={settings.buttonOpacity} scale={settings.buttonSize} activeColor="rgba(239,68,68,0.6)" borderColor="rgba(248,113,113,0.8)" icon={icons.fire} onDown={() => { gameRef.current?.setTouchFiring(true); gameRef.current?.setTouchADS(true); gameRef.current?.setAimAssist(0.6); if (navigator.vibrate) navigator.vibrate(10); }} onUp={() => { gameRef.current?.setTouchFiring(false); gameRef.current?.setTouchADS(false); gameRef.current?.setAimAssist(0); }} onDrag={(dx, dy) => gameRef.current?.setTouchLook(dx, dy)} />
            </div>
            {/* Crouch — left of fire */}
            <div className="absolute bottom-5 right-[82px]">
              <HudButton size={48} opacity={settings.buttonOpacity} scale={settings.buttonSize} icon={icons.crouch} onClick={() => { gameRef.current?.touchCrouch(); if (navigator.vibrate) navigator.vibrate(10); }} />
            </div>
            {/* Jump — above crouch */}
            <div className="absolute bottom-[82px] right-[82px]">
              <HudButton size={46} opacity={settings.buttonOpacity} scale={settings.buttonSize} icon={icons.jump} onClick={() => { gameRef.current?.touchJump(); if (navigator.vibrate) navigator.vibrate(15); }} />
            </div>
            {/* Melee — above fire */}
            <div className="absolute bottom-[90px] right-6">
              <HudButton size={44} opacity={settings.buttonOpacity} scale={settings.buttonSize} activeColor="rgba(239,68,68,0.4)" borderColor="rgba(248,113,113,0.6)" icon={icons.knife} onClick={() => { gameRef.current?.touchMelee(); if (navigator.vibrate) navigator.vibrate(40); }} />
            </div>
            {/* Quick-scope — above melee */}
            <div className="absolute bottom-[146px] right-6">
              <HudButton size={42} opacity={settings.buttonOpacity} scale={settings.buttonSize} icon={icons.quickScope} onClick={() => { gameRef.current?.touchQuickScope(); if (navigator.vibrate) navigator.vibrate(25); }} />
            </div>
            {/* Weapon switch — top-right corner */}
            <div className="absolute top-16 right-3">
              <HudButton size={42} opacity={settings.buttonOpacity} scale={settings.buttonSize} icon={icons.swap} onClick={() => { gameRef.current?.touchSwitchWeapon(); if (navigator.vibrate) navigator.vibrate(15); }} />
            </div>
            {/* Auto-fire toggle — next to weapon switch */}
            <div className="absolute top-16 right-[54px]">
              <HudButton size={38} opacity={settings.buttonOpacity} scale={settings.buttonSize} activeColor={autoFire ? 'rgba(34,197,94,0.5)' : undefined} borderColor={autoFire ? 'rgba(74,222,128,0.8)' : undefined} icon={autoFire ? icons.autoOn : icons.autoOff} onClick={() => { setAutoFire(!autoFire); if (navigator.vibrate) navigator.vibrate(15); }} />
            </div>
          </div>

          {/* ── LEFT FIRE button — for left-handed play, bottom-left corner above joystick ── */}
          <div className="absolute bottom-[130px] left-[60px] z-30 touch-none">
            <HudButton size={56} opacity={settings.buttonOpacity * 0.85} scale={settings.buttonSize} activeColor="rgba(239,68,68,0.5)" borderColor="rgba(248,113,113,0.7)" icon={icons.fire} onDown={() => { gameRef.current?.setTouchFiring(true); if (navigator.vibrate) navigator.vibrate(10); }} onUp={() => gameRef.current?.setTouchFiring(false)} onDrag={(dx, dy) => gameRef.current?.setTouchLook(dx, dy)} />
          </div>
          {/* LEFT ADS/scope assist — next to left fire */}
          <div className="absolute bottom-[130px] left-[124px] z-30 touch-none">
            <HudButton size={46} opacity={settings.buttonOpacity * 0.85} scale={settings.buttonSize} activeColor="rgba(59,130,246,0.4)" borderColor="rgba(96,165,250,0.6)" icon={icons.scope} onDown={() => { gameRef.current?.setTouchADS(true); if (navigator.vibrate) navigator.vibrate(10); }} onUp={() => gameRef.current?.setTouchADS(false)} onDrag={(dx, dy) => gameRef.current?.setTouchLook(dx, dy)} />
          </div>
        </>
      )}

      {/* Controls hint — subtle bottom fade (desktop only) */}
      {isLocked && !isMobile && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 text-[7px] text-stone-700 font-mono tracking-[0.15em] pointer-events-none whitespace-nowrap">
          WASD MOVE • SHIFT SPRINT • C CROUCH • Q/E LEAN • SPACE JUMP • V MELEE • RMB ADS • R RELOAD • G GRENADE • 1/2/3 WEAPONS • F LIGHT • Z QUICK CHAT • X SPECTATE • ESC PAUSE
        </div>
      )}

      {/* Map selection screen — choose battlefield */}
      {showMapSelect && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/95 z-50 pointer-events-auto font-mono overflow-y-auto py-8" style={{ animation: 'fadeInScale 0.3s ease-out' }}>
          <style>{`
            @keyframes mapCardIn { 0% { opacity: 0; transform: translateY(20px) scale(0.95); } 100% { opacity: 1; transform: translateY(0) scale(1); } }
            @keyframes mapCardGlow { 0%, 100% { box-shadow: 0 0 8px rgba(249,115,22,0.2); } 50% { box-shadow: 0 0 24px rgba(249,115,22,0.5); } }
          `}</style>
          <div className="text-center mb-6" style={{ animation: 'briefingSlideIn 0.4s ease-out' }}>
            <div className="text-[10px] text-orange-500 font-black tracking-[0.5em] mb-1">SELECT BATTLEFIELD</div>
            <div className="text-3xl text-white font-black tracking-[0.15em]">CHOOSE YOUR WARZONE</div>
            <div className="mt-2 text-[10px] text-stone-500 tracking-widest">Each map features unique terrain, weather, and enemy composition</div>
          </div>
          <div className={`grid gap-4 max-w-4xl px-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {(Object.keys(BATTLEFIELDS) as MapType[]).map((mapId, idx) => {
              const map = BATTLEFIELDS[mapId];
              const isSelected = selectedMap === mapId;
              return (
                <div
                  key={mapId}
                  onClick={() => setSelectedMap(mapId)}
                  className="cursor-pointer rounded-xl border-2 p-5 transition-all hover:scale-[1.02]"
                  style={{
                    animation: `mapCardIn 0.4s ease-out ${idx * 0.1}s both`,
                    borderColor: isSelected ? '#f97316' : 'rgba(120,120,120,0.3)',
                    background: isSelected ? 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(0,0,0,0.6))' : 'rgba(20,20,20,0.7)',
                    boxShadow: isSelected ? '0 0 20px rgba(249,115,22,0.3)' : 'none',
                  }}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="text-4xl">{map.icon}</div>
                    <div className="flex-1">
                      <div className="text-lg font-black text-white tracking-wide">{map.name}</div>
                      <div className="text-[9px] text-stone-400 tracking-widest uppercase mt-0.5">
                        {map.weather !== 'none' ? `WEATHER: ${map.weather.toUpperCase()}` : 'CLEAR CONDITIONS'}
                      </div>
                    </div>
                    {isSelected && (
                      <div className="text-orange-500 text-xl">✦</div>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-400 leading-relaxed mb-3">{map.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {map.recommendedWeapons.map((w) => (
                      <span key={w} className="text-[8px] px-2 py-0.5 rounded bg-stone-800 text-stone-400 uppercase tracking-wider font-bold border border-stone-700">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { setShowMapSelect(false); setShowModeSelect(true); }}
              className="px-6 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs font-black uppercase tracking-widest rounded-lg border border-stone-700 transition-all"
            >
              ← Back
            </button>
            <button
              onClick={() => { if (missionName) { setShowMapSelect(false); setShowBriefing(true); } else { enterBattlefield(); } }}
              className="px-12 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-xs font-black uppercase tracking-[0.3em] rounded-lg border border-orange-400/40 transition-all hover:scale-105"
              style={{ animation: 'mapCardGlow 2s ease-in-out infinite' }}
            >
              Deploy to {BATTLEFIELDS[selectedMap].name} →
            </button>
          </div>
        </div>
      )}

      {/* Mission briefing overlay — tactical CoD-style briefing */}
      {showBriefing && missionName && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-50 pointer-events-auto font-mono overflow-y-auto py-6" style={{ animation: 'fadeInScale 0.3s ease-out' }}>
          <style>{`
            @keyframes briefingSlideIn { 0% { opacity: 0; transform: translateX(-30px); } 100% { opacity: 1; transform: translateX(0); } }
            @keyframes briefingSlideRight { 0% { opacity: 0; transform: translateX(30px); } 100% { opacity: 1; transform: translateX(0); } }
            @keyframes briefingFadeUp { 0% { opacity: 0; transform: translateY(15px); } 100% { opacity: 1; transform: translateY(0); } }
            @keyframes briefingGlow { 0%, 100% { box-shadow: 0 0 8px rgba(249,115,22,0.2); } 50% { box-shadow: 0 0 20px rgba(249,115,22,0.4); } }
            @keyframes briefingScan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
            @keyframes briefingPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
          `}</style>
          {/* Scanline overlay */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.05]">
            <div className="absolute left-0 right-0 h-24" style={{ background: 'linear-gradient(180deg, transparent, rgba(249,115,22,1), transparent)', animation: 'briefingScan 6s linear infinite' }} />
          </div>
          {/* Grid background */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(249,115,22,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

          <div className={`relative max-w-4xl w-full mx-6 ${isMobile ? 'px-4 py-4' : 'px-8 py-6'}`}>
            {/* Top bar — mission classification */}
            <div className="flex items-center justify-between mb-6" style={{ animation: 'briefingSlideIn 0.4s ease-out' }}>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-red-500" style={{ animation: 'briefingPulse 1.5s ease-in-out infinite' }} />
                <span className="text-[9px] text-red-400 font-black tracking-[0.4em] uppercase">Classified // Top Secret</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-stone-600 font-bold tracking-widest uppercase">Briefing ID:</span>
                <span className="text-[8px] text-stone-400 font-bold">{Date.now().toString(36).toUpperCase().slice(-8)}</span>
              </div>
            </div>

            {/* Main content — two column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
              {/* Left column — Mission Intel */}
              <div style={{ animation: 'briefingSlideIn 0.5s ease-out' }}>
                {/* Mission name header */}
                <div className="mb-4">
                  <div className="text-[8px] text-stone-500 font-black tracking-[0.4em] uppercase mb-1">Operation</div>
                  <div className="text-3xl font-black text-orange-500 tracking-[0.15em] mb-2" style={{ textShadow: '0 0 20px rgba(249,115,22,0.4)' }}>{missionName}</div>
                  <div className="w-32 h-px bg-gradient-to-r from-orange-500/60 to-transparent" />
                </div>

                {/* Mission type badge */}
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-stone-900/80 rounded-lg border border-stone-700/50 mb-4">
                  <span className="text-[8px] text-stone-500 font-black tracking-widest uppercase">Type:</span>
                  <span className="text-[10px] text-orange-400 font-black tracking-widest uppercase">{missionType || 'Survival'}</span>
                </div>

                {/* Objective */}
                <div className="mb-4 p-4 bg-stone-950/60 rounded-lg border border-stone-800/60">
                  <div className="text-[8px] text-stone-500 font-black tracking-[0.3em] uppercase mb-2">▼ Mission Objective</div>
                  <div className="text-sm text-stone-200 font-mono tracking-wide leading-relaxed">
                    {missionObjective || 'Survive and eliminate all hostiles in the sector.'}
                  </div>
                </div>

                {/* Threat assessment */}
                <div className="mb-4 p-4 bg-stone-950/60 rounded-lg border border-stone-800/60">
                  <div className="text-[8px] text-stone-500 font-black tracking-[0.3em] uppercase mb-2">▼ Threat Assessment</div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[8px] text-stone-500 font-bold uppercase">Hostile Density:</span>
                    <div className="flex-1 h-2 bg-stone-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: '75%', background: 'linear-gradient(90deg, #fbbf24, #ef4444)', boxShadow: '0 0 6px rgba(239,68,68,0.4)' }} />
                    </div>
                    <span className="text-[8px] text-red-400 font-black">HIGH</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[8px] text-stone-500 font-bold uppercase">Recommended Loadout:</span>
                    <span className="text-[8px] text-orange-400 font-bold">Assault / Heavy</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[8px] text-stone-500 font-bold uppercase">Extraction:</span>
                    <span className="text-[8px] text-stone-300 font-bold">No extraction — fight to the last</span>
                  </div>
                </div>

                {/* Tactical notes */}
                <div className="p-4 bg-stone-950/60 rounded-lg border border-stone-800/60">
                  <div className="text-[8px] text-stone-500 font-black tracking-[0.3em] uppercase mb-2">▼ Tactical Notes</div>
                  <ul className="space-y-1.5 text-[10px] text-stone-400 font-mono tracking-wide">
                    <li className="flex items-start gap-2"><span className="text-orange-500/60 mt-0.5">▸</span>Eliminate all hostile forces in the sector</li>
                    <li className="flex items-start gap-2"><span className="text-orange-500/60 mt-0.5">▸</span>Survive incoming enemy waves — difficulty escalates</li>
                    <li className="flex items-start gap-2"><span className="text-orange-500/60 mt-0.5">▸</span>Use cover and maintain combat readiness at all times</li>
                    <li className="flex items-start gap-2"><span className="text-orange-500/60 mt-0.5">▸</span>Headshots deal 2.5x damage — aim for the kill</li>
                  </ul>
                </div>
              </div>

              {/* Right column — Loadout Summary */}
              <div style={{ animation: 'briefingSlideRight 0.5s ease-out' }}>
                <div className="p-4 bg-gradient-to-b from-stone-950/80 to-black/60 rounded-xl border border-orange-900/20">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-px flex-1 bg-gradient-to-r from-orange-500/40 to-transparent" />
                    <span className="text-[8px] text-orange-500/70 font-black tracking-[0.3em] uppercase">Loadout Summary</span>
                    <div className="h-px flex-1 bg-gradient-to-l from-orange-500/40 to-transparent" />
                  </div>

                  {/* Operator */}
                  <div className="mb-3 p-3 bg-stone-900/40 rounded-lg border border-stone-800/40">
                    <div className="text-[7px] text-stone-600 font-black tracking-widest uppercase mb-1">Operator</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-white tracking-wider">{CHARACTERS[loadout.character]?.name || 'ASSAULT'}</span>
                      <div className="flex gap-2 text-[8px]">
                        <span className="text-stone-400 font-bold">{CHARACTERS[loadout.character]?.baseHp} HP</span>
                        <span className="text-stone-500">|</span>
                        <span className="text-stone-400 font-bold">{CHARACTERS[loadout.character]?.baseSpeed} SPD</span>
                      </div>
                    </div>
                  </div>

                  {/* Primary weapon */}
                  <div className="mb-3 p-3 bg-stone-900/40 rounded-lg border border-stone-800/40">
                    <div className="text-[7px] text-stone-600 font-black tracking-widest uppercase mb-1">Primary Weapon</div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-orange-400 tracking-wider">{WEAPONS[loadout.primaryWeapon]?.name || 'SMG'}</span>
                      <div className="flex gap-2 text-[8px]">
                        <span className="text-stone-400 font-bold">{WEAPONS[loadout.primaryWeapon]?.damage} DMG</span>
                        <span className="text-stone-500">|</span>
                        <span className="text-stone-400 font-bold">{WEAPONS[loadout.primaryWeapon]?.magSize} MAG</span>
                      </div>
                    </div>
                  </div>

                  {/* Secondary weapon */}
                  <div className="mb-3 p-3 bg-stone-900/40 rounded-lg border border-stone-800/40">
                    <div className="text-[7px] text-stone-600 font-black tracking-widest uppercase mb-1">Secondary</div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-stone-300 tracking-wider">{WEAPONS[loadout.secondaryWeapon]?.name || 'M9 SIDEARM'}</span>
                      <span className="text-[8px] text-stone-500 font-bold">{WEAPONS[loadout.secondaryWeapon]?.damage} DMG</span>
                    </div>
                  </div>

                  {/* Armor + Grenade + Perk in compact grid */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="p-2 bg-stone-900/40 rounded-lg border border-stone-800/40 text-center">
                      <div className="text-[6px] text-stone-600 font-black tracking-widest uppercase mb-1">Armor</div>
                      <div className="text-[9px] font-black text-stone-300">{ARMORS[loadout.armor]?.name || 'LIGHT'}</div>
                    </div>
                    <div className="p-2 bg-stone-900/40 rounded-lg border border-stone-800/40 text-center">
                      <div className="text-[6px] text-stone-600 font-black tracking-widest uppercase mb-1">Grenade</div>
                      <div className="text-[9px] font-black text-stone-300">{GRENADES[loadout.grenadeType]?.name || 'FRAG'} x{loadout.grenadeCount}</div>
                    </div>
                    <div className="p-2 bg-stone-900/40 rounded-lg border border-stone-800/40 text-center">
                      <div className="text-[6px] text-stone-600 font-black tracking-widest uppercase mb-1">Perk</div>
                      <div className="text-[9px] font-black text-stone-300">{PERKS[loadout.perk]?.name || 'NONE'}</div>
                    </div>
                  </div>

                  {/* Level progression mini-bar */}
                  <div className="p-3 bg-stone-900/40 rounded-lg border border-stone-800/40">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[7px] text-stone-600 font-black tracking-widest uppercase">Rank Level {progression.level}</span>
                      <span className="text-[7px] text-orange-500/70 font-bold">{progression.battleSpoils} Spoils</span>
                    </div>
                    <div className="h-1.5 bg-stone-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, (progression.xp / (progression.level * 500)) * 100)}%`, background: 'linear-gradient(90deg, #ea580c, #f97316)' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom bar — controls hint + deploy */}
            <div className="flex items-center justify-between mt-6" style={{ animation: 'briefingFadeUp 0.6s ease-out' }}>
              {/* Controls hint */}
              <div className="flex items-center gap-4 text-[8px] text-stone-600 font-bold tracking-widest uppercase">
                <span><span className="text-stone-400">WASD</span> Move</span>
                <span><span className="text-stone-400">MOUSE</span> Aim</span>
                <span><span className="text-stone-400">CLICK</span> Fire</span>
                <span><span className="text-stone-400">R</span> Reload</span>
                <span><span className="text-stone-400">SHIFT</span> Sprint</span>
                <span><span className="text-stone-400">SPACE</span> Jump</span>
              </div>

              {/* Deploy button */}
              <div className="flex items-center gap-3">
                {onExit && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowBriefing(false); setShowModeSelect(true); }}
                    className="px-6 py-3 bg-stone-900/80 hover:bg-stone-800 text-stone-400 text-xs font-black uppercase tracking-widest rounded-lg border border-stone-700/50 transition-all hover:scale-105"
                  >
                    Abort
                  </button>
                )}
                <button
                  onClick={() => { enterBattlefield(); }}
                  className="relative px-12 py-3 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-sm font-black uppercase tracking-[0.3em] rounded-lg border border-orange-400/40 transition-all hover:scale-105 overflow-hidden"
                  style={{ boxShadow: '0 0 20px rgba(249,115,22,0.3), 0 2px 8px rgba(0,0,0,0.4)', animation: 'briefingGlow 2s ease-in-out infinite' }}
                >
                  <span className="relative z-10">Deploy</span>
                  <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COD-style loading screen — deploying transition */}
      {showLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-50 pointer-events-auto font-mono" style={{ animation: 'fadeInScale 0.3s ease-out' }}>
          <style>{`
            @keyframes loadingTipFade { 0% { opacity: 0; transform: translateY(10px); } 15% { opacity: 1; transform: translateY(0); } 85% { opacity: 1; } 100% { opacity: 0; transform: translateY(-10px); } }
            @keyframes loadingPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
          `}</style>
          {/* Background — map preview gradient */}
          <div className="absolute inset-0 opacity-20" style={{ background: 'radial-gradient(circle at 50% 40%, rgba(249,115,22,0.15), transparent 60%)' }} />
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'linear-gradient(rgba(249,115,22,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.5) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }} />

          <div className="relative z-10 text-center max-w-lg w-full px-4 sm:px-6">
            {/* Deploying header */}
            <div className="mb-8">
              <div className="text-[10px] text-stone-500 font-black tracking-[0.5em] mb-2" style={{ animation: 'loadingPulse 1.5s ease-in-out infinite' }}>DEPLOYING TO</div>
              <div className="text-3xl sm:text-4xl font-black text-orange-500 tracking-[0.2em]" style={{ textShadow: '0 0 25px rgba(249,115,22,0.5)' }}>
                {missionName || BATTLEFIELDS[selectedMap].name}
              </div>
              <div className="text-[10px] text-stone-500 font-bold tracking-widest uppercase mt-2">{missionType || 'Combat Mission'}</div>
            </div>

            {/* Loading bar */}
            <div className="mb-6">
              <div className="w-full h-2 bg-stone-900 rounded-full overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-200"
                  style={{ width: `${loadingProgress}%`, boxShadow: '0 0 12px rgba(249,115,22,0.6)' }}
                />
              </div>
              <div className="flex justify-between mt-1.5 text-[8px] text-stone-600 font-black tracking-widest uppercase">
                <span>Loading Assets</span>
                <span>{Math.round(loadingProgress)}%</span>
              </div>
            </div>

            {/* Rotating tip */}
            <div className="h-16 flex items-center justify-center">
              <div key={loadingTip} className="text-xs text-stone-400 font-mono tracking-wide leading-relaxed" style={{ animation: 'loadingTipFade 2.5s ease-in-out' }}>
                {loadingTip || 'Headshots deal 2.5x damage — aim for the head'}
              </div>
            </div>

            {/* Map flyover preview — BO Cold War style tactical overview */}
            {(() => {
              const map = BATTLEFIELDS[selectedMap];
              const skyHex = '#' + map.skyColor.toString(16).padStart(6, '0');
              const floorHex = '#' + map.floorColor.toString(16).padStart(6, '0');
              return (
                <div className="mb-6 mx-auto max-w-sm bg-stone-950/60 rounded-xl border border-stone-700/40 overflow-hidden" style={{ animation: 'aarSlideIn 0.5s ease-out 0.2s both' }}>
                  {/* Map preview — stylized top-down view */}
                  <div className="relative h-32 overflow-hidden" style={{ background: `linear-gradient(135deg, ${skyHex}40, ${floorHex}60)` }}>
                    {/* Grid overlay */}
                    <div className="absolute inset-0 opacity-20" style={{
                      backgroundImage: 'linear-gradient(rgba(249,115,22,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.4) 1px, transparent 1px)',
                      backgroundSize: '20px 20px',
                    }} />
                    {/* Spawn points */}
                    {map.spawnPoints.map((sp, i) => (
                      <div key={i} className="absolute w-1.5 h-1.5 rounded-full bg-red-500/60" style={{
                        left: `${50 + (sp.x / map.size) * 45}%`, top: `${50 + (sp.z / map.size) * 45}%`, transform: 'translate(-50%, -50%)',
                        boxShadow: '0 0 4px rgba(239,68,68,0.6)',
                      }} />
                    ))}
                    {/* Player spawn marker */}
                    <div className="absolute w-2 h-2 rounded-full bg-orange-500" style={{
                      left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
                      boxShadow: '0 0 8px rgba(249,115,22,0.8)',
                    }} />
                    {/* Scanline sweep effect */}
                    <div className="absolute inset-0" style={{
                      background: 'linear-gradient(180deg, transparent 0%, rgba(249,115,22,0.08) 50%, transparent 100%)',
                      animation: 'loadingPulse 2s ease-in-out infinite',
                    }} />
                    {/* Map name overlay */}
                    <div className="absolute bottom-1 left-2 text-[9px] font-black text-white/80 tracking-widest uppercase">{map.icon} {map.name}</div>
                    {/* Weather indicator */}
                    <div className="absolute top-1 right-2 text-[8px] font-black text-stone-400 tracking-widest uppercase">{map.weather}</div>
                  </div>
                  {/* Map details strip */}
                  <div className="px-3 py-2 flex items-center justify-between text-[8px] font-black tracking-widest uppercase">
                    <span className="text-stone-500">Recommended:</span>
                    <span className="text-orange-400">{map.recommendedWeapons.map(w => w.toUpperCase()).join(' · ')}</span>
                  </div>
                </div>
              );
            })()}

            {/* Loadout summary strip */}
            <div className="flex items-center justify-center gap-3 mt-8 text-[8px] text-stone-600 font-black tracking-widest uppercase">
              <span className="text-orange-400">{WEAPONS[loadout.primaryWeapon]?.name || 'SMG'}</span>
              <span className="text-stone-700">|</span>
              <span className="text-stone-400">{CHARACTERS[loadout.character]?.name || 'ASSAULT'}</span>
              <span className="text-stone-700">|</span>
              <span className="text-stone-400">{ARMORS[loadout.armor]?.name || 'LIGHT'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Pause menu */}
      {paused && !dead && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50 pointer-events-auto" style={{ animation: 'fadeInScale 0.2s ease-out' }}>
          <div className="text-center">
            <div className="text-4xl font-black text-white tracking-[0.3em] mb-8" style={{ textShadow: '0 0 20px rgba(255,255,255,0.2)' }}>PAUSED</div>
            <div className="flex flex-col gap-3 w-64">
              <button
                onClick={() => { setPaused(false); gameRef.current?.start(); lockPointer(); }}
                className="px-6 py-3 bg-orange-600/80 hover:bg-orange-600 text-white text-xs font-black uppercase tracking-widest rounded-lg border border-orange-400/40 transition-all hover:scale-105"
              >
                Resume
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="px-6 py-3 bg-stone-800/80 hover:bg-stone-700 text-stone-300 text-xs font-black uppercase tracking-widest rounded-lg border border-stone-600/50 transition-all hover:scale-105"
              >
                Settings
              </button>
              {onExit && (
                <button
                  onClick={() => { setPaused(false); setShowModeSelect(true); gameRef.current?.stop(); unlockPointer(); }}
                  className="px-6 py-3 bg-stone-800/80 hover:bg-red-600/80 text-stone-300 hover:text-white text-xs font-black uppercase tracking-widest rounded-lg border border-stone-600/50 transition-all hover:scale-105"
                >
                  Abort Mission
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {showSettings && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-50 pointer-events-auto" style={{ animation: 'fadeInScale 0.2s ease-out' }}>
          <div className="bg-stone-900/90 backdrop-blur-md rounded-2xl border border-stone-700/50 p-4 sm:p-6 w-[90vw] max-w-sm sm:w-80 shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto">
            <div className="text-lg font-black text-orange-500 tracking-[0.2em] mb-5 text-center" style={{ textShadow: '0 0 10px rgba(249,115,22,0.3)' }}>SETTINGS</div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] text-stone-400 font-black tracking-widest uppercase mb-1.5">
                  <span>Mouse Sensitivity</span>
                  <span className="text-orange-400">{settings.mouseSensitivity.toFixed(1)}</span>
                </div>
                <input
                  type="range" min="0.1" max="3" step="0.1" value={settings.mouseSensitivity}
                  onChange={(e) => setSettings({ ...settings, mouseSensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-stone-400 font-black tracking-widest uppercase mb-1.5">
                  <span>Look Sensitivity</span>
                  <span className="text-orange-400">{settings.lookSensitivity.toFixed(1)}</span>
                </div>
                <input
                  type="range" min="0.1" max="3" step="0.1" value={settings.lookSensitivity}
                  onChange={(e) => setSettings({ ...settings, lookSensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-stone-400 font-black tracking-widest uppercase mb-1.5">
                  <span>Scope Sensitivity</span>
                  <span className="text-orange-400">{settings.scopeSensitivity.toFixed(2)}</span>
                </div>
                <input
                  type="range" min="0.1" max="1.5" step="0.05" value={settings.scopeSensitivity}
                  onChange={(e) => setSettings({ ...settings, scopeSensitivity: parseFloat(e.target.value) })}
                  className="w-full accent-orange-500"
                />
              </div>
              <button
                onClick={() => setSettings({ ...settings, adsToggle: !settings.adsToggle })}
                className={`w-full p-2.5 rounded-lg flex justify-between items-center transition-all ${settings.adsToggle ? 'bg-orange-600/20 border border-orange-500/40' : 'bg-stone-950 border border-stone-800'}`}
              >
                <span className={`text-[10px] font-black uppercase tracking-widest ${settings.adsToggle ? 'text-orange-400' : 'text-stone-500'}`}>ADS Toggle (vs Hold)</span>
                <div className={`w-8 h-4 rounded-full p-0.5 transition-all ${settings.adsToggle ? 'bg-orange-600' : 'bg-stone-900'}`}>
                  <div className={`w-3 h-3 bg-white rounded-full transition-all ${settings.adsToggle ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>
              <div>
                <div className="flex justify-between text-[10px] text-stone-400 font-black tracking-widest uppercase mb-1.5">
                  <span>Sensitivity Curve</span>
                  <span className="text-orange-400">{settings.sensitivityCurve.toFixed(1)}</span>
                </div>
                <input
                  type="range" min="0.5" max="2.5" step="0.1" value={settings.sensitivityCurve}
                  onChange={(e) => setSettings({ ...settings, sensitivityCurve: parseFloat(e.target.value) })}
                  className="w-full accent-orange-500"
                />
                <div className="text-[8px] text-stone-600 mt-1">Lower = faster turns, Higher = more precision</div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-stone-400 font-black tracking-widest uppercase mb-1.5">
                  <span>Field of View</span>
                  <span className="text-orange-400">{settings.fov}°</span>
                </div>
                <input
                  type="range" min="60" max="100" step="5" value={settings.fov}
                  onChange={(e) => setSettings({ ...settings, fov: parseInt(e.target.value) })}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-stone-400 font-black tracking-widest uppercase mb-1.5">
                  <span>SFX Volume</span>
                  <span className="text-orange-400">{Math.round(settings.sfxVolume * 100)}%</span>
                </div>
                <input
                  type="range" min="0" max="1" step="0.1" value={settings.sfxVolume}
                  onChange={(e) => setSettings({ ...settings, sfxVolume: parseFloat(e.target.value) })}
                  className="w-full accent-orange-500"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-stone-400 font-black tracking-widest uppercase mb-1.5">
                  <span>HUD Scale</span>
                  <span className="text-orange-400">{settings.hudScale.toFixed(1)}x</span>
                </div>
                <input
                  type="range" min="0.7" max="1.5" step="0.1" value={settings.hudScale}
                  onChange={(e) => setSettings({ ...settings, hudScale: parseFloat(e.target.value) })}
                  className="w-full accent-orange-500"
                />
              </div>
              {/* HUD Preset — BO6 style layout selector */}
              <div>
                <div className="text-[10px] text-stone-400 font-black tracking-widest uppercase mb-2">HUD Preset</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['standard', 'classic', 'inverted', 'magnified', 'essentials'] as const).map(preset => (
                    <button
                      key={preset}
                      onClick={() => setSettings({ ...settings, hudPreset: preset })}
                      className={`px-2 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${settings.hudPreset === preset ? 'bg-orange-600/30 border border-orange-500/50 text-orange-400' : 'bg-stone-950 border border-stone-800 text-stone-500 hover:bg-stone-900'}`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
              {/* Mobile-only controls */}
              {isMobile && (
                <div className="space-y-3 pt-2 border-t border-stone-800">
                  <div className="text-[10px] text-stone-500 font-black tracking-widest uppercase">Mobile Controls</div>
                  <button
                    onClick={() => { setSettings({ ...settings, autoFire: !settings.autoFire }); setAutoFire(!settings.autoFire); }}
                    className={`w-full p-2.5 rounded-lg flex justify-between items-center transition-all ${settings.autoFire ? 'bg-green-600/20 border border-green-500/40' : 'bg-stone-950 border border-stone-800'}`}
                  >
                    <span className={`text-[10px] font-black uppercase tracking-widest ${settings.autoFire ? 'text-green-400' : 'text-stone-500'}`}>Auto-Fire</span>
                    <div className={`w-8 h-4 rounded-full p-0.5 transition-all ${settings.autoFire ? 'bg-green-600' : 'bg-stone-900'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-all ${settings.autoFire ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>
                  <button
                    onClick={() => setSettings({ ...settings, gyroAim: !settings.gyroAim })}
                    className={`w-full p-2.5 rounded-lg flex justify-between items-center transition-all ${settings.gyroAim ? 'bg-cyan-600/20 border border-cyan-500/40' : 'bg-stone-950 border border-stone-800'}`}
                  >
                    <span className={`text-[10px] font-black uppercase tracking-widest ${settings.gyroAim ? 'text-cyan-400' : 'text-stone-500'}`}>Gyroscope Aim</span>
                    <div className={`w-8 h-4 rounded-full p-0.5 transition-all ${settings.gyroAim ? 'bg-cyan-600' : 'bg-stone-900'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-all ${settings.gyroAim ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      const newVal = !settings.tiltLook;
                      setSettings({ ...settings, tiltLook: newVal });
                      if (newVal && typeof DeviceOrientationEvent !== 'undefined' && typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                        (DeviceOrientationEvent as any).requestPermission().catch(() => {});
                      }
                    }}
                    className={`w-full p-2.5 rounded-lg flex justify-between items-center transition-all ${settings.tiltLook ? 'bg-cyan-600/20 border border-cyan-500/40' : 'bg-stone-950 border border-stone-800'}`}
                  >
                    <span className={`text-[10px] font-black uppercase tracking-widest ${settings.tiltLook ? 'text-cyan-400' : 'text-stone-500'}`}>Tilt to Look</span>
                    <div className={`w-8 h-4 rounded-full p-0.5 transition-all ${settings.tiltLook ? 'bg-cyan-600' : 'bg-stone-900'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-all ${settings.tiltLook ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>
                  {settings.tiltLook && (
                    <div>
                      <div className="flex justify-between text-[10px] text-stone-400 font-black tracking-widest uppercase mb-1.5">
                        <span>Tilt Sensitivity</span>
                        <span className="text-orange-400">{settings.tiltSensitivity.toFixed(1)}x</span>
                      </div>
                      <input
                        type="range" min="0.3" max="3" step="0.1" value={settings.tiltSensitivity}
                        onChange={(e) => setSettings({ ...settings, tiltSensitivity: parseFloat(e.target.value) })}
                        className="w-full accent-orange-500"
                      />
                    </div>
                  )}
                  <button
                    onClick={toggleFullscreen}
                    className={`w-full p-2.5 rounded-lg flex justify-between items-center transition-all ${isFullscreen ? 'bg-orange-600/20 border border-orange-500/40' : 'bg-stone-950 border border-stone-800'}`}
                  >
                    <span className={`text-[10px] font-black uppercase tracking-widest ${isFullscreen ? 'text-orange-400' : 'text-stone-500'}`}>Fullscreen</span>
                    <div className={`w-8 h-4 rounded-full p-0.5 transition-all ${isFullscreen ? 'bg-orange-600' : 'bg-stone-900'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full transition-all ${isFullscreen ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>
                  <div>
                    <div className="flex justify-between text-[10px] text-stone-400 font-black tracking-widest uppercase mb-1.5">
                      <span>Button Size</span>
                      <span className="text-orange-400">{settings.buttonSize.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range" min="0.7" max="1.4" step="0.05" value={settings.buttonSize}
                      onChange={(e) => setSettings({ ...settings, buttonSize: parseFloat(e.target.value) })}
                      className="w-full accent-orange-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-stone-400 font-black tracking-widest uppercase mb-1.5">
                      <span>Button Opacity</span>
                      <span className="text-orange-400">{Math.round(settings.buttonOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range" min="0.2" max="1" step="0.05" value={settings.buttonOpacity}
                      onChange={(e) => setSettings({ ...settings, buttonOpacity: parseFloat(e.target.value) })}
                      className="w-full accent-orange-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-stone-400 font-black tracking-widest uppercase mb-1.5">
                      <span>Joystick Size</span>
                      <span className="text-orange-400">{settings.joystickSize.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range" min="0.7" max="1.4" step="0.05" value={settings.joystickSize}
                      onChange={(e) => setSettings({ ...settings, joystickSize: parseFloat(e.target.value) })}
                      className="w-full accent-orange-500"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] text-stone-400 font-black tracking-widest uppercase mb-1.5">
                      <span>Joystick Opacity</span>
                      <span className="text-orange-400">{Math.round(settings.joystickOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range" min="0.2" max="1" step="0.05" value={settings.joystickOpacity}
                      onChange={(e) => setSettings({ ...settings, joystickOpacity: parseFloat(e.target.value) })}
                      className="w-full accent-orange-500"
                    />
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="w-full mt-6 px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Esc to pause handler */}
      {isLocked && !dead && !showBriefing && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          onKeyDown={(e) => { if (e.key === 'Escape') { setPaused(true); gameRef.current?.stop(); unlockPointer(); } }}
          tabIndex={0}
        />
      )}

      {/* Achievement toast notifications */}
      {achievementToasts.length > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 pointer-events-none">
          {achievementToasts.map((toast) => (
            <div
              key={toast.id}
              className="flex items-center gap-3 bg-stone-950/90 backdrop-blur-md rounded-xl px-4 py-2.5 border border-yellow-500/40 shadow-xl shadow-black/50"
              style={{ animation: 'slideInDown 0.4s ease-out, fadeOut 0.5s ease-in 4.5s forwards' }}
            >
              <div className="text-2xl">{toast.achievement.icon}</div>
              <div>
                <div className="text-[8px] text-yellow-500 font-black tracking-[0.3em] uppercase">Achievement Unlocked</div>
                <div className="text-sm font-black text-white tracking-wide">{toast.achievement.name}</div>
                <div className="text-[8px] text-stone-400">{toast.achievement.description}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wave modifier banner */}
      {waveModifierBanner && isLocked && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30 pointer-events-none" style={{ animation: 'fadeInScale 0.5s ease-out' }}>
          <div className="text-center" style={{ filter: `drop-shadow(0 0 20px ${waveModifierBanner.color}80)` }}>
            <div className="text-[10px] text-stone-400 font-black tracking-[0.4em] mb-1">WAVE MODIFIER</div>
            <div className="text-3xl font-black tracking-[0.15em]" style={{ color: waveModifierBanner.color }}>{waveModifierBanner.name}</div>
            <div className="text-xs text-stone-300 font-mono mt-1">{waveModifierBanner.description}</div>
          </div>
        </div>
      )}

      {/* Quick chat wheel */}
      {showQuickChat && isLocked && !dead && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-auto" onClick={() => setShowQuickChat(false)}>
          <div className="relative" style={{ animation: 'fadeInScale 0.2s ease-out' }}>
            <div className="w-48 h-48 rounded-full bg-stone-950/80 backdrop-blur-md border-2 border-orange-500/30 shadow-2xl shadow-black/60" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[8px] text-stone-500 font-black tracking-widest uppercase pointer-events-none">CALL</div>
            {QUICK_CHAT_OPTIONS.map((opt, i) => {
              const angle = (i / QUICK_CHAT_OPTIONS.length) * Math.PI * 2 - Math.PI / 2;
              const r = 75;
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;
              return (
                <button
                  key={opt.id}
                  className="absolute top-1/2 left-1/2 flex flex-col items-center gap-0.5 w-16 -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform"
                  style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    gameRef.current?.sendQuickChat(opt.id);
                    setShowQuickChat(false);
                  }}
                >
                  <div className="text-lg">{opt.icon}</div>
                  <div className="text-[7px] text-stone-300 font-black tracking-wide uppercase text-center leading-tight">{opt.label}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Spectator mode overlay */}
      {dead && spectatorInfo && mpLobby && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
          <div className="text-center bg-stone-950/70 backdrop-blur-sm rounded-xl px-6 py-3 border border-stone-700/50">
            <div className="text-[8px] text-stone-500 font-black tracking-[0.3em] uppercase mb-1">Spectating</div>
            <div className={`text-lg font-black ${spectatorInfo.team === 'alpha' ? 'text-orange-500' : 'text-cyan-400'}`}>{spectatorInfo.name}</div>
            <div className="text-[8px] text-stone-600 mt-1">Press X to cycle</div>
          </div>
        </div>
      )}

      {/* Domination zone capture progress UI */}
      {isLocked && dominationZones.length > 0 && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex gap-3">
            {dominationZones.map((zone) => (
              <div key={zone.id} className={`bg-stone-950/70 backdrop-blur-sm rounded-lg px-3 py-1.5 border ${zone.contested ? 'border-yellow-500/60 animate-pulse' : zone.team === 'alpha' ? 'border-orange-500/40' : zone.team === 'bravo' ? 'border-cyan-500/40' : 'border-stone-700/50'}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${zone.team === 'alpha' ? 'bg-orange-500' : zone.team === 'bravo' ? 'bg-cyan-400' : 'bg-stone-600'}`} />
                  <span className="text-[8px] font-black tracking-widest uppercase text-stone-400">{zone.contested ? 'CONTESTED' : zone.team === 'neutral' ? 'NEUTRAL' : zone.team.toUpperCase()}</span>
                </div>
                {zone.progress > 0 && zone.team === 'neutral' && (
                  <div className="w-16 h-1 bg-stone-800 rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-yellow-500 transition-all" style={{ width: `${zone.progress}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Low ammo warning pulse */}
      {isLocked && !dead && stats.lowAmmo && !reloading && (
        <div className="absolute bottom-5 right-5 z-20 pointer-events-none" style={{ animation: 'ammoPulse 0.8s ease-in-out infinite' }}>
          <div className="text-[8px] text-red-500 font-black tracking-[0.3em] uppercase text-right" style={{ textShadow: '0 0 8px rgba(239,68,68,0.6)' }}>Low Ammo</div>
        </div>
      )}

      {/* Pre-match countdown with scale-in */}
      {isLocked && preMatchCountdown > 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div className="text-center">
            <div className="text-[10px] text-stone-400 font-black tracking-[0.4em] mb-2">MATCH STARTS IN</div>
            <div
              key={preMatchCountdown}
              className="text-5xl sm:text-8xl font-black text-orange-500 drop-shadow-[0_0_30px_rgba(249,115,22,0.8)]"
              style={{ animation: 'countdownScale 1s ease-out' }}
            >
              {preMatchCountdown}
            </div>
          </div>
        </div>
      )}

      {/* Match summary screen with MVP — MP game over */}
      {mpGameOver && showStats && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-50 pointer-events-auto overflow-y-auto py-8" style={{ animation: 'fadeInScale 0.4s ease-out' }}>
          <div className="text-center max-w-lg px-4">
            <div className="text-4xl font-black uppercase tracking-[0.3em] mb-2" style={{ color: mpGameOver.winner === 'alpha' ? '#f97316' : '#22d3ee', textShadow: `0 0 25px ${mpGameOver.winner === 'alpha' ? 'rgba(249,115,22,0.6)' : 'rgba(34,211,238,0.6)'}` }}>
              {mpGameOver.winner === 'alpha' ? 'ALPHA WINS' : 'BRAVO WINS'}
            </div>
            <div className="text-sm text-stone-500 font-mono tracking-[0.2em] mb-6 uppercase">Match Complete</div>

            {/* MVP */}
            {(() => {
              const allPlayers = Object.entries(mpGameOver.scores).map(([id, s]: [string, any]) => ({ id, ...s }));
              const mvp = allPlayers.sort((a, b) => b.score - a.score)[0];
              if (!mvp) return null;
              return (
                <div className="relative bg-gradient-to-b from-yellow-950/40 to-stone-900/80 rounded-xl p-4 border-2 border-yellow-500/50 mb-4 overflow-hidden" style={{ animation: 'fadeInScale 0.6s ease-out 0.3s both', boxShadow: '0 0 20px rgba(250,204,21,0.2), 0 4px 12px rgba(0,0,0,0.5)' }}>
                  <style>{`
                    @keyframes mvpShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                    @keyframes mvpGlow { 0%, 100% { box-shadow: 0 0 15px rgba(250,204,21,0.3); } 50% { box-shadow: 0 0 30px rgba(250,204,21,0.5); } }
                  `}</style>
                  {/* Shimmer top bar */}
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: 'linear-gradient(90deg, transparent, #facc15, transparent)', backgroundSize: '200% 100%', animation: 'mvpShimmer 2s linear infinite' }} />
                  {/* MVP badge */}
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#facc15" style={{ filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))' }}>
                      <path d="M12 2 L15 9 L22 9 L17 14 L19 21 L12 17 L5 21 L7 14 L2 9 L9 9 Z" />
                    </svg>
                    <div className="text-[10px] text-yellow-400 font-black tracking-[0.4em] uppercase" style={{ animation: 'mvpGlow 2s ease-in-out infinite' }}>MVP</div>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#facc15" style={{ filter: 'drop-shadow(0 0 4px rgba(250,204,21,0.6))' }}>
                      <path d="M12 2 L15 9 L22 9 L17 14 L19 21 L12 17 L5 21 L7 14 L2 9 L9 9 Z" />
                    </svg>
                  </div>
                  <div className="text-xl font-black text-yellow-300 tracking-wider" style={{ textShadow: '0 0 10px rgba(250,204,21,0.4)' }}>{mvp.name || 'UNKNOWN'}</div>
                  <div className="flex justify-center gap-4 mt-2">
                    <div><span className="text-orange-500 font-black text-lg">{mvp.kills}</span> <span className="text-[8px] text-stone-500 font-bold tracking-widest">KILLS</span></div>
                    <div><span className="text-red-400 font-black text-lg">{mvp.deaths}</span> <span className="text-[8px] text-stone-500 font-bold tracking-widest">DEATHS</span></div>
                    <div><span className="text-yellow-400 font-black text-lg">{mvp.score}</span> <span className="text-[8px] text-stone-500 font-bold tracking-widest">SCORE</span></div>
                  </div>
                </div>
              );
            })()}

            {/* Scoreboard */}
            <div className="bg-stone-900/60 rounded-xl p-3 border border-stone-700/50 mb-6">
              <div className="text-[8px] text-stone-500 font-black tracking-widest uppercase mb-2">Final Scores</div>
              {allPlayersSort(mpGameOver.scores).map((p, i) => (
                <div key={p.id} className={`flex items-center gap-2 py-1 ${i === 0 ? 'border-b border-yellow-700/40 bg-yellow-950/20 rounded' : ''}`}>
                  <span className={`text-[8px] font-black w-4 ${i === 0 ? 'text-yellow-400' : 'text-stone-600'}`}>{i === 0 ? '★' : i + 1}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.team === 'alpha' ? 'bg-orange-500' : 'bg-cyan-400'}`} />
                  <span className="text-[10px] font-black text-white flex-1 text-left truncate">{p.name}</span>
                  <span className="text-[10px] font-black text-orange-400 w-8 text-right">{p.kills}</span>
                  <span className="text-[10px] font-black text-red-400 w-8 text-right">{p.deaths}</span>
                  <span className="text-[10px] font-black text-yellow-400 w-12 text-right">{p.score}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              {onExit && (
                <button
                  onClick={() => { setMpGameOver(null); setShowStats(false); setShowModeSelect(true); }}
                  className="px-8 py-2.5 bg-stone-900/80 hover:bg-orange-600/80 text-white text-xs font-black uppercase tracking-widest rounded-lg border border-orange-500/40 transition-all hover:scale-105"
                >
                  ← Main Menu
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeOut { 0% { opacity: 1; } 70% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes floatUp { 0% { opacity: 1; transform: translate(-50%, -50%); } 100% { opacity: 0; transform: translate(-50%, -120%); } }
        @keyframes radarSweep { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }
        @keyframes slideInRight { 0% { opacity: 0; transform: translateX(20px); } 100% { opacity: 1; transform: translateX(0); } }
        @keyframes slideInDown { 0% { opacity: 0; transform: translateY(-15px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes glowPulse { 0%, 100% { box-shadow: 0 0 8px rgba(249,115,22,0.3); } 50% { box-shadow: 0 0 16px rgba(249,115,22,0.5); } }
        @keyframes fadeInScale { 0% { opacity: 0; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes countdownScale { 0% { opacity: 0; transform: scale(2.5); } 50% { opacity: 1; transform: scale(1); } 100% { opacity: 0.8; transform: scale(1); } }
        @keyframes ammoPulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
        @keyframes hitDirPulse { 0% { opacity: 1; transform: rotate(var(--dir)) scale(1.2); } 100% { opacity: 0; transform: rotate(var(--dir)) scale(1); } }
      `}</style>

      {/* Login reward toast */}
      {loginRewardToast && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] pointer-events-none" style={{ animation: 'fadeInScale 0.5s ease-out' }}>
          <div className="bg-stone-950/90 backdrop-blur-md rounded-xl px-6 py-4 border border-orange-500/40 text-center">
            <div className="text-3xl mb-2">🎁</div>
            <div className="text-sm text-orange-400 font-black tracking-widest">{loginRewardToast}</div>
          </div>
        </div>
      )}

      {/* Daily rewards overlay */}
      {showDailyRewards && (
        <DailyRewards
          progression={progression}
          onProgressionChange={setProgression}
          onClose={() => setShowDailyRewards(false)}
        />
      )}

      {/* Leaderboard overlay */}
      {showLeaderboard && (
        <div className="absolute inset-0 bg-black/95 z-[60] pointer-events-auto" style={{ animation: 'fadeInScale 0.3s ease-out' }}>
          <div className="absolute top-3 right-3 z-10">
            <button
              onClick={() => setShowLeaderboard(false)}
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs font-black uppercase tracking-widest rounded-lg border border-stone-700 transition-all"
            >
              ✕ Close
            </button>
          </div>
          <Leaderboard activeAddress="" />
        </div>
      )}

      {/* Prestige panel overlay */}
      {showPrestige && (
        <PrestigePanel
          progression={progression}
          onProgressionChange={setProgression}
          onClose={() => setShowPrestige(false)}
        />
      )}

      {/* Tutorial overlay */}
      {showTutorial && (
        <TutorialOverlay
          isMobile={isMobile}
          onComplete={() => {
            setShowTutorial(false);
            const updated = { ...progressionRef.current, hasSeenTutorial: true };
            saveProgression(updated);
            setProgression(updated);
          }}
        />
      )}

      {/* Weekly challenges overlay */}
      {showWeekly && (
        <WeeklyChallenges
          progression={progression}
          onClose={() => setShowWeekly(false)}
        />
      )}
    </div>
  );
};
