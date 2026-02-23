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

## 3. AchievementBadges + TradeableItems + AchievementManager (UUPS Proxies)

**Status:** BLOCKED — requires badge metadata uploaded to IPFS first.

**Prerequisite:**
1. Upload `contracts/metadata/badges/` folder (1.json – 20.json) to IPFS
2. Note the folder CID (e.g. `QmXXXXX`)
3. Upload a collection metadata JSON for TradeableItems and note its CID

**After IPFS upload, edit `scripts/deploy-nft-rewards.ts`:**
```ts
const EIGHT_BIT_TOKEN_ADDRESS = "0x37ee26669659758109c94862e49B492247Be26df"; // Mainnet 8BIT
const BADGE_METADATA_BASE_URI = "ipfs://<YOUR_BADGE_FOLDER_CID>/";
const ITEM_CONTRACT_URI = "ipfs://<YOUR_COLLECTION_METADATA_CID>/collection.json";
```

**Deploy (all 3 in one script):**
```cmd
npx hardhat run scripts/deploy-nft-rewards.ts --network arbitrumOne
```

**Verify (3 separate commands — use implementation addresses from Hardhat output):**
```cmd
npx hardhat verify --network arbitrumOne <BADGES_IMPL_ADDRESS>
npx hardhat verify --network arbitrumOne <ITEMS_IMPL_ADDRESS>
npx hardhat verify --network arbitrumOne <MANAGER_IMPL_ADDRESS>
```

**Post-deploy:**
- Authorize AchievementManager as minter on EightBitToken:
  `token.setAuthorizedMinter("<MANAGER_ADDRESS>", true)`
- Set backend wallet as authorized verifier:
  `manager.setAuthorizedVerifier("<BACKEND_WALLET>", true)`
- Update `frontend/src/config/contracts.ts`:
  ```ts
  ACHIEVEMENT_BADGES: '<BADGES_PROXY_ADDRESS>',
  TRADEABLE_ITEMS: '<ITEMS_PROXY_ADDRESS>',
  ACHIEVEMENT_MANAGER: '<MANAGER_PROXY_ADDRESS>',
  ```
- Update `MAINNET_ADDRESSES.md`

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
[DONE]  EightBitToken
[DONE]  GameRewards
[DONE]  TournamentManager
[DONE]  TournamentPayments
[DONE]  TokenSale
[DONE]  TreasuryGasManager
[✅]    TieredStaking          0xb30D7185FE83D9Cd2f682f9Ff7BF94b6a20058dF
[ ]     TournamentBuyback      ← after Uniswap V3 liquidity
[ ]     AchievementBadges  ┐
[ ]     TradeableItems     ├── after IPFS metadata upload
[ ]     AchievementManager ┘
[ ]     VestedAirdrop          ← after triggerAirdropSnapshot
```
