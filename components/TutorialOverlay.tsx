import React, { useState } from 'react';

interface TutorialOverlayProps {
  isMobile: boolean;
  onComplete: () => void;
}

interface TutorialStep {
  title: string;
  content: string;
  icon: string;
}

const DESKTOP_STEPS: TutorialStep[] = [
  { title: 'MOVE', content: 'Use W A S D to move. Double-tap W to auto-sprint.', icon: '⬆️' },
  { title: 'LOOK & AIM', content: 'Move mouse to look. Left-click to fire. Right-click to ADS (aim down sights).', icon: '🎯' },
  { title: 'SPRINT & SLIDE', content: 'Hold Shift to sprint. Press Ctrl while sprinting to slide.', icon: '🏃' },
  { title: 'RELOAD & WEAPONS', content: 'R to reload. 1/2 to switch weapons. G for grenades.', icon: '🔄' },
  { title: 'LEAN & CROUCH', content: 'Q/E to lean around corners. C to crouch. Space to jump.', icon: '🧎' },
  { title: 'MELEE & UTILITY', content: 'V for melee attack. F for flashlight. Tab for scoreboard.', icon: '🔪' },
];

const MOBILE_STEPS: TutorialStep[] = [
  { title: 'MOVE', content: 'Left side of screen: drag to move. Double-tap to auto-sprint.', icon: '⬆️' },
  { title: 'LOOK', content: 'Right side of screen: swipe to look around.', icon: '👀' },
  { title: 'FIRE & AIM', content: 'Bottom-right: FIRE button to shoot. SCOPE button to ADS.', icon: '🎯' },
  { title: 'GESTURES', content: 'Swipe down on look area to reload. Swipe up to jump.', icon: '📱' },
  { title: 'ACTION BUTTONS', content: 'Use the on-screen buttons for crouch, jump, reload, grenade, and melee.', icon: '🔘' },
  { title: 'READY!', content: 'You\'re all set, soldier. Good luck out there!', icon: '🎖️' },
];

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({ isMobile, onComplete }) => {
  const steps = isMobile ? MOBILE_STEPS : DESKTOP_STEPS;
  const [step, setStep] = useState(0);
  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/85 z-[70] pointer-events-auto font-mono" style={{ animation: 'fadeInScale 0.3s ease-out' }}>
      <style>{`
        @keyframes fadeInScale { 0% { opacity: 0; transform: scale(0.95); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes slideIn { 0% { opacity: 0; transform: translateX(30px); } 100% { opacity: 1; transform: translateX(0); } }
      `}</style>
      <div className="bg-stone-950/95 rounded-2xl border border-orange-500/30 p-6 max-w-sm w-full mx-4" style={{ animation: 'fadeInScale 0.4s ease-out' }}>
        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-4">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-all ${i === step ? 'bg-orange-500 w-6' : i < step ? 'bg-green-500' : 'bg-stone-700'}`} />
          ))}
        </div>

        {/* Step content */}
        <div key={step} className="text-center" style={{ animation: 'slideIn 0.3s ease-out' }}>
          <div className="text-5xl mb-3">{current.icon}</div>
          <div className="text-[10px] text-orange-500 font-black tracking-[0.5em] mb-1">CONTROLS · {step + 1}/{steps.length}</div>
          <div className="text-xl text-white font-black tracking-wider mb-3">{current.title}</div>
          <div className="text-[11px] text-stone-400 leading-relaxed mb-6">{current.content}</div>
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs font-black uppercase tracking-widest rounded-lg border border-stone-700 transition-all"
            >
              ←
            </button>
          )}
          <button
            onClick={() => isLast ? onComplete() : setStep(step + 1)}
            className="flex-1 py-2.5 bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white text-xs font-black uppercase tracking-widest rounded-lg transition-all hover:scale-105"
          >
            {isLast ? 'Deploy →' : 'Next →'}
          </button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button onClick={onComplete} className="w-full mt-2 text-[9px] text-stone-600 hover:text-stone-400 font-bold tracking-widest uppercase transition-colors">
            Skip Tutorial
          </button>
        )}
      </div>
    </div>
  );
};
