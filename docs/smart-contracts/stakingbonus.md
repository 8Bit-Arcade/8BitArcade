# StakingBonus

## Overview

The **StakingBonus** contract distributes bonus rewards to players who stake 8BIT tokens and rank on daily leaderboards. This incentivizes both gameplay AND holding tokens.

## How It Works

1. **GameRewards** distributes base rewards to daily leaderboard winners
2. Firebase reads each winner's staked balance from **TieredStaking**
3. **StakingBonus** mints bonus tokens based on staking tier
4. Bonus sent directly to winner's wallet - no claiming needed

## Staking Tiers

| Tier | Tokens Required | Bonus |
|------|-----------------|-------|
| 1 | 100,000 8BIT | +10% |
| 2 | 500,000 8BIT | +25% |
| 3 | 1,000,000 8BIT | +50% |

### Example

A player ranking #1 earns 2,500 8BIT base reward:

| Scenario | Staked | Bonus | Total Reward |
|----------|--------|-------|--------------|
| No staking | 0 | 0% | 2,500 8BIT |
| Tier 1 | 100k | +10% | 2,750 8BIT |
| Tier 2 | 500k | +25% | 3,125 8BIT |
| Tier 3 | 1M+ | +50% | 3,750 8BIT |

## Contract Functions

### For Users (View Only)

```solidity
// Check your bonus tier based on staked amount
function getBonusBps(uint256 stakedAmount) view returns (uint256)

// Calculate potential bonus
function calculateBonus(uint256 baseReward, uint256 stakedAmount) view returns (uint256)

// Check if bonus was distributed for a day
function isBonusDistributed(uint256 dayId, address player) view returns (bool)

// View your total bonuses earned
function totalBonusEarned(address player) view returns (uint256)
```

### Admin Functions (Owner Only)

```solidity
// Update staking tier thresholds
function setTierThresholds(uint256 tier1, uint256 tier2, uint256 tier3)

// Update bonus percentages (basis points: 1000 = 10%)
function setTierBonuses(uint256 tier1Bps, uint256 tier2Bps, uint256 tier3Bps)

// Change the distributor wallet
function setBonusDistributor(address distributor)
```

## Adjustable Parameters

The contract owner can adjust thresholds and bonuses to maintain fairness as token value changes:

**Thresholds:**
- Can be increased if token price rises significantly
- Ensures bonuses remain meaningful achievements

**Bonus Percentages:**
- Can be adjusted based on tokenomics needs
- Maximum bonus capped at 100% (2x) for safety

## Security Features

- **ReentrancyGuard** - Prevents reentrancy attacks
- **Ownable** - Only owner can adjust parameters
- **Double-distribution prevention** - Each player can only receive bonus once per day
- **Graceful handling** - Players with no stake still tracked (marked as processed with 0 bonus)

## Integration

The StakingBonus contract is called automatically by Firebase Cloud Functions after daily reward distribution. Players don't need to interact with it directly.

### Automatic Flow

```
Midnight UTC
    ↓
Firebase: distributeDailyRewards()
    ↓
GameRewards: mint base rewards
    ↓
Firebase: read staked amounts from TieredStaking
    ↓
StakingBonus: distributeBonusBatch()
    ↓
Winners with stakes receive bonus tokens
```

## Contract Address

| Network | Address |
|---------|---------|
| Arbitrum Sepolia | TBD (pending deployment) |
| Arbitrum One | TBD (mainnet launch) |

## Related Contracts

- [GameRewards](gamerewards.md) - Base daily reward distribution
- [TieredStaking](../tokenomics/staking.md) - Staking mechanism
- [EightBitToken](eightbittoken-8bit.md) - The 8BIT token

## FAQ

**Q: Do I need to do anything to receive bonuses?**
A: No! Just stake tokens and rank on the leaderboard. Bonuses are automatic.

**Q: Can I get bonuses from multiple games?**
A: Yes, bonuses apply to the global daily leaderboard which combines all games.

**Q: What if I unstake after ranking?**
A: Your staked balance is checked at distribution time (midnight UTC). Unstaking after ranking may affect your bonus.

**Q: Are tournament prizes also boosted?**
A: Currently no, but this feature may be added in the future.
