import React, { useState } from 'react';
import type { LoadoutConfig, PlayerProgression, WeaponKey, CharacterClass, ArmorType, GrenadeType, UpgradeType, PerkType } from './types';
import { WEAPONS, CHARACTERS, ARMORS, GRENADES, UPGRADES, PERKS, xpForLevel, saveProgression } from './types';

interface LoadoutScreenProps {
  progression: PlayerProgression;
  loadout: LoadoutConfig;
  onDeploy: (loadout: LoadoutConfig) => void;
  onProgressionChange: (p: PlayerProgression) => void;
  onExit?: () => void;
}

type Tab = 'character' | 'armor' | 'weapons' | 'grenades' | 'upgrades' | 'perks';

const WEAPON_COLORS: Record<WeaponKey, string> = {
  pistol: '#94a3b8', smg: '#f97316', shotgun: '#ef4444', rifle: '#f59e0b', lmg: '#dc2626', sniper: '#22c55e', dmr: '#3b82f6', launcher: '#f97316', plasma: '#d946ef',
};

const CHAR_COLORS: Record<CharacterClass, string> = {
  assault: '#f97316', recon: '#22d3ee', heavy: '#dc2626', medic: '#22c55e',
};

const WeaponIcon: React.FC<{ weapon: WeaponKey; size?: number; color?: string }> = ({ weapon, size = 64, color }) => {
  const c = color || WEAPON_COLORS[weapon];
  const s = size;
  const icons: Record<WeaponKey, React.ReactElement> = {
    pistol: <path d="M20 35 L20 25 L35 25 L35 20 L55 20 L55 25 L50 25 L50 30 L45 30 L45 45 L35 45 L35 30 L25 30 L25 45 L20 45 Z" fill={c} opacity="0.9"/>,
    smg: <path d="M15 30 L15 22 L25 22 L25 18 L60 18 L60 22 L55 22 L55 28 L45 28 L45 35 L50 35 L50 50 L40 50 L40 38 L30 38 L30 50 L22 50 L22 30 Z" fill={c} opacity="0.9"/>,
    shotgun: <path d="M10 28 L10 24 L70 24 L70 28 L62 28 L62 32 L20 32 L20 42 L15 42 L15 32 L10 32 Z M28 32 L28 48 L24 48 L24 32 Z" fill={c} opacity="0.9"/>,
    rifle: <path d="M8 30 L8 24 L55 24 L55 20 L62 20 L62 24 L58 24 L58 28 L52 28 L52 34 L42 34 L42 40 L48 40 L48 52 L38 52 L38 40 L32 40 L32 52 L24 52 L24 34 L18 34 L18 30 Z" fill={c} opacity="0.9"/>,
    lmg: <path d="M6 32 L6 24 L60 24 L60 20 L68 20 L68 24 L64 24 L64 30 L56 30 L56 36 L46 36 L46 42 L52 42 L52 52 L42 52 L42 44 L34 44 L34 52 L26 52 L26 36 L16 36 L16 32 Z M30 36 L30 48 L26 48 L26 36 Z" fill={c} opacity="0.9"/>,
    sniper: <path d="M5 30 L5 26 L72 26 L72 30 L66 30 L66 34 L55 34 L55 22 L53 22 L53 34 L20 34 L20 42 L14 42 L14 34 L5 34 Z M40 22 L40 18 L48 18 L48 22 Z" fill={c} opacity="0.9"/>,
    dmr: <path d="M10 30 L10 25 L58 25 L58 21 L64 21 L64 25 L60 25 L60 29 L52 29 L52 35 L42 35 L42 41 L48 41 L48 52 L38 52 L38 42 L30 42 L30 52 L22 52 L22 35 L16 35 L16 30 Z M38 21 L38 17 L46 17 L46 21 Z" fill={c} opacity="0.9"/>,
    launcher: <path d="M12 32 L12 26 L40 26 L40 22 L50 22 L50 26 L58 26 L58 30 L52 30 L52 36 L42 36 L42 42 L48 42 L48 52 L38 52 L38 44 L30 44 L30 52 L22 52 L22 36 L16 36 L16 32 Z M36 26 L36 20 L44 20 L44 26 Z" fill={c} opacity="0.9"/>,
    plasma: <path d="M14 30 L14 24 L30 24 L30 20 L40 20 L40 24 L56 24 L56 28 L50 28 L50 34 L40 34 L40 40 L46 40 L46 50 L36 50 L36 42 L28 42 L28 50 L20 50 L20 34 L14 34 Z M34 18 L34 14 L42 14 L42 18 Z" fill={c} opacity="0.9"/>,
  };
  return (
    <svg width={s} height={s} viewBox="0 0 80 60" className="flex-shrink-0">
      {icons[weapon]}
    </svg>
  );
};

const CharAvatar: React.FC<{ char: CharacterClass; size?: number; color?: string }> = ({ char, size = 56, color }) => {
  const c = color || CHAR_COLORS[char];
  const icons: Record<CharacterClass, React.ReactElement> = {
    assault: <path d="M28 18 L36 18 L36 28 L46 28 L46 36 L36 36 L36 46 L28 46 L28 36 L18 36 L18 28 L28 28 Z" fill={c}/>,
    recon: <path d="M32 16 L40 32 L28 32 L36 48 L28 48 L20 32 L32 32 L24 16 Z" fill={c}/>,
    heavy: <path d="M32 16 L42 20 L42 30 L48 30 L48 38 L42 38 L42 48 L22 48 L22 38 L16 38 L16 30 L22 30 L22 20 Z" fill={c}/>,
    medic: <path d="M28 20 L36 20 L36 28 L44 28 L44 36 L36 36 L36 44 L28 44 L28 36 L20 36 L20 28 L28 28 Z" fill={c}/>,
  };
  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: size, height: size }}>
      <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle, ${c}22 0%, transparent 70%)` }} />
      <div className="absolute inset-0 rounded-full border-2" style={{ borderColor: `${c}44` }} />
      <svg width={size * 0.75} height={size * 0.75} viewBox="0 0 64 64">
        {icons[char]}
      </svg>
    </div>
  );
};

const StatBar: React.FC<{ label: string; value: number; max: number; color?: string; suffix?: string }> = ({ label, value, max, color = '#f97316', suffix }) => {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] text-stone-500 font-black tracking-widest uppercase w-12 text-right flex-shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-stone-800/80 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 4px ${color}44` }} />
      </div>
      <span className="text-[8px] text-stone-400 font-bold w-8 flex-shrink-0">{value}{suffix}</span>
    </div>
  );
};

const ArmorIcon: React.FC<{ type: ArmorType; size?: number }> = ({ type, size = 48 }) => {
  const colors: Record<ArmorType, string> = { none: '#52525b', light: '#64748b', medium: '#94a3b8', heavy: '#cbd5e1' };
  const c = colors[type];
  const icons: Record<ArmorType, React.ReactElement> = {
    none: <path d="M24 16 L40 16 L40 48 L24 48 Z" fill={c} opacity="0.3" stroke={c} strokeWidth="1.5"/>,
    light: <path d="M22 14 L42 14 L42 20 L38 22 L38 46 L26 46 L26 22 L22 20 Z" fill={c} opacity="0.7"/>,
    medium: <path d="M20 12 L44 12 L44 20 L40 22 L40 48 L24 48 L24 22 L20 20 Z M28 24 L36 24 L36 30 L28 30 Z" fill={c}/>,
    heavy: <path d="M18 10 L46 10 L46 18 L42 20 L42 24 L46 26 L46 34 L42 36 L42 48 L22 48 L22 36 L18 34 L18 26 L22 24 L22 20 L18 18 Z M26 22 L38 22 L38 28 L26 28 Z M26 34 L38 34 L38 40 L26 40 Z" fill={c}/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="flex-shrink-0">
      {icons[type]}
    </svg>
  );
};

const GrenadeIcon: React.FC<{ type: GrenadeType; size?: number }> = ({ type, size = 48 }) => {
  const colors: Record<GrenadeType, string> = { frag: '#84cc16', smoke: '#64748b', flashbang: '#eab308', incendiary: '#ef4444' };
  const c = colors[type];
  const icons: Record<GrenadeType, React.ReactElement> = {
    frag: <g><circle cx="32" cy="36" r="12" fill={c} opacity="0.8"/><rect x="30" y="18" width="4" height="8" fill={c}/><path d="M28 18 L36 18 L34 14 L30 14 Z" fill={c}/></g>,
    smoke: <g><circle cx="32" cy="36" r="10" fill={c} opacity="0.6"/><circle cx="26" cy="28" r="5" fill={c} opacity="0.3"/><circle cx="40" cy="30" r="4" fill={c} opacity="0.3"/><circle cx="32" cy="22" r="3" fill={c} opacity="0.3"/></g>,
    flashbang: <g><circle cx="32" cy="36" r="10" fill={c} opacity="0.7"/><path d="M32 12 L36 24 L28 24 Z" fill={c}/><path d="M16 20 L24 26 L20 32 Z" fill={c} opacity="0.5"/><path d="M48 20 L40 26 L44 32 Z" fill={c} opacity="0.5"/></g>,
    incendiary: <g><circle cx="32" cy="36" r="10" fill={c} opacity="0.7"/><path d="M32 14 L28 26 L36 26 Z" fill={c}/><path d="M32 20 L26 30 L38 30 Z" fill="#f97316" opacity="0.6"/></g>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="flex-shrink-0">
      {icons[type]}
    </svg>
  );
};

const PerkIcon: React.FC<{ perk: PerkType; size?: number }> = ({ perk, size = 40 }) => {
  const colors: Record<PerkType, string> = { none: '#52525b', scavenger: '#84cc16', fasthands: '#22d3ee', juggernaut: '#dc2626', ghost: '#94a3b8', doubletap: '#f59e0b' };
  const c = colors[perk];
  const icons: Record<PerkType, React.ReactElement> = {
    none: <circle cx="32" cy="32" r="16" fill="none" stroke={c} strokeWidth="2" opacity="0.4"/>,
    scavenger: <path d="M20 28 L44 28 L44 44 L20 44 Z M24 28 L24 22 L40 22 L40 28" fill="none" stroke={c} strokeWidth="2.5"/>,
    fasthands: <path d="M22 20 L42 20 L42 28 L36 28 L36 44 L28 44 L28 28 L22 28 Z" fill={c}/>,
    juggernaut: <path d="M32 14 L46 20 L46 32 Q46 42 32 48 Q18 42 18 32 L18 20 Z" fill="none" stroke={c} strokeWidth="2.5"/>,
    ghost: <><path d="M32 18 L32 46 M18 32 L46 32" stroke={c} strokeWidth="2.5" opacity="0.5"/><circle cx="32" cy="32" r="14" fill="none" stroke={c} strokeWidth="2"/></>,
    doubletap: <path d="M24 18 L34 18 L34 28 L44 28 L44 38 L34 38 L34 48 L24 48 L24 38 L14 38 L14 28 L24 28 Z" fill={c} opacity="0.8"/>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className="flex-shrink-0">
      {icons[perk]}
    </svg>
  );
};

export const LoadoutScreen: React.FC<LoadoutScreenProps> = ({ progression, loadout, onDeploy, onProgressionChange, onExit }) => {
  const [tab, setTab] = useState<Tab>('weapons');
  const [currentLoadout, setCurrentLoadout] = useState<LoadoutConfig>(loadout);
  const [selectedWeapon, setSelectedWeapon] = useState<WeaponKey>(loadout.primaryWeapon);

  const updateP = (p: PlayerProgression) => { saveProgression(p); onProgressionChange(p); };

  const buyWeapon = (key: WeaponKey) => {
    const w = WEAPONS[key];
    if (progression.unlockedWeapons.includes(key) || progression.level < w.unlockLevel || progression.battleSpoils < w.cost) return;
    updateP({ ...progression, unlockedWeapons: [...progression.unlockedWeapons, key], battleSpoils: progression.battleSpoils - w.cost });
  };
  const buyArmor = (key: ArmorType) => {
    const a = ARMORS[key];
    if (progression.unlockedArmors.includes(key) || progression.level < a.unlockLevel || progression.battleSpoils < a.cost) return;
    updateP({ ...progression, unlockedArmors: [...progression.unlockedArmors, key], battleSpoils: progression.battleSpoils - a.cost });
  };
  const buyGrenade = (key: GrenadeType) => {
    const g = GRENADES[key];
    if (progression.unlockedGrenades.includes(key) || progression.level < g.unlockLevel || progression.battleSpoils < g.cost) return;
    updateP({ ...progression, unlockedGrenades: [...progression.unlockedGrenades, key], battleSpoils: progression.battleSpoils - g.cost });
  };
  const buyCharacter = (key: CharacterClass) => {
    const c = CHARACTERS[key];
    if (progression.unlockedCharacters.includes(key) || progression.level < c.unlockLevel) return;
    updateP({ ...progression, unlockedCharacters: [...progression.unlockedCharacters, key] });
  };
  const buyUpgrade = (weaponKey: WeaponKey, upgradeType: UpgradeType) => {
    const cfg = UPGRADES[upgradeType];
    const currentLevel = progression.weaponUpgrades[weaponKey]?.[upgradeType] || 0;
    if (currentLevel >= cfg.maxLevel) return;
    const cost = cfg.costPerLevel * (currentLevel + 1);
    if (progression.battleSpoils < cost) return;
    const newUpgrades = { ...progression.weaponUpgrades };
    if (!newUpgrades[weaponKey]) newUpgrades[weaponKey] = {};
    newUpgrades[weaponKey]![upgradeType] = currentLevel + 1;
    updateP({ ...progression, weaponUpgrades: newUpgrades, battleSpoils: progression.battleSpoils - cost });
  };
  const buyPerk = (key: PerkType) => {
    const p = PERKS[key];
    if (progression.unlockedPerks.includes(key) || progression.level < p.unlockLevel || progression.battleSpoils < p.cost) return;
    updateP({ ...progression, unlockedPerks: [...progression.unlockedPerks, key], battleSpoils: progression.battleSpoils - p.cost });
  };

  const xpNeeded = xpForLevel(progression.level);
  const xpPct = (progression.xp / xpNeeded) * 100;
  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'weapons', label: 'ARSENAL', icon: 'weapon' },
    { key: 'character', label: 'OPERATOR', icon: 'char' },
    { key: 'armor', label: 'ARMOR', icon: 'armor' },
    { key: 'grenades', label: 'GRENADES', icon: 'grenade' },
    { key: 'upgrades', label: 'UPGRADES', icon: 'upgrade' },
    { key: 'perks', label: 'PERKS', icon: 'perk' },
  ];
  const maxDmg = 100, maxRpm = 750, maxMag = 100;

  return (
    <div className="absolute inset-0 font-mono text-stone-300 overflow-hidden z-50 flex flex-col select-none" style={{ animation: 'loadoutFadeIn 0.5s ease-out', background: 'radial-gradient(ellipse at 30% 20%, #0f1420 0%, #080810 50%, #050508 100%)' }}>
      <style>{`
        @keyframes loadoutFadeIn { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes slideUp { 0% { opacity: 0; transform: translateY(20px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes slideRight { 0% { opacity: 0; transform: translateX(-20px); } 100% { opacity: 1; transform: translateX(0); } }
        @keyframes scaleIn { 0% { opacity: 0; transform: scale(0.92); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes glowPulse { 0%, 100% { box-shadow: 0 0 8px rgba(249,115,22,0.2); } 50% { box-shadow: 0 0 20px rgba(249,115,22,0.4); } }
        @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
        @keyframes gridMove { 0% { background-position: 0 0; } 100% { background-position: 50px 50px; } }
        @keyframes rotateRing { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        @keyframes barFill { 0% { width: 0%; } 100% { width: var(--target-width); } }
        @keyframes pulseBorder { 0%, 100% { border-color: rgba(249,115,22,0.3); } 50% { border-color: rgba(249,115,22,0.6); } }
        .stagger > * { opacity: 0; animation: scaleIn 0.35s ease-out forwards; }
        .stagger > *:nth-child(1) { animation-delay: 0.03s; }
        .stagger > *:nth-child(2) { animation-delay: 0.06s; }
        .stagger > *:nth-child(3) { animation-delay: 0.09s; }
        .stagger > *:nth-child(4) { animation-delay: 0.12s; }
        .stagger > *:nth-child(5) { animation-delay: 0.15s; }
        .stagger > *:nth-child(6) { animation-delay: 0.18s; }
        .stagger > *:nth-child(7) { animation-delay: 0.21s; }
        .stagger > *:nth-child(8) { animation-delay: 0.24s; }
        .card-tilt { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .card-tilt:hover { transform: translateY(-3px) scale(1.01); }
        .shimmer-text {
          background: linear-gradient(90deg, #f97316 0%, #fbbf24 50%, #f97316 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
      `}</style>

      {/* Animated grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.04]" style={{
        backgroundImage: 'linear-gradient(rgba(249,115,22,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.5) 1px, transparent 1px)',
        backgroundSize: '50px 50px',
        animation: 'gridMove 20s linear infinite',
      }} />
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-0 right-0 h-32 opacity-[0.03]" style={{
          background: 'linear-gradient(180deg, transparent, rgba(249,115,22,1), transparent)',
          animation: 'scanline 8s linear infinite',
        }} />
      </div>
      {/* Ambient glow orbs */}
      <div className="absolute top-[-10%] left-[20%] w-[400px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-10%] right-[10%] w-[350px] h-[350px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)' }} />

      {/* Header bar — premium with corner accents */}
      <div className="relative flex-shrink-0 z-10 bg-gradient-to-b from-black/80 to-stone-950/60 border-b border-orange-900/20 px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between flex-wrap gap-2" style={{ animation: 'slideRight 0.4s ease-out' }}>
        {/* Corner accents */}
        <div className="absolute top-0 left-0 w-12 h-3 border-t-2 border-l-2 border-orange-500/40" />
        <div className="absolute top-0 right-0 w-12 h-3 border-t-2 border-r-2 border-orange-500/40" />
        <div className="flex items-center gap-2 sm:gap-5 flex-wrap">
          {/* Game title with shimmer */}
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-lg bg-gradient-to-br from-orange-600 to-red-800 flex items-center justify-center" style={{ boxShadow: '0 0 16px rgba(249,115,22,0.4), 0 2px 8px rgba(0,0,0,0.5)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 2 L14 8 L20 8 L15 12 L17 18 L12 14 L7 18 L9 12 L4 8 L10 8 Z" fill="white" opacity="0.95"/></svg>
              <div className="absolute inset-0 rounded-lg border border-orange-300/20" />
            </div>
            <div>
              <div className="text-base font-black tracking-[0.25em] uppercase leading-none shimmer-text">Lucky Militia</div>
              <div className="text-[7px] text-stone-500 font-bold tracking-[0.35em] uppercase mt-1 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" style={{ boxShadow: '0 0 4px rgba(34,197,94,0.6)' }} /> Loadout Terminal
              </div>
            </div>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-stone-700 to-transparent" />
          {/* Level badge — hexagonal style */}
          <div className="flex items-center gap-3">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-600/20 to-orange-900/20 border-2 border-orange-500/30" style={{ animation: 'rotateRing 8s linear infinite', borderTopColor: 'rgba(249,115,22,0.6)', borderRightColor: 'transparent', borderBottomColor: 'transparent' }} />
              <div className="absolute inset-1 rounded-full bg-stone-950/80 border border-orange-500/20 flex items-center justify-center">
                <span className="text-lg font-black text-orange-500" style={{ textShadow: '0 0 10px rgba(249,115,22,0.5)' }}>{progression.level}</span>
              </div>
            </div>
            <div className="w-24 sm:w-32">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[7px] text-stone-500 font-bold tracking-widest uppercase">Level {progression.level}</span>
                <span className="text-[7px] text-orange-500/70 font-bold">{progression.xp}/{xpNeeded}</span>
              </div>
              <div className="relative h-2 bg-stone-800/80 rounded-full overflow-hidden">
                <div className="absolute inset-0 rounded-full" style={{ background: 'linear-gradient(90deg, #ea580c, #f97316, #fbbf24)', width: `${xpPct}%`, boxShadow: '0 0 8px rgba(249,115,22,0.5)' }} />
                <div className="absolute inset-0 rounded-full opacity-30" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)', width: `${xpPct}%` }} />
              </div>
            </div>
          </div>
          {/* Spoils — premium pill */}
          <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-950/40 to-stone-900/60 rounded-lg px-4 py-2 border border-yellow-700/30" style={{ boxShadow: '0 0 12px rgba(250,204,21,0.08)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24"><path d="M12 2 L15 9 L22 9 L17 14 L19 21 L12 17 L5 21 L7 14 L2 9 L9 9 Z" fill="#facc15" opacity="0.9" style={{ filter: 'drop-shadow(0 0 3px rgba(250,204,21,0.4))' }}/></svg>
            <span className="text-base font-black text-yellow-400" style={{ textShadow: '0 0 8px rgba(250,204,21,0.3)' }}>{progression.battleSpoils}</span>
            <span className="text-[7px] text-yellow-700 font-bold tracking-widest uppercase">Spoils</span>
          </div>
        </div>
        <div className="flex gap-2 sm:gap-3 items-center flex-wrap">
          {onExit && <button onClick={onExit} className="px-5 py-2.5 bg-stone-900/60 hover:bg-stone-800 text-stone-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-stone-700/50 transition-all hover:scale-105 hover:text-stone-200">Back</button>}
          <button onClick={() => onDeploy(currentLoadout)} className="relative px-6 sm:px-10 py-2 sm:py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-[10px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] rounded-lg border border-orange-400/40 transition-all hover:scale-105 overflow-hidden" style={{ boxShadow: '0 0 16px rgba(249,115,22,0.3), 0 2px 8px rgba(0,0,0,0.4)' }}>
            <span className="relative z-10">Deploy</span>
            <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
          </button>
        </div>
      </div>

      {/* Main content — sidebar + tab area */}
      <div className="flex-1 flex overflow-hidden relative z-10 flex-col sm:flex-row">
        {/* Left sidebar — hero showcase loadout preview */}
        <div className="hidden sm:block w-72 lg:w-80 flex-shrink-0 bg-gradient-to-b from-stone-950/90 to-black/60 border-r border-orange-900/15 overflow-y-auto p-4 space-y-3" style={{ animation: 'slideRight 0.5s ease-out' }}>
          {/* Section label */}
          <div className="flex items-center gap-2 mb-1">
            <div className="h-px flex-1 bg-gradient-to-r from-orange-500/40 to-transparent" />
            <span className="text-[8px] text-orange-500/60 font-black tracking-[0.3em] uppercase">Current Loadout</span>
            <div className="h-px flex-1 bg-gradient-to-l from-orange-500/40 to-transparent" />
          </div>

          {/* Hero character showcase */}
          <div className="relative rounded-xl overflow-hidden border border-stone-800/60 bg-gradient-to-b from-stone-900/60 to-black/40" style={{ boxShadow: `0 0 20px ${CHAR_COLORS[currentLoadout.character]}10` }}>
            {/* Background glow */}
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 30%, ${CHAR_COLORS[currentLoadout.character]}15 0%, transparent 60%)` }} />
            {/* Corner brackets */}
            <div className="absolute top-1 left-1 w-4 h-4 border-t border-l border-orange-500/30" />
            <div className="absolute top-1 right-1 w-4 h-4 border-t border-r border-orange-500/30" />
            <div className="absolute bottom-1 left-1 w-4 h-4 border-b border-l border-orange-500/30" />
            <div className="absolute bottom-1 right-1 w-4 h-4 border-b border-r border-orange-500/30" />
            <div className="relative p-4 flex flex-col items-center">
              {/* Rotating glow ring behind avatar */}
              <div className="relative mb-3" style={{ animation: 'float 4s ease-in-out infinite' }}>
                <div className="absolute inset-[-12px] rounded-full border-2 border-dashed" style={{ borderColor: `${CHAR_COLORS[currentLoadout.character]}30`, animation: 'rotateRing 12s linear infinite' }} />
                <div className="absolute inset-[-6px] rounded-full" style={{ background: `radial-gradient(circle, ${CHAR_COLORS[currentLoadout.character]}20 0%, transparent 70%)` }} />
                <CharAvatar char={currentLoadout.character} size={80} />
              </div>
              <div className="text-[7px] text-stone-500 font-black tracking-[0.3em] uppercase mb-0.5">Operator</div>
              <div className="text-base font-black text-white tracking-wider">{CHARACTERS[currentLoadout.character].name}</div>
              {/* Mini stat row */}
              <div className="flex gap-3 mt-2 w-full justify-center">
                <div className="flex flex-col items-center"><span className="text-sm font-black" style={{ color: CHAR_COLORS[currentLoadout.character] }}>{CHARACTERS[currentLoadout.character].baseHp}</span><span className="text-[6px] text-stone-600 font-bold tracking-widest uppercase">HP</span></div>
                <div className="w-px h-6 bg-stone-800" />
                <div className="flex flex-col items-center"><span className="text-sm font-black" style={{ color: CHAR_COLORS[currentLoadout.character] }}>{CHARACTERS[currentLoadout.character].baseSpeed}</span><span className="text-[6px] text-stone-600 font-bold tracking-widest uppercase">SPD</span></div>
                <div className="w-px h-6 bg-stone-800" />
                <div className="flex flex-col items-center"><span className="text-sm font-black" style={{ color: CHAR_COLORS[currentLoadout.character] }}>{CHARACTERS[currentLoadout.character].baseStamina}</span><span className="text-[6px] text-stone-600 font-bold tracking-widest uppercase">STA</span></div>
              </div>
            </div>
          </div>

          {/* Primary weapon — large showcase card */}
          <div className="relative rounded-xl overflow-hidden border border-orange-900/20 bg-gradient-to-b from-stone-900/60 to-black/40 group">
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 50% 50%, ${WEAPON_COLORS[currentLoadout.primaryWeapon]}10 0%, transparent 60%)` }} />
            <div className="relative p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[7px] text-orange-500 font-black tracking-[0.3em] uppercase px-2 py-0.5 bg-orange-950/40 rounded">Primary</span>
                <span className="text-[7px] text-stone-600 font-bold tracking-widest uppercase">{WEAPONS[currentLoadout.primaryWeapon].category}</span>
              </div>
              <div className="flex items-center justify-center py-2 mb-2 bg-black/30 rounded-lg" style={{ animation: 'float 5s ease-in-out infinite' }}>
                <WeaponIcon weapon={currentLoadout.primaryWeapon} size={80} />
              </div>
              <div className="text-sm font-black text-white tracking-wider text-center mb-1">{WEAPONS[currentLoadout.primaryWeapon].name}</div>
              <div className="flex justify-center gap-3 text-[8px] text-stone-500 font-bold">
                <span>DMG <span className="text-orange-400">{WEAPONS[currentLoadout.primaryWeapon].damage}</span></span>
                <span>RPM <span className="text-orange-400">{Math.round(60000 / WEAPONS[currentLoadout.primaryWeapon].fireRate)}</span></span>
                <span>MAG <span className="text-orange-400">{WEAPONS[currentLoadout.primaryWeapon].magSize}</span></span>
              </div>
            </div>
          </div>

          {/* Secondary weapon — compact */}
          <div className="relative rounded-xl overflow-hidden border border-cyan-900/20 bg-gradient-to-b from-stone-900/60 to-black/40">
            <div className="p-3 flex items-center gap-3">
              <div className="w-16 h-12 flex items-center justify-center bg-black/30 rounded-lg flex-shrink-0">
                <WeaponIcon weapon={currentLoadout.secondaryWeapon} size={52} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[7px] text-cyan-500 font-black tracking-[0.3em] uppercase">Secondary</span>
                <div className="text-xs font-black text-white tracking-wider truncate">{WEAPONS[currentLoadout.secondaryWeapon].name}</div>
                <div className="text-[8px] text-stone-500">DMG {WEAPONS[currentLoadout.secondaryWeapon].damage} • MAG {WEAPONS[currentLoadout.secondaryWeapon].magSize}</div>
              </div>
            </div>
          </div>

          {/* Gear row — 3 compact cards with top accent bar */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <ArmorIcon type={currentLoadout.armor} size={32} />, label: ARMORS[currentLoadout.armor].name, color: '#94a3b8' },
              { icon: <GrenadeIcon type={currentLoadout.grenadeType} size={32} />, label: `x${currentLoadout.grenadeCount}`, color: '#84cc16' },
              { icon: <PerkIcon perk={currentLoadout.perk} size={32} />, label: PERKS[currentLoadout.perk].name, color: '#f59e0b' },
            ].map((g, i) => (
              <div key={i} className="relative bg-stone-900/60 rounded-lg p-2 border border-stone-800/60 flex flex-col items-center gap-1 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: g.color, opacity: 0.4 }} />
                {g.icon}
                <div className="text-[7px] text-stone-500 font-bold tracking-widest uppercase text-center truncate w-full">{g.label}</div>
              </div>
            ))}
          </div>

          {/* Career stats — with top divider */}
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-stone-800 to-transparent" />
              <span className="text-[7px] text-stone-600 font-black tracking-[0.3em] uppercase">Career</span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-stone-800 to-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: progression.totalKills, label: 'Kills', color: '#f97316' },
                { val: progression.matchesPlayed, label: 'Matches', color: '#ffffff' },
                { val: progression.totalScore, label: 'Score', color: '#fbbf24' },
                { val: progression.bestWave, label: 'Best Wave', color: '#22c55e' },
              ].map((s, i) => (
                <div key={i} className="bg-stone-900/40 rounded-lg p-2 text-center border border-stone-800/40">
                  <div className="text-xl font-black" style={{ color: s.color, textShadow: `0 0 8px ${s.color}30` }}>{s.val}</div>
                  <div className="text-[7px] text-stone-600 font-bold tracking-widest uppercase">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — tab content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab bar — premium with active glow */}
          <div className="flex gap-1 px-3 sm:px-6 pt-3 flex-shrink-0 relative overflow-x-auto scrollbar-hide">
            <div className="absolute bottom-0 left-6 right-6 h-px bg-stone-800/60" />
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)} className={`relative px-5 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-t-lg transition-all ${tab === t.key ? 'text-orange-500 bg-stone-900/60' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900/30'}`}>
                {t.label}
                {tab === t.key && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-600 to-orange-400" style={{ boxShadow: '0 0 8px rgba(249,115,22,0.5)' }} />}
              </button>
            ))}
          </div>

          {/* Tab content scroll area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {/* Weapons tab */}
          {tab === 'weapons' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger" key="weapons-grid">
              {(Object.keys(WEAPONS) as WeaponKey[]).map((key) => {
                const w = WEAPONS[key]; const unlocked = progression.unlockedWeapons.includes(key);
                const canBuy = progression.level >= w.unlockLevel && progression.battleSpoils >= w.cost;
                const isPrimary = currentLoadout.primaryWeapon === key; const isSecondary = currentLoadout.secondaryWeapon === key;
                const equipped = isPrimary || isSecondary;
                return (
                  <div key={key} className={`card-tilt relative rounded-xl border transition-all overflow-hidden ${equipped ? 'border-orange-500/50 bg-stone-900/70' : 'border-stone-800/60 bg-stone-900/40 hover:border-stone-600'} ${!unlocked ? 'opacity-60' : ''}`} style={equipped ? { boxShadow: '0 0 16px rgba(249,115,22,0.12), 0 4px 12px rgba(0,0,0,0.3)' } : { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                    {/* Corner accents */}
                    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-orange-500/20 z-10" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-orange-500/20 z-10" />
                    {/* Weapon visual header */}
                    <div className="relative h-24 bg-gradient-to-b from-stone-950/90 to-stone-900/30 flex items-center justify-center border-b border-stone-800/40 overflow-hidden">
                      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${WEAPON_COLORS[key]}18 0%, transparent 70%)` }} />
                      {/* Scanline effect on header */}
                      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 3px)' }} />
                      <div style={{ animation: 'float 4s ease-in-out infinite' }}>
                        <WeaponIcon weapon={key} size={80} />
                      </div>
                      {isPrimary && <span className="absolute top-2 right-2 text-[7px] text-orange-500 font-black tracking-widest bg-orange-950/60 px-2 py-0.5 rounded border border-orange-500/20">PRIMARY</span>}
                      {isSecondary && <span className="absolute top-2 right-2 text-[7px] text-cyan-500 font-black tracking-widest bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">SECONDARY</span>}
                      {!unlocked && <div className="absolute inset-0 bg-stone-950/70 flex flex-col items-center justify-center gap-1"><svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 2 L20 12 L12 22 L4 12 Z M12 7 L16 12 L12 17 L8 12 Z" fill="none" stroke="#52525b" strokeWidth="2"/></svg><span className="text-[8px] text-stone-600 font-black tracking-widest">LOCKED</span></div>}
                    </div>
                    {/* Weapon info */}
                    <div className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-black text-white tracking-wider">{w.name}</span>
                        <span className="text-[7px] text-stone-500 font-bold uppercase tracking-widest bg-stone-800/60 px-2 py-0.5 rounded">{w.category}</span>
                      </div>
                      <div className="space-y-1.5 mb-3">
                        <StatBar label="DMG" value={w.damage} max={maxDmg} color={WEAPON_COLORS[key]} />
                        <StatBar label="RPM" value={Math.round(60000 / w.fireRate)} max={maxRpm} color={WEAPON_COLORS[key]} />
                        <StatBar label="MAG" value={w.magSize} max={maxMag} color={WEAPON_COLORS[key]} />
                      </div>
                      {unlocked ? (
                        <div className="flex gap-2">
                          <button onClick={() => setCurrentLoadout({ ...currentLoadout, primaryWeapon: key })} className={`flex-1 px-2 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${isPrimary ? 'bg-orange-600 text-white' : 'bg-stone-800 hover:bg-stone-700 text-stone-400'}`}>Set Primary</button>
                          <button onClick={() => setCurrentLoadout({ ...currentLoadout, secondaryWeapon: key })} className={`flex-1 px-2 py-2 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all ${isSecondary ? 'bg-cyan-600 text-white' : 'bg-stone-800 hover:bg-stone-700 text-stone-400'}`}>Set Secondary</button>
                        </div>
                      ) : (<div>{progression.level >= w.unlockLevel ? <button onClick={() => buyWeapon(key)} disabled={!canBuy} className={`w-full px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${canBuy ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-stone-800 text-stone-600 cursor-not-allowed'}`}>Buy — {w.cost} Spoils</button> : <div className="text-center text-[8px] text-stone-600 font-bold tracking-widest py-2">Requires Level {w.unlockLevel}</div>}</div>)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Character tab */}
          {tab === 'character' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger" key="char-grid">
              {(Object.keys(CHARACTERS) as CharacterClass[]).map((key) => {
                const c = CHARACTERS[key]; const unlocked = progression.unlockedCharacters.includes(key);
                const selected = currentLoadout.character === key;
                return (
                  <div key={key} className={`card-tilt relative rounded-xl border transition-all overflow-hidden ${selected ? 'border-orange-500/50 bg-stone-900/70' : 'border-stone-800/60 bg-stone-900/40 hover:border-stone-600'}`} style={selected ? { boxShadow: `0 0 16px ${CHAR_COLORS[key]}20, 0 4px 12px rgba(0,0,0,0.3)` } : { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-orange-500/20 z-10" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-orange-500/20 z-10" />
                    {/* Character visual header */}
                    <div className="relative h-28 bg-gradient-to-b from-stone-950/90 to-stone-900/30 flex items-center justify-center border-b border-stone-800/40 overflow-hidden">
                      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse at center, ${CHAR_COLORS[key]}20 0%, transparent 70%)` }} />
                      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 3px)' }} />
                      <div style={{ animation: 'float 4s ease-in-out infinite' }}>
                        <CharAvatar char={key} size={80} />
                      </div>
                      {selected && <span className="absolute top-2 right-2 text-[7px] text-orange-500 font-black tracking-widest bg-orange-950/60 px-2 py-0.5 rounded border border-orange-500/20">EQUIPPED</span>}
                      {!unlocked && <div className="absolute inset-0 bg-stone-950/70 flex flex-col items-center justify-center gap-1"><svg width="20" height="20" viewBox="0 0 24 24"><path d="M12 2 L20 12 L12 22 L4 12 Z M12 7 L16 12 L12 17 L8 12 Z" fill="none" stroke="#52525b" strokeWidth="2"/></svg><span className="text-[8px] text-stone-600 font-black tracking-widest">LOCKED</span></div>}
                    </div>
                    <div className={`p-3 ${!unlocked ? 'cursor-default' : 'cursor-pointer'}`} onClick={() => unlocked && setCurrentLoadout({ ...currentLoadout, character: key })}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-black text-white tracking-wider">{c.name}</span>
                        <span className="text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded" style={{ color: CHAR_COLORS[key], background: `${CHAR_COLORS[key]}15`, border: `1px solid ${CHAR_COLORS[key]}30` }}>{c.damageMult > 1 ? 'DPS' : c.baseHp > 120 ? 'TANK' : c.baseSpeed > 7 ? 'SPEED' : 'BAL'}</span>
                      </div>
                      <p className="text-[9px] text-stone-400 mb-3 leading-relaxed">{c.description}</p>
                      <div className="space-y-1.5 mb-3">
                        <StatBar label="HP" value={c.baseHp} max={150} color={CHAR_COLORS[key]} />
                        <StatBar label="SPD" value={c.baseSpeed} max={10} color={CHAR_COLORS[key]} />
                        <StatBar label="STA" value={c.baseStamina} max={150} color={CHAR_COLORS[key]} />
                      </div>
                      {!unlocked && <div className="mt-2">{progression.level >= c.unlockLevel ? <button onClick={(e) => { e.stopPropagation(); buyCharacter(key); }} className="w-full px-3 py-2 bg-green-700 hover:bg-green-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg transition-all">Unlock — Level {c.unlockLevel}</button> : <div className="text-center text-[8px] text-stone-600 font-bold tracking-widest py-2">Requires Level {c.unlockLevel}</div>}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Armor tab */}
          {tab === 'armor' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger" key="armor-grid">
              {(Object.keys(ARMORS) as ArmorType[]).map((key) => {
                const a = ARMORS[key]; const unlocked = progression.unlockedArmors.includes(key);
                const canBuy = progression.level >= a.unlockLevel && progression.battleSpoils >= a.cost;
                const selected = currentLoadout.armor === key;
                return (
                  <div key={key} className={`card-tilt relative rounded-xl border transition-all overflow-hidden ${selected ? 'border-orange-500/50 bg-stone-900/70' : 'border-stone-800/60 bg-stone-900/40 hover:border-stone-600'}`} style={selected ? { boxShadow: '0 0 16px rgba(249,115,22,0.12), 0 4px 12px rgba(0,0,0,0.3)' } : { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-orange-500/20 z-10" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-orange-500/20 z-10" />
                    <div className="relative h-24 bg-gradient-to-b from-stone-950/90 to-stone-900/30 flex items-center justify-center border-b border-stone-800/40 overflow-hidden">
                      <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 3px)' }} />
                      <div style={{ animation: 'float 4s ease-in-out infinite' }}>
                        <ArmorIcon type={key} size={60} />
                      </div>
                      {selected && <span className="absolute top-2 right-2 text-[7px] text-orange-500 font-black tracking-widest bg-orange-950/60 px-2 py-0.5 rounded border border-orange-500/20">EQUIPPED</span>}
                    </div>
                    <div className={`p-3 ${!unlocked ? 'cursor-default' : 'cursor-pointer'}`} onClick={() => unlocked && setCurrentLoadout({ ...currentLoadout, armor: key })}>
                      <div className="flex items-center justify-between mb-2"><span className="text-sm font-black text-white tracking-wider">{a.name}</span></div>
                      <p className="text-[9px] text-stone-400 mb-3 leading-relaxed">{a.description}</p>
                      <div className="space-y-1.5 mb-3">
                        <StatBar label="HP+" value={a.hpBonus} max={100} color="#22c55e" />
                        <StatBar label="RED" value={Math.round(a.damageReduction * 100)} max={40} color="#3b82f6" suffix="%" />
                        <StatBar label="SPD" value={Math.round(a.speedMult * 100)} max={110} color="#f97316" suffix="%" />
                      </div>
                      {!unlocked && <div className="mt-2">{progression.level >= a.unlockLevel ? <button onClick={(e) => { e.stopPropagation(); buyArmor(key); }} disabled={!canBuy} className={`w-full px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${canBuy ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-stone-800 text-stone-600 cursor-not-allowed'}`}>Buy — {a.cost} Spoils</button> : <div className="text-center text-[8px] text-stone-600 font-bold tracking-widest py-2">Requires Level {a.unlockLevel}</div>}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Grenades tab */}
          {tab === 'grenades' && (
            <div key="grenades-content" style={{ animation: 'slideUp 0.3s ease-out' }}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 stagger mb-4">
                {(Object.keys(GRENADES) as GrenadeType[]).map((key) => {
                  const g = GRENADES[key]; const unlocked = progression.unlockedGrenades.includes(key);
                  const canBuy = progression.level >= g.unlockLevel && progression.battleSpoils >= g.cost;
                  const selected = currentLoadout.grenadeType === key;
                  return (
                    <div key={key} className={`card-tilt relative rounded-xl border transition-all overflow-hidden ${selected ? 'border-orange-500/50 bg-stone-900/70' : 'border-stone-800/60 bg-stone-900/40 hover:border-stone-600'}`} style={selected ? { boxShadow: '0 0 16px rgba(249,115,22,0.12), 0 4px 12px rgba(0,0,0,0.3)' } : { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-orange-500/20 z-10" />
                      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-orange-500/20 z-10" />
                      <div className="relative h-24 bg-gradient-to-b from-stone-950/90 to-stone-900/30 flex items-center justify-center border-b border-stone-800/40 overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.05]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 3px)' }} />
                        <div style={{ animation: 'float 4s ease-in-out infinite' }}>
                          <GrenadeIcon type={key} size={56} />
                        </div>
                        {selected && <span className="absolute top-2 right-2 text-[7px] text-orange-500 font-black tracking-widest bg-orange-950/60 px-2 py-0.5 rounded border border-orange-500/20">EQUIPPED</span>}
                      </div>
                      <div className={`p-3 ${!unlocked ? 'cursor-default' : 'cursor-pointer'}`} onClick={() => unlocked && setCurrentLoadout({ ...currentLoadout, grenadeType: key })}>
                        <div className="flex items-center justify-between mb-2"><span className="text-sm font-black text-white tracking-wider">{g.name}</span></div>
                        <p className="text-[9px] text-stone-400 mb-3 leading-relaxed">{g.description}</p>
                        <div className="space-y-1.5 mb-3">
                          <StatBar label="DMG" value={g.damage} max={120} color="#ef4444" />
                          <StatBar label="RAD" value={g.radius} max={10} color="#f97316" suffix="m" />
                        </div>
                        {!unlocked && <div className="mt-2">{progression.level >= g.unlockLevel ? <button onClick={(e) => { e.stopPropagation(); buyGrenade(key); }} disabled={!canBuy} className={`w-full px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${canBuy ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-stone-800 text-stone-600 cursor-not-allowed'}`}>Buy — {g.cost} Spoils</button> : <div className="text-center text-[8px] text-stone-600 font-bold tracking-widest py-2">Requires Level {g.unlockLevel}</div>}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Grenade count slider — premium */}
              <div className="relative bg-stone-900/60 rounded-xl p-4 border border-stone-800/60 flex items-center gap-4 overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-600/40 via-green-500/20 to-transparent" />
                <span className="text-[10px] text-stone-400 font-black tracking-widest uppercase">Grenade Count</span>
                <input type="range" min="1" max="5" step="1" value={currentLoadout.grenadeCount} onChange={(e) => setCurrentLoadout({ ...currentLoadout, grenadeCount: parseInt(e.target.value) })} className="flex-1 accent-orange-500" />
                <div className="flex gap-1.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`w-5 h-6 rounded-sm border transition-all ${i < currentLoadout.grenadeCount ? 'bg-green-600/60 border-green-400/40' : 'bg-stone-900 border-stone-800'}`} style={i < currentLoadout.grenadeCount ? { boxShadow: '0 0 6px rgba(34,197,94,0.2)' } : {}} />
                  ))}
                </div>
                <span className="text-orange-400 font-black text-lg w-8 text-center" style={{ textShadow: '0 0 8px rgba(249,115,22,0.3)' }}>{currentLoadout.grenadeCount}</span>
              </div>
            </div>
          )}

          {/* Upgrades tab */}
          {tab === 'upgrades' && (
            <div key="upgrades-content" style={{ animation: 'slideUp 0.3s ease-out' }}>
              {/* Weapon selector — premium pills */}
              <div className="flex gap-2 mb-4 flex-wrap">
                {(Object.keys(WEAPONS) as WeaponKey[]).filter(k => progression.unlockedWeapons.includes(k)).map((key) => (
                  <button key={key} onClick={() => setSelectedWeapon(key)} className={`flex items-center gap-2 px-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${selectedWeapon === key ? 'bg-orange-600/80 text-white border border-orange-400/40' : 'bg-stone-900/60 hover:bg-stone-800 text-stone-400 border border-stone-800'}`} style={selectedWeapon === key ? { boxShadow: '0 0 10px rgba(249,115,22,0.2)' } : {}}>
                    <WeaponIcon weapon={key} size={24} />
                    {WEAPONS[key].name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 gap-3 stagger">
                {(Object.keys(UPGRADES) as UpgradeType[]).map((uType) => {
                  const cfg = UPGRADES[uType]; const currentLevel = progression.weaponUpgrades[selectedWeapon]?.[uType] || 0;
                  const maxed = currentLevel >= cfg.maxLevel; const cost = cfg.costPerLevel * (currentLevel + 1);
                  const canBuy = !maxed && progression.battleSpoils >= cost;
                  return (
                    <div key={uType} className="relative p-4 rounded-xl border border-stone-800/60 bg-stone-900/40 flex items-center justify-between overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-orange-500/20" />
                      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-orange-500/20" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1"><span className="text-sm font-black text-white tracking-wider">{cfg.name}</span><span className="text-[8px] text-stone-500 font-bold px-2 py-0.5 bg-stone-800/60 rounded">LVL {currentLevel}/{cfg.maxLevel}</span></div>
                        <p className="text-[10px] text-stone-400 mb-2">{cfg.description}</p>
                        <div className="flex gap-1">{Array.from({ length: cfg.maxLevel }).map((_, i) => <div key={i} className={`h-2.5 flex-1 rounded-sm transition-all ${i < currentLevel ? 'bg-gradient-to-r from-orange-600 to-orange-400' : 'bg-stone-800'}`} style={i < currentLevel ? { boxShadow: '0 0 6px rgba(249,115,22,0.3)' } : {}} />)}</div>
                      </div>
                      {!maxed ? (
                        <button onClick={() => buyUpgrade(selectedWeapon, uType)} disabled={!canBuy} className={`ml-3 px-5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${canBuy ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-stone-800 text-stone-600 cursor-not-allowed'}`}>Buy — {cost}</button>
                      ) : <span className="ml-3 text-[9px] text-orange-500 font-black tracking-widest px-3 py-2.5 bg-orange-950/30 rounded-lg border border-orange-500/20">MAXED</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Perks tab */}
          {tab === 'perks' && (
            <div className="grid grid-cols-1 gap-3 stagger" key="perks-grid">
              {(Object.keys(PERKS) as PerkType[]).map((key) => {
                const p = PERKS[key];
                const unlocked = progression.unlockedPerks.includes(key) || key === 'none';
                const canBuy = !unlocked && progression.level >= p.unlockLevel && progression.battleSpoils >= p.cost;
                const equipped = currentLoadout.perk === key;
                return (
                  <div key={key} className={`relative p-4 rounded-xl border flex items-center gap-4 transition-all overflow-hidden ${equipped ? 'border-orange-500/50 bg-orange-950/20' : 'border-stone-800/60 bg-stone-900/40 hover:border-stone-600'}`} style={equipped ? { boxShadow: '0 0 16px rgba(249,115,22,0.1), 0 2px 8px rgba(0,0,0,0.2)' } : { boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-orange-500/20" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-orange-500/20" />
                    <div className="relative">
                      <div className="absolute inset-[-4px] rounded-full" style={{ background: equipped ? 'radial-gradient(circle, rgba(249,115,22,0.15) 0%, transparent 70%)' : 'none' }} />
                      <PerkIcon perk={key} size={48} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-black text-white tracking-wider">{p.name}</span>
                        {equipped && <span className="text-[7px] text-orange-500 font-black tracking-widest bg-orange-950/60 px-2 py-0.5 rounded border border-orange-500/20">EQUIPPED</span>}
                      </div>
                      <p className="text-[10px] text-stone-400">{p.description}</p>
                      {key !== 'none' && <div className="text-[8px] text-stone-500 mt-1 flex items-center gap-2"><span className="text-stone-600">Unlock:</span><span className="text-orange-500/70">Level {p.unlockLevel}</span><span className="text-stone-600">•</span><span className="text-yellow-500/70">{p.cost} Spoils</span></div>}
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {!unlocked && (
                        <button onClick={() => buyPerk(key)} disabled={!canBuy} className={`px-5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all ${canBuy ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-stone-800 text-stone-600 cursor-not-allowed'}`}>Buy — {p.cost}</button>
                      )}
                      {unlocked && !equipped && (
                        <button onClick={() => setCurrentLoadout({ ...currentLoadout, perk: key })} className="px-5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-stone-700 hover:bg-stone-600 text-white transition-all">Equip</button>
                      )}
                      {equipped && key !== 'none' && (
                        <button onClick={() => setCurrentLoadout({ ...currentLoadout, perk: 'none' })} className="px-5 py-2.5 text-[9px] font-black uppercase tracking-widest rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-400 transition-all">Unequip</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
};
