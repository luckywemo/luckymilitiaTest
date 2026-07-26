import React, { useState } from 'react';
import { LOGIN_REWARDS, PlayerProgression, claimLoginReward, saveProgression } from '../engine3d/types';

interface DailyRewardsProps {
  progression: PlayerProgression;
  onProgressionChange: (p: PlayerProgression) => void;
  onClose: () => void;
}

export const DailyRewards: React.FC<DailyRewardsProps> = ({ progression, onProgressionChange, onClose }) => {
  const [claimedReward, setClaimedReward] = useState<{ spoils: number; day: number } | null>(null);
  const today = new Date().toDateString();
  const canClaim = progression.loginStreak.lastClaimed !== today;
  const currentStreak = progression.loginStreak.currentStreak;

  const handleClaim = () => {
    const { progression: updated, reward } = claimLoginReward(progression);
    if (reward) {
      saveProgression(updated);
      onProgressionChange(updated);
      setClaimedReward(reward);
    }
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/90 z-[60] pointer-events-auto font-mono" style={{ animation: 'fadeInScale 0.3s ease-out' }}>
      <style>{`
        @keyframes fadeInScale { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes rewardPop { 0% { opacity: 0; transform: scale(0.5) translateY(20px); } 50% { transform: scale(1.2) translateY(-10px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes dayGlow { 0%, 100% { box-shadow: 0 0 8px rgba(249,115,22,0.3); } 50% { box-shadow: 0 0 24px rgba(249,115,22,0.6); } }
      `}</style>
      <div className="bg-stone-950/95 rounded-2xl border border-orange-500/30 p-6 max-w-md w-full mx-4" style={{ animation: 'fadeInScale 0.4s ease-out' }}>
        <div className="text-center mb-4">
          <div className="text-[10px] text-orange-500 font-black tracking-[0.5em] mb-1">DAILY REWARDS</div>
          <div className="text-2xl text-white font-black tracking-wider">LOGIN STREAK</div>
          <div className="text-[10px] text-stone-500 mt-1">Current streak: <span className="text-orange-400 font-bold">{currentStreak} days</span> · Total logins: <span className="text-stone-300">{progression.loginStreak.totalLogins}</span></div>
        </div>

        {claimedReward ? (
          <div className="text-center py-8" style={{ animation: 'rewardPop 0.5s ease-out' }}>
            <div className="text-6xl mb-3">🎁</div>
            <div className="text-xl font-black text-orange-400 mb-1">DAY {claimedReward.day} CLAIMED!</div>
            <div className="text-3xl font-black text-yellow-400 mb-4">+{claimedReward.spoils} SPOILS</div>
            <button
              onClick={onClose}
              className="px-8 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all hover:scale-105"
            >
              Continue →
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-1.5 mb-4">
              {LOGIN_REWARDS.map((r, i) => {
                const isPast = i < currentStreak;
                const isToday = i === currentStreak;
                const isFuture = i > currentStreak;
                return (
                  <div
                    key={r.day}
                    className={`rounded-lg p-2 text-center border transition-all ${
                      isPast ? 'bg-green-900/30 border-green-600/40' :
                      isToday && canClaim ? 'bg-orange-900/40 border-orange-500' :
                      isToday ? 'bg-stone-800/50 border-stone-600' :
                      'bg-stone-900/50 border-stone-800'
                    }`}
                    style={isToday && canClaim ? { animation: 'dayGlow 2s ease-in-out infinite' } : {}}
                  >
                    <div className={`text-[8px] font-black tracking-wider ${isPast ? 'text-green-500' : isToday ? 'text-orange-400' : 'text-stone-600'}`}>
                      D{r.day}
                    </div>
                    <div className={`text-[10px] font-black mt-0.5 ${isPast ? 'text-green-400' : isToday ? 'text-orange-300' : 'text-stone-500'}`}>
                      {r.spoils}
                    </div>
                    {isPast && <div className="text-[8px] text-green-500 mt-0.5">✓</div>}
                    {isToday && canClaim && <div className="text-[8px] text-orange-400 mt-0.5">●</div>}
                  </div>
                );
              })}
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs font-black uppercase tracking-widest rounded-lg border border-stone-700 transition-all"
              >
                Later
              </button>
              <button
                onClick={handleClaim}
                disabled={!canClaim}
                className="flex-1 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 disabled:from-stone-800 disabled:to-stone-800 disabled:text-stone-600 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all hover:scale-105 disabled:scale-100"
              >
                {canClaim ? 'Claim Reward' : 'Claimed ✓'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
