
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Phaser from 'phaser';
import { createGame } from '../game/main';
import { GameMode, CharacterClass, MissionConfig, MPConfig } from '../App';
import { WEAPONS_CONFIG } from '../game/scenes/MainScene';


interface Props {
  playerName: string;
  characterClass: CharacterClass;
  avatar: string | null;
  roomId: string | null;
  isHost: boolean;
  gameMode: GameMode;
  mission?: MissionConfig;
  mpConfig?: MPConfig;
  squad: { name: string, team: 'alpha' | 'bravo' }[];
  activeAddress?: string;
  audioEnabled: boolean;
  difficultyModifier: number;
  virtualControlsEnabled: boolean;
  onExit: () => void;
  onMissionComplete: () => void;
  onNextLevel: () => void;
}

const WEAPON_LIST = Object.values(WEAPONS_CONFIG);

const LOADING_TIPS = [
  'HOLD SHIFT TO BOOST THROUGH HOSTILE ZONES',
  'ELIMINATE HOSTILES TO COMPLETE THE SECTOR',
  'CYAN CRATES CONTAIN WEAPON DROPS — KEEP AN EYE OUT',
  'AIM FOR HEADSHOTS TO MAXIMIZE COMMAND SCORE',
  'TAKE COVER BEHIND WALLS IN URBAN RUINS'
];

const HUDBar: React.FC<{ value: number, max: number, color: string, label: string, glowColor: string }> = ({ value, max, color, label, glowColor }) => {
  const percent = Math.max(0, Math.min(1, value / max));
  return (
    <div className="space-y-0.5 lg:space-y-1 w-full">
      <div className="flex justify-between text-[5px] lg:text-[8px] font-black uppercase tracking-widest text-white/50 px-0.5">
        <span>{label}</span>
      </div>
      <div className="h-1 lg:h-3 bg-black/90 border border-white/10 p-[0.5px] lg:p-[1px] relative rounded-sm overflow-hidden shadow-inner">
        <div
          className={`h-full transition-all duration-300 ${color} rounded-sm`}
          style={{
            width: `${percent * 100}%`,
            boxShadow: percent > 0 ? `0 0 10px ${glowColor}` : 'none'
          }}
        />
      </div>
    </div>
  );
};

const Minimap: React.FC<{ playerPos: { x: number, y: number, rotation: number }, entities: any[], objectives?: any[], playerTeam: 'alpha' | 'bravo' }> = ({ playerPos, entities, objectives = [], playerTeam }) => {
  const mapSize = 2000;
  const uiSize = typeof window !== 'undefined' && window.innerWidth < 1024 ? 80 : 120;
  const scale = uiSize / mapSize;

  return (
    <div className={`relative bg-black/80 border-2 border-stone-800 rounded-full overflow-hidden shadow-2xl backdrop-blur-md pointer-events-none group`} style={{ width: uiSize, height: uiSize }}>
      {/* Map border / arena outline */}
      <div className="absolute inset-[4px] border border-white/5 rounded-full"></div>

      {/* Grid background */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>

      {/* Radar Sweep Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-orange-500/10 to-orange-500/30 rounded-full animate-[spin_4s_linear_infinite] origin-center opacity-40"></div>

      {/* Crosshairs */}
      <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/5"></div>
      <div className="absolute left-1/2 top-0 w-[1px] h-full bg-white/5"></div>

      {/* Objective zones */}
      {objectives.map((obj, i) => {
        const color = obj.type === 'hardpoint' ? 'bg-white/30 shadow-[0_0_8px_#f97316]' : 'bg-purple-500/40 shadow-[0_0_8px_#a855f7]';
        return (
          <div key={`obj-${i}`} className={`absolute w-2 h-2 lg:w-3 lg:h-3 rounded-sm ${color}`} style={{ left: `${obj.x * scale}px`, top: `${obj.y * scale}px`, transform: 'translate(-50%, -50%)' }} />
        );
      })}

      {/* Entities */}
      {entities.map((e, i) => {
        const isEnemy = e.team !== playerTeam;
        const isBot = !e.type;
        const color = isEnemy ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : (e.team === 'alpha' ? 'bg-orange-400' : 'bg-cyan-400');
        const shape = isBot ? 'rounded-full' : 'rounded-sm';
        return (
          <div
            key={i}
            className={`absolute w-1.5 h-1.5 lg:w-2 lg:h-2 ${shape} transition-all duration-100 ${color}`}
            style={{
              left: `${e.x * scale}px`,
              top: `${e.y * scale}px`,
              transform: 'translate(-50%, -50%)'
            }}
          />
        );
      })}

      {/* Player Self */}
      <div
        className="absolute w-1.5 h-1.5 lg:w-2 lg:h-2 bg-green-400 shadow-[0_0_10px_#4ade80] rounded-sm"
        style={{
          left: `${playerPos.x * scale}px`,
          top: `${playerPos.y * scale}px`,
          transform: `translate(-50%, -50%) rotate(${playerPos.rotation}rad)`
        }}
      >
        <div className="absolute top-[-3px] lg:top-[-4px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[2px] lg:border-l-[3px] border-l-transparent border-r-[2px] lg:border-r-[3px] border-r-transparent border-b-[4px] lg:border-b-[5px] border-b-green-400"></div>
      </div>

      <div className="absolute bottom-0.5 lg:bottom-1 w-full text-center text-[5px] lg:text-[6px] font-black text-white/20 uppercase tracking-[0.1em] lg:tracking-[0.2em]">Scanner</div>
    </div>
  );
};

const VictoryOverlay: React.FC<{
  kills: number; points: number; onNext: () => void; onExit: () => void;
  isMP?: boolean; winner?: string; failed?: boolean;
  stats?: any; leaderboard?: any[] | null; syncError?: string | null; onRetrySync?: () => void;
}> = ({ kills, points, onNext, onExit, isMP, winner, failed, stats, leaderboard, syncError, onRetrySync }) => {
  const time = stats?.missionTime ?? 0;
  const shotsFired = stats?.shotsFired ?? 0;
  const shotsHit = stats?.shotsHit ?? 0;
  const accuracy = shotsFired > 0 ? Math.round((shotsHit / shotsFired) * 100) : 0;
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 lg:p-8 z-[5000] animate-in fade-in duration-700">
      <div className={`tactical-panel max-w-lg w-full p-6 lg:p-10 bg-stone-900 border-2 ${failed ? 'border-red-600' : 'border-orange-500'} rounded-2xl lg:rounded-3xl text-center shadow-[0_0_100px_rgba(249,115,22,0.3)]`}>
        <div className="mission-pulse mb-4 lg:mb-8 relative h-14 w-14 lg:h-20 lg:w-20 mx-auto bg-orange-600 rounded-lg overflow-hidden flex items-center justify-center shadow-[0_0_50px_rgba(249,115,22,0.6)]">
          <div className="absolute inset-0 flex items-center justify-center">{failed ? '💀' : <img src="/logo.jpg" alt="Victory" className="w-full h-full object-cover" />}</div>
        </div>
        <h2 className={`text-xl sm:text-2xl lg:text-4xl font-black font-stencil uppercase italic mb-2 tracking-wider lg:tracking-widest drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] ${failed ? 'text-red-500' : 'text-white'}`}>
          {failed ? 'MISSION_FAILED' : (isMP ? `${winner}_VICTORY` : 'MISSION_COMPLETE')}
        </h2>
        <div className={`h-px w-full bg-gradient-to-r from-transparent via-${failed ? 'red' : 'orange'}-500/50 to-transparent my-4 lg:my-6`}></div>

        {failed && (
          <div className="text-red-500/80 text-[10px] lg:text-sm font-black tracking-widest uppercase mb-6 animate-pulse">
            Operator_Life_Signs_Lost
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 lg:gap-4 mb-4 lg:mb-6">
          <div className="bg-black/60 p-3 lg:p-4 rounded border border-stone-800">
            <div className="text-[8px] lg:text-[10px] text-stone-500 font-black uppercase mb-1">UNITS_RETIRED</div>
            <div className="text-xl lg:text-3xl font-stencil text-white">{kills}</div>
          </div>
          <div className="bg-black/60 p-3 lg:p-4 rounded border border-stone-800">
            <div className="text-[8px] lg:text-[10px] text-stone-500 font-black uppercase mb-1">COMMAND_SCORE</div>
            <div className="text-xl lg:text-3xl font-stencil text-orange-500">{points}</div>
          </div>
        </div>

        {stats && (
          <div className="grid grid-cols-3 gap-2 mb-4 lg:mb-6">
            <div className="bg-black/40 p-2 rounded border border-stone-800">
              <div className="text-[6px] lg:text-[9px] text-stone-500 font-black uppercase">ACCURACY</div>
              <div className="text-sm lg:text-xl font-stencil text-cyan-400">{accuracy}%</div>
            </div>
            <div className="bg-black/40 p-2 rounded border border-stone-800">
              <div className="text-[6px] lg:text-[9px] text-stone-500 font-black uppercase">TIME</div>
              <div className="text-sm lg:text-xl font-stencil text-white">{Math.floor(time / 60)}:{(time % 60).toString().padStart(2, '0')}</div>
            </div>
            <div className="bg-black/40 p-2 rounded border border-stone-800">
              <div className="text-[6px] lg:text-[9px] text-stone-500 font-black uppercase">SHOTS FIRED</div>
              <div className="text-sm lg:text-xl font-stencil text-white">{shotsFired}</div>
            </div>
          </div>
        )}

        {leaderboard && leaderboard.length > 0 && (
          <div className="bg-black/60 rounded border border-stone-800 p-2 lg:p-3 mb-4 lg:mb-6 text-left">
            <div className="text-[8px] lg:text-[10px] text-stone-500 font-black uppercase mb-1 lg:mb-2">LEADERBOARD PREVIEW</div>
            {leaderboard.slice(0, 5).map((entry: any, i: number) => (
              <div key={i} className="flex justify-between text-[9px] lg:text-xs py-1 border-b border-stone-800/50 last:border-0">
                <span className="text-stone-300 truncate mr-2">{i + 1}. {entry.username || entry.address?.slice(0, 12) || 'UNKNOWN'}</span>
                <span className="font-stencil text-orange-400">{Math.round(entry.score || 0)}</span>
              </div>
            ))}
          </div>
        )}

        {syncError && !failed && (
          <div className="mb-4 lg:mb-6 bg-red-950/60 border border-red-600/40 p-3 rounded text-left">
            <div className="text-[8px] lg:text-[10px] text-red-400 font-black uppercase mb-1 flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              {syncError}
            </div>
            {onRetrySync && (
              <button onClick={onRetrySync} className="mt-2 w-full py-2 bg-red-600 text-white text-[9px] lg:text-[10px] font-black uppercase tracking-widest rounded hover:bg-red-500 active:scale-95">
                RETRY ON-CHAIN SYNC
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2 lg:gap-3">
          {!isMP && !failed && (
            <button
              onClick={onNext}
              className="w-full py-3 lg:py-5 bg-white text-stone-950 font-black text-[10px] lg:text-xs uppercase tracking-widest rounded-lg lg:rounded-xl hover:bg-orange-500 hover:text-white transition-all shadow-xl active:scale-95"
            >
              PROCEED_TO_NEXT_SECTOR
            </button>
          )}
          {failed && (
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 lg:py-5 bg-red-600 text-white font-black text-[10px] lg:text-xs uppercase tracking-widest rounded-lg lg:rounded-xl hover:bg-red-500 transition-all shadow-xl active:scale-95"
            >
              RETRY_SIMULATION
            </button>
          )}
          <button
            onClick={onExit}
            className="w-full py-2.5 lg:py-4 bg-stone-800 text-stone-400 font-black text-[9px] lg:text-[10px] uppercase tracking-widest rounded-lg lg:rounded-xl border border-stone-700 hover:text-white transition-all active:scale-95"
          >
            RETURN_TO_COMMAND_HQ
          </button>
          {!failed && (
            <button
              onClick={() => {
                const msg = [
                  `🎖️ MISSION COMPLETE — Lucky Militia`,
                  ``,
                  `▸ Units Retired: ${kills}`,
                  `▸ Command Score: ${points} pts`,
                  `▸ Accuracy: ${accuracy}%`,
                  ``,
                  `Tactical multiplayer combat on Base & Celo. On-chain stats. No luck required — just skill.`,
                  ``,
                  `Deploy now 👇`,
                  `https://lucky-militial.vercel.app`,
                  ``,
                  `#LuckyMilitia #Web3Gaming #Celo #Base #OnChain`
                ].join('\n');
                window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              className="w-full py-2 lg:py-4 bg-orange-600/20 text-orange-400 font-black text-[9px] lg:text-[10px] uppercase tracking-widest rounded-lg lg:rounded-xl border border-orange-500/30 hover:bg-orange-600 hover:text-white transition-all active:scale-95 mt-2 flex items-center justify-center gap-2"
            >
              <svg className="w-3 h-3 lg:w-4 lg:h-4 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              SHARE_VICTORY_INTEL
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const FloatingStick: React.FC<{
  side: 'left' | 'right';
  onDown?: () => void;
  onMove: (x: number, y: number) => void;
  onEnd: () => void;
}> = ({ side, onDown, onMove, onEnd }) => {
  const [active, setActive] = useState(false);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);
  const baseRef = useRef<HTMLDivElement>(null);
  const radius = typeof window !== 'undefined' && window.innerWidth < 640 ? 48 : 72;
  const deadzone = radius * 0.18;

  const origin = useMemo(() => {
    const pad = 20;
    const W = typeof window !== 'undefined' ? window.innerWidth : 0;
    const H = typeof window !== 'undefined' ? window.innerHeight : 0;
    const x = side === 'left' ? pad + radius : W - pad - radius;
    const y = H - pad - radius;
    return { x, y };
  }, [side, radius]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (pointerId.current !== null) return;
    e.preventDefault();
    baseRef.current?.setPointerCapture(e.pointerId);
    pointerId.current = e.pointerId;
    setActive(true);
    if (onDown) onDown();
  };

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return;
    let dx = e.clientX - origin.x;
    let dy = e.clientY - origin.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > radius) {
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * radius;
      dy = Math.sin(angle) * radius;
    }
    setKnob({ x: dx, y: dy });
    const nx = dist > deadzone ? dx / radius : 0;
    const ny = dist > deadzone ? dy / radius : 0;
    onMove(nx, ny);
  }, [origin, onMove, radius, deadzone]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== pointerId.current) return;
    e.preventDefault();
    baseRef.current?.releasePointerCapture(e.pointerId);
    pointerId.current = null;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onEnd();
  }, [onEnd]);

  const size = radius * 2;
  return (
    <div
      ref={baseRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`fixed touch-none pointer-events-auto select-none z-[4000] rounded-full border-2 border-white/10 bg-black/30 backdrop-blur-sm flex items-center justify-center transition-transform duration-100 active:scale-95`}
      style={{ left: origin.x - radius, top: origin.y - radius, width: size, height: size, touchAction: 'none' }}
    >
      <div className="absolute rounded-full border border-white/5" style={{ width: radius, height: radius }} />
      <div className="absolute rounded-full border-2 border-dashed border-white/10" style={{ width: deadzone * 2, height: deadzone * 2 }} />
      <div className="absolute w-2 h-2 lg:w-3 lg:h-3 bg-white/80 rounded-full shadow-[0_0_10px_#fff] transition-transform duration-75" style={{ transform: `translate(${knob.x}px, ${knob.y}px) scale(${active ? 1.3 : 1})` }} />
      {side === 'right' && active && (
        <div className="absolute -top-8 text-[8px] font-black text-white/50 uppercase tracking-widest pointer-events-none">FIRE</div>
      )}
    </div>
  );
};

const CooldownRing: React.FC<{ value: number; max: number; size: number; children?: React.ReactNode }> = ({ value, max, size, children }) => {
  const pct = Math.max(0, Math.min(1, value / (max || 1)));
  const radius = size / 2 - 4;
  const c = 2 * Math.PI * radius;
  const offset = c * (1 - pct);
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="absolute inset-0 -rotate-90" width={size} height={size} style={{ filter: 'drop-shadow(0 0 6px #f97316)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth="4" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#f97316" strokeWidth="4" fill="none" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.1s linear' }} />
      </svg>
      {children}
    </div>
  );
};

const MissionTracker: React.FC<{ stats: any; mission?: MissionConfig }> = ({ stats, mission }) => {
  const prev = useRef<number>(stats.mode === 'SURVIVAL' ? stats.survivalTimer : (stats.mode === 'EXTRACTION' ? stats.collectedItems : stats.kills));
  const [pulse, setPulse] = useState(false);
  const current = stats.mode === 'SURVIVAL' ? Math.ceil(stats.survivalTimer) : (stats.mode === 'EXTRACTION' ? stats.collectedItems : stats.kills);
  useEffect(() => {
    const previous = prev.current;
    if (current !== previous) {
      setPulse(true);
      setTimeout(() => setPulse(false), 500);
      prev.current = current;
    }
  }, [current]);
  const label = stats.mode === 'SURVIVAL' ? 'SURVIVE' : (stats.mode === 'EXTRACTION' ? 'INTEL' : 'ELIMINATION');
  const value = stats.mode === 'SURVIVAL' ? `${current}s` : `${current} / ${stats.targetValue || 1}`;
  return (
    <div className={`tactical-panel px-3 py-1.5 lg:px-8 lg:py-3 bg-black/80 border-b-2 border-orange-500 text-center transition-all duration-300 ${pulse ? 'scale-110 shadow-[0_0_30px_#f97316]' : ''}`}>
      <div className="text-[5px] lg:text-[9px] font-black text-stone-500 uppercase tracking-widest">{stats.mode}</div>
      <div className="text-xs lg:text-2xl font-stencil font-black text-white tracking-wider leading-none">
        {label} <span className="text-orange-500">{value}</span>
      </div>
      {mission && <div className="text-[4px] lg:text-[8px] text-stone-500 uppercase tracking-widest mt-0.5">{mission.name} // {mission.objective}</div>}
    </div>
  );
};

const MissionBanner: React.FC<{ banner: { title: string; subtitle: string } | null }> = ({ banner }) => {
  if (!banner) return null;
  return (
    <div className="fixed inset-0 z-[5005] flex items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-300">
      <div className="tactical-panel bg-black/90 border-2 border-orange-500/60 px-8 py-4 lg:px-20 lg:py-10 text-center shadow-[0_0_80px_rgba(249,115,22,0.25)]">
        <div className="text-[8px] lg:text-xs font-black text-orange-500 tracking-[0.3em] uppercase mb-1">Mission Start</div>
        <h2 className="text-xl lg:text-4xl font-stencil font-black text-white uppercase tracking-widest">{banner.title}</h2>
        <p className="text-[10px] lg:text-sm text-stone-300 font-bold uppercase tracking-widest mt-1 lg:mt-2">{banner.subtitle}</p>
      </div>
    </div>
  );
};

const DamageFlash: React.FC<{ angle: number | null }> = ({ angle }) => {
  if (angle === null) return null;
  return (
    <div className="fixed inset-0 z-[4600] pointer-events-none">
      <div className="absolute inset-0 bg-red-600/10" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ transform: `translate(-50%, -50%) rotate(${angle}rad)` }}>
        <div className="w-0 h-0 border-l-[10px] lg:border-l-[16px] border-r-[10px] lg:border-r-[16px] border-b-[80px] lg:border-b-[140px] border-l-transparent border-r-transparent border-b-red-500/40" style={{ filter: 'drop-shadow(0 0 20px rgba(239,68,68,0.6))' }} />
      </div>
    </div>
  );
};

const PickupPings: React.FC<{ playerPos: { x: number; y: number }; items: any[] }> = ({ playerPos, items }) => {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
  const [h, setH] = useState(typeof window !== 'undefined' ? window.innerHeight : 0);
  useEffect(() => {
    const onResize = () => { setW(window.innerWidth); setH(window.innerHeight); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  if (!items.length) return null;
  const cx = w / 2, cy = h / 2, maxR = Math.min(w, h) * 0.42;
  const colors: Record<string, string> = { luck: '#22c55e', weapon: '#22d3ee', weapon_drop: '#facc15', intel: '#8b5cf6' };
  return (
    <div className="fixed inset-0 z-[4550] pointer-events-none overflow-hidden">
      {items.filter(i => i).map((item, i) => {
        const dx = item.x - playerPos.x;
        const dy = item.y - playerPos.y;
        const angle = Math.atan2(dy, dx);
        const ex = cx + Math.cos(angle) * maxR;
        const ey = cy + Math.sin(angle) * maxR;
        const color = colors[item.type] || '#ffffff';
        return (
          <div key={i} className="absolute flex flex-col items-center" style={{ left: ex, top: ey, transform: `translate(-50%, -50%) rotate(${angle}rad)` }}>
            <div className="w-0 h-0 border-l-[6px] lg:border-l-[10px] border-r-[6px] lg:border-r-[10px] border-b-[28px] lg:border-b-[44px] border-l-transparent border-r-transparent" style={{ borderBottomColor: color }} />
            <div className="w-1.5 h-1.5 lg:w-2.5 lg:h-2.5 rounded-full mt-1" style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }} />
          </div>
        );
      })}
    </div>
  );
};

const MPBadge: React.FC<{ ping: number; peerCount: number; state: string }> = ({ ping, peerCount, state }) => (
  <div className="tactical-panel bg-black/80 px-2 py-1 lg:px-4 lg:py-2 border-b-2 border-stone-700 mb-2 text-right">
    <div className="text-[5px] lg:text-[9px] font-black text-stone-500 uppercase tracking-widest">{state === 'connected' ? 'UPLINK ACTIVE' : state === 'failed' ? 'UPLINK FAILED' : 'UPLINK'}</div>
    <div className="text-[9px] lg:text-sm font-stencil text-white leading-tight">
      PING <span className={`${ping ? 'text-orange-500' : 'text-stone-600'}`}>{ping || '--'}ms</span>
      <span className="text-stone-600 mx-1">|</span>
      PEERS <span className="text-cyan-400">{peerCount}</span>
    </div>
  </div>
);

const MPToasts: React.FC<{ toasts: any[] }> = ({ toasts }) => (
  <div className="fixed top-20 right-4 z-[4700] flex flex-col gap-2 pointer-events-none">
    {toasts.map(t => (
      <div key={t.id} className="tactical-panel bg-black/90 border-l-4 border-orange-500 px-4 py-2 text-right text-[9px] lg:text-xs font-bold text-white shadow-lg">
        <span className="uppercase tracking-wider text-stone-400 mr-2">{t.state}</span>
        {t.message}
        {t.peerCount !== undefined && <span className="text-cyan-400 ml-1">[{t.peerCount}]</span>}
      </div>
    ))}
  </div>
);

const PauseOverlay: React.FC<{ open: boolean; onResume: () => void; onExit: () => void }> = ({ open, onResume, onExit }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[6001] bg-black/85 backdrop-blur-sm flex items-center justify-center">
      <div className="tactical-panel bg-stone-900 border border-stone-700 p-6 lg:p-12 rounded-2xl max-w-sm w-full text-center space-y-3">
        <h2 className="text-2xl font-stencil font-black text-white uppercase tracking-widest">Tactical Pause</h2>
        <button onClick={onResume} className="w-full py-3 lg:py-4 bg-orange-600 text-white font-black text-xs uppercase tracking-widest rounded hover:bg-orange-500 active:scale-95">Resume</button>
        <button onClick={() => window.dispatchEvent(new CustomEvent('MUTE_MUSIC', { detail: { muted: false } }))} className="w-full py-2.5 lg:py-3 bg-stone-800 text-stone-400 font-black text-[10px] uppercase tracking-widest rounded border border-stone-700 hover:text-white active:scale-95">Audio Settings</button>
        <button onClick={onExit} className="w-full py-2.5 lg:py-3 bg-red-600/20 text-red-400 font-black text-[10px] uppercase tracking-widest rounded border border-red-600/30 hover:bg-red-600 hover:text-white active:scale-95">Exit Sector</button>
      </div>
    </div>
  );
};

const MuteToggles: React.FC<{ musicMuted: boolean; sfxMuted: boolean; onToggle: (t: 'music' | 'sfx') => void }> = ({ musicMuted, sfxMuted, onToggle }) => (
  <div className="flex gap-2 pointer-events-auto">
    <button onClick={() => onToggle('music')} className={`px-1.5 py-1 lg:px-2.5 lg:py-1.5 text-[6px] lg:text-[10px] font-black uppercase rounded border transition-all ${musicMuted ? 'bg-red-600/20 text-red-400 border-red-600/30' : 'bg-stone-800 text-stone-300 border-stone-700'}`}>
      {musicMuted ? 'MUSIC OFF' : 'MUSIC ON'}
    </button>
    <button onClick={() => onToggle('sfx')} className={`px-1.5 py-1 lg:px-2.5 lg:py-1.5 text-[6px] lg:text-[10px] font-black uppercase rounded border transition-all ${sfxMuted ? 'bg-red-600/20 text-red-400 border-red-600/30' : 'bg-stone-800 text-stone-300 border-stone-700'}`}>
      {sfxMuted ? 'SFX OFF' : 'SFX ON'}
    </button>
  </div>
);


import { useBlockchainStats } from '../utils/blockchain';

const GameContainer: React.FC<Props> = ({ playerName, characterClass, avatar, roomId, isHost, gameMode, mission, mpConfig, squad, activeAddress, audioEnabled, difficultyModifier, virtualControlsEnabled, onExit, onMissionComplete, onNextLevel }) => {
  const address = activeAddress;
  const { recordKill, recordWin, syncStats } = useBlockchainStats();
  const prevKillsRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);

  const gameRef = useRef<Phaser.Game | null>(null);
  const [stats, setStats] = useState<any>({
    hp: 100, maxHp: 100, shield: 100, ammo: 0, maxAmmo: 0, weaponKey: 'pistol', weaponName: 'SIDEARM', weaponMode: 'KINETIC // SEMI', isInfinite: true, abilityCooldown: 0, abilityMaxCooldown: 6000, kills: 0, targetKills: 0, targetValue: 0, points: 0, teamScores: { alpha: 0, bravo: 0 }, mode: 'MISSION', isOver: false, playerPos: { x: 1000, y: 1000, rotation: 0 }, entities: [], lives: 3, maxLives: 3, survivalTimer: 0, collectedItems: 0, shotsFired: 0, shotsHit: 0, missionTime: 0, missionStarted: false, ping: 0, mpPeerCount: 0, items: [], objectives: [], isPaused: false, musicMuted: false, sfxMuted: false
  });
  const [victoryData, setVictoryData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('INITIALIZING_SYSTEMS...');
  const [mpStatus, setMpStatus] = useState<{ state: string; message: string; peerCount?: number }>({ state: 'idle', message: '' });
  const [mpConnectionFailed, setMpConnectionFailed] = useState(false);
  const [mpConnectionLost, setMpConnectionLost] = useState(false);

  const [sceneReady, setSceneReady] = useState(false);
  const [missionBanner, setMissionBanner] = useState<{ title: string; subtitle: string } | null>(null);
  const [damageFlash, setDamageFlash] = useState<number | null>(null);
  const [mpToasts, setMpToasts] = useState<{ id: number; state: string; message: string; peerCount?: number }[]>([]);
  const [peerCount, setPeerCount] = useState(0);
  const [ping, setPing] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [sfxMuted, setSfxMuted] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<any[] | null>(null);

  const damageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const bannerShownRef = useRef(false);

  const keysPressed = useRef(new Set<string>());

  const updateVirtualInput = useCallback((data: any) => {
    const scene = gameRef.current?.scene.getScene('MainScene') as any;
    if (scene?.virtualInput) Object.assign(scene.virtualInput, data);
  }, []);

  const finishLoading = useCallback(() => {
    setLoadingProgress(100);
    setLoadingMessage('SYSTEMS_ONLINE');
    setSceneReady(true);
    if (tipInterval.current) clearInterval(tipInterval.current);
    setTimeout(() => setIsLoading(false), 300);
  }, []);

  const retryMpConnection = useCallback(() => {
    setMpConnectionFailed(false);
    setMpConnectionLost(false);
    setIsLoading(true);
    setLoadingProgress(40);
    setLoadingMessage('RECONNECTING TO HOST...');
    setMpStatus({ state: 'connecting', message: 'RECONNECTING...' });
    const scene = gameRef.current?.scene.getScene('MainScene') as any;
    scene?.retryMultiplayerConnection?.();
  }, []);

  const updateMovementFromKeys = useCallback(() => {
    const keys = keysPressed.current;
    let moveX = 0;
    let moveY = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) moveY -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) moveY += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;

    if (moveX !== 0 && moveY !== 0) {
      const length = Math.sqrt(moveX * moveX + moveY * moveY);
      moveX /= length;
      moveY /= length;
    }

    updateVirtualInput({ moveX, moveY });
  }, [updateVirtualInput]);

  useEffect(() => {
    let progressInterval: ReturnType<typeof setInterval>;

    const handleSceneReady = () => {
      if (progressInterval) clearInterval(progressInterval);
      setLoadingProgress(70);
      setSceneReady(true);
      if (!bannerShownRef.current && mission) {
        bannerShownRef.current = true;
        setMissionBanner({ title: mission.name, subtitle: mission.objective });
        bannerTimer.current = setTimeout(() => setMissionBanner(null), 3000);
      }
      if (gameMode === 'multiplayer' && roomId) {
        setLoadingMessage(isHost ? 'ESTABLISHING_HOST_UPLINK...' : 'SEARCHING_FOR_HOST...');
      } else {
        finishLoading();
      }
    };

    const handleMpStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      setMpStatus({
        state: detail.state || 'idle',
        message: detail.message || '',
        peerCount: detail.peerCount,
      });

      if (detail.message) {
        setMpToasts(prev => [...prev.slice(-2), { id: Date.now(), state: detail.state, message: detail.message, peerCount: detail.peerCount }]);
      }
      setPeerCount(detail.peerCount ?? 0);

      if (detail.state === 'connected') {
        setMpConnectionFailed(false);
        setMpConnectionLost(false);
        finishLoading();
      } else if (detail.state === 'failed') {
        setMpConnectionFailed(true);
        setLoadingMessage(detail.message || 'UPLINK_FAILED');
      } else if (detail.state === 'lost') {
        setMpConnectionLost(true);
      }
    };

    // Listen for Phaser scene ready event
    window.addEventListener('SCENE_READY', handleSceneReady);
    window.addEventListener('MP_CONNECTION_STATUS', handleMpStatus);

    if (containerRef.current && !gameRef.current) {
      // Fast initial progress
      setLoadingProgress(30);
      setLoadingMessage('INITIALIZING_SYSTEMS...');

      gameRef.current = createGame(containerRef.current, playerName, avatar, roomId, isHost, gameMode, characterClass, mission, mpConfig, squad);

      const scene = gameRef.current.scene.getScene('MainScene') as any;
      if (scene) {
        scene.audioEnabled = audioEnabled;
        scene.difficultyModifier = difficultyModifier;
      }
    }

    const onComplete = async (e: any) => {
      setSyncError(null);
      const finalStats = (window as any).gameStats || {};
      const detail = { ...finalStats, ...e.detail };
      setVictoryData(detail);
      onMissionComplete();

      // Record game results on-chain if wallet connected and mission was successful
      if (address && !detail.failed) {
        console.log("SYNCING FINAL MISSION RESULTS FOR:", address);
        try {
          await syncStats(detail.kills || 0, 1, gameMode === 'multiplayer', true);
        } catch (err: any) {
          console.warn('[Game] On-chain sync failed:', err);
          setSyncError(err?.message || 'On-chain sync failed. Try again from the victory screen.');
        }
      }

      // Pull a leaderboard preview for the post-mission screen
      try {
        const type = gameMode === 'multiplayer' ? 'pvp' : 'pve';
        const res = await fetch(`/api/leaderboard?limit=5&type=${type}`);
        if (res.ok) setLeaderboard(await res.json());
      } catch (e) {
        setLeaderboard(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'Escape') {
        e.preventDefault();
        setPauseOpen(prev => {
          const next = !prev;
          window.dispatchEvent(new CustomEvent('PAUSE_GAME', { detail: { paused: next } }));
          return next;
        });
        return;
      }

      keysPressed.current.add(e.code);
      if (e.code === 'Space' || e.code === 'ShiftLeft') updateVirtualInput({ isAbility: true });

      const digitMatch = e.code.match(/Digit([1-6])/);
      if (digitMatch) {
        const index = parseInt(digitMatch[1]) - 1;
        if (WEAPON_LIST[index]) {
          window.dispatchEvent(new CustomEvent('weapon_swap', { detail: { key: WEAPON_LIST[index].key } }));
        }
      }

      updateMovementFromKeys();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
      if (e.code === 'Space' || e.code === 'ShiftLeft') updateVirtualInput({ isAbility: false });
      updateMovementFromKeys();
    };

    const handleMouseMove = (e: MouseEvent) => {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const angle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
      updateVirtualInput({ aimAngle: angle });
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) updateVirtualInput({ isFiring: true });
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) updateVirtualInput({ isFiring: false });
    };

    window.addEventListener('MISSION_COMPLETE', onComplete);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('SCENE_READY', handleSceneReady);
      window.removeEventListener('MP_CONNECTION_STATUS', handleMpStatus);
      window.removeEventListener('MISSION_COMPLETE', onComplete);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      if (progressInterval) clearInterval(progressInterval);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [playerName, characterClass, avatar, roomId, isHost, gameMode, mission, mpConfig, squad, audioEnabled, difficultyModifier, onMissionComplete, updateMovementFromKeys, updateVirtualInput, finishLoading, syncStats, address]);

  // Rotate contextual tips on the loading screen
  useEffect(() => {
    if (tipInterval.current) clearInterval(tipInterval.current);
    tipInterval.current = setInterval(() => {
      setTipIndex(i => (i + 1) % LOADING_TIPS.length);
    }, 4000);
    return () => { if (tipInterval.current) clearInterval(tipInterval.current); };
  }, []);

  // Pause-game state disables input; keep React pause overlay in sync with Esc
  useEffect(() => {
    const onPauseSync = (e: Event) => setPauseOpen(!!(e as CustomEvent).detail?.paused);
    window.addEventListener('PAUSE_GAME', onPauseSync);
    return () => window.removeEventListener('PAUSE_GAME', onPauseSync);
  }, []);

  // Screen-edge directional damage flash
  useEffect(() => {
    const onDamage = (e: Event) => {
      const angle = (e as CustomEvent).detail?.angle ?? 0;
      setDamageFlash(angle);
      if (damageTimer.current) clearTimeout(damageTimer.current);
      damageTimer.current = setTimeout(() => setDamageFlash(null), 400);
    };
    window.addEventListener('PLAYER_DAMAGE', onDamage);
    return () => {
      window.removeEventListener('PLAYER_DAMAGE', onDamage);
      if (damageTimer.current) clearTimeout(damageTimer.current);
    };
  }, []);

  // Timeout if client never establishes in-game uplink
  useEffect(() => {
    if (!isLoading || gameMode !== 'multiplayer' || isHost || mpStatus.state === 'connected') return;
    const timeout = setTimeout(() => {
      setMpConnectionFailed(true);
      setLoadingMessage('HOST UPLINK TIMEOUT — COULD NOT SYNC BATTLEFIELD');
    }, 45000);
    return () => clearTimeout(timeout);
  }, [isLoading, gameMode, isHost, mpStatus.state]);

  useEffect(() => {
    const interval = setInterval(() => {
      if ((window as any).gameStats) {
        const newStats = { ...(window as any).gameStats };
        prevKillsRef.current = newStats.kills;
        if (newStats.ping !== ping) setPing(newStats.ping ?? 0);
        if (newStats.mpPeerCount !== peerCount) setPeerCount(newStats.mpPeerCount ?? 0);
        setStats(newStats);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [gameMode, address, recordKill, ping, peerCount]);

  const playerTeam = squad.find(m => m.name === playerName)?.team || 'alpha';
  const showVirtualControls = virtualControlsEnabled || window.innerWidth < 1024;
  const mpBlocked = gameMode === 'multiplayer' && !!roomId && (isLoading || mpConnectionFailed || mpConnectionLost);
  const mpStatusColor = mpStatus.state === 'connected' ? 'text-green-500 bg-green-500' :
    mpStatus.state === 'failed' || mpStatus.state === 'lost' ? 'text-red-500 bg-red-500' :
    'text-yellow-500 bg-yellow-500';

  const toggleMute = useCallback((type: 'music' | 'sfx') => {
    if (type === 'music') {
      const next = !musicMuted;
      setMusicMuted(next);
      window.dispatchEvent(new CustomEvent('MUTE_MUSIC', { detail: { muted: next } }));
    } else {
      const next = !sfxMuted;
      setSfxMuted(next);
      window.dispatchEvent(new CustomEvent('MUTE_SFX', { detail: { muted: next } }));
    }
  }, [musicMuted, sfxMuted]);

  const handleRetrySync = useCallback(async () => {
    if (!address || !victoryData || victoryData.failed) return;
    setSyncError(null);
    try {
      await syncStats(victoryData.kills || 0, 1, gameMode === 'multiplayer', true);
      const type = gameMode === 'multiplayer' ? 'pvp' : 'pve';
      const res = await fetch(`/api/leaderboard?limit=5&type=${type}`);
      if (res.ok) setLeaderboard(await res.json());
    } catch (err: any) {
      setSyncError(err?.message || 'On-chain sync retry failed.');
    }
  }, [address, victoryData, gameMode, syncStats]);

  return (
    <div className="relative w-full h-full bg-[#0c0a09] overflow-hidden font-mono text-stone-100 touch-none flex flex-col">
      <div ref={containerRef} className="absolute inset-0 cursor-crosshair z-0" />

      {/* Loading Screen */}
      {isLoading && (
        <div className="fixed inset-0 bg-[#050505] z-[6000] flex flex-col items-center justify-center p-4 lg:p-8">
          <div className="w-full max-w-md space-y-4 lg:space-y-8">
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 lg:gap-4 mb-6 lg:mb-12">
              <div className="w-10 h-10 lg:w-16 lg:h-16 bg-orange-600 rounded-lg flex items-center justify-center animate-pulse shadow-[0_0_40px_rgba(249,115,22,0.5)] overflow-hidden">
                <img src="/logo.jpg" alt="Lucky Militia" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="text-orange-500 text-[10px] lg:text-sm font-black tracking-[0.3em] lg:tracking-[0.5em] uppercase">LUCKY_MILITIA</div>
                <div className="text-stone-600 text-[8px] lg:text-[10px] font-bold tracking-widest">TACTICAL_DEPLOYMENT</div>
              </div>
            </div>

            {/* Loading Message */}
            <div className="text-center">
              <div className="text-orange-500 text-[10px] lg:text-xs font-black tracking-wider lg:tracking-widest animate-pulse mb-2 lg:mb-4">
                {loadingMessage}
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-1 lg:space-y-2">
              <div className="h-1.5 lg:h-2 bg-stone-900 rounded-full overflow-hidden border border-stone-800">
                <div
                  className="h-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(249,115,22,0.5)]"
                  style={{ width: `${loadingProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[8px] lg:text-[10px] font-black text-stone-600 uppercase tracking-widest">
                <span>PROGRESS</span>
                <span>{loadingProgress}%</span>
              </div>
            </div>

            {/* Contextual Tip */}
            <div className="text-center min-h-[3rem] flex items-center justify-center">
              <div className="text-cyan-400 text-[9px] lg:text-xs font-black tracking-widest uppercase animate-pulse">
                ▸ {LOADING_TIPS[tipIndex % LOADING_TIPS.length]}
              </div>
            </div>

            {/* Animated Dots */}
            <div className="flex justify-center gap-1.5 lg:gap-2 pt-4 lg:pt-8">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 lg:w-2 lg:h-2 bg-orange-500 rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {victoryData && (
        <VictoryOverlay
          kills={victoryData.kills ?? stats.kills}
          points={victoryData.points ?? stats.points}
          onNext={onNextLevel}
          onExit={onExit}
          isMP={gameMode === 'multiplayer'}
          winner={victoryData.winner}
          failed={victoryData.failed}
          stats={victoryData}
          leaderboard={leaderboard}
          syncError={syncError}
          onRetrySync={handleRetrySync}
        />
      )}

      {/* TACTICAL HUD OVERLAY */}
      <div className={`fixed inset-0 pointer-events-none p-2 lg:p-12 flex flex-col justify-between z-[4500] ${stats.isOver ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}>

        {/* Top Section */}
        <div className="relative flex justify-between items-start animate-in fade-in slide-in-from-top-6 duration-700">
          <div className="tactical-panel bg-black/60 p-2 lg:p-6 border-l-2 lg:border-l-4 border-orange-500 rounded-r min-w-[140px] lg:min-w-[320px] backdrop-blur-md shadow-2xl overflow-hidden">
            <div className="flex justify-between items-start mb-1 lg:mb-4">
              <div>
                <span className="text-[5px] lg:text-[10px] font-black uppercase text-orange-500/80 tracking-widest">{stats.mode}</span>
                <div className="text-[10px] lg:text-2xl font-black font-stencil text-white leading-tight">{playerName}</div>
              </div>
              {gameMode === 'mission' && (
                <div className="flex gap-4">
                  <div className="text-right">
                    <div className="text-[6px] lg:text-[10px] text-stone-500 font-black uppercase">Lives</div>
                    <div className="flex gap-1">
                      {Array.from({ length: stats.maxLives }).map((_, i) => (
                        <span key={i} className={`text-[10px] lg:text-lg ${i < stats.lives ? 'text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'text-stone-800'}`}>❤️</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1 lg:space-y-5">
              <HUDBar label="HULL" value={stats.hp} max={stats.maxHp} color="bg-orange-500" glowColor="rgba(249,115,22,0.6)" />
              <HUDBar label="SHIELD" value={stats.shield} max={100} color="bg-cyan-400" glowColor="rgba(34,211,238,0.6)" />
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 top-0 z-[4600]">
            <MissionTracker stats={stats} mission={mission} />
          </div>

          <div className="flex flex-col items-end gap-2 lg:gap-4">
            <MuteToggles musicMuted={musicMuted} sfxMuted={sfxMuted} onToggle={toggleMute} />
            {gameMode === 'multiplayer' && <MPBadge ping={ping} peerCount={peerCount} state={mpStatus.state} />}
            <Minimap playerPos={stats.playerPos} entities={stats.entities} objectives={stats.objectives} playerTeam={playerTeam} />
            {gameMode === 'multiplayer' && (
              <div className="flex gap-1 lg:gap-4 animate-in fade-in zoom-in duration-300">
                <div className="tactical-panel bg-black/80 px-4 py-2 border-b-2 border-orange-500 rounded flex flex-col items-center backdrop-blur-md">
                  <span className="text-[7px] font-black text-orange-500 uppercase tracking-tighter">ALPHA</span>
                  <span className="text-xl font-stencil text-white">{stats.teamScores.alpha}</span>
                </div>
                <div className="tactical-panel bg-black/80 px-4 py-2 border-b-2 border-cyan-500 rounded flex flex-col items-center backdrop-blur-md">
                  <span className="text-[7px] font-black text-cyan-500 uppercase tracking-tighter">BRAVO</span>
                  <span className="text-xl font-stencil text-white">{stats.teamScores.bravo}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="flex justify-between items-end animate-in fade-in slide-in-from-bottom-6 duration-700">
          <div className="flex flex-col gap-2 lg:gap-6 items-start pointer-events-auto">
            <div
              onPointerDown={() => updateVirtualInput({ isAbility: true })}
              onPointerUp={() => updateVirtualInput({ isAbility: false })}
              className={`rounded-full lg:rounded-3xl border-2 font-black flex items-center justify-center transition-all active:scale-90 ${stats.abilityCooldown > 0 ? 'border-stone-700 text-stone-500' : 'border-orange-500 text-white'}`}
            >
              <CooldownRing value={Math.max(0, stats.abilityMaxCooldown - stats.abilityCooldown)} max={stats.abilityMaxCooldown} size={typeof window !== 'undefined' && window.innerWidth < 1024 ? 60 : 110}>
                <div className="flex flex-col items-center pointer-events-none">
                  <span className="text-[5px] lg:text-[10px] uppercase font-black">Boost</span>
                  <span className="text-[8px] lg:text-2xl font-stencil leading-none">{stats.abilityCooldown > 0 ? Math.ceil(stats.abilityCooldown / 1000) : 'READY'}</span>
                </div>
              </CooldownRing>
            </div>
            <div className="flex gap-1 bg-black/40 p-1 rounded-lg border border-white/5 backdrop-blur-sm overflow-x-auto max-w-[35vw]">
              {WEAPON_LIST.map((w, idx) => (
                <button
                  key={w.key}
                  onClick={() => window.dispatchEvent(new CustomEvent('weapon_swap', { detail: { key: w.key } }))}
                  className={`relative w-8 h-8 lg:w-14 lg:h-14 rounded-md lg:rounded-xl border flex-shrink-0 flex items-center justify-center text-sm lg:text-2xl transition-all ${stats.weaponKey === w.key ? 'bg-white text-black border-white' : 'bg-black/60 border-stone-800 text-stone-600'}`}
                >
                  {w.icon}
                  <span className="absolute bottom-0 right-1 text-[6px] lg:text-[10px] font-black opacity-30">{idx + 1}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-end gap-2 lg:gap-8">
            <div className="tactical-panel bg-black/80 p-2 lg:p-8 rounded-l-xl lg:rounded-l-3xl border-r-2 lg:border-r-[12px] border-white text-right min-w-[100px] lg:min-w-[220px] shadow-2xl backdrop-blur-xl">
              <span className="text-[5px] lg:text-[11px] font-black text-stone-500 mb-0.5 lg:mb-2 block uppercase tracking-widest">{stats.weaponName}</span>
              <span className="text-[5px] lg:text-[10px] font-black text-stone-500 uppercase tracking-widest">{stats.weaponMode || 'KINETIC // SEMI'}</span>
              <div className="flex items-baseline justify-end gap-1 lg:gap-3">
                <span className="text-xl lg:text-6xl font-stencil text-white leading-none">{stats.isInfinite ? '♾️' : stats.ammo}</span>
                <span className="text-[8px] lg:text-sm text-stone-500 font-stencil self-end pb-1 lg:pb-2">/ {stats.maxAmmo}</span>
              </div>
            </div>
            <button
              onClick={onExit}
              disabled={!sceneReady}
              className={`bg-red-600 text-white px-4 lg:px-12 py-2 lg:py-5 text-[6px] lg:text-[12px] font-black tracking-widest pointer-events-auto transition-all uppercase rounded border-b-2 border-red-900 active:translate-y-1 active:border-b-0 shadow-2xl ${!sceneReady ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-500'}`}
            >
              {sceneReady ? 'Abort' : 'WARPING...'}
            </button>
          </div>
        </div>
      </div>

      <MissionBanner banner={missionBanner} />
      <DamageFlash angle={damageFlash} />
      <PickupPings playerPos={stats.playerPos} items={stats.items} />
      <MPToasts toasts={mpToasts} />
      <PauseOverlay open={pauseOpen} onResume={() => { setPauseOpen(false); window.dispatchEvent(new CustomEvent('PAUSE_GAME', { detail: { paused: false } })); }} onExit={onExit} />

      {!stats.isOver && showVirtualControls && (
        <div className="absolute inset-0 pointer-events-none z-[4000]">
          <FloatingStick
            side="left"
            onMove={(x, y) => updateVirtualInput({ moveX: x, moveY: y })}
            onEnd={() => updateVirtualInput({ moveX: 0, moveY: 0 })}
          />
          <FloatingStick
            side="right"
            onDown={() => updateVirtualInput({ isFiring: true })}
            onMove={(x, y) => {
              const dist = Math.sqrt(x * x + y * y);
              if (dist > 0.1) {
                updateVirtualInput({ aimAngle: Math.atan2(y, x), isFiring: true });
              }
            }}
            onEnd={() => updateVirtualInput({ isFiring: false })}
          />
        </div>
      )}
    </div>
  );
};

export default GameContainer;
