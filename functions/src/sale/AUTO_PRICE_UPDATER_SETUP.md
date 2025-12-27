# Automated Token Sale Price Updater - Setup Guide

This guide explains how to set up the automated price updater that keeps your token sale contract prices in sync with real-time ETH prices.

## 🎯 What It Does

- **Runs every 3 minutes** via Cloud Scheduler for high accuracy
- **Fetches ETH price** from CoinGecko API
- **Calculates** correct `tokensPerEth` based on $0.0005/token pricing
- **Only updates** when price changes >0.5% (~$17.50 at $3,500 ETH)
- **Logs everything** to Firestore for tracking
- **Costs ~$0.10/month** in gas fees (still very minimal on Arbitrum L2)

## 📋 Prerequisites

1. Firebase project with Cloud Functions enabled
2. Arbitrum Sepolia ETH for gas (~0.01 ETH is plenty)
3. A dedicated wallet for price updates

## 🚀 Setup Instructions

### Step 1: Create a Price Updater Wallet

Create a new wallet dedicated to price updates (never use your main owner wallet):

```bash
# Generate a new wallet (you can use any Ethereum wallet tool)
# Or create one in MetaMask and export the private key
```

**Important:** This wallet should:
- Have ~0.01 ETH for gas (on Arbitrum Sepolia)
- NOT be your main owner wallet
- Only have permission to call `updatePrices()` on the contract

### Step 2: Fund the Wallet

Send some Arbitrum Sepolia ETH to the wallet:

```bash
# You can get testnet ETH from:
# - https://faucet.quicknode.com/arbitrum/sepolia
# - Bridge from Sepolia ETH to Arbitrum Sepolia
```

### Step 3: Set the Private Key Secret

Store the private key securely in Firebase:

```bash
cd functions
firebase functions:secrets:set PRICE_UPDATER_PRIVATE_KEY
# Paste your private key when prompted (without 0x prefix)
```

### Step 4: Deploy the Function

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy just the price updater
firebase deploy --only functions:updateTokenSalePrices
```

### Step 5: Verify Deployment

Check the Firebase Console:
1. Go to **Functions** tab
2. You should see `updateTokenSalePrices` listed
3. Check the **Logs** tab to see execution logs

### Step 6: Monitor Updates

Price updates are logged to Firestore:

```bash
# View in Firebase Console
# Navigate to: Firestore Database > sale_price_updates collection
```

Each log entry contains:
- `timestamp` - When the update occurred
- `ethPrice` - Current ETH price from CoinGecko
- `oldTokensPerEth` - Previous rate
- `newTokensPerEth` - New rate
- `txHash` - Transaction hash (if updated)
- `skipped` - If update was skipped (price change <0.5%)

## 🔧 Configuration Options

You can adjust these values in `autoPriceUpdater.ts`:

```typescript
const TOKEN_PRICE_USD = 0.0005; // Your token price in USD
const PRICE_CHANGE_THRESHOLD = 0.5; // Update if price changes >0.5%
```

### Change Update Frequency

Edit the schedule in the function:

```typescript
export const updateTokenSalePrices = onSchedule({
  schedule: 'every 3 minutes', // Current setting for high accuracy
  // Options: 'every 1 minutes', 'every 5 minutes', 'every 15 minutes'
  // Recommended: 3-5 minutes for best balance of accuracy and API limits
  // ...
})
```

## 🧪 Testing

### Manual Trigger

You can manually trigger an update for testing:

```bash
# Use Firebase Console
# Functions > updateTokenSalePrices > Testing > Run function

# Or use Firebase CLI
firebase functions:shell
> updateTokenSalePrices()
```

### Check Logs

```bash
firebase functions:log --only updateTokenSalePrices
```

## 💰 Cost Estimate

- **Gas per update:** ~0.00001 ETH (~$0.00003 on Arbitrum L2)
- **Checks:** 480/day (every 3 minutes, most will skip due to <0.5% change)
- **Actual updates:** ~10-20/day (only when price moves >0.5%)
- **Monthly cost:** ~$0.10 (extremely cheap on Arbitrum L2)
- **API calls:** Well within CoinGecko free tier (10-50 calls/minute limit)

## 🔒 Security Best Practices

1. **Never commit private keys** to version control
2. **Use Firebase Secrets** for sensitive data
3. **Create a dedicated wallet** just for price updates
4. **Monitor the wallet balance** - set up alerts if it runs low
5. **Limit wallet permissions** - ideally, the contract should have a `priceUpdater` role separate from owner

## 🛠️ Troubleshooting

### Function Not Running

Check Cloud Scheduler:
```bash
# Make sure Cloud Scheduler is enabled
gcloud scheduler jobs list
```

### Insufficient Funds

The wallet needs gas for transactions:
```bash
# Check wallet balance on Arbitrum Sepolia
# Add more ETH if balance is low
```

### Permission Denied

The wallet must have permission to call `updatePrices()`:
- Either use the contract owner wallet
- Or implement a `priceUpdater` role in the contract

### Rate Limiting

CoinGecko free API has rate limits:
- 10-50 calls/minute
- We call every 3 minutes (20 calls/hour), well within limits
- 480 calls/day is far below the free tier limit
- No need for CoinGecko Pro at this frequency

## 📊 Monitoring Dashboard

View real-time price updates in Firebase Console:

1. **Firestore Database** → `sale_price_updates` collection
2. **Functions** → `updateTokenSalePrices` → View logs
3. Set up **Cloud Monitoring** alerts for failures

## 🔄 Upgrading

To upgrade the function after code changes:

```bash
cd functions
npm run build
firebase deploy --only functions:updateTokenSalePrices
```

## ❓ FAQ

**Q: What happens if CoinGecko API is down?**
A: The function will log an error and retry on the next scheduled run (3 minutes later).

**Q: Will it update during high gas prices?**
A: Yes. On Arbitrum L2, gas is very cheap (~$0.00003), so high gas isn't a concern.

**Q: Can I change the threshold?**
A: Yes, edit `PRICE_CHANGE_THRESHOLD` in the code (default is 0.5%, which equals ~$17.50 at $3,500 ETH).

**Q: What if I want to pause updates?**
A: Disable the Cloud Scheduler job in Firebase Console, or delete the deployed function.

## 📞 Support

If you encounter issues:
1. Check Firebase Functions logs
2. Verify wallet has sufficient ETH
3. Ensure the secret is set correctly
4. Check Firestore for update logs

---

**Next Steps:**
1. Follow the setup instructions above
2. Deploy the function
3. Monitor the first few updates
4. Adjust threshold/frequency if needed
