# 8-Bit Arcade - Complete Deployment Guide

## 🎯 Overview

This guide walks you through deploying all 8-Bit Arcade smart contracts to Arbitrum Sepolia testnet, then configuring them for automated operation.

## ✅ Deployment Preparation (COMPLETED)

The following setup has already been completed:

- ✅ All contracts compiled successfully
- ✅ Deployment script includes all contracts (7 total)
- ✅ `.env` file created with PRIVATE_KEY and ARBISCAN_API_KEY
- ✅ Fixed Ownable constructor compatibility issues
- ✅ Hardhat configuration updated

## 📋 Prerequisites

Before you begin deployment:

### 1. Verify .env Configuration

```bash
cd contracts
cat .env
```

Make sure it contains:
```env
PRIVATE_KEY=<your_deployer_private_key_without_0x>
ARBISCAN_API_KEY=CWUX23CQVV5JGN79U9IYWCX25FZHEJKBKK
```

### 2. Fund Your Deployer Wallet

**Get your deployer wallet address:**
```bash
# The private key in your .env corresponds to a specific address
# You can check it in MetaMask or use this command:
npx hardhat console --network arbitrumSepolia
# Then in console: (await ethers.getSigners())[0].address
```

**Get testnet ETH:**
- Visit: https://faucet.quicknode.com/arbitrum/sepolia
- Or: https://bwarelabs.com/faucets/arbitrum-sepolia
- Request testnet ETH (you need ~0.05 ETH for deployment)

### 3. Verify Wallet Balance

```bash
# This will be shown when you run the deployment script
npm run deploy:testnet
# (It shows balance before starting deployment)
```

## 🚀 Step 1: Deploy All Contracts

**From your LOCAL machine** (not this environment):

```bash
cd contracts
npm run deploy:testnet
```

This will deploy 7 contracts:
1. **EightBitToken** (8BIT) - The main token
2. **GameRewards** - Handles daily leaderboard rewards
3. **TournamentManager** - Manages tournament logic
4. **TournamentPayments** - Handles tournament fees and buyback
5. **TokenSale** - Presale contract
6. **TreasuryGasManager** - Automated gas refills for backend
7. **TestnetFaucet** - Testnet-only token faucet

**Expected Output:**
```
═══════════════════════════════════════════════════
  8-BIT ARCADE - SMART CONTRACT DEPLOYMENT
═══════════════════════════════════════════════════

Deploying contracts with account: 0xYourAddress...
Account balance: 0.05 ETH

✅ EightBitToken deployed to: 0x...
✅ GameRewards deployed to: 0x...
✅ TournamentManager deployed to: 0x...
✅ TournamentPayments deployed to: 0x...
✅ TokenSale deployed to: 0x...
✅ TreasuryGasManager deployed to: 0x...
✅ TestnetFaucet deployed to: 0x...
```

**IMPORTANT:** Save all these contract addresses! You'll need them for the next steps.

## 📝 Step 2: Update Frontend Configuration

Update `frontend/src/config/contracts.ts` with your deployed addresses:

```typescript
const TESTNET_CONTRACTS = {
  EIGHT_BIT_TOKEN: '0x...', // ← Your deployed EightBitToken address
  GAME_REWARDS: '0x...',    // ← Your deployed GameRewards address
  TOURNAMENT_MANAGER: '0x...', // ← Your deployed TournamentManager address
  TOURNAMENT_PAYMENTS: '0x...', // ← Your deployed TournamentPayments address
  TOKEN_SALE: '0x...',      // ← Your deployed TokenSale address
  TREASURY_GAS_MANAGER: '0x...', // ← Your deployed TreasuryGasManager address
  TESTNET_FAUCET: '0x...',  // ← Your deployed TestnetFaucet address
  USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia USDC
  CHAIN_ID: 421614,
  CHAIN_NAME: 'Arbitrum Sepolia',
  RPC_URL: 'https://sepolia-rollup.arbitrum.io/rpc',
  BLOCK_EXPLORER: 'https://sepolia.arbiscan.io',
};
```

## ✅ Step 3: Verify Contracts on Arbiscan

Verify each contract on Arbiscan for transparency:

```bash
cd contracts

# 1. Verify EightBitToken
npx hardhat verify --network arbitrumSepolia <EIGHT_BIT_TOKEN_ADDRESS>

# 2. Verify GameRewards
npx hardhat verify --network arbitrumSepolia <GAME_REWARDS_ADDRESS> <EIGHT_BIT_TOKEN_ADDRESS>

# 3. Verify TournamentManager
npx hardhat verify --network arbitrumSepolia <TOURNAMENT_MANAGER_ADDRESS> <EIGHT_BIT_TOKEN_ADDRESS>

# 4. Verify TournamentPayments
npx hardhat verify --network arbitrumSepolia <TOURNAMENT_PAYMENTS_ADDRESS> \
  <EIGHT_BIT_TOKEN_ADDRESS> \
  0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d \
  0x980B62Da83eFf3D4576C647993b0c1D7faf17c73 \
  0xE592427A0AEce92De3Edee1F18E0157C05861564

# 5. Verify TokenSale
npx hardhat verify --network arbitrumSepolia <TOKEN_SALE_ADDRESS> \
  <EIGHT_BIT_TOKEN_ADDRESS> \
  0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d \
  0

# 6. Verify TreasuryGasManager
# First, get the constructor args from deployment output
npx hardhat verify --network arbitrumSepolia <TREASURY_ADDRESS> \
  <DEPLOYER_ADDRESS> \
  50000000000000000 \
  100000000000000000

# 7. Verify TestnetFaucet
npx hardhat verify --network arbitrumSepolia <TESTNET_FAUCET_ADDRESS> <EIGHT_BIT_TOKEN_ADDRESS>
```

## ⚙️ Step 4: Configure Contracts

### 4.1 Create Backend Wallet

Create a new wallet (separate from deployer) for backend operations:
- This wallet will handle daily rewards distribution
- Create automated tournaments
- Receive gas refills from TreasuryGasManager

**Save the private key securely** - you'll need it for Firebase Functions config.

### 4.2 Configure Contract Roles

Open Hardhat console:
```bash
cd contracts
npx hardhat console --network arbitrumSepolia
```

**In the console, run these commands:**

```javascript
// ========== REPLACE THESE ADDRESSES ==========
const BACKEND_WALLET = "0xYourBackendWalletAddress";
const TOKEN_ADDRESS = "0xYourEightBitTokenAddress";
const REWARDS_ADDRESS = "0xYourGameRewardsAddress";
const TOURNAMENT_MANAGER_ADDRESS = "0xYourTournamentManagerAddress";
const TOURNAMENT_PAYMENTS_ADDRESS = "0xYourTournamentPaymentsAddress";
const TREASURY_ADDRESS = "0xYourTreasuryGasManagerAddress";
// ==============================================

// 1. Set rewards distributor (allows backend to distribute daily rewards)
const rewards = await ethers.getContractAt("GameRewards", REWARDS_ADDRESS);
await (await rewards.setRewardsDistributor(BACKEND_WALLET)).wait();
console.log("✅ Rewards distributor set");

// 2. Set tournament manager (allows backend to create tournaments)
const tournaments = await ethers.getContractAt("TournamentManager", TOURNAMENT_MANAGER_ADDRESS);
await (await tournaments.setTournamentManager(BACKEND_WALLET)).wait();
console.log("✅ Tournament manager set");

// 3. Set treasury payout wallet (backend receives gas refills)
const treasury = await ethers.getContractAt("TreasuryGasManager", TREASURY_ADDRESS);
await (await treasury.setPayoutWallet(BACKEND_WALLET)).wait();
console.log("✅ Payout wallet set");

// 4. Authorize GameRewards to mint tokens
const token = await ethers.getContractAt("EightBitToken", TOKEN_ADDRESS);
await (await token.setAuthorizedMinter(REWARDS_ADDRESS, true)).wait();
console.log("✅ GameRewards authorized as minter");

// 5. Fund treasury with ETH for gas refills
const [deployer] = await ethers.getSigners();
const tx = await deployer.sendTransaction({
  to: TREASURY_ADDRESS,
  value: ethers.parseEther("0.1") // 0.1 ETH for testnet
});
await tx.wait();
console.log("✅ Treasury funded with 0.1 ETH");

// 6. Set tournament fees (USDC has 6 decimals)
const payments = await ethers.getContractAt("TournamentPayments", TOURNAMENT_PAYMENTS_ADDRESS);
await (await payments.setTournamentFee(1, 1_000_000)).wait();   // Standard Weekly: $1
await (await payments.setTournamentFee(2, 5_000_000)).wait();   // Standard Monthly: $5
await (await payments.setTournamentFee(3, 5_000_000)).wait();   // High Roller Weekly: $5
await (await payments.setTournamentFee(4, 25_000_000)).wait();  // High Roller Monthly: $25
console.log("✅ Tournament fees configured");

console.log("\n🎉 All contract configuration complete!");
```

### 4.3 Verify Configuration

Still in the Hardhat console:

```javascript
// Verify all settings
console.log("Rewards Distributor:", await rewards.rewardsDistributor());
console.log("Tournament Manager:", await tournaments.tournamentManager());
console.log("Payout Wallet:", await treasury.payoutWallet());
console.log("GameRewards Authorized:", await token.authorizedMinters(REWARDS_ADDRESS));
console.log("Treasury Balance:", ethers.formatEther(await ethers.provider.getBalance(TREASURY_ADDRESS)), "ETH");
console.log("Tournament Fee (Standard Weekly):", await payments.tournamentFees(1));
```

Expected output:
```
Rewards Distributor: 0xYourBackendWallet...
Tournament Manager: 0xYourBackendWallet...
Payout Wallet: 0xYourBackendWallet...
GameRewards Authorized: true
Treasury Balance: 0.1 ETH
Tournament Fee (Standard Weekly): 1000000
```

## 🔥 Step 5: Configure Firebase Functions

See `.github/FIREBASE_CONFIG.md` for detailed Firebase setup.

Quick commands:

```bash
# Set all Firebase config at once
firebase functions:config:set \
  app.network="testnet" \
  deployer.private_key="<BACKEND_WALLET_PRIVATE_KEY>" \
  deployer.address="<BACKEND_WALLET_ADDRESS>" \
  contracts.token="<EIGHT_BIT_TOKEN_ADDRESS>" \
  contracts.rewards="<GAME_REWARDS_ADDRESS>" \
  contracts.tournaments="<TOURNAMENT_MANAGER_ADDRESS>" \
  contracts.payments="<TOURNAMENT_PAYMENTS_ADDRESS>" \
  treasury.address="<TREASURY_GAS_MANAGER_ADDRESS>"

# Verify config
firebase functions:config:get

# Deploy functions
cd functions
npm run build
firebase deploy --only functions
```

## 📊 Step 6: Test Everything

### Test 1: Claim Testnet Tokens

```bash
# In Hardhat console
const faucet = await ethers.getContractAt("TestnetFaucet", "<TESTNET_FAUCET_ADDRESS>");
await (await faucet.claimTokens()).wait();
console.log("✅ Claimed 10,000 8BIT from faucet");
```

### Test 2: Manual Tournament Creation

Create a test tournament via Firebase function or directly:

```javascript
// In Hardhat console
const tournaments = await ethers.getContractAt("TournamentManager", TOURNAMENT_MANAGER_ADDRESS);
const now = Math.floor(Date.now() / 1000);
const oneWeek = 7 * 24 * 60 * 60;

await (await tournaments.createTournament(
  "Test Weekly Tournament",
  0, // Tier: Standard
  0, // Period: Weekly
  now,
  now + oneWeek,
  ethers.parseEther("0"), // Entry fee (0 for testing)
  ethers.parseEther("10000") // Prize pool
)).wait();

console.log("✅ Test tournament created");
```

### Test 3: Verify Frontend Connection

```bash
cd frontend
npm run dev
```

Visit `http://localhost:3000` and:
1. Connect your MetaMask wallet (switch to Arbitrum Sepolia)
2. Check that you can see your token balance
3. Try claiming from the faucet
4. Check tournament list

## 🎉 Deployment Complete!

Your 8-Bit Arcade testnet deployment is now live!

### Next Steps:

1. **Test gameplay** - Play games, submit scores, claim daily rewards
2. **Monitor gas usage** - Check TreasuryGasManager refills
3. **Test tournaments** - Create and run full tournament cycles
4. **Prepare for mainnet** - When ready, repeat process with `npm run deploy:mainnet`

## 📚 Reference Documents

- **Post-Deployment Config:** `.github/POST_DEPLOYMENT_CONFIG.md`
- **Firebase Config:** `.github/FIREBASE_CONFIG.md`
- **Wallet Setup:** `.github/WALLET_SETUP.md`
- **Tokenomics:** `TOKENOMICS.md`

## ⚠️ Troubleshooting

### "Insufficient funds for gas"
- Fund your deployer wallet with more Arbitrum Sepolia ETH
- Visit faucets: https://faucet.quicknode.com/arbitrum/sepolia

### "Already verified"
- Contract was already verified on Arbiscan, skip that verification step

### "Invalid API Key"
- Check your ARBISCAN_API_KEY in .env
- Get a new key from: https://arbiscan.io/myapikey

### "Transaction reverted"
- Check that you're using the deployer wallet (owner)
- Verify the contract address is correct
- Make sure you have enough ETH for gas

---

**Created:** December 2024
**Network:** Arbitrum Sepolia Testnet
**Status:** Ready for Deployment ✅
