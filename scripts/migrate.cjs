/**
 * migrate.cjs
 *
 * Reads every PlayerRecord from the OLD Base and Celo contracts and
 * replays them into the NEW contracts (deploy first, then run this).
 *
 * Usage:
 *   node scripts/migrate.cjs
 *
 * Required env vars:
 *   EVM_PRIVATE_KEY                      – deployer key (owner of both new contracts)
 *   OLD_BASE_CONTRACT                    – old Base contract address
 *   OLD_CELO_CONTRACT                    – old Celo contract address
 *   VITE_MILITIA_CONTRACT_ADDRESS        – NEW Base contract address
 *   VITE_CELO_MILITIA_CONTRACT_ADDRESS   – NEW Celo contract address
 */

const { createPublicClient, createWalletClient, http } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { base, celo } = require('viem/chains');
require('dotenv').config();

// ── ABI (same for old and new – only read-paths needed from old) ──────────────
const ABI = [
  {
    name: 'getPlayerCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'playerList',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'getStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      { name: 'username',    type: 'string'  },
      { name: 'kills',       type: 'uint256' },
      { name: 'wins',        type: 'uint256' },
      { name: 'gamesPlayed', type: 'uint256' },
      { name: 'pvpKills',    type: 'uint256' },
      { name: 'pvpWins',     type: 'uint256' },
      { name: 'pveKills',    type: 'uint256' },
      { name: 'pveWins',     type: 'uint256' },
      { name: 'registeredAt',type: 'uint256' },
      { name: 'lastMatchAt', type: 'uint256' },
    ],
  },
  {
    name: 'registerPlayer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'player',   type: 'address' },
      { name: 'username', type: 'string'  },
    ],
    outputs: [],
  },
  {
    name: 'recordMatchResult',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'kills',  type: 'uint256' },
      { name: 'wins',   type: 'uint256' },
      { name: 'isPvp',  type: 'bool'    },
    ],
    outputs: [],
  },
];

// ── helpers ───────────────────────────────────────────────────────────────────

function requireEnv(name) {
  const v = process.env[name];
  if (!v) { console.error(`❌  Missing env var: ${name}`); process.exit(1); }
  return v;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function retryRead(fn, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.message || e);
      if ((msg.includes('rate limit') || msg.includes('over rate')) && i < retries - 1) {
        const wait = 3000 * (i + 1);
        console.log(`    ⏳ rate-limited, retrying in ${wait/1000}s...`);
        await sleep(wait);
      } else {
        throw e;
      }
    }
  }
}

/**
 * Fetch all PlayerRecord structs from a contract.
 * Returns an array of { address, username, kills, wins, gamesPlayed,
 *                        pvpKills, pvpWins, pveKills, pveWins }
 */
async function fetchAllPlayers(publicClient, contractAddress) {
  const count = await retryRead(() => publicClient.readContract({
    address: contractAddress,
    abi: ABI,
    functionName: 'getPlayerCount',
  }));

  console.log(`  Found ${count} player(s) in ${contractAddress}`);
  const players = [];

  for (let i = 0n; i < count; i++) {
    await sleep(1500);
    const addr = await retryRead(() => publicClient.readContract({
      address: contractAddress,
      abi: ABI,
      functionName: 'playerList',
      args: [i],
    }));

    await sleep(1500);
    const stats = await retryRead(() => publicClient.readContract({
      address: contractAddress,
      abi: ABI,
      functionName: 'getStats',
      args: [addr],
    }));

    players.push({
      address:    addr,
      username:   stats[0],
      kills:      stats[1],
      wins:       stats[2],
      gamesPlayed:stats[3],
      pvpKills:   stats[4],
      pvpWins:    stats[5],
      pveKills:   stats[6],
      pveWins:    stats[7],
    });

    process.stdout.write(`  [${Number(i) + 1}/${Number(count)}] ${addr} – ${stats[0]}\n`);
  }

  return players;
}

/**
 * Replay a player's record into the new contract.
 * Strategy:
 *   1. registerPlayer
 *   2. If they have pvp stats → one recordMatchResult('pvp', pvpKills, pvpWins)
 *   3. If they have pve stats → one recordMatchResult('pve', pveKills, pveWins)
 *   4. If extra gamesPlayed remain (games with 0 kills / 0 wins) → pad with pve zeros
 *
 * NOTE: The new contract has a 60s cooldown between recordMatchResult calls,
 *       so we wait 61s between the two mode calls when both are needed.
 *       The kill-cap (100) is per call – we chunk if needed.
 */
async function migratePlayer(walletClient, publicClient, contractAddress, player) {
  const MAX_KILLS = 100n;
  const addr = player.address;
  const deployer = walletClient.account.address;

  // ── 1. Register ────────────────────────────────────────────────────────────
  try {
    const nonce = await publicClient.getTransactionCount({ address: deployer, blockTag: 'pending' });
    const regHash = await walletClient.writeContract({
      address: contractAddress,
      abi: ABI,
      functionName: 'registerPlayer',
      args: [addr, player.username],
      gas: 200000n,
      nonce,
    });
    await publicClient.waitForTransactionReceipt({ hash: regHash });
    console.log(`    ✅ registered`);
    await sleep(3000);
  } catch (e) {
    if (e.message?.includes('AlreadyRegistered') || e.message?.includes('ALREADY_REGISTERED')) {
      console.log(`    ⚠️  already registered – skipping register`);
    } else {
      throw e;
    }
  }

  // ── 2. Replay PVP stats ────────────────────────────────────────────────────
  if (player.pvpKills > 0n || player.pvpWins > 0n) {
    await replayMode(walletClient, publicClient, contractAddress, addr, player.pvpKills, player.pvpWins, true, MAX_KILLS);
    // cooldown before next mode call
    if (player.pveKills > 0n || player.pveWins > 0n) {
      console.log(`    ⏳ waiting 62s for cooldown...`);
      await sleep(62000);
    }
  }

  // ── 3. Replay PVE stats ────────────────────────────────────────────────────
  if (player.pveKills > 0n || player.pveWins > 0n) {
    await replayMode(walletClient, publicClient, contractAddress, addr, player.pveKills, player.pveWins, false, MAX_KILLS);
  }

  // ── 4. Pad remaining gamesPlayed (0-kill/0-win games) ─────────────────────
  const replayedGames = ((player.pvpKills > 0n || player.pvpWins > 0n) ? 1n : 0n)
                      + ((player.pveKills > 0n || player.pveWins > 0n) ? 1n : 0n);
  const extraGames = player.gamesPlayed - replayedGames;

  for (let g = 0n; g < extraGames; g++) {
    console.log(`    ⏳ waiting 62s for cooldown (pad game ${g + 1n}/${extraGames})...`);
    await sleep(62000);
    const nonce = await publicClient.getTransactionCount({ address: deployer, blockTag: 'pending' });
    const h = await walletClient.writeContract({
      address: contractAddress,
      abi: ABI,
      functionName: 'recordMatchResult',
      args: [addr, 0n, 0n, false],
      gas: 200000n,
      nonce,
    });
    await publicClient.waitForTransactionReceipt({ hash: h });
    console.log(`    ✅ padded game`);
  }
}

/**
 * Replay kills/wins for one mode, chunking kills into ≤100 per tx.
 */
async function replayMode(walletClient, publicClient, contractAddress, addr, kills, wins, isPvp, MAX_KILLS) {
  const deployer = walletClient.account.address;
  // Send wins in first chunk, then remaining kill-only chunks
  let remaining = kills;
  let winsToSend = wins;
  let first = true;

  while (remaining > 0n || (first && winsToSend > 0n)) {
    const chunk = remaining > MAX_KILLS ? MAX_KILLS : remaining;
    const w = first ? winsToSend : 0n;

    if (!first) {
      console.log(`    ⏳ waiting 62s for cooldown (kill chunk)...`);
      await sleep(62000);
    }

    const nonce = await publicClient.getTransactionCount({ address: deployer, blockTag: 'pending' });
    const h = await walletClient.writeContract({
      address: contractAddress,
      abi: ABI,
      functionName: 'recordMatchResult',
      args: [addr, chunk, w, isPvp],
      gas: 200000n,
      nonce,
    });
    await publicClient.waitForTransactionReceipt({ hash: h });
    console.log(`    ✅ ${isPvp ? 'pvp' : 'pve'} chunk: kills=${chunk} wins=${w}`);

    remaining -= chunk;
    winsToSend = 0n;
    first = false;

    if (remaining > 0n) {
      console.log(`    ⏳ waiting 62s for cooldown (next chunk)...`);
      await sleep(62000);
    }
  }

  // Edge: player has wins but 0 kills
  if (first && winsToSend > 0n) {
    const nonce = await publicClient.getTransactionCount({ address: deployer, blockTag: 'pending' });
    const h = await walletClient.writeContract({
      address: contractAddress,
      abi: ABI,
      functionName: 'recordMatchResult',
      args: [addr, 0n, winsToSend, isPvp],
      gas: 200000n,
      nonce,
    });
    await publicClient.waitForTransactionReceipt({ hash: h });
    console.log(`    ✅ ${isPvp ? 'pvp' : 'pve'}: kills=0 wins=${winsToSend}`);
  }
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const pk             = requireEnv('EVM_PRIVATE_KEY');
  const oldBase        = requireEnv('OLD_BASE_CONTRACT');
  const oldCelo        = requireEnv('OLD_CELO_CONTRACT');
  const newBase        = requireEnv('VITE_MILITIA_CONTRACT_ADDRESS');
  const newCelo        = requireEnv('VITE_CELO_MILITIA_CONTRACT_ADDRESS');

  const account = privateKeyToAccount(pk.startsWith('0x') ? pk : `0x${pk}`);
  console.log(`\n🔑 Deployer: ${account.address}`);

  const BASE_RPC = process.env.VITE_BASE_MAINNET_RPC || 'https://mainnet.base.org';
  const CELO_RPC_URL = 'https://forno.celo.org';

  // ── Base ──────────────────────────────────────────────────────────────────
  const basePub = createPublicClient({ chain: base, transport: http(BASE_RPC) });
  const baseWal = createWalletClient({ account, chain: base, transport: http(BASE_RPC) });

  // ── Celo ──────────────────────────────────────────────────────────────────
  const celoPub = createPublicClient({ chain: celo, transport: http(CELO_RPC_URL) });
  const celoWal = createWalletClient({ account, chain: celo, transport: http(CELO_RPC_URL) });

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n📖 Reading OLD Base contract...');
  const basePlayers = await fetchAllPlayers(basePub, oldBase);

  console.log('\n📖 Reading OLD Celo contract...');
  const celoPlayers = await fetchAllPlayers(celoPub, oldCelo);

  // ─────────────────────────────────────────────────────────────────────────
  if (basePlayers.length === 0 && celoPlayers.length === 0) {
    console.log('\n✅ No players to migrate. Done.');
    return;
  }

  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n🚀 Migrating to NEW Base contract...');
  for (const p of basePlayers) {
    console.log(`\n  👤 ${p.address} (${p.username})`);
    await migratePlayer(baseWal, basePub, newBase, p);
  }

  console.log('\n🚀 Migrating to NEW Celo contract...');
  for (const p of celoPlayers) {
    console.log(`\n  👤 ${p.address} (${p.username})`);
    await migratePlayer(celoWal, celoPub, newCelo, p);
  }

  console.log('\n✅ Migration complete!');
  console.log('  Old contracts remain readable on-chain as historical archive.');
  console.log(`  New Base:  ${newBase}`);
  console.log(`  New Celo:  ${newCelo}`);
}

main().catch(err => { console.error('\n❌ Migration failed:', err); process.exit(1); });
