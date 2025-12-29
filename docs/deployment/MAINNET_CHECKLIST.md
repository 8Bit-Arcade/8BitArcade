# Mainnet Deployment Checklist

Complete checklist for deploying 8-Bit Arcade to Arbitrum One mainnet.

---

## Pre-Deployment Preparation

### Funding Requirements

- [ ] **Deployer Wallet ETH** - ~0.5 ETH for contract deployments
- [ ] **Liquidity ETH** - Amount for DEX liquidity pairing
- [ ] **Presale USDC** - For liquidity pool ($30,000+ target)
- [ ] **Treasury Gas Manager** - ~1 ETH for 2-3 years of operations
- [ ] **Marketing Wallet** - ETH for promotional transactions

### Security Review

- [ ] Final code review of all smart contracts
- [ ] Run full test suite: `npx hardhat test`
- [ ] Verify no testnet addresses in production code
- [ ] Check all access controls and ownership settings
- [ ] Review constructor parameters for mainnet values

---

## Smart Contract Deployment

### 1. Deploy Core Token

- [ ] Deploy **EightBitToken** (8BIT)
  ```bash
  npx hardhat run scripts/deploy-token.ts --network arbitrumOne
  ```
- [ ] Verify on Arbiscan
  ```bash
  npx hardhat verify --network arbitrumOne <TOKEN_ADDRESS>
  ```
- [ ] Record address: `___________________________________`

### 2. Deploy GameRewards

- [ ] Deploy **GameRewards** contract
- [ ] Verify on Arbiscan
- [ ] Record address: `___________________________________`
- [ ] Transfer reward tokens to contract
- [ ] Set authorized operators

### 3. Deploy TournamentManager

- [ ] Deploy **TournamentManager** contract
- [ ] Verify on Arbiscan
- [ ] Record address: `___________________________________`
- [ ] Configure tournament parameters
- [ ] Set authorized operators

### 4. Deploy TournamentPayments

- [ ] Deploy **TournamentPayments** contract
  - Constructor params: token, USDC, WETH, swapRouter
- [ ] Verify on Arbiscan
- [ ] Record address: `___________________________________`

### 5. Deploy TournamentBuyback

- [ ] Deploy **TournamentBuyback** contract
  - Constructor params: token, USDC, swapRouter (NO WETH!)
- [ ] Verify on Arbiscan
- [ ] Record address: `___________________________________`

### 6. Deploy TokenSale

- [ ] Deploy **TokenSale** contract
- [ ] Verify on Arbiscan
- [ ] Record address: `___________________________________`
- [ ] Transfer sale tokens to contract
- [ ] Configure sale parameters (price, duration)
- [ ] Set sale start time

### 7. Deploy TreasuryGasManager

- [ ] Deploy **TreasuryGasManager** contract
- [ ] Verify on Arbiscan
- [ ] Record address: `___________________________________`
- [ ] Fund with ETH (~1 ETH)

### 8. Deploy TestnetFaucet (SKIP FOR MAINNET)

- [ ] ~~Not needed for mainnet~~

---

## Contract Configuration

### Access Control Setup

- [ ] Set GameRewards operators (backend wallet)
- [ ] Set TournamentManager operators
- [ ] Verify all owner addresses are correct
- [ ] Test operator functions with small amounts

### Token Distribution

- [ ] Transfer 150M 8BIT to GameRewards (daily rewards pool)
- [ ] Transfer 50M 8BIT to Staking contract (when deployed)
- [ ] Transfer 20M 8BIT to Tournament Prize Pool
- [ ] Transfer 15M 8BIT to Marketing wallet
- [ ] Verify team tokens vesting schedule
- [ ] Transfer 60M 8BIT for DEX liquidity

### Contract Linking

- [ ] Link TournamentManager to TournamentPayments
- [ ] Link TournamentPayments to TournamentBuyback
- [ ] Link GameRewards to TreasuryGasManager
- [ ] Verify all contract references are correct

---

## DEX Liquidity Setup

### Uniswap V3 Pool Creation

- [ ] Create 8BIT/USDC pool on Uniswap V3
- [ ] Set initial price at $0.0005 per 8BIT
- [ ] Add liquidity: 60M 8BIT + $30,000 USDC
- [ ] Set fee tier (0.3% recommended for new tokens)
- [ ] Record pool address: `___________________________________`

### Liquidity Lock

- [ ] Lock LP tokens for 3+ years
- [ ] Use trusted locker (Team Finance, Unicrypt, etc.)
- [ ] Record lock transaction: `___________________________________`
- [ ] Verify lock is publicly visible

---

## Frontend Updates

### Contract Addresses

- [ ] Update `frontend/src/config/contracts.ts`
  ```typescript
  export const MAINNET_CONTRACTS = {
    EIGHT_BIT_TOKEN: '0x...',
    GAME_REWARDS: '0x...',
    TOURNAMENT_MANAGER: '0x...',
    TOURNAMENT_PAYMENTS: '0x...',
    TOURNAMENT_BUYBACK: '0x...',
    TOKEN_SALE: '0x...',
    TREASURY_GAS_MANAGER: '0x...',
  };
  ```

### Network Configuration

- [ ] Update chain ID to Arbitrum One (42161)
- [ ] Update RPC endpoints
- [ ] Remove testnet faucet references
- [ ] Update Uniswap router addresses

### Environment Variables

- [ ] Set production Firebase config
- [ ] Set production RPC URLs
- [ ] Set production Arbiscan API key
- [ ] Remove any testnet environment variables

---

## Sale Site Updates

### Contract Addresses

- [ ] Update `sale-site/js/sale.js` with mainnet addresses
- [ ] Update CONTRACTS object
- [ ] Update TOKEN_INFO for wallet integration
- [ ] Update RPC endpoint to mainnet

### Token Image

- [ ] Upload final token image to Firebase Storage
- [ ] Verify image URL works in wallet_watchAsset

### Documentation

- [ ] Update all mainnet contract addresses in docs
- [ ] Update whitepaper with mainnet info
- [ ] Update tokenomics page with live links

---

## Backend/Firebase Updates

### Cloud Functions

- [ ] Update contract addresses in Firebase functions
- [ ] Set mainnet RPC provider
- [ ] Update any hardcoded testnet references
- [ ] Deploy updated functions: `firebase deploy --only functions`

### Security Rules

- [ ] Review Firestore security rules for production
- [ ] Enable rate limiting
- [ ] Remove any test/debug endpoints

---

## Token Listing & Marketing

### Block Explorer

- [ ] Submit token info update on Arbiscan
  - Logo (256x256 PNG)
  - Website
  - Social links
  - Description
- [ ] Wait for approval (1-3 days)

### Token Lists (After Trading Volume)

- [ ] Submit to CoinGecko
- [ ] Submit to CoinMarketCap
- [ ] Submit to Trust Wallet Assets (GitHub PR)
- [ ] Submit to 1inch token list
- [ ] Submit to Uniswap token list

### DappRadar

- [ ] Update contract addresses in DappRadar listing
  ```
  8BIT Token: 0x...
  TournamentManager: 0x...
  GameRewards: 0x...
  TournamentPayments: 0x...
  TournamentBuyback: 0x...
  TokenSale: 0x...
  TreasuryGasManager: 0x...
  ```

---

## Launch Day Checklist

### Pre-Launch (T-24 hours)

- [ ] Final contract verification
- [ ] Test all frontend functionality on staging
- [ ] Prepare announcement posts
- [ ] Brief community on launch time

### Launch (T-0)

- [ ] Start token sale (if not auto-started)
- [ ] Monitor first transactions
- [ ] Watch for any errors in logs
- [ ] Respond to community questions

### Post-Launch (T+24 hours)

- [ ] Verify all systems operating normally
- [ ] Check reward distributions working
- [ ] Monitor tournament entries
- [ ] Gather initial feedback

---

## Emergency Procedures

### If Issues Found

1. [ ] Pause affected contracts if possible
2. [ ] Communicate with community immediately
3. [ ] Assess severity and fix timeline
4. [ ] Deploy fix or rollback plan
5. [ ] Resume operations with monitoring

### Emergency Contacts

- Developer: _______________
- Backup: _______________

---

## Post-Launch Tasks

### Week 1

- [ ] Monitor all contract interactions
- [ ] Verify daily rewards distribution
- [ ] First tournament test
- [ ] Gather user feedback

### Month 1

- [ ] Submit to token tracking sites
- [ ] First marketing push
- [ ] Community AMAs
- [ ] Partnership outreach

### Ongoing

- [ ] Monthly tokenomics reports
- [ ] Regular security reviews
- [ ] Community governance implementation
- [ ] New game additions

---

## Contract Address Summary (Fill After Deployment)

| Contract | Address | Verified |
|----------|---------|----------|
| EightBitToken (8BIT) | | ☐ |
| GameRewards | | ☐ |
| TournamentManager | | ☐ |
| TournamentPayments | | ☐ |
| TournamentBuyback | | ☐ |
| TokenSale | | ☐ |
| TreasuryGasManager | | ☐ |
| Uniswap V3 Pool | | N/A |
| LP Lock | | N/A |

---

*Last Updated: December 2024*
*Version: 1.0*
