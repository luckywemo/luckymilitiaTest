import React, { useState } from 'react';
import { WEAPONS, WEAPON_CATEGORIES, WeaponKey, WeaponCategory } from '../engine3d/types';


type WeaponType = 'pistol' | 'smg' | 'shotgun' | 'railgun';
type Rarity = 'common' | 'rare' | 'legendary';

interface ArsenalProps {
    activeAddress?: string | null;
}

export default function Arsenal({ activeAddress }: ArsenalProps) {
    const listLoading = false;
    const tokenIds: any[] = [];
    const [selectedCategory, setSelectedCategory] = useState<WeaponCategory | 'all'>('all');
    const [selectedWeapon, setSelectedWeapon] = useState<WeaponKey | null>(null);

    const RARITY_META: Record<string, { color: string; glow: string; border: string }> = {
        common: { color: '#a8a29e', glow: 'rgba(168,162,158,0.15)', border: 'rgba(168,162,158,0.3)' },
        rare: { color: '#22d3ee', glow: 'rgba(34,211,238,0.15)', border: 'rgba(34,211,238,0.3)' },
        legendary: { color: '#f97316', glow: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.3)' },
    };

    const CATEGORY_COLORS: Record<WeaponCategory, string> = {
        pistol: '#a8a29e',
        smg: '#22d3ee',
        assault: '#f97316',
        marksman: '#a78bfa',
        sniper: '#ef4444',
        shotgun: '#f59e0b',
        lmg: '#84cc16',
        launcher: '#f97316',
        energy: '#d946ef',
    };

    const allWeapons = Object.values(WEAPONS);
    const filteredWeapons = selectedCategory === 'all' ? allWeapons : allWeapons.filter(w => w.category === selectedCategory);
    const selectedWeaponData = selectedWeapon ? WEAPONS[selectedWeapon] : null;

    return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <style>{`
                @keyframes arsFloat { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-5px); } }
                @keyframes arsScaleIn { 0% { opacity: 0; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
                @keyframes arsPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 0.6; } }
                @keyframes arsSlideIn { 0% { opacity: 0; transform: translateX(20px); } 100% { opacity: 1; transform: translateX(0); } }
                .ars-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
                .ars-card:hover { transform: translateY(-4px) scale(1.02); }
            `}</style>
            <div className="relative p-4 bg-stone-900/60 border border-stone-800 rounded-xl overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-cyan-500 to-cyan-700"></div>
                {/* Corner accents */}
                <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-500/20" />
                <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-500/20" />
                <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2 flex items-center gap-2">
                    <span style={{ animation: 'arsFloat 4s ease-in-out infinite' }}>🛡️</span> TACTICAL_ARSENAL
                </h3>
                <p className="text-[10px] text-stone-500 font-bold uppercase tracking-wider">
                    Managed_Asset_Inventory // Soroban_Testnet_Uplink
                </p>
            </div>

            {/* Weapon Gallery — Category Tabs */}
            <div className="space-y-3">
                <div className="text-[10px] font-black text-stone-500 uppercase tracking-widest border-b border-stone-800 pb-2">Weapon_Gallery</div>
                {/* Category filter tabs */}
                <div className="flex flex-wrap gap-1.5">
                    <button
                        onClick={() => setSelectedCategory('all')}
                        className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${selectedCategory === 'all' ? 'bg-white text-black' : 'bg-stone-900 text-stone-500 hover:text-white border border-stone-800'}`}
                    >ALL</button>
                    {WEAPON_CATEGORIES.map(cat => (
                        <button
                            key={cat.key}
                            onClick={() => setSelectedCategory(cat.key)}
                            className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1 ${selectedCategory === cat.key ? 'text-white' : 'bg-stone-900 text-stone-500 hover:text-white border border-stone-800'}`}
                            style={selectedCategory === cat.key ? { background: CATEGORY_COLORS[cat.key], boxShadow: `0 0 8px ${CATEGORY_COLORS[cat.key]}40` } : {}}
                        >
                            <span>{cat.icon}</span>
                            {cat.label}
                        </button>
                    ))}
                </div>

                {/* Weapon grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {filteredWeapons.map(w => {
                        const catColor = CATEGORY_COLORS[w.category];
                        const isSel = selectedWeapon === w.key;
                        return (
                            <button
                                key={w.key}
                                onClick={() => setSelectedWeapon(isSel ? null : w.key)}
                                className={`ars-card relative bg-stone-900/40 border p-3 rounded-xl text-left transition-all overflow-hidden ${isSel ? 'scale-105' : ''}`}
                                style={{ borderColor: isSel ? catColor : 'rgba(168,162,158,0.15)', boxShadow: isSel ? `0 0 16px ${catColor}40` : '0 2px 8px rgba(0,0,0,0.2)' }}
                            >
                                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: catColor, opacity: 0.6 }} />
                                <div className="flex justify-between items-start mb-2">
                                    <div className="w-10 h-10 bg-black/60 rounded flex items-center justify-center text-lg" style={{ animation: 'arsFloat 4s ease-in-out infinite' }}>
                                        {WEAPON_CATEGORIES.find(c => c.key === w.category)?.icon}
                                    </div>
                                    <div className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded" style={{ color: catColor, background: `${catColor}15`, border: `1px solid ${catColor}30` }}>
                                        {w.category.toUpperCase()}
                                    </div>
                                </div>
                                <div className="text-[11px] font-black text-white uppercase mb-1 leading-tight">{w.name}</div>
                                <div className="flex gap-2 text-[8px] text-stone-500 font-bold">
                                    <span>DMG {w.damage}</span>
                                    <span>RPM {Math.round(60000 / w.fireRate)}</span>
                                </div>
                                <div className="flex gap-2 text-[8px] text-stone-600 font-bold mt-0.5">
                                    <span>MAG {w.magSize}</span>
                                    <span>{w.auto ? 'AUTO' : 'SEMI'}</span>
                                </div>
                                {/* Abilities count badge */}
                                <div className="mt-2 flex gap-1 flex-wrap">
                                    {w.abilities.slice(0, 2).map(a => (
                                        <span key={a.name} className="text-[6px] font-black uppercase tracking-wider px-1 py-0.5 rounded bg-stone-800/60 text-stone-500">{a.name}</span>
                                    ))}
                                    {w.abilities.length > 2 && <span className="text-[6px] font-black text-stone-600">+{w.abilities.length - 2}</span>}
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Weapon detail panel */}
                {selectedWeaponData && (
                    <div className="bg-stone-900/60 border rounded-xl p-4 overflow-hidden" style={{ animation: 'arsSlideIn 0.3s ease-out', borderColor: `${CATEGORY_COLORS[selectedWeaponData.category]}40` }}>
                        <div className="absolute top-0 left-0 right-0 h-1" style={{ background: CATEGORY_COLORS[selectedWeaponData.category] }} />
                        <div className="flex items-start justify-between mb-3">
                            <div>
                                <div className="text-lg font-black text-white uppercase tracking-wider">{selectedWeaponData.name}</div>
                                <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: CATEGORY_COLORS[selectedWeaponData.category] }}>
                                    {WEAPON_CATEGORIES.find(c => c.key === selectedWeaponData.category)?.label}
                                </div>
                            </div>
                            <div className="w-14 h-14 bg-black/60 rounded-lg flex items-center justify-center text-2xl" style={{ animation: 'arsFloat 3s ease-in-out infinite' }}>
                                {WEAPON_CATEGORIES.find(c => c.key === selectedWeaponData.category)?.icon}
                            </div>
                        </div>

                        {/* Stats grid */}
                        <div className="grid grid-cols-4 gap-2 mb-4">
                            <StatBox label="DMG" value={selectedWeaponData.damage} max={100} color={CATEGORY_COLORS[selectedWeaponData.category]} />
                            <StatBox label="RPM" value={Math.round(60000 / selectedWeaponData.fireRate)} max={750} color={CATEGORY_COLORS[selectedWeaponData.category]} />
                            <StatBox label="MAG" value={selectedWeaponData.magSize} max={100} color={CATEGORY_COLORS[selectedWeaponData.category]} />
                            <StatBox label="SPREAD" value={Math.round((1 - selectedWeaponData.spread) * 100)} max={100} color={CATEGORY_COLORS[selectedWeaponData.category]} />
                        </div>

                        {/* Abilities */}
                        <div className="space-y-2">
                            <div className="text-[9px] font-black text-stone-500 uppercase tracking-widest mb-1">Special Abilities</div>
                            {selectedWeaponData.abilities.map(ab => (
                                <div key={ab.name} className="flex items-start gap-2 p-2 bg-black/30 rounded-lg border border-stone-800/50">
                                    <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ background: CATEGORY_COLORS[selectedWeaponData.category] }} />
                                    <div>
                                        <div className="text-[10px] font-black text-white uppercase tracking-wider">{ab.name}</div>
                                        <div className="text-[9px] text-stone-500 font-bold">{ab.description}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Unlock info */}
                        <div className="mt-3 flex justify-between items-center text-[9px] font-black uppercase tracking-widest">
                            <span className="text-stone-600">Unlock: Wave {selectedWeaponData.unlockLevel}</span>
                            <span className="text-orange-500">{selectedWeaponData.cost > 0 ? `${selectedWeaponData.cost} CR` : 'FREE'}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Inventory Display */}
            {!activeAddress ? (
                <div className="relative text-center p-12 bg-black/40 border border-dashed border-stone-800 rounded-xl overflow-hidden">
                    {/* Animated SVG radar */}
                    <div className="flex justify-center mb-4">
                        <svg width="64" height="64" viewBox="0 0 64 64" style={{ animation: 'arsFloat 3s ease-in-out infinite' }}>
                            <circle cx="32" cy="32" r="28" fill="none" stroke="#44403c" strokeWidth="1" strokeDasharray="4 4"/>
                            <circle cx="32" cy="32" r="20" fill="none" stroke="#57534e" strokeWidth="1"/>
                            <circle cx="32" cy="32" r="12" fill="none" stroke="#78716c" strokeWidth="1"/>
                            <circle cx="32" cy="32" r="4" fill="#f97316" opacity="0.6">
                                <animate attributeName="opacity" values="0.3;0.8;0.3" dur="2s" repeatCount="indefinite"/>
                            </circle>
                            <line x1="32" y1="4" x2="32" y2="60" stroke="#44403c" strokeWidth="0.5"/>
                            <line x1="4" y1="32" x2="60" y2="32" stroke="#44403c" strokeWidth="0.5"/>
                        </svg>
                    </div>
                    <div className="text-sm font-black text-stone-600 uppercase">Awaiting_Neural_Link</div>
                    <p className="text-[10px] text-stone-700 mt-2 font-bold uppercase italic">Connect wallet to access your secure inventory</p>
                </div>
            ) : listLoading ? (
                <div className="flex flex-col items-center justify-center p-12 gap-4">
                    <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                    <div className="text-[10px] font-black text-stone-500 uppercase animate-pulse">Scanning_Blockchain...</div>
                </div>
            ) : tokenIds && tokenIds.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                    {tokenIds.map(id => (
                        <SkinItem key={id.toString()} tokenId={id} />
                    ))}
                </div>
            ) : (
                <div className="relative text-center p-12 bg-black/40 border border-dashed border-stone-800 rounded-xl overflow-hidden">
                    {/* Animated SVG crate */}
                    <div className="flex justify-center mb-4">
                        <svg width="64" height="64" viewBox="0 0 64 64" style={{ animation: 'arsFloat 3s ease-in-out infinite' }}>
                            <rect x="14" y="18" width="36" height="36" rx="3" fill="none" stroke="#57534e" strokeWidth="2"/>
                            <line x1="14" y1="30" x2="50" y2="30" stroke="#57534e" strokeWidth="1.5"/>
                            <line x1="32" y1="18" x2="32" y2="54" stroke="#57534e" strokeWidth="1.5"/>
                            <rect x="28" y="24" width="8" height="6" rx="1" fill="#78716c" opacity="0.5">
                                <animate attributeName="opacity" values="0.3;0.7;0.3" dur="3s" repeatCount="indefinite"/>
                            </rect>
                        </svg>
                    </div>
                    <div className="text-sm font-black text-stone-600 uppercase">Inventory_Empty</div>
                    <p className="text-[10px] text-stone-700 mt-2 font-bold uppercase italic">Use the forge above to mint your first tactical skin</p>
                </div>
            )}
        </div>
    );
}

function StatBox({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
    const pct = Math.min(100, (value / max) * 100);
    return (
        <div className="bg-black/40 rounded-lg p-2 border border-stone-800/50">
            <div className="text-[7px] font-black text-stone-500 uppercase tracking-widest mb-1">{label}</div>
            <div className="text-sm font-black text-white mb-1">{value}</div>
            <div className="h-1 bg-stone-800 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
            </div>
        </div>
    );
}

function SkinItem({ tokenId }: { tokenId: bigint }) {
    const isLoading = false;
    const metadata = { rarity: 'common', weaponType: 'pistol', powerBoost: 0n };

    const RARITY_META: Record<string, { color: string; glow: string; border: string; label: string }> = {
        common: { color: '#a8a29e', glow: 'rgba(168,162,158,0.1)', border: 'rgba(168,162,158,0.25)', label: 'COMMON' },
        rare: { color: '#22d3ee', glow: 'rgba(34,211,238,0.12)', border: 'rgba(34,211,238,0.3)', label: 'RARE' },
        legendary: { color: '#f97316', glow: 'rgba(249,115,22,0.15)', border: 'rgba(249,115,22,0.35)', label: 'LEGENDARY' },
    };
    const rar = RARITY_META[metadata.rarity.toLowerCase()] || RARITY_META.common;

    return (
        <button className="ars-card relative tactical-panel bg-stone-900/40 border p-4 rounded-xl text-left hover:border-white transition-all group active:scale-95 overflow-hidden" style={{ borderColor: rar.border, boxShadow: `0 2px 8px rgba(0,0,0,0.2), 0 0 12px ${rar.glow}` }}>
            {/* Top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: rar.color, opacity: 0.5 }} />
            {/* Corner accents */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t border-l" style={{ borderColor: rar.border }} />
            <div className="absolute top-0 right-0 w-3 h-3 border-t border-r" style={{ borderColor: rar.border }} />
            {/* Scanline texture */}
            <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 3px)' }} />
            <div className="flex justify-between items-start mb-4 relative">
                <div className="w-12 h-12 bg-black/60 rounded flex items-center justify-center text-2xl" style={{ animation: 'arsFloat 4s ease-in-out infinite' }}>
                    {metadata.weaponType === 'pistol' && '🔫'}
                    {metadata.weaponType === 'smg' && '⚔️'}
                    {metadata.weaponType === 'shotgun' && '🔥'}
                    {metadata.weaponType === 'railgun' && '⚡'}
                </div>
                <div className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded" style={{ color: rar.color, background: `${rar.color}15`, border: `1px solid ${rar.border}` }}>
                    {rar.label}
                </div>
            </div>
            <div className="text-xs font-black text-white uppercase mb-1 relative">{metadata.weaponType}_SKIN</div>
            <div className="flex justify-between items-center text-[10px] font-bold text-stone-500 relative">
                <span>POWER_BOOST</span>
                <span className="text-orange-500">+{metadata.powerBoost.toString()}%</span>
            </div>
            <div className="mt-3 py-1.5 bg-white/5 rounded text-center text-[8px] font-black text-stone-600 group-hover:text-white transition-all uppercase relative">
                Equip_Asset
            </div>
        </button>
    );
}
