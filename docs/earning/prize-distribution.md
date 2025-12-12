# Prize Distribution

## How Rewards Are Calculated and Paid Out

Understanding exactly how prizes are calculated, distributed, and what they're worth is essential for maximizing your crypto earnings on 8-Bit Arcade.

## Distribution Overview

8-Bit Arcade has two prize distribution systems:

### 1. Daily Free Rewards
- **FREE to earn** (no entry fee)
- **50,000 8BIT distributed daily** across all games
- **Top 10 per game** earn rewards
- **Automatic payouts** at 00:00 UTC

### 2. Tournament Prizes
- **Paid entry** required ($1-$50 USDC)
- **Larger prize pools** (25K-500K 8BIT)
- **Top finishers** earn rewards (varies by tournament)
- **Automatic payouts** when tournament ends

## Daily Rewards Distribution

### Total Daily Pool: 50,000 8BIT

Distributed across all active games proportionally.

**If there are 10 active games:**
- Each game gets 5,000 8BIT per day
- Top 10 in each game split their game's pool

**Example: Space Rocks Daily Pool = 5,000 8BIT**

| Rank | % Share | Reward Calculation | Daily 8BIT |
|------|---------|-------------------|------------|
| 1st | 25% | 5,000 × 25% | 1,250 |
| 2nd | 12.5% | 5,000 × 12.5% | 625 |
| 3rd | 12.5% | 5,000 × 12.5% | 625 |
| 4th | 12.5% | 5,000 × 12.5% | 625 |
| 5th | 12.5% | 5,000 × 12.5% | 625 |
| 6th | 5% | 5,000 × 5% | 250 |
| 7th | 5% | 5,000 × 5% | 250 |
| 8th | 5% | 5,000 × 5% | 250 |
| 9th | 5% | 5,000 × 5% | 250 |
| 10th | 5% | 5,000 × 5% | 250 |
| **TOTAL** | **100%** | | **5,000** |

### Per-Game Allocation

The 50,000 daily pool is split dynamically:

**Formula:**
```
Game Daily Pool = (50,000 / Number of Active Games) × Game Weight
```

**Game Weight Factors:**
- **Popularity** - More players = higher weight
- **Difficulty** - Harder games may get bonus weight
- **Playtime** - Games with more engagement
- **Default** - Equal split if no weighting applied

**Initially:** All games have equal weight (simple split)

**Future:** Community governance may adjust weights

## Tournament Prize Distribution

### Standard Tournament Example

**Entry:** $5 × 50 players = $250 collected

**50/50 Split:**
- **$125 → Prize pool** (50%)
- **$125 → Buyback & burn** (50%)

**Prize Pool Conversion:**
- $125 swapped to 8BIT on Uniswap V3
- At $0.003 token price = ~41,666 8BIT prize pool

**Prize Breakdown:**

| Rank | % of Pool | Calculation | Prize |
|------|-----------|-------------|-------|
| 1st | 50% | 41,666 × 50% | 20,833 8BIT |
| 2nd | 25% | 41,666 × 25% | 10,416 8BIT |
| 3rd | 15% | 41,666 × 15% | 6,250 8BIT |
| 4th | 5% | 41,666 × 5% | 2,083 8BIT |
| 5th | 5% | 41,666 × 5% | 2,083 8BIT |

### High Roller Monthly Example

**Entry:** $25 × 200 players = $5,000 collected

**50/50 Split:**
- **$2,500 → Prize pool** (50%)
- **$2,500 → Buyback & burn** (50%)

**Prize Pool Conversion:**
- $2,500 swapped to 8BIT
- At $0.005 token price = 500,000 8BIT prize pool

**Prize Breakdown:**

| Rank | % of Pool | Calculation | Prize |
|------|-----------|-------------|-------|
| 1st | 40% | 500,000 × 40% | 200,000 8BIT |
| 2nd | 20% | 500,000 × 20% | 100,000 8BIT |
| 3rd | 15% | 500,000 × 15% | 75,000 8BIT |
| 4th | 10% | 500,000 × 10% | 50,000 8BIT |
| 5th | 5% | 500,000 × 5% | 25,000 8BIT |
| 6-20 | 10% | 500,000 × 10% ÷ 15 | 3,333 8BIT each |

## Prize Value Calculations

### Token Price Impact

Your prize value in USD depends on 8BIT token price:

**Example: You win 200,000 8BIT (1st in High Roller Monthly)**

| Token Price | Market Cap | USD Value |
|-------------|------------|-----------|
| $0.001626 | $500K | $325 |
| $0.00325 | $1M | $650 |
| $0.01626 | $5M | $3,252 |
| $0.0325 | $10M | **$6,500** |

**Key Insight:** Same 200K 8BIT win can be worth $325 or $6,500 depending on market conditions.

### Calculating Your Potential Earnings

**Daily Rewards (per game):**

```
Daily Earnings = Rank Multiplier × Game Pool

Example:
- Rank #1 in Space Rocks
- Game pool = 5,000 8BIT
- Rank multiplier = 25%
- Daily earnings = 5,000 × 25% = 1,250 8BIT
```

**Monthly Projection:**

```
Monthly = Daily × 30 days

Example:
- Daily: 1,250 8BIT
- Monthly: 1,250 × 30 = 37,500 8BIT
- At $0.003 = $112.50/month
- At $0.0325 = $1,218/month
```

**Tournament Winnings:**

```
Prize = (Entry Fees × Participants × 50%) ÷ Token Price × Your %

Example:
- Entry: $25
- Participants: 200
- Total fees: $5,000
- Prize pool: $2,500 (50%)
- Your %: 40% (1st place)
- Your USDC: $1,000
- Token price: $0.005
- Your 8BIT: $1,000 ÷ $0.005 = 200,000 8BIT
```

## Payout Mechanics

### Smart Contract Automation

**Daily Rewards Process:**

```
1. [00:00 UTC] Daily reset trigger activated
2. Smart contract queries final rankings
3. For each game:
   - Identify top 10 players
   - Calculate reward amounts
   - Mint 8BIT tokens
4. Transfer tokens to winner wallets
5. Emit payout events on blockchain
6. Update user balances
```

**Tournament Payouts Process:**

```
1. Tournament end time reached
2. Final scores locked
3. Rankings determined (with tiebreakers)
4. Prize distribution calculated
5. 8BIT minted/transferred to winners
6. Payout confirmation emails sent
7. Results published
```

### Transaction Verification

All payouts are:
- ✅ **On-chain** - Verifiable on Arbiscan
- ✅ **Automatic** - No manual processing
- ✅ **Transparent** - Public transaction history
- ✅ **Immediate** - Usually within minutes

### Viewing Your Transactions

**Check your payouts:**

1. Visit [Arbiscan.io](https://arbiscan.io)
2. Enter your wallet address
3. View "Token Transfers"
4. See all 8BIT received
5. Click transaction for details

**Or use platform:**

1. Go to **Profile** → **Rewards History**
2. See all earnings with dates
3. Filter by type (daily/tournament)
4. Export CSV for records

## Distribution Timeline

### Daily Rewards

| Time (UTC) | Event |
|------------|-------|
| 23:55 | 5-minute warning (leaderboards lock soon) |
| 00:00 | **Daily reset** - rankings finalized |
| 00:01 | Smart contract calculates rewards |
| 00:02 | Tokens minted for winners |
| 00:03 | Payouts sent to wallets |
| 00:05 | **Funds available** in winner wallets |
| 00:06 | New leaderboard cycle begins |

**Total Time:** ~5 minutes from reset to funds in wallet

### Tournament Payouts

| Phase | Duration |
|-------|----------|
| Tournament ends | Timestamp exact |
| Score validation | 1-5 minutes |
| Ranking finalization | 1-2 minutes |
| Prize calculation | 1 minute |
| Payout execution | 2-5 minutes |
| **Total** | **5-15 minutes** |

**Delays possible if:**
- High network congestion
- Smart contract issues
- Unusual activity requiring review

## Multi-Game Earnings

### Aggregating Across Games

**Example Player: Ranks in 3 games daily**

| Game | Rank | Daily 8BIT | Monthly 8BIT |
|------|------|------------|--------------|
| Space Rocks | 6th | 250 | 7,500 |
| Chomper | 4th | 625 | 18,750 |
| Block Drop | 8th | 250 | 7,500 |
| **TOTAL** | - | **1,125** | **33,750** |

**USD Value:**

| Market Cap | Token Price | Monthly USD |
|------------|-------------|-------------|
| $1M | $0.00325 | $109.69 |
| $5M | $0.01626 | $548.78 |
| $10M | $0.0325 | **$1,096.88** |

### Tournament + Daily Combined

**Aggressive Player Strategy:**

**Daily rewards:** 1,125 8BIT/day = 33,750/month
**Tournaments:** Win 2× Standard ($5 entry) = 40,000 8BIT
**Monthly Total:** 73,750 8BIT

**At $10M market cap:** $2,396/month just from gaming! 🔥

## Prize Pool Guarantees

### Guaranteed vs. Variable Pools

**Daily Rewards: GUARANTEED**
- Always 50,000 8BIT per day
- Never changes based on participation
- Funded by emissions pool
- Sustainable for 5 years

**Tournaments: MOSTLY VARIABLE**
- Prize pool = 50% of entry fees collected
- More players = larger prizes
- Less players = smaller prizes

**Some Tournaments: GUARANTEED MINIMUM**
- Platform may add extra 8BIT
- Ensures attractive prizes
- Usually for special events
- Announced beforehand

## Fee Breakdown

### Where Tournament Entry Fees Go

**Example: $10 Entry Fee**

```
$10.00  Total Entry Fee
├─ $5.00 (50%) → Prize Pool
│  └─ Swapped to 8BIT
│     └─ Distributed to winners
│
└─ $5.00 (50%) → Buyback & Burn
   └─ Swapped to 8BIT on Uniswap
      └─ Sent to burn address (destroyed)
```

**Benefits:**
- 50% directly benefits players (prize pool)
- 50% benefits all holders (deflationary)
- Creates constant buy pressure
- Reduces circulating supply

### No Hidden Fees

**What you pay:**
- Entry fee (e.g. $10)
- Gas fee (~$0.20)
- **Total: ~$10.20**

**What you DON'T pay:**
- ❌ Platform fees
- ❌ Withdrawal fees
- ❌ Claiming fees
- ❌ Service charges

## Tax Considerations

> ⚠️ **Not tax advice. Consult a tax professional.**

### Prize Income

In most jurisdictions, crypto prizes are taxable:

**Daily rewards:**
- May be considered ordinary income
- Taxable at fair market value when received
- Track USD value on receipt date

**Tournament winnings:**
- May be considered gambling/contest income
- Taxable at fair market value
- May have different reporting requirements

### Record Keeping

**Keep records of:**
- Date of each payout
- Amount of 8BIT received
- USD value at time of receipt
- Purpose (daily reward, tournament win)
- Gas fees paid

**Export from platform:**
1. Profile → Rewards History
2. Click "Export CSV"
3. Save for tax records
4. Provide to accountant

## Transparency & Verification

### Public Blockchain Records

**Everything is verifiable:**

1. **Smart Contract Code**
   - View on [Arbiscan](https://arbiscan.io)
   - See exactly how distributions work
   - Verify no backdoors or tricks

2. **Distribution Events**
   - All payouts emit blockchain events
   - Anyone can verify amounts
   - Cannot be faked or manipulated

3. **Token Minting**
   - See when new tokens minted
   - Verify amounts match emissions schedule
   - Track total supply in real-time

### Community Oversight

**Verification tools:**
- [8bitarcade.games/transparency](https://8bitarcade.games/transparency) - Official dashboard
- [Arbiscan.io](https://arbiscan.io) - Blockchain explorer
- [Dune Analytics](https://dune.com) - Community dashboards

## Frequently Asked Questions

**Q: When do I receive my daily rewards?**
A: Automatically within 5 minutes of daily reset (00:00 UTC).

**Q: Do I need to claim rewards manually?**
A: No, all payouts are automatic. Tokens sent directly to your wallet.

**Q: What if I rank top 10 in multiple games?**
A: You earn rewards from EACH game. No limit!

**Q: Can tournament prizes run out?**
A: No. Prizes funded by entry fees, which fund the prizes.

**Q: What happens if a tournament has no winners?**
A: Not possible - prizes always go to top finishers.

**Q: Are prizes subject to change?**
A: Daily reward structure is fixed. Tournament prizes depend on participation.

**Q: Can I choose to receive prizes in USDC instead of 8BIT?**
A: No, all prizes are paid in 8BIT. You can swap to USDC after receiving.

**Q: Do I pay gas fees to receive prizes?**
A: No, recipients don't pay gas. Platform covers payout costs.

## Next Steps

- [Daily Rewards](daily-rewards.md) - Earn free crypto daily
- [Tournaments](tournaments.md) - Compete for big prizes
- [Claiming Your Rewards](claiming.md) - How to access your winnings
- [Market Scenarios](../tokenomics/market-scenarios.md) - Prize value projections

---

*All prize distributions are automated via smart contracts and publicly verifiable on the Arbitrum blockchain.*
