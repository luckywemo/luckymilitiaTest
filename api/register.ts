
import { redis, K } from '../utils/redis';

/**
 * Register a new operator to the leaderboard with 0 scores.
 * Ensures they appear in the UI immediately.
 */
export const config = {
    runtime: 'edge',
};

export default async function handler(request: Request) {
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const body = await request.json();
        const { address, username } = body;

        if (!address || !username) {
            return new Response('Invalid Request', { status: 400 });
        }

        const now = new Date();
        const ymd = now.toISOString().split('T')[0].replace(/-/g, '');
        const ym = ymd.substring(0, 6);

        const periods = ['alltime', `daily:${ymd}`, `monthly:${ym}`];

        const pipeline = redis.pipeline();
        for (const p of periods) {
            // Only add if not already exists in the general and mode-specific leaderboards
            pipeline.zadd(K.LB_SCORE(p), { nx: true }, { score: 0, member: address });
            pipeline.zadd(K.LB_PVP(p), { nx: true }, { score: 0, member: address });
            pipeline.zadd(K.LB_PVE(p), { nx: true }, { score: 0, member: address });
            
            const statsKey = K.STATS_HASH(p, address);
            // Ensure basic info exists
            pipeline.hset(statsKey, { username });
            pipeline.hsetnx(statsKey, 'kills', 0);
            pipeline.hsetnx(statsKey, 'wins', 0);
            pipeline.hsetnx(statsKey, 'score', 0);
            pipeline.hsetnx(statsKey, 'lastCombat', Date.now());
        }

        await pipeline.exec();
        console.log(`[Register] Operator indexed: ${username} (${address})`);

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (e: any) {
        console.error('[Register] Error:', e);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
