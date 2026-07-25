import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useBlockchainStats } from '../utils/blockchain';

interface Props {
    activeAddress?: string;
    playerName?: string;
}

interface LeaderboardEntry {
    address: string;
    username: string | null;
    score: number;
    kills: number;
    wins: number;
    lastCombat: number;
}

const RANK_BADGES = ['🥇', '🥈', '🥉'];
const RANK_COLORS = ['text-yellow-400', 'text-stone-300', 'text-amber-600'];
const PODIUM_STYLES = [
    'border-yellow-500/40 bg-yellow-500/10',
    'border-stone-400/30 bg-stone-400/5',
    'border-amber-700/30 bg-amber-700/5',
];

function formatAddress(addr: string): string {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function timeSince(ts: number): string {
    if (!ts) return '—';
    const delta = Date.now() - ts;
    const mins = Math.floor(delta / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}

function displayName(entry: LeaderboardEntry): string {
    return entry.username || formatAddress(entry.address);
}

export default function Leaderboard({ activeAddress, playerName }: Props) {
    const [period, setPeriod] = useState('alltime');
    const [type, setType] = useState<'combined' | 'pve' | 'pvp'>('combined');
    const [isLoading, setIsLoading] = useState(false);
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [verifiedStats, setVerifiedStats] = useState<{ [addr: string]: boolean }>({});
    const [isVerifying, setIsVerifying] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const listRef = useRef<HTMLDivElement>(null);
    const myRowRef = useRef<HTMLDivElement>(null);

    const { getStats } = useBlockchainStats();

    useEffect(() => {
        let isMounted = true;

        async function fetchLeaderboard(isInitialFetch = false) {
            try {
                if (isInitialFetch && leaderboardData.length === 0) {
                    setIsLoading(true);
                }

                let queryPeriod = 'alltime';
                const now = new Date();
                const ymd = now.toISOString().split('T')[0].replace(/-/g, '');
                const ym = ymd.substring(0, 6);

                if (period === 'daily') queryPeriod = `daily:${ymd}`;
                if (period === 'monthly') queryPeriod = `monthly:${ym}`;

                const response = await fetch(`/api/leaderboard?period=${queryPeriod}&type=${type}&limit=100`);
                if (!response.ok) throw new Error('Failed to fetch leaderboard');
                const data = await response.json();

                if (isMounted) {
                    setLeaderboardData(data);
                    setError(null);
                }
            } catch (err: any) {
                console.error('[Leaderboard] Fetch error:', err);
                if (isMounted) setError(err.message);
            } finally {
                if (isMounted) setIsLoading(false);
            }
        }

        fetchLeaderboard(true);
        const intervalId = setInterval(() => fetchLeaderboard(false), 10000);

        return () => {
            isMounted = false;
            clearInterval(intervalId);
        };
    }, [period, type]);

    const filteredData = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return leaderboardData;
        return leaderboardData.filter(e =>
            (e.username?.toLowerCase().includes(q)) ||
            e.address.toLowerCase().includes(q)
        );
    }, [leaderboardData, search]);

    const myEntry = useMemo(() => {
        if (!activeAddress) return null;
        const idx = leaderboardData.findIndex(e => e.address.toLowerCase() === activeAddress.toLowerCase());
        if (idx === -1) return null;
        return { ...leaderboardData[idx], rank: idx + 1 };
    }, [leaderboardData, activeAddress]);

    const topThree = useMemo(() => leaderboardData.slice(0, 3), [leaderboardData]);
    const topScore = leaderboardData.length > 0 ? leaderboardData[0].score : 1;

    const handleVerify = async (addr: string, expectedScore: number) => {
        try {
            setIsVerifying(addr);
            const stats = await getStats(addr);
            if (stats) {
                const onChainScore = Number(stats.kills) * 10 + Number(stats.wins) * 50;
                if (onChainScore >= expectedScore) {
                    setVerifiedStats(prev => ({ ...prev, [addr]: true }));
                }
            }
        } catch (e) {
            console.error('[Leaderboard] Verification failed:', e);
        } finally {
            setIsVerifying(null);
        }
    };

    const scrollToMe = useCallback(() => {
        myRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, []);

    return (
        <div className="flex flex-col h-full min-h-0 gap-3 animate-in fade-in slide-in-from-right-4 duration-500">
            <style>{`
                @keyframes lbSlideIn { 0% { opacity: 0; transform: translateX(-15px); } 100% { opacity: 1; transform: translateX(0); } }
                @keyframes lbScaleIn { 0% { opacity: 0; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
                @keyframes lbPulse { 0%, 100% { border-color: rgba(249,115,22,0.3); } 50% { border-color: rgba(249,115,22,0.6); } }
                @keyframes lbFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-3px); } }
                .lb-row { transition: transform 0.15s ease, background 0.15s ease; }
                .lb-row:hover { transform: translateX(3px); }
                .lb-stagger > * { opacity: 0; animation: lbScaleIn 0.3s ease-out forwards; }
                .lb-stagger > *:nth-child(1) { animation-delay: 0.05s; }
                .lb-stagger > *:nth-child(2) { animation-delay: 0.1s; }
                .lb-stagger > *:nth-child(3) { animation-delay: 0.15s; }
            `}</style>

            {/* Header + filters */}
            <div className="shrink-0 p-3 lg:p-4 bg-stone-900/60 border border-stone-800 rounded-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500 via-orange-600 to-transparent" />
                {/* Corner accents */}
                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-orange-500/20" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-orange-500/20" />
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative z-10">
                    <div>
                        <h3 className="text-base lg:text-lg font-black text-white uppercase tracking-widest flex items-center gap-2">
                            <span>🏆</span> COMBAT_RECORDS
                        </h3>
                        <p className="text-[8px] lg:text-[9px] text-stone-500 font-bold uppercase tracking-wider mt-1">
                            {leaderboardData.length} operators · top 100 · {period.replace('_', ' ')}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {([
                            { id: 'combined', label: 'ALL' },
                            { id: 'pve', label: 'PVE' },
                            { id: 'pvp', label: 'PVP' },
                        ] as const).map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setType(t.id)}
                                className={`px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-wide transition-all ${type === t.id
                                    ? 'bg-cyan-500 text-black'
                                    : 'bg-black/40 text-stone-500 border border-stone-800 hover:text-stone-300'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                        <span className="w-px h-5 bg-stone-800 self-center mx-0.5" />
                        {(['alltime', 'monthly', 'daily'] as const).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-2.5 py-1 rounded text-[8px] font-black uppercase tracking-wide transition-all ${period === p
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-stone-950 text-stone-500 border border-stone-800 hover:text-stone-300'
                                }`}
                            >
                                {p === 'alltime' ? 'ALL' : p === 'monthly' ? 'MON' : 'DAY'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Search + your rank bar */}
            <div className="shrink-0 flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-600 text-xs">⌕</span>
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search operator or address..."
                        className="w-full bg-black/60 border border-stone-800 rounded-lg pl-8 pr-3 py-2 text-[10px] font-bold text-white placeholder:text-stone-700 outline-none focus:border-orange-500/50 transition-colors"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-600 hover:text-white text-xs px-1"
                        >
                            ✕
                        </button>
                    )}
                </div>
                {myEntry && (
                    <button
                        onClick={scrollToMe}
                        className="shrink-0 px-3 py-2 bg-orange-500/10 border border-orange-500/30 rounded-lg text-[9px] font-black text-orange-400 uppercase tracking-wide hover:bg-orange-500/20 transition-all flex items-center gap-2"
                    >
                        <span className="w-5 h-5 rounded bg-orange-600 text-white flex items-center justify-center text-[9px]">#{myEntry.rank}</span>
                        Jump to me
                    </button>
                )}
            </div>

            {/* Podium — top 3 with 3D tiered effect */}
            {!isLoading && !error && topThree.length > 0 && !search && (
                <div className="shrink-0 grid grid-cols-3 gap-2 lb-stagger">
                    {topThree.map((op, i) => {
                        const isMe = op.address.toLowerCase() === activeAddress?.toLowerCase();
                        const podiumHeights = ['h-28', 'h-24', 'h-20'];
                        const medalColors = ['#facc15', '#d4d4d8', '#d97706'];
                        return (
                            <div
                                key={op.address}
                                className={`relative p-2 lg:p-3 rounded-lg border text-center overflow-hidden ${PODIUM_STYLES[i]} ${isMe ? 'ring-1 ring-orange-500/50' : ''}`}
                                style={{ animation: 'lbFloat 3s ease-in-out infinite', animationDelay: `${i * 0.3}s`, boxShadow: `0 4px 12px rgba(0,0,0,0.3), 0 0 16px ${medalColors[i]}15` }}
                            >
                                {/* Corner accents */}
                                <div className="absolute top-0 left-0 w-2 h-2 border-t border-l" style={{ borderColor: `${medalColors[i]}40` }} />
                                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r" style={{ borderColor: `${medalColors[i]}40` }} />
                                {/* SVG Medal */}
                                <div className="flex justify-center mb-1">
                                    <svg width="20" height="20" viewBox="0 0 24 24" style={{ filter: `drop-shadow(0 0 4px ${medalColors[i]}60)` }}>
                                        <circle cx="12" cy="10" r="7" fill={medalColors[i]} opacity="0.9"/>
                                        <path d="M9 16 L7 22 L12 20 L17 22 L15 16" fill={medalColors[i]} opacity="0.7"/>
                                        <text x="12" y="13" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#000" opacity="0.6">{i + 1}</text>
                                    </svg>
                                </div>
                                <div className="text-[9px] lg:text-[10px] font-black text-white uppercase truncate px-1">
                                    {displayName(op)}
                                </div>
                                <div className="text-[8px] text-stone-500 font-bold mt-0.5">
                                    {op.kills}K · {op.wins}W
                                </div>
                                <div className={`text-sm lg:text-base font-stencil mt-1`} style={{ color: medalColors[i], textShadow: `0 0 8px ${medalColors[i]}40` }}>
                                    {op.score.toLocaleString()}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Personal card when ranked but not in top 3 spotlight */}
            {myEntry && myEntry.rank > 3 && !search && (
                <div className="shrink-0 px-3 py-2 bg-orange-500/5 border border-orange-500/25 rounded-lg flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-7 h-7 rounded bg-orange-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                            #{myEntry.rank}
                        </span>
                        <div className="min-w-0">
                            <div className="text-[10px] font-black text-white uppercase truncate">
                                {playerName || displayName(myEntry)} <span className="text-orange-400 text-[8px]">YOU</span>
                            </div>
                            <div className="text-[8px] text-stone-500">{myEntry.kills} kills · {myEntry.wins} wins</div>
                        </div>
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-base font-stencil text-orange-500">{myEntry.score.toLocaleString()}</div>
                        {verifiedStats[myEntry.address] ? (
                            <span className="text-[7px] text-cyan-400 font-black">🛡️ VERIFIED</span>
                        ) : (
                            <button
                                onClick={() => handleVerify(myEntry.address, myEntry.score)}
                                disabled={isVerifying === myEntry.address}
                                className="text-[7px] text-stone-500 hover:text-white font-black disabled:opacity-50"
                            >
                                {isVerifying === myEntry.address ? 'SYNC...' : 'VERIFY'}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Table */}
            <div className="flex-1 min-h-0 flex flex-col border border-stone-800/60 rounded-xl overflow-hidden bg-stone-950/40">
                {/* Sticky column headers */}
                <div className="shrink-0 grid grid-cols-[2rem_1fr_3rem_3rem_3.5rem_4rem] sm:grid-cols-[2.5rem_1fr_3.5rem_3.5rem_4rem_5rem] gap-1 px-2 py-2 bg-stone-900/80 border-b border-stone-800 text-[7px] sm:text-[8px] font-black text-stone-500 uppercase tracking-wider">
                    <div>#</div>
                    <div>Operator</div>
                    <div className="text-center">K</div>
                    <div className="text-center">W</div>
                    <div className="text-center hidden sm:block">Last</div>
                    <div className="text-right">Score</div>
                </div>

                {/* Scrollable body */}
                <div
                    ref={listRef}
                    className="flex-1 min-h-[280px] max-h-[min(65vh,640px)] overflow-y-auto overscroll-contain"
                >
                    {isLoading ? (
                        <div className="p-2 space-y-1">
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} className="h-9 bg-stone-900/30 rounded animate-pulse" style={{ animationDelay: `${i * 40}ms` }} />
                            ))}
                        </div>
                    ) : error ? (
                        <div className="text-center py-16 px-4">
                            <span className="text-2xl mb-2 block">⚠️</span>
                            <p className="text-[10px] text-red-500 font-black uppercase">UPLINK_ERROR</p>
                            <p className="text-[8px] text-stone-600 mt-1">{error}</p>
                        </div>
                    ) : filteredData.length > 0 ? (
                        <div className="p-1.5 space-y-0.5">
                            {filteredData.map((op) => {
                                const index = leaderboardData.findIndex(e => e.address === op.address);
                                const rank = index + 1;
                                const isMe = op.address.toLowerCase() === activeAddress?.toLowerCase();
                                const isTop3 = rank <= 3 && !search;
                                const scorePercent = Math.max(4, Math.round((op.score / topScore) * 100));

                                return (
                                    <div
                                        key={op.address}
                                        ref={isMe ? myRowRef : undefined}
                                        className={`lb-row grid grid-cols-[2rem_1fr_3rem_3rem_3.5rem_4rem] sm:grid-cols-[2.5rem_1fr_3.5rem_3.5rem_4rem_5rem] gap-1 px-2 py-1.5 rounded items-center relative overflow-hidden group ${isMe
                                            ? 'bg-orange-500/15 border border-orange-500/30'
                                            : isTop3
                                                ? 'bg-stone-900/50 border border-stone-700/40'
                                                : 'hover:bg-stone-900/40 border border-transparent'
                                        }`}
                                        style={isMe ? { animation: 'lbPulse 2s ease-in-out infinite' } : {}}
                                    >
                                        <div
                                            className="absolute left-0 top-0 h-full bg-white/[0.03] transition-all duration-500 pointer-events-none"
                                            style={{ width: `${scorePercent}%` }}
                                        />

                                        <div className={`relative z-10 font-black text-[10px] sm:text-xs tabular-nums ${isTop3 ? RANK_COLORS[rank - 1] : 'text-stone-600'}`}>
                                            {isTop3 && !search ? RANK_BADGES[rank - 1] : rank}
                                        </div>

                                        <div className="relative z-10 flex items-center gap-1.5 min-w-0">
                                            <div className={`w-5 h-5 rounded shrink-0 flex items-center justify-center text-[7px] font-black text-white uppercase ${isTop3 ? 'bg-orange-600' : 'bg-stone-800'}`}>
                                                {(op.username || op.address)[0]}
                                            </div>
                                            <span className="text-[9px] sm:text-[10px] font-black text-white uppercase truncate">
                                                {displayName(op)}
                                            </span>
                                            {verifiedStats[op.address] && (
                                                <span className="text-[8px] shrink-0" title="Verified">🛡️</span>
                                            )}
                                            {isMe && (
                                                <span className="text-[6px] text-orange-400 font-bold shrink-0 bg-orange-500/20 px-1 rounded">YOU</span>
                                            )}
                                        </div>

                                        <div className="relative z-10 text-center text-[9px] sm:text-[10px] font-bold text-stone-400 tabular-nums">
                                            {op.kills}
                                        </div>
                                        <div className="relative z-10 text-center text-[9px] sm:text-[10px] font-bold text-stone-400 tabular-nums">
                                            {op.wins}
                                        </div>
                                        <div className="relative z-10 text-center text-[8px] font-bold text-stone-600 hidden sm:block tabular-nums">
                                            {timeSince(op.lastCombat)}
                                        </div>
                                        <div className={`relative z-10 text-right font-black tabular-nums ${isTop3 ? 'text-orange-500 text-[11px]' : 'text-stone-400 text-[9px] sm:text-[10px]'}`}>
                                            {op.score.toLocaleString()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : search ? (
                        <div className="text-center py-16 px-4">
                            <p className="text-[10px] text-stone-500 font-black uppercase">No operators match "{search}"</p>
                        </div>
                    ) : (
                        <div className="text-center py-16 px-4">
                            <span className="text-2xl mb-2 block opacity-30">📡</span>
                            <p className="text-[10px] text-stone-600 font-black uppercase">NO_COMBAT_DATA</p>
                            <p className="text-[8px] text-stone-700 mt-1">Complete a mission to appear on the board</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="shrink-0 px-3 py-2 bg-stone-900/60 border-t border-stone-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse shrink-0" />
                        <p className="text-[7px] text-stone-600 font-bold uppercase truncate">
                            {type === 'pvp' ? 'Arena: K×25 + W×100' : 'Campaign: K×5 + W×20'}
                        </p>
                    </div>
                    <p className="text-[7px] text-stone-600 font-black uppercase shrink-0">
                        {search
                            ? `${filteredData.length} / ${leaderboardData.length}`
                            : `${leaderboardData.length} ranked`}
                    </p>
                </div>
            </div>
        </div>
    );

}
