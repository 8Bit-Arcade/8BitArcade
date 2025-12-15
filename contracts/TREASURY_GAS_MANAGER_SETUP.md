# Treasury Gas Manager - Setup Guide

## Overview

The **TreasuryGasManager** contract automates gas funding for your backend operations, ensuring daily reward distributions and tournament payouts never fail due to insufficient gas.

## How It Works

```
┌─────────────────┐
│  Treasury       │  Holds 1-5 ETH
│  Contract       │  Monitors payout wallet
└────────┬────────┘
         │
         │ Auto-refill when < 0.05 ETH
         ▼
┌─────────────────┐
│  Payout Wallet  │  Backend wallet that calls:
│  (Backend)      │  - distributeRewards()
└─────────────────┘  - declareWinner()
```

### Automatic Refill Process:

1. **Before batch operations**, backend checks payout wallet balance
2. **If balance < 0.05 ETH**, treasury automatically sends 0.1 ETH
3. **Payout proceeds** with full gas funding
4. **Logs & monitors** all refills for transparency

---

## Deployment

### 1. Deploy Contracts

```bash
# Deploy to testnet
cd contracts
npm run deploy:testnet

# Save the TreasuryGasManager address from output
```

### 2. Configure Contracts

After deployment, run these commands (replace addresses):

```typescript
// Set payout wallet in TreasuryGasManager
await treasury.setPayoutWallet("0xYourBackendWallet");

// Fund the treasury with ETH
// Testnet: 1 ETH = ~1000 refills
// Mainnet: 5 ETH = ~5000 refills
await deployer.sendTransaction({
  to: treasuryAddress,
  value: ethers.parseEther("1.0") // 1 ETH for testnet
});
```

### 3. Configure Firebase Functions

Add treasury address to Firebase config:

```bash
firebase functions:config:set treasury.address="0xYourTreasuryAddress"
firebase functions:config:set rewards.private_key="0xYourBackendPrivateKey"

# Verify config
firebase functions:config:get
```

### 4. Deploy Backend

```bash
cd functions
npm run build
firebase deploy --only functions
```

---

## Configuration Options

### Threshold Settings

```solidity
// Default settings (configurable via contract owner):
minimumThreshold = 0.05 ETH;  // Trigger refill when below this
refillAmount = 0.1 ETH;        // Send this much on each refill
```

### Update Settings

```typescript
// Update minimum threshold
await treasury.setMinimumThreshold(ethers.parseEther("0.03")); // 0.03 ETH

// Update refill amount
await treasury.setRefillAmount(ethers.parseEther("0.15")); // 0.15 ETH

// Update payout wallet
await treasury.setPayoutWallet("0xNewBackendWallet");
```

---

## Monitoring

### Check Status Programmatically

```typescript
import { ethers } from 'ethers';

const treasury = new ethers.Contract(treasuryAddress, TREASURY_ABI, provider);

// Get detailed status
const [currentBalance, needsRefill, refillAvailable] = await treasury.getWalletStatus();

console.log('Payout Balance:', ethers.formatEther(currentBalance), 'ETH');
console.log('Needs Refill:', needsRefill);
console.log('Can Refill:', refillAvailable);

// Get statistics
const [treasuryBalance, payoutBalance, totalSent, refills] = await treasury.getStatistics();

console.log('Treasury Balance:', ethers.formatEther(treasuryBalance), 'ETH');
console.log('Total Refills:', refills.toString());
console.log('Total ETH Sent:', ethers.formatEther(totalSent), 'ETH');

// Estimate remaining refills
const remaining = await treasury.getRefillsRemaining();
console.log('Refills Remaining:', remaining.toString());
```

### View on Block Explorer

Monitor treasury activity on Arbiscan:
- **Testnet**: https://sepolia.arbiscan.io/address/YOUR_TREASURY_ADDRESS
- **Mainnet**: https://arbiscan.io/address/YOUR_TREASURY_ADDRESS

Watch for `WalletRefilled` events to track auto-refills.

---

## Cost Analysis

### Arbitrum Gas Costs (Estimated)

| Operation | Gas Used | Cost @ 0.1 gwei | Cost @ 0.2 gwei |
|-----------|----------|-----------------|-----------------|
| distributeRewards() | ~150,000 | $0.015 | $0.03 |
| declareWinner() | ~80,000 | $0.008 | $0.016 |
| refillGasWallet() | ~50,000 | $0.005 | $0.01 |

### Daily Costs

| Activity | Frequency | Daily Cost |
|----------|-----------|------------|
| Daily Rewards | 1x/day | ~$0.02 |
| Tournaments | 2-3x/week | ~$0.02 |
| Gas Refills | 1x/10 days | ~$0.001 |
| **Total** | | **~$0.04/day** |

### Funding Recommendations

**Testnet:**
- Initial: 0.5-1 ETH
- Lasts: 500-1000 refills (~2-3 years)

**Mainnet:**
- Initial: 3-5 ETH
- Lasts: 3000-5000 refills (~8-13 years at 1 refill/day)
- Refill when < 1 ETH remaining

---

## Backend Integration

The treasury manager is already integrated into `distributeRewards.ts`. Here's what happens:

```typescript
// Before distributing rewards...

1. Check treasury configuration
2. Get current payout wallet balance
3. If balance < threshold:
   - Call treasury.ensureFunding()
   - Treasury sends ETH to payout wallet
   - Log refill transaction
4. Log treasury status for monitoring
5. Proceed with reward distribution
```

### Logs Output

```
Checking gas wallet funding status...
Treasury Status: {
  payoutBalance: '0.045 ETH',
  treasuryBalance: '2.5 ETH',
  needsRefill: true,
  refillsRemaining: 250
}
Payout wallet needs refill. Triggering auto-refill...
✅ Gas wallet refilled successfully!
Transaction hash: 0x1234...
✅ Payout wallet refilled: 0.145 ETH

═══════════════════════════════════════
  TREASURY GAS MANAGER STATUS
═══════════════════════════════════════
Payout Wallet Balance: 0.145 ETH
Treasury Balance: 2.4 ETH
Refills Remaining: 240
═══════════════════════════════════════
```

---

## Security

### Contract Security Features

- ✅ **Ownable** - Only owner can update settings
- ✅ **ReentrancyGuard** - Prevents reentrancy attacks
- ✅ **Emergency Stop** - Owner can pause refills
- ✅ **Permissionless Refills** - Anyone can trigger (they pay gas, treasury pays ETH)
- ✅ **Threshold Validation** - Prevents misconfiguration

### Best Practices

1. **Use Multi-Sig for Owner** (optional for testnet)
   - Deploy with Gnosis Safe as owner
   - Require 2-3 signatures for critical operations

2. **Monitor Treasury Balance**
   - Set up alerts when < 1 ETH
   - Check logs weekly

3. **Emergency Procedures**
   - Toggle emergency stop: `treasury.toggleEmergencyStop()`
   - Withdraw funds: `treasury.emergencyWithdraw(recipient, amount)`

---

## Troubleshooting

### Issue: "Treasury address not configured"

**Solution:**
```bash
firebase functions:config:set treasury.address="0xYourTreasuryAddress"
firebase deploy --only functions
```

### Issue: "CRITICAL: Cannot refill - treasury out of funds"

**Solution:**
```bash
# Send ETH to treasury contract
cast send $TREASURY_ADDRESS --value 1ether --private-key $OWNER_KEY

# Or use your wallet/Etherscan
```

### Issue: Payout wallet not refilling

**Checklist:**
1. ✓ Treasury has sufficient balance?
2. ✓ Payout wallet address set correctly?
3. ✓ Emergency stop is OFF?
4. ✓ Backend calling `ensureGasFunding()`?

**Manual Trigger:**
```typescript
// Manually trigger refill
const tx = await treasury.refillGasWallet();
await tx.wait();
```

---

## Testing on Testnet

### 1. Deploy contracts

```bash
npm run deploy:testnet
```

### 2. Create backend wallet

```bash
# Generate new wallet
npx hardhat run scripts/generateWallet.js

# Save private key securely
firebase functions:config:set rewards.private_key="0x..."
```

### 3. Fund treasury

```bash
# Send 1 ETH to treasury
cast send $TREASURY_ADDRESS --value 1ether --private-key $DEPLOYER_KEY
```

### 4. Configure payout wallet

```typescript
await treasury.setPayoutWallet(backendWalletAddress);
```

### 5. Test distribution

```bash
# Trigger manual distribution
curl -X POST https://your-region-your-project.cloudfunctions.net/manualDistributeRewards
```

### 6. Verify refill

Check logs for:
- ✓ Treasury status check
- ✓ Auto-refill execution (if needed)
- ✓ Updated payout balance

---

## Mainnet Launch Checklist

- [ ] Deploy TreasuryGasManager to Arbitrum mainnet
- [ ] Verify contract on Arbiscan
- [ ] Fund treasury with 3-5 ETH
- [ ] Set payout wallet address
- [ ] Configure Firebase functions
- [ ] Test with small reward distribution
- [ ] Set up monitoring/alerts
- [ ] Document deployed addresses
- [ ] (Optional) Transfer ownership to multi-sig

---

## Contract Reference

### Key Functions

```solidity
// View functions
function needsRefill() external view returns (bool)
function getWalletStatus() external view returns (uint256, bool, bool)
function getStatistics() external view returns (uint256, uint256, uint256, uint256)
function getRefillsRemaining() external view returns (uint256)

// Refill functions
function refillGasWallet() external returns (bool)  // Permissionless
function ensureFunding() external returns (bool)     // Permissionless

// Owner functions
function setPayoutWallet(address) external onlyOwner
function setMinimumThreshold(uint256) external onlyOwner
function setRefillAmount(uint256) external onlyOwner
function toggleEmergencyStop() external onlyOwner
function emergencyWithdraw(address, uint256) external onlyOwner
```

---

## Support

For issues or questions:
1. Check transaction logs in Firebase console
2. Verify contract on Arbiscan
3. Review this documentation
4. Check GitHub issues

**Happy deploying! 🚀**
