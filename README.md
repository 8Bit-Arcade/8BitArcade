# 🎮 8-Bit Arcade

> Play Classic Games. Compete Globally. Earn 8BIT Tokens.

A blockchain-powered retro gaming platform built on Arbitrum. Play classic 8-bit style arcade games, compete on global leaderboards, and earn 8BIT tokens through skill-based gameplay.

## ✨ Features

- **12 Retro Games** - Fully playable classic arcade game clones (more coming)
- **Free to Play** - No cost to play, earn tokens through skill
- **Two-Tier Tournaments** - Standard ($1-$5) and High Roller ($5-$25) entry levels
- **Daily Rewards** - Top 10 players per game earn tokens every day
- **Global Leaderboards** - Real-time daily, weekly, and all-time rankings
- **Token Faucet (Testnet)** - Get free test tokens to try everything
- **Mobile Support** - Responsive design with touch controls
- **Anti-Cheat** - Server-side replay verification
- **Arbitrum L2** - Low gas fees, fast transactions

## 🎯 Current Status

**Phase Status:** ✅ Games Complete | 🚧 Smart Contracts Ready | 📋 Tokenomics Finalized

### Completed:
- ✅ 12 fully functional arcade games
- ✅ Wallet integration (RainbowKit + wagmi)
- ✅ Firebase leaderboards and authentication
- ✅ Username/ENS support
- ✅ Smart contracts (testnet ready)
- ✅ Tokenomics model (see TOKENOMICS_PROPOSAL.md)
- ✅ Token sale infrastructure
- ✅ Testnet faucet system

### In Progress:
- 🚧 Tournament system (two-tier structure)
- 🚧 Token distribution automation
- 🚧 Staking mechanics

### Coming Soon:
- 📋 Testnet deployment
- 📋 Public token sale ($100K raise)
- 📋 Mainnet launch
- 📋 DAO governance

## 💰 Token Economics

**8BIT Token on Arbitrum**

- **Max Supply**: 500,000,000 (500 Million)
- **Initial Price**: $0.0005
- **Market Cap (FDV)**: $250,000
- **Public Sale**: 40% (200M tokens, $100K raise)
- **Future Rewards**: 40% (200M over 5 years)
- **Liquidity**: 12% (60M locked 3+ years)
- **Deflationary**: Tournament fees used to buyback & burn

### Distribution:
| Category | Allocation | Tokens | Unlock |
|----------|-----------|--------|---------|
| **Public Sale** | 40% | 200M | Immediate |
| **Future Rewards** | 40% | 200M | 5 years (linear) |
| **Liquidity** | 12% | 60M | Immediate (locked 3+ years) |
| **Tournament Prizes** | 4% | 20M | Immediate |
| **Marketing** | 3% | 15M | 6-12 months |
| **Team** | 1% | 5M | 2-3 years (vested) |

**Deflationary Mechanism:** 50% of tournament fees buyback & burn 8BIT

**See [contracts/README.md](contracts/README.md) for full token distribution details**

### Automated Gas Management

8-Bit Arcade uses an **automated Treasury Gas Manager** to ensure sustainable token distribution:

- **Self-Sustaining** - 1 ETH deposit funds ~2-3 years of automated operations
- **Zero Manual Intervention** - Automatic wallet refills when balance drops below threshold
- **Minimal Cost** - ~$75/year to distribute 30M 8BIT annually on Arbitrum
- **Full Automation** - Makes daily rewards truly automatic and reliable

**Cost Efficiency:** Less than 0.025% of emissions value at $5M market cap

This infrastructure enables the platform to run autonomously without manual gas wallet management.

## 🏆 Tournament System

### Two-Tier Structure:

**Standard Tier** (Accessible)
- Weekly: 2,000 8BIT ($1) entry, 50,000 8BIT ($25) prize
- Monthly: 10,000 8BIT ($5) entry, 100,000 8BIT ($50) prize

**High Roller Tier** (Premium)
- Weekly: 10,000 8BIT ($5) entry, 150,000 8BIT ($75) prize
- Monthly: 50,000 8BIT ($25) entry, 500,000 8BIT ($250) prize

**Free Daily Rewards:**
- Top 10 per game earn 280-1,250 tokens/day
- No entry fee required

## 🎮 Games

| Game | Clone Of | Difficulty | Status |
|------|----------|------------|--------|
| Space Rocks | Asteroids | Medium | ✅ Live |
| Alien Assault | Space Invaders | Easy | ✅ Live |
| Brick Breaker | Breakout | Easy | ✅ Live |
| Pixel Snake | Snake | Easy | ✅ Live |
| Bug Blaster | Centipede | Hard | ✅ Live |
| Chomper | Pac-Man | Medium | ✅ Live |
| Flappy Bird | Flappy Bird | Medium | ✅ Live |
| Galaxy Fighter | Galaga | Medium | ✅ Live |
| Road Hopper | Frogger | Easy | ✅ Live |
| Missile Command | Missile Command | Hard | ✅ Live |
| Block Drop | Tetris | Medium | ✅ Live |
| Paddle Battle | Pong | Easy | ✅ Live |

All games feature:
- 8-bit retro graphics
- Progressive difficulty
- Seeded RNG for fairness
- Touch controls for mobile
- Real-time leaderboards

## 🛠️ Tech Stack

### Frontend
- Next.js 15.5.7
- TypeScript
- TailwindCSS
- Phaser 3 (game engine)
- RainbowKit + wagmi v2

### Blockchain
- Arbitrum (Sepolia testnet, One mainnet)
- Solidity 0.8.20
- Hardhat
- OpenZeppelin contracts

### Backend
- Firebase Authentication
- Firestore Database
- Cloud Functions
- Ethers.js for contract interaction

### Audio
- Howler.js

## 📜 Smart Contract Addresses

### Arbitrum Sepolia Testnet (Current)

| Contract | Address | Explorer |
|----------|---------|----------|
| **8BIT Token** | `0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d` | [View](https://sepolia.arbiscan.io/address/0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d) |
| **Game Rewards** | `0x528c9130A05bEf9a9632FbB3D8735287A2e44a4E` | [View](https://sepolia.arbiscan.io/address/0x528c9130A05bEf9a9632FbB3D8735287A2e44a4E) |
| **Tournament Manager** | `0xe06C92f15F426b0f6Fccb66302790E533C5Dfbb7` | [View](https://sepolia.arbiscan.io/address/0xe06C92f15F426b0f6Fccb66302790E533C5Dfbb7) |
| **Tournament Payments** | `0xb52aE08daFC310E6f858957Fa0a317fEF341dE85` | [View](https://sepolia.arbiscan.io/address/0xb52aE08daFC310E6f858957Fa0a317fEF341dE85) |
| **Token Sale** | `0x057B1130dD6E8FcBc144bb34172e45293C6839fE` | [View](https://sepolia.arbiscan.io/address/0x057B1130dD6E8FcBc144bb34172e45293C6839fE) |
| **Treasury Gas Manager** | `0x39F49a46CAB85CF079Cde25EAE311A563d3952EC` | [View](https://sepolia.arbiscan.io/address/0x39F49a46CAB85CF079Cde25EAE311A563d3952EC) |
| **Testnet Faucet** | `0x25A4109083f882FCFbC9Ea7cE5Cd942dbae38952` | [View](https://sepolia.arbiscan.io/address/0x25A4109083f882FCFbC9Ea7cE5Cd942dbae38952) |
| **USDC (Testnet)** | `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d` | [View](https://sepolia.arbiscan.io/address/0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d) |

**Network:** Arbitrum Sepolia
**Chain ID:** 421614
**RPC:** https://sepolia-rollup.arbitrum.io/rpc
**Explorer:** https://sepolia.arbiscan.io

### Important Wallet Addresses

| Wallet | Address | Purpose |
|--------|---------|---------|
| **Deployer** | TBD | Contract deployment & ownership |
| **Game Rewards Wallet** | `0x193A7E1a8e840b514AdeD9a1D69a94002d87D678` | Daily reward distributions |
| **Treasury** | TBD | Protocol fees & revenue |
| **Liquidity Pool** | `0x1727B058B993eB9392fcE863Ec93C86e7BD725F4` | DEX liquidity (locked) |

> **Note:** These are testnet addresses. Mainnet addresses will be updated here after public launch.

## 📂 Project Structure

```
8BitArcade/
├── frontend/               # Next.js web application
│   ├── src/
│   │   ├── app/           # Next.js app router pages
│   │   ├── components/    # React components
│   │   ├── games/         # Phaser game scenes
│   │   ├── config/        # Contract addresses, network config
│   │   ├── hooks/         # React hooks
│   │   └── lib/           # Utilities, Firebase, wagmi
│   └── public/            # Static assets
├── contracts/             # Smart contracts
│   ├── contracts/        # Solidity files
│   ├── scripts/          # Deployment scripts
│   └── README.md         # Deployment guide
├── functions/             # Firebase Cloud Functions
│   └── src/
│       └── rewards/      # Daily reward distribution
├── TOKENOMICS_PROPOSAL.md  # Complete tokenomics
├── SMART_CONTRACTS_GUIDE.md # Quick start guide
└── README.md
```

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or compatible Web3 wallet

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local with your Firebase & WalletConnect config
npm run dev
```

Visit http://localhost:3000

### Smart Contracts Setup

```bash
cd contracts
npm install
cp .env.example .env
# Edit .env with your private key and Arbiscan API key
npm run deploy:testnet
```

See [SMART_CONTRACTS_GUIDE.md](SMART_CONTRACTS_GUIDE.md) for detailed instructions.

## 📋 Configuration Files

### Key Configuration:

**`frontend/src/config/contracts.ts`** - Contract addresses and network settings
- Set `USE_TESTNET = true` for Arbitrum Sepolia
- Set `USE_TESTNET = false` for Arbitrum mainnet
- Update contract addresses after deployment

**`contracts/.env`** - Deployment credentials (never commit!)
- PRIVATE_KEY - Deployer wallet
- ARBISCAN_API_KEY - For verification

**`frontend/.env.local`** - Frontend environment
- Firebase configuration
- WalletConnect project ID

## 🧪 Testnet Testing

1. **Get testnet ETH**: https://faucet.quicknode.com/arbitrum/sepolia
2. **Connect wallet** to Arbitrum Sepolia
3. **Play games** and earn daily rewards
4. **Test tournaments** (both tiers)
5. **Provide feedback**

## 📊 Development Phases

### Completed ✅
- [x] Phase 1: Next.js foundation & wallet integration
- [x] Phase 2: 12 retro games with Phaser 3
- [x] Phase 3: Firebase backend & leaderboards
- [x] Phase 4: Anti-cheat system
- [x] Phase 5: Smart contract development
- [x] Phase 6: Tokenomics design

### Current 🚧
- [ ] Phase 7: Tournament system infrastructure
- [ ] Phase 8: Token sale application
- [ ] Phase 9: Testnet deployment & testing

### Upcoming 📋
- [ ] Phase 10: Public token sale
- [ ] Phase 11: Mainnet deployment
- [ ] Phase 12: Marketing & growth
- [ ] Phase 13: DAO governance
- [ ] Phase 14: Additional games

## 🔐 Security

- **Anti-Cheat**: Server-side game replay verification
- **Rate Limiting**: Prevents spam and abuse
- **Vesting**: 2-year founder vesting
- **Liquidity Lock**: 3-year minimum lock
- **Burn Mechanisms**: 50% of tournament fees burned
- **Audits**: Planned before mainnet launch

## 🌐 Network

**Current**: Arbitrum Sepolia (testnet)
**Launch**: Arbitrum One (mainnet)

Why Arbitrum?
- Ultra-low gas fees (~$0.01 per transaction)
- Fast finality (< 1 second)
- Full Ethereum security
- Growing DeFi ecosystem

## 📚 Documentation

- [TOKENOMICS_PROPOSAL.md](TOKENOMICS_PROPOSAL.md) - Complete token economics
- [SMART_CONTRACTS_GUIDE.md](SMART_CONTRACTS_GUIDE.md) - Contract deployment
- [contracts/README.md](contracts/README.md) - Detailed contract docs
- [TECHNICAL_SPECIFICATION.md](docs/TECHNICAL_SPECIFICATION.md) - Tech specs

## 🤝 Contributing

This is a 2-person project currently in active development. Community contributions welcome after mainnet launch!

## 📞 Links

- **Website**: https://8bitarcade.games/
- **Discord**: https://discord.gg/AKrdPvHz4P
- **Twitter**: https://x.com/8_Bit_Arcade_
- **Docs**: https://docs.8bitarcade.games/

## 🎯 Roadmap

**Q4 2025**
- ✅ Complete all 12 games
- ✅ Finalize tokenomics
- 🚧 Build tournament system
- ✅ Deploy to testnet
- 📋 Community testing (3-6 months)

**Q1 2026**
- 📋 Public token sale
- 📋 Mainnet deployment
- 📋 Additional games
- 📋 Marketing campaign
- 📋 First high roller tournament

**Q1-Q2 2026**
- 📋 DAO governance launch
- 📋 Staking system
- 📋 Additional games
- 📋 Mobile app (PWA)
- 📋 Partnerships & integrations

## ⚖️ License

MIT License - see LICENSE for details.

## ⚠️ Disclaimer

8-Bit Arcade is a skill-based gaming platform. Cryptocurrency values can be volatile. Play responsibly and never invest more than you can afford to lose. Always DYOR (Do Your Own Research).

---

**Built with retro love on Arbitrum** 🎮

*Bringing 8-bit nostalgia to the blockchain era*
