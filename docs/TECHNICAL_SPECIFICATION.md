# 8-Bit Arcade - Technical Specification

> Version: 2.0.0
> Last Updated: January 2026
> Status: Testnet Live (Arbitrum Sepolia)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Token Economics](#3-token-economics)
4. [Smart Contracts](#4-smart-contracts)
5. [Frontend Application](#5-frontend-application)
6. [Game Engine](#6-game-engine)
7. [Backend Services](#7-backend-services)
8. [Anti-Cheat System](#8-anti-cheat-system)
9. [Database Schema](#9-database-schema)
10. [API Specifications](#10-api-specifications)
11. [Security Considerations](#11-security-considerations)
12. [Mobile Support](#12-mobile-support)
13. [Game Catalog](#13-game-catalog)
14. [Development Phases](#14-development-phases)
15. [Deployment Strategy](#15-deployment-strategy)

---

## 1. Executive Summary

### 1.1 Project Overview

**8-Bit Arcade** is a blockchain-powered retro gaming platform built on Arbitrum. Players can enjoy classic 8-bit style arcade games, compete on global leaderboards, earn 8BIT tokens, and participate in tournaments with real prize pools.

### 1.2 Core Features

| Feature | Description |
|---------|-------------|
| **12 Retro Games** | Classic arcade game clones (Space Invaders, Asteroids, Pac-Man, etc.) |
| **8BIT Token** | Native ERC-20 token for rewards and tournament entry |
| **Play Modes** | Free Play, Ranked (earn tokens), Tournament (compete for prizes) |
| **Leaderboards** | Per-game and global leaderboards with real-time updates |
| **Tournaments** | Two-tier tournament system (Standard & High Roller) with 8BIT entry fees |
| **Testnet Airdrop** | 10M tokens distributed to testnet participants with 3-month vesting |
| **Anti-Cheat** | Server-side score validation via game replay verification |
| **Mobile Support** | Responsive design with touch controls (PWA) |

### 1.3 Technology Stack

```
Frontend:      Next.js 15.5.7, TypeScript, Phaser 3, TailwindCSS
Wallet:        RainbowKit, wagmi v2, viem
Backend:       Firebase (Auth, Firestore, Functions)
Blockchain:    Arbitrum (Sepolia testnet, One mainnet), Solidity ^0.8.20, Hardhat
Audio:         Howler.js
Hosting:       Firebase Hosting (frontend), Firebase Functions (backend)
```

### 1.4 Target Platforms

- Desktop browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Android Chrome)
- Progressive Web App (installable)

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           8-BIT ARCADE SYSTEM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                         CLIENT LAYER                              │  │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐  │  │
│  │  │  Next.js   │  │  Phaser 3  │  │ RainbowKit │  │  Howler.js │  │  │
│  │  │    App     │  │   Games    │  │   Wallet   │  │   Audio    │  │  │
│  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘  └────────────┘  │  │
│  └────────┼───────────────┼───────────────┼─────────────────────────┘  │
│           │               │               │                             │
│           ▼               ▼               ▼                             │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                       SERVICE LAYER                               │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │  │
│  │  │ Firebase Auth   │  │ Firebase        │  │ Arbitrum RPC     │  │  │
│  │  │ (Wallet Verify) │  │ Functions       │  │ (Blockchain)     │  │  │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬─────────┘  │  │
│  └───────────┼────────────────────┼────────────────────┼────────────┘  │
│              │                    │                    │                │
│              ▼                    ▼                    ▼                │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        DATA LAYER                                 │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐  │  │
│  │  │   Firestore     │  │ Smart Contracts │  │ Treasury Gas     │  │  │
│  │  │ (Users, Scores) │  │ (Token, Tourney)│  │ Manager          │  │  │
│  │  └─────────────────┘  └─────────────────┘  └──────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Data Flow

```
GAME SESSION FLOW:
──────────────────

1. Player connects wallet
   Client ──► RainbowKit ──► Wallet ──► Signature ──► Firebase Auth

2. Player starts game
   Client ──► Firebase Function ──► Generate Session ──► Return JWT

3. Player plays game
   Client records all inputs locally with timestamps

4. Player finishes game
   Client ──► Firebase Function ──► Validate Score
                                         │
                                         ├──► Replay game server-side
                                         ├──► Compare scores
                                         ├──► If valid: save to Firestore
                                         └──► If ranked: queue for rewards

5. Rewards distribution (daily)
   Firebase Function ──► Calculate rankings ──► Smart Contract ──► Distribute 8BIT
```

### 2.3 Component Interactions

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Browser   │────►│  Firebase   │────►│   Static    │
│   Request   │     │   Hosting   │     │   Assets    │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Game      │────►│  Firebase   │────►│  Firestore  │
│   Actions   │     │  Functions  │     │  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Wallet    │────►│  Arbitrum   │────►│   Smart     │
│   Tx        │     │    RPC      │     │  Contracts  │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 3. Token Economics

### 3.1 Token Specifications

| Property | Value |
|----------|-------|
| Name | 8-Bit Arcade Token |
| Symbol | 8BIT |
| Blockchain | Arbitrum (Layer 2) |
| Standard | ERC-20 |
| Decimals | 18 |
| Total Supply | 500,000,000 8BIT |
| Initial Price | $0.0005 |

### 3.2 Token Distribution

```
Total Supply: 500,000,000 8BIT
────────────────────────────────

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ████████████████████████████████████████  40% Token Sale   │
│  ██████████████████████████████           30% Rewards Pool  │
│  ██████████████████                       20% Initial Dist. │
│  ██████████████                           10% Staking       │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Breakdown:
├── 200,000,000 8BIT (40%) - Token Sale ($100K raise)
├── 150,000,000 8BIT (30%) - Play-to-Earn Rewards Pool (5 years)
├── 100,000,000 8BIT (20%) - Initial Distribution
│   ├── 60,000,000 8BIT (12%) - DEX Liquidity (locked 3+ years)
│   ├── 20,000,000 8BIT (4%)  - Tournament Prize Pools
│   ├── 15,000,000 8BIT (3%)  - Marketing & Partnerships
│   │   └── 10,000,000 8BIT   - Testnet Airdrop (3-month vesting)
│   └──  5,000,000 8BIT (1%)  - Team (vested 2-3 years)
└── 50,000,000 8BIT (10%) - Staking Rewards
```

### 3.3 No Transaction Tax

8BIT uses a standard ERC-20 implementation with **no transaction tax**. The deflationary mechanism comes from tournament fee burns instead.

### 3.4 Rewards Distribution

#### Daily Ranked Rewards (Per Game)

| Rank | 8BIT Reward |
|------|-------------|
| 1st | 1,250 |
| 2nd-5th | 625 each |
| 6th-10th | 280 each |

**Daily Total Per Game: ~5,000 8BIT**
**Daily Total (12 games): ~50,000 8BIT**

#### Tournament Structure (8BIT Entry Fees)

**Standard Tier:**
- Weekly: 2,000 8BIT entry → 25,000 8BIT prize pool
- Monthly: 10,000 8BIT entry → 80,000 8BIT prize pool

**High Roller Tier:**
- Weekly: 10,000 8BIT entry → 80,000 8BIT prize pool
- Monthly: 50,000 8BIT entry → 500,000 8BIT prize pool

#### Prize Distribution (Top 3)

| Place | Percentage |
|-------|------------|
| 1st | 50% |
| 2nd | 30% |
| 3rd | 20% |

**50% of entry fees are burned** (deflationary mechanism)

### 3.5 Token Utility

1. **Tournament Entry**: Pay 8BIT to enter competitive tournaments
2. **Prize Payouts**: Win 8BIT from tournament pools and daily rankings
3. **Airdrop Claims**: Testnet participants receive vested 8BIT tokens
4. **Staking** (Future): Stake 8BIT for reward multipliers
5. **Governance** (Future): Vote on game additions and features

---

## 4. Smart Contracts

### 4.1 Contract Overview

| Contract | Purpose | Testnet Address |
|----------|---------|-----------------|
| EightBitToken | ERC-20 token | `0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d` |
| GameRewards | Daily reward distribution | `0x528c9130A05bEf9a9632FbB3D8735287A2e44a4E` |
| TournamentManager | Tournament lifecycle | `0xe06C92f15F426b0f6Fccb66302790E533C5Dfbb7` |
| TournamentPayments | USDC processing (legacy) | `0x0606eDf5Fb1912160b700846C48a49800ae6A1ec` |
| TournamentBuyback | Buyback & burn | `0x6F3eAF6FB7218340aF69f81e143A01507566a6A6` |
| TokenSale | Public sale | `0x057B1130dD6E8FcBc144bb34172e45293C6839fE` |
| TreasuryGasManager | Automated gas refills | `0x39F49a46CAB85CF079Cde25EAE311A563d3952EC` |
| TestnetFaucet | Free test tokens | `0x25A4109083f882FCFbC9Ea7cE5Cd942dbae38952` |
| VestedAirdrop | Testnet airdrop claims | TBD (pending deployment) |

### 4.2 EightBitToken.sol

Standard ERC-20 implementation using OpenZeppelin contracts:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract EightBitToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint256 public constant MAX_SUPPLY = 500_000_000 * 10**18;

    constructor() ERC20("8-Bit Arcade Token", "8BIT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(totalSupply() + amount <= MAX_SUPPLY, "Exceeds max supply");
        _mint(to, amount);
    }
}
```

### 4.3 TournamentManager.sol

Manages tournament creation, entries (8BIT fees), and prize distribution:

```solidity
// Key features:
// - Two-tier system (Standard & High Roller)
// - Weekly and Monthly periods
// - 8BIT token entry fees
// - 50% of fees burned (deflationary)
// - Automated prize distribution
```

### 4.4 VestedAirdrop.sol

Merkle tree-based airdrop with 3-month vesting for testnet participants:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Key features:
// - Merkle proof verification for gas-efficient claims
// - 90-day claim window
// - 3-month vesting (33.33% immediate, 33.33% +30 days, 33.33% +60 days)
// - 10M tokens total allocation
// - Treasury recovery of unclaimed tokens after deadline
```

---

## 5. Frontend Application

### 5.1 Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.5.7 | React framework |
| TypeScript | 5.x | Type safety |
| TailwindCSS | 3.x | Styling |
| RainbowKit | 2.x | Wallet connection UI |
| wagmi | 2.x | React hooks for Ethereum |
| viem | 2.x | TypeScript Ethereum library |
| Zustand | 4.x | State management |
| Howler.js | 2.x | Audio management |

### 5.2 Project Structure

```
frontend/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout
│   │   ├── page.tsx                  # Homepage
│   │   ├── games/
│   │   │   ├── page.tsx              # Games list
│   │   │   └── [gameId]/
│   │   │       └── page.tsx          # Game player
│   │   ├── leaderboard/
│   │   │   └── page.tsx              # Leaderboards
│   │   ├── tournaments/
│   │   │   └── page.tsx              # Tournament list
│   │   ├── airdrop/
│   │   │   └── page.tsx              # Airdrop claim page
│   │   ├── faucet/
│   │   │   └── page.tsx              # Testnet faucet
│   │   └── profile/
│   │       └── page.tsx              # User profile
│   │
│   ├── components/
│   │   ├── ui/                       # Reusable UI components
│   │   ├── layout/                   # Layout components
│   │   ├── wallet/                   # Wallet components
│   │   ├── game/                     # Game components
│   │   ├── leaderboard/              # Leaderboard components
│   │   ├── tournament/               # Tournament components
│   │   └── audio/                    # Audio components
│   │
│   ├── games/                        # Phaser game implementations
│   │   ├── engine/                   # Shared game engine code
│   │   ├── SpaceRocks/               # Asteroids clone
│   │   ├── AlienAssault/             # Space Invaders clone
│   │   ├── BugBlaster/               # Centipede clone
│   │   ├── Chomper/                  # Pac-Man clone
│   │   └── ...                       # Other games
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useGame.ts
│   │   ├── useLeaderboard.ts
│   │   ├── useTournament.ts
│   │   ├── useAirdrop.ts
│   │   └── useTokenBalance.ts
│   │
│   ├── lib/                          # Utility libraries
│   │   ├── firebase.ts
│   │   └── wagmi.ts
│   │
│   └── config/                       # Configuration
│       └── contracts.ts              # Contract addresses & ABIs
│
├── public/                           # Static assets
└── next.config.js
```

### 5.3 Key Pages

#### Homepage (/)
- Game carousel with active tournament badges
- Quick play buttons
- Live leaderboard preview
- Connect wallet CTA

#### Game Player (/games/[gameId])
- Full-screen game canvas
- Tournament entry status (WEEKLY/MONTHLY/LIVE badges)
- Touch controls (mobile)
- Real-time score display

#### Tournaments (/tournaments)
- Active and upcoming tournaments
- 8BIT entry fee display
- Entry status and results
- Prize pool information

#### Airdrop (/airdrop)
- Eligibility check
- Tier display (Legendary/Epic/Rare/Common)
- Vesting schedule visualization
- Claim and vest release buttons

#### Faucet (/faucet)
- 10,000 8BIT per claim (testnet)
- 24-hour cooldown
- Balance threshold check

---

## 6. Game Engine

### 6.1 Architecture

All games share a common Phaser 3 architecture for consistency and anti-cheat support:

```typescript
// games/engine/BaseGame.ts
abstract class BaseGame extends Phaser.Scene {
  protected rng: SeededRandom;
  protected score: number = 0;
  protected gameOver: boolean = false;

  constructor(config: GameConfig) {
    super(config);
    this.rng = new SeededRandom(config.seed);
  }

  abstract preload(): void;
  abstract create(): void;
  abstract update(time: number, delta: number): void;
}
```

### 6.2 Deterministic RNG

```typescript
// games/engine/SeededRandom.ts
class SeededRandom {
  private state: number;
  public readonly seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Math.floor(Math.random() * 2147483647);
    this.state = this.seed;
  }

  // Mulberry32 algorithm - fast and deterministic
  next(): number {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
```

---

## 7. Backend Services

### 7.1 Firebase Configuration

```typescript
// Firebase services used:
// - Authentication (wallet signature verification)
// - Firestore (users, scores, leaderboards, tournaments)
// - Cloud Functions (score validation, rewards, airdrop)
// - Hosting (frontend deployment)
```

### 7.2 Cloud Functions Structure

```
functions/
├── src/
│   ├── index.ts                      # Function exports
│   ├── auth/                         # Authentication
│   ├── scores/                       # Score validation
│   ├── rewards/                      # Daily reward distribution
│   ├── tournaments/                  # Tournament management
│   ├── airdrop/                      # Airdrop system
│   │   └── calculateAirdrop.ts       # Merkle tree generation
│   └── utils/                        # Shared utilities
```

### 7.3 Key Cloud Functions

#### Airdrop Functions

| Function | Purpose |
|----------|---------|
| `triggerAirdropSnapshot` | Generates Merkle tree from player activity |
| `getAirdropStatus` | Returns eligibility and allocation info |
| `getAirdropLeaderboard` | Returns top 100 airdrop recipients |
| `markAirdropClaimed` | Records claim transaction |
| `setAirdropContract` | Updates contract address |

#### Airdrop Eligibility Calculation

Points are calculated based on:
- Games played (1 point each, max 500)
- Tournament entries (10 points each, max 200)
- Top 10 tournament finishes (50 points each, max 250)
- Early adopter bonus (100 points)

Tiers:
- **Legendary** (top 1%): 2,000,000 tokens shared
- **Epic** (top 5%): 2,500,000 tokens shared
- **Rare** (top 20%): 3,500,000 tokens shared
- **Common** (rest): 2,000,000 tokens shared

---

## 8. Anti-Cheat System

### 8.1 Multi-Layer Security

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ANTI-CHEAT LAYERS                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LAYER 1: Authentication                                            │
│  • Wallet signature verification                                    │
│  • Session tokens with expiration                                   │
│  • Rate limiting per address                                        │
│                                                                     │
│  LAYER 2: Input Validation                                          │
│  • All inputs recorded with timestamps                              │
│  • Checksum verification                                            │
│  • Input frequency analysis                                         │
│                                                                     │
│  LAYER 3: Server-Side Replay                                        │
│  • Deterministic game engine                                        │
│  • Replay with same seed                                            │
│  • Score must match within tolerance                                │
│                                                                     │
│  LAYER 4: Statistical Analysis                                      │
│  • Impossible score detection                                       │
│  • Inhuman reaction time detection                                  │
│  • Score velocity anomalies                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 9. Database Schema

### 9.1 Firestore Collections

```typescript
// /users/{walletAddress}
interface User {
  address: string;
  username: string | null;
  createdAt: Timestamp;
  lastActive: Timestamp;
  totalGamesPlayed: number;
}

// /sessions/{sessionId}
interface GameSession {
  id: string;
  odedId: string;  // wallet address
  gameId: string;
  gameTitle: string;
  score: number;
  startTime: Timestamp;
  endTime: Timestamp;
  verified: boolean;
}

// /tournaments/{firestoreId}
interface Tournament {
  firestoreId: string;
  tournamentId: number;  // on-chain ID
  tier: 'standard' | 'highroller';
  period: 'weekly' | 'monthly';
  startTime: Timestamp;
  endTime: Timestamp;
  entryFee: number;  // 8BIT tokens
  prizePool: number;
  participants: TournamentParticipant[];
  status: 'upcoming' | 'active' | 'ended' | 'finalized';
}

// /airdrops/{snapshotId}
interface AirdropSnapshot {
  id: string;
  createdAt: Timestamp;
  merkleRoot: string;
  totalTokens: number;
  totalRecipients: number;
  status: 'pending_deployment' | 'active' | 'ended';
  contractAddress: string | null;
  claimDeadline: Timestamp;
}
```

---

## 10. API Specifications

### 10.1 Firebase Functions API

#### Airdrop Functions

```typescript
// POST getAirdropStatus
Request: { wallet: string }
Response: {
  eligible: boolean;
  airdropId?: string;
  tier?: 'legendary' | 'epic' | 'rare' | 'common';
  rank?: number;
  points?: number;
  tokenAmount?: string;  // Wei
  tokenAmountFormatted?: number;
  proof?: string[];
  claimed?: boolean;
  vesting?: {
    vestedAmount: number;
    nextUnlockDate: string | null;
    nextUnlockAmount: number;
    schedule: Array<{month: number; percent: number; unlocked: boolean}>;
  };
}

// POST triggerAirdropSnapshot (admin only)
Request: {}
Response: {
  success: boolean;
  snapshotId: string;
  merkleRoot: string;
  totalRecipients: number;
  totalTokens: number;
}
```

---

## 11. Security Considerations

### 11.1 Smart Contract Security

- Use OpenZeppelin battle-tested contracts
- Implement reentrancy guards
- Access control with roles
- Emergency pause functionality
- Merkle proof verification for airdrops
- Professional audit planned before mainnet

### 11.2 Backend Security

- Wallet signature verification for all actions
- Rate limiting on all endpoints
- Input sanitization and validation
- Firebase security rules for data access
- Admin-only functions protected

---

## 12. Mobile Support

### 12.1 Responsive Design

- Touch-optimized game controls
- Swipe gestures for navigation
- Mobile-first component design
- PWA installable app

### 12.2 Touch Controls

Each game implements appropriate touch controls:
- D-pad for directional games
- Swipe for gesture-based games
- Tap for action games

---

## 13. Game Catalog

### 13.1 Current Games (12 Total)

| # | Game | Clone Of | Difficulty | Status |
|---|------|----------|------------|--------|
| 1 | Space Rocks | Asteroids | Medium | Live |
| 2 | Alien Assault | Space Invaders | Easy | Live |
| 3 | Brick Breaker | Breakout | Easy | Live |
| 4 | Pixel Snake | Snake | Easy | Live |
| 5 | Bug Blaster | Centipede | Hard | Live |
| 6 | Chomper | Pac-Man | Medium | Live |
| 7 | Flappy Bird | Flappy Bird | Medium | Live |
| 8 | Galaxy Fighter | Galaga | Medium | Live |
| 9 | Road Hopper | Frogger | Easy | Live |
| 10 | Missile Command | Missile Command | Hard | Live |
| 11 | Block Drop | Tetris | Medium | Live |
| 12 | Paddle Battle | Pong | Easy | Live |

All games feature:
- 8-bit retro graphics
- Progressive difficulty
- Seeded RNG for fairness
- Touch controls for mobile
- Real-time leaderboards

---

## 14. Development Phases

### Completed

- [x] Phase 1: Next.js foundation & wallet integration
- [x] Phase 2: 12 retro games with Phaser 3
- [x] Phase 3: Firebase backend & leaderboards
- [x] Phase 4: Anti-cheat system
- [x] Phase 5: Smart contract development
- [x] Phase 6: Tokenomics design
- [x] Phase 7: Testnet deployment (Arbitrum Sepolia)
- [x] Phase 8: Tournament system (8BIT entry fees)
- [x] Phase 9: Testnet airdrop system (10M tokens)

### In Progress

- [ ] Phase 10: Community testing & feedback
- [ ] Phase 11: Token sale infrastructure

### Upcoming

- [ ] Phase 12: Public token sale
- [ ] Phase 13: Mainnet deployment
- [ ] Phase 14: Marketing & growth
- [ ] Phase 15: DAO governance
- [ ] Phase 16: Staking system

---

## 15. Deployment Strategy

### 15.1 Environments

| Environment | Purpose | Network |
|-------------|---------|---------|
| Development | Local testing | localhost |
| Testnet | Pre-production | Arbitrum Sepolia |
| Production | Live site | Arbitrum One |

### 15.2 Current Testnet Deployment

**Smart Contracts:**
- All core contracts deployed to Arbitrum Sepolia
- Verified on Arbiscan
- Testnet faucet operational
- Tournament system active
- Airdrop contract pending deployment

**Frontend:**
- Firebase Hosting: https://play.8bitarcade.games
- Sale Site: https://8bitarcade.games

### 15.3 Mainnet Checklist

```
Pre-Launch:
─────────────
[ ] All games tested thoroughly
[ ] Anti-cheat system validated
[ ] Smart contracts audited
[ ] Firebase security rules reviewed
[ ] Error monitoring setup
[ ] Community testing complete

Launch:
─────────────
[ ] Deploy contracts to mainnet
[ ] Configure production Firebase
[ ] DNS configuration
[ ] SSL verification
[ ] Public token sale
[ ] DEX liquidity provision
```

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| 8BIT | Native ERC-20 token of 8-Bit Arcade |
| Arbitrum | Ethereum Layer 2 scaling solution |
| Deterministic | Same inputs always produce same outputs |
| Merkle Tree | Hash-based data structure for efficient verification |
| Vesting | Gradual token release schedule |
| PWA | Progressive Web App |

---

## Appendix B: References

- [Next.js Documentation](https://nextjs.org/docs)
- [Phaser 3 Documentation](https://phaser.io/docs)
- [RainbowKit Documentation](https://rainbowkit.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Arbitrum Documentation](https://docs.arbitrum.io)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)

---

*Document Version: 2.0.0*
*Last Updated: January 2026*
*Status: Testnet Live*
