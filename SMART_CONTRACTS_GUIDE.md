# 🎮 8-Bit Arcade Smart Contracts - Quick Start Guide

This guide will walk you through deploying and configuring smart contracts for 8-Bit Arcade on Arbitrum.

## 📋 Overview

The smart contract system consists of:
- **8BIT Token**: ERC20 reward token for players
- **GameRewards**: Distributes daily rewards to top players

## 🚀 Quick Start (Testnet)

### 1. Install Dependencies

```bash
cd contracts
npm install
```

### 2. Set Up Environment

```bash
# Copy environment template
cp .env.example .env
```

Edit `.env` and add:
- **PRIVATE_KEY**: Your wallet private key (keep secret!)
- **ARBISCAN_API_KEY**: Get from https://arbiscan.io/myapikey

### 3. Get Testnet ETH

Visit https://faucet.quicknode.com/arbitrum/sepolia and request testnet ETH for your wallet.

### 4. Deploy Contracts

```bash
npm run deploy:testnet
```

**⚠️ SAVE THE ADDRESSES** that are displayed after deployment!

### 5. Update Frontend Configuration

Edit `frontend/src/config/contracts.ts`:

Find the TESTNET_CONTRACTS section and update:

```typescript
const TESTNET_CONTRACTS = {
  EIGHT_BIT_TOKEN: '0xYourTokenAddress',     // ← Paste your token address
  GAME_REWARDS: '0xYourRewardsAddress',      // ← Paste your rewards address
  // ... rest stays the same
};
```

### 6. Create Backend Wallet

Create a **NEW wallet** specifically for distributing rewards:
- Don't use your main wallet
- Fund it with ~0.01 Arbitrum Sepolia ETH
- **SAVE THE PRIVATE KEY SECURELY**

### 7. Set Rewards Distributor

Use Hardhat console to set the distributor:

```bash
cd contracts
npx hardhat console --network arbitrumSepolia
```

In the console:

```javascript
const GameRewards = await ethers.getContractFactory("GameRewards");
const rewards = await GameRewards.attach("0xYourRewardsAddress");

// Set your backend wallet as distributor
await rewards.setRewardsDistributor("0xYourBackendWallet");
```

Or use Arbiscan's "Write Contract" interface.

### 8. Configure Firebase Function

Add your backend wallet private key to Firebase:

```bash
cd functions
firebase functions:config:set rewards.private_key="0xYourBackendWalletPrivateKey"
```

### 9. Test Reward Distribution

You can manually test reward distribution using the `manualDistributeRewards` function before setting up the schedule.

## 🎯 Launching on Mainnet

When you're ready to go live:

### 1. Deploy to Mainnet

```bash
cd contracts
npm run deploy:mainnet
```

### 2. Update Frontend Config

Edit `frontend/src/config/contracts.ts`:

Update MAINNET_CONTRACTS with your mainnet addresses:

```typescript
const MAINNET_CONTRACTS = {
  EIGHT_BIT_TOKEN: '0xMainnetTokenAddress',
  GAME_REWARDS: '0xMainnetRewardsAddress',
  // ...
};
```

### 3. Switch to Mainnet

In `frontend/src/config/contracts.ts`, change:

```typescript
export const USE_TESTNET = false;  // ← Change from true to false
```

This will automatically switch the entire app to mainnet!

### 4. Set Mainnet Distributor

Repeat step 7 above, but use `--network arbitrumOne`

### 5. Update Backend Config

```bash
firebase functions:config:set rewards.private_key="0xMainnetBackendWalletPrivateKey"
```

## 🔑 Wallet Addresses You Need

You'll manage **3 different wallets**:

| Wallet | Purpose | Needs |
|--------|---------|-------|
| **Deployer** | Deploys contracts | Testnet/Mainnet ETH for gas |
| **Backend Distributor** | Calls distributeRewards() | Small amount of ETH for gas |
| **Your Personal** | Receives initial tokens | Nothing special |

## 📝 Important Addresses to Save

After deployment, save these in a secure location:

```
TESTNET (Arbitrum Sepolia)
========================
8BIT Token: 0x...
GameRewards: 0x...
Backend Wallet: 0x...

MAINNET (Arbitrum One)
======================
8BIT Token: 0x...
GameRewards: 0x...
Backend Wallet: 0x...
```

## ⚠️ Security Checklist

- [ ] Never commit .env files
- [ ] Keep private keys in secure environment variables
- [ ] Use separate wallets for deployment vs distribution
- [ ] Test thoroughly on testnet first
- [ ] Verify contracts on Arbiscan after deployment
- [ ] Monitor gas costs and wallet balances
- [ ] Set up alerts for failed transactions

## 🛠️ Configuration Files

All configuration is centralized in:

**`frontend/src/config/contracts.ts`**
- Contract addresses
- Network selection (testnet/mainnet)
- Chain IDs and RPC URLs
- Helper functions

**Key Features:**
- ✅ Single source of truth for all addresses
- ✅ Easy testnet/mainnet switching
- ✅ Detailed comments showing what to update
- ✅ No addresses scattered across multiple files

## 🔄 Daily Reward Distribution

The system automatically distributes rewards daily:

1. Firebase function runs at midnight UTC
2. Gets top 10 players from Firestore
3. Calls `distributeRewards()` on smart contract
4. Contract mints 8BIT tokens to winners
5. Logs transaction to Firestore

**Reward Structure:**
- 1st place: 2,500 8BIT (25%)
- 2nd-5th: 1,250 8BIT each (12.5%)
- 6th-10th: 500 8BIT each (5%)
- **Total daily**: 10,000 8BIT

## 📊 Monitoring

Monitor your contracts:
- **Testnet**: https://sepolia.arbiscan.io
- **Mainnet**: https://arbiscan.io

Check:
- Token balance of GameRewards contract
- Recent transactions
- Event logs
- Gas usage

## 🐛 Troubleshooting

**"Insufficient funds" error**
- Your wallet doesn't have enough ETH for gas
- Get more from faucet (testnet) or fund wallet (mainnet)

**"Only distributor can call" error**
- The wallet calling distributeRewards() isn't set as distributor
- Run setRewardsDistributor() with the correct address

**"Already distributed for this day" error**
- Rewards were already sent for this day
- Normal if function runs multiple times

**Wrong network**
- Make sure USE_TESTNET matches your deployment
- Check WalletConnect is on the right network

## 📚 Next Steps

After deployment:
1. Test playing games and earning rewards on testnet
2. Verify reward distribution works
3. Check token balances update correctly
4. Monitor gas costs
5. Add liquidity to DEX when ready
6. Deploy to mainnet when fully tested

## 💡 Pro Tips

- Keep testnet and mainnet wallets completely separate
- Test everything on testnet multiple times
- Monitor Discord/Telegram for player feedback
- Set up automated alerts for contract events
- Keep some extra ETH in distributor wallet for gas
- Document all wallet addresses and private keys securely

## 📞 Resources

- [Full Contract README](contracts/README.md)
- [Arbitrum Docs](https://docs.arbitrum.io)
- [Hardhat Docs](https://hardhat.org)
- [OpenZeppelin](https://docs.openzeppelin.com)
- [Arbiscan](https://arbiscan.io)

---

**Questions?** Check the full README in the `contracts/` directory for more detailed information.
