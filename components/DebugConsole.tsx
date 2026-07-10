import React, { useEffect, useState, useRef } from 'react';

export const DebugConsole: React.FC = () => {
    const [logs, setLogs] = useState<string[]>([]);
    const [isVisible, setIsVisible] = useState(false);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleLog = (e: CustomEvent<{ message: string, type: 'info' | 'error' | 'success' }>) => {
            const time = new Date().toLocaleTimeString().split(' ')[0];
            const typePrefix = e.detail.type === 'error' ? '[ERR]' : e.detail.type === 'success' ? '[OK]' : '[INFO]';
            setLogs(prev => [...prev.slice(-99), `[${time}] ${typePrefix} ${e.detail.message}`]);
        };

        window.addEventListener('MULTIPLAYER_LOG' as any, handleLog as any);
        return () => window.removeEventListener('MULTIPLAYER_LOG' as any, handleLog as any);
    }, []);

    useEffect(() => {
        if (isVisible) endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs, isVisible]);

    if (!isVisible) {
        return (
            <button
                onClick={() => setIsVisible(true)}
                className="fixed top-2 left-2 z-[9999] bg-black/50 text-white/30 text-[8px] p-1 rounded hover:bg-black hover:text-white transition-all font-mono"
            >
                DEBUG_TERM
            </button>
        );
    }

    return (
        <div className="fixed top-0 left-0 w-full md:w-1/3 h-1/3 md:h-full bg-black/90 z-[9999] text-[#0f0] font-mono text-[10px] md:text-xs p-2 overflow-hidden flex flex-col border-r border-stone-800 shadow-2xl">
            <div className="flex justify-between items-center border-b border-stone-700 pb-1 mb-2">
                <span className="font-bold text-green-400">NET_DIAGNOSTICS // LIVE</span>
                <div className="flex gap-2">
                    <button onClick={() => setLogs([])} className="text-stone-500 hover:text-white">[CLR]</button>
                    <button onClick={() => setIsVisible(false)} className="text-red-500 hover:text-red-400">[X]</button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto space-y-0.5 break-all">
                {logs.map((log, i) => {
                    let colorClass = 'text-stone-400';
                    if (log.includes('[ERR]')) colorClass = 'text-red-500';
                    else if (log.includes('[OK]')) colorClass = 'text-green-400';
                    else if (log.includes('MULTIPLAYER INIT')) colorClass = 'text-yellow-400';
                    else if (log.includes('ROOM')) colorClass = 'text-cyan-400';
                    else if (log.includes('ICE')) colorClass = 'text-purple-400';
                    
                    return (
                        <div key={i} className={colorClass}>
                            {log}
                        </div>
                    );
                })}
                <div ref={endRef} />
            </div>
        </div>
    );
};
