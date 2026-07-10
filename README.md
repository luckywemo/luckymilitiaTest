<div align="center">
  <img width="1200" height="475" alt="Lucky Militia Tactical Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
  
  # 🎖️ LUCKY MILITIA: TACTICAL OPERATIONS TERMINAL
  **The definitive multichain multiplayer combat experience on Base & Celo.**
  
  [![Base](https://img.shields.io/badge/Network-Base_Mainnet-0052FF?style=for-the-badge&logo=coinbase)](https://base.org)
  [![Celo](https://img.shields.io/badge/Network-Celo_Mainnet-FCFF52?style=for-the-badge&logo=celo&logoColor=black)](https://celo.org)
  [![React](https://img.shields.io/badge/v18.0-React-blue?style=for-the-badge&logo=react)](https://react.dev)
  [![Phaser](https://img.shields.io/badge/v3.8-Phaser-orange?style=for-the-badge&logo=phaser)](https://phaser.io)
</div>

---

## 📡 MISSION OVERVIEW
Lucky Militia is a high-fidelity, tactical multiplayer shooter with on-chain combat records across **Base** and **Celo** networks. It features a dynamic Phaser Tilemap engine, spatial 3D audio, P2P multiplayer via PeerJS, and AI-orchestrated bot backfill.

## ⚡ CORE TECHNOLOGY
- **Engine:** [React 18](https://react.dev) + [Phaser 3.8+](https://phaser.io) (Standardized Tilemap Rendering)
- **3D Visualization:** [@react-three/fiber](https://r3f.docs.pmnd.rs) + [Three.js](https://threejs.org) (Holographic Lobby Prototypes)
- **Wallet / Auth:** [Sequence Kit](https://sequence.xyz) (Embedded email/social wallets on Base) + [MiniPay](https://minipay.opera.com) (Celo)
- **Blockchain:** [Base Mainnet](https://base.org) + [Celo Mainnet](https://celo.org) — `LuckyMilitiaStats` Solidity contract on both chains
- **Backend Relay:** Vercel Edge Functions — signs on-chain writes using the deployer key (AA wallet compatibility)
- **Networking:** [PeerJS](https://peerjs.com) (P2P Multiplayer Mesh)
- **Database:** [Upstash Redis](https://upstash.com) (High-speed Leaderboard Caching)

## 🎯 TACTICAL FEATURES
### 🧱 Dynamic Battlefield 2.0
- **High-Performance Tilemaps:** Dedicated tilemap architecture for superior rendering and precise collision.
- **Destructible Cover:** Environment tiles (Tactical Crates) feature integrity tracking. Breach enemy cover to expose HVTs.
- **Seeded Map Generation:** Deterministic LCG-based map generation — all players in a room see the same layout.

### 🛡️ Trustless Economy
- **Dual-Chain Verification:** Combat stats are written to `LuckyMilitiaStats.sol` on both Base and Celo via a server-side relay.
- **Verified Badge:** Operators with on-chain records are flagged `UPLINK_ACTIVE` in the lobby.
- **Redis Leaderboard:** Real-time score cache with all-time, daily, and monthly periods.

### 🤖 AI Orchestration
- **Dynamic Backfill:** Squads are automatically balanced using a reactive AI engine that calculates unit needs based on room capacity.
- **Enhanced Pathfinding:** Bots utilize real-time LOS (Line of Sight) and cover-finding algorithms based on tilemap data.

### 🔊 Immersive Protocol
- **Spatial Audio:** Real-time distance attenuation and stereo panning for gunshots, impacts, and environmental cues.
- **Cyber-Premium UI:** Modernized "Visor" HUD with CRT flicker effects and tactical noise overlays.

---

## 🛠️ DEPLOYMENT INSTRUCTIONS

### Prerequisites
- [Node.js](https://nodejs.org/) (v20+ recommended)
- A [Sequence](https://sequence.xyz) project access key (for embedded wallets on Base)
- [Opera MiniPay](https://minipay.opera.com) or any EIP-1193 wallet (for Celo)

### 1. Preparation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Configuration
Create a `.env` file in the root directory:
```env
# Sequence Kit (Base)
VITE_SEQUENCE_ACCESS_KEY=your_sequence_project_key

# Contract addresses
VITE_MILITIA_CONTRACT_ADDRESS=0xa3e2975697a80485adfdef1d4a7322774d183f16
VITE_CELO_MILITIA_CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000

# Server-side relay signer (deployer private key — keep secret!)
EVM_PRIVATE_KEY=your_deployer_private_key

# Upstash Redis (leaderboard)
UPSTASH_REDIS_REST_URL=your_upstash_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_token

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key
```

### 3. Ignition
Launch the tactical terminal:
```bash
npm run dev
```

---

## 🗺️ OPERATIONAL ROADMAP
- [x] React 18 + Phaser 3 Tilemap Architecture
- [x] Base Mainnet — `LuckyMilitiaStats` contract + Sequence relay
- [x] Celo Mainnet — MiniPay direct EOA integration
- [x] Upstash Redis leaderboard (all-time / daily / monthly)
- [x] PeerJS P2P multiplayer mesh
- [x] AI bot backfill with LOS + cover-finding
- [ ] Cross-Layer Weapon Customization
- [ ] Persistent Operator Progression (NFT Metadata)
- [ ] Matchmaking & ranked mode

---

<div align="center">
  <p><i>"CODE IS LAW. COMBAT IS REALITY."</i></p>
  <sub>v3.0.0-PROXIMA // OPERATOR_UPLINK_SUCCESSFUL</sub>
</div>
