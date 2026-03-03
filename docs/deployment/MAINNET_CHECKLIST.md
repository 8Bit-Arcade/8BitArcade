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

## Contract Address Summary

| Contract | Address | Verified |
|----------|---------|----------|
| EightBitToken (8BIT) | `0x37ee26669659758109c94862e49B492247Be26df` | ✅ |
| GameRewards | `0x6e22b6b488f42FaBebE2a52fe759594650ef1B0e` | ✅ |
| TournamentManager | `0xC0ab5FDF6Ef6A4e6bD60f9eD50b1CedB19B9741e` | ✅ |
| TournamentPayments | `0xa009e23658609EC3d6b98b1e0904b77005A73e59` | ✅ |
| TournamentBuyback | Pending — requires Uniswap V3 pool | ☐ |
| TokenSale | `0x14c07e8dEcA1EB1415aFA4590626613Fe1764FaA` | ✅ |
| TreasuryGasManager | `0x2185cF31B507620C412b00cde9B1BCd1B62983d6` | ✅ |
| TieredStaking | `0xb30D7185FE83D9Cd2f682f9Ff7BF94b6a20058dF` | ✅ |
| AchievementBadges | `0x5b0ee0abc08fA668c6B215CCD9f9A28a77789d2c` | ✅ (UUPS) |
| TradeableItems | `0x120E5969638Ec37B00BB9d68D49688B18fA8d0Ad` | ✅ (UUPS) |
| AchievementManager | `0xF9f1067873bCe779D35e8796bfE9A32EFf5DAF1f` | ✅ (UUPS) |
| VestedAirdrop | Pending — requires Merkle root | ☐ |
| Uniswap V3 Pool | Pending | N/A |
| LP Lock | Pending | N/A |

---

*Last Updated: March 2026*
*Version: 2.0*
