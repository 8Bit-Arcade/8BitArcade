# 8-Bit Arcade Smart Contracts

Smart contracts for the 8-Bit Arcade gaming platform on Arbitrum.

## 📋 Contracts Overview

### EightBitToken (8BIT)
- **Type**: ERC20 Token
- **Max Supply**: 500,000,000 (500 Million)
- **Initial Mint**: 300,000,000 (60% at deployment)
- **Decimals**: 18
- **Purpose**: Platform utility token for rewards and tournaments
- **Features**: ERC20 with authorized minter system for controlled emissions

### GameRewards
- **Purpose**: Distributes daily leaderboard rewards
- **Rewards**: Top 10 players per game receive tokens daily
- **Distribution**: Automated by backend Firebase function
- **Daily Pool**: 10,000 8BIT per game

### TournamentManager
- **Purpose**: Manages two-tier tournament system
- **Tiers**: Standard ($1-$5 entry) and High Roller ($5-$25 entry)
- **Periods**: Weekly and Monthly tournaments
- **Features**:
  - Entry fee collection
  - Prize pool management
  - 50% fee burn mechanism
  - Winner declaration and payouts

### TournamentPayments
- **Purpose**: Handles tournament entry fees in multiple currencies
- **Payment Methods**: USDC or ETH
- **Features**:
  - Automatic ETH→USDC conversion via Uniswap V3
  - Real-time pricing from Uniswap TWAP oracles
  - Buyback & burn mechanism (50% of fees)
  - Prize pool funding (50% of fees)
  - Slippage protection

### TokenSale
- **Purpose**: Public token sale contract
- **Sale Amount**: 200M tokens (40% of max supply)
- **Target Raise**: $100,000
- **Price**: $0.0005 per token
- **Payment**: ETH or USDC
- **Duration**: 6 weeks
- **Features**: Time-limited sale, unsold tokens burned, immediate unlock

### TreasuryGasManager
- **Purpose**: Automated gas wallet management
- **Features**:
  - Auto-refills payout wallet when balance is low
  - Configurable threshold and refill amounts
  - Enables fully automated reward distribution
- **Sustainability**: 1 ETH funds ~2-3 years of operations

### TestnetFaucet (Testnet Only)
- **Purpose**: Provides free tokens for testing
- **Amount**: 10,000 8BIT per claim
- **Cooldown**: 24 hours between claims
- **Features**: Anti-spam protection, balance tracking

## 💎 Token Distribution

### Maximum Supply: 500M 8BIT

#### Initial Distribution (At Deployment)

**Mainnet: 300M minted (60% of max supply)**
- **200M (40%)** → TokenSale ($100k raise at $0.0005/token)
- **20M (4%)** → TournamentManager (prize pools)
- **80M (16%)** → Founder/Deployer:
  - 60M DEX liquidity (Uniswap V3 8BIT/USDC pool)
  - 15M Marketing & partnerships
  - 5M Team & advisors (vested)

**Testnet: 300M minted (60% of max supply)**
- **200M (40%)** → TokenSale
- **50M (10%)** → TestnetFaucet (testing only)
- **20M (4%)** → TournamentManager
- **30M (6%)** → Founder (reduced allocation for testing)

#### Future Emissions (Authorized Minters)

**200M tokens (40% of max supply)** minted gradually over 5 years:
- **150M (30%)** → GameRewards (daily leaderboard rewards)
- **50M (10%)** → Staking (staking rewards, when implemented)

#### Total Breakdown

| Allocation | Amount | % of Max Supply | Unlock |
|-----------|--------|-----------------|---------|
| **Token Sale** | 200M | 40% | Immediate |
| **Future Rewards** | 200M | 40% | 5 years (linear) |
| **Liquidity** | 60M | 12% | Immediate (locked 3+ years) |
| **Tournaments** | 20M | 4% | Immediate |
| **Marketing** | 15M | 3% | 6-12 months |
| **Team** | 5M | 1% | 2-3 years (vested) |
| **Total** | **500M** | **100%** | |

### Deflationary Mechanism
- **50% of tournament fees** are used to buyback 8BIT from DEX and burn
- **Tournament burns** reduce circulating supply over time
- **Unsold tokens** from TokenSale are burned at sale end
- **Effective max supply** decreases as platform grows

## 🚀 Quick Start Deployment

### Prerequisites

1. **Node.js** (v18 or higher)
2. **Deployer wallet** with Arbitrum Sepolia ETH
3. **Arbiscan API key** for verification

### Install Dependencies

```bash
cd contracts
npm install
```

### Configure Environment

Create `.env` file:

```bash
# Deployer wallet private key (NEVER COMMIT THIS!)
PRIVATE_KEY=0xyour_private_key_here

# Arbiscan API key for contract verification
ARBISCAN_API_KEY=your_arbiscan_api_key_here
```

**Get Testnet ETH**: https://faucet.quicknode.com/arbitrum/sepolia
**Get Arbiscan Key**: https://arbiscan.io/myapikey

### Deploy All Contracts

```bash
npm run deploy:testnet
```

This deploys all 7 contracts in the correct order:
1. ✅ EightBitToken
2. ✅ GameRewards
3. ✅ TournamentManager
4. ✅ TournamentPayments
5. ✅ TokenSale
6. ✅ TreasuryGasManager
7. ✅ TestnetFaucet (testnet only)

**⚠️ SAVE ALL DEPLOYMENT ADDRESSES!**

## 📝 Post-Deployment Configuration

### 1. Update Frontend Config

Edit `frontend/src/config/contracts.ts`:

```typescript
const TESTNET_CONTRACTS = {
  EIGHT_BIT_TOKEN: '0xYourTokenAddress',
  GAME_REWARDS: '0xYourRewardsAddress',
  TOURNAMENT_MANAGER: '0xYourTournamentAddress',
  TOURNAMENT_PAYMENTS: '0xYourPaymentsAddress',
  TOKEN_SALE: '0xYourSaleAddress',
  TESTNET_FAUCET: '0xYourFaucetAddress',
  USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia USDC
  CHAIN_ID: 421614,
  CHAIN_NAME: 'Arbitrum Sepolia',
  RPC_URL: 'https://sepolia-rollup.arbitrum.io/rpc',
  BLOCK_EXPLORER: 'https://sepolia.arbiscan.io',
};
```

### 2. Verify Contracts on Arbiscan

```bash
# The deployment script will print these commands with actual addresses
npx hardhat verify --network arbitrumSepolia <TOKEN_ADDRESS>
npx hardhat verify --network arbitrumSepolia <REWARDS_ADDRESS> <TOKEN_ADDRESS>
npx hardhat verify --network arbitrumSepolia <TOURNAMENT_MANAGER_ADDRESS> <TOKEN_ADDRESS>
npx hardhat verify --network arbitrumSepolia <TOURNAMENT_PAYMENTS_ADDRESS> <TOKEN_ADDRESS> <USDC> <WETH> <SWAP_ROUTER>
npx hardhat verify --network arbitrumSepolia <TOKEN_SALE_ADDRESS> <TOKEN_ADDRESS> <USDC> 0
npx hardhat verify --network arbitrumSepolia <TREASURY_ADDRESS> <DEPLOYER> <MIN_THRESHOLD> <REFILL_AMOUNT>
npx hardhat verify --network arbitrumSepolia <FAUCET_ADDRESS> <TOKEN_ADDRESS>
```

### 3. Set Permissions

#### A. Set Rewards Distributor
```javascript
const rewards = await ethers.getContractAt("GameRewards", REWARDS_ADDRESS);
await rewards.setRewardsDistributor(BACKEND_WALLET_ADDRESS);
```

#### B. Set Tournament Manager
```javascript
const tournaments = await ethers.getContractAt("TournamentManager", TOURNAMENT_MANAGER_ADDRESS);
await tournaments.setTournamentManager(BACKEND_WALLET_ADDRESS);
```

### 4. Fund Treasury

```bash
# Send 1 ETH for automated gas management
cast send <TREASURY_ADDRESS> --value 1ether --private-key <PRIVATE_KEY> --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

### 5. Configure Tournament Payments

```javascript
const payments = await ethers.getContractAt("TournamentPayments", PAYMENTS_ADDRESS);

// Set tournament fees (USDC has 6 decimals)
await payments.setTournamentFee(1, 1000000);   // Standard Weekly: $1
await payments.setTournamentFee(2, 5000000);   // Standard Monthly: $5
await payments.setTournamentFee(3, 5000000);   // High Roller Weekly: $5
await payments.setTournamentFee(4, 25000000);  // High Roller Monthly: $25

// After adding liquidity, set Uniswap pool addresses
await payments.setPools(EIGHTBIT_USDC_POOL, WETH_USDC_POOL);
```

### 6. Configure Firebase Functions

```bash
cd functions

# Tournament automation
firebase functions:config:set tournament.manager="<TOURNAMENT_MANAGER_ADDRESS>"
firebase functions:config:set deployer.private_key="<DEPLOYER_PRIVATE_KEY>"
firebase functions:config:set network="testnet"

# Deploy functions
npm run build
firebase deploy --only functions
```

## 🤖 Automated Tournament Creation

Tournaments are created automatically via scheduled Firebase Cloud Functions:

### Weekly Tournaments
- **Schedule**: Every Monday at 00:00 UTC
- **Creates**: Standard + High Roller weekly tournaments
- **Duration**: 7 days
- **Entry Fees**: $1 (Standard), $5 (High Roller)
- **Prizes**: $25 (Standard), $75 (High Roller)

### Monthly Tournaments
- **Schedule**: 1st of each month at 00:00 UTC
- **Creates**: Standard + High Roller monthly tournaments
- **Duration**: 30 days
- **Entry Fees**: $5 (Standard), $25 (High Roller)
- **Prizes**: $50 (Standard), $250 (High Roller)

### Functions
- `createWeeklyTournaments` - Weekly automation
- `createMonthlyTournaments` - Monthly automation
- `createTournamentManual` - Manual testing trigger

**Location**: `functions/src/tournaments/scheduleTournaments.ts`

## 💰 Tournament Fee Structure

### Standard Tier (Accessible Entry)
| Period | Entry Fee | Prize Pool |
|--------|-----------|------------|
| Weekly | $1 | $25 |
| Monthly | $5 | $50 |

### High Roller Tier (Premium Entry)
| Period | Entry Fee | Prize Pool |
|--------|-----------|------------|
| Weekly | $5 | $75 |
| Monthly | $25 | $250 |

### Payment Options
- **USDC**: Direct payment
- **ETH**: Auto-converted to USDC via Uniswap V3

### Fee Allocation
- **50%**: Buyback 8BIT and burn (deflationary)
- **50%**: Prize pool

## 📊 Daily Reward Structure

Top 10 players per game receive daily rewards:

| Rank | Percentage | Amount (10K pool) |
|------|-----------|-------------------|
| 1st  | 25%       | 2,500 8BIT        |
| 2-5  | 12.5% each| 1,250 8BIT each   |
| 6-10 | 5% each   | 500 8BIT each     |

**Total Daily Per Game**: 10,000 8BIT
**Total Daily (12 games)**: 120,000 8BIT

## 🎯 Mainnet Deployment

### When Ready to Launch

1. **Test Thoroughly on Testnet** (3-6 months recommended)
   - Play all games
   - Test tournament system
   - Verify automated creation
   - Monitor for bugs

2. **Deploy to Mainnet**
   ```bash
   npm run deploy:mainnet
   ```

3. **Update Frontend**
   ```typescript
   export const USE_TESTNET = false; // Enable mainnet
   ```

4. **Add Liquidity**
   - Create Uniswap V3 pools
   - Add 8BIT/USDC liquidity
   - Lock liquidity for 3 years

5. **Launch** 🚀
   - Public announcement
   - Token sale begins
   - Tournaments go live

## 🛠️ Development

### Compile Contracts
```bash
npx hardhat compile
```

### Run Tests
```bash
npm test
```

### Local Development
```bash
npx hardhat node  # Start local blockchain
npm run deploy    # Deploy to localhost
```

### Hardhat Console
```bash
npx hardhat console --network arbitrumSepolia
```

## 🔒 Security Checklist

- [ ] Never commit `.env` file
- [ ] Use separate wallet for deployment
- [ ] Use separate wallet for operations
- [ ] Test all functions on testnet first
- [ ] Verify all contracts on Arbiscan
- [ ] Set proper permissions (distributors, managers)
- [ ] Keep private keys in secure environment
- [ ] Audit contracts before mainnet (recommended)
- [ ] Monitor contract events post-deployment
- [ ] Set up alerts for unusual activity
- [ ] Document all admin operations

## 📝 Contract Addresses

### Testnet (Arbitrum Sepolia)
- **8BIT Token**: `TBD` (update after deployment)
- **GameRewards**: `TBD` (update after deployment)
- **TournamentManager**: `TBD` (update after deployment)
- **TournamentPayments**: `TBD` (update after deployment)
- **TokenSale**: `TBD` (update after deployment)
- **TreasuryGasManager**: `TBD` (update after deployment)
- **TestnetFaucet**: `TBD` (update after deployment)
- **Explorer**: https://sepolia.arbiscan.io

### Mainnet (Arbitrum One)
- **8BIT Token**: `TBD` (update after deployment)
- **GameRewards**: `TBD` (update after deployment)
- **TournamentManager**: `TBD` (update after deployment)
- **TournamentPayments**: `TBD` (update after deployment)
- **TokenSale**: `TBD` (update after deployment)
- **TreasuryGasManager**: `TBD` (update after deployment)
- **TestnetFaucet**: N/A (testnet only)
- **Explorer**: https://arbiscan.io

## 🐛 Troubleshooting

### Compilation Errors

**"ReentrancyGuard not found"**
- OpenZeppelin v5 moved it to `utils/ReentrancyGuard`
- Already fixed in current version

**"Uniswap imports not found"**
```bash
npm install @uniswap/v3-periphery @uniswap/v3-core
```

### Deployment Errors

**"Insufficient funds"**
- Get more testnet ETH from faucet
- Check wallet balance

**"Nonce too low"**
- Wait a few minutes
- Retry deployment

**"Network not supported"**
- Verify hardhat.config.ts network settings
- Check RPC URL is correct

### Verification Errors

**"Already verified"**
- Contract already verified on Arbiscan
- No action needed

**"Constructor arguments required"**
- Use exact arguments from deployment
- Check deployment script output

### Tournament Creation Fails

**"Only owner can create"**
- Check deployer is contract owner
- Verify wallet address matches

**"Start time must be in future"**
- Ensure startTime > current block.timestamp
- Account for clock skew

## 📚 Additional Resources

- [Full Deployment Guide](../docs/deployment/testnet-deployment.md)
- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts v5](https://docs.openzeppelin.com/contracts/5.x/)
- [Arbitrum Documentation](https://docs.arbitrum.io)
- [Uniswap V3 Documentation](https://docs.uniswap.org/contracts/v3/overview)
- [Arbiscan Block Explorer](https://arbiscan.io)

## ⚠️ Important Notes

1. **Gas Costs**: Arbitrum has 90%+ lower gas fees than Ethereum mainnet
2. **Network**: Always verify you're on correct network (testnet/mainnet)
3. **Private Keys**: NEVER share or commit private keys
4. **Testing**: Thoroughly test on testnet before mainnet (3-6 months recommended)
5. **Backups**: Keep backups of all deployment addresses and configs
6. **Monitoring**: Set up event monitoring after deployment
7. **Audits**: Consider professional audit before mainnet launch
8. **Liquidity**: Lock DEX liquidity for minimum 3 years

## 📞 Support

For deployment assistance or questions:
- Review [Testnet Deployment Guide](../docs/deployment/testnet-deployment.md)
- Check Firebase logs: `firebase functions:log`
- Monitor contract events on Arbiscan
- Verify all environment variables are set

---

**Built for Arbitrum One** 🎮
*Low fees, fast finality, Ethereum security*
