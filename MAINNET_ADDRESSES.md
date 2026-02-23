# 8-Bit Arcade — Arbitrum One Mainnet Contract Addresses

> ⚠️ PRIVATE — DO NOT PUBLISH

**Network:** Arbitrum One (Chain ID: 42161)
**Block Explorer:** https://arbiscan.io

---

## Deployed & Verified

| Contract | Address | Arbiscan |
|---|---|---|
| EightBitToken (8BIT) | `0x37ee26669659758109c94862e49B492247Be26df` | [View](https://arbiscan.io/address/0x37ee26669659758109c94862e49B492247Be26df#code) |
| GameRewards | `0x6e22b6b488f42FaBebE2a52fe759594650ef1B0e` | [View](https://arbiscan.io/address/0x6e22b6b488f42FaBebE2a52fe759594650ef1B0e#code) |
| TournamentManager | `0xC0ab5FDF6Ef6A4e6bD60f9eD50b1CedB19B9741e` | [View](https://arbiscan.io/address/0xC0ab5FDF6Ef6A4e6bD60f9eD50b1CedB19B9741e#code) |
| TournamentPayments | `0xa009e23658609EC3d6b98b1e0904b77005A73e59` | [View](https://arbiscan.io/address/0xa009e23658609EC3d6b98b1e0904b77005A73e59#code) |
| TokenSale | `0x14c07e8dEcA1EB1415aFA4590626613Fe1764FaA` | [View](https://arbiscan.io/address/0x14c07e8dEcA1EB1415aFA4590626613Fe1764FaA#code) |
| TreasuryGasManager | `0x2185cF31B507620C412b00cde9B1BCd1B62983d6` | [View](https://arbiscan.io/address/0x2185cF31B507620C412b00cde9B1BCd1B62983d6#code) |
| TieredStaking | `0xb30D7185FE83D9Cd2f682f9Ff7BF94b6a20058dF` | [View](https://arbiscan.io/address/0xb30D7185FE83D9Cd2f682f9Ff7BF94b6a20058dF#code) |

---

## Pending Deployment

| Contract | Blocker |
|---|---|
| TournamentBuyback | Requires Uniswap V3 8BIT/USDC liquidity pool to exist first |
| VestedAirdrop | Requires Merkle root (run `triggerAirdropSnapshot` Cloud Function first) |
| AchievementBadges | Requires badge metadata uploaded to IPFS |
| TradeableItems | Requires badge metadata uploaded to IPFS (same deploy as Badges) |
| AchievementManager | Requires badge metadata uploaded to IPFS (same deploy as Badges) |

---

## External Token Addresses (Arbitrum One)

| Token | Address |
|---|---|
| USDC | `0xaf88d065e77c8cC2239327C5EDb3A432268e5831` |
| WETH | `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1` |
| Uniswap V3 SwapRouter | `0xE592427A0AEce92De3Edee1F18E0157C05861564` |

---

## Wallets

| Role | Address |
|---|---|
| Deployer / Owner | `0x80361876199e2318d6993A07e37177cFd21B64a7` |
| Rewards Distributor | `0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B` |
