import React, { useState } from 'react';
import { PlayerProgression, MAX_LEVEL, PRESTIGE_BADGES, canPrestige, doPrestige, saveProgression } from '../engine3d/types';

interface PrestigePanelProps {
  progression: PlayerProgression;
  onProgressionChange: (p: PlayerProgression) => void;
  onClose: () => void;
}

export const PrestigePanel: React.FC<PrestigePanelProps> = ({ progression, onProgressionChange, onClose }) => {
  const [confirming, setConfirming] = useState(false);
  const eligible = canPrestige(progression);
  const playerKD = progression.totalDeaths > 0 ? progression.totalKills / progression.totalDeaths : progression.totalKills;

  const handlePrestige = () => {
    const updated = doPrestige(progression);
    saveProgression(updated);
    onProgressionChange(updated);
    setConfirming(false);
    onClose();
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-[60] pointer-events-auto font-mono" style={{ animation: 'fadeInScale 0.3s ease-out' }}>
      <style>{`
        @keyframes fadeInScale { 0% { opacity: 0; transform: scale(0.95); } } 100% { opacity: 1; transform: scale(1); } }
        @keyframes badgeGlow { 0%, 100% { box-shadow: 0 0 8px rgba(249,115,22,0.3); } 50% { box-shadow: 0 0 20px rgba(249,115,22,0.6); } }
      `}</style>
      <div className="bg-stone-950/95 rounded-2xl border border-orange-500/30 p-6 max-w-md w-full mx-4" style={{ animation: 'fadeInScale 0.4s ease-out' }}>
        <div className="text-center mb-4">
          <div className="text-[10px] text-orange-500 font-black tracking-[0.5em] mb-1">PRESTIGE</div>
          <div className="text-2xl text-white font-black tracking-wider">OPERATOR RANK</div>
        </div>

        {/* Current stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-stone-900/80 rounded-lg p-3 border border-stone-700/50 text-center">
            <div className="text-[8px] text-stone-500 font-black tracking-widest mb-1">LEVEL</div>
            <div className="text-2xl font-black text-orange-400">{progression.level}<span className="text-[10px] text-stone-500">/{MAX_LEVEL}</span></div>
          </div>
          <div className="bg-stone-900/80 rounded-lg p-3 border border-stone-700/50 text-center">
            <div className="text-[8px] text-stone-500 font-black tracking-widest mb-1">PRESTIGE</div>
            <div className="text-2xl font-black text-yellow-400">{progression.prestige.level}</div>
          </div>
        </div>

        {/* Prestige badges */}
        <div className="mb-4">
          <div className="text-[8px] text-stone-500 font-black tracking-widest mb-2">EARNED BADGES</div>
          <div className="flex flex-wrap gap-2">
            {PRESTIGE_BADGES.map((badge, i) => {
              const earned = i < progression.prestige.level;
              return (
                <div
                  key={i}
                  className={`w-10 h-10 rounded-lg border flex items-center justify-center text-xl transition-all ${earned ? 'bg-orange-900/30 border-orange-500/40' : 'bg-stone-900/50 border-stone-800 opacity-30'}`}
                  style={earned ? { animation: 'badgeGlow 2s ease-in-out infinite', animationDelay: `${i * 0.2}s` } : {}}
                >
                  {badge}
                </div>
              );
            })}
          </div>
        </div>

        {/* Career stats */}
        <div className="bg-stone-900/80 rounded-lg p-3 border border-stone-700/50 mb-4">
          <div className="text-[8px] text-stone-500 font-black tracking-widest mb-2">CAREER STATS</div>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex justify-between"><span className="text-stone-500">Total Kills:</span><span className="text-stone-300 font-bold">{progression.totalKills.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Headshots:</span><span className="text-stone-300 font-bold">{progression.totalHeadshots.toLocaleString()}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Matches:</span><span className="text-stone-300 font-bold">{progression.matchesPlayed}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Best Wave:</span><span className="text-stone-300 font-bold">{progression.bestWave}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">K/D Ratio:</span><span className="text-green-400 font-bold">{Math.round(playerKD * 100) / 100}</span></div>
            <div className="flex justify-between"><span className="text-stone-500">Melee Kills:</span><span className="text-stone-300 font-bold">{progression.totalMeleeKills}</span></div>
          </div>
        </div>

        {/* Prestige action */}
        {eligible ? (
          confirming ? (
            <div className="text-center">
              <div className="text-[10px] text-red-400 font-bold mb-3">⚠ This will reset your level to 1 but keep all career stats and weapon kills. You'll earn +1000 Spoils and a new badge.</div>
              <div className="flex gap-3">
                <button onClick={() => setConfirming(false)} className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs font-black uppercase tracking-widest rounded-lg border border-stone-700 transition-all">Cancel</button>
                <button onClick={handlePrestige} className="flex-1 py-2.5 bg-gradient-to-r from-yellow-600 to-orange-500 hover:from-yellow-500 hover:to-orange-400 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all hover:scale-105">Prestige Now!</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirming(true)} className="w-full py-3 bg-gradient-to-r from-yellow-600 to-orange-500 hover:from-yellow-500 hover:to-orange-400 text-white text-xs font-black uppercase tracking-[0.3em] rounded-lg transition-all hover:scale-105" style={{ animation: 'badgeGlow 2s ease-in-out infinite' }}>
              ⭐ PRESTIGE AVAILABLE — CLICK TO ASCEND
            </button>
          )
        ) : (
          <div className="text-center text-[10px] text-stone-500">
            Reach level <span className="text-orange-400 font-bold">{MAX_LEVEL}</span> to prestige. You need <span className="text-orange-400 font-bold">{MAX_LEVEL - progression.level}</span> more levels.
          </div>
        )}

        <button onClick={onClose} className="w-full mt-3 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs font-black uppercase tracking-widest rounded-lg border border-stone-700 transition-all">← Back</button>
      </div>
    </div>
  );
};
