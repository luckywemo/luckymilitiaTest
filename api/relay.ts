
import { redis, K } from '../utils/redis';
import { createWalletClient, createPublicClient, http, encodeFunctionData, Chain, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, celo } from 'viem/chains';

/**
 * Server-side relay for Base contract writes.
 * 
 * Signs and broadcasts REAL transactions using the deployer key.
 * The deployer is the contract owner, so it passes the access control check.
 * 
 * WHY: Sequence embedded wallets (email login) are smart contract wallets.
 * The LuckyMilitiaStats contract checks `tx.origin == msg.sender` for auth,
 * which fails for AA wallets. This relay uses the deployer key (contract owner).
 */

const BASE_CONTRACT = (process.env.VITE_MILITIA_CONTRACT_ADDRESS || '0x68d4c7ce98bf4810f306661091e977cd57190dc6') as `0x${string}`;
const CELO_CONTRACT = (process.env.VITE_CELO_MILITIA_CONTRACT_ADDRESS || '0xd5d73ec65ef90c98a51bfaf0b71e9ca3dc92dad2') as `0x${string}`;
const EVM_PRIVATE_KEY = process.env.EVM_PRIVATE_KEY;
const BASE_RPC = process.env.VITE_BASE_MAINNET_RPC || 'https://mainnet.base.org';
const CELO_RPC = process.env.VITE_CELO_RPC || 'https://forno.celo.org';

// ABI for the two write functions and the errors the contract reverts with
const MILITIA_ABI = [
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

export const config = {
    runtime: 'edge',
};

export default async function handler(request: Request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  if (!EVM_PRIVATE_KEY) {
    console.error('[Relay] EVM_PRIVATE_KEY not configured');
    return new Response(JSON.stringify({ error: 'Server relay not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json() as {
      action: string;
      player: string;
      username?: string;
      kills?: number;
      wins?: number;
      isPvp?: boolean;
      chainType?: string;
    };
    const { action, player, username, kills, wins, isPvp, chainType } = body;

    const isCelo = chainType === 'celo';
    const targetChain: Chain = isCelo ? celo : base;
    const targetRpc = isCelo ? CELO_RPC : BASE_RPC;
    const targetContract = isCelo ? CELO_CONTRACT : BASE_CONTRACT;

    if (!action || !player) {
      return new Response(JSON.stringify({ error: 'Missing action or player' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create viem clients with deployer key
    const account = privateKeyToAccount(`0x${EVM_PRIVATE_KEY.replace('0x', '')}` as `0x${string}`);
    
    const publicClient = createPublicClient({
      chain: targetChain,
      transport: http(targetRpc),
    });

    const walletClient = createWalletClient({
      account,
      transport: http(targetRpc),
    });

    // viem 2.48 EIP-7702 overloads added authorizationList as required in some
    // generic paths. This helper bypasses that TS constraint; runtime is correct.
    const writeRelayed = (params: Record<string, unknown>) =>
      (walletClient.writeContract as (p: unknown) => Promise<`0x${string}`>)(params);

    let hash: string;

    if (action === 'register') {
      if (!username) {
        return new Response(JSON.stringify({ error: 'Missing username' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      try {
        // Simulate first to catch reverts (e.g., ALREADY_REGISTERED)
        await publicClient.simulateContract({
          address: targetContract,
          abi: MILITIA_ABI,
          functionName: 'registerPlayer',
          args: [player as `0x${string}`, username],
          account,
        });

        // Send the real transaction
        hash = await writeRelayed({
          address: targetContract,
          abi: MILITIA_ABI,
          functionName: 'registerPlayer',
          args: [player as `0x${string}`, username],
          gas: 200000n,
          chain: targetChain,
        });

        console.log(`[Relay] ✅ registerPlayer TX sent! Hash: ${hash}`);

      } catch (err: any) {
        const msg = err?.message || '';
        if (msg.includes('AlreadyRegistered') || msg.includes('ALREADY_REGISTERED') || msg.includes('0x3a81d6fc')) {
          console.log(`[Relay] Player ${player} already registered on-chain.`);
          return new Response(JSON.stringify({ 
            success: true, hash: null, 
            note: 'Already registered on-chain' 
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        throw err;
      }

    } else if (action === 'recordMatch') {
      const k = kills || 0;
      const w = wins || 0;
      const pvp = isPvp ?? false;

      // Hardcoded limits from LuckyMilitiaStats.sol (no redeploy)
      const MAX_KILLS_PER_MATCH = 100;
      if (w > 1) throw new Error('InvalidWinCount');
      if (k > MAX_KILLS_PER_MATCH) throw new Error('KillCapExceeded');

      const isStartMatch = k === 0 && w === 0;

      if (isStartMatch) {
        // Fast path for start-of-mission (0,0): skip simulate to sign immediately.
        // CooldownActive may cause a failed transaction; the caller accepted this risk.
        const isRegistered = await publicClient.readContract({
          address: targetContract,
          abi: MILITIA_ABI,
          functionName: 'isRegistered',
          args: [player as `0x${string}`],
        });

        if (isRegistered) {
          hash = await writeRelayed({
            address: targetContract,
            abi: MILITIA_ABI,
            functionName: 'recordMatchResult',
            args: [player as `0x${string}`, BigInt(k), BigInt(w), pvp],
            gas: 250000n,
            chain: targetChain,
          });
          console.log(`[Relay] ✅ startMatchResult TX sent! Hash: ${hash} | PvP:${pvp}`);
        } else {
          console.log(`[Relay] Player not registered, auto-registering before start match...`);
          const regUsername = username || `OP_${player.slice(0, 6)}`;

          const nonce = await publicClient.getTransactionCount({
            address: account.address,
            blockTag: 'pending',
          });

          const regHash = await writeRelayed({
            address: targetContract,
            abi: MILITIA_ABI,
            functionName: 'registerPlayer',
            args: [player as `0x${string}`, regUsername],
            gas: 200000n,
            chain: targetChain,
            nonce,
          });
          console.log(`[Relay] Auto-registered: ${regHash}`);

          hash = await writeRelayed({
            address: targetContract,
            abi: MILITIA_ABI,
            functionName: 'recordMatchResult',
            args: [player as `0x${string}`, BigInt(k), BigInt(w), pvp],
            gas: 250000n,
            chain: targetChain,
            nonce: nonce + 1n,
          });
          console.log(`[Relay] ✅ startMatchResult TX sent after auto-register! Hash: ${hash}`);
        }
      } else {
        // End-of-match: keep the simulate preflight to avoid CooldownActive gas.
        try {
          await publicClient.simulateContract({
            address: targetContract,
            abi: MILITIA_ABI,
            functionName: 'recordMatchResult',
            args: [player as `0x${string}`, BigInt(k), BigInt(w), pvp],
            account,
          });

          hash = await writeRelayed({
            address: targetContract,
            abi: MILITIA_ABI,
            functionName: 'recordMatchResult',
            args: [player as `0x${string}`, BigInt(k), BigInt(w), pvp],
            gas: 250000n,
            chain: targetChain,
          });

          console.log(`[Relay] ✅ recordMatchResult TX sent! Hash: ${hash} | K:${k} W:${w} PvP:${pvp}`);

        } catch (err: any) {
          const msg = err?.message || '';
          if (msg.includes('PlayerNotRegistered') || msg.includes('0x37ae9e4c')) {
            // Auto-register first, then record. Use sequential nonces so record is queued
            // immediately after register without waiting for the registration receipt.
            console.log(`[Relay] Player not registered, auto-registering...`);
            const regUsername = username || `OP_${player.slice(0, 6)}`;

            const nonce = await publicClient.getTransactionCount({
              address: account.address,
              blockTag: 'pending',
            });

            const regHash = await writeRelayed({
              address: targetContract,
              abi: MILITIA_ABI,
              functionName: 'registerPlayer',
              args: [player as `0x${string}`, regUsername],
              gas: 200000n,
              chain: targetChain,
              nonce,
            });
            console.log(`[Relay] Auto-registered: ${regHash}`);

            hash = await writeRelayed({
              address: targetContract,
              abi: MILITIA_ABI,
              functionName: 'recordMatchResult',
              args: [player as `0x${string}`, BigInt(k), BigInt(w), pvp],
              gas: 250000n,
              chain: targetChain,
              nonce: nonce + 1n,
            });
            console.log(`[Relay] ✅ recordMatchResult TX sent after auto-register! Hash: ${hash}`);
          } else {
            throw err;
          }
        }
      }

    } else {
      return new Response(JSON.stringify({ error: 'Unknown action' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Also update Redis for instant leaderboard
    const now = new Date();
    const ymd = now.toISOString().split('T')[0].replace(/-/g, '');

    if (action === 'register' && username) {
      const pipeline = redis.pipeline();
      const periods = ['alltime', `daily:${ymd}`, `monthly:${ymd.substring(0, 6)}`];
      for (const p of periods) {
        pipeline.zadd(K.LB_SCORE(p), { nx: true }, { score: 0, member: player });
        pipeline.hset(K.STATS_HASH(p, player), { username, registered: Date.now() });
      }
      await pipeline.exec();
    }

    return new Response(JSON.stringify({ 
      success: true, 
      hash,
      explorer: isCelo ? `https://celoscan.io/tx/${hash}` : `https://basescan.org/tx/${hash}`,
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e: any) {
    console.error('[Relay] Error:', e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || 'Relay failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
