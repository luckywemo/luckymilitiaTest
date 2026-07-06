
import React, { useEffect, useRef, useState, useCallback } from 'react';
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

const Minimap: React.FC<{ playerPos: { x: number, y: number, rotation: number }, entities: any[], playerTeam: 'alpha' | 'bravo' }> = ({ playerPos, entities, playerTeam }) => {
  const mapSize = 2000;
  const uiSize = typeof window !== 'undefined' && window.innerWidth < 1024 ? 80 : 120;
  const scale = uiSize / mapSize;

  return (
    <div className={`relative bg-black/80 border-2 border-stone-800 rounded-full overflow-hidden shadow-2xl backdrop-blur-md pointer-events-none group`} style={{ width: uiSize, height: uiSize }}>
      {/* Grid background */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>

      {/* Radar Sweep Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-orange-500/10 to-orange-500/30 rounded-full animate-[spin_4s_linear_infinite] origin-center opacity-40"></div>

      {/* Crosshairs */}
      <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/5"></div>
      <div className="absolute left-1/2 top-0 w-[1px] h-full bg-white/5"></div>

      {/* Entities */}
      {entities.map((e, i) => {
        const isEnemy = e.team !== playerTeam;
        const color = isEnemy ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : (e.team === 'alpha' ? 'bg-orange-400' : 'bg-cyan-400');
        return (
          <div
            key={i}
            className={`absolute w-1 h-1 rounded-full transition-all duration-100 ${color}`}
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

const VictoryOverlay: React.FC<{ kills: number, points: number, onNext: () => void, onExit: () => void, isMP?: boolean, winner?: string, failed?: boolean }> = ({ kills, points, onNext, onExit, isMP, winner, failed }) => (
  <div className="fixed inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-4 lg:p-8 z-[5000] animate-in fade-in duration-700">
    <div className={`tactical-panel max-w-lg w-full p-6 lg:p-12 bg-stone-900 border-2 ${failed ? 'border-red-600' : 'border-orange-500'} rounded-2xl lg:rounded-3xl text-center shadow-[0_0_100px_rgba(249,115,22,0.3)]`}>
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

      <div className="grid grid-cols-2 gap-2 lg:gap-4 mb-6 lg:mb-10">
        <div className="bg-black/60 p-3 lg:p-4 rounded border border-stone-800">
          <div className="text-[8px] lg:text-[10px] text-stone-500 font-black uppercase mb-1">UNITS_RETIRED</div>
          <div className="text-xl lg:text-3xl font-stencil text-white">{kills}</div>
        </div>
        <div className="bg-black/60 p-3 lg:p-4 rounded border border-stone-800">
          <div className="text-[8px] lg:text-[10px] text-stone-500 font-black uppercase mb-1">COMMAND_SCORE</div>
          <div className="text-xl lg:text-3xl font-stencil text-orange-500">{points}</div>
        </div>
      </div>

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

const FloatingStick: React.FC<{
  side: 'left' | 'right';
  onDown?: () => void;
  onMove: (x: number, y: number) => void;
  onEnd: () => void;
}> = ({ side, onDown, onMove, onEnd }) => {
  const [active, setActive] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointerId = useRef<number | null>(null);
  const radius = window.innerWidth < 640 ? 45 : 75;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (pointerId.current !== null) return;

    // Lock the pointer to this element for reliable dragging
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);

    pointerId.current = e.pointerId;
    setOrigin({ x: e.clientX, y: e.clientY });
    setKnob({ x: 0, y: 0 });
    setActive(true);

    if (onDown) onDown();
  };

  const handlePointerMove = useCallback((e: PointerEvent) => {
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
    onMove(dx / radius, dy / radius);
  }, [origin, onMove, radius]);

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (e.pointerId !== pointerId.current) return;

    const target = e.currentTarget as HTMLElement;
    if (target && typeof target.releasePointerCapture === 'function') {
      target.releasePointerCapture(e.pointerId);
    }

    pointerId.current = null;
    setActive(false);
    onEnd();
  }, [onEnd]);

  useEffect(() => {
    if (active) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [active, handlePointerMove, handlePointerUp]);

  return (
    <div
      onPointerDown={handlePointerDown}
      className={`absolute top-0 bottom-0 w-1/2 touch-none pointer-events-auto z-[4000] ${side === 'left' ? 'left-0' : 'right-0'}`}
    >
      {active && (
        <div className="fixed pointer-events-none z-[4001]" style={{ left: origin.x - radius, top: origin.y - radius }}>
          <div className="rounded-full border-2 border-white/20 bg-black/60 backdrop-blur-md flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.5)]" style={{ width: radius * 2, height: radius * 2 }}>
            <div className="bg-orange-500/80 rounded-full shadow-[0_0_15px_#f97316]" style={{ width: radius * 0.8, height: radius * 0.8, transform: `translate(${knob.x}px, ${knob.y}px)` }}></div>
          </div>
        </div>
      )}
    </div>
  );
};


import { useBlockchainStats } from '../utils/blockchain';

const GameContainer: React.FC<Props> = ({ playerName, characterClass, avatar, roomId, isHost, gameMode, mission, mpConfig, squad, activeAddress, audioEnabled, difficultyModifier, virtualControlsEnabled, onExit, onMissionComplete, onNextLevel }) => {
  const address = activeAddress;
  const { recordKill, recordWin, syncStats } = useBlockchainStats();
  const prevKillsRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);

  const gameRef = useRef<Phaser.Game | null>(null);
  const [stats, setStats] = useState<any>({
    hp: 100, maxHp: 100, shield: 100, ammo: 0, maxAmmo: 0, weaponKey: 'pistol', weaponName: 'SIDEARM', isInfinite: true, abilityCooldown: 0, kills: 0, targetKills: 0, targetValue: 0, points: 0, teamScores: { alpha: 0, bravo: 0 }, mode: 'MISSION', isOver: false, playerPos: { x: 1000, y: 1000, rotation: 0 }, entities: [], lives: 3, maxLives: 3, survivalTimer: 0, collectedItems: 0
  });
  const [victoryData, setVictoryData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('INITIALIZING_SYSTEMS...');
  const keysPressed = useRef(new Set<string>());

  const updateVirtualInput = useCallback((data: any) => {
    const scene = gameRef.current?.scene.getScene('MainScene') as any;
    if (scene?.virtualInput) Object.assign(scene.virtualInput, data);
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
      setLoadingProgress(100);
      setLoadingMessage('SYSTEMS_ONLINE');
      setTimeout(() => setIsLoading(false), 300);
    };

    // Listen for Phaser scene ready event
    window.addEventListener('SCENE_READY', handleSceneReady);

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

    const onComplete = (e: any) => {
      setVictoryData(e.detail);
      onMissionComplete();

      // Record game results on-chain if wallet connected and mission was successful
      if (address && !e.detail.failed) {
        console.log("SYNCING FINAL MISSION RESULTS FOR:", address);
        // Consolidate kills and win status in a single transaction at the end
        // Pass 'true' for silent sync to use session-based invisible signing
        syncStats(e.detail.kills || 0, 1, gameMode, true);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].includes(e.code)) {
        e.preventDefault();
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
  }, [playerName, characterClass, avatar, roomId, isHost, gameMode, mission, mpConfig, squad, audioEnabled, difficultyModifier, onMissionComplete, updateMovementFromKeys, updateVirtualInput]);

  useEffect(() => {
    const interval = setInterval(() => {
      if ((window as any).gameStats) {
        const newStats = { ...(window as any).gameStats };

        // REMOVED: No longer recording individual kills on-chain during gameplay
        // to prevent frequent signature interruptions. 
        // We will sync total results at the end of the mission.

        prevKillsRef.current = newStats.kills;

        if (gameMode === 'mission') {
          console.log('Lives update:', { lives: newStats.lives, maxLives: newStats.maxLives, mission: newStats.mode });
        }
        setStats(newStats);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [gameMode, address, recordKill]);

  const playerTeam = squad.find(m => m.name === playerName)?.team || 'alpha';
  const showVirtualControls = virtualControlsEnabled || window.innerWidth < 1024;

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
        />
      )}

      {/* TACTICAL HUD OVERLAY */}
      <div className={`fixed inset-0 pointer-events-none p-2 lg:p-12 flex flex-col justify-between z-[4500] ${stats.isOver ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500`}>

        {/* Top Section */}
        <div className="flex justify-between items-start animate-in fade-in slide-in-from-top-6 duration-700">
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
                  <div className="text-right border-l border-white/10 pl-4">
                    <div className="text-[6px] lg:text-[10px] text-stone-500 font-black">OBJECTIVE</div>
                    {stats.mode === 'SURVIVAL' ? (
                      <div className={`text-[10px] lg:text-lg font-black ${stats.survivalTimer <= 10 ? 'text-red-500 animate-pulse' : 'text-white'}`}>
                        SURVIVE: {stats.survivalTimer}s
                      </div>
                    ) : stats.mode === 'EXTRACTION' ? (
                      <div className="text-[10px] lg:text-lg font-black text-white">
                        INTEL: {stats.collectedItems} / {stats.targetValue}
                      </div>
                    ) : (
                      <div className="text-[10px] lg:text-lg font-black text-white">
                        KILLS: {stats.kills} / {stats.targetValue}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1 lg:space-y-5">
              <HUDBar label="HULL" value={stats.hp} max={stats.maxHp} color="bg-orange-500" glowColor="rgba(249,115,22,0.6)" />
              <HUDBar label="SHIELD" value={stats.shield} max={100} color="bg-cyan-400" glowColor="rgba(34,211,238,0.6)" />
            </div>
          </div>

          <div className="flex flex-col items-end gap-4">
            <Minimap playerPos={stats.playerPos} entities={stats.entities} playerTeam={playerTeam} />
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
            <button
              onPointerDown={() => updateVirtualInput({ isAbility: true })}
              onPointerUp={() => updateVirtualInput({ isAbility: false })}
              className={`w-10 h-10 lg:w-24 lg:h-24 rounded-lg lg:rounded-3xl border font-black flex flex-col items-center justify-center transition-all ${stats.abilityCooldown > 0 ? 'bg-stone-900/80 border-stone-800 text-stone-700' : 'bg-orange-600 border-orange-400 text-white active:scale-90'}`}
            >
              <span className="text-[5px] lg:text-[10px] uppercase font-black">Boost</span>
              <span className="text-[8px] lg:text-2xl font-stencil leading-none">{stats.abilityCooldown > 0 ? 'WAIT' : 'READY'}</span>
            </button>
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
              <div className="flex items-baseline justify-end gap-1 lg:gap-3">
                <span className="text-xl lg:text-6xl font-stencil text-white leading-none">{stats.isInfinite ? '♾️' : stats.ammo}</span>
              </div>
            </div>
            <button onClick={onExit} className="bg-red-600 text-white px-4 lg:px-12 py-2 lg:py-5 text-[6px] lg:text-[12px] font-black tracking-widest pointer-events-auto transition-all uppercase rounded border-b-2 border-red-900 active:translate-y-1 active:border-b-0 shadow-2xl">Abort</button>
          </div>
        </div>
      </div>

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
