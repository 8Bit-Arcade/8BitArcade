# Testnet Airdrop

## Overview

8-Bit Arcade rewards early testnet participants with a **10 million 8BIT token airdrop**. If you've been playing games and competing in tournaments on testnet, you may be eligible for free tokens!

## Eligibility Requirements

To qualify for the airdrop, you must meet **at least one** of the following criteria:

- **5+ games played** on testnet
- **1+ tournament entry** on testnet

## How Points Are Calculated

Your airdrop allocation is based on your testnet activity:

| Activity | Points | Max Points |
|----------|--------|------------|
| Games Played | 1 point each | 500 |
| Tournament Entries | 25 points each | 200 |
| Tournament Top 10 Finishes | 100 points each | 250 |
| High Score Rankings (per game) | 5-50 points | Unlimited |
| Early Adopter Bonus (first 100 users) | 2x multiplier | - |

## Allocation Tiers

Based on your total points, you'll be assigned to a tier:

| Tier | Eligibility | Token Pool |
|------|-------------|------------|
| **Legendary** | Top 1% | 2,000,000 8BIT |
| **Epic** | Top 5% | 2,500,000 8BIT |
| **Rare** | Top 20% | 3,500,000 8BIT |
| **Common** | Everyone else | 2,000,000 8BIT |

Within each tier, tokens are distributed based on your points relative to other players in the same tier.

## Vesting Schedule

The airdrop uses a **3-month vesting schedule** to ensure long-term commitment:

| Release | When | Amount |
|---------|------|--------|
| **Initial** | Upon claim | 33.33% |
| **Month 1** | +30 days | 33.33% |
| **Month 2** | +60 days | 33.34% |

## How to Claim

1. **Connect Wallet** - Use the same wallet you used during testnet
2. **Check Eligibility** - Visit the [Airdrop Page](/airdrop) to see your allocation
3. **Initiate Claim** - Sign the transaction to start vesting
4. **Claim Vested Tokens** - Return monthly to claim unlocked tokens

## Important Dates

- **Snapshot Date**: Manually triggered before mainnet launch
- **Claim Window**: 90 days from snapshot
- **Vesting Duration**: 60 days from initial claim

## FAQ

### Can I check my eligibility before the snapshot?

The airdrop page will show your estimated tier based on current activity. Final allocations are determined at snapshot time.

### What happens to unclaimed tokens?

After the 90-day claim window, unclaimed tokens are returned to the treasury.

### Do I need ETH to claim?

Yes, you'll need a small amount of ETH on Arbitrum to pay for gas fees when claiming.

### Can I claim on behalf of another wallet?

No, claims can only be made by the wallet that earned the allocation.

## Technical Details

The airdrop uses a Merkle tree for gas-efficient verification. See [VestedAirdrop Contract](../contracts/vested-airdrop.md) for technical details.
