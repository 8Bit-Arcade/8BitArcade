# Testnet Deployment Guide

Complete guide for deploying 8-Bit Arcade to Arbitrum Sepolia testnet.

> **📋 Current Testnet Contracts**
>
> For the current deployed testnet contract addresses, see: [Contract Addresses](../contracts/addresses.md)
>
> This guide is for deploying your own instance or redeploying to testnet.

## Prerequisites

### 1. **Deployer Wallet**
- Create a dedicated wallet for deployment (don't use your main wallet)
- Export the private key (you'll need this for `.env`)
- Fund it with Arbitrum Sepolia ETH from: https://faucet.quicknode.com/arbitrum/sepolia
- Recommended: 0.1-0.2 ETH for all deployments

### 2. **Arbiscan API Key**
- Sign up at: https://arbiscan.io/
- Get API key from: https://arbiscan.io/myapikey
- Used for contract verification

### 3. **Environment Setup**

Create `/contracts/.env` file:

```bash
# Deployer wallet private key (KEEP THIS SECRET!)
PRIVATE_KEY=0xyour_private_key_here

# Arbiscan API key for contract verification
ARBISCAN_API_KEY=your_arbiscan_api_key_here
```

⚠️ **NEVER commit the `.env` file to git!**

## Deployment Steps

### Step 1: Install Dependencies

```bash
cd contracts
npm install
```

### Step 2: Compile Contracts

```bash
npx hardhat compile
```

This should compile all contracts without errors. If you see errors, check:
- All OpenZeppelin imports are correct (v5 uses `utils/` instead of `security/`)
- Uniswap V3 dependencies are installed
- Solidity version 0.8.20 is available

### Step 3: Deploy to Testnet

```bash
npm run deploy:testnet
```

This will deploy:
- ✅ EightBitToken (8BIT)
- ✅ GameRewards
- ✅ TournamentManager
- ✅ TournamentPayments (ETH/USDC payment handling)
- ✅ TokenSale
- ✅ TreasuryGasManager
- ✅ TestnetFaucet (testnet only)

**Save all deployed addresses!** You'll need them for the next steps.

### Step 4: Verify Contracts on Arbiscan

The deployment script will print verification commands. Run each one:

```bash
npx hardhat verify --network arbitrumSepolia <TOKEN_ADDRESS>
npx hardhat verify --network arbitrumSepolia <REWARDS_ADDRESS> <TOKEN_ADDRESS>
npx hardhat verify --network arbitrumSepolia <TOURNAMENT_ADDRESS> <TOKEN_ADDRESS>
npx hardhat verify --network arbitrumSepolia <PAYMENTS_ADDRESS> <TOKEN_ADDRESS> <USDC> <WETH> <ROUTER>
npx hardhat verify --network arbitrumSepolia <SALE_ADDRESS> <TOKEN_ADDRESS> <USDC> 0
npx hardhat verify --network arbitrumSepolia <TREASURY_ADDRESS> <DEPLOYER> <MIN_THRESHOLD> <REFILL_AMOUNT>
npx hardhat verify --network arbitrumSepolia <FAUCET_ADDRESS> <TOKEN_ADDRESS>
```

### Step 5: Update Frontend Config

Edit `/frontend/src/config/contracts.ts`:

```typescript
const TESTNET_CONTRACTS = {
  EIGHT_BIT_TOKEN: '0xYourTokenAddress',
  GAME_REWARDS: '0xYourRewardsAddress',
  TOURNAMENT_MANAGER: '0xYourTournamentAddress',
  TOURNAMENT_PAYMENTS: '0xYourPaymentsAddress', // <-- ADD THIS
  TOKEN_SALE: '0xYourSaleAddress',
  TESTNET_FAUCET: '0xYourFaucetAddress',
  USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Already correct
  CHAIN_ID: 421614,
  CHAIN_NAME: 'Arbitrum Sepolia',
  RPC_URL: 'https://sepolia-rollup.arbitrum.io/rpc',
  BLOCK_EXPLORER: 'https://sepolia.arbiscan.io',
};
```

Also add the TournamentPayments ABI to the exports.

### Step 6: Configure Firebase Functions

Set environment variables for automated tournament creation:

```bash
cd functions

# Set tournament manager contract address
firebase functions:config:set tournament.manager="0xYourTournamentManagerAddress"

# Set deployer private key (for creating tournaments)
firebase functions:config:set deployer.private_key="0xYourDeployerPrivateKey"

# Set network (testnet or mainnet)
firebase functions:config:set network="testnet"
```

### Step 7: Deploy Firebase Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

This will deploy the automated tournament creation schedulers:
- `createWeeklyTournaments` - Runs every Monday at 00:00 UTC
- `createMonthlyTournaments` - Runs on 1st of month at 00:00 UTC

### Step 8: Contract Configuration

#### A. Set Rewards Distributor
```javascript
// Using Hardhat console or Etherscan Write Contract
const rewards = await ethers.getContractAt("GameRewards", REWARDS_ADDRESS);
await rewards.setRewardsDistributor(BACKEND_WALLET_ADDRESS);
```

#### B. Set Tournament Manager
```javascript
const tournaments = await ethers.getContractAt("TournamentManager", TOURNAMENT_ADDRESS);
await tournaments.setTournamentManager(BACKEND_WALLET_ADDRESS);
```

#### C. Fund Treasury Gas Manager
```bash
# Send 1 ETH to treasury for automated gas management
cast send <TREASURY_ADDRESS> --value 1ether --private-key <PRIVATE_KEY> --rpc-url https://sepolia-rollup.arbitrum.io/rpc
```

#### D. Configure TournamentPayments
```javascript
const payments = await ethers.getContractAt("TournamentPayments", PAYMENTS_ADDRESS);

// Set tournament fees (in USDC, 6 decimals)
await payments.setTournamentFee(1, 1000000);  // Standard Weekly: $1
await payments.setTournamentFee(2, 5000000);  // Standard Monthly: $5
await payments.setTournamentFee(3, 5000000);  // High Roller Weekly: $5
await payments.setTournamentFee(4, 25000000); // High Roller Monthly: $25

// After adding liquidity to Uniswap, set pool addresses:
await payments.setPools(EIGHTBIT_USDC_POOL, WETH_USDC_POOL);
```

## Testing

### 1. **Test Faucet**
- Visit your frontend
- Connect wallet
- Claim tokens from faucet
- Verify you receive 10,000 8BIT

### 2. **Test Games**
- Play each game
- Submit scores
- Check leaderboards update correctly

### 3. **Test Tournaments**
- Wait for automated tournament creation (or create manually)
- Enter tournament
- Play games
- Verify scores are tracked

### 4. **Test Payments**
- Approve USDC spending
- Pay tournament fee with USDC
- Pay tournament fee with ETH
- Verify both payment methods work

## Automated Tournament Creation

### How It Works

Two scheduled Cloud Functions automatically create tournaments:

**Weekly Tournaments** (`createWeeklyTournaments`)
- Runs: Every Monday at 00:00 UTC
- Creates: 2 tournaments (Standard + High Roller)
- Duration: 7 days
- Entry fees: $1 (Standard), $5 (High Roller)
- Prizes: $25 (Standard), $75 (High Roller)

**Monthly Tournaments** (`createMonthlyTournaments`)
- Runs: 1st day of each month at 00:00 UTC
- Creates: 2 tournaments (Standard + High Roller)
- Duration: 30 days
- Entry fees: $5 (Standard), $25 (High Roller)
- Prizes: $50 (Standard), $250 (High Roller)

### Manual Tournament Creation (for testing)

If you need to create tournaments manually before the scheduled time:

```javascript
// Using Hardhat console
const tournaments = await ethers.getContractAt("TournamentManager", TOURNAMENT_ADDRESS);

const now = Math.floor(Date.now() / 1000);
const startTime = now + 3600; // Start in 1 hour
const endTime = startTime + (7 * 24 * 60 * 60); // 7 days

// Create Standard Weekly
await tournaments.createTournament(
  0, // Tier.STANDARD
  0, // Period.WEEKLY
  startTime,
  endTime
);

// Create High Roller Weekly
await tournaments.createTournament(
  1, // Tier.HIGH_ROLLER
  0, // Period.WEEKLY
  startTime,
  endTime
);
```

Or call the Firebase function manually:
```bash
firebase functions:shell
createWeeklyTournaments()
```

## Monitoring

### Contract Events
Monitor on Arbiscan:
- `TournamentCreated` - New tournaments created
- `PlayerEntered` - Players entering tournaments
- `WinnerDeclared` - Tournament winners
- `RewardDistributed` - Daily rewards distributed

### Firebase Logs
```bash
firebase functions:log
```

Look for:
- Tournament creation logs (every Monday and 1st of month)
- Daily reward distribution logs
- Score submission logs

## Troubleshooting

### Deployment Fails
- **"Insufficient funds"**: Get more testnet ETH from faucet
- **"Nonce too low"**: Wait a few minutes and retry
- **Compilation errors**: Check OpenZeppelin v5 imports

### Tournament Creation Fails
- Check `TOURNAMENT_MANAGER_ADDRESS` is set correctly in Firebase config
- Verify deployer wallet has enough ETH for gas
- Check deployer wallet is set as owner in contract

### Frontend Not Connecting
- Verify `USE_TESTNET = true` in `contracts.ts`
- Check all contract addresses are updated
- Make sure MetaMask is on Arbitrum Sepolia network

## Next Steps

After successful testnet deployment:

1. **Community Testing** (3-6 months)
   - Share testnet with community
   - Collect feedback
   - Fix bugs and improve UX

2. **Add Liquidity** (when ready for real trading)
   - Create Uniswap V3 pools (8BIT/USDC, WETH/USDC)
   - Add initial liquidity
   - Configure pool addresses in TournamentPayments

3. **Mainnet Deployment**
   - Follow same steps but use `npm run deploy:mainnet`
   - Use real funds and real USDC
   - Set `USE_TESTNET = false` in frontend config

4. **Token Sale**
   - Announce sale start time
   - Enable TokenSale contract
   - Monitor for participants

5. **Launch** 🚀
   - Public announcement
   - Marketing campaign
   - First high roller tournament!

## Support

If you encounter issues:
1. Check Firebase logs: `firebase functions:log`
2. Check contract events on Arbiscan
3. Verify all environment variables are set correctly
4. Review this guide again - most issues are configuration errors

---

**Security Reminders:**
- ✅ Never commit `.env` files
- ✅ Use separate wallets for deployment and operations
- ✅ Test everything thoroughly on testnet first
- ✅ Get contracts audited before mainnet launch
- ✅ Monitor contracts regularly after deployment
