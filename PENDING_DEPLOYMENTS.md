# 8-Bit Arcade — Pending Mainnet Deployments

> Tracking list for all remaining Arbitrum One contract launches.
> See `MAINNET_ADDRESSES.md` for already-deployed contract addresses.

---

## ~~1. TieredStaking~~ ✅ DEPLOYED & VERIFIED

**Address:** `0xb30D7185FE83D9Cd2f682f9Ff7BF94b6a20058dF`
**Arbiscan:** https://arbiscan.io/address/0xb30D7185FE83D9Cd2f682f9Ff7BF94b6a20058dF#code
**Funded:** 9,900,000 8BIT (of 25M total — add more later)

**Remaining:**
- Transfer additional 8BIT to staking contract when ready to reach 25M total
- Update staking.html with the contract address

---

## 2. TournamentBuyback

**Status:** BLOCKED — requires Uniswap V3 8BIT/USDC liquidity pool to exist first.

**Prerequisite:**
1. Add 8BIT/USDC liquidity on Uniswap V3 (Arbitrum One)
2. Note the pool address

**Constructor args (ready):**
- `_eightBitToken` = `0x37ee26669659758109c94862e49B492247Be26df`
- `_usdcToken` = `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- `_swapRouter` = `0xE592427A0AEce92De3Edee1F18E0157C05861564`

**Deploy (once pool exists):**
```cmd
set EIGHTBIT_TOKEN_ADDRESS=0x37ee26669659758109c94862e49B492247Be26df
npx hardhat run scripts/deploy-tournament-payments.ts --network arbitrumOne
```

**Verify:**
```cmd
npx hardhat verify --network arbitrumOne <ADDRESS> 0x37ee26669659758109c94862e49B492247Be26df 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 0xE592427A0AEce92De3Edee1F18E0157C05861564
```

**Post-deploy:**
- Call `setPool(<8BIT_USDC_POOL_ADDRESS>)` on the deployed TournamentBuyback
- Update `frontend/src/config/contracts.ts` → `TOURNAMENT_BUYBACK: '<ADDRESS>'`
- Update `MAINNET_ADDRESSES.md`

---

## ~~3. AchievementBadges + TradeableItems + AchievementManager (UUPS Proxies)~~ ✅ DEPLOYED

**AchievementBadges:** `0x5b0ee0abc08fA668c6B215CCD9f9A28a77789d2c` (UUPS Proxy)
**TradeableItems:** `0x120E5969638Ec37B00BB9d68D49688B18fA8d0Ad` (UUPS Proxy)
**AchievementManager:** `0xF9f1067873bCe779D35e8796bfE9A32EFf5DAF1f` (UUPS Proxy)

**Remaining:**
- Authorize AchievementManager as minter on EightBitToken
- Set backend wallet as authorized verifier
- Upload badge metadata to IPFS and configure URIs

---

## 4. VestedAirdrop

**Status:** BLOCKED — requires Merkle root from snapshot of testnet participants.

**Prerequisite:**
1. Run `triggerAirdropSnapshot` Firebase Cloud Function
2. Note the Merkle root output

**Deploy (replace `<MERKLE_ROOT>`):**
```cmd
set MERKLE_ROOT=0x<YOUR_MERKLE_ROOT>
set TOKEN_ADDRESS=0x37ee26669659758109c94862e49B492247Be26df
set TREASURY_ADDRESS=0x80361876199e2318d6993A07e37177cFd21B64a7
npx hardhat run scripts/deploy-airdrop.ts --network arbitrumOne
```

**Verify:**
```cmd
npx hardhat verify --network arbitrumOne <ADDRESS> 0x37ee26669659758109c94862e49B492247Be26df <MERKLE_ROOT> 0x80361876199e2318d6993A07e37177cFd21B64a7
```

**Post-deploy:**
- Transfer 15,000,000 8BIT to the airdrop contract
- Call `activate()` on the contract
- Call Firebase `setAirdropContract({ snapshotId: "...", contractAddress: "<ADDRESS>" })`
- Update `frontend/src/config/contracts.ts` → `VESTED_AIRDROP: '<ADDRESS>'`
- Update `MAINNET_ADDRESSES.md`

---

## Deployment Order Summary

```
[✅]  EightBitToken          0x37ee26669659758109c94862e49B492247Be26df
[✅]  GameRewards            0x6e22b6b488f42FaBebE2a52fe759594650ef1B0e
[✅]  TournamentManager      0xC0ab5FDF6Ef6A4e6bD60f9eD50b1CedB19B9741e
[✅]  TournamentPayments     0xa009e23658609EC3d6b98b1e0904b77005A73e59
[✅]  TokenSale              0x14c07e8dEcA1EB1415aFA4590626613Fe1764FaA
[✅]  TreasuryGasManager     0x2185cF31B507620C412b00cde9B1BCd1B62983d6
[✅]  TieredStaking          0xb30D7185FE83D9Cd2f682f9Ff7BF94b6a20058dF
[✅]  AchievementBadges      0x5b0ee0abc08fA668c6B215CCD9f9A28a77789d2c
[✅]  TradeableItems         0x120E5969638Ec37B00BB9d68D49688B18fA8d0Ad
[✅]  AchievementManager     0xF9f1067873bCe779D35e8796bfE9A32EFf5DAF1f
[ ]   TournamentBuyback      ← after Uniswap V3 liquidity
[ ]   VestedAirdrop          ← after triggerAirdropSnapshot
```
