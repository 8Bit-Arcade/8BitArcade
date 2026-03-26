# Staking (LIVE)

## Earn Passive Income by Holding 8BIT

Staking allows you to lock your 8BIT tokens and earn passive rewards over time. Staking is **LIVE on both testnet and mainnet**!

## Staking Overview

| Detail                       | Information                         |
| ---------------------------- | ----------------------------------- |
| **Status**                   | LIVE on Arbitrum One (Mainnet) & Arbitrum Sepolia (Testnet) |
| **Staking Pool**             | 50,000,000 8BIT (10% of supply)     |
| **Distribution Period**      | 5 years                             |
| **Estimated APY**            | 10-60% (based on tier & TVL)        |
| **Lock Periods**             | 7 days, 1 month, 3 months, 6 months |
| **Early Withdrawal Penalty** | 25% of staked amount                |
| **Rewards**                  | Paid in 8BIT (minted)               |
| **Mainnet Contract**         | [`0xb30D7185FE83D9Cd2f682f9Ff7BF94b6a20058dF`](https://arbiscan.io/address/0xb30D7185FE83D9Cd2f682f9Ff7BF94b6a20058dF) (9.9M 8BIT funded) |
| **Testnet Contract**         | [`0xC193451f59De0df09EC8359D091F8890A80F20c4`](https://sepolia.arbiscan.io/address/0xC193451f59De0df09EC8359D091F8890A80F20c4) |

## Why Staking?

### For Token Holders

✅ **Passive Income** - Earn rewards without playing games ✅ **Long-term Value** - Incentivizes holding vs selling ✅ **Reduced Volatility** - Locked tokens = less sell pressure ✅ **Additional Utility** - More reasons to hold 8BIT

### For the Ecosystem

✅ **Price Stability** - Reduces circulating supply ✅ **Community Alignment** - Rewards long-term believers ✅ **Sustainable Growth** - 5 year distribution (low inflation) ✅ **Investor Confidence** - Professional tokenomics

## Staking Mechanics

### Tiered Lock Periods (Weighted Shares)

Longer locks earn a larger share of the reward pool:

| Lock Period  | Weight | Effective APY Boost | Early Withdrawal |
| ------------ | ------ | ------------------- | ---------------- |
| **7 Days**   | 1.0x   | Base rate           | 25% penalty      |
| **1 Month**  | 1.5x   | +50% vs base        | 25% penalty      |
| **3 Months** | 2.0x   | +100% vs base       | 25% penalty      |
| **6 Months** | 3.0x   | +200% vs base       | 25% penalty      |

**How Weighted Shares Work:**

* Stake 10,000 8BIT for 6 months → counts as 30,000 "weighted tokens"
* Your reward share = your weighted tokens ÷ total weighted tokens
* Fixed monthly pool ensures sustainable emissions

**Example APYs at 25M TVL:**

| Lock Period | Weight | Estimated APY |
| ----------- | ------ | ------------- |
| 7 Days      | 1.0x   | \~40%         |
| 1 Month     | 1.5x   | \~60%         |
| 3 Months    | 2.0x   | \~80%         |
| 6 Months    | 3.0x   | \~120%        |

### Reward Distribution

**Monthly Emissions from Staking Pool:**

* \~833,000 8BIT per month
* Distributed proportionally by weighted stake
* Claim after unlock (rewards accumulate)

**Calculation:**

```
Your Rewards = (Your Weighted Stake / Total Weighted Stake) × Monthly Pool
```

## Staking Bonus Multipliers (LIVE)

Stakers who rank on daily leaderboards receive bonus rewards on top of their base earnings. This is handled by the **StakingBonus** smart contract.

### 🎮 Boosted Game Rewards

| Staking Tier | Tokens Required | Reward Bonus |
|--------------|-----------------|--------------|
| **Tier 1**   | 100,000 8BIT    | +10%         |
| **Tier 2**   | 500,000 8BIT    | +25%         |
| **Tier 3**   | 1,000,000 8BIT  | +50%         |

**Example:**

* Rank #1 base reward: 2,500 8BIT
* With 1M tokens staked (Tier 3): 2,500 + 1,250 = **3,750 8BIT**

### How It Works

1. Daily leaderboard rewards distributed via **GameRewards** contract
2. **StakingBonus** contract checks each winner's staked balance
3. Bonus tokens minted automatically based on tier
4. No claiming needed - bonus sent directly to wallet

### Adjustable Parameters

Tier thresholds and bonus percentages can be adjusted by the contract owner to maintain fairness as token value changes:

* `setTierThresholds(tier1, tier2, tier3)` - Adjust token requirements
* `setTierBonuses(tier1Bps, tier2Bps, tier3Bps)` - Adjust bonus percentages

**Smart Contract:** StakingBonus ([View on Arbiscan](../contracts/addresses.md))

### 🎟️ Tournament Perks

* **Discounted entry fees** (5-20% off)
* **Exclusive staker-only tournaments**
* **Bonus prize pool allocation**

### 🎨 NFT Badge Access

* **Exclusive NFT badges** for stakers
* **Achievement NFTs** unlocked by staking milestones
* **Special profile customization**

## Staking Pool Sustainability

### 50M Token Pool = 5 Year Distribution

**Monthly Distribution:**

* \~833,000 8BIT per month
* 60 months (5 years) to deplete
* Conservative inflation (0.17% monthly)

**Why This Works:**

* Generous pool = competitive APYs
* Weighted tiers reward commitment
* Deflationary burns offset emissions

### APY by TVL

APY naturally adjusts based on total staked:

| Total Staked | 7 Days | 1 Month | 3 Months | 6 Months |
| ------------ | ------ | ------- | -------- | -------- |
| **10M**      | \~100% | \~150%  | \~200%   | \~300%   |
| **25M**      | \~40%  | \~60%   | \~80%    | \~120%   |
| **50M**      | \~20%  | \~30%   | \~40%    | \~60%    |
| **100M**     | \~10%  | \~15%   | \~20%    | \~30%    |

_Higher TVL = lower APY (fixed pool split among more stakers)_

## How to Stake

### Step 1: Connect Wallet

Visit [**8bitarcade.games/staking**](https://8bitarcade.games/staking.html) and connect your Web3 wallet.

### Step 2: Choose Lock Period

Select your preferred lock period:

* 7 days (1x multiplier)
* 1 month (1.5x multiplier)
* 3 months (2x multiplier)
* 6 months (3x multiplier)

### Step 3: Enter Amount

Decide how many 8BIT tokens to stake:

* Minimum: 1 8BIT
* Maximum: No limit
* Up to 50 separate stakes per wallet

### Step 4: Confirm Transaction

Approve the staking contract and confirm transaction in MetaMask.

### Step 5: Earn Rewards

* View your staked balance and countdown timers
* See accumulated rewards in real-time
* Claim rewards after unlock period
* Withdraw with 25% penalty if early

## Risks & Considerations

### Smart Contract Risk

* Staking requires trusting the smart contract
* Contract will be audited before launch
* Start with small amounts to test

### Lock Period Risk

* Tokens locked for chosen period
* Cannot withdraw without penalty
* Price may change during lock

### APY Fluctuation

* APY not guaranteed
* May adjust based on market conditions
* Check current rates before staking

### Opportunity Cost

* Staked tokens can't be sold
* May miss price appreciation opportunities
* Consider market conditions before locking

## Comparison to Other Platforms

| Platform            | Staking APY | Lock Period      | Additional Benefits           |
| ------------------- | ----------- | ---------------- | ----------------------------- |
| **8-Bit Arcade**    | **15-30%**  | Flexible to 180d | Game boosts, governance, NFTs |
| Uniswap V3          | 5-50%       | None             | Trading fees only             |
| AAVE                | 2-8%        | None             | Borrowing power               |
| Traditional Staking | 5-15%       | Varies           | Just APY                      |

**8-Bit Arcade Advantage:**

* Competitive APY rates
* Multiple benefit layers
* Gaming utility integration
* Governance participation

## Current Status

### Mainnet (LIVE)

* ✅ TieredStaking contract deployed & verified on Arbitrum One
* ✅ 9,900,000 8BIT funded (of 25M total — more to be added later)
* ✅ All 4 lock tiers working (7d, 1m, 3m, 6m)
* ✅ Real-time reward accrual
* ✅ Staking bonus multipliers for leaderboard rewards

### Testnet

* ✅ Staking contract deployed on Arbitrum Sepolia
* ✅ All 4 lock tiers working (7d, 1m, 3m, 6m)
* ✅ Live countdown timers and progress bars

## Stay Updated

* [**Join Discord**](../community/social.md) for announcements
* [**Follow Twitter**](../community/social.md) for updates
* [**Start Staking**](https://8bitarcade.games/staking.html) now on mainnet!

## Frequently Asked Questions

**Q: Is staking live?** A: Yes! Staking is live on both Arbitrum One mainnet and Arbitrum Sepolia testnet.

**Q: Can I stake presale tokens?** A: Yes! Any 8BIT tokens can be staked.

**Q: Is there a minimum staking amount?** A: The minimum is just 1 8BIT token.

**Q: Can I stake and still play games?** A: Yes! Staking doesn't prevent playing. Stakers get bonus rewards on daily leaderboards.

**Q: What if I need to withdraw early?** A: Early withdrawal incurs a 25% penalty on the staked amount.

**Q: How are APY rates determined?** A: Based on total amount staked and your lock tier multiplier.

**Q: Will staking be available on mobile?** A: Yes, via WalletConnect and mobile-friendly web interface.

## Security

✅ **Open source code** on GitHub
✅ **Community testing** on testnet
✅ **Verified contract** on Arbiscan

## Conclusion

Staking adds a **passive income layer** to 8-Bit Arcade, rewarding long-term holders while reducing sell pressure and increasing token utility.

**Start staking today:**

* Visit [8bitarcade.games/staking](https://8bitarcade.games/staking.html)
* Connect your wallet
* Choose your lock tier
* Earn rewards!

## Next Steps

* [Daily Rewards](../earning/daily-rewards.md) - Earn while waiting for staking
* [Tournaments](../earning/tournaments.md) - Active earning opportunities
* [Roadmap](../roadmap/phases.md) - Full development timeline
* [Emissions](emissions.md) - Understand staking pool distribution

***

_Staking details are subject to change based on community feedback, market conditions, and technical considerations. Official parameters will be announced before staking launch._
