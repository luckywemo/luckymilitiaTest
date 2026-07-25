
import React from 'react';
import { getFarcasterUser, getFarcasterPfpUrl, isInFarcaster } from '../utils/farcaster';
import { calculateLevelData, getRankColor } from '../utils/leveling';
import { useBlockchainStats, PlayerStats } from '../utils/blockchain';

interface ProfileDashboardProps {
    playerName: string;
    activeAddress?: string;
    isVerified?: boolean;
    chainName?: string;
}

const ProfileDashboard: React.FC<ProfileDashboardProps> = ({ playerName, activeAddress, isVerified, chainName }) => {
    const [farcasterUser, setFarcasterUser] = React.useState<any>(null);
    const [pfp, setPfp] = React.useState<string | null>(null);
    const [stats, setStats] = React.useState<PlayerStats>({ username: playerName, kills: 0, wins: 0, gamesPlayed: 0 });
    const [isSyncing, setIsSyncing] = React.useState(false);
    const { getStats } = useBlockchainStats();

    const loadData = React.useCallback(async () => {
        setIsSyncing(true);
        const playerId = activeAddress || `guest:${playerName}`;
        console.log(`[Profile] Fetching stats for ${playerId}...`);
        
        try {
            const fetchedStats = await getStats(playerId);
            console.log(`[Profile] Received stats:`, fetchedStats);
            if (fetchedStats) setStats(fetchedStats);
        } catch (e) {
            console.error('[Profile] Fetch failed:', e);
        } finally {
            setIsSyncing(false);
        }
    }, [activeAddress, playerName, getStats]);

    React.useEffect(() => {
        const loadFarcaster = async () => {
            if (isInFarcaster()) {
                const user = await getFarcasterUser();
                const pfpUrl = await getFarcasterPfpUrl();
                setFarcasterUser(user);
                setPfp(pfpUrl);
            }
        };
        loadFarcaster();
        loadData();
    }, [loadData]);

    const levelData = calculateLevelData(stats);
    const formattedBalance = '0';

    return (
        <div className="space-y-6 lg:space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <style>{`
                @keyframes pdRotateRing { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                @keyframes pdFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-5px); } }
                @keyframes pdScaleIn { 0% { opacity: 0; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
                @keyframes pdShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                .pd-stagger > * { opacity: 0; animation: pdScaleIn 0.35s ease-out forwards; }
                .pd-stagger > *:nth-child(1) { animation-delay: 0.05s; }
                .pd-stagger > *:nth-child(2) { animation-delay: 0.1s; }
                .pd-stagger > *:nth-child(3) { animation-delay: 0.15s; }
                .pd-stagger > *:nth-child(4) { animation-delay: 0.2s; }
                .pd-shimmer-text {
                    background: linear-gradient(90deg, #f97316 0%, #fbbf24 50%, #f97316 100%);
                    background-size: 200% auto;
                    -webkit-background-clip: text; background-clip: text;
                    -webkit-text-fill-color: transparent;
                    animation: pdShimmer 3s linear infinite;
                }
            `}</style>
            {/* HEADER / IDENTITY */}
            <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-stone-900/40 border border-stone-800 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-600/5 blur-3xl -mr-10 -mt-10"></div>
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-orange-500/20" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-orange-500/20" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-orange-500/20" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-orange-500/20" />
                <div className="relative" style={{ animation: 'pdFloat 4s ease-in-out infinite' }}>
                    {/* Rotating glow ring */}
                    <div className="absolute inset-[-8px] rounded-2xl border-2 border-dashed border-orange-500/20" style={{ animation: 'pdRotateRing 10s linear infinite' }} />
                    <div className="w-24 h-24 lg:w-32 lg:h-32 rounded-2xl border-4 border-stone-800 overflow-hidden shadow-2xl group-hover:border-orange-500/50 transition-all duration-500">
                        <img
                            src={pfp || `https://api.dicebear.com/7.x/pixel-art/svg?seed=${playerName}`}
                            alt="Profile"
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-orange-600 to-orange-800 px-2 py-0.5 rounded text-[8px] font-black font-stencil tracking-widest text-white shadow-xl" style={{ boxShadow: '0 0 10px rgba(249,115,22,0.3)' }}>LVL_{levelData.level}</div>
                </div>

                <div className="text-center sm:text-left flex-1 min-w-0">
                    <div className="flex items-center justify-center sm:justify-start gap-3 mb-1">
                        <h2 className="text-2xl lg:text-4xl font-black text-white truncate uppercase tracking-tight pd-shimmer-text">{playerName}</h2>
                        {activeAddress && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border bg-cyan-600/20 text-cyan-400 border-cyan-500/30`}>
                                🌐 {chainName || 'EVM'}
                            </span>
                        )}
                        {farcasterUser && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border bg-purple-600/20 text-purple-400 border-purple-500/30`}>
                                🟣 FARCASTER
                            </span>
                        )}
                    </div>

                    <div className="w-full max-w-sm mt-4 sm:mt-0">
                        <div className="flex justify-between text-[8px] font-black uppercase text-stone-500 mb-1">
                            <span>XP_PROGRESS</span>
                            <span className="text-orange-500/70">{Math.floor(levelData.progressPercent)}%</span>
                        </div>
                        <div className="relative h-2 bg-stone-950 rounded-full overflow-hidden border border-stone-800">
                            <div
                                className="absolute inset-0 rounded-full"
                                style={{ background: 'linear-gradient(90deg, #ea580c, #f97316, #fbbf24)', width: `${levelData.progressPercent}%`, boxShadow: '0 0 8px rgba(249,115,22,0.4)' }}
                            ></div>
                            <div className="absolute inset-0 rounded-full opacity-30" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)', width: `${levelData.progressPercent}%` }}></div>
                        </div>
                    </div>
                    <p className="text-stone-500 text-xs lg:text-sm font-bold truncate opacity-80 mb-4">{activeAddress || 'OPERATOR_NOT_LINKED'}</p>

                    <div className="flex flex-wrap justify-center sm:justify-start gap-2 lg:gap-4">
                        <div className="px-3 py-1 bg-black/40 border border-stone-800 rounded text-[10px] text-stone-400 font-black uppercase">
                            CLASS: <span className="text-orange-500">STRIKER</span>
                        </div>
                        <div className="px-3 py-1 bg-black/40 border border-stone-800 rounded text-[10px] text-stone-400 font-black uppercase">
                            RANK: <span className={`${getRankColor(levelData.level)}`}>{levelData.rank}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* STATS GRID */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pd-stagger">
                {[
                    { label: 'LMT_BALANCE', value: formattedBalance, icon: '🪙', color: 'text-orange-500', accent: '#f97316' },
                    { label: 'CONFRMD_KILLS', value: stats.kills, icon: '🎯', color: 'text-red-500', accent: '#ef4444' },
                    { label: 'WAR_VICTORIES', value: stats.wins, icon: '🏆', color: 'text-yellow-500', accent: '#facc15' },
                    { label: 'OP_RELIABILITY', value: '100%', icon: '🛡️', color: 'text-cyan-500', accent: '#22d3ee' }
                ].map((stat, i) => (
                    <div key={i} className="relative tactical-panel bg-stone-900/60 p-4 lg:p-6 rounded-xl border border-stone-800 hover:border-stone-600 transition-all group overflow-hidden" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
                        <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: stat.accent, opacity: 0.4 }} />
                        <div className="absolute top-0 left-0 w-3 h-3 border-t border-l" style={{ borderColor: `${stat.accent}40` }} />
                        <div className="absolute top-0 right-0 w-3 h-3 border-t border-r" style={{ borderColor: `${stat.accent}40` }} />
                        <div className="text-xs lg:text-xl mb-1 lg:mb-2">{stat.icon}</div>
                        <div className="text-[8px] lg:text-[10px] font-black text-stone-500 uppercase tracking-widest mb-1">{stat.label}</div>
                        <div className={`text-xl lg:text-3xl font-stencil font-black ${stat.color} group-hover:scale-110 transition-transform origin-left`} style={{ textShadow: `0 0 8px ${stat.accent}30` }}>{stat.value}</div>
                    </div>
                ))}
            </div>

            {/* RECENT ACTIVITY & BADGES */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="relative tactical-panel bg-stone-900/40 p-6 rounded-2xl border border-stone-800 overflow-hidden">
                    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-orange-500/20" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-orange-500/20" />
                    <h3 className="text-sm lg:text-base font-black text-white uppercase mb-6 flex items-center justify-between">
                        <span>UNLOCKED_BADGES</span>
                        <span className="text-[10px] text-stone-600 font-bold tracking-widest">0 / 12</span>
                    </h3>
                    <div className="grid grid-cols-4 gap-4">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                            <div key={i} className="aspect-square bg-stone-950 border border-dashed border-stone-800 rounded-lg flex items-center justify-center grayscale opacity-20">
                                <span className="text-xl">🏆</span>
                            </div>
                        ))}
                    </div>
                    <p className="mt-6 text-center text-[10px] text-stone-600 font-bold italic uppercase">"Continue operations to earn merit awards."</p>
                </div>

                <div className="relative tactical-panel bg-stone-900/40 p-6 rounded-2xl border border-stone-800 overflow-hidden">
                    <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-orange-500/20" />
                    <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-orange-500/20" />
                    <h3 className="text-sm lg:text-base font-black text-white uppercase mb-6 flex items-center justify-between">
                        <span>OPERATIONAL_LOGS</span>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={loadData}
                                disabled={isSyncing}
                                className={`text-[8px] px-2 py-1 rounded border border-orange-500/30 font-black uppercase transition-all ${isSyncing ? 'animate-pulse text-orange-500 bg-orange-500/10' : 'text-stone-500 hover:text-orange-500 hover:bg-orange-500/5'}`}
                            >
                                {isSyncing ? 'SYNCHRONIZING...' : 'REFRESH_UPLINK'}
                            </button>
                            <span className="text-[10px] text-orange-500/50 font-bold tracking-widest">LIVE_FEED</span>
                        </div>
                    </h3>
                    <div className="space-y-4">
                        {[
                             { t: 'BOOT_UP', d: 'Operator recognized. System status: GREEN.' },
                             { t: 'WALLET_SYNC', d: activeAddress ? `Primary wallet linked to ${chainName}.` : 'Operating in GUEST_MODE.' },
                             farcasterUser && { t: 'IDENTITY', d: 'Farcaster profile linked and active.' },
                             activeAddress && { t: 'SECURITY', d: 'Cryptographic identity verified via multichain handshake.' }
                        ].filter(Boolean).map((log: any, i) => (
                            <div key={i} className="border-l-2 border-orange-600/30 pl-4 py-1">
                                <div className="text-[9px] font-black text-orange-500/70 mb-0.5">{log.t}</div>
                                <div className="text-[11px] font-bold text-stone-400 capitalize">{log.d}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfileDashboard;
