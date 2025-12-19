# 8-Bit Arcade Wallet Setup Guide

## Overview

The 8-Bit Arcade platform uses multiple wallets for different purposes. This guide explains each wallet's role, setup, and security requirements.

---

## 1. Founder Wallet (Deployer Wallet)

### What It Is
The **founder wallet** is the primary wallet that deploys all smart contracts and receives the initial token allocation. This is THE most important wallet in the system.

### Token Allocation
When you deploy the EightBitToken contract, this wallet **automatically receives 300M 8BIT tokens (60% of max supply)**:

**Mainnet Distribution (300M total):**
```
300M 8BIT Distribution:
├─ 200M (67%) → TokenSale ($100k raise at $0.0005/token)
├─ 20M (7%)   → TournamentManager prize pools
└─ 80M (26%)  → Deployer keeps:
    ├─ 60M → DEX Liquidity (Uniswap V3 8BIT/USDC pool, locked 3+ years)
    ├─ 15M → Marketing & Community Growth
    └─ 5M  → Team & Advisors (vested 2-3 years)
```

**Testnet Distribution (300M total):**
```
300M 8BIT Distribution:
├─ 200M (67%) → TokenSale
├─ 50M (17%)  → TestnetFaucet (testing only)
├─ 20M (7%)   → TournamentManager prize pools
└─ 30M (10%)  → Deployer keeps (reduced for testing)
```

### Responsibilities
- ✅ Deploy all 7 smart contracts to Arbitrum
- ✅ Own all contracts (can configure settings, authorize minters)
- ✅ Receive 300M initial token allocation
- ✅ Fund contracts with tokens (200M sale, 20M tournaments, 50M faucet)
- ✅ Configure contract parameters (fees, addresses, etc.)
- ✅ Add DEX liquidity (60M 8BIT + USDC, locked 3+ years)
- ✅ Transfer ownership to multisig later (recommended for security)

### Setup Requirements

**For Testnet:**
```bash
# 1. Create a new wallet specifically for deployment
# RECOMMENDED: Use MetaMask, create new account, save seed phrase OFFLINE

# 2. Get the private key (MetaMask → Account Details → Export Private Key)
# ⚠️  NEVER share this private key! Keep it secure and offline!

# 3. Create contracts/.env file
cd contracts
cat > .env << EOF
PRIVATE_KEY=your_deployer_private_key_here
ARBISCAN_API_KEY=your_arbiscan_api_key_here
EOF

# 4. Get testnet ETH for gas fees
# Visit: https://faucet.quicknode.com/arbitrum/sepolia
# Send 0.5 - 1 ETH to your deployer address
```

**For Mainnet:**
```bash
# SECURITY CRITICAL:
# 1. Use a hardware wallet (Ledger/Trezor) for mainnet deployment
# 2. OR use a multisig wallet (Gnosis Safe) for added security
# 3. Keep private keys in cold storage (never on cloud servers)
# 4. Consider using a fresh wallet specifically for deployment

# Fund with real ETH (estimate 0.05 - 0.1 ETH for deployment gas)
```

---

## 2. Backend Wallet (Operations Wallet)

### What It Is
A **separate secure wallet** for automated backend operations. This wallet handles day-to-day platform operations without exposing the founder wallet.

### Responsibilities
- ✅ Distribute game rewards (rewardsDistributor role)
- ✅ Create tournaments (tournamentManager role)
- ✅ Receive gas payouts from TreasuryGasManager
- ✅ Automated Firebase Functions operations

### Setup After Deployment

```solidity
// After deploying contracts, configure backend wallet:

// 1. Set as rewards distributor
gameRewards.setRewardsDistributor(BACKEND_WALLET_ADDRESS);

// 2. Set as tournament manager
tournamentManager.setTournamentManager(BACKEND_WALLET_ADDRESS);

// 3. Set as payout wallet for gas refills
treasuryGasManager.setPayoutWallet(BACKEND_WALLET_ADDRESS);

// 4. Authorize as minter (if needed for rewards)
eightBitToken.setAuthorizedMinter(BACKEND_WALLET_ADDRESS, true);
```

### Firebase Functions Configuration

```bash
# Set backend wallet in Firebase config
firebase functions:config:set \
  backend.wallet_address="0xYourBackendWalletAddress" \
  backend.private_key="backend_wallet_private_key"

# Set contract addresses
firebase functions:config:set \
  tournament.manager="0xTournamentManagerAddress" \
  treasury.address="0xTreasuryGasManagerAddress"
```

### Security Recommendations
- 🔒 Use a dedicated server or secure cloud KMS (AWS KMS, Google Secret Manager)
- 🔒 Never commit private keys to git
- 🔒 Rotate keys periodically
- 🔒 Monitor wallet activity for unauthorized transactions
- 🔒 Set up alerts for unusual activity

---

## 3. Treasury Wallet (Gas Management)

### What It Is
The **TreasuryGasManager contract** itself acts as a treasury wallet. It holds ETH to refill the backend wallet's gas automatically.

### Configuration

```solidity
// Deploy with initial settings
TreasuryGasManager(
  payoutWallet,     // Backend wallet (receives gas refills)
  0.05 ETH,         // minThreshold (trigger refill when backend drops below this)
  0.1 ETH           // refillAmount (send this much on each refill)
);
```

### Funding

```bash
# Testnet: Fund with 1 ETH
cast send <TREASURY_ADDRESS> --value 1ether --private-key $DEPLOYER_KEY

# Mainnet: Fund with 5-10 ETH for production
cast send <TREASURY_ADDRESS> --value 5ether --private-key $DEPLOYER_KEY
```

### How It Works
1. Backend wallet processes transactions (rewarding users, creating tournaments)
2. When backend wallet ETH < 0.05 ETH → TreasuryGasManager detects low balance
3. TreasuryGasManager sends 0.1 ETH refill to backend wallet
4. Repeat automatically as needed

---

## 4. Token Distribution Summary

### At Deployment (Block 0)

**Mainnet:**

| Wallet/Contract | Amount | % of Max Supply | Purpose |
|----------------|--------|-----------------|---------|
| **Founder Wallet** | 80M | 16% | Keeps for liquidity (60M), marketing (15M), team (5M) |
| TournamentManager | 20M | 4% | Tournament prize pools |
| TokenSale | 200M | 40% | Token sale ($0.0005/token, raises $100k) |
| **Total Minted** | **300M** | **60%** | Deployed immediately |

**Testnet (same as mainnet plus faucet):**

| Wallet/Contract | Amount | % of Max Supply | Purpose |
|----------------|--------|-----------------|---------|
| **Founder Wallet** | 30M | 6% | Keeps for testing (reduced allocation) |
| TournamentManager | 20M | 4% | Tournament prize pools |
| TokenSale | 200M | 40% | Token sale |
| TestnetFaucet | 50M | 10% | Testnet testing only |
| **Total Minted** | **300M** | **60%** | Deployed immediately |

### Future Minting (Controlled by Authorized Minters)

| Contract | Max Mintable | % of Max Supply | Unlock Period |
|----------|-------------|-----------------|---------------|
| GameRewards | 150M | 30% | 5 years (daily rewards) |
| Staking | 50M | 10% | 5 years (staking rewards) |
| TournamentBuyback | Burns 50% fees | N/A | Deflationary mechanism |
| **Total Emissions** | **200M** | **40%** | Gradual unlock |

### Maximum Supply Cap
```
MAX_SUPPLY = 500M 8BIT
Initial Mint (300M) + Future Emissions (200M) = 500M

Note: Effective supply will be LOWER due to:
- Unsold tokens from TokenSale burned at sale end
- 50% of tournament fees used to buyback & burn 8BIT
- Continuous deflationary pressure from tournament burns
```

---

## 5. Deployment Checklist

### Pre-Deployment

- [ ] Create founder wallet (deployer)
- [ ] Create backend wallet (operations)
- [ ] Save private keys securely (offline, encrypted)
- [ ] Fund deployer wallet with ETH for gas
- [ ] Create `contracts/.env` file
- [ ] Get Arbiscan API key

### During Deployment

- [ ] Run `npm run deploy:testnet` (or mainnet)
- [ ] Save all deployed contract addresses
- [ ] Verify deployer received 300M 8BIT tokens
- [ ] Verify tournament manager received 20M 8BIT
- [ ] Verify token sale received 200M 8BIT
- [ ] Verify faucet received 50M 8BIT (testnet only)

### Post-Deployment

- [ ] Update `frontend/src/config/contracts.ts` with addresses
- [ ] Configure backend wallet roles (rewards distributor, tournament manager, payout wallet)
- [ ] Authorize GameRewards as minter: `token.setAuthorizedMinter(gameRewardsAddress, true)`
- [ ] Fund TreasuryGasManager with ETH
- [ ] Set tournament fees in TournamentPayments
- [ ] Add DEX liquidity (75M 8BIT + USDC equivalent)
- [ ] Set Uniswap pool addresses in TournamentPayments
- [ ] Verify all contracts on Arbiscan
- [ ] Deploy Firebase Functions
- [ ] Configure Firebase Functions with wallet addresses
- [ ] Test automated tournament creation
- [ ] Consider transferring ownership to multisig (security upgrade)

---

## 6. Security Best Practices

### Founder Wallet Security
```
🔐 CRITICAL - This wallet has god mode over all contracts

✅ Use hardware wallet for mainnet (Ledger, Trezor)
✅ OR use multisig (Gnosis Safe with 2-of-3 or 3-of-5 signers)
✅ Keep seed phrase offline in multiple secure locations
✅ Never share private key with anyone
✅ Consider transferring ownership to DAO in future
✅ Use different wallets for testnet vs mainnet
```

### Backend Wallet Security
```
🔑 IMPORTANT - This wallet executes automated operations

✅ Store private key in secure KMS (not .env files on servers)
✅ Restrict access to production environment only
✅ Monitor for unauthorized transactions
✅ Set up balance alerts
✅ Rotate keys every 6-12 months
✅ Use different wallet addresses for testnet vs mainnet
```

### Private Key Storage
```bash
# ❌ NEVER do this:
echo "PRIVATE_KEY=0x123..." >> .env
git add .env
git commit -m "Add private key"  # 🚨 COMPROMISED FOREVER

# ✅ Always do this:
echo ".env" >> .gitignore
echo "contracts/.env" >> .gitignore
# Store in password manager (1Password, Bitwarden)
# OR use cloud KMS (AWS Secrets Manager, Google Secret Manager)
```

---

## 7. Example Deployment Flow

```bash
# Step 1: Create wallets
# Founder: 0xFounder123...
# Backend: 0xBackend456...

# Step 2: Fund founder wallet
# Send 0.5 ETH (testnet) or 0.1 ETH (mainnet) to 0xFounder123...

# Step 3: Create .env
cd contracts
cat > .env << EOF
PRIVATE_KEY=founder_private_key_here
ARBISCAN_API_KEY=your_api_key_here
EOF

# Step 4: Deploy
npm run deploy:testnet

# Deployment output:
# ✅ EightBitToken: 0xToken789...
# ✅ GameRewards: 0xRewards012...
# ✅ TournamentManager: 0xTournament345...
# ... (all 7 contracts)

# Step 5: Configure backend wallet
npx hardhat console --network arbitrumSepolia

> const token = await ethers.getContractAt("EightBitToken", "0xToken789...")
> const rewards = await ethers.getContractAt("GameRewards", "0xRewards012...")
> await token.setAuthorizedMinter("0xRewards012...", true)
> await rewards.setRewardsDistributor("0xBackend456...")

# Step 6: Fund treasury
> await deployer.sendTransaction({ to: "0xTreasury678...", value: ethers.parseEther("1.0") })

# Step 7: Add liquidity
# Use Uniswap V3 to create 8BIT/USDC pool with 75M 8BIT

# Step 8: Deploy Firebase Functions
cd ../functions
firebase deploy --only functions

# Step 9: Test automated tournaments
# Wait for Monday 00:00 UTC or trigger manually via Firebase console

# ✅ Deployment complete!
```

---

## 8. Multisig Migration (Optional Security Upgrade)

For added security, consider migrating ownership to a multisig wallet after deployment:

```bash
# 1. Create Gnosis Safe multisig (3-of-5 recommended)
# https://app.safe.global/

# 2. Add signers (founder + trusted team members)

# 3. Transfer ownership of all contracts
npx hardhat console --network arbitrumSepolia

> const token = await ethers.getContractAt("EightBitToken", "0xToken789...")
> const rewards = await ethers.getContractAt("GameRewards", "0xRewards012...")
> const tournaments = await ethers.getContractAt("TournamentManager", "0xTournament345...")
> const treasury = await ethers.getContractAt("TreasuryGasManager", "0xTreasury678...")

> await token.transferOwnership("0xGnosisSafe...")
> await rewards.transferOwnership("0xGnosisSafe...")
> await tournaments.transferOwnership("0xGnosisSafe...")
> await treasury.transferOwnership("0xGnosisSafe...")

# 4. Accept ownership from multisig (requires 3 of 5 signatures)

# ✅ Now all critical operations require multisig approval
```

---

## Summary

**Three Main Wallets:**

1. **Founder Wallet** (deployer)
   - Deploys contracts
   - Receives 300M 8BIT tokens
   - Owns all contracts initially
   - Distributes tokens to sale (200M), tournaments (20M), faucet (50M)
   - Keeps 30-80M for liquidity, marketing, team

2. **Backend Wallet** (operations)
   - Distributes game rewards
   - Creates tournaments
   - Receives gas refills
   - Automated operations

3. **Treasury Contract** (gas management)
   - Holds ETH reserve
   - Automatically refills backend wallet
   - Prevents service interruption from low gas

**Security Priority:**
- 🔴 Founder Wallet: CRITICAL (use hardware wallet or multisig for mainnet)
- 🟡 Backend Wallet: IMPORTANT (use KMS, monitor closely)
- 🟢 Treasury Contract: MEDIUM (on-chain contract, can be refilled anytime)

---

**Questions or Issues?**

- Check deployment logs for contract addresses
- Verify balances on Arbiscan
- Test on testnet first before mainnet
- Keep private keys secure and offline
- Consider security audit before mainnet launch
