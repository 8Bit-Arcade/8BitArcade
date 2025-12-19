# Firebase Functions Configuration Guide

## Configuration Commands

Firebase Functions config requires **two-part keys** (e.g., `category.key`).

### ❌ WRONG (Will Fail):
```bash
firebase functions:config:set network="testnet"
# Error: Invalid argument, each config value must have a 2-part key (e.g. foo.bar).
```

### ✅ CORRECT:

```bash
# Tournament configuration
firebase functions:config:set tournament.manager="<TOURNAMENT_MANAGER_ADDRESS>"
firebase functions:config:set tournament.network="testnet"

# Deployer wallet configuration
firebase functions:config:set deployer.private_key="<DEPLOYER_PRIVATE_KEY>"
firebase functions:config:set deployer.address="<DEPLOYER_WALLET_ADDRESS>"

# Treasury configuration
firebase functions:config:set treasury.address="<TREASURY_GAS_MANAGER_ADDRESS>"

# Contract addresses
firebase functions:config:set contracts.token="<EIGHT_BIT_TOKEN_ADDRESS>"
firebase functions:config:set contracts.rewards="<GAME_REWARDS_ADDRESS>"
firebase functions:config:set contracts.tournaments="<TOURNAMENT_MANAGER_ADDRESS>"
firebase functions:config:set contracts.payments="<TOURNAMENT_PAYMENTS_ADDRESS>"

# Network configuration (testnet or mainnet)
firebase functions:config:set app.network="testnet"
firebase functions:config:set app.rpc_url="https://sepolia-rollup.arbitrum.io/rpc"
```

## Complete Setup for Testnet

After deploying contracts, run these commands:

```bash
# 1. Set network
firebase functions:config:set app.network="testnet"

# 2. Set deployer wallet (for automated tournament creation)
firebase functions:config:set deployer.private_key="YOUR_DEPLOYER_PRIVATE_KEY"
firebase functions:config:set deployer.address="YOUR_DEPLOYER_WALLET_ADDRESS"

# 3. Set contract addresses (replace with your deployed addresses)
firebase functions:config:set contracts.token="0xYourTokenAddress"
firebase functions:config:set contracts.tournaments="0xYourTournamentManagerAddress"
firebase functions:config:set contracts.payments="0xYourTournamentPaymentsAddress"
firebase functions:config:set treasury.address="0xYourTreasuryGasManagerAddress"

# 4. Verify configuration
firebase functions:config:get

# 5. Deploy functions
cd functions
npm run build
firebase deploy --only functions
```

## Complete Setup for Mainnet

```bash
# 1. Set network
firebase functions:config:set app.network="mainnet"
firebase functions:config:set app.rpc_url="https://arb1.arbitrum.io/rpc"

# 2. Set deployer wallet (use secure key management!)
firebase functions:config:set deployer.private_key="YOUR_MAINNET_DEPLOYER_PRIVATE_KEY"
firebase functions:config:set deployer.address="YOUR_DEPLOYER_WALLET_ADDRESS"

# 3. Set contract addresses
firebase functions:config:set contracts.token="0xMainnetTokenAddress"
firebase functions:config:set contracts.tournaments="0xMainnetTournamentManagerAddress"
firebase functions:config:set contracts.payments="0xMainnetTournamentPaymentsAddress"
firebase functions:config:set treasury.address="0xMainnetTreasuryGasManagerAddress"

# 4. Verify configuration
firebase functions:config:get

# 5. Deploy functions
cd functions
npm run build
firebase deploy --only functions
```

## Viewing Current Configuration

```bash
# View all configuration
firebase functions:config:get

# View specific config group
firebase functions:config:get tournament
firebase functions:config:get deployer
firebase functions:config:get contracts
```

## Removing Configuration

```bash
# Remove a specific key
firebase functions:config:unset tournament.manager

# Remove entire group
firebase functions:config:unset tournament
```

## Using Configuration in Functions

Access config values in your Firebase Functions:

```typescript
import * as functions from 'firebase-functions';

export const myFunction = functions.https.onRequest((req, res) => {
  const config = functions.config();

  const network = config.app.network; // "testnet" or "mainnet"
  const tournamentManager = config.contracts.tournaments;
  const deployerKey = config.deployer.private_key;
  const treasuryAddress = config.treasury.address;

  // Use config values...
});
```

## Security Best Practices

### ❌ DON'T:
- Commit config values to git
- Share private keys in plain text
- Use production keys in testnet
- Store secrets in environment variables files (.env)

### ✅ DO:
- Use Firebase Functions config for sensitive data
- Rotate private keys regularly
- Use separate wallets for testnet vs mainnet
- Test thoroughly on testnet before mainnet
- Use hardware wallets for mainnet deployment
- Consider using Google Cloud Secret Manager for production

## Troubleshooting

### Error: "Invalid argument, each config value must have a 2-part key"
**Solution:** Use a two-part key like `category.key` instead of just `key`.

```bash
# ❌ Wrong
firebase functions:config:set network="testnet"

# ✅ Correct
firebase functions:config:set app.network="testnet"
```

### Error: "Configuration not found"
**Solution:** Set the config first, then redeploy functions.

```bash
firebase functions:config:set app.network="testnet"
cd functions && firebase deploy --only functions
```

### Error: "Functions config not loading"
**Solution:** Redeploy functions after changing config.

```bash
cd functions
firebase deploy --only functions
```

### Error: "Permission denied"
**Solution:** Make sure you're logged in to the correct Firebase project.

```bash
firebase login
firebase use bitarcade-679b7
firebase functions:config:get  # Verify access
```

## Automated Tournament Creation

The scheduled functions use these config values:

```typescript
// functions/src/tournaments/scheduleTournaments.ts
const network = functions.config().app.network; // "testnet" or "mainnet"
const tournamentManagerAddress = functions.config().contracts.tournaments;
const deployerPrivateKey = functions.config().deployer.private_key;
```

**Schedule:**
- **Weekly Tournaments:** Every Monday at 00:00 UTC
- **Monthly Tournaments:** 1st of each month at 00:00 UTC

**Functions:**
- `createWeeklyTournaments` - Creates Standard + High Roller weekly tournaments
- `createMonthlyTournaments` - Creates Standard + High Roller monthly tournaments
- `createTournamentManual` - Manual trigger for testing

## Example: Full Testnet Setup

```bash
# After deploying contracts with npm run deploy:testnet, you'll have addresses like:
# Token: 0x1234...
# TournamentManager: 0x5678...
# TournamentPayments: 0x9abc...
# TreasuryGasManager: 0xdef0...

# Configure Firebase Functions
firebase functions:config:set \
  app.network="testnet" \
  app.rpc_url="https://sepolia-rollup.arbitrum.io/rpc" \
  deployer.private_key="YOUR_TESTNET_DEPLOYER_PRIVATE_KEY" \
  deployer.address="0xYourDeployerAddress" \
  contracts.token="0x1234..." \
  contracts.tournaments="0x5678..." \
  contracts.payments="0x9abc..." \
  treasury.address="0xdef0..."

# Verify
firebase functions:config:get

# Deploy
cd functions
npm run build
firebase deploy --only functions

# Test manual tournament creation
firebase functions:shell
> createTournamentManual()

# ✅ Done! Automated tournaments will now create every Monday and 1st of month.
```

## References

- [Firebase Functions Config Documentation](https://firebase.google.com/docs/functions/config-env)
- [Google Cloud Secret Manager](https://cloud.google.com/secret-manager/docs)
- [Arbitrum RPC URLs](https://docs.arbitrum.io/build-decentralized-apps/reference/node-providers)
