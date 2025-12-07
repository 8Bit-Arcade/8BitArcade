# 8-Bit Arcade Smart Contracts

Smart contracts for the 8-Bit Arcade game rewards system on Arbitrum.

## 📋 Contracts Overview

### EightBitToken (8BIT)
- **Type**: ERC20 Token
- **Max Supply**: 100,000,000 8BIT
- **Purpose**: Reward token for players
- **Features**: Mintable by GameRewards contract only

### GameRewards
- **Purpose**: Distributes daily leaderboard rewards
- **Rewards**: Top 10 players receive tokens daily
- **Distribution**: Automated by backend server

## 🚀 Deployment Guide

### Prerequisites

1. **Node.js** (v18 or higher)
2. **npm** or **yarn**
3. **Deployer wallet** with ETH on Arbitrum Sepolia (testnet)
4. **Arbiscan API key** for contract verification

### Step 1: Install Dependencies

```bash
cd contracts
npm install
```

### Step 2: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit .env and fill in:
# - PRIVATE_KEY: Your deployer wallet private key
# - ARBISCAN_API_KEY: Your Arbiscan API key
```

### Step 3: Get Testnet ETH

Visit: https://faucet.quicknode.com/arbitrum/sepolia

Send some Arbitrum Sepolia ETH to your deployer wallet.

### Step 4: Deploy to Testnet

```bash
npm run deploy:testnet
```

This will:
- Deploy EightBitToken
- Deploy GameRewards
- Link the contracts together
- Display deployment addresses

**⚠️ SAVE THE DEPLOYMENT ADDRESSES!**

### Step 5: Update Frontend Config

Edit `frontend/src/config/contracts.ts`:

```typescript
const TESTNET_CONTRACTS = {
  EIGHT_BIT_TOKEN: '0xYourTokenAddress',
  GAME_REWARDS: '0xYourRewardsAddress',
  // ... rest of config
};
```

### Step 6: Set Rewards Distributor

The rewards distributor is the backend wallet that will call `distributeRewards()`.

1. Create a new secure wallet for the backend
2. Call the setter function:

```bash
# Using Hardhat console
npx hardhat console --network arbitrumSepolia

# In the console:
const GameRewards = await ethers.getContractFactory("GameRewards");
const rewards = await GameRewards.attach("0xYourRewardsAddress");
await rewards.setRewardsDistributor("0xYourBackendWalletAddress");
```

Or use Arbiscan's "Write Contract" interface.

### Step 7: Verify Contracts

```bash
npx hardhat verify --network arbitrumSepolia 0xYourTokenAddress
npx hardhat verify --network arbitrumSepolia 0xYourRewardsAddress 0xYourTokenAddress
```

## 🎯 Mainnet Deployment

### When Ready to Launch

1. **Test thoroughly on testnet** - Play games, distribute rewards, verify everything works
2. **Deploy to mainnet**:
   ```bash
   npm run deploy:mainnet
   ```
3. **Update frontend config** with mainnet addresses
4. **Switch to mainnet** in `frontend/src/config/contracts.ts`:
   ```typescript
   export const USE_TESTNET = false; // Set to false for mainnet
   ```
5. **Verify mainnet contracts**:
   ```bash
   npm run verify:mainnet 0xTokenAddress 0xRewardsAddress
   ```

## 📊 Reward Distribution

### Daily Reward Structure

| Rank | Percentage | Amount (10K pool) |
|------|-----------|-------------------|
| 1st  | 25%       | 2,500 8BIT        |
| 2-5  | 12.5% each| 1,250 8BIT each   |
| 6-10 | 5% each   | 500 8BIT each     |

**Total Daily**: 10,000 8BIT

### Backend Integration

Your Firebase function should call `distributeRewards()` daily:

```typescript
// Example Firebase function
import { ethers } from 'ethers';

async function distributeDaily Rewards() {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(BACKEND_PRIVATE_KEY, provider);

  const rewards = new ethers.Contract(
    GAME_REWARDS_ADDRESS,
    GAME_REWARDS_ABI,
    wallet
  );

  // Get top 10 players from Firestore
  const topPlayers = await getTop10FromLeaderboard();

  // Format for contract
  const players = topPlayers.map(p => p.address);
  const ranks = topPlayers.map((p, i) => i + 1);
  const dayId = getTodayDayId(); // e.g., 20250107 for Jan 7, 2025

  // Distribute rewards
  const tx = await rewards.distributeRewards(dayId, players, ranks);
  await tx.wait();

  console.log('Rewards distributed for day:', dayId);
}
```

## 🔒 Security Checklist

- [ ] Never commit .env file
- [ ] Use separate wallet for deployment
- [ ] Use separate wallet for rewards distribution
- [ ] Test all functions on testnet first
- [ ] Verify contracts on Arbiscan
- [ ] Set proper rewardsDistributor address
- [ ] Keep private keys in secure environment variables
- [ ] Audit contracts before mainnet deployment
- [ ] Set up monitoring for contract events

## 📝 Contract Addresses

### Testnet (Arbitrum Sepolia)
- **8BIT Token**: `TBD` (update after deployment)
- **GameRewards**: `TBD` (update after deployment)
- **Explorer**: https://sepolia.arbiscan.io

### Mainnet (Arbitrum One)
- **8BIT Token**: `TBD` (update after deployment)
- **GameRewards**: `TBD` (update after deployment)
- **Explorer**: https://arbiscan.io

## 🛠️ Development

### Compile Contracts
```bash
npm run compile
```

### Run Tests
```bash
npm test
```

### Local Development
```bash
npx hardhat node  # Start local node
npm run deploy    # Deploy to local node
```

## 📚 Additional Resources

- [Hardhat Documentation](https://hardhat.org/docs)
- [OpenZeppelin Contracts](https://docs.openzeppelin.com/contracts)
- [Arbitrum Documentation](https://docs.arbitrum.io)
- [Arbiscan](https://arbiscan.io)
- [WalletConnect Cloud](https://cloud.walletconnect.com)

## ⚠️ Important Notes

1. **Gas Costs**: Arbitrum has very low gas fees compared to Ethereum mainnet
2. **Network**: Always double-check you're on the correct network (testnet vs mainnet)
3. **Private Keys**: Never share or commit private keys
4. **Testing**: Thoroughly test on testnet before mainnet deployment
5. **Backup**: Keep backup of deployment addresses and configuration

## 🐛 Troubleshooting

### "Insufficient funds" error
- Make sure your wallet has enough ETH for gas
- Get testnet ETH from the faucet

### "Network not supported" error
- Check your RPC URL in hardhat.config.ts
- Verify you're connected to the right network

### "Verification failed" error
- Make sure contract is deployed
- Check you're using the correct constructor arguments
- Verify on the correct network (testnet vs mainnet)
