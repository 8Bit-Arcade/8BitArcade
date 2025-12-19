# Quick Deployment Reference

## Backend Wallet Address
```
0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B
```

## Deployment Workflow

### Step 1: Merge to Main (Triggers Firebase Deploy)
```bash
# Create PR or merge directly
git checkout main
git merge claude/plan-arcade-game-setup-01PGdN4z7MEcaiF1tRojgjD7
git push origin main
# → Firebase auto-deploys
```

### Step 2: Pull Main Locally
```bash
git checkout main
git pull origin main
cd contracts
```

### Step 3: Deploy Contracts (From Local Machine)
```bash
# Make sure you have testnet ETH first!
npm run deploy:testnet
```

**Save all contract addresses that are printed!**

### Step 4: Configure Hardhat Console
```bash
npx hardhat console --network arbitrumSepolia
```

**Run this in the console (replace addresses with your deployed ones):**

```javascript
// ========== REPLACE THESE ADDRESSES ==========
const BACKEND_WALLET = "0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B";
const TOKEN_ADDRESS = "0x..."; // From deployment output
const REWARDS_ADDRESS = "0x..."; // From deployment output
const TOURNAMENT_MANAGER_ADDRESS = "0x..."; // From deployment output
const TOURNAMENT_PAYMENTS_ADDRESS = "0x..."; // From deployment output
const TREASURY_ADDRESS = "0x..."; // From deployment output
// ==============================================

// 1. Set rewards distributor
const rewards = await ethers.getContractAt("GameRewards", REWARDS_ADDRESS);
await (await rewards.setRewardsDistributor(BACKEND_WALLET)).wait();
console.log("✅ Rewards distributor set");

// 2. Set tournament manager
const tournaments = await ethers.getContractAt("TournamentManager", TOURNAMENT_MANAGER_ADDRESS);
await (await tournaments.setTournamentManager(BACKEND_WALLET)).wait();
console.log("✅ Tournament manager set");

// 3. Set treasury payout wallet
const treasury = await ethers.getContractAt("TreasuryGasManager", TREASURY_ADDRESS);
await (await treasury.setPayoutWallet(BACKEND_WALLET)).wait();
console.log("✅ Payout wallet set");

// 4. Authorize GameRewards to mint
const token = await ethers.getContractAt("EightBitToken", TOKEN_ADDRESS);
await (await token.setAuthorizedMinter(REWARDS_ADDRESS, true)).wait();
console.log("✅ GameRewards authorized");

// 5. Fund treasury
const [deployer] = await ethers.getSigners();
const tx = await deployer.sendTransaction({
  to: TREASURY_ADDRESS,
  value: ethers.parseEther("0.1")
});
await tx.wait();
console.log("✅ Treasury funded with 0.1 ETH");

// 6. Set tournament fees
const payments = await ethers.getContractAt("TournamentPayments", TOURNAMENT_PAYMENTS_ADDRESS);
await (await payments.setTournamentFee(1, 1_000_000)).wait();
await (await payments.setTournamentFee(2, 5_000_000)).wait();
await (await payments.setTournamentFee(3, 5_000_000)).wait();
await (await payments.setTournamentFee(4, 25_000_000)).wait();
console.log("✅ Tournament fees configured");

console.log("\n🎉 Contract configuration complete!");
```

### Step 5: Configure Firebase Functions

```bash
# Get your backend wallet private key ready (KEEP IT SECRET!)
# Replace all the addresses below with your deployed contract addresses

firebase functions:config:set \
  app.network="testnet" \
  deployer.private_key="YOUR_BACKEND_WALLET_PRIVATE_KEY" \
  deployer.address="0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B" \
  contracts.token="0x..." \
  contracts.rewards="0x..." \
  contracts.tournaments="0x..." \
  contracts.payments="0x..." \
  treasury.address="0x..."

# Verify config
firebase functions:config:get

# Redeploy functions with new config
cd functions
firebase deploy --only functions
```

### Step 6: Update Frontend Config

Edit `frontend/src/config/contracts.ts`:

```typescript
const TESTNET_CONTRACTS = {
  EIGHT_BIT_TOKEN: '0x...', // Your EightBitToken address
  GAME_REWARDS: '0x...',
  TOURNAMENT_MANAGER: '0x...',
  TOURNAMENT_PAYMENTS: '0x...',
  TOKEN_SALE: '0x...',
  TREASURY_GAS_MANAGER: '0x...',
  TESTNET_FAUCET: '0x...',
  USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  CHAIN_ID: 421614,
  CHAIN_NAME: 'Arbitrum Sepolia',
  RPC_URL: 'https://sepolia-rollup.arbitrum.io/rpc',
  BLOCK_EXPLORER: 'https://sepolia.arbiscan.io',
};
```

### Step 7: Verify Contracts on Arbiscan

```bash
npx hardhat verify --network arbitrumSepolia <EIGHT_BIT_TOKEN_ADDRESS>

npx hardhat verify --network arbitrumSepolia <GAME_REWARDS_ADDRESS> <EIGHT_BIT_TOKEN_ADDRESS>

npx hardhat verify --network arbitrumSepolia <TOURNAMENT_MANAGER_ADDRESS> <EIGHT_BIT_TOKEN_ADDRESS>

npx hardhat verify --network arbitrumSepolia <TOURNAMENT_PAYMENTS_ADDRESS> \
  <EIGHT_BIT_TOKEN_ADDRESS> \
  0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d \
  0x980B62Da83eFf3D4576C647993b0c1D7faf17c73 \
  0xE592427A0AEce92De3Edee1F18E0157C05861564

npx hardhat verify --network arbitrumSepolia <TOKEN_SALE_ADDRESS> \
  <EIGHT_BIT_TOKEN_ADDRESS> \
  0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d \
  0

npx hardhat verify --network arbitrumSepolia <TREASURY_ADDRESS> \
  <DEPLOYER_ADDRESS> \
  50000000000000000 \
  100000000000000000

npx hardhat verify --network arbitrumSepolia <TESTNET_FAUCET_ADDRESS> <EIGHT_BIT_TOKEN_ADDRESS>
```

## Important Addresses

**Backend Wallet:** `0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B`

**Arbitrum Sepolia Testnet:**
- USDC: `0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`
- WETH: `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73`
- Uniswap V3 Router: `0xE592427A0AEce92De3Edee1F18E0157C05861564`

**Arbitrum One Mainnet:**
- USDC: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- WETH: `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`
- Uniswap V3 Router: `0xE592427A0AEce92De3Edee1F18E0157C05861564`

## Testnet Faucets

Get Arbitrum Sepolia ETH:
- https://faucet.quicknode.com/arbitrum/sepolia
- https://bwarelabs.com/faucets/arbitrum-sepolia

## Checklist

- [ ] Backend wallet funded with testnet ETH for gas
- [ ] Deployer wallet funded with ~0.1 ETH for deployment
- [ ] Contracts deployed to testnet
- [ ] All contract addresses saved
- [ ] Hardhat console configuration complete
- [ ] Firebase Functions configured
- [ ] Frontend config updated
- [ ] Contracts verified on Arbiscan
- [ ] Test tournament created
- [ ] Frontend tested

---

**See DEPLOYMENT_GUIDE.md for detailed instructions on each step.**
