import { useAccount, useBalance } from 'wagmi';
import { storage } from './storage';
import { useMemo, useCallback, useState, useEffect } from 'react';
import { MILITIA_STATS_ABI } from './contractABI';
import { MILITIA_CONTRACT_ADDRESS, activeChain } from './web3Config';
import {
  isMiniPay,
  getMiniPayAddress,
  celoRegisterPlayer,
  celoRecordMatch,
  celoGetStats,
  celoGetBalance,
} from './celoProvider';

// ──────────────────────────────────────────
// Blockchain Stats — Sequence + Base Edition
// ──────────────────────────────────────────
// All players now have real wallets (Sequence embedded).
// Stats are written to the LuckyMilitiaStats contract on Base
// via a SERVER-SIDE RELAY (api/relay.ts).
// 
// WHY NOT DIRECT writeContract?
// Sequence email-login wallets are smart contract wallets (AA).
// The LuckyMilitiaStats contract checks tx.origin == msg.sender,
// which fails for AA wallets. The relay uses the deployer key
// (contract owner) to write on behalf of the player.
//
// Redis remains as a fast-read cache for the leaderboard API.

export interface PlayerStats {
  username: string;
  kills: number;
  wins: number;
  gamesPlayed: number;
  pvpKills?: number;
  pvpWins?: number;
  pveKills?: number;
  pveWins?: number;
}

const CONTRACT_LIVE = MILITIA_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';

export function useBlockchainStats() {
  const { address, isConnected, chain } = useAccount();
  const { data: balanceData } = useBalance({ 
    address,
    chainId: activeChain.id,
    query: {
      refetchInterval: 5000 // Refresh every 5 seconds to detect funding
    }
  });

  // ── MiniPay Detection (runtime, no provider changes) ──
  const [miniPayAddr, setMiniPayAddr] = useState<string | null>(null);
  const onMiniPay = isMiniPay();

  useEffect(() => {
    if (onMiniPay) {
      getMiniPayAddress().then(addr => {
        if (addr) {
          setMiniPayAddr(addr);
          console.log(`[Celo] MiniPay detected! Address: ${addr}`);
        }
      });
    }
  }, [onMiniPay]);

  const activeAddress = useMemo(() => {
    // MiniPay address takes priority when in MiniPay browser
    if (onMiniPay && miniPayAddr) return miniPayAddr;
    if (isConnected && address) return address;
    return storage.getItem('lm_address') || null;
  }, [isConnected, address, onMiniPay, miniPayAddr]);

  const chainName = useMemo(() => {
    if (onMiniPay) return 'Celo';
    if (isConnected && chain) return chain.name;
    if (isConnected) return activeChain.name;
    return 'GUEST_NETWORK';
  }, [isConnected, chain, onMiniPay]);

  const [celoBalance, setCeloBalance] = useState<number | null>(null);

  useEffect(() => {
    if (onMiniPay && miniPayAddr) {
      const fetchBalance = async () => {
        const balStr = await celoGetBalance();
        setCeloBalance(parseFloat(balStr));
      };
      fetchBalance();
      const interval = setInterval(fetchBalance, 5000);
      return () => clearInterval(interval);
    }
  }, [onMiniPay, miniPayAddr]);

  const hasFunds = useMemo(() => {
    if (onMiniPay) {
      // Check if they have at least a tiny bit of CELO to cover gas (0.0001 CELO is plenty for Celo)
      if (celoBalance === null) return true; // optimistic while loading
      return celoBalance >= 0.0001;
    }
    if (!isConnected || !balanceData) return true;
    
    // 0.00002 ETH is enough to cover multiple transactions on Base
    return balanceData.value >= 20000000000000n;
  }, [isConnected, balanceData, onMiniPay, celoBalance]);

  // ── REGISTER PLAYER (on-chain + Redis) ──
  const setUsername = useCallback(async (username: string) => {
    try {
      storage.setItem('lm_username', username);
      console.log(`[Stats] Username set to '${username}'`);

      const walletAddress = activeAddress || `guest:${username}`;

      // ─── PATH A: MiniPay or Sequence → Backend Relay ───
      if ((onMiniPay && miniPayAddr) || (CONTRACT_LIVE && isConnected && address)) {
        try {
          const chainType = onMiniPay ? 'celo' : 'base';
          console.log(`[Stats] Registering ${username} on ${chainType.toUpperCase()} via relay...`);
          const relayRes = await fetch('/api/relay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'register',
              player: walletAddress,
              username,
              chainType,
            })
          });
          const relayData = await relayRes.json();
          if (relayData.success && relayData.hash) {
            console.log(`[Stats] ✅ Registered on-chain! TX: ${relayData.hash}`);
            console.log(`[Stats] 🔗 View: ${relayData.explorer}`);
          } else if (relayData.success) {
            console.log(`[Stats] ✅ ${relayData.note || 'Registration complete'}`);
          } else {
            console.warn('[Stats] Relay response:', relayData);
          }
        } catch (contractErr: any) {
          console.error('[Stats] ❌ Relay registration failed!', contractErr);
        }
      }

      // Always register on Redis backend (fast leaderboard fallback)
      await fetch('/api/register', {
        method: 'POST',
        body: JSON.stringify({ address: walletAddress, username }),
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`[Stats] Operator indexed on backend.`);
    } catch (error) {
      console.error(`[Stats] Error setting username:`, error);
      throw error;
    }
  }, [address, isConnected, onMiniPay, miniPayAddr, activeAddress]);

  // ── RECORD KILL ──
  const recordKill = useCallback(async (playerAddress: string) => {
    console.log(`[Stats] Kill recorded for ${playerAddress} on ${chainName}`);
    // Kills are batched and sent at match end via syncStats
  }, [chainName]);

  // ── RECORD WIN ──
  const recordWin = useCallback(async (playerAddress: string) => {
    console.log(`[Stats] Win recorded for ${playerAddress} on ${chainName}`);
  }, [chainName]);

  // ── GET STATS ──
  const getStats = useCallback(async (playerAddress: string): Promise<PlayerStats | null> => {
    try {
      // If on MiniPay, try reading directly from Celo contract first
      if (onMiniPay && playerAddress.startsWith('0x')) {
        const celoStats = await celoGetStats(playerAddress);
        if (celoStats && celoStats.username) return celoStats;
      }

      // Try fetching from Redis API (faster for Base users)
      const response = await fetch(`/api/stats/${playerAddress}`);
      if (response.ok) {
        return await response.json();
      }

      // Fallback to local cache
      const cacheKey = `lm_stats_${playerAddress}`;
      const cached = storage.getItem(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
      
      const localName = storage.getItem('lm_username');
      if (localName) {
         return { username: localName, kills: 0, wins: 0, gamesPlayed: 0 };
      }
    } catch (e) {
      console.error('[Stats] Error fetching stats:', e);
    }
    return null;
  }, [onMiniPay]);

  const [sessionActive, setSessionActive] = useState(true);

  // ── AUTHORIZE SESSION (The one-time popup) ──
  const authorizeSession = useCallback(async () => {
    if (!isConnected) return;
    try {
      console.log('[Session] Requesting gaming session authorization...');
      setSessionActive(true);
      return true;
    } catch (e) {
      console.error('[Session] Auth failed:', e);
      return false;
    }
  }, [isConnected]);

  // ── SYNC STATS (end of match — writes to contract + Redis) ──
  const syncStats = useCallback(async (kills: number, wins: number, isPvp: boolean = false, silent: boolean = false) => {
    try {
      const walletAddress = activeAddress || `guest:${storage.getItem('lm_username') || 'ROOKIE'}`;
      const username = storage.getItem('lm_username') || 'ROOKIE';

      console.log(`[Sync] Sending stats for ${walletAddress} (${chainName}) | K:${kills} W:${wins} PvP:${isPvp} | Silent: ${silent}`);

      // ─── PATH A: MiniPay or Sequence → Backend Relay ───
      if ((onMiniPay && miniPayAddr) || (CONTRACT_LIVE && isConnected && address)) {
        try {
          const chainType = onMiniPay ? 'celo' : 'base';
          console.log(`[Sync] Relaying match result to ${chainType.toUpperCase()} contract...`);
          const relayRes = await fetch('/api/relay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'recordMatch',
              player: walletAddress,
              username: storage.getItem('lm_username') || undefined,
              kills,
              wins,
              isPvp,
              chainType,
            })
          });
          const relayData = await relayRes.json();
          if (relayData.success && relayData.hash) {
            console.log(`[Sync] ✅ Match recorded on-chain! TX: ${relayData.hash}`);
            console.log(`[Sync] 🔗 View: ${relayData.explorer}`);
          } else if (relayData.success) {
            console.log(`[Sync] ✅ ${relayData.note || 'Stats synced'}`);
          } else {
            throw new Error(`Relay failed: ${JSON.stringify(relayData)}`);
          }
        } catch (contractErr: any) {
          console.error('[Sync] ❌ Relay sync failed!', contractErr);
          throw contractErr;
        }
      }

      // Always sync to Redis (fast leaderboard updates)
      await fetch('/api/sync-stats', {
        method: 'POST',
        body: JSON.stringify({
          address: walletAddress,
          kills,
          wins,
          username,
          mode: isPvp ? 'multiplayer' : 'pve',
          chain: chainName
        }),
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      console.warn('[Sync] Sync failed', e);
    }
  }, [activeAddress, chainName, isConnected, address, onMiniPay, miniPayAddr]);

  return {
    activeAddress,
    chainName,
    isConnected: isConnected || (onMiniPay && !!miniPayAddr),
    isMiniPay: onMiniPay,
    sessionActive,
    authorizeSession,
    recordKill,
    recordWin,
    setUsername,
    getStats,
    syncStats,
    hasFunds,
  };
}
