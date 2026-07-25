
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { storage } from '../utils/storage';
import { useOpenConnectModal } from '@0xsequence/kit';
import Peer, { DataConnection } from 'peerjs';
import { GameMode, CharacterClass, MissionConfig, MPMatchMode, MPMap, MPConfig } from '../App';
import { useBlockchainStats } from '../utils/blockchain';
import { calculateLevelData, getRankColor } from '../utils/leveling';
import Arsenal from './Arsenal';
import Leaderboard from './Leaderboard';
import { isInFarcaster } from '../utils/farcaster';
import ProfileDashboard from './ProfileDashboard';
import { PEER_CONFIG, getPeerId, getStatusFromIceState } from '../utils/multiplayer';
import { useMultiplayer, SquadMember } from '../hooks/useMultiplayer';
import { DebugConsole } from './DebugConsole';
import { HologramModel } from './HologramModel';


interface Props {
  playerName: string;
  setPlayerName: (name: string) => void;
  characterClass: CharacterClass;
  setCharacterClass: (c: CharacterClass) => void;
  avatar: string | null;
  unlockedLevel: number;
  activeAddress?: string;
  missions: MissionConfig[];
  onStart: (roomId: string | null, isHost: boolean, mode: GameMode, levelId?: number, squad?: SquadMember[], mpConfig?: MPConfig) => void;
  onLabs: () => void;
  settings: {
    audioEnabled: boolean;
    setAudioEnabled: (v: boolean) => void;
    difficultyModifier: number;
    setDifficultyModifier: (v: number) => void;
    virtualControlsEnabled: boolean;
    setVirtualControlsEnabled: (v: boolean) => void;
  };
  isVerified?: boolean;
  onBriefingComplete?: () => void;
}

const CLASS_META: Record<CharacterClass, { desc: string; hp: number; speed: number; armor: number; tech: number; icon: string; color: string }> = {
  STRIKER: { desc: "Versatile combat specialist.", hp: 120, speed: 100, armor: 60, tech: 40, icon: "⚔️", color: "#f97316" },
  GHOST: { desc: "Reconnaissance specialist.", hp: 80, speed: 150, armor: 20, tech: 100, icon: "🕶️", color: "#22d3ee" },
  TITAN: { desc: "Heavily armored juggernaut.", hp: 200, speed: 50, armor: 140, tech: 20, icon: "🛡️", color: "#78716c" }
};

const MAP_META: Record<MPMap, { name: string; desc: string; icon: string }> = {
  URBAN_RUINS: { name: "URBAN RUINS", desc: "Symmetrical tactical sector.", icon: "🏙️" },
  THE_PIT: { name: "THE PIT", desc: "Close quarters killbox.", icon: "🕳️" },
  OUTPOST_X: { name: "OUTPOST X", desc: "Industrial facility maze.", icon: "🏭" }
};

const PersonnelCard: React.FC<{ member: SquadMember, isSelf: boolean }> = ({ member, isSelf }) => {
  const isAlpha = member.team === 'alpha';
  const colorClass = isAlpha ? 'border-orange-500/30 bg-orange-500/5' : 'border-cyan-500/30 bg-cyan-500/5';
  const glowColor = isAlpha ? 'rgba(249,115,22,0.15)' : 'rgba(34,211,238,0.15)';

  return (
    <div className={`flex items-center gap-2 p-1.5 rounded border ${colorClass} transition-all relative overflow-hidden group hover:bg-white/5 hover:scale-[1.02] hover:shadow-lg`} style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${isAlpha ? 'bg-orange-500' : 'bg-cyan-500'}`}></div>
      {member.isReady && <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at left, ${glowColor} 0%, transparent 60%)` }} />}
      <div className={`relative w-6 h-6 rounded-sm flex items-center justify-center font-black text-[10px] text-white ${isAlpha ? 'bg-orange-600' : 'bg-cyan-600'}`} style={member.isReady ? { boxShadow: `0 0 8px ${isAlpha ? 'rgba(249,115,22,0.4)' : 'rgba(34,211,238,0.4)'}` } : {}}>
        {member.name ? member.name[0] : '?'}
      </div>
      <div className="flex-1 min-w-0 relative">
        <div className="text-[9px] font-black text-white uppercase tracking-wider truncate flex items-center gap-1">
          {member.name || 'UNKNOWN_UNIT'}
          {isSelf && <span className="text-[5px] bg-white/10 px-1 py-0.5 rounded text-white/40 font-bold">YOU</span>}
        </div>
        {(member.ping !== undefined && member.id !== 'host' && !isSelf) && (
            <div className={`text-[6px] font-black ${member.ping < 100 ? 'text-green-500' : member.ping < 200 ? 'text-orange-500' : 'text-red-500'}`}>{member.ping}ms</div>
        )}
      </div>
      <div className="flex items-center gap-2 relative">
         <div className={`text-[8px] font-black ${member.isReady ? 'text-green-400' : 'text-stone-600 animate-pulse'}`}>{member.isReady ? 'READY' : 'STANDBY'}</div>
         <div className={`w-1.5 h-1.5 rounded-full ${member.isReady ? '' : 'animate-pulse'} ${isAlpha ? 'bg-orange-500' : 'bg-cyan-500'}`} style={member.isReady ? { boxShadow: `0 0 6px ${isAlpha ? 'rgba(249,115,22,0.5)' : 'rgba(34,211,238,0.5)'}` } : {}}></div>
      </div>
    </div>
  );
};

const Lobby: React.FC<Props> = ({ playerName, setPlayerName, characterClass, setCharacterClass, avatar, unlockedLevel, activeAddress, missions, onStart, onLabs, settings, isVerified, onBriefingComplete }) => {
  const { setOpenConnectModal } = useOpenConnectModal();
  const [tab, setTab] = useState<'profile' | 'missions' | 'multiplayer' | 'arsenal' | 'leaderboard' | 'manual' | 'settings'>('profile');
  const userAddress = activeAddress;

  // Token gating check for Bio-Forge (Labs)
  const hasLabAccess = false;

  const { getStats, recordKill, recordWin, chainName, sessionActive, authorizeSession, hasFunds, isMiniPay: onMiniPay } = useBlockchainStats();

  const [levelStats, setLevelStats] = useState<{ kills: number; wins: number; gamesPlayed: number }>({
    kills: 0,
    wins: 0,
    gamesPlayed: 0,
  });

  useEffect(() => {
    if (!activeAddress) return;
    getStats(activeAddress).then(stats => {
      if (stats) {
        setLevelStats({
          kills: Number(stats.kills) || 0,
          wins: Number(stats.wins) || 0,
          gamesPlayed: Number(stats.gamesPlayed) || 0,
        });
      }
    });
  }, [activeAddress, getStats]);

  const levelData = calculateLevelData(levelStats);

  const [selectedLevelId, setSelectedLevelId] = useState(unlockedLevel);
  const [roomCode, setRoomCode] = useState('');
  const [chatInput, setChatInput] = useState('');

  const [showBriefing, setShowBriefing] = useState(false);
  const [briefingStep, setBriefingStep] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
       const seen = storage.getItem('lm_briefing_seen');
       const hasRealName = playerName && !playerName.startsWith('OP_') && playerName !== 'ROOKIE';
       // Instructor comes AFTER signup and username selection
       if (!seen && isVerified && hasRealName) {
          setShowBriefing(true);
       }
    }
  }, [isVerified, playerName]);

  useEffect(() => {
    if (!showBriefing) {
      onBriefingComplete?.();
    }
  }, [showBriefing]);
  
  const briefingData = [
    { title: "WELCOME, OPERATOR.", text: "This is your Tactical Terminal. From here, you manage your deployments and arsenal. Let's get you acquainted." },
    { title: "UPLINK STATUS", text: "Look at your Operator ID. If it says GUEST_MODE, your kills aren't being recorded on-chain. Click ESTABLISH_LINK to secure your connection." },
    { title: "PROTOCOL ZERO", text: "Before jumping into hostile territory, complete 'Protocol Zero' in the Missions tab to calibrate your neural link." },
    { title: "DISMISSED.", text: "Good luck out there. Click below to begin." }
  ];

  const closeBriefing = () => {
    setShowBriefing(false);
    storage.setItem('lm_briefing_seen', 'true');
    playUISound('click');
  };

  const [mpMatchMode, setMpMatchMode] = useState<MPMatchMode>('TDM');
  const [mpMap, setMpMap] = useState<MPMap>('URBAN_RUINS');
  const [scoreLimit, setScoreLimit] = useState(50);

  const {
    activeRoom,
    isHost,
    squad,
    statusMsg,
    chatMessages,
    handleCreateRoom: createRoom,
    handleJoinRoom: joinRoom,
    switchTeam,
    toggleReady,
    sendChatMessage,
    initiateStart,
    setSquad,
    setActiveRoom
  } = useMultiplayer({
    playerName,
    mpMatchMode,
    mpMap,
    scoreLimit,
    alphaBots: 0,
    bravoBots: 0,
    onGameStart: (code, host, squadMembers, mpConfig) => {
      onStart(code, host, 'multiplayer', undefined, squadMembers, mpConfig);
    }
  });

  // Dynamic AI Backfill: auto-calculate bot counts based on mode and squad
  const backfill = useMemo(() => {
    const alphaHumans = squad.filter(m => m.team === 'alpha').length;
    const bravoHumans = squad.filter(m => m.team === 'bravo').length;
    const totalHumans = squad.length;

    let targetPerTeam: number;
    let alphaBots = 0;
    let bravoBots = 0;

    switch (mpMatchMode) {
      case 'TDM':
        targetPerTeam = 3;
        alphaBots = Math.max(0, targetPerTeam - alphaHumans);
        bravoBots = Math.max(0, targetPerTeam - bravoHumans);
        break;
      case 'HARDPOINT':
        targetPerTeam = 4;
        alphaBots = Math.max(0, targetPerTeam - alphaHumans);
        bravoBots = Math.max(0, targetPerTeam - bravoHumans);
        break;
      case 'FFA':
        const ffaTarget = 8;
        bravoBots = Math.max(0, ffaTarget - totalHumans);
        alphaBots = 0;
        break;
      case '1V1':
        alphaBots = 0;
        bravoBots = 0;
        break;
      default:
        targetPerTeam = 3;
        alphaBots = Math.max(0, targetPerTeam - alphaHumans);
        bravoBots = Math.max(0, targetPerTeam - bravoHumans);
    }

    const canDeploy1v1 = mpMatchMode !== '1V1' || totalHumans >= 2;
    return { alphaBots, bravoBots, alphaHumans, bravoHumans, totalHumans, canDeploy1v1 };
  }, [squad, mpMatchMode]);

  const alphaBots = backfill.alphaBots;
  const bravoBots = backfill.bravoBots;

  const [isDeploying, setIsDeploying] = useState(false);

  // Parse URL for invite links
  useEffect(() => {
     const urlParams = new URLSearchParams(window.location.search);
     const roomToJoin = urlParams.get('room');
     if (roomToJoin && tab !== 'multiplayer') {
         setTab('multiplayer');
         setRoomCode(roomToJoin.toUpperCase());
         joinRoom(roomToJoin.toUpperCase());
         
         // Remove room from URL so it doesn't trigger again on refresh if they leave
         window.history.replaceState({}, document.title, window.location.pathname);
     }
  }, []); // Only run once on mount

  // Registration Logic: Add user to leaderboard as soon as they have a name/wallet
  useEffect(() => {
    if (playerName && playerName !== 'ROOKIE') {
      const registerUser = async () => {
        try {
          await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              address: activeAddress || `guest:${playerName.toLowerCase()}`, 
              username: playerName 
            })
          });
        } catch (err) {
          console.error('[Lobby] Registration failed:', err);
        }
      };
      registerUser();
    }
  }, [playerName, activeAddress]);

  const copyInviteLink = () => {
    playUISound('click');
    const link = `${window.location.origin}${window.location.pathname}?room=${activeRoom}`;
    navigator.clipboard.writeText(link).then(() => {
       alert("Invite link copied to clipboard!");
    });
  };

  const playUISound = (type: 'hover' | 'click' | 'hologram') => {
    if (!settings.audioEnabled || typeof window === 'undefined') return;
    try {
        const audio = new Audio();
        if (type === 'click') {
           audio.src = '/assets/audio/p-chi.wav';
           audio.volume = 0.2;
           audio.playbackRate = 2.0;
        } else if (type === 'hover') {
           audio.src = '/assets/audio/pistol.wav';
           audio.volume = 0.05;
           audio.playbackRate = 3.0;
        } else if (type === 'hologram') {
           audio.src = '/assets/audio/magic-spell.wav';
           audio.volume = 0.3;
           audio.playbackRate = 1.5;
        }
        audio.play().catch(() => {});
    } catch {}
  };

  // Sync name/squad logic is now inside useMultiplayer hook


  const handleCreateRoom = () => createRoom();
  const handleJoinRoom = () => joinRoom(roomCode);


  const deploy = async () => {
    // ── AUTOMATED SIGNUP / LOGIN FLOW ──
    // If not connected, open the wallet modal immediately
    if (!activeAddress) {
      playUISound('click');
      setOpenConnectModal(true);
      return;
    }

    // If connected but no codename set, redirect to profile/onboarding
    if (!playerName || playerName === 'ROOKIE' || playerName.startsWith('OPERATOR_')) {
      playUISound('click');
      setTab('profile');
      return;
    }

    if (tab === 'multiplayer' && activeRoom) {
      if (isHost) {
        const mapSeed = Math.random().toString(36).substring(2, 12).toUpperCase();
        const config: MPConfig = { mode: mpMatchMode, map: mpMap, alphaBots, bravoBots, scoreLimit, mapSeed };
        initiateStart(config);
      }
    } else {
      onStart(null, true, 'mission', selectedLevelId);
    }
  };

  const selectedMission = missions.find(m => m.id === selectedLevelId) || missions[0];

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 lg:p-10 animate-in fade-in duration-500 font-mono overflow-y-auto overflow-x-hidden relative bg-black">
      <style>{`
        @keyframes lobbySlideUp { 0% { opacity: 0; transform: translateY(15px); } 100% { opacity: 1; transform: translateY(0); } }
        @keyframes lobbyScaleIn { 0% { opacity: 0; transform: scale(0.92); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes lobbyShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes lobbyScanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100vh); } }
        @keyframes lobbyGridMove { 0% { background-position: 0 0; } 100% { background-position: 40px 40px; } }
        @keyframes lobbyFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-4px); } }
        .lobby-stagger > * { opacity: 0; animation: lobbyScaleIn 0.3s ease-out forwards; }
        .lobby-stagger > *:nth-child(1) { animation-delay: 0.03s; }
        .lobby-stagger > *:nth-child(2) { animation-delay: 0.06s; }
        .lobby-stagger > *:nth-child(3) { animation-delay: 0.09s; }
        .lobby-stagger > *:nth-child(4) { animation-delay: 0.12s; }
        .lobby-stagger > *:nth-child(5) { animation-delay: 0.15s; }
        .lobby-stagger > *:nth-child(6) { animation-delay: 0.18s; }
        .lobby-stagger > *:nth-child(7) { animation-delay: 0.21s; }
        .lobby-shimmer-text {
          background: linear-gradient(90deg, #f97316 0%, #fbbf24 50%, #f97316 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: lobbyShimmer 3s linear infinite;
        }
      `}</style>
      {/* Animated grid background */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(249,115,22,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(249,115,22,0.5) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        animation: 'lobbyGridMove 20s linear infinite',
      }} />
      {/* Scanline overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute left-0 right-0 h-24 opacity-[0.02]" style={{
          background: 'linear-gradient(180deg, transparent, rgba(249,115,22,1), transparent)',
          animation: 'lobbyScanline 10s linear infinite',
        }} />
      </div>
      {/* Ambient glow orbs */}
      <div className="absolute top-[-5%] left-[15%] w-[300px] h-[300px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-5%] right-[15%] w-[250px] h-[250px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(34,211,238,0.04) 0%, transparent 70%)' }} />

      {showBriefing && (
        <div className="fixed inset-0 z-[6000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
           <div className="w-full max-w-lg tactical-panel bg-stone-900 border border-orange-500 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(249,115,22,0.2)] animate-in zoom-in-95 duration-300 relative">
              {/* Corner accents */}
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-orange-400/50 z-10" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-orange-400/50 z-10" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-orange-400/50 z-10" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-orange-400/50 z-10" />
              <div className="bg-gradient-to-r from-orange-700 to-orange-600 px-4 py-2 flex justify-between items-center relative">
                 <span className="text-[10px] font-black text-white uppercase tracking-widest">COMMANDER'S BRIEFING</span>
                 <span className="text-[10px] font-black text-orange-950 uppercase">STEP {briefingStep + 1}/{briefingData.length}</span>
              </div>
              <div className="p-6 lg:p-8 space-y-4 relative">
                 {/* Scanline texture */}
                 <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 3px)' }} />
                 <h3 className="text-xl lg:text-2xl font-stencil text-white italic drop-shadow-[0_0_10px_rgba(255,255,255,0.3)] relative">{briefingData[briefingStep].title}</h3>
                 <p className="text-xs lg:text-sm text-stone-300 font-bold leading-relaxed relative" style={{ animation: 'lobbySlideUp 0.4s ease-out' }}>{briefingData[briefingStep].text}</p>
              </div>
              <div className="p-4 bg-black/40 border-t border-stone-800 flex justify-between relative">
                 {briefingStep > 0 ? (
                    <button onClick={() => { setBriefingStep(s => s - 1); playUISound('click'); }} className="px-4 py-2 text-[10px] text-stone-500 font-black uppercase hover:text-white transition-colors">PREVIOUS</button>
                 ) : <div></div>}
                 
                 {briefingStep < briefingData.length - 1 ? (
                    <button onClick={() => { setBriefingStep(s => s + 1); playUISound('click'); }} className="px-6 py-2 bg-orange-600 text-white font-black text-[10px] uppercase rounded hover:bg-orange-500 transition-all hover:scale-105" style={{ boxShadow: '0 0 12px rgba(249,115,22,0.3)' }}>NEXT</button>
                 ) : (
                    <button onClick={closeBriefing} className="px-6 py-2 bg-white text-stone-950 font-black text-[10px] uppercase rounded hover:bg-stone-200 transition-all hover:scale-105 shadow-[0_0_15px_rgba(255,255,255,0.5)]">END BRIEFING</button>
                 )}
              </div>
           </div>
        </div>
      )}
      <DebugConsole />
      <div className="w-full max-w-[1300px] grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-8 pb-24 lg:pb-0">

        {/* LEFT NAV BAR */}
        <div className="lg:col-span-3 flex flex-col gap-2 lg:gap-6">
          <div className="tactical-panel p-3 lg:p-8 bg-stone-900/90 border border-stone-800 rounded-xl relative overflow-hidden group">
            <h1 className="font-stencil text-lg sm:text-3xl lg:text-5xl font-black text-white leading-none uppercase mb-1 drop-shadow-[0_2px_15px_rgba(249,115,22,0.3)]">
              LUCKY<br className="hidden sm:block" /><span className="text-orange-500"> MILITIA</span>
            </h1>
            <div className="flex justify-between items-center w-full px-1">
              <div className="text-[7px] lg:text-[10px] font-black text-stone-600 tracking-[0.2em] lg:tracking-[0.5em] uppercase">{chainName !== 'GUEST_NETWORK' ? `${chainName}_Uplink` : 'Multichain_Terminal'}</div>
              <div className={`text-[8px] lg:text-[12px] font-black ${getRankColor(levelData.level)} uppercase tracking-widest`}>
                {levelData.rank} // LVL {levelData.level}
              </div>
            </div>
          </div>

          <div className="tactical-panel flex-1 p-2 lg:p-6 bg-stone-900/60 rounded-xl border border-stone-800 flex flex-col gap-2">
            <div className="mb-1">
              <label className="text-[7px] lg:text-[10px] font-black text-orange-500/70 uppercase tracking-widest mb-1 block flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  Operator_ID
                  <span className={`text-[6px] px-1.5 py-0.5 rounded border ${activeAddress ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' : 'text-stone-500 border-stone-800'}`}>
                    {activeAddress ? chainName : 'OFFLINE'}
                  </span>
                  {onMiniPay && (
                    <span className="text-[6px] px-1.5 py-0.5 rounded border text-green-400 border-green-500/30 bg-green-500/10 animate-pulse">
                      📱 MINIPAY
                    </span>
                  )}
                </div>
                <div className="scale-75 origin-right flex gap-2">
                  {!sessionActive && activeAddress && (
                    <button 
                      onClick={() => { authorizeSession(); playUISound('click'); }}
                      className="px-4 py-1.5 bg-cyan-600/20 text-cyan-400 font-black text-[10px] uppercase rounded border border-cyan-500/50 hover:bg-cyan-600 hover:text-white transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] animate-pulse"
                      title="Enable popup-free background signing"
                    >
                      ACTIVATE_GHOST_SIGN
                    </button>
                  )}
                  <button 
                    onClick={() => setOpenConnectModal(true)}
                    className="px-4 py-1.5 bg-orange-600 text-white font-black text-[10px] uppercase rounded border border-orange-500/50 hover:bg-orange-500 transition-all shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                  >
                    {activeAddress ? 'SWITCH_WALLET' : 'ESTABLISH_LINK'}
                  </button>
                </div>
              </label>
              <div className="w-full bg-black/60 border border-stone-800 p-2 lg:p-4 rounded shadow-inner flex flex-col justify-center">
                <div className="flex items-center justify-between text-xs lg:text-xl font-black text-white">
                  <span className="truncate">{playerName}</span>
                  {activeAddress ? (
                    <span className="text-[8px] text-green-500 ml-2 flex-shrink-0 animate-pulse">UPLINK_ACTIVE</span>
                  ) : (
                    <span className="text-[8px] text-stone-600 ml-2 flex-shrink-0">GUEST_MODE</span>
                  )}
                </div>
                {activeAddress && (
                  <div 
                    onClick={() => {
                      playUISound('click');
                      navigator.clipboard.writeText(activeAddress);
                      alert('Wallet address copied to clipboard!');
                    }}
                    className="text-[10px] text-stone-500 mt-2 flex items-center gap-2 cursor-pointer hover:text-white transition-colors w-fit"
                    title="Copy Wallet Address to fund it"
                  >
                    <span>{activeAddress.slice(0,6)}...{activeAddress.slice(-4)}</span>
                    <span className="text-[8px] font-black border border-stone-600 px-1.5 py-0.5 rounded uppercase hover:bg-stone-800">Copy Address</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide shrink-0 z-10 w-full lg:w-auto relative">
              {([
                { key: 'profile' as const, icon: '👤' },
                { key: 'missions' as const, icon: '🗺️' },
                { key: 'multiplayer' as const, icon: '📡' },
                { key: 'arsenal' as const, icon: '🛡️' },
                { key: 'leaderboard' as const, icon: '🏆' },
                { key: 'manual' as const, icon: '📖' },
                { key: 'settings' as const, icon: '⚙️' },
              ]).map(t => (
                <button
                  key={t.key}
                  onClick={() => { setTab(t.key); playUISound('click'); }}
                  onMouseEnter={() => playUISound('hover')}
                  className={`relative px-3 py-2 text-[7px] lg:text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all flex items-center gap-1.5 rounded ${tab === t.key ? 'bg-orange-600 text-white' : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900/50'}`}
                  style={tab === t.key ? { boxShadow: '0 0 12px rgba(249,115,22,0.3)' } : {}}
                >
                  <span className="text-xs lg:text-sm">{t.icon}</span>
                  <span className="hidden sm:inline">{t.key}</span>
                  {tab === t.key && <div className="absolute -bottom-0.5 left-1 right-1 h-0.5 bg-orange-300/50 rounded-full" />}
                </button>
              ))}
            </div>

            <div className="mt-1 lg:mt-auto pt-2 lg:pt-6 border-t border-stone-800/40">
              <button
                onClick={hasLabAccess ? onLabs : undefined}
                className={`w-full py-2 lg:py-5 border border-stone-800 rounded text-[7px] lg:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 lg:gap-3 active:scale-[0.98] ${hasLabAccess ? 'bg-stone-950 text-stone-500 hover:text-orange-500' : 'bg-stone-950/30 text-stone-700 cursor-not-allowed grayscale'}`}
              >
                {hasLabAccess ? '🧬' : '🔒'}
                <span className="hidden sm:inline">{hasLabAccess ? 'Bio_Forge_Terminal' : 'Bio_Forge_Locked'}</span>
                <span className="sm:hidden">{hasLabAccess ? 'BIO_FORGE' : 'LOCKED'}</span>
              </button>
              {!hasLabAccess && (
                <div className="mt-2 text-[6px] lg:text-[8px] text-orange-500/60 font-black text-center uppercase tracking-tighter">
                  Requires 100 LMT to access
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CENTER CONSOLE */}
        <div className="lg:col-span-6 tactical-panel bg-stone-950/90 border border-stone-800 rounded-2xl relative flex flex-col lg:min-h-[720px] shadow-2xl">
          <div className="p-3 lg:p-8 border-b border-stone-800 flex justify-between items-center bg-stone-900/30 backdrop-blur-xl">
            <h2 className="text-xs lg:text-3xl font-black font-stencil tracking-widest text-white uppercase italic">{tab}</h2>
            <div className="flex items-center gap-1 lg:gap-3 bg-black/60 px-2 lg:px-4 py-1 lg:py-2 rounded-full border border-stone-800">
              <div className={`w-1 lg:w-2 h-1 lg:h-2 rounded-full ${statusMsg !== 'OFFLINE' ? 'bg-green-500 animate-pulse' : 'bg-stone-700'}`}></div>
              <div className="text-[6px] lg:text-[10px] font-black text-stone-500 uppercase tracking-tighter">{statusMsg}</div>
            </div>
          </div>

          <div key={tab} className={`lg:flex-1 lg:overflow-y-auto p-3 lg:p-8 ${tab === 'leaderboard' ? 'flex flex-col min-h-0' : ''}`} style={{ animation: 'lobbySlideUp 0.3s ease-out' }}>
            {tab === 'missions' && (
              <div className="flex flex-col gap-3 lg:gap-8 h-full">
                <div className="flex-1 relative bg-black/60 rounded-xl border border-stone-800 overflow-hidden min-h-[200px] lg:min-h-[340px] shadow-inner p-2">
                  <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #444 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
                  {/* Corner accents on map */}
                  <div className="absolute top-1 left-1 w-3 h-3 border-t border-l border-orange-500/30 pointer-events-none" />
                  <div className="absolute top-1 right-1 w-3 h-3 border-t border-r border-orange-500/30 pointer-events-none" />
                  <div className="absolute bottom-1 left-1 w-3 h-3 border-b border-l border-orange-500/30 pointer-events-none" />
                  <div className="absolute bottom-1 right-1 w-3 h-3 border-b border-r border-orange-500/30 pointer-events-none" />
                  {missions.map(m => (
                    <button
                      key={m.id}
                      disabled={m.id > unlockedLevel}
                      onClick={() => setSelectedLevelId(m.id)}
                      className={`absolute w-8 h-8 lg:w-14 lg:h-14 -translate-x-1/2 -translate-y-1/2 transition-all ${m.id <= unlockedLevel ? 'cursor-pointer hover:scale-110' : 'opacity-20 grayscale cursor-not-allowed'}`}
                      style={{ left: `${m.coords.x}%`, top: `${m.coords.y}%` }}
                    >
                      {selectedLevelId === m.id && <div className="mission-pulse"></div>}
                      <div className={`w-full h-full rounded border flex items-center justify-center font-black text-[10px] lg:text-lg transition-all ${selectedLevelId === m.id ? 'bg-orange-600 border-white text-white scale-110' : 'bg-stone-900 border-stone-800 text-stone-600'}`} style={selectedLevelId === m.id ? { boxShadow: '0 0 16px rgba(249,115,22,0.4)' } : {}}>
                        {m.id}
                      </div>
                    </button>
                  ))}
                </div>
                <div className="p-3 lg:p-6 bg-stone-900/60 border border-stone-800 rounded-lg relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-600 to-orange-800"></div>
                  {/* Corner accents */}
                  <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-orange-500/20" />
                  <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-orange-500/20" />
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] lg:text-[16px] font-black text-white uppercase tracking-widest">{selectedMission.name}</span>
                    <div className="h-px flex-1 bg-gradient-to-r from-stone-800 to-transparent"></div>
                    <span className="text-[7px] lg:text-[10px] font-bold text-stone-500 uppercase tracking-widest whitespace-nowrap">Level_{selectedMission.id}</span>
                  </div>
                  <p className="text-[8px] lg:text-[12px] text-stone-400 leading-relaxed font-bold italic opacity-90 pl-1 lg:pl-2">"{selectedMission.objective}"</p>
                </div>
              </div>
            )}

            {tab === 'multiplayer' && !activeRoom && (
              <div className="flex flex-col gap-4 h-full justify-center">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-8">
                  <button onClick={handleCreateRoom} className="relative p-6 lg:p-12 bg-stone-900/30 border border-stone-800 rounded-xl text-center hover:bg-stone-900/50 transition-all hover:scale-[1.02] overflow-hidden group" style={{ transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}>
                    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-orange-500/20" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-orange-500/20" />
                    <div className="w-10 h-10 lg:w-20 lg:h-20 bg-orange-600/10 rounded-lg mx-auto flex items-center justify-center mb-3" style={{ animation: 'lobbyFloat 4s ease-in-out infinite' }}>
                      <span className="text-xl lg:text-5xl">📡</span>
                    </div>
                    <h3 className="text-[10px] lg:text-xl font-black text-white uppercase mb-1">Host_Sector</h3>
                    <p className="text-[6px] lg:text-[10px] text-stone-600 uppercase font-bold tracking-widest">Generate Private Uplink</p>
                  </button>

                  <div className="p-6 lg:p-12 bg-stone-950/80 border border-stone-800 rounded-xl text-center shadow-xl">
                    <h3 className="text-[10px] lg:text-xl font-black text-white uppercase mb-3 lg:mb-6">Link_Access</h3>
                    <div className="space-y-3">
                      <input
                        value={roomCode}
                        onChange={e => setRoomCode(e.target.value.toUpperCase())}
                        maxLength={4}
                        className="w-full bg-black border border-stone-800 p-2 lg:p-5 text-center text-xl lg:text-5xl font-black tracking-widest text-orange-500 rounded outline-none focus:border-orange-600"
                        placeholder="0000"
                      />
                      <button onClick={handleJoinRoom} disabled={roomCode.length !== 4} className="w-full py-2 lg:py-4 bg-white disabled:bg-stone-800 disabled:text-stone-600 text-stone-950 font-black text-[9px] lg:text-[12px] uppercase rounded transition-all">Establish_Link</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'multiplayer' && activeRoom && (
              <div className="flex flex-col gap-3 lg:gap-6 h-full">
                {/* Connection Status Indicator */}
                <div className="bg-black/40 border border-stone-800 rounded-lg p-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full animate-pulse shadow-[0_0_10px_currentColor] ${statusMsg.includes('FAILED') || statusMsg.includes('ERROR') ? 'text-red-500 bg-red-500' :
                      statusMsg.includes('UPLINK') ? 'text-blue-500 bg-blue-500' :
                        statusMsg.includes('CONNECTED') || statusMsg.includes('SIGNAL') ? 'text-green-500 bg-green-500' : 'text-orange-500 bg-orange-500'
                      }`}></div>
                    <span className={`text-[9px] lg:text-xs font-black uppercase tracking-wider ${statusMsg.includes('FAILED') || statusMsg.includes('ERROR') ? 'text-red-500' :
                      statusMsg.includes('UPLINK') ? 'text-blue-400' :
                        statusMsg.includes('CONNECTED') || statusMsg.includes('SIGNAL') ? 'text-green-500' : 'text-orange-500'
                      }`}>{statusMsg}</span>
                  </div>
                  <div className="text-[9px] lg:text-xs font-black text-stone-400 uppercase tracking-wider">
                    Players: <span className="text-white">{squad.length}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 lg:gap-4">
                  <button
                    onClick={() => {
                      const maps: MPMap[] = ['URBAN_RUINS', 'THE_PIT', 'OUTPOST_X'];
                      const nextIndex = (maps.indexOf(mpMap) + 1) % maps.length;
                      setMpMap(maps[nextIndex]);
                    }}
                    className="bg-stone-900/40 border border-stone-800 rounded p-2 lg:p-4 flex items-center gap-2 hover:bg-stone-800 transition-colors text-left"
                  >
                    <div className="text-lg lg:text-3xl">{MAP_META[mpMap].icon}</div>
                    <div>
                      <div className="text-[6px] lg:text-[8px] text-stone-600 uppercase font-black">MAP (CLICK TO CHANGE)</div>
                      <div className="text-[8px] lg:text-[12px] text-white font-black uppercase truncate">{MAP_META[mpMap].name}</div>
                    </div>
                  </button>
                  <button
                    onClick={() => {
                      const modes: MPMatchMode[] = ['TDM', 'FFA', 'HARDPOINT', '1V1'];
                      const nextIndex = (modes.indexOf(mpMatchMode) + 1) % modes.length;
                      setMpMatchMode(modes[nextIndex]);
                      playUISound('click');
                    }}
                    className="bg-stone-900/40 border border-stone-800 rounded p-2 lg:p-4 flex items-center gap-2 hover:bg-stone-800 transition-colors text-left"
                  >
                    <div className="text-lg lg:text-3xl">⚔️</div>
                    <div>
                      <div className="text-[6px] lg:text-[8px] text-stone-600 uppercase font-black">MODE (CLICK TO CHANGE)</div>
                      <div className="text-[8px] lg:text-[12px] text-orange-500 font-black uppercase">{mpMatchMode}</div>
                    </div>
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 lg:gap-4">
                    <div className="space-y-2">
                      <div className="text-[10px] font-black text-white bg-orange-600/20 px-2 py-0.5 rounded border border-orange-500/30 uppercase flex items-center justify-between">
                        <span>ALPHA_SQUAD</span>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse"></div>
                          <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse delay-75"></div>
                          <div className="w-1 h-1 bg-orange-500 rounded-full animate-pulse delay-150"></div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {squad.filter(m => m.team === 'alpha').map((m, i) => <PersonnelCard key={m.id || i} member={m} isSelf={m.name === playerName} />)}
                        {squad.filter(m => m.team === 'alpha').length === 0 && <div className="h-8 border border-dashed border-stone-900 rounded flex items-center justify-center text-[6px] text-stone-800 uppercase font-bold italic">Awaiting_Uplink</div>}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-black text-white bg-cyan-600/20 px-2 py-0.5 rounded border border-cyan-500/30 uppercase flex items-center justify-between">
                        <span>BRAVO_SQUAD</span>
                        <div className="flex gap-1">
                          <div className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse"></div>
                          <div className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse delay-75"></div>
                          <div className="w-1 h-1 bg-cyan-500 rounded-full animate-pulse delay-150"></div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {squad.filter(m => m.team === 'bravo').map((m, i) => <PersonnelCard key={m.id || i} member={m} isSelf={m.name === playerName} />)}
                        {squad.filter(m => m.team === 'bravo').length === 0 && <div className="h-8 border border-dashed border-stone-900 rounded flex items-center justify-center text-[6px] text-stone-800 uppercase font-bold italic">Awaiting_Uplink</div>}
                      </div>
                    </div>
                  </div>

                  {/* Auto-Backfill Summary (Read-Only) */}
                  <div className="mt-4 p-3 lg:p-4 bg-stone-950/80 border border-stone-800 rounded-xl">
                    <div className="text-[8px] font-black text-stone-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                      AI_BACKFILL // AUTO
                    </div>
                    {mpMatchMode === '1V1' ? (
                      <div className="text-center py-2">
                        <div className="text-[10px] font-black text-stone-400 uppercase">Pure_Duel — No AI Units</div>
                        {!backfill.canDeploy1v1 && (
                          <div className="text-[9px] font-black text-red-500 mt-1 animate-pulse">⚠ REQUIRES 2 HUMAN OPERATORS</div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg border border-orange-500/10">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-orange-500 uppercase">ALPHA_AI</span>
                            <span className="text-[6px] text-stone-600 font-bold">{backfill.alphaHumans} humans + {backfill.alphaBots} bots</span>
                          </div>
                          <span className="text-lg font-stencil text-orange-500">{backfill.alphaBots}</span>
                        </div>
                        <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg border border-cyan-500/10">
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-cyan-500 uppercase">BRAVO_AI</span>
                            <span className="text-[6px] text-stone-600 font-bold">{backfill.bravoHumans} humans + {backfill.bravoBots} bots</span>
                          </div>
                          <span className="text-lg font-stencil text-cyan-500">{backfill.bravoBots}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-2 pt-4 border-t border-stone-800/60 items-end">
                    <div className="flex-1 flex gap-2 w-full">
                       <button onClick={() => { switchTeam(); playUISound('click'); }} onMouseEnter={() => playUISound('hover')} className="flex-1 py-2 lg:py-4 bg-stone-900/60 border border-stone-800 rounded text-stone-500 font-black text-[8px] lg:text-[11px] uppercase hover:text-white transition-all">Switch_Team</button>
                       {!isHost && (
                         <button onClick={() => { toggleReady(); playUISound('click'); }} onMouseEnter={() => playUISound('hover')} className="flex-1 py-2 lg:py-4 bg-orange-600 border border-orange-500 rounded text-white font-black text-[8px] lg:text-[11px] uppercase hover:bg-orange-500 transition-all">Ready_Up</button>
                       )}
                    </div>
                    <button onClick={copyInviteLink} onMouseEnter={() => playUISound('hover')} className="bg-stone-950 px-4 py-1.5 rounded border border-stone-800 flex flex-col items-center justify-center gap-0.5 hover:bg-stone-900 group active:scale-95 transition-all cursor-pointer min-w-[120px]">
                      <span className="text-[6px] text-stone-600 font-black group-hover:text-orange-500">CODE / CLICK INVITE</span>
                      <span className="text-sm lg:text-xl font-black text-orange-500 font-stencil tracking-widest">{activeRoom}</span>
                    </button>
                  </div>
                  
                  {/* Chat Box */}
                  <div className="flex-1 min-h-[150px] max-h-[250px] mt-2 flex flex-col bg-stone-900/40 border border-stone-800 rounded-lg overflow-hidden">
                    <div className="bg-black/40 px-2 py-1 text-[8px] font-black text-stone-500 uppercase flex justify-between items-center">
                      <span>Squad_Comms</span>
                      <span className="text-[6px] text-green-500 animate-pulse">ENCRYPTED</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                       {chatMessages.map((msg, i) => (
                           <div key={i} className="text-[9px] font-bold">
                              <span className="text-stone-500">[{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}]</span>{' '}
                              <span className={msg.sender === playerName ? 'text-orange-400' : 'text-cyan-400'}>{msg.sender}:</span>{' '}
                              <span className="text-white break-words">{msg.text}</span>
                           </div>
                       ))}
                       {chatMessages.length === 0 && <div className="text-[8px] text-stone-600 italic">No comms. Link established.</div>}
                    </div>
                    <form onSubmit={(e) => { e.preventDefault(); if (chatInput.trim()){ sendChatMessage(chatInput); setChatInput(''); } }} className="flex border-t border-stone-800">
                      <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Transmit message..." className="flex-1 bg-black text-[9px] p-2 outline-none text-white font-mono" />
                      <button type="submit" disabled={!chatInput.trim()} className="px-4 py-2 bg-stone-800 text-[8px] font-black uppercase text-stone-400 disabled:opacity-50 hover:text-white transition-colors">SEND</button>
                    </form>
                  </div>
                </div>
              </div>
            )}

            {tab === 'profile' && (
              <ProfileDashboard playerName={playerName} activeAddress={activeAddress} isVerified={isVerified} chainName={chainName} />
            )}

            {tab === 'arsenal' && (
              <Arsenal activeAddress={activeAddress} />
            )}


            {tab === 'leaderboard' && (
              <Leaderboard activeAddress={activeAddress} playerName={playerName} />
            )}


            {tab === 'manual' && (
              <div className="space-y-4 lg:space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="bg-black/40 border border-stone-800 p-4 lg:p-8 rounded-xl shadow-inner space-y-6 lg:space-y-10">
                     <div className="space-y-4">
                        <h3 className="text-xl lg:text-3xl font-stencil font-black text-white uppercase italic border-b border-stone-800 pb-2 flex items-center gap-3">
                           <span className="text-orange-500">01.</span> COMBAT BASICS
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="tactical-panel bg-stone-900/60 p-4 border border-stone-800 rounded">
                              <div className="text-[10px] font-black text-orange-500 uppercase mb-3">Movement & Targeting</div>
                              <ul className="text-[10px] lg:text-xs text-stone-400 space-y-2 font-bold uppercase tracking-wider">
                                 <li className="flex justify-between"><span className="text-stone-600">WASD / ARROWS</span><span className="text-white">Move</span></li>
                                 <li className="flex justify-between"><span className="text-stone-600">SPACE / L-SHIFT</span><span className="text-orange-500">Boost</span></li>
                                 <li className="flex justify-between"><span className="text-stone-600">MOUSE</span><span className="text-white">Aim</span></li>
                                 <li className="flex justify-between"><span className="text-stone-600">LEFT CLICK</span><span className="text-red-500">Fire</span></li>
                              </ul>
                           </div>
                           <div className="tactical-panel bg-stone-900/60 p-4 border border-stone-800 rounded">
                              <div className="text-[10px] font-black text-cyan-400 uppercase mb-3">Arsenal Hotkeys</div>
                              <div className="grid grid-cols-3 gap-2">
                                 {[1,2,3,4,5,6].map(n => <div key={n} className="bg-stone-950 p-2 border border-stone-800 text-center text-orange-500 font-black rounded text-xs">{n}</div>)}
                              </div>
                           </div>
                        </div>
                     </div>
                     <div className="space-y-4">
                        <h3 className="text-xl lg:text-3xl font-stencil font-black text-white uppercase italic border-b border-stone-800 pb-2 flex items-center gap-3">
                           <span className="text-cyan-500">02.</span> GHOST SIGNING
                        </h3>
                        <div className="tactical-panel bg-stone-900/60 p-4 lg:p-6 border border-stone-800 rounded space-y-3">
                           <p className="text-[10px] lg:text-xs text-stone-400 font-bold leading-relaxed uppercase tracking-wider">
                              Lucky Militia utilizes <span className="text-cyan-400">Sequence WaaS</span> on Base and <span className="text-orange-400">Native EOA signing</span> on Celo (MiniPay) to perform seamless "Ghost Signing".
                           </p>
                           <p className="text-[10px] lg:text-xs text-stone-500 font-bold leading-relaxed uppercase tracking-wider">
                              Once you establish a link with your operator profile, your mission results and combat metrics are logged directly to the blockchain in the background. On MiniPay, transactions are sub-cent and nearly instant, ensuring your rank is always up to date without interrupting combat.
                           </p>
                        </div>
                     </div>
                  </div>
              </div>
            )}

            {tab === 'settings' && (
              <div className="space-y-6 h-full">
                <div className="space-y-3">
                  <h3 className="text-[10px] lg:text-[13px] font-black text-white uppercase border-b border-stone-800 pb-1 tracking-widest">Acoustics</h3>
                  <button
                    onClick={() => { settings.setAudioEnabled(!settings.audioEnabled); playUISound('click'); }}
                    onMouseEnter={() => playUISound('hover')}
                    className={`w-full p-3 lg:p-6 border rounded-xl flex justify-between items-center transition-all ${settings.audioEnabled ? 'bg-orange-500/10 border-orange-500/40 shadow-xl' : 'bg-stone-950 border-stone-800'}`}
                  >
                    <span className={`text-[10px] lg:text-[13px] font-black uppercase ${settings.audioEnabled ? 'text-white' : 'text-stone-600'}`}>Master_Audio</span>
                    <div className={`w-8 lg:w-12 h-4 lg:h-6 rounded-full p-0.5 transition-all ${settings.audioEnabled ? 'bg-orange-600 shadow-[0_0_10px_#f97316]' : 'bg-stone-900'}`}>
                      <div className={`w-3 lg:w-5 h-3 lg:h-5 bg-white rounded-full transition-all transform ${settings.audioEnabled ? 'translate-x-4 lg:translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                  </button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-[10px] lg:text-[13px] font-black text-white uppercase border-b border-stone-800 pb-1 tracking-widest">User_Interface</h3>
                  <button
                    onClick={() => { settings.setVirtualControlsEnabled(!settings.virtualControlsEnabled); playUISound('click'); }}
                    onMouseEnter={() => playUISound('hover')}
                    className={`w-full p-3 lg:p-6 border rounded-xl flex justify-between items-center transition-all ${settings.virtualControlsEnabled ? 'bg-orange-500/10 border-orange-500/40 shadow-xl' : 'bg-stone-950 border-stone-800'}`}
                  >
                    <span className={`text-[10px] lg:text-[13px] font-black uppercase ${settings.virtualControlsEnabled ? 'text-white' : 'text-stone-600'}`}>Hand_Control_Overlay</span>
                    <div className={`w-8 lg:w-12 h-4 lg:h-6 rounded-full p-0.5 transition-all ${settings.virtualControlsEnabled ? 'bg-orange-600 shadow-[0_0_10px_#f97316]' : 'bg-stone-900'}`}>
                      <div className={`w-3 lg:w-5 h-3 lg:h-5 bg-white rounded-full transition-all transform ${settings.virtualControlsEnabled ? 'translate-x-4 lg:translate-x-6' : 'translate-x-0'}`}></div>
                    </div>
                  </button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-[10px] lg:text-[13px] font-black text-white uppercase border-b border-stone-800 pb-1 tracking-widest">Simulation_Load</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    {[
                      { val: 0.5, label: 'RECRUIT' },
                      { val: 1.0, label: 'VETERAN' },
                      { val: 1.5, label: 'ELITE' },
                      { val: 2.5, label: 'LETHAL' }
                    ].map(item => (
                      <button
                        key={item.val}
                        onClick={() => settings.setDifficultyModifier(item.val)}
                        className={`p-2 lg:p-4 border rounded-xl transition-all text-[8px] lg:text-[11px] font-black ${settings.difficultyModifier === item.val ? 'bg-white border-white text-stone-950 scale-105' : 'bg-black/60 border-stone-800 text-stone-600 hover:text-stone-300'}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT UNIT SPEC PANEL */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <div className="tactical-panel flex-1 bg-stone-900/90 border border-stone-800 rounded-2xl p-4 lg:p-8 flex flex-col gap-4 lg:gap-3 shadow-2xl relative overflow-hidden">
            <HologramModel type={characterClass} />
            <div className="relative z-10 grid grid-cols-3 gap-3 lg:gap-3">
              {(['STRIKER', 'GHOST', 'TITAN'] as CharacterClass[]).map(c => (
                <button
                  key={c}
                  onClick={() => { setCharacterClass(c); playUISound('hologram'); }}
                  onMouseEnter={() => playUISound('hover')}
                  className={`aspect-square rounded-xl border transition-all flex flex-col items-center justify-center ${characterClass === c ? 'bg-white border-white text-stone-950 scale-105 lg:scale-110 shadow-xl' : 'bg-stone-950 border-stone-800 text-stone-700 hover:text-stone-400'}`}
                >
                  <span className="text-3xl lg:text-2xl mb-1">{CLASS_META[c].icon}</span>
                  <span className="text-[10px] lg:text-[8px] font-black uppercase tracking-tight">{c}</span>
                </button>
              ))}
            </div>

            <div className="text-center pt-3 lg:pt-2 relative z-10 bg-black/40 p-2 rounded backdrop-blur-sm lg:mt-16">
              <h3 className="text-2xl lg:text-3xl font-black font-stencil text-white uppercase italic tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">{characterClass}</h3>
              <p className="text-[11px] lg:text-[10px] text-orange-400 font-bold px-2 mt-2 leading-relaxed">"{CLASS_META[characterClass].desc}"</p>
            </div>

            <div className="space-y-4 lg:space-y-3 mt-auto pt-4 border-t border-stone-800/60 relative z-10 bg-black/60 p-3 rounded backdrop-blur-md">
              <div className="space-y-2 lg:space-y-1.5">
                <div className="flex justify-between text-[11px] lg:text-[10px] font-black text-stone-600 uppercase px-1">
                  <span>Hull_Integrity</span>
                  <span className="text-stone-300">{CLASS_META[characterClass].hp}</span>
                </div>
                <div className="h-2.5 lg:h-2 bg-stone-950 rounded-full overflow-hidden border border-stone-800 p-[1px]">
                  <div className="h-full bg-orange-600 transition-all duration-700 shadow-[0_0_8px_#f97316]" style={{ width: `${(CLASS_META[characterClass].hp / 200) * 100}%` }}></div>
                </div>
              </div>
              <div className="space-y-2 lg:space-y-1.5">
                <div className="flex justify-between text-[11px] lg:text-[10px] font-black text-stone-600 uppercase px-1">
                  <span>Kinetic_Speed</span>
                  <span className="text-stone-300">{CLASS_META[characterClass].speed}</span>
                </div>
                <div className="h-2.5 lg:h-2 bg-stone-950 rounded-full overflow-hidden border border-stone-800 p-[1px]">
                  <div className="h-full bg-cyan-500 transition-all duration-700 shadow-[0_0_8px_#22d3ee]" style={{ width: `${(CLASS_META[characterClass].speed / 150) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          <button
            disabled={!hasFunds || isDeploying || (tab === 'multiplayer' && (!activeRoom || !isHost || squad.length < 2 || squad.some(m => !m.isReady) || !backfill.canDeploy1v1))}
            onClick={() => { playUISound('click'); deploy(); }}
            onMouseEnter={() => playUISound('hover')}
            className={`hidden lg:block py-6 lg:py-12 bg-white disabled:bg-stone-900 disabled:text-stone-800 text-stone-950 font-stencil text-2xl lg:text-5xl tracking-[0.2em] transition-all rounded-2xl border-b-8 border-stone-300 active:translate-y-1 active:border-b-2 hover:bg-orange-600 hover:text-white relative overflow-hidden ${!hasFunds && activeAddress ? 'border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : ''}`}
            style={!(!hasFunds || isDeploying) ? { boxShadow: '0 0 20px rgba(255,255,255,0.1)' } : {}}
          >
            {isDeploying ? (
              <div className="flex items-center justify-center gap-4">
                <div className="w-8 h-8 border-4 border-stone-800 border-t-orange-500 rounded-full animate-spin"></div>
                <span>UPLINKING...</span>
              </div>
            ) : !hasFunds && activeAddress ? (
               <div className="flex flex-col items-center justify-center gap-2">
                 <span className="text-red-500">INSUFFICIENT FUNDS</span>
                 <span className="text-[12px] tracking-widest text-red-400 font-sans font-bold">
                   PLEASE FUND WALLET WITH {onMiniPay ? 'CELO' : 'BASE ETH'}
                 </span>
               </div>
            ) : !activeAddress ? 'ESTABLISH LINK' : (playerName === 'ROOKIE' || playerName.startsWith('OPERATOR_')) ? 'INITIALIZE REQUIRED' : (tab === 'multiplayer' && isHost && squad.some(m => !m.isReady)) ? 'WAITING FOR SQUAD' : 'DEPLOY'}
          </button>
        </div>
      </div>

      {/* MOBILE STICKY DEPLOY BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 w-full p-4 bg-stone-950/95 backdrop-blur-lg border-t border-stone-800 flex items-center justify-between z-[500] shadow-[0_-10px_40px_rgba(0,0,0,0.8)]">
        <div className="flex flex-col">
          <span className="text-[6px] font-black text-orange-500/60 uppercase tracking-widest">System_Link</span>
          <span className="text-[9px] font-black text-white uppercase tracking-widest">{characterClass} // READY</span>
        </div>
        <button
          disabled={!hasFunds || isDeploying || (tab === 'multiplayer' && (!activeRoom || !isHost || squad.length < 2 || squad.some(m => !m.isReady)))}
          onClick={deploy}
          className="px-6 py-3 bg-orange-600 text-white font-black text-[10px] uppercase tracking-widest rounded border-b-4 border-orange-800 active:translate-y-1 active:border-b-0 disabled:bg-stone-800 disabled:text-stone-600 transition-all shadow-lg flex items-center gap-2"
        >
          {isDeploying ? (
            <>
              <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              <span>LINKING...</span>
            </>
          ) : !hasFunds && activeAddress ? (
            <span className="text-red-500 animate-pulse">FUND WALLET ({onMiniPay ? 'CELO' : 'BASE ETH'})</span>
          ) : !activeAddress ? 'Establish Link' : (playerName === 'ROOKIE' || playerName.startsWith('OPERATOR_')) ? 'Initialize Required' : (tab === 'multiplayer' && isHost && squad.some(m => !m.isReady)) ? 'Waiting for Squad' : 'Tactical Deployment'}
        </button>
      </div>
    </div>
  );
};

export default Lobby;
