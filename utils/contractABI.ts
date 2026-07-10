/**
 * ABI for LuckyMilitiaStats.sol deployed on Base.
 * Generated from the Solidity contract — only includes functions we call from the frontend.
 */
export const MILITIA_STATS_ABI = [
  // ── WRITE FUNCTIONS ──

  {
    name: 'registerPlayer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'username', type: 'string' },
    ],
    outputs: [],
  },
  {
    name: 'recordMatchResult',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'player', type: 'address' },
      { name: 'kills', type: 'uint256' },
      { name: 'wins', type: 'uint256' },
      { name: 'isPvp', type: 'bool' },
    ],
    outputs: [],
  },

  // ── READ FUNCTIONS ──

  {
    name: 'getStats',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [
      { name: 'username', type: 'string' },
      { name: 'kills', type: 'uint256' },
      { name: 'wins', type: 'uint256' },
      { name: 'gamesPlayed', type: 'uint256' },
      { name: 'pvpKills', type: 'uint256' },
      { name: 'pvpWins', type: 'uint256' },
      { name: 'pveKills', type: 'uint256' },
      { name: 'pveWins', type: 'uint256' },
      { name: 'registeredAt', type: 'uint256' },
      { name: 'lastMatchAt', type: 'uint256' },
    ],
  },
  {
    name: 'getPlayerCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'isRegistered',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'player', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
  },

  // ── EVENTS (for Sequence Indexer) ──

  {
    name: 'PlayerRegistered',
    type: 'event',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'username', type: 'string', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'MatchRecorded',
    type: 'event',
    inputs: [
      { name: 'player', type: 'address', indexed: true },
      { name: 'kills', type: 'uint256', indexed: false },
      { name: 'wins', type: 'uint256', indexed: false },
      { name: 'isPvp', type: 'bool', indexed: false },
      { name: 'score', type: 'uint256', indexed: false },
      { name: 'timestamp', type: 'uint256', indexed: false },
    ],
  },
] as const;
