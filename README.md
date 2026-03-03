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

**Phase Status:** ✅ Mainnet Live | ✅ Token Sale Live | ✅ Staking Live | ✅ NFT Achievements Live

### Completed:
- ✅ 12 fully functional arcade games
- ✅ Wallet integration (RainbowKit + wagmi)
- ✅ Firebase leaderboards and authentication
- ✅ Username/ENS support
- ✅ Smart contracts deployed to mainnet & verified
- ✅ Tokenomics model finalized
- ✅ Token sale LIVE on Arbitrum One
- ✅ Testnet faucet system
- ✅ Tournament system (two-tier structure)
- ✅ Tiered staking (7d, 1mo, 3mo, 6mo lock periods)
- ✅ NFT achievement badges (soulbound, auto-minted)
- ✅ Token distribution automation

### In Progress:
- 🚧 DEX liquidity setup (Uniswap V3 pool)
- 🚧 Testnet airdrop snapshot & deployment
- 🚧 Marketing & community growth

### Coming Soon:
- 📋 Tournament buyback & burn (after DEX pool)
- 📋 DAO governance
- 📋 Additional games

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

**Deflationary Mechanism:** 50% of tournament entry fees burned directly

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

### Arbitrum One Mainnet (LIVE)

| Contract | Address | Explorer |
|----------|---------|----------|
| **8BIT Token** | `0x37ee26669659758109c94862e49B492247Be26df` | [View](https://arbiscan.io/address/0x37ee26669659758109c94862e49B492247Be26df) |
| **Game Rewards** | `0x6e22b6b488f42FaBebE2a52fe759594650ef1B0e` | [View](https://arbiscan.io/address/0x6e22b6b488f42FaBebE2a52fe759594650ef1B0e) |
| **Tournament Manager** | `0xC0ab5FDF6Ef6A4e6bD60f9eD50b1CedB19B9741e` | [View](https://arbiscan.io/address/0xC0ab5FDF6Ef6A4e6bD60f9eD50b1CedB19B9741e) |
| **Tournament Payments** | `0xa009e23658609EC3d6b98b1e0904b77005A73e59` | [View](https://arbiscan.io/address/0xa009e23658609EC3d6b98b1e0904b77005A73e59) |
| **Token Sale** | `0x14c07e8dEcA1EB1415aFA4590626613Fe1764FaA` | [View](https://arbiscan.io/address/0x14c07e8dEcA1EB1415aFA4590626613Fe1764FaA) |
| **Treasury Gas Manager** | `0x2185cF31B507620C412b00cde9B1BCd1B62983d6` | [View](https://arbiscan.io/address/0x2185cF31B507620C412b00cde9B1BCd1B62983d6) |
| **Tiered Staking** | `0xb30D7185FE83D9Cd2f682f9Ff7BF94b6a20058dF` | [View](https://arbiscan.io/address/0xb30D7185FE83D9Cd2f682f9Ff7BF94b6a20058dF) |
| **Achievement Badges** | `0x5b0ee0abc08fA668c6B215CCD9f9A28a77789d2c` | [View](https://arbiscan.io/address/0x5b0ee0abc08fA668c6B215CCD9f9A28a77789d2c) |
| **Tradeable Items** | `0x120E5969638Ec37B00BB9d68D49688B18fA8d0Ad` | [View](https://arbiscan.io/address/0x120E5969638Ec37B00BB9d68D49688B18fA8d0Ad) |
| **Achievement Manager** | `0xF9f1067873bCe779D35e8796bfE9A32EFf5DAF1f` | [View](https://arbiscan.io/address/0xF9f1067873bCe779D35e8796bfE9A32EFf5DAF1f) |

**Network:** Arbitrum One | **Chain ID:** 42161 | **Explorer:** https://arbiscan.io

> **Token Sale:** [sale.8bitarcade.games](https://sale.8bitarcade.games) | **Testnet Faucet:** [play.8bitarcade.games/faucet](https://play.8bitarcade.games/faucet)

### Important Wallet Addresses

| Wallet | Address | Purpose |
|--------|---------|---------|
| **Deployer / Owner** | `0x80361876199e2318d6993A07e37177cFd21B64a7` | Contract deployment & ownership |
| **Rewards Distributor** | `0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B` | Backend reward distributions |
| **Liquidity Pool** | `0x1727B058B993eB9392fcE863Ec93C86e7BD725F4` | DEX liquidity (locked) |

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
3. **Get test 8BIT tokens**: Visit https://play.8bitarcade.games/faucet
   - Claim 10,000 8BIT every 24 hours (requires < 5,000 8BIT balance)
   - Use test tokens to enter tournaments and test all features
4. **Play games** and earn daily rewards
5. **Test tournaments** (both tiers using faucet tokens)
6. **Provide feedback**

## 📊 Development Phases

### Completed ✅
- [x] Phase 1: Next.js foundation & wallet integration
- [x] Phase 2: 12 retro games with Phaser 3
- [x] Phase 3: Firebase backend & leaderboards
- [x] Phase 4: Anti-cheat system
- [x] Phase 5: Smart contract development
- [x] Phase 6: Tokenomics design
- [x] Phase 7: Tournament system infrastructure
- [x] Phase 8: Token sale application
- [x] Phase 9: Testnet deployment & testing
- [x] Phase 10: Mainnet deployment & contract verification
- [x] Phase 11: Public token sale launch
- [x] Phase 12: Tiered staking launch
- [x] Phase 13: NFT achievement badges launch

### Current 🚧
- [ ] Phase 14: DEX liquidity & trading launch
- [ ] Phase 15: Testnet airdrop distribution
- [ ] Phase 16: Marketing & growth

### Upcoming 📋
- [ ] Phase 17: DAO governance
- [ ] Phase 18: Additional games
- [ ] Phase 19: Cross-chain support

## 🔐 Security

- **Anti-Cheat**: Server-side game replay verification
- **Rate Limiting**: Prevents spam and abuse
- **Vesting**: 2-year founder vesting
- **Liquidity Lock**: 3-year minimum lock
- **Burn Mechanisms**: 50% of tournament fees burned
- **Audits**: Planned before mainnet launch

## 🌐 Network

**Mainnet**: Arbitrum One (LIVE)
**Testnet**: Arbitrum Sepolia (testing)

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

**Q4 2025** ✅
- ✅ Complete all 12 games
- ✅ Finalize tokenomics
- ✅ Build tournament system
- ✅ Deploy to testnet
- ✅ Community testing

**Q1 2026** ✅
- ✅ Mainnet deployment (Feb 22, 2026)
- ✅ Public token sale LIVE
- ✅ Tiered staking launch (9.9M 8BIT funded)
- ✅ NFT achievement badges launch
- 🚧 Marketing campaign

**Q2 2026**
- 🚧 DEX liquidity provision (Uniswap V3)
- 🚧 Testnet airdrop distribution
- 📋 First high roller tournament
- 📋 Additional games
- 📋 Partnerships & integrations

**Q3-Q4 2026**
- 📋 DAO governance launch
- 📋 Mobile app (PWA)
- 📋 Cross-chain support

## ⚖️ License

MIT License - see LICENSE for details.

## ⚠️ Disclaimer

8-Bit Arcade is a skill-based gaming platform. Cryptocurrency values can be volatile. Play responsibly and never invest more than you can afford to lose. Always DYOR (Do Your Own Research).

---

**Built with retro love on Arbitrum** 🎮

*Bringing 8-bit nostalgia to the blockchain era*
