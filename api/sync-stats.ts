
import { redis, K } from '../utils/redis';

/**
 * Sync stats to Redis (leaderboard cache).
 * On-chain writes are handled by api/relay.ts via Base/Celo contracts.
 */
export const config = {
    runtime: 'edge',
};

export default async function handler(request: Request) {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const body = await request.json() as {
            address: string;
            kills: number;
            wins: number;
            username?: string;
            mode?: string;
        };
        const { address, kills, wins, username, mode } = body;

        if (!address || typeof kills !== 'number' || typeof wins !== 'number') {
            return new Response('Invalid Request', { status: 400 });
        }

        // PvP kills and wins are worth significantly more to prioritize PvP skill
        const isPvP = mode === 'multiplayer';
        const killWeight = isPvP ? 25 : 5;
        const winWeight = isPvP ? 100 : 20;
        const score = (kills * killWeight) + (wins * winWeight);

        // --- PART 1: REDIS UPDATE (Performance/Leaderboard) ---
        const now = new Date();
        const ymd = now.toISOString().split('T')[0].replace(/-/g, '');
        const ym = ymd.substring(0, 6);

        const periods = [
            { key: 'alltime' },
            { key: `daily:${ymd}` },
            { key: `monthly:${ym}` }
        ];

        const pipeline = redis.pipeline();
        for (const p of periods) {
            // General Leaderboard
            pipeline.zincrby(K.LB_SCORE(p.key), score, address);
            
            // Mode Specific Leaderboard
            if (mode === 'multiplayer') {
                pipeline.zincrby(K.LB_PVP(p.key), score, address);
            } else {
                pipeline.zincrby(K.LB_PVE(p.key), score, address);
            }

            const statsKey = K.STATS_HASH(p.key, address);
            pipeline.hincrby(statsKey, 'kills', kills);
            pipeline.hincrby(statsKey, 'wins', wins);
            pipeline.hincrby(statsKey, 'score', score);
            
            if (mode === 'multiplayer') {
                pipeline.hincrby(statsKey, 'pvp_kills', kills);
                pipeline.hincrby(statsKey, 'pvp_wins', wins);
            }

            pipeline.hset(statsKey, { lastCombat: Date.now() });
            if (username) {
                pipeline.hset(statsKey, { username });
            }

            // Invalidate the cache for this period so the leaderboard reflects the update immediately
            pipeline.del(`lm:cache:lb:${p.key}`);
        }
        await pipeline.exec();
        console.log(`[Sync] Updated Redis for ${address} (Name: ${username}, Score +${score})`);

        return new Response(JSON.stringify({ success: true, score_added: score }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[Sync] Error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
