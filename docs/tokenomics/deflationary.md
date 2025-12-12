# Deflationary Model

## How 8BIT Supply Decreases Over Time

Unlike inflationary tokens that constantly increase supply, 8BIT uses a **buyback and burn mechanism** to permanently remove tokens from circulation.

## The Buyback & Burn Mechanism

### How It Works

```
1. Player pays $10 USDC to enter tournament
   ↓
2. Tournament contract receives $10 USDC
   ↓
3. Smart contract automatically splits payment:
   • 50% ($5) → Prize pool for winners
   • 50% ($5) → Buyback contract
   ↓
4. Buyback contract swaps $5 USDC for 8BIT via Uniswap V3
   ↓
5. Purchased 8BIT sent to burn address (0x000...dead)
   ↓
6. Tokens permanently removed from circulation ♨️
```

### Key Features

✅ **Automatic** - No manual intervention
✅ **Trustless** - Smart contract enforced
✅ **Transparent** - All burns visible on blockchain
✅ **Irreversible** - Tokens can never be recovered
✅ **Continuous** - Every tournament contributes

## Burn Address

**Official Burn Wallet:** `0x000000000000000000000000000000000000dEaD`

- Tokens sent here are **permanently destroyed**
- No private key exists (wallet is inaccessible)
- Reduces circulating supply forever
- Publicly viewable on [Arbiscan](https://arbiscan.io)

## Impact on Circulating Supply

### Monthly Burn Examples

#### Conservative Scenario ($10K Tournament Volume)

| Metric | Value |
|--------|-------|
| Monthly tournament fees | $10,000 USDC |
| Amount to buyback (50%) | $5,000 USDC |
| 8BIT price | $0.003 |
| Tokens bought & burned | 1,666,666 8BIT |
| **% of supply burned** | **0.33%/month** |
| **Annual burn rate** | **4% of supply** |

**Effect:** Reduces inflation from 6% to ~2% net

---

#### Moderate Scenario ($50K Tournament Volume)

| Metric | Value |
|--------|-------|
| Monthly tournament fees | $50,000 USDC |
| Amount to buyback (50%) | $25,000 USDC |
| 8BIT price | $0.003 |
| Tokens bought & burned | 8,333,333 8BIT |
| **% of supply burned** | **1.67%/month** |
| **Annual burn rate** | **20% of supply** |

**Effect:** Net DEFLATIONARY (20% burn vs 6% emissions = -14% supply annually)

---

#### Growth Scenario ($200K Tournament Volume)

| Metric | Value |
|--------|-------|
| Monthly tournament fees | $200,000 USDC |
| Amount to buyback (50%) | $100,000 USDC |
| 8BIT price | $0.003 |
| Tokens bought & burned | 33,333,333 8BIT |
| **% of supply burned** | **6.67%/month** |
| **Annual burn rate** | **80% of supply** |

**Effect:** HEAVY deflation (80% burn vs 6% emissions = -74% supply annually)

## Deflationary Timeline

### Years 1-5 (Emissions Active)

**Net Supply Change** = Emissions - Burns

| Tournament Volume | Emissions | Burns | Net Change |
|-------------------|-----------|-------|------------|
| $10K/month | +2.5M | -1.67M | **+833K** (mild inflation) |
| $50K/month | +2.5M | -8.33M | **-5.83M** (deflationary!) |
| $100K/month | +2.5M | -16.67M | **-14.17M** (heavy deflation) |

**Key Insight:** If tournament volume exceeds ~$15K/month, the token becomes **net deflationary** even during emission period.

### Year 6+ (Zero Emissions)

**Net Supply Change** = 0 - Burns

- All burns directly reduce circulating supply
- No new tokens minted from rewards pool
- Pure deflationary pressure
- Scarcity increases over time

## Price Impact of Burns

### Buyback Creates Buy Pressure

Every tournament entry creates **automatic buy orders** on Uniswap V3:

**Example:**
- 100 players enter $10 tournament
- $1,000 in fees collected
- $500 used to buy 8BIT on Uniswap
- **Constant buy pressure regardless of market sentiment**

### Supply Reduction Increases Scarcity

**Basic Economics:**
- Same demand + Lower supply = Higher price
- As tokens burn, remaining tokens become more valuable
- Deflationary assets tend to appreciate over time

**Example Projection:**

| Year | Circulating Supply | Tournament Burns | Net Supply |
|------|-------------------|------------------|------------|
| 0 | 200M | 0 | 200M |
| 1 | 230M | 20M | 210M (net +10M) |
| 3 | 290M | 100M | 190M (net -10M) |
| 5 | 350M | 250M | 100M (net -100M) |
| 10 | 350M | 500M | **-150M** (can't go negative, asymptotic) |

*Assumes moderate growth in tournament activity*

## Comparison to Other Models

### Typical Token Models

| Model | Supply Over Time | Examples |
|-------|------------------|----------|
| **Inflationary** | Always increasing | Most PoS chains, gaming tokens |
| **Fixed Supply** | Never changes | Bitcoin (eventually), many tokens |
| **Deflationary** | Decreasing | **8BIT**, BNB, ETH (post-merge) |

### Why Deflationary is Superior for Gaming

**Problem with Inflationary:**
- Constant sell pressure from emissions
- Token value decreases over time
- Late players earn worthless rewards

**Problem with Fixed Supply:**
- No mechanism to reward players
- Can't sustain play-to-earn model

**Deflationary Solution:**
- ✅ Rewards players during distribution phase
- ✅ Burns offset inflation
- ✅ Long-term holders benefit from scarcity
- ✅ Aligns player and investor incentives

## Real-World Deflationary Examples

### Binance Coin (BNB)

- **Mechanism:** Quarterly burns from exchange fees
- **Result:** Supply reduced from 200M to ~150M (25% burned)
- **Price Impact:** $15 → $600+ (4,000% gain)

### Ethereum (ETH)

- **Mechanism:** EIP-1559 burns base fees
- **Result:** Net deflationary since "The Merge"
- **Price Impact:** Positive sentiment, reduced sell pressure

### 8-Bit Arcade (8BIT)

- **Mechanism:** 50% of tournament fees → buyback & burn
- **Advantage:** Burns tied directly to platform usage
- **Sustainability:** More players = more tournaments = more burns

## Burn Transparency & Tracking

### View Burns in Real-Time

1. **[Burn Address on Arbiscan](https://arbiscan.io)**
   - See exact balance of burned tokens
   - View all burn transactions
   - Track burn rate over time

2. **[TournamentBuyback Contract](https://arbiscan.io)**
   - View USDC → 8BIT swap transactions
   - See buyback amounts
   - Verify automatic execution

3. **[8-Bit Arcade Dashboard](https://8bitarcade.games/burns)**
   - Total tokens burned
   - Monthly burn rate
   - Historical burn chart
   - % of supply removed

### Burn Metrics

Track these key metrics to understand deflationary impact:

- **Total Burned:** Total 8BIT sent to burn address
- **Burn Rate:** Tokens burned per day/month
- **% of Supply:** Percentage of max supply burned
- **Net Inflation:** Emissions - Burns (positive = inflation, negative = deflation)

## Long-Term Supply Projection

### Conservative Path (Low Tournament Volume)

```
Year 0:  500M max supply, 200M circulating
Year 1:  230M circulating (+30M emissions, -10M burns)
Year 5:  350M circulating (+150M emissions, -50M burns)
Year 10: 300M circulating (0 emissions, -50M burns)
Year 20: 200M circulating (0 emissions, -100M burns)
```

**Result:** Returns to launch circulating supply over 20 years

### Moderate Path (Medium Tournament Volume)

```
Year 0:  500M max supply, 200M circulating
Year 1:  210M circulating (+30M emissions, -20M burns)
Year 5:  250M circulating (+150M emissions, -100M burns)
Year 10: 150M circulating (0 emissions, -100M burns)
Year 20: 50M circulating (0 emissions, -100M burns)
```

**Result:** 90% supply reduction over 20 years

### Optimistic Path (High Tournament Volume)

```
Year 0:  500M max supply, 200M circulating
Year 1:  190M circulating (+30M emissions, -40M burns)
Year 5:  100M circulating (+150M emissions, -250M burns)
Year 10: 20M circulating (0 emissions, -80M burns)
Year 20: <5M circulating (0 emissions, -15M burns)
```

**Result:** 99%+ supply reduction → extreme scarcity

## What This Means for Token Value

### Supply & Demand Dynamics

**Demand Drivers (Buying Pressure):**
- Tournament entry requirements
- Automatic buybacks from fees
- Investor speculation
- Staking requirements (future)
- NFT minting (future)

**Supply Factors:**
- New emissions (Years 1-5 only)
- Burns (continuous, forever)
- Lost wallets (permanent reduction)

**Net Effect:** Demand increases + Supply decreases = **Price appreciation**

### Deflation Incentivizes Holding

**Investor Psychology:**
- "Supply is decreasing, my tokens become scarcer"
- "No reason to sell, it'll be worth more later"
- "I'll hold and stake for passive income"

**Result:** Reduced sell pressure → More stable price → Higher valuations

## Why 50% Split?

### Tournament Fee Allocation

**50% to Prize Pool:**
- Ensures attractive prizes
- Incentivizes player participation
- Immediate value to winners

**50% to Buyback & Burn:**
- Creates constant buy pressure
- Reduces circulating supply
- Benefits all holders long-term

**Why not 100% to prizes?**
- Wouldn't create deflationary pressure
- Token would be purely inflationary
- No long-term value accrual

**Why not 100% to buyback?**
- Prizes would be too small
- Players wouldn't participate
- Platform wouldn't grow

**50/50 = Perfect Balance** ⚖️

## Future Deflationary Mechanisms

Additional burn sources being planned:

### NFT Badges (Phase 3)

- Mint exclusive achievement NFTs
- Pay 8BIT to mint
- 50% of minting fees burned
- Creates new burn source beyond tournaments

### Governance Proposals (Phase 4)

- Submit platform proposals
- Small 8BIT fee to prevent spam
- 100% of fees burned

### Premium Features (Future)

- Custom usernames
- Profile customization
- Exclusive games
- All paid in 8BIT, 50%+ burned

## Conclusion

The deflationary model ensures:

✅ **Long-term sustainability** - Burns offset emissions
✅ **Value accrual** - Remaining tokens become scarcer
✅ **Holder benefits** - All holders benefit from burns
✅ **Aligned incentives** - Players and investors both win
✅ **Transparent & trustless** - Smart contract enforced

**As adoption grows, deflationary pressure increases, creating a positive feedback loop for token value.**

## Next Steps

- [Emissions Schedule](emissions.md) - When new tokens are created
- [Market Scenarios](market-scenarios.md) - Price projections
- [Token Distribution](distribution.md) - Where tokens go
- [Tournaments](../earning/tournaments.md) - How to contribute to burns

---

*All burns are permanent, transparent, and verifiable on the Arbitrum blockchain. View the burn address anytime: `0x000000000000000000000000000000000000dEaD`*
