# Testnet Airdrop

## Overview

8-Bit Arcade rewards early testnet participants with a **10 million 8BIT token airdrop**. Your allocation is based on your activity across gaming, Discord, Telegram, and staking.

## Eligibility Requirements

You qualify for the airdrop if you meet **ANY** of these criteria:
- **5+ games played** on testnet
- **1+ tournament entry**
- **50+ messages** in Discord or Telegram (with linked wallet)
- **Active stake** with linked wallet

## Point System

Your airdrop allocation is calculated from points earned across multiple activities:

### Gaming Points

| Activity | Points | Notes |
|----------|--------|-------|
| Games Played (1-100) | 1 point each | Full points |
| Games Played (101-500) | 0.5 points each | Diminishing returns |
| Tournament Entries | 25 points each | No cap |
| Tournament Top 10 Finishes | 100 points each | Completed tournaments only |
| High Score Rankings | 5-50 points per game | Based on all-time leaderboard position |

### Discord Activity Points

Earn points by being active in our Discord server. **You must link your wallet** using the `/link` command.

| Role | Requirement | Points |
|------|-------------|--------|
| Noob | Join server | 5 |
| Player 1 | 50+ messages | 25 |
| Keyboard Warrior | 200+ messages | 50 |
| Keyboard Overlord | 500+ messages | 100 |
| Arcade OG | Joined before cutoff date | 150 |

**How Discord Roles Work:**
1. Join the Discord server and get the "Noob" role automatically
2. Chat in channels - your messages are counted
3. Link your wallet with `/link 0xYourWallet`
4. Roles are assigned automatically based on message count
5. Role syncing happens periodically throughout the day

### Telegram Activity Points

Earn points by participating in our Telegram group. **You must link your wallet** using the `/link` command.

| Activity | Requirement | Points |
|----------|-------------|--------|
| Wallet Linked | Link wallet via bot | 5 |
| Active Member | 50+ messages | 25 |
| Regular Contributor | 200+ messages | 50 |
| Community Leader | 500+ messages | 100 |

**How to Link Your Wallet:**
1. Join the Telegram group: [@eight_bit_arcade](https://t.me/eight_bit_arcade)
2. Send `/link 0xYourWalletAddress` to link your wallet
3. Chat actively to earn points
4. Check your status with `/status`

### Staking Points

Stakers earn additional points based on amount staked and lock duration.

| Stake Amount | Points |
|--------------|--------|
| Any active stake | 10 |
| 10,000+ tokens | 25 |
| 100,000+ tokens | 50 |
| 500,000+ tokens | 100 |
| 1,000,000+ tokens | 150 |

| Lock Duration | Bonus Points |
|---------------|--------------|
| 7 days | +0 |
| 1 month | +15 |
| 3 months | +30 |
| 6 months | +50 |

### Early Adopter Bonus

The **first 100 players** by activity date receive a **2x multiplier** on all points!

## Allocation Tiers

Based on your total points, you'll be assigned to a tier:

| Tier | Eligibility | Token Pool | Share |
|------|-------------|------------|-------|
| **Legendary** | Top 1% | 2,000,000 8BIT | Highest per-player |
| **Epic** | Top 5% | 2,500,000 8BIT | High per-player |
| **Rare** | Top 20% | 3,500,000 8BIT | Medium per-player |
| **Common** | Everyone else | 2,000,000 8BIT | Base per-player |

Within each tier, tokens are distributed proportionally based on your points relative to other players in the same tier.

## Vesting Schedule

The airdrop uses a **3-month vesting schedule**:

| Release | When | Amount |
|---------|------|--------|
| **Initial** | Upon claim | 33.33% |
| **Month 1** | +30 days | 33.33% |
| **Month 2** | +60 days | 33.34% |

## How to Maximize Your Allocation

### Quick Start Checklist

1. ✅ **Play 5+ games** to meet minimum eligibility
2. ✅ **Join Discord** and link wallet with `/link`
3. ✅ **Join Telegram** and link wallet with `/link`
4. ✅ **Be active** - chat in both communities
5. ✅ **Enter tournaments** for bonus points
6. ✅ **Stake tokens** if you have any

### Pro Tips

- **Focus on multiple activities** - points stack across all sources
- **Be an early adopter** - first 100 users get 2x multiplier
- **Long-term staking** pays more than short locks
- **Quality over quantity** - top 10 tournament finishes give huge bonuses
- **Stay active in Discord/Telegram** - 500+ messages = max community points

## How to Claim

1. **Connect Wallet** - Use the same wallet you used during testnet
2. **Check Eligibility** - Visit the [Airdrop Page](https://play.8bitarcade.games/airdrop) to see your allocation
3. **Initiate Claim** - Sign the transaction to start vesting
4. **Claim Vested Tokens** - Return monthly to claim unlocked tokens

## Important Dates

- **Snapshot Date**: Manually triggered before mainnet launch
- **Claim Window**: 90 days from snapshot
- **Vesting Duration**: 60 days from initial claim

## FAQ

### How do I check my Discord message count?
Use the `/points` command in Discord to see your current stats and estimated airdrop points.

### Can I link multiple wallets?
No. Each Discord/Telegram account can only be linked to one wallet, and each wallet can only be linked once.

### What happens to unclaimed tokens?
After the 90-day claim window, unclaimed tokens are returned to the treasury.

### Do I need ETH to claim?
Yes, you'll need a small amount of ETH on Arbitrum to pay for gas fees when claiming.

### Are staking points from testnet or mainnet?
Staking points are calculated from your on-chain staking activity at snapshot time.

### When are Discord roles synced?
Roles are synced automatically throughout the day. If you just reached a threshold, it may take a few hours to update.

## Technical Details

The airdrop uses a Merkle tree for gas-efficient verification. See [VestedAirdrop Contract](../contracts/vested-airdrop.md) for technical details.

---

*Snapshot not yet taken. Keep playing and participating to maximize your allocation!*
