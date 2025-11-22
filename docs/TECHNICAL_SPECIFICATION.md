# 8-Bit Arcade - Technical Specification

> Version: 1.0.0
> Last Updated: November 2024
> Status: Pre-Development

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

**8-Bit Arcade** is a blockchain-powered retro gaming platform built on Arbitrum One. Players can enjoy classic 8-bit style arcade games, compete on global leaderboards, earn 8BIT tokens, and participate in tournaments with real prize pools.

### 1.2 Core Features

| Feature | Description |
|---------|-------------|
| **12+ Retro Games** | Classic arcade game clones (Centipede, Asteroids, Pac-Man, etc.) |
| **8BIT Token** | Native ERC-20 token for rewards and tournament entry |
| **Play Modes** | Free Play, Ranked (earn tokens), Tournament (compete for prizes) |
| **Leaderboards** | Per-game and global leaderboards with real-time updates |
| **Tournaments** | Admin-created competitions with automated prize distribution |
| **Anti-Cheat** | Server-side score validation via game replay verification |
| **Mobile Support** | Responsive design with touch controls (PWA) |

### 1.3 Technology Stack

```
Frontend:      Next.js 14, TypeScript, Phaser 3, TailwindCSS
Wallet:        RainbowKit, wagmi v2, viem
Backend:       Firebase (Auth, Firestore, Functions, Realtime DB)
Blockchain:    Arbitrum One, Solidity ^0.8.20, Foundry
Audio:         Howler.js
Hosting:       cPanel (static), Firebase (backend)
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
│  │  │   Firestore     │  │ Realtime DB     │  │ Smart Contracts  │  │  │
│  │  │ (Users, Scores) │  │ (Live Leaders)  │  │ (Token, Tourney) │  │  │
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
│   Browser   │────►│   cPanel    │────►│   Static    │
│   Request   │     │   Server    │     │   Assets    │
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
| Name | 8Bit Arcade |
| Symbol | 8BIT |
| Blockchain | Arbitrum One |
| Standard | ERC-20 |
| Decimals | 18 |
| Total Supply | 100,000,000 8BIT |

### 3.2 Token Distribution

```
Total Supply: 100,000,000 8BIT
────────────────────────────────

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ████████████████████████████████████████  40% Rewards Pool │
│  ████████████████████                      20% Liquidity    │
│  ███████████████                           15% Team (Vested)│
│  ███████████████                           15% Marketing    │
│  █████                                      5% Tournaments  │
│  █████                                      5% Airdrops     │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Breakdown:
├── 40,000,000 8BIT - Play-to-Earn Rewards Pool
├── 20,000,000 8BIT - DEX Liquidity (locked)
├── 15,000,000 8BIT - Team & Development (2-year vesting)
├── 15,000,000 8BIT - Marketing & Partnerships
├──  5,000,000 8BIT - Initial Tournament Prizes
└──  5,000,000 8BIT - Community Airdrops
```

### 3.3 Transaction Tax

| Direction | Tax | Destination |
|-----------|-----|-------------|
| Buy | 2% | Rewards Pool |
| Buy | 1% | Auto-Liquidity |
| Buy | 1% | Treasury |
| Sell | 2% | Rewards Pool |
| Sell | 1% | Auto-Liquidity |
| Sell | 1% | Treasury |

**Total Tax: 4% per transaction**

### 3.4 Rewards Distribution

#### Daily Ranked Rewards (Per Game)

| Rank | 8BIT Reward |
|------|-------------|
| 1st | 1,000 |
| 2nd-5th | 500 each |
| 6th-10th | 250 each |
| 11th-50th | 100 each |
| 51st-100th | 50 each |

**Daily Total Per Game: ~10,000 8BIT**
**Daily Total (12 games): ~120,000 8BIT**

#### Tournament Prize Distribution

| Place | Percentage |
|-------|------------|
| 1st | 50% |
| 2nd | 25% |
| 3rd | 15% |
| Platform Fee | 5% |
| Burned | 5% |

### 3.5 Token Utility

1. **Play-to-Earn**: Earn 8BIT by ranking on daily leaderboards
2. **Tournament Entry**: Pay 8BIT to enter prize tournaments
3. **Tournament Prizes**: Win 8BIT from tournament pools
4. **Staking** (Future): Stake 8BIT for reward multipliers
5. **Governance** (Future): Vote on game additions, features

---

## 4. Smart Contracts

### 4.1 Contract Overview

| Contract | Purpose | Key Functions |
|----------|---------|---------------|
| EightBitToken | ERC-20 token with tax | transfer, approve, setTax |
| RewardsPool | Manage reward distribution | deposit, distribute, claim |
| TournamentManager | Tournament lifecycle | create, enter, finalize, claim |
| ScoreOracle | Verified score submission | submitScore, getScore |
| GameRegistry | Game configuration | addGame, setActive, getGame |

### 4.2 EightBitToken.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract EightBitToken is ERC20, Ownable {
    // Tax configuration (basis points, 100 = 1%)
    uint256 public rewardsTax = 200;    // 2%
    uint256 public liquidityTax = 100;  // 1%
    uint256 public treasuryTax = 100;   // 1%

    // Tax recipients
    address public rewardsPool;
    address public liquidityPool;
    address public treasury;

    // Tax exemptions
    mapping(address => bool) public isExempt;

    // DEX pairs (for sell detection)
    mapping(address => bool) public isDexPair;

    constructor() ERC20("8Bit Arcade", "8BIT") Ownable(msg.sender) {
        _mint(msg.sender, 100_000_000 * 10**18);
    }

    function _update(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        if (isExempt[from] || isExempt[to]) {
            super._update(from, to, amount);
            return;
        }

        uint256 taxAmount = 0;

        // Apply tax on buys and sells
        if (isDexPair[from] || isDexPair[to]) {
            uint256 totalTax = rewardsTax + liquidityTax + treasuryTax;
            taxAmount = (amount * totalTax) / 10000;

            // Distribute tax
            uint256 rewardsAmount = (amount * rewardsTax) / 10000;
            uint256 liquidityAmount = (amount * liquidityTax) / 10000;
            uint256 treasuryAmount = taxAmount - rewardsAmount - liquidityAmount;

            super._update(from, rewardsPool, rewardsAmount);
            super._update(from, liquidityPool, liquidityAmount);
            super._update(from, treasury, treasuryAmount);
        }

        super._update(from, to, amount - taxAmount);
    }

    // Admin functions
    function setTaxRecipients(
        address _rewardsPool,
        address _liquidityPool,
        address _treasury
    ) external onlyOwner {
        rewardsPool = _rewardsPool;
        liquidityPool = _liquidityPool;
        treasury = _treasury;
    }

    function setExempt(address account, bool exempt) external onlyOwner {
        isExempt[account] = exempt;
    }

    function setDexPair(address pair, bool isPair) external onlyOwner {
        isDexPair[pair] = isPair;
    }
}
```

### 4.3 TournamentManager.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TournamentManager is Ownable, ReentrancyGuard {
    IERC20 public immutable token;

    struct Tournament {
        uint256 id;
        string name;
        uint256 entryFee;
        uint256 prizePool;
        uint256 startTime;
        uint256 endTime;
        uint256 maxParticipants;
        address[] participants;
        bool finalized;
        mapping(uint256 => address) winners; // place => address
        mapping(uint256 => uint256) prizes;  // place => amount
        mapping(address => bool) hasClaimed;
    }

    uint256 public tournamentCount;
    mapping(uint256 => Tournament) public tournaments;

    // Prize distribution (basis points)
    uint256 public firstPlaceBps = 5000;  // 50%
    uint256 public secondPlaceBps = 2500; // 25%
    uint256 public thirdPlaceBps = 1500;  // 15%
    uint256 public platformFeeBps = 500;  // 5%
    uint256 public burnBps = 500;         // 5%

    address public platformWallet;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Oracle for score submission
    address public scoreOracle;

    event TournamentCreated(uint256 indexed id, string name, uint256 entryFee);
    event TournamentEntered(uint256 indexed id, address indexed player);
    event TournamentFinalized(uint256 indexed id, address[3] winners);
    event PrizeClaimed(uint256 indexed id, address indexed player, uint256 amount);

    constructor(address _token, address _platformWallet) Ownable(msg.sender) {
        token = IERC20(_token);
        platformWallet = _platformWallet;
    }

    function createTournament(
        string calldata name,
        uint256 entryFee,
        uint256 startTime,
        uint256 endTime,
        uint256 maxParticipants
    ) external onlyOwner returns (uint256) {
        require(startTime > block.timestamp, "Invalid start time");
        require(endTime > startTime, "Invalid end time");

        tournamentCount++;
        Tournament storage t = tournaments[tournamentCount];
        t.id = tournamentCount;
        t.name = name;
        t.entryFee = entryFee;
        t.startTime = startTime;
        t.endTime = endTime;
        t.maxParticipants = maxParticipants;

        emit TournamentCreated(tournamentCount, name, entryFee);
        return tournamentCount;
    }

    function enterTournament(uint256 tournamentId) external nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        require(block.timestamp >= t.startTime, "Not started");
        require(block.timestamp < t.endTime, "Already ended");
        require(!t.finalized, "Already finalized");
        require(
            t.maxParticipants == 0 || t.participants.length < t.maxParticipants,
            "Tournament full"
        );

        // Check not already entered
        for (uint i = 0; i < t.participants.length; i++) {
            require(t.participants[i] != msg.sender, "Already entered");
        }

        // Transfer entry fee
        if (t.entryFee > 0) {
            require(
                token.transferFrom(msg.sender, address(this), t.entryFee),
                "Transfer failed"
            );
            t.prizePool += t.entryFee;
        }

        t.participants.push(msg.sender);
        emit TournamentEntered(tournamentId, msg.sender);
    }

    function finalizeTournament(
        uint256 tournamentId,
        address first,
        address second,
        address third
    ) external {
        require(msg.sender == scoreOracle || msg.sender == owner(), "Unauthorized");

        Tournament storage t = tournaments[tournamentId];
        require(block.timestamp >= t.endTime, "Not ended");
        require(!t.finalized, "Already finalized");

        t.finalized = true;
        t.winners[1] = first;
        t.winners[2] = second;
        t.winners[3] = third;

        // Calculate prizes
        uint256 pool = t.prizePool;
        t.prizes[1] = (pool * firstPlaceBps) / 10000;
        t.prizes[2] = (pool * secondPlaceBps) / 10000;
        t.prizes[3] = (pool * thirdPlaceBps) / 10000;

        // Platform fee and burn
        uint256 platformFee = (pool * platformFeeBps) / 10000;
        uint256 burnAmount = (pool * burnBps) / 10000;

        token.transfer(platformWallet, platformFee);
        token.transfer(BURN_ADDRESS, burnAmount);

        emit TournamentFinalized(tournamentId, [first, second, third]);
    }

    function claimPrize(uint256 tournamentId) external nonReentrant {
        Tournament storage t = tournaments[tournamentId];
        require(t.finalized, "Not finalized");
        require(!t.hasClaimed[msg.sender], "Already claimed");

        uint256 prize = 0;
        for (uint256 place = 1; place <= 3; place++) {
            if (t.winners[place] == msg.sender) {
                prize = t.prizes[place];
                break;
            }
        }

        require(prize > 0, "No prize");
        t.hasClaimed[msg.sender] = true;
        token.transfer(msg.sender, prize);

        emit PrizeClaimed(tournamentId, msg.sender, prize);
    }

    function setScoreOracle(address _oracle) external onlyOwner {
        scoreOracle = _oracle;
    }
}
```

### 4.4 RewardsPool.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract RewardsPool is Ownable, ReentrancyGuard {
    IERC20 public immutable token;

    // Claimable rewards per user
    mapping(address => uint256) public pendingRewards;

    // Total distributed
    uint256 public totalDistributed;
    uint256 public totalClaimed;

    // Authorized distributors (backend wallets)
    mapping(address => bool) public isDistributor;

    event RewardsDeposited(uint256 amount);
    event RewardsDistributed(address[] players, uint256[] amounts);
    event RewardsClaimed(address indexed player, uint256 amount);

    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }

    function distributeRewards(
        address[] calldata players,
        uint256[] calldata amounts
    ) external {
        require(isDistributor[msg.sender] || msg.sender == owner(), "Unauthorized");
        require(players.length == amounts.length, "Length mismatch");

        uint256 total = 0;
        for (uint256 i = 0; i < players.length; i++) {
            pendingRewards[players[i]] += amounts[i];
            total += amounts[i];
        }

        totalDistributed += total;
        emit RewardsDistributed(players, amounts);
    }

    function claimRewards() external nonReentrant {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "No rewards");

        pendingRewards[msg.sender] = 0;
        totalClaimed += amount;

        require(token.transfer(msg.sender, amount), "Transfer failed");
        emit RewardsClaimed(msg.sender, amount);
    }

    function setDistributor(address distributor, bool authorized) external onlyOwner {
        isDistributor[distributor] = authorized;
    }

    // Emergency withdrawal
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        token.transfer(owner(), balance);
    }
}
```

### 4.5 ScoreOracle.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ScoreOracle is Ownable {
    // Authorized backend addresses
    mapping(address => bool) public isAuthorized;

    // Score records
    struct ScoreRecord {
        address player;
        string gameId;
        uint256 score;
        uint256 timestamp;
        bytes32 sessionHash;
    }

    // Player => Game => Best Score
    mapping(address => mapping(string => uint256)) public bestScores;

    // All score submissions (for verification)
    ScoreRecord[] public scoreHistory;

    event ScoreSubmitted(
        address indexed player,
        string indexed gameId,
        uint256 score,
        uint256 timestamp
    );

    constructor() Ownable(msg.sender) {}

    function submitScore(
        address player,
        string calldata gameId,
        uint256 score,
        bytes32 sessionHash
    ) external {
        require(isAuthorized[msg.sender], "Unauthorized");

        // Update best score if higher
        if (score > bestScores[player][gameId]) {
            bestScores[player][gameId] = score;
        }

        // Record submission
        scoreHistory.push(ScoreRecord({
            player: player,
            gameId: gameId,
            score: score,
            timestamp: block.timestamp,
            sessionHash: sessionHash
        }));

        emit ScoreSubmitted(player, gameId, score, block.timestamp);
    }

    function getBestScore(
        address player,
        string calldata gameId
    ) external view returns (uint256) {
        return bestScores[player][gameId];
    }

    function setAuthorized(address backend, bool authorized) external onlyOwner {
        isAuthorized[backend] = authorized;
    }
}
```

---

## 5. Frontend Application

### 5.1 Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.x | React framework |
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
│   │   │   ├── page.tsx              # Global leaderboard
│   │   │   └── [gameId]/
│   │   │       └── page.tsx          # Game leaderboard
│   │   ├── tournaments/
│   │   │   ├── page.tsx              # Tournament list
│   │   │   └── [tournamentId]/
│   │   │       └── page.tsx          # Tournament details
│   │   ├── profile/
│   │   │   └── page.tsx              # User profile
│   │   └── api/                      # API routes (if needed)
│   │
│   ├── components/
│   │   ├── ui/                       # Reusable UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Loader.tsx
│   │   │   └── Toast.tsx
│   │   ├── layout/                   # Layout components
│   │   │   ├── Header.tsx
│   │   │   ├── Footer.tsx
│   │   │   ├── Navigation.tsx
│   │   │   └── MobileNav.tsx
│   │   ├── wallet/                   # Wallet components
│   │   │   ├── ConnectButton.tsx
│   │   │   ├── AccountModal.tsx
│   │   │   └── NetworkSwitch.tsx
│   │   ├── game/                     # Game components
│   │   │   ├── GameCard.tsx
│   │   │   ├── GameCarousel.tsx
│   │   │   ├── GamePlayer.tsx
│   │   │   ├── GameOverlay.tsx
│   │   │   ├── TouchControls.tsx
│   │   │   └── ScoreDisplay.tsx
│   │   ├── leaderboard/              # Leaderboard components
│   │   │   ├── LeaderboardTable.tsx
│   │   │   ├── LeaderboardTabs.tsx
│   │   │   └── PlayerRank.tsx
│   │   ├── tournament/               # Tournament components
│   │   │   ├── TournamentCard.tsx
│   │   │   ├── TournamentList.tsx
│   │   │   ├── TournamentEntry.tsx
│   │   │   └── TournamentLeaderboard.tsx
│   │   └── audio/                    # Audio components
│   │       ├── AudioControls.tsx
│   │       ├── MusicToggle.tsx
│   │       └── SoundToggle.tsx
│   │
│   ├── games/                        # Game implementations
│   │   ├── engine/                   # Shared game engine code
│   │   │   ├── BaseGame.ts
│   │   │   ├── InputRecorder.ts
│   │   │   ├── SeededRandom.ts
│   │   │   ├── CollisionSystem.ts
│   │   │   └── SpriteManager.ts
│   │   ├── asteroids/
│   │   │   ├── AsteroidsGame.ts
│   │   │   ├── entities/
│   │   │   └── config.ts
│   │   ├── centipede/
│   │   ├── pacman/
│   │   ├── digdug/
│   │   ├── spaceinvaders/
│   │   ├── galaga/
│   │   ├── frogger/
│   │   ├── donkeykong/
│   │   ├── breakout/
│   │   ├── snake/
│   │   ├── tetris/
│   │   └── pong/
│   │
│   ├── hooks/                        # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── useGame.ts
│   │   ├── useLeaderboard.ts
│   │   ├── useTournament.ts
│   │   ├── useAudio.ts
│   │   └── useTokenBalance.ts
│   │
│   ├── lib/                          # Utility libraries
│   │   ├── firebase.ts               # Firebase config
│   │   ├── wagmi.ts                  # Wagmi config
│   │   ├── contracts.ts              # Contract ABIs & addresses
│   │   ├── anticheat.ts              # Anti-cheat utilities
│   │   └── utils.ts                  # General utilities
│   │
│   ├── stores/                       # Zustand stores
│   │   ├── authStore.ts
│   │   ├── gameStore.ts
│   │   ├── audioStore.ts
│   │   └── uiStore.ts
│   │
│   ├── types/                        # TypeScript types
│   │   ├── game.ts
│   │   ├── user.ts
│   │   ├── tournament.ts
│   │   └── leaderboard.ts
│   │
│   └── styles/
│       └── globals.css               # Global styles
│
├── public/
│   ├── assets/
│   │   ├── sprites/                  # Game sprites
│   │   ├── audio/
│   │   │   ├── music/                # Background music
│   │   │   └── sfx/                  # Sound effects
│   │   └── fonts/                    # Pixel fonts
│   ├── favicon.ico
│   └── manifest.json                 # PWA manifest
│
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### 5.3 Key Pages

#### Homepage (/)
- Game carousel (swipe through games)
- Quick play buttons
- Live leaderboard preview
- Active tournaments banner
- Connect wallet CTA

#### Game Player (/games/[gameId])
- Full-screen game canvas
- Mode selection (Free/Ranked/Tournament)
- Touch controls (mobile)
- Score display
- Pause/resume functionality

#### Leaderboard (/leaderboard)
- Global rankings
- Per-game tabs
- Daily/Weekly/All-time filters
- Player search

#### Tournaments (/tournaments)
- Active tournaments
- Upcoming tournaments
- Past results
- Entry/claim buttons

#### Profile (/profile)
- Username management
- Stats overview
- Game history
- Rewards claims
- Token balance

### 5.4 State Management

```typescript
// stores/authStore.ts
interface AuthState {
  isConnected: boolean;
  address: string | null;
  username: string | null;
  isNewUser: boolean;
  setAddress: (address: string | null) => void;
  setUsername: (username: string) => void;
}

// stores/gameStore.ts
interface GameState {
  currentGame: string | null;
  gameMode: 'free' | 'ranked' | 'tournament';
  sessionId: string | null;
  score: number;
  isPlaying: boolean;
  inputs: GameInput[];
  startGame: (gameId: string, mode: string) => void;
  endGame: () => void;
  recordInput: (input: GameInput) => void;
}

// stores/audioStore.ts
interface AudioState {
  musicEnabled: boolean;
  soundEnabled: boolean;
  musicVolume: number;
  soundVolume: number;
  toggleMusic: () => void;
  toggleSound: () => void;
}
```

---

## 6. Game Engine

### 6.1 Architecture

All games share a common architecture for consistency and anti-cheat support:

```typescript
// games/engine/BaseGame.ts
abstract class BaseGame {
  protected scene: Phaser.Scene;
  protected inputRecorder: InputRecorder;
  protected rng: SeededRandom;
  protected score: number = 0;
  protected gameOver: boolean = false;

  constructor(config: GameConfig) {
    this.rng = new SeededRandom(config.seed);
    this.inputRecorder = new InputRecorder(config.sessionId);
  }

  abstract preload(): void;
  abstract create(): void;
  abstract update(time: number, delta: number): void;

  // Must be deterministic - same inputs = same result
  protected handleInput(input: GameInput): void {
    this.inputRecorder.record(input);
    this.processInput(input);
  }

  abstract processInput(input: GameInput): void;

  getGameData(): GameData {
    return {
      sessionId: this.inputRecorder.sessionId,
      seed: this.rng.seed,
      inputs: this.inputRecorder.getInputs(),
      finalScore: this.score,
      checksum: this.calculateChecksum()
    };
  }
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

  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }
}
```

### 6.3 Input Recording

```typescript
// games/engine/InputRecorder.ts
interface GameInput {
  t: number;      // Timestamp (ms from game start)
  type: string;   // Input type: 'move', 'shoot', 'action', etc.
  data?: any;     // Additional data: direction, coordinates, etc.
}

class InputRecorder {
  public readonly sessionId: string;
  private inputs: GameInput[] = [];
  private startTime: number;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    this.startTime = Date.now();
  }

  record(input: Omit<GameInput, 't'>): void {
    this.inputs.push({
      t: Date.now() - this.startTime,
      ...input
    });
  }

  getInputs(): GameInput[] {
    return [...this.inputs];
  }

  getChecksum(): string {
    const data = JSON.stringify(this.inputs);
    return sha256(data);
  }
}
```

### 6.4 Game Configuration

```typescript
// games/asteroids/config.ts
export const ASTEROIDS_CONFIG = {
  canvas: {
    width: 800,
    height: 600
  },
  player: {
    speed: 200,
    rotationSpeed: 180,
    fireRate: 250,  // ms between shots
    lives: 3
  },
  asteroids: {
    large: { speed: 50, points: 20, splitInto: 2 },
    medium: { speed: 100, points: 50, splitInto: 2 },
    small: { speed: 150, points: 100, splitInto: 0 }
  },
  ufo: {
    spawnInterval: 15000,
    speed: 100,
    points: 200,
    accuracy: 0.7  // Decreases with difficulty
  },
  difficulty: {
    startingAsteroids: 4,
    asteroidsPerLevel: 2,
    maxAsteroids: 12
  }
};
```

---

## 7. Backend Services

### 7.1 Firebase Configuration

```typescript
// backend/functions/src/config/firebase.ts
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const app = initializeApp();
export const db = getFirestore(app);
export const auth = getAuth(app);
```

### 7.2 Cloud Functions Structure

```
backend/
├── functions/
│   ├── src/
│   │   ├── index.ts                  # Function exports
│   │   ├── config/
│   │   │   ├── firebase.ts
│   │   │   └── blockchain.ts
│   │   ├── auth/
│   │   │   ├── verifyWallet.ts       # Wallet signature verification
│   │   │   └── createSession.ts      # Game session creation
│   │   ├── scores/
│   │   │   ├── validateScore.ts      # Main validation function
│   │   │   ├── submitScore.ts        # Save to Firestore
│   │   │   └── updateLeaderboard.ts  # Leaderboard updates
│   │   ├── anticheat/
│   │   │   ├── replayEngine.ts       # Headless game replay
│   │   │   ├── statisticalAnalysis.ts
│   │   │   └── flagAccount.ts
│   │   ├── tournaments/
│   │   │   ├── createTournament.ts
│   │   │   ├── enterTournament.ts
│   │   │   └── finalizeTournament.ts
│   │   ├── rewards/
│   │   │   ├── calculateDaily.ts
│   │   │   └── distributeRewards.ts
│   │   └── games/                    # Headless game engines
│   │       ├── asteroids.ts
│   │       ├── centipede.ts
│   │       └── ...
│   ├── package.json
│   └── tsconfig.json
```

### 7.3 Key Functions

#### Wallet Verification

```typescript
// auth/verifyWallet.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { verifyMessage } from 'viem';

export const verifyWallet = onCall(async (request) => {
  const { address, signature, message, timestamp } = request.data;

  // Check timestamp is recent (5 min window)
  const now = Date.now();
  if (Math.abs(now - timestamp) > 5 * 60 * 1000) {
    throw new HttpsError('invalid-argument', 'Signature expired');
  }

  // Verify signature
  const expectedMessage = `Sign in to 8-Bit Arcade\nTimestamp: ${timestamp}`;
  const isValid = await verifyMessage({
    address,
    message: expectedMessage,
    signature
  });

  if (!isValid) {
    throw new HttpsError('unauthenticated', 'Invalid signature');
  }

  // Create/update user in Firestore
  const userRef = db.collection('users').doc(address.toLowerCase());
  await userRef.set({
    address: address.toLowerCase(),
    lastActive: new Date()
  }, { merge: true });

  // Generate custom token for Firebase Auth
  const customToken = await auth.createCustomToken(address.toLowerCase());

  return { success: true, token: customToken };
});
```

#### Score Validation

```typescript
// scores/validateScore.ts
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { replayGame } from '../anticheat/replayEngine';

export const validateScore = onCall(async (request) => {
  const { gameData, authToken } = request.data;
  const { sessionId, gameId, seed, inputs, finalScore, checksum } = gameData;

  // Verify auth token
  const decodedToken = await auth.verifyIdToken(authToken);
  const playerAddress = decodedToken.uid;

  // Verify session exists and belongs to player
  const sessionRef = db.collection('sessions').doc(sessionId);
  const session = await sessionRef.get();

  if (!session.exists || session.data()?.player !== playerAddress) {
    throw new HttpsError('permission-denied', 'Invalid session');
  }

  // Verify checksum
  const calculatedChecksum = sha256(JSON.stringify(inputs));
  if (calculatedChecksum !== checksum) {
    throw new HttpsError('invalid-argument', 'Checksum mismatch');
  }

  // Replay game server-side
  const replayResult = await replayGame(gameId, seed, inputs);

  // Allow 1% tolerance for floating point differences
  const tolerance = Math.max(1, finalScore * 0.01);
  if (Math.abs(replayResult.score - finalScore) > tolerance) {
    // Flag for review
    await flagAccount(playerAddress, {
      reason: 'score_mismatch',
      claimed: finalScore,
      calculated: replayResult.score,
      gameId,
      sessionId
    });
    throw new HttpsError('invalid-argument', 'Score verification failed');
  }

  // Save verified score
  await saveScore(playerAddress, gameId, finalScore, sessionId);

  // Update leaderboards
  await updateLeaderboards(gameId, playerAddress, finalScore);

  return { success: true, verified: true, score: finalScore };
});
```

---

## 8. Anti-Cheat System

### 8.1 Multi-Layer Security

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ANTI-CHEAT LAYERS                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  LAYER 1: Authentication                                            │
│  ───────────────────────                                            │
│  • Wallet signature verification                                    │
│  • Session tokens with expiration                                   │
│  • Rate limiting per address                                        │
│                                                                     │
│  LAYER 2: Input Validation                                          │
│  ─────────────────────────                                          │
│  • All inputs recorded with timestamps                              │
│  • Checksum verification                                            │
│  • Input frequency analysis                                         │
│                                                                     │
│  LAYER 3: Server-Side Replay                                        │
│  ───────────────────────────                                        │
│  • Headless game engine                                             │
│  • Deterministic replay with same seed                              │
│  • Score must match within tolerance                                │
│                                                                     │
│  LAYER 4: Statistical Analysis                                      │
│  ─────────────────────────────                                      │
│  • Impossible score detection                                       │
│  • Inhuman reaction time detection                                  │
│  • Perfect play pattern detection                                   │
│  • Score velocity anomalies                                         │
│                                                                     │
│  LAYER 5: Blockchain Finality                                       │
│  ───────────────────────────                                        │
│  • Only server can submit to ScoreOracle                            │
│  • All on-chain scores are verified                                 │
│  • Immutable audit trail                                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 8.2 Replay Engine

```typescript
// anticheat/replayEngine.ts
import { AsteroidsHeadless } from '../games/asteroids';
import { CentipedeHeadless } from '../games/centipede';
// ... other games

const gameEngines: Record<string, any> = {
  'asteroids': AsteroidsHeadless,
  'centipede': CentipedeHeadless,
  // ... other games
};

export async function replayGame(
  gameId: string,
  seed: number,
  inputs: GameInput[]
): Promise<ReplayResult> {
  const GameEngine = gameEngines[gameId];
  if (!GameEngine) {
    throw new Error(`Unknown game: ${gameId}`);
  }

  const engine = new GameEngine({ seed });

  // Process each input in order
  for (const input of inputs) {
    engine.advanceTo(input.t);
    engine.processInput(input);
  }

  // Run to completion
  engine.complete();

  return {
    score: engine.getScore(),
    duration: engine.getDuration(),
    events: engine.getEvents(),
    valid: engine.isValid()
  };
}
```

### 8.3 Statistical Analysis

```typescript
// anticheat/statisticalAnalysis.ts

interface AnalysisResult {
  suspicious: boolean;
  flags: string[];
  confidence: number;
}

export function analyzeGameplay(
  gameId: string,
  inputs: GameInput[],
  score: number,
  historicalData: PlayerHistory
): AnalysisResult {
  const flags: string[] = [];

  // Check 1: Impossible score
  const maxScore = GAME_MAX_SCORES[gameId];
  if (score > maxScore) {
    flags.push('impossible_score');
  }

  // Check 2: Inhuman reaction times
  const reactionTimes = calculateReactionTimes(inputs);
  const avgReaction = average(reactionTimes);
  if (avgReaction < 50) { // Less than 50ms average
    flags.push('inhuman_reaction');
  }

  // Check 3: Perfect play detection
  const mistakeRate = calculateMistakeRate(inputs, gameId);
  if (mistakeRate === 0 && score > 10000) {
    flags.push('perfect_play');
  }

  // Check 4: Score velocity
  const scoreVelocity = score / (inputs[inputs.length - 1]?.t || 1);
  const avgVelocity = historicalData.averageScoreVelocity;
  if (scoreVelocity > avgVelocity * 3) {
    flags.push('abnormal_velocity');
  }

  // Check 5: Input frequency anomalies
  const inputFrequency = inputs.length / (inputs[inputs.length - 1]?.t || 1) * 1000;
  if (inputFrequency > 50) { // More than 50 inputs per second
    flags.push('bot_like_frequency');
  }

  return {
    suspicious: flags.length > 0,
    flags,
    confidence: Math.min(flags.length / 5, 1)
  };
}
```

---

## 9. Database Schema

### 9.1 Firestore Collections

```typescript
// types/database.ts

// /users/{walletAddress}
interface User {
  address: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: Timestamp;
  lastActive: Timestamp;
  totalGamesPlayed: number;
  totalScore: number;
  favoriteGame: string | null;
  isBanned: boolean;
  banReason: string | null;
  flags: {
    count: number;
    reasons: string[];
    lastFlagged: Timestamp | null;
  };
}

// /games/{gameId}
interface Game {
  id: string;
  name: string;
  description: string;
  thumbnailUrl: string;
  maxTheoreticalScore: number;
  difficulty: 'easy' | 'medium' | 'hard';
  controls: {
    mobile: string;
    desktop: string;
  };
  isActive: boolean;
  releaseDate: Timestamp;
  playCount: number;
}

// /sessions/{sessionId}
interface GameSession {
  id: string;
  player: string;  // wallet address
  gameId: string;
  mode: 'free' | 'ranked' | 'tournament';
  tournamentId: string | null;
  seed: number;
  startedAt: Timestamp;
  expiresAt: Timestamp;
  completedAt: Timestamp | null;
  finalScore: number | null;
  verified: boolean;
}

// /scores/{odedId}
interface ScoreDocument {
  odedId: string;
  username: string;

  // Per-game best scores
  games: {
    [gameId: string]: {
      bestScore: number;
      totalPlays: number;
      lastPlayed: Timestamp;
    };
  };

  // Aggregates
  totalScore: number;
  totalGames: number;
}

// /leaderboards/{gameId}
interface GameLeaderboard {
  gameId: string;
  lastUpdated: Timestamp;

  daily: LeaderboardEntry[];    // Top 100
  weekly: LeaderboardEntry[];   // Top 100
  allTime: LeaderboardEntry[];  // Top 100
}

interface LeaderboardEntry {
  odedId: string;
  username: string;
  score: number;
  timestamp: Timestamp;
}

// /globalLeaderboard
interface GlobalLeaderboard {
  lastUpdated: Timestamp;

  daily: GlobalEntry[];
  weekly: GlobalEntry[];
  allTime: GlobalEntry[];
}

interface GlobalEntry {
  odedId: string;
  username: string;
  totalScore: number;
  gamesPlayed: number;
}

// /tournaments/{tournamentId}
interface Tournament {
  id: string;
  name: string;
  description: string;
  games: string[];  // game IDs
  entryFee: number; // in 8BIT
  prizePool: number;
  startTime: Timestamp;
  endTime: Timestamp;
  status: 'upcoming' | 'active' | 'ended' | 'finalized';
  maxParticipants: number | null;

  participants: TournamentParticipant[];
  winners: TournamentWinner[] | null;

  // Smart contract reference
  onChainId: number | null;
  entryTxRequired: boolean;
}

interface TournamentParticipant {
  odedId: string;
  username: string;
  entryTxHash: string | null;
  joinedAt: Timestamp;
  scores: { [gameId: string]: number };
  totalScore: number;
  timePlayed: number;
  gamesCompleted: number;
}

interface TournamentWinner {
  place: 1 | 2 | 3;
  odedId: string;
  username: string;
  prize: number;
  claimTxHash: string | null;
}

// /rewards/{odedId}
interface RewardDocument {
  odedId: string;

  pending: number;      // Unclaimed rewards
  claimed: number;      // Total claimed
  lastClaimed: Timestamp | null;

  history: RewardEntry[];
}

interface RewardEntry {
  amount: number;
  reason: 'daily_rank' | 'tournament' | 'bonus';
  gameId: string | null;
  rank: number | null;
  timestamp: Timestamp;
  claimed: boolean;
  txHash: string | null;
}
```

### 9.2 Firestore Security Rules

```javascript
// firestore.rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Users - read public, write own
    match /users/{userId} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == userId
                   && !request.resource.data.diff(resource.data).affectedKeys()
                      .hasAny(['isBanned', 'flags', 'totalScore']);
    }

    // Games - read only
    match /games/{gameId} {
      allow read: if true;
      allow write: if false; // Admin only via Functions
    }

    // Sessions - read own, create own
    match /sessions/{sessionId} {
      allow read: if request.auth != null
                  && resource.data.player == request.auth.uid;
      allow create: if false; // Created via Functions only
    }

    // Scores - read public
    match /scores/{odedId} {
      allow read: if true;
      allow write: if false; // Updated via Functions only
    }

    // Leaderboards - read public
    match /leaderboards/{gameId} {
      allow read: if true;
      allow write: if false; // Updated via Functions only
    }

    // Global leaderboard - read public
    match /globalLeaderboard/{doc} {
      allow read: if true;
      allow write: if false;
    }

    // Tournaments - read public
    match /tournaments/{tournamentId} {
      allow read: if true;
      allow write: if false; // Admin only via Functions
    }

    // Rewards - read own
    match /rewards/{odedId} {
      allow read: if request.auth != null
                  && request.auth.uid == odedId;
      allow write: if false; // Updated via Functions only
    }
  }
}
```

---

## 10. API Specifications

### 10.1 Firebase Functions API

#### Authentication

```typescript
// POST verifyWallet
// Verifies wallet signature and returns auth token
Request: {
  address: string;
  signature: string;
  message: string;
  timestamp: number;
}
Response: {
  success: boolean;
  token: string;  // Firebase custom token
}

// POST setUsername
// Sets or updates user's display name
Request: {
  username: string;  // 3-20 chars, alphanumeric + underscore
}
Response: {
  success: boolean;
  username: string;
}
```

#### Game Sessions

```typescript
// POST createSession
// Creates a new game session for ranked/tournament play
Request: {
  gameId: string;
  mode: 'ranked' | 'tournament';
  tournamentId?: string;
}
Response: {
  sessionId: string;
  seed: number;
  expiresAt: number;  // Unix timestamp
}

// POST submitScore
// Submits game data for validation
Request: {
  sessionId: string;
  gameData: {
    seed: number;
    inputs: GameInput[];
    finalScore: number;
    checksum: string;
  }
}
Response: {
  success: boolean;
  verified: boolean;
  score: number;
  newBest: boolean;
  rank?: number;
}
```

#### Leaderboards

```typescript
// GET getLeaderboard
// Retrieves leaderboard data
Request: {
  gameId?: string;      // Omit for global
  period: 'daily' | 'weekly' | 'allTime';
  limit?: number;       // Default 100
}
Response: {
  entries: LeaderboardEntry[];
  lastUpdated: number;
  userRank?: number;    // If authenticated
}
```

#### Tournaments

```typescript
// GET getTournaments
// Lists tournaments by status
Request: {
  status?: 'upcoming' | 'active' | 'ended';
  limit?: number;
}
Response: {
  tournaments: Tournament[];
}

// POST enterTournament
// Enters user into tournament
Request: {
  tournamentId: string;
  entryTxHash?: string;  // If entry fee required
}
Response: {
  success: boolean;
  participantCount: number;
}
```

#### Rewards

```typescript
// GET getRewards
// Gets user's reward status
Request: {}
Response: {
  pending: number;
  claimed: number;
  history: RewardEntry[];
}

// POST claimRewards
// Initiates reward claim on blockchain
Request: {}
Response: {
  success: boolean;
  amount: number;
  txHash: string;
}
```

---

## 11. Security Considerations

### 11.1 Threat Model

| Threat | Mitigation |
|--------|------------|
| Score manipulation | Server-side replay validation |
| Replay attacks | Session tokens with timestamps |
| Bot accounts | Wallet signature required |
| Speed hacks | Input timestamp validation |
| Memory manipulation | Deterministic replay verification |
| API abuse | Rate limiting, authentication |
| Smart contract exploits | Audited code, access controls |

### 11.2 Security Best Practices

1. **Never trust client data** - All scores verified server-side
2. **Deterministic games** - Same inputs must produce same output
3. **Signed sessions** - Cryptographic proof of game ownership
4. **Rate limiting** - Prevent abuse and DoS
5. **Input sanitization** - Validate all user inputs
6. **Secure key management** - Backend keys never exposed
7. **Regular audits** - Smart contract and code review

### 11.3 Smart Contract Security

- Use OpenZeppelin battle-tested contracts
- Implement reentrancy guards
- Follow checks-effects-interactions pattern
- Limit admin capabilities
- Include emergency pause functionality
- Professional audit before mainnet

---

## 12. Mobile Support

### 12.1 Responsive Design Breakpoints

```css
/* tailwind.config.js */
screens: {
  'xs': '375px',   // Small phones
  'sm': '640px',   // Large phones
  'md': '768px',   // Tablets
  'lg': '1024px',  // Laptops
  'xl': '1280px',  // Desktops
  '2xl': '1536px'  // Large screens
}
```

### 12.2 Touch Controls

```typescript
// components/game/TouchControls.tsx
interface TouchControlsConfig {
  type: 'dpad' | 'joystick' | 'swipe' | 'tap';
  position: 'left' | 'right' | 'bottom';
  size: 'small' | 'medium' | 'large';
  opacity: number;
  haptics: boolean;
}

// Default layouts per game type
const CONTROL_PRESETS = {
  shooter: {
    movement: { type: 'dpad', position: 'left' },
    action: { type: 'tap', position: 'right', label: 'FIRE' }
  },
  puzzle: {
    movement: { type: 'swipe', position: 'bottom' },
    action: { type: 'tap', position: 'right', label: 'ROTATE' }
  },
  maze: {
    movement: { type: 'swipe', position: 'bottom' },
    action: null
  }
};
```

### 12.3 PWA Configuration

```json
// public/manifest.json
{
  "name": "8-Bit Arcade",
  "short_name": "8BitArcade",
  "description": "Play retro arcade games, earn crypto rewards",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#00ff00",
  "orientation": "any",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## 13. Game Catalog

### 13.1 Launch Games (12 Total)

| # | Game | Clone Of | Difficulty | Controls |
|---|------|----------|------------|----------|
| 1 | Space Rocks | Asteroids | Medium | Rotate/Thrust/Shoot |
| 2 | Alien Assault | Space Invaders | Easy | Left/Right/Shoot |
| 3 | Bug Blaster | Centipede | Hard | Move/Shoot |
| 4 | Chomper | Pac-Man | Medium | D-Pad |
| 5 | Tunnel Terror | Dig Dug | Medium | D-Pad/Action |
| 6 | Galaxy Fighter | Galaga | Medium | Left/Right/Shoot |
| 7 | Road Hopper | Frogger | Easy | D-Pad |
| 8 | Barrel Dodge | Donkey Kong | Hard | Move/Jump |
| 9 | Brick Breaker | Breakout | Easy | Left/Right |
| 10 | Pixel Snake | Snake | Easy | D-Pad |
| 11 | Block Drop | Tetris | Medium | Move/Rotate/Drop |
| 12 | Paddle Battle | Pong | Easy | Up/Down |

### 13.2 Game Specifications

#### Space Rocks (Asteroids)

```
Objective: Destroy all asteroids without getting hit
Scoring:
  - Large asteroid: 20 pts
  - Medium asteroid: 50 pts
  - Small asteroid: 100 pts
  - UFO: 200 pts
Mechanics:
  - Ship rotates and thrusts
  - Asteroids split when hit
  - Screen wrapping
  - UFO spawns periodically
Difficulty scaling:
  - More asteroids per level
  - UFO accuracy increases
```

#### Chomper (Pac-Man)

```
Objective: Eat all dots without being caught by ghosts
Scoring:
  - Dot: 10 pts
  - Power pellet: 50 pts
  - Ghost (powered): 200/400/800/1600 pts
  - Fruit: 100-5000 pts
Mechanics:
  - 4 ghosts with unique AI behaviors
  - Power pellets enable ghost eating
  - Maze navigation
Difficulty scaling:
  - Ghost speed increases
  - Power pellet duration decreases
```

---

## 14. Development Phases

### Phase 1: Foundation (Weeks 1-2)
- [ ] Project setup (Next.js, TypeScript, Tailwind)
- [ ] Firebase configuration
- [ ] Wallet connection (RainbowKit)
- [ ] User authentication flow
- [ ] Username registration
- [ ] Basic UI framework
- [ ] Audio system

### Phase 2: Game Engine (Weeks 3-4)
- [ ] Phaser 3 integration
- [ ] Shared game utilities
- [ ] Input recording system
- [ ] Touch controls
- [ ] First 4 games implementation

### Phase 3: Anti-Cheat & Leaderboards (Weeks 5-6)
- [ ] Headless game replay engine
- [ ] Score validation functions
- [ ] Firestore structure
- [ ] Real-time leaderboards
- [ ] Statistical analysis

### Phase 4: More Games (Weeks 7-8)
- [ ] Remaining 8 games
- [ ] Game balancing
- [ ] Mobile optimization

### Phase 5: Smart Contracts (Weeks 9-10)
- [ ] Token contract
- [ ] Rewards pool contract
- [ ] Tournament manager contract
- [ ] Score oracle contract
- [ ] Testing & deployment

### Phase 6: Integration (Weeks 11-12)
- [ ] Frontend ↔ contract integration
- [ ] Ranked mode rewards
- [ ] Tournament system
- [ ] Admin dashboard

### Phase 7: Polish (Weeks 13-14)
- [ ] PWA optimization
- [ ] Performance testing
- [ ] Security audit
- [ ] Bug fixes

### Phase 8: Launch (Week 15+)
- [ ] Mainnet deployment
- [ ] Liquidity provision
- [ ] Marketing
- [ ] Community building

---

## 15. Deployment Strategy

### 15.1 Environments

| Environment | Purpose | URL |
|-------------|---------|-----|
| Development | Local testing | localhost:3000 |
| Staging | Pre-production | staging.8bitarcade.io |
| Production | Live site | 8bitarcade.io |

### 15.2 Infrastructure

```
Production Stack:
─────────────────
├── Frontend: cPanel static hosting
│   └── Next.js static export
├── Backend: Firebase (Blaze plan)
│   ├── Authentication
│   ├── Firestore
│   ├── Realtime Database
│   └── Cloud Functions
├── Blockchain: Arbitrum One
│   ├── Smart contracts
│   └── Alchemy RPC
└── Domain: Cloudflare (DNS + CDN)
```

### 15.3 Deployment Checklist

```
Pre-Launch:
─────────────
[ ] All games tested on desktop and mobile
[ ] Anti-cheat system validated
[ ] Smart contracts audited
[ ] Firebase security rules reviewed
[ ] Rate limiting configured
[ ] Error monitoring setup (Sentry)
[ ] Analytics configured
[ ] Backup procedures documented

Launch:
─────────────
[ ] Deploy contracts to mainnet
[ ] Configure production Firebase
[ ] Build and upload static site
[ ] DNS configuration
[ ] SSL verification
[ ] Smoke testing
[ ] Monitor for issues

Post-Launch:
─────────────
[ ] Monitor error rates
[ ] Track performance metrics
[ ] Community feedback collection
[ ] Bug fixes as needed
[ ] Feature roadmap updates
```

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| 8BIT | Native ERC-20 token of 8-Bit Arcade |
| Arbitrum | Ethereum Layer 2 scaling solution |
| Deterministic | Same inputs always produce same outputs |
| Headless | Running without visual display (server-side) |
| PWA | Progressive Web App |
| RNG | Random Number Generator |
| Seed | Initial value for deterministic RNG |

---

## Appendix B: References

- [Next.js Documentation](https://nextjs.org/docs)
- [Phaser 3 Documentation](https://phaser.io/docs)
- [RainbowKit Documentation](https://rainbowkit.com/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Arbitrum Documentation](https://docs.arbitrum.io)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)

---

*Document Version: 1.0.0*
*Last Updated: November 2024*
*Status: Approved for Development*
