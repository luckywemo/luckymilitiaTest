/**
 * Celo / MiniPay Provider
 * ────────────────────────
 * Completely separate from the Sequence Kit / Wagmi stack.
 * Detects MiniPay at runtime and uses window.ethereum directly
 * for EOA-signed transactions on Celo Mainnet.
 *
 * MiniPay wallets are standard EOA wallets — no AA complications,
 * so we can call the contract directly without a relay.
 */

import { BrowserProvider, Contract, JsonRpcProvider, formatEther } from 'ethers';
import { MILITIA_STATS_ABI } from './contractABI';

// Celo Mainnet config
const CELO_CHAIN_ID = 42220;
const CELO_RPC = 'https://forno.celo.org';
const CELO_EXPLORER = 'https://celoscan.io';

// Contract address on Celo (set via env or fallback to zero = not deployed yet)
export const CELO_CONTRACT_ADDRESS =
  import.meta.env.VITE_CELO_MILITIA_CONTRACT_ADDRESS ||
  '0x0000000000000000000000000000000000000000';

const CELO_CONTRACT_LIVE =
  CELO_CONTRACT_ADDRESS !== '0x0000000000000000000000000000000000000000';

// ── MiniPay Detection ──

export function isMiniPay(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.ethereum !== undefined &&
    (window.ethereum as any).isMiniPay === true
  );
}

// ── Get ethers provider from MiniPay's injected ethereum ──

function getMiniPayProvider(): BrowserProvider | null {
  if (!isMiniPay()) return null;
  return new BrowserProvider(window.ethereum as any);
}

// ── Get connected address ──

export async function getMiniPayAddress(): Promise<string | null> {
  const provider = getMiniPayProvider();
  if (!provider) return null;

  try {
    const signer = await provider.getSigner();
    return await signer.getAddress();
  } catch (e) {
    console.error('[Celo] Failed to get MiniPay address:', e);
    return null;
  }
}

// ── Ensure we're on Celo Mainnet ──

async function ensureCeloNetwork(): Promise<boolean> {
  if (!window.ethereum) return false;

  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (parseInt(chainId as string, 16) === CELO_CHAIN_ID) return true;

    // Try switching to Celo
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: `0x${CELO_CHAIN_ID.toString(16)}` }],
    });
    return true;
  } catch (e: any) {
    // Chain not added — try adding it
    if (e.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: `0x${CELO_CHAIN_ID.toString(16)}`,
              chainName: 'Celo Mainnet',
              nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
              rpcUrls: [CELO_RPC],
              blockExplorerUrls: [CELO_EXPLORER],
            },
          ],
        });
        return true;
      } catch {
        return false;
      }
    }
    console.error('[Celo] Network switch failed:', e);
    return false;
  }
}

// ── Get contract instance (signer-connected for writes) ──

async function getContract(
  readonly = false
): Promise<Contract | null> {
  if (!CELO_CONTRACT_LIVE) {
    console.warn('[Celo] Contract not deployed on Celo yet');
    return null;
  }

  if (readonly) {
    const provider = new JsonRpcProvider(CELO_RPC);
    return new Contract(
      CELO_CONTRACT_ADDRESS,
      MILITIA_STATS_ABI,
      provider
    );
  }

  const provider = getMiniPayProvider();
  if (!provider) return null;

  const onCelo = await ensureCeloNetwork();
  if (!onCelo) return null;

  const signer = await provider.getSigner();
  return new Contract(CELO_CONTRACT_ADDRESS, MILITIA_STATS_ABI, signer);
}

// ── Direct On-Chain Operations (EOA — no relay needed) ──

export async function celoRegisterPlayer(
  username: string
): Promise<{ success: boolean; hash?: string; explorer?: string }> {
  try {
    const contract = await getContract();
    if (!contract) return { success: false };

    const address = await getMiniPayAddress();
    if (!address) return { success: false };

    console.log(`[Celo] Registering ${username} directly on Celo...`);
    const tx = await contract.registerPlayer(address, username);
    console.log(`[Celo] TX sent: ${tx.hash}`);
    await tx.wait();

    const explorer = `${CELO_EXPLORER}/tx/${tx.hash}`;
    console.log(`[Celo] ✅ Registered! ${explorer}`);
    return { success: true, hash: tx.hash, explorer };
  } catch (e: any) {
    console.error('[Celo] ❌ Registration failed:', e);
    return { success: false };
  }
}

export async function celoRecordMatch(
  kills: number,
  wins: number,
  isPvp: boolean
): Promise<{ success: boolean; hash?: string; explorer?: string }> {
  try {
    const contract = await getContract();
    if (!contract) return { success: false };

    const address = await getMiniPayAddress();
    if (!address) return { success: false };

    console.log(`[Celo] Recording match on Celo: K:${kills} W:${wins} PvP:${isPvp}`);
    const tx = await contract.recordMatchResult(address, kills, wins, isPvp);
    console.log(`[Celo] TX sent: ${tx.hash}`);
    await tx.wait();

    const explorer = `${CELO_EXPLORER}/tx/${tx.hash}`;
    console.log(`[Celo] ✅ Match recorded! ${explorer}`);
    return { success: true, hash: tx.hash, explorer };
  } catch (e: any) {
    console.error('[Celo] ❌ Match recording failed:', e);
    return { success: false };
  }
}

export async function celoGetStats(
  playerAddress: string
): Promise<any | null> {
  try {
    const contract = await getContract(true);
    if (!contract) return null;

    const result = await contract.getStats(playerAddress);
    return {
      username: result[0],
      kills: Number(result[1]),
      wins: Number(result[2]),
      gamesPlayed: Number(result[3]),
      pvpKills: Number(result[4]),
      pvpWins: Number(result[5]),
      pveKills: Number(result[6]),
      pveWins: Number(result[7]),
    };
  } catch (e) {
    console.error('[Celo] Failed to read stats:', e);
    return null;
  }
}

export async function celoGetBalance(): Promise<string> {
  const provider = getMiniPayProvider();
  if (!provider) return '0';

  try {
    const address = await getMiniPayAddress();
    if (!address) return '0';
    const balance = await provider.getBalance(address);
    return formatEther(balance);
  } catch {
    return '0';
  }
}
