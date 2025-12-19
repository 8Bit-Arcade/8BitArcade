# Post-Deployment Wallet Configuration Guide

## Overview

After deploying all smart contracts, you need to configure wallet addresses for automated operations. This guide shows you exactly which addresses to set and how.

---

## Prerequisites

Before you begin, make sure you have:

1. ✅ Deployed all contracts successfully
2. ✅ Saved all contract addresses
3. ✅ Created a **backend wallet** (separate from deployer wallet)
4. ✅ Updated `frontend/src/config/contracts.ts` with deployed addresses

---

## Backend Wallet Setup

### Create Backend Wallet

This wallet handles automated operations:
- Distributing daily rewards
- Creating automated tournaments
- Receiving gas refills

**For Testnet:**
```bash
# Create a new MetaMask wallet or use any Ethereum wallet
# SAVE THE PRIVATE KEY SECURELY
# You'll need this for Firebase Functions config
```

**For Mainnet:**
```bash
# RECOMMENDED: Use a dedicated secure server wallet
# OR use Google Cloud KMS / AWS Secrets Manager
# NEVER commit this private key to git!
```

---

## Required Configuration Commands

### Open Hardhat Console

```bash
cd contracts
npx hardhat console --network arbitrumSepolia  # or arbitrumOne for mainnet
```

### 1. Set Rewards Distributor (GameRewards)

**What it does:** Allows backend wallet to distribute daily leaderboard rewards

```javascript
const rewards = await ethers.getContractAt("GameRewards", "DEPLOYED_GAME_REWARDS_ADDRESS")

// Set your backend wallet as the rewards distributor
await rewards.setRewardsDistributor("0xYourBackendWalletAddress")

// Verify it was set correctly
console.log("Rewards Distributor:", await rewards.rewardsDistributor())
```

### 2. Set Tournament Manager (TournamentManager)

**What it does:** Allows backend wallet to create automated tournaments

```javascript
const tournaments = await ethers.getContractAt("TournamentManager", "DEPLOYED_TOURNAMENT_MANAGER_ADDRESS")

// Set your backend wallet as tournament manager
await tournaments.setTournamentManager("0xYourBackendWalletAddress")

// Verify it was set correctly
console.log("Tournament Manager:", await tournaments.tournamentManager())
```

### 3. Set Payout Wallet (TreasuryGasManager)

**What it does:** Backend wallet receives automatic gas refills

```javascript
const treasury = await ethers.getContractAt("TreasuryGasManager", "DEPLOYED_TREASURY_GAS_MANAGER_ADDRESS")

// Set your backend wallet to receive gas payouts
await treasury.setPayoutWallet("0xYourBackendWalletAddress")

// Verify it was set correctly
console.log("Payout Wallet:", await treasury.payoutWallet())
```

### 4. Authorize GameRewards Minter (EightBitToken)

**What it does:** Allows GameRewards contract to mint new tokens for daily rewards

```javascript
const token = await ethers.getContractAt("EightBitToken", "DEPLOYED_EIGHT_BIT_TOKEN_ADDRESS")

// Authorize GameRewards to mint tokens
await token.setAuthorizedMinter("DEPLOYED_GAME_REWARDS_ADDRESS", true)

// Verify it was authorized
console.log("GameRewards Authorized:", await token.authorizedMinters("DEPLOYED_GAME_REWARDS_ADDRESS"))
```

### 5. Fund Treasury with ETH

**What it does:** Provides ETH for automatic gas refills

```javascript
const [deployer] = await ethers.getSigners()

// Send 1 ETH to treasury for testnet (or 5-10 ETH for mainnet)
const tx = await deployer.sendTransaction({
  to: "DEPLOYED_TREASURY_GAS_MANAGER_ADDRESS",
  value: ethers.parseEther("1.0")  // 1 ETH for testnet
})
await tx.wait()

console.log("Treasury funded with 1 ETH")
```

### 6. Set Tournament Fees (TournamentPayments)

**What it does:** Configures entry fees for each tournament type

```javascript
const payments = await ethers.getContractAt("TournamentPayments", "DEPLOYED_TOURNAMENT_PAYMENTS_ADDRESS")

// Set tournament fees (USDC has 6 decimals)
await payments.setTournamentFee(1, 1_000_000)   // Standard Weekly: $1
await payments.setTournamentFee(2, 5_000_000)   // Standard Monthly: $5
await payments.setTournamentFee(3, 5_000_000)   // High Roller Weekly: $5
await payments.setTournamentFee(4, 25_000_000)  // High Roller Monthly: $25

console.log("Tournament fees configured")
```

---

## Complete Configuration Script

Save this as `scripts/configure.ts` for easy setup:

```typescript
import { ethers } from "hardhat";

async function main() {
  // ========== REPLACE THESE ADDRESSES ==========
  const BACKEND_WALLET = "0xYourBackendWalletAddress";
  const TOKEN_ADDRESS = "0xDeployedTokenAddress";
  const REWARDS_ADDRESS = "0xDeployedGameRewardsAddress";
  const TOURNAMENT_MANAGER_ADDRESS = "0xDeployedTournamentManagerAddress";
  const TOURNAMENT_PAYMENTS_ADDRESS = "0xDeployedTournamentPaymentsAddress";
  const TREASURY_ADDRESS = "0xDeployedTreasuryGasManagerAddress";
  // ==============================================

  console.log("Configuring contracts...\n");

  // 1. Set rewards distributor
  console.log("1. Setting rewards distributor...");
  const rewards = await ethers.getContractAt("GameRewards", REWARDS_ADDRESS);
  await (await rewards.setRewardsDistributor(BACKEND_WALLET)).wait();
  console.log("✅ Rewards distributor set\n");

  // 2. Set tournament manager
  console.log("2. Setting tournament manager...");
  const tournaments = await ethers.getContractAt("TournamentManager", TOURNAMENT_MANAGER_ADDRESS);
  await (await tournaments.setTournamentManager(BACKEND_WALLET)).wait();
  console.log("✅ Tournament manager set\n");

  // 3. Set payout wallet
  console.log("3. Setting treasury payout wallet...");
  const treasury = await ethers.getContractAt("TreasuryGasManager", TREASURY_ADDRESS);
  await (await treasury.setPayoutWallet(BACKEND_WALLET)).wait();
  console.log("✅ Payout wallet set\n");

  // 4. Authorize GameRewards minter
  console.log("4. Authorizing GameRewards as minter...");
  const token = await ethers.getContractAt("EightBitToken", TOKEN_ADDRESS);
  await (await token.setAuthorizedMinter(REWARDS_ADDRESS, true)).wait();
  console.log("✅ GameRewards authorized\n");

  // 5. Fund treasury
  console.log("5. Funding treasury with 1 ETH...");
  const [deployer] = await ethers.getSigners();
  const tx = await deployer.sendTransaction({
    to: TREASURY_ADDRESS,
    value: ethers.parseEther("1.0")
  });
  await tx.wait();
  console.log("✅ Treasury funded\n");

  // 6. Set tournament fees
  console.log("6. Setting tournament fees...");
  const payments = await ethers.getContractAt("TournamentPayments", TOURNAMENT_PAYMENTS_ADDRESS);
  await (await payments.setTournamentFee(1, 1_000_000)).wait();   // Standard Weekly: $1
  await (await payments.setTournamentFee(2, 5_000_000)).wait();   // Standard Monthly: $5
  await (await payments.setTournamentFee(3, 5_000_000)).wait();   // High Roller Weekly: $5
  await (await payments.setTournamentFee(4, 25_000_000)).wait();  // High Roller Monthly: $25
  console.log("✅ Tournament fees configured\n");

  console.log("═══════════════════════════════════════════════════");
  console.log("  CONFIGURATION COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log("\nNext steps:");
  console.log("1. Configure Firebase Functions (see FIREBASE_CONFIG.md)");
  console.log("2. Deploy Firebase Functions");
  console.log("3. Test automated tournament creation");
  console.log("4. Add DEX liquidity");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
```

**Run it:**
```bash
npx hardhat run scripts/configure.ts --network arbitrumSepolia
```

---

## Verification Checklist

After running configuration, verify everything:

```javascript
// In Hardhat console
const token = await ethers.getContractAt("EightBitToken", "TOKEN_ADDRESS")
const rewards = await ethers.getContractAt("GameRewards", "REWARDS_ADDRESS")
const tournaments = await ethers.getContractAt("TournamentManager", "TOURNAMENTS_ADDRESS")
const treasury = await ethers.getContractAt("TreasuryGasManager", "TREASURY_ADDRESS")
const payments = await ethers.getContractAt("TournamentPayments", "PAYMENTS_ADDRESS")

// Check all configurations
console.log("Rewards Distributor:", await rewards.rewardsDistributor())
console.log("Tournament Manager:", await tournaments.tournamentManager())
console.log("Payout Wallet:", await treasury.payoutWallet())
console.log("GameRewards Authorized:", await token.authorizedMinters(REWARDS_ADDRESS))
console.log("Treasury Balance:", ethers.formatEther(await ethers.provider.getBalance(TREASURY_ADDRESS)), "ETH")
console.log("Tournament Fee (Standard Weekly):", await payments.tournamentFees(1))
console.log("Tournament Fee (Standard Monthly):", await payments.tournamentFees(2))
console.log("Tournament Fee (High Roller Weekly):", await payments.tournamentFees(3))
console.log("Tournament Fee (High Roller Monthly):", await payments.tournamentFees(4))
```

**Expected Output:**
```
Rewards Distributor: 0xYourBackendWallet...
Tournament Manager: 0xYourBackendWallet...
Payout Wallet: 0xYourBackendWallet...
GameRewards Authorized: true
Treasury Balance: 1.0 ETH
Tournament Fee (Standard Weekly): 1000000
Tournament Fee (Standard Monthly): 5000000
Tournament Fee (High Roller Weekly): 5000000
Tournament Fee (High Roller Monthly): 25000000
```

---

## Next Steps

1. **Configure Firebase Functions** - See [FIREBASE_CONFIG.md](FIREBASE_CONFIG.md)
2. **Deploy Functions** - `cd functions && firebase deploy --only functions`
3. **Add DEX Liquidity** - Use 60M 8BIT + $30K USDC on Uniswap V3
4. **Set Uniswap Pools** - After adding liquidity, update TournamentPayments
5. **Test Everything** - Run manual tournament creation, verify rewards distribution

---

## Troubleshooting

### "Only owner can call this function"
- Make sure you're connected with the deployer wallet
- Check that you haven't transferred ownership yet

### "Address cannot be zero"
- Double-check your backend wallet address
- Make sure it's a valid Ethereum address (starts with 0x)

### "Transaction reverted"
- Check that you have enough ETH for gas
- Verify the contract address is correct
- Make sure the network is correct (testnet vs mainnet)

### "Already authorized"
- This is fine - it means the minter was already set
- You can safely ignore this

---

## Security Reminders

- 🔐 **Never commit private keys** to git
- 🔐 **Use different wallets** for testnet vs mainnet
- 🔐 **Store backend wallet key** in Firebase config or KMS
- 🔐 **Monitor backend wallet** for unauthorized transactions
- 🔐 **Rotate keys periodically** (every 6-12 months)
- 🔐 **Consider multisig** for mainnet deployer wallet

---

## Reference

See also:
- [WALLET_SETUP.md](WALLET_SETUP.md) - Complete wallet setup guide
- [FIREBASE_CONFIG.md](FIREBASE_CONFIG.md) - Firebase configuration
- [contracts/README.md](../contracts/README.md) - Contract documentation
