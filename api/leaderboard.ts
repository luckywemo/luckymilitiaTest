import { redis, K } from '../utils/redis';

export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    if (req.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        const url = new URL(req.url);
        const period = url.searchParams.get('period') || 'alltime';
        const type = url.searchParams.get('type') || 'combined'; // combined, pve, pvp
        const safePeriod = period.replace(/[^a-zA-Z0-9:]/g, '');
        const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '100', 10) || 100, 1), 100);

        let cacheKey = `lm:cache:lb:${safePeriod}:${type}:${limit}`;

        // 1. Try Cache
        const cached = await redis.get(cacheKey);
        if (cached) {
            return new Response(JSON.stringify(cached), { headers: { 'Content-Type': 'application/json' } });
        }

        console.log(`[Leaderboard] Fetching for period: ${safePeriod}`);

        // 2. Fetch top N from Redis ZSET
        let lbKey = K.LB_SCORE(safePeriod);
        if (type === 'pvp') lbKey = K.LB_PVP(safePeriod);
        if (type === 'pve') lbKey = K.LB_PVE(safePeriod);
        
        const topWithScores = await redis.zrange(lbKey, 0, limit - 1, { rev: true, withScores: true });

        if (!topWithScores || topWithScores.length === 0) {
            return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
        }

        // 3. Hydrate with detailed stats from HASH
        const pipeline = redis.pipeline();
        const entries: { member: string, score: number }[] = [];
        
        for (let i = 0; i < topWithScores.length; i += 2) {
            const member = topWithScores[i] as string;
            const score = Number(topWithScores[i + 1]);
            entries.push({ member, score });
            
            const statsKey = K.STATS_HASH(safePeriod, member);
            pipeline.hgetall(statsKey);
        }

        const details = await pipeline.exec();

        const leaderboardData = entries.map((entry, i) => {
            const stat = (details[i] as any) || {};
            return {
                address: entry.member,
                username: stat.username || null,
                score: entry.score,
                kills: Number(stat.kills || 0),
                wins: Number(stat.wins || 0),
                lastCombat: Number(stat.lastCombat || 0)
            };
        });

        // 4. Cache for 30 seconds (shorter cache for dynamic names)
        await redis.set(cacheKey, leaderboardData, { ex: 30 });

        return new Response(JSON.stringify(leaderboardData), {
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Leaderboard] API Error:', error);
        return new Response(JSON.stringify({ 
            error: 'Internal Server Error', 
            details: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

