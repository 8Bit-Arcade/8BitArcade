# 8-Bit Arcade

> Play Classic Games. Compete Globally. Earn 8BIT Tokens.

A blockchain-powered retro gaming platform built on Arbitrum One. Play classic 8-bit style arcade games, compete on global leaderboards, and earn 8BIT tokens.

## Features

- **12+ Retro Games** - Classic arcade game clones (Centipede, Asteroids, Pac-Man, etc.)
- **8BIT Token** - Native ERC-20 token for rewards and tournament entry
- **Play Modes** - Free Play, Ranked (earn tokens), Tournament (compete for prizes)
- **Leaderboards** - Per-game and global leaderboards with real-time updates
- **Tournaments** - Admin-created competitions with automated prize distribution
- **Anti-Cheat** - Server-side score validation via game replay verification
- **Mobile Support** - Responsive design with touch controls (PWA)

## Tech Stack

- **Frontend**: Next.js 14, TypeScript, TailwindCSS, Phaser 3
- **Wallet**: RainbowKit, wagmi v2, viem
- **Backend**: Firebase (Auth, Firestore, Functions)
- **Blockchain**: Arbitrum One, Solidity, Foundry
- **Audio**: Howler.js

## Project Structure

```
8BitArcade/
├── frontend/           # Next.js web application
├── backend/            # Firebase Cloud Functions (coming soon)
├── contracts/          # Solidity smart contracts (coming soon)
├── docs/               # Technical documentation
│   └── TECHNICAL_SPECIFICATION.md
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible wallet

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your configuration
npm run dev
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in:

- Firebase configuration
- WalletConnect project ID
- Contract addresses (after deployment)

## Development Phases

- [x] **Phase 1**: Foundation (Next.js, wallet connection, UI)
- [ ] **Phase 2**: Game Engine & First Games
- [ ] **Phase 3**: Anti-Cheat & Leaderboards
- [ ] **Phase 4**: More Games
- [ ] **Phase 5**: Smart Contracts
- [ ] **Phase 6**: Token Integration
- [ ] **Phase 7**: Tournament System
- [ ] **Phase 8**: Polish & Launch

## Token Economics

- **Symbol**: 8BIT
- **Network**: Arbitrum One
- **Total Supply**: 100,000,000 8BIT

See [Technical Specification](docs/TECHNICAL_SPECIFICATION.md) for full details.

## Games

| Game | Clone Of | Difficulty |
|------|----------|------------|
| Space Rocks | Asteroids | Medium |
| Alien Assault | Space Invaders | Easy |
| Bug Blaster | Centipede | Hard |
| Chomper | Pac-Man | Medium |
| Tunnel Terror | Dig Dug | Medium |
| Galaxy Fighter | Galaga | Medium |
| Road Hopper | Frogger | Easy |
| Barrel Dodge | Donkey Kong | Hard |
| Brick Breaker | Breakout | Easy |
| Pixel Snake | Snake | Easy |
| Block Drop | Tetris | Medium |
| Paddle Battle | Pong | Easy |

## Game Screenshots

frontend/public/games/

├── space-rocks.png
├── alien-assault.png
├── brick-breaker.png
├── pixel-snake.png
├── bug-blaster.png
├── chomper.png
├── tunnel-terror.png
├── galaxy-fighter.png
├── road-hopper.png
├── barrel-dodge.png
├── block-drop.png
└── paddle-battle.png

## License

MIT License - see LICENSE for details.

---

Built with retro love by the 8-Bit Arcade team.
