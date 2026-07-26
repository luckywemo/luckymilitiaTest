import React, { useState, useEffect, useRef } from 'react';
import { storage } from './utils/storage';
import Lobby from './components/Lobby';
import GameContainer from './components/GameContainer';
import CreativeSuite from './components/CreativeSuite';
import VibeAssistant from './components/VibeAssistant';
import { Game3D } from './engine3d/Game3D';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, useAccount } from 'wagmi';
import { KitProvider } from '@0xsequence/kit';
import '@0xsequence/kit/styles.css';


export type AppState = 'boot' | 'wallet-auth' | 'onboarding' | 'lobby' | 'playing' | 'labs' | '3d-proto';

export type GameMode = 'bot' | 'multiplayer' | 'mission';
export type CharacterClass = 'STRIKER' | 'GHOST' | 'TITAN';
export type MPMatchMode = 'TDM' | 'FFA' | 'HARDPOINT' | '1V1';
export type MPMap = 'URBAN_RUINS' | 'THE_PIT' | 'OUTPOST_X';

export interface MPConfig {
  mode: MPMatchMode;
  map: MPMap;
  alphaBots: number;
  bravoBots: number;
  scoreLimit: number;
  mapSeed: string;
  hostPeerId?: string;
}

export type MissionType = 'ELIMINATION' | 'SURVIVAL' | 'EXTRACTION';

export interface MissionConfig {
  id: number;
  name: string;
  objective: string;
  type: MissionType;
  targetValue: number; // Kills / Seconds / Items
  difficulty: number;
  coords: { x: number; y: number };
}

const MISSIONS: MissionConfig[] = [
  // TUTORIAL
  { id: 0, name: "PROTOCOL_ZERO", objective: "Calibrate neural link and combat systems.", type: 'ELIMINATION', targetValue: 3, difficulty: 0.5, coords: { x: 5, y: 15 } },

  // SECTOR 1: THE OUTSKIRTS
  { id: 1, name: "ALPHA_PROTOCOL", objective: "Clear local sector of rogue drones.", type: 'ELIMINATION', targetValue: 5, difficulty: 1, coords: { x: 15, y: 25 } },
  { id: 2, name: "NEON_SCARE", objective: "Eliminate reinforced security units.", type: 'ELIMINATION', targetValue: 10, difficulty: 2, coords: { x: 25, y: 40 } },
  { id: 3, name: "PERIMETER_DEFENSE", objective: "Survive the hostile wave.", type: 'SURVIVAL', targetValue: 60, difficulty: 2, coords: { x: 35, y: 20 } },
  { id: 4, name: "SUPPLY_RUN", objective: "Secure Data Drives from the area.", type: 'EXTRACTION', targetValue: 3, difficulty: 2, coords: { x: 20, y: 60 } },

  // SECTOR 2: URBAN DECAY
  { id: 5, name: "STREET_SWEEPER", objective: "Neutralize significant resistance.", type: 'ELIMINATION', targetValue: 25, difficulty: 3, coords: { x: 50, y: 45 } },
  { id: 6, name: "BLACKOUT", objective: "Survive in low-vis conditions.", type: 'SURVIVAL', targetValue: 120, difficulty: 3, coords: { x: 60, y: 30 } },
  { id: 7, name: "DATA_HEIST", objective: "Extract intel under heavy fire.", type: 'EXTRACTION', targetValue: 5, difficulty: 4, coords: { x: 65, y: 65 } },
  { id: 8, name: "ELITE_HUNT", objective: "Eliminate High-Value Targets.", type: 'ELIMINATION', targetValue: 3, difficulty: 4, coords: { x: 55, y: 80 } },

  // SECTOR 3: THE CORE
  { id: 9, name: "VOID_STRIKE", objective: "Survive the Void incursion.", type: 'SURVIVAL', targetValue: 180, difficulty: 5, coords: { x: 80, y: 35 } },
  { id: 10, name: "OMNI_CORE", objective: "Total system purge initiated.", type: 'ELIMINATION', targetValue: 50, difficulty: 5, coords: { x: 90, y: 50 } },
  { id: 11, name: "SYSTEM_CRASH", objective: "Recover Core fragments.", type: 'EXTRACTION', targetValue: 10, difficulty: 6, coords: { x: 85, y: 75 } },
  { id: 12, name: "FINAL_JUDGEMENT", objective: "Defeat the Overlord forces.", type: 'ELIMINATION', targetValue: 100, difficulty: 7, coords: { x: 95, y: 90 } },
];

const BootSequence: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [glitch, setGlitch] = useState(false);

  const bootLogs = [
    "> INITIALIZING MULTICHAIN_LINK_V1...",
    "> SYNCING BASE_NETWORK SMART CONTRACTS...",
    "> LOADING ASSET_HUMAN_MODELS_01...",
    "> CALIBRATING HUD_VISOR_OVERLAY...",
    "> VERIFYING ENCRYPTION_KEYS...",
    "> UPLINK SUCCESSFUL. WELCOME OPERATOR."
  ];

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      if (current < bootLogs.length) {
        setLogs(prev => [...prev, bootLogs[current]]);
        current++;
        if (Math.random() > 0.8) {
          setGlitch(true);
          setTimeout(() => setGlitch(false), 50);
        }
      } else {
        clearInterval(interval);
        setTimeout(onComplete, 1200);
      }
    }, 120);
    return () => clearInterval(interval);
  }, [onComplete]);

  return (
    <div className={`flex-1 flex flex-col items-center justify-center bg-[#050505] p-3 sm:p-6 lg:p-10 font-mono relative overflow-hidden transition-all duration-75 ${glitch ? 'invert scale-[1.01] brightness-150' : ''}`}>
      <div className="absolute inset-0 z-0">
        <img src="/og-image.png" alt="" className="w-full h-full object-cover opacity-40" />
      </div>
      <div className="w-full max-w-2xl space-y-3 sm:space-y-6 lg:space-y-10 relative z-10 bg-black/40 p-4 sm:p-8 rounded-2xl backdrop-blur-md border border-white/5">
        <div className="flex items-center gap-3 sm:gap-5 lg:gap-8 mb-4 sm:mb-8 lg:mb-16 animate-in fade-in slide-in-from-top-10 duration-700">
          <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-32 lg:h-32 bg-orange-600 rounded-lg flex items-center justify-center animate-bounce shadow-[0_0_50px_rgba(249,115,22,0.6)] border-2 border-white/20 overflow-hidden">
            <img src="/og-image.png" alt="Lucky Militia" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="text-orange-500 text-xs sm:text-base lg:text-lg font-black tracking-[0.3em] sm:tracking-[0.5em] lg:tracking-[0.8em] uppercase mb-1 drop-shadow-lg">LUCKY_MILITIA</div>
            <div className="text-stone-500 text-[8px] sm:text-[9px] lg:text-[10px] font-bold tracking-[0.2em] sm:tracking-[0.3em] lg:tracking-[0.4em] uppercase opacity-70">Multichain_Tactical_Terminal_v4.0</div>
          </div>
        </div>

        <div className="space-y-2 sm:space-y-3 lg:space-y-4 bg-black/60 p-3 sm:p-6 lg:p-10 border border-stone-800 rounded-xl lg:rounded-2xl min-h-[140px] sm:min-h-[220px] lg:min-h-[340px] flex flex-col justify-end backdrop-blur-xl shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"></div>
          {logs.map((log, i) => (
            <div key={i} className="text-stone-300 text-[9px] sm:text-[10px] lg:text-[11px] font-bold tracking-wider lg:tracking-widest border-l-2 border-orange-600 pl-2 sm:pl-3 lg:pl-5 animate-in slide-in-from-left-4 duration-200">
              <span className="text-orange-500/40 mr-2 sm:mr-3 lg:mr-4 font-black">[{new Date().toLocaleTimeString('en-GB')}]</span>
              {log}
            </div>
          ))}
          {logs.length < bootLogs.length && (
            <div className="w-2 h-3 sm:h-4 bg-orange-500 animate-pulse ml-1 shadow-[0_0_10px_#f97316]"></div>
          )}
        </div>

        <div className="pt-3 sm:pt-6 lg:pt-10">
          <div className="flex justify-between text-[8px] sm:text-[9px] lg:text-[10px] font-black text-stone-600 uppercase tracking-wider lg:tracking-widest mb-2 lg:mb-3">
            <span>Terminal_Sync</span>
            <span>{Math.floor((logs.length / bootLogs.length) * 100)}%</span>
          </div>
          <div className="w-full h-1 sm:h-1.5 bg-stone-900 overflow-hidden rounded-full border border-stone-800 p-px">
            <div className="h-full bg-orange-600 transition-all duration-300 shadow-[0_0_15px_rgba(249,115,22,0.5)]" style={{ width: `${(logs.length / bootLogs.length) * 100}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AccountSetupScreen: React.FC<{ address: string; onComplete: (name: string, charClass: CharacterClass) => void }> = ({ address, onComplete }) => {
  const [username, setUsername] = useState('');
  const [charClass, setCharClass] = useState<CharacterClass>('STRIKER');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setUsername: setOnChainUsername } = useBlockchainStats();
  const [error, setError] = useState<string | null>(null);

  const handleInitialize = async () => {
    if (username.length < 3 || username.length > 16) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const timeout = new Promise<void>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
      await Promise.race([setOnChainUsername(username), timeout]);
    } catch (e: any) {
      console.warn('[Setup] Registration sync pending:', e?.message || e);
      setError('Network sync pending — proceeding offline.');
    } finally {
      onComplete(username, charClass);
    }
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#050505] p-3 sm:p-6 lg:p-10 font-mono relative overflow-hidden">
      <div className="w-full max-w-2xl space-y-8 relative z-10 bg-black/60 p-8 rounded-2xl border border-white/5 backdrop-blur-xl shadow-2xl">
        <div className="text-center space-y-2">
          <h2 className="text-2xl lg:text-3xl font-black font-stencil text-white uppercase italic tracking-widest">INITIALIZE_OPERATOR</h2>
          <p className="text-[10px] lg:text-xs text-stone-500 font-bold uppercase tracking-widest">Nexus_Access_Protocol_v4.0</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest px-1">Codename_Selection</label>
            <input 
              value={username}
              onChange={e => setUsername(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
              placeholder="ENTER_CODENAME"
              maxLength={16}
              className="w-full bg-black/80 border border-stone-800 p-4 text-xl font-black text-white rounded outline-none focus:border-orange-500 transition-all placeholder:text-stone-800"
            />
            <div className="text-[8px] text-stone-600 font-bold uppercase flex justify-between px-1">
              <span>3-16 Characters // Alphanumeric</span>
              <span>{username.length}/16</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black text-orange-500 uppercase tracking-widest px-1">Unit_Specialization</label>
            <div className="grid grid-cols-3 gap-3">
              {(['STRIKER', 'GHOST', 'TITAN'] as CharacterClass[]).map(c => (
                <button 
                  key={c}
                  onClick={() => setCharClass(c)}
                  className={`py-3 border rounded-lg transition-all flex flex-col items-center gap-1 ${charClass === c ? 'bg-orange-600 border-orange-400 text-white' : 'bg-stone-900/50 border-stone-800 text-stone-600'}`}
                >
                  <span className="text-lg">{c === 'STRIKER' ? '⚔️' : c === 'GHOST' ? '🕶️' : '🛡️'}</span>
                  <span className="text-[8px] font-black">{c}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <button 
          disabled={username.length < 3 || isSubmitting}
          onClick={handleInitialize}
          className="w-full py-5 bg-white disabled:bg-stone-900 disabled:text-stone-700 text-stone-950 font-black text-base uppercase tracking-widest rounded-xl transition-all hover:bg-orange-600 hover:text-white active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.1)] flex items-center justify-center gap-4"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-stone-800 border-t-white rounded-full animate-spin"></div>
              <span>CONFIGURING_UPLINK...</span>
            </>
          ) : 'INITIALIZE_COMMAND_LINK'}
        </button>

        {error && (
          <p className="text-orange-400 text-[9px] font-bold uppercase tracking-wider text-center animate-in fade-in duration-300">{error}</p>
        )}
      </div>
    </div>
  );
};

import { useBlockchainStats } from './utils/blockchain';

const AppContent: React.FC = () => {
  const [view, setView] = useState<AppState>('boot');
  const [address, setAddress] = useState<string | null>(null);
  const { getStats, hasFunds } = useBlockchainStats();
  const { address: web3Address, isConnected } = useAccount();

  const [fallbackId] = useState('OPERATOR_' + Math.floor(Math.random() * 9999));
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [difficultyModifier, setDifficultyModifier] = useState(1);
  const [virtualControlsEnabled, setVirtualControlsEnabled] = useState(false);
  const [playerName, setPlayerName] = useState(fallbackId);
  
  useEffect(() => {
    const checkUser = async () => {
      if (isConnected && web3Address) {
        setAddress(web3Address);
        const stats = await getStats(web3Address);
        const localName = storage.getItem('lm_username');
        const hasValidName = (stats?.username && stats.username !== 'OPERATOR' && stats.username !== 'ROOKIE') || (localName && localName !== 'OPERATOR');

        if (hasValidName) {
          setPlayerName(stats?.username || localName || playerName);
        } else if (view === 'lobby') {
          setView('onboarding');
        }
      } else if (!isConnected) {
        setAddress(null);
      }
    };
    checkUser();
  }, [isConnected, web3Address, view]); // Added view to dependencies to trigger onboarding when entering lobby

  const [characterClass, setCharacterClass] = useState<CharacterClass>('STRIKER');
  const [avatar, setAvatar] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>('mission');
  const [unlockedLevel, setUnlockedLevel] = useState(0);
  const [activeLevelId, setActiveLevelId] = useState(0);
  const [squad, setSquad] = useState<{ name: string, team: 'alpha' | 'bravo' }[]>([]);
  const [mpConfig, setMpConfig] = useState<MPConfig | null>(null);

  const [currentTrack, setCurrentTrack] = useState(0);
  const PLAYLIST = [
    '/assets/audio/bg-music.mp3',
    '/assets/audio/track-2.wav',
    '/assets/audio/track-3.wav',
    '/assets/audio/track-4.wav',
    '/assets/audio/track-5.wav'
  ];

  useEffect(() => {
    const isPlaying = view === 'playing';

    if (audioEnabled && view !== 'boot' && !isPlaying) {
      if (!bgMusicRef.current) {
        bgMusicRef.current = new Audio(PLAYLIST[currentTrack]);
        bgMusicRef.current.volume = 0.05;
        
        // When track ends or errors (file missing), go to next track
        const nextTrack = () => setCurrentTrack(prev => (prev + 1) % PLAYLIST.length);
        bgMusicRef.current.onended = nextTrack;
        bgMusicRef.current.onerror = nextTrack;
      }

      bgMusicRef.current.play().catch(() => {
        // Autoplay blocked by browser until user interaction
      });
    } else {
      if (bgMusicRef.current) {
        bgMusicRef.current.pause();
      }
    }
  }, [audioEnabled, view, currentTrack]);

  // When track index changes, load new audio
  useEffect(() => {
    if (bgMusicRef.current) {
      const wasPlaying = !bgMusicRef.current.paused;
      bgMusicRef.current.src = PLAYLIST[currentTrack];
      bgMusicRef.current.load();
      if (wasPlaying && audioEnabled && view !== 'boot' && view !== 'playing') {
        bgMusicRef.current.play().catch(() => {});
      }
    }
  }, [currentTrack]);

  const startCombat = (room: string | null, host: boolean, mode: GameMode, levelId?: number, squadMembers?: { name: string, team: 'alpha' | 'bravo' }[], mpSettings?: MPConfig) => {
    setRoomId(room);
    setIsHost(host);
    setGameMode(mode);
    if (squadMembers) setSquad(squadMembers);
    if (levelId) setActiveLevelId(levelId || 1);
    if (mpSettings) setMpConfig(mpSettings);
    setView('playing');
  };

  const onMissionComplete = () => {
    if (activeLevelId === unlockedLevel) {
      setUnlockedLevel(prev => Math.min(prev + 1, MISSIONS.length));
    }
  };

  const nextLevel = () => {
    if (!hasFunds && address) {
        setView('lobby');
        return;
    }

    const nextId = activeLevelId + 1;
    if (nextId <= MISSIONS.length) {
      setActiveLevelId(nextId);
      setView('lobby');
      setTimeout(() => setView('playing'), 50);
    } else {
      setView('lobby');
    }
  };

  return (
    <div className="bg-[#050505] text-stone-100 font-mono selection:bg-orange-500/30 flex flex-col relative" style={{ height: '100dvh', overflow: view === 'lobby' || view === 'labs' || view === 'onboarding' ? 'auto' : 'hidden' }}>
      {view !== 'playing' && view !== '3d-proto' && <VibeAssistant />}
      <main className="relative flex-1 flex flex-col">
        {view === 'boot' && (
          <BootSequence
            onComplete={() => {
                setView('lobby');
            }}
          />
        )}
        
        {view === 'onboarding' && web3Address && (
          <AccountSetupScreen 
            address={web3Address} 
            onComplete={(name, cls) => {
              storage.setItem('lm_username', name);
              setPlayerName(name);
              setCharacterClass(cls);
              setView('lobby');
            }} 
          />
        )}

        {view === 'lobby' && (
          <Lobby
            playerName={playerName}
            setPlayerName={setPlayerName}
            activeAddress={address || undefined}
            characterClass={characterClass}
            setCharacterClass={setCharacterClass}
            avatar={avatar}
            unlockedLevel={unlockedLevel}
            missions={MISSIONS}
            onStart={startCombat}
            onLabs={() => setView('labs')}
            isVerified={!!address}
            onBriefingComplete={async () => {
                if (isConnected && web3Address) {
                    const stats = await getStats(web3Address);
                    const localName = storage.getItem('lm_username');
                    const hasName = (stats?.username && stats.username !== 'OPERATOR' && stats.username !== 'ROOKIE') || (localName && localName !== 'OPERATOR');
                    
                    if (!hasName) {
                        setView('onboarding');
                    }
                }
            }}
            settings={{
              audioEnabled,
              setAudioEnabled,
              difficultyModifier,
              setDifficultyModifier,
              virtualControlsEnabled,
              setVirtualControlsEnabled
            }}
          />
        )}

        {view === 'playing' && (
          <GameContainer
            playerName={playerName}
            characterClass={characterClass}
            avatar={avatar}
            roomId={roomId}
            isHost={isHost}
            gameMode={gameMode}
            mission={gameMode === 'mission' ? MISSIONS.find(m => m.id === activeLevelId) : undefined}
            mpConfig={mpConfig || undefined}
            squad={squad}
            activeAddress={address || undefined}
            audioEnabled={audioEnabled}
            difficultyModifier={difficultyModifier}
            virtualControlsEnabled={virtualControlsEnabled}
            onExit={() => setView('lobby')}
            onMissionComplete={onMissionComplete}
            onNextLevel={nextLevel}
          />
        )}

        {view === 'labs' && (
          <CreativeSuite
            onBack={() => setView('lobby')}
            setAvatar={setAvatar}
          />
        )}

        {view === '3d-proto' && (
          <Game3D
            onExit={() => setView('lobby')}
            onKill={() => console.log('[3D] Kill confirmed')}
            onMatchEnd={(stats, progression) => {
              console.log('[3D] Match end stats:', stats, 'Progression:', progression);
              setView('lobby');
            }}
            missionName={MISSIONS[0].name}
            missionObjective={MISSIONS[0].objective}
            missionType={MISSIONS[0].type}
          />
        )}
      </main>

      <button
        onClick={() => setView('3d-proto')}
        className="fixed bottom-16 right-2 z-[500] px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white text-[8px] font-black uppercase rounded border border-purple-400 lg:top-2 lg:bottom-auto lg:px-3 lg:py-1.5 lg:text-[10px]"
        title="3D Engine Prototype"
      >
        3D
      </button>
    </div>
  );
};

import { config, kitConfig } from './utils/web3Config';

const queryClient = new QueryClient();

const App: React.FC = () => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <KitProvider config={kitConfig}>
          <AppContent />
        </KitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default App;
