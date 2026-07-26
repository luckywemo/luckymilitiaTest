import React from 'react';
import { PlayerProgression, WeeklyChallengeState, getWeekStart, getWeeklyChallenges } from '../engine3d/types';

interface WeeklyChallengesProps {
  progression: PlayerProgression;
  onClose: () => void;
}

export const WeeklyChallenges: React.FC<WeeklyChallengesProps> = ({ progression, onClose }) => {
  const currentWeek = getWeekStart();
  let weeklyState = progression.weeklyChallenges;
  if (weeklyState.weekStart !== currentWeek) {
    weeklyState = { weekStart: currentWeek, challenges: getWeeklyChallenges() };
  }

  const totalReward = weeklyState.challenges.reduce((sum, c) => sum + (c.completed ? c.challenge.reward : 0), 0);
  const completedCount = weeklyState.challenges.filter(c => c.completed).length;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/95 z-[60] pointer-events-auto font-mono overflow-y-auto py-8" style={{ animation: 'fadeInScale 0.3s ease-out' }}>
      <style>{`
        @keyframes fadeInScale { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes slideIn { 0% { opacity: 0; transform: translateY(15px); } 100% { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div className="bg-stone-950/95 rounded-2xl border border-blue-500/30 p-4 sm:p-6 max-w-md w-full mx-4" style={{ animation: 'fadeInScale 0.4s ease-out' }}>
        <div className="text-center mb-4">
          <div className="text-[10px] text-blue-400 font-black tracking-[0.5em] mb-1">WEEKLY</div>
          <div className="text-2xl text-white font-black tracking-wider">CHALLENGES</div>
          <div className="text-[10px] text-stone-500 mt-1">
            <span className="text-green-400 font-bold">{completedCount}/{weeklyState.challenges.length}</span> completed · 
            <span className="text-yellow-400 font-bold"> +{totalReward} XP</span> earned
          </div>
        </div>

        <div className="space-y-3 mb-4">
          {weeklyState.challenges.map((c, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 border transition-all ${c.completed ? 'bg-green-900/20 border-green-600/40' : 'bg-stone-900/80 border-stone-700/50'}`}
              style={{ animation: `slideIn 0.3s ease-out ${i * 0.1}s both` }}
            >
              <div className="flex justify-between items-center mb-2">
                <span className={`text-[11px] font-bold ${c.completed ? 'text-green-400 line-through' : 'text-stone-300'}`}>
                  {c.challenge.description}
                </span>
                <span className="text-[10px] text-yellow-400 font-black whitespace-nowrap ml-2">+{c.challenge.reward}</span>
              </div>
              <div className="w-full h-2 bg-stone-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${c.completed ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${Math.min(100, (c.progress / c.challenge.target) * 100)}%` }}
                />
              </div>
              <div className="text-[8px] text-stone-600 text-right mt-1">
                {c.progress.toLocaleString()} / {c.challenge.target.toLocaleString()}
                {c.completed && ' ✓'}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs font-black uppercase tracking-widest rounded-lg border border-stone-700 transition-all"
        >
          ← Back
        </button>
      </div>
    </div>
  );
};
