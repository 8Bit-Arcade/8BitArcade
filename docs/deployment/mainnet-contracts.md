# 8-Bit Arcade — Mainnet Contract Addresses

Deployed to **Arbitrum One** on 2026-02-22.
Deployer: `0x92f5523c2329eE281E7FEB8808FcE4b49ab1ebf8`

> **Status:** Frontend still on testnet (`USE_TESTNET = true`). Flip to `false` and update sale site when ready to go live.

## Contracts

| Contract | Address |
|---|---|
| EightBitToken (8BIT) | `0x37ee26669659758109c94862e49B492247Be26df` |
| GameRewards | `0x6e22b6b488f42FaBebE2a52fe759594650ef1B0e` |
| TournamentManager | `0xC0ab5FDF6Ef6A4e6bD60f9eD50b1CedB19B9741e` |
| TournamentPayments | `0xa009e23658609EC3d6b98b1e0904b77005A73e59` |
| TokenSale | `0x14c07e8dEcA1EB1415aFA4590626613Fe1764FaA` |
| TreasuryGasManager | `0x2185cF31B507620C412b00cde9B1BCd1B62983d6` |

## Token Distribution (verified at deployment)

| Wallet | Amount |
|---|---|
| TokenSale contract | 200,000,000 8BIT |
| TournamentManager contract | 35,000,000 8BIT |
| Deployer (founder/reserve) | 65,000,000 8BIT |
| **Total** | **300,000,000 8BIT** |

## External Addresses (Arbitrum One)

| Token/Protocol | Address |
|---|---|
| USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| WETH | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` |
| Uniswap V3 SwapRouter | `0xE592427A0AEce92De3Edee1F18E0157C05861564` |

## Arbiscan Verify Commands

```bash
cd contracts

# EightBitToken
npx hardhat verify --network arbitrumOne 0x37ee26669659758109c94862e49B492247Be26df

# GameRewards
npx hardhat verify --network arbitrumOne 0x6e22b6b488f42FaBebE2a52fe759594650ef1B0e 0x37ee26669659758109c94862e49B492247Be26df

# TournamentManager
npx hardhat verify --network arbitrumOne 0xC0ab5FDF6Ef6A4e6bD60f9eD50b1CedB19B9741e 0x37ee26669659758109c94862e49B492247Be26df

# TournamentPayments
npx hardhat verify --network arbitrumOne 0xa009e23658609EC3d6b98b1e0904b77005A73e59 0x37ee26669659758109c94862e49B492247Be26df 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1 0xE592427A0AEce92De3Edee1F18E0157C05861564

# TokenSale
npx hardhat verify --network arbitrumOne 0x14c07e8dEcA1EB1415aFA4590626613Fe1764FaA 0x37ee26669659758109c94862e49B492247Be26df 0xaf88d065e77c8cC2239327C5EDb3A432268e5831 9999999999

# TreasuryGasManager
npx hardhat verify --network arbitrumOne 0x2185cF31B507620C412b00cde9B1BCd1B62983d6 0x92f5523c2329eE281E7FEB8808FcE4b49ab1ebf8 50000000000000000 100000000000000000
```

> Note: The deploy script's verify output incorrectly said `--network arbitrumSepolia` for most contracts. All of the above use the correct `--network arbitrumOne`.

## Pre-Launch Checklist

- [ ] Verify all 6 contracts on Arbiscan (commands above)
- [ ] Move 65M deployer tokens to cold wallet / multisig
- [ ] Set sale start time via admin panel (`setSaleStartTime()`)
- [ ] Set `rewardsDistributor` in GameRewards → backend wallet
- [ ] Set `tournamentManager` in TournamentManager → backend wallet
- [ ] Set `payoutWallet` in TreasuryGasManager → backend wallet
- [ ] Fund TreasuryGasManager with 5+ ETH
- [ ] Add liquidity to DEX (8BIT/USDC pool)
- [ ] Set pool addresses in TournamentPayments (`setPools()`)
- [ ] Flip `USE_TESTNET = false` in `frontend/src/config/contracts.ts`
- [ ] Update `sale.js` and `sale-admin.js` to mainnet addresses
