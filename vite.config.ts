import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    resolve: {
      alias: {
        'vite-plugin-node-polyfills/shims/global': path.resolve(process.cwd(), 'node_modules/vite-plugin-node-polyfills/shims/global'),
      }
    },
    plugins: [
      react(),
      nodePolyfills({
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
        protocolImports: true,
      }),
      // ── Dev-only API relay for Base contract writes ──
      {
        name: 'api-relay',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            // Handle /api/relay
            if (req.url === '/api/relay' && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => body += chunk);
              req.on('end', async () => {
                try {
                  const data = JSON.parse(body);
                  const result = await handleRelay(data, env);
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify(result));
                } catch (e: any) {
                  console.error('[API Relay] Error:', e?.message || e);
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: e?.message || 'Relay failed' }));
                }
              });
              return;
            }

            // Handle /api/register
            if (req.url === '/api/register' && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => body += chunk);
              req.on('end', async () => {
                try {
                  // Just log it in dev mode — Redis may not be available locally
                  const data = JSON.parse(body);
                  console.log(`[API Register] ${data.username} (${data.address})`);
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true }));
                } catch (e: any) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: e?.message }));
                }
              });
              return;
            }

            // Handle /api/sync-stats
            if (req.url === '/api/sync-stats' && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => body += chunk);
              req.on('end', async () => {
                try {
                  const data = JSON.parse(body);
                  console.log(`[API Sync] ${data.username} | K:${data.kills} W:${data.wins} M:${data.mode}`);
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ success: true, score_added: 0 }));
                } catch (e: any) {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: e?.message }));
                }
              });
              return;
            }

            // Handle /api/stats/:address
            if (req.url?.startsWith('/api/stats/') && req.method === 'GET') {
              const address = req.url.replace('/api/stats/', '').split('?')[0];
              try {
                if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
                  // Fetch real stats from Redis in dev if configured
                  const { Redis } = await import('@upstash/redis');
                  const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN });
                  const statsKey = `lm:stats:alltime:${address.toLowerCase()}`;
                  const stats = await redis.hgetall(statsKey);
                  
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify(stats || { username: null, kills: 0, wins: 0, gamesPlayed: 0 }));
                } else {
                  res.writeHead(200, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ username: null, kills: 0, wins: 0, gamesPlayed: 0 }));
                }
              } catch (e) {
                console.error('[Dev API] Stats error:', e);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ username: null, kills: 0, wins: 0, gamesPlayed: 0 }));
              }
              return;
            }

            next();
          });
        }
      }
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.VITE_WALLETCONNECT_PROJECT_ID': JSON.stringify(env.VITE_WALLETCONNECT_PROJECT_ID),
    },
    server: {
      port: 3000,
    },
    build: {
      target: 'esnext',
      commonjsOptions: {
        transformMixedEsModules: true,
        include: [/node_modules/],
      }
    },
    optimizeDeps: {
      include: [
        'eventemitter3',
        'dayjs',
        'dayjs/locale/en',
        'dayjs/plugin/relativeTime',
        '@0xsequence/kit',
        '@0xsequence/waas',
        'wagmi',
        'viem'
      ]
    }
  };
});

// ── Relay handler for dev mode ──
async function handleRelay(data: any, env: Record<string, string>) {
  const { action, player, username, kills, wins, isPvp, chainType } = data;
  const isCelo = chainType === 'celo';
  const EVM_KEY = env.EVM_PRIVATE_KEY;
  const CONTRACT = isCelo
    ? (env.VITE_CELO_MILITIA_CONTRACT_ADDRESS || '0xd5d73ec65ef90c98a51bfaf0b71e9ca3dc92dad2')
    : (env.VITE_MILITIA_CONTRACT_ADDRESS || '0x68d4c7ce98bf4810f306661091e977cd57190dc6');
  const RPC = isCelo
    ? (env.VITE_CELO_RPC || 'https://forno.celo.org')
    : (env.VITE_BASE_MAINNET_RPC || 'https://mainnet.base.org');

  if (!EVM_KEY) {
    return { error: 'EVM_PRIVATE_KEY not set in .env' };
  }
  if (!action || !player) {
    return { error: 'Missing action or player' };
  }

  // Dynamic import viem (available in node_modules)
  const { createWalletClient, createPublicClient, http } = await import('viem');
  const { privateKeyToAccount } = await import('viem/accounts');
  const { base, celo } = await import('viem/chains');
  const CHAIN = isCelo ? celo : base;

  const ABI = [
    {
      name: 'registerPlayer',
      type: 'function' as const,
      stateMutability: 'nonpayable' as const,
      inputs: [
        { name: 'player', type: 'address' as const },
        { name: 'username', type: 'string' as const },
      ],
      outputs: [],
    },
    {
      name: 'recordMatchResult',
      type: 'function' as const,
      stateMutability: 'nonpayable' as const,
      inputs: [
        { name: 'player', type: 'address' as const },
        { name: 'kills', type: 'uint256' as const },
        { name: 'wins', type: 'uint256' as const },
        { name: 'isPvp', type: 'bool' as const },
      ],
      outputs: [],
    },
    {
      name: 'isRegistered',
      type: 'function' as const,
      stateMutability: 'view' as const,
      inputs: [{ name: 'player', type: 'address' as const }],
      outputs: [{ name: '', type: 'bool' as const }],
    },
    { type: 'error' as const, name: 'PlayerNotRegistered', inputs: [] },
    { type: 'error' as const, name: 'AlreadyRegistered', inputs: [] },
    { type: 'error' as const, name: 'NotAuthorized', inputs: [] },
    { type: 'error' as const, name: 'NotOwner', inputs: [] },
    { type: 'error' as const, name: 'InvalidUsername', inputs: [] },
    { type: 'error' as const, name: 'InvalidWinCount', inputs: [] },
    { type: 'error' as const, name: 'KillCapExceeded', inputs: [] },
    { type: 'error' as const, name: 'CooldownActive', inputs: [] },
    { type: 'error' as const, name: 'ZeroAddress', inputs: [] },
    { type: 'error' as const, name: 'PlayerNotFound', inputs: [] },
  ] as const;

  const account = privateKeyToAccount(`0x${EVM_KEY.replace('0x', '')}` as `0x${string}`);
  const contractAddr = CONTRACT as `0x${string}`;

  const publicClient = createPublicClient({ chain: CHAIN, transport: http(RPC) });
  const walletClient = createWalletClient({ account, transport: http(RPC) });
  const writeRelayed = (params: Record<string, unknown>) =>
    (walletClient.writeContract as (p: unknown) => Promise<`0x${string}`>)(params);

  let hash: string;

  if (action === 'register') {
    if (!username) return { error: 'Missing username' };
    try {
      await publicClient.simulateContract({
        address: contractAddr, abi: ABI, functionName: 'registerPlayer',
        args: [player as `0x${string}`, username], account,
      });
      hash = await writeRelayed({
        address: contractAddr, abi: ABI, functionName: 'registerPlayer',
        args: [player as `0x${string}`, username],
        gas: 200000n, chain: base,
      });
      console.log(`[Relay] ✅ registerPlayer TX: ${hash}`);
    } catch (err: any) {
      if (err?.message?.includes('AlreadyRegistered') || err?.message?.includes('ALREADY_REGISTERED')) {
        console.log(`[Relay] Already registered: ${player}`);
        return { success: true, hash: null, note: 'Already registered on-chain' };
      }
      throw err;
    }

  } else if (action === 'recordMatch') {
    const k = kills || 0, w = wins || 0, pvp = isPvp ?? false;
    const playerAddr = player as `0x${string}`;

    try {
      // Try to record directly first
      await publicClient.simulateContract({
        address: contractAddr, abi: ABI, functionName: 'recordMatchResult',
        args: [playerAddr, BigInt(k), BigInt(w), pvp], account,
      });
      hash = await writeRelayed({
        address: contractAddr, abi: ABI, functionName: 'recordMatchResult',
        args: [playerAddr, BigInt(k), BigInt(w), pvp],
        gas: 250000n, chain: base,
      });
      console.log(`[Relay] ✅ recordMatchResult TX: ${hash} | K:${k} W:${w} PvP:${pvp}`);
    } catch (err: any) {
      const errMsg = err?.message || '';
      if (errMsg.includes('PlayerNotRegistered') || errMsg.includes('0x37ae9e4c')) {
        console.log(`[Relay] Auto-registering ${player}...`);
        const regName = username || `OP_${player.slice(0, 6)}`;
        const regHash = await writeRelayed({
          address: contractAddr, abi: ABI, functionName: 'registerPlayer',
          args: [playerAddr, regName],
          gas: 200000n, chain: base,
        });
        console.log(`[Relay] Auto-register TX: ${regHash}`);
        await publicClient.waitForTransactionReceipt({ hash: regHash });

        hash = await writeRelayed({
          address: contractAddr, abi: ABI, functionName: 'recordMatchResult',
          args: [playerAddr, BigInt(k), BigInt(w), pvp],
          gas: 250000n, chain: base,
        });
        console.log(`[Relay] ✅ recordMatchResult TX (after register): ${hash}`);
      } else {
        throw err;
      }
    }
  } else {
    return { error: 'Unknown action' };
  }

  const explorer = isCelo
    ? `https://celoscan.io/tx/${hash}`
    : `https://basescan.org/tx/${hash}`;
  return { success: true, hash, explorer };
}

