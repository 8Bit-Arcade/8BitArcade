# Smart Contracts Overview

## Decentralized Infrastructure Powering 8-Bit Arcade

All core functionality of 8-Bit Arcade runs on Arbitrum smart contracts. This ensures trustless operation, transparent distribution, and provable fairness.

## Contract Architecture

### Core Contracts

```
8-Bit Arcade Smart Contract System
│
├── EightBitToken.sol (8BIT)
│   ├── ERC-20 standard token
│   ├── 500M max supply
│   ├── Minting controlled by owner
│   └── Ownership transferred to governance (future)
│
├── GameRewards.sol
│   ├── Manages daily leaderboard payouts
│   ├── Authorized to mint 8BIT
│   ├── Distributes 50K tokens daily
│   └── Trustless automation
│
├── TokenSale.sol
│   ├── Presale contract
│   ├── Accepts USDC/ETH
│   ├── Fixed price: $0.0005
│   └── Automatic distribution
│
├── TournamentManager.sol
│   ├── Creates and manages tournaments
│   ├── Collects 8BIT entry fees
│   ├── Burns 50% of fees (deflationary)
│   ├── Distributes prizes from 50% pool
│   └── Enforces tournament rules
│
└── VestedAirdrop.sol
    ├── Merkle tree-based airdrop claims
    ├── 10M tokens for testnet participants
    ├── 3-month vesting (33.33% per month)
    ├── 90-day claim window
    └── Treasury recovery of unclaimed tokens
```

## Network Details

### Arbitrum One Deployment

| Parameter | Value |
|-----------|-------|
| **Network** | Arbitrum One (Layer 2) |
| **Chain ID** | 42161 |
| **Block Explorer** | [arbiscan.io](https://arbiscan.io) |
| **RPC URL** | https://arb1.arbitrum.io/rpc |
| **Currency** | ETH (for gas) |

**Why Arbitrum:**
- ⚡ Ultra-fast (2-5 second finality)
- 💸 Ultra-cheap gas (~$0.10-$0.50)
- 🔐 Ethereum security
- 🎮 Perfect for high-frequency gaming

### Testnet Contracts (Arbitrum Sepolia)

**Currently Deployed:**
- EightBitToken: `0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d`
- GameRewards: `0x528c9130A05bEf9a9632FbB3D8735287A2e44a4E`
- TournamentManager: `0xe06C92f15F426b0f6Fccb66302790E533C5Dfbb7`
- TournamentPayments: `0x0606eDf5Fb1912160b700846C48a49800ae6A1ec` (deprecated)
- TournamentBuyback: `0x6F3eAF6FB7218340aF69f81e143A01507566a6A6`
- TokenSale: `0x057B1130dD6E8FcBc144bb34172e45293C6839fE`
- TreasuryGasManager: `0x39F49a46CAB85CF079Cde25EAE311A563d3952EC`
- TestnetFaucet: `0x25A4109083f882FCFbC9Ea7cE5Cd942dbae38952`
- VestedAirdrop: TBD (pending deployment)

### Mainnet Contracts (Arbitrum One)

> 🚧 **Contracts not yet deployed.** Addresses will be announced before presale launch.

**Verification:**
- All contracts verified on Arbiscan
- Source code publicly viewable
- Readable by anyone
- No hidden code

## Contract Interactions

### For Players

**Daily Gameplay:**
```
1. Player plays game
2. Achieves high score
3. Submits score (tx sent to GameRewards contract)
4. Contract validates and records
5. At 00:00 UTC, contract calculates top 10
6. Contract mints rewards
7. Rewards sent to player wallets
```

**Tournament Entry:**
```
1. Player approves 8BIT spend
2. Enters tournament (TournamentManager)
3. Pays 8BIT entry fee
4. TournamentManager splits fee:
   - 50% to prize pool
   - 50% burned (deflationary)
5. Winner receives prize pool
```

### For Token Holders

**Buying 8BIT:**
```
1. During presale:
   - Interact with TokenSale contract
   - Send USDC/ETH
   - Receive 8BIT immediately

2. After launch:
   - Swap on Uniswap V3
   - Trade 8BIT/USDC pair
   - Instant settlement
```

**Future (Staking):**
```
1. Approve 8BIT spend
2. Call stake() function
3. Lock tokens for period
4. Earn rewards automatically
5. Withdraw after lock expires
```

## Security Model

### Access Control

**EightBitToken:**
- Owner can mint (for rewards only)
- Owner can transfer ownership
- No other special powers
- Cannot freeze/blacklist

**GameRewards:**
- Only authorized addresses can trigger payouts
- Multi-sig for authorization changes
- Timelock for critical functions
- Emergency pause (requires multi-sig)

**TournamentManager:**
- Owner can create tournaments
- Owner can modify templates
- Cannot modify active tournaments
- Cannot steal funds

**TournamentBuyback:**
- Fully automated
- No owner controls mid-execution
- Burns are irreversible
- Transparent on-chain

### Upgrade Strategy

**Current Contracts:**
- NOT upgradeable (by design)
- Immutable code
- Can't be changed after deployment
- Security through simplicity

**Future Strategy:**
- New features = new contracts
- Old contracts keep running
- Gradual migration
- User choice

**Why not upgradeable:**
- Eliminates rug pull risk
- No hidden backdoors
- Code is final
- Users can audit once

## Token Economics (Contract-Enforced)

### Minting Rules

**Hardcoded limits:**
- Max supply: 500,000,000 8BIT
- Initial mint: 100,000,000 8BIT (20%)
- Rewards pool: 150,000,000 8BIT (30%)
- Staking pool: 50,000,000 8BIT (10%)
- Cannot exceed max supply (enforced by code)

**Minting schedule:**
```solidity
// Simplified example
uint256 constant DAILY_REWARDS = 50_000 * 10**18; // 50K tokens
uint256 constant DISTRIBUTION_DAYS = 1825; // 5 years
uint256 constant MAX_REWARDS = DAILY_REWARDS * DISTRIBUTION_DAYS; // 150M

// Mint function checks
require(totalMinted + amount <= MAX_REWARDS, "Exceeds reward cap");
```

### Burning Mechanism

**Permanent burns:**
```solidity
address constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

function burn(uint256 amount) external {
    _transfer(msg.sender, BURN_ADDRESS, amount);
    // Cannot be recovered - wallet has no private key
}
```

**Tournament burn flow:**
```solidity
// 1. Player pays 8BIT entry fee
function enterTournament(uint256 tournamentId) external {
    uint256 fee = getTournamentFee(tournamentId);

    // 2. Transfer 8BIT from player
    eightBitToken.transferFrom(msg.sender, address(this), fee);

    // 3. Burn 50% of fee
    uint256 burnAmount = fee / 2;
    eightBitToken.transfer(BURN_ADDRESS, burnAmount);

    // 4. Add 50% to prize pool
    tournaments[tournamentId].prizePool += (fee - burnAmount);
}
```

## Gas Costs

### Typical Transaction Costs

| Action | Gas Cost | USD Cost (@$0.50/tx) |
|--------|----------|---------------------|
| **Submit Score** | ~100,000 gas | ~$0.10 |
| **Enter Tournament** | ~150,000 gas | ~$0.15 |
| **Claim Rewards** | N/A (automatic) | $0 (platform pays) |
| **Approve 8BIT** | ~50,000 gas | ~$0.05 |

**Why so cheap:**
- Arbitrum L2 scalability
- Optimized contracts
- Batch processing where possible

**Platform covers:**
- Daily reward distributions
- Tournament prize payouts
- Automated burns

**Players pay:**
- Score submissions (planned)
- Tournament entries
- 8BIT token approvals

## Transparency & Verification

### Anyone Can Verify

**Check total supply:**
```
Visit: arbiscan.io
Search: 8BIT token contract
View: totalSupply() function
See: Current circulating supply
```

**Check rewards minted:**
```
View transfer events to GameRewards contract
Sum all mints
Verify against emission schedule
```

**Check burns:**
```
View burn address balance: 0x000...dead
See all tokens sent there
Verify burn transactions
```

**Check tournament fees:**
```
View TournamentBuyback contract
See USDC in, 8BIT out
Verify Uniswap swaps
Verify burns
```

### Auditing Tools

**Block Explorers:**
- [Arbiscan](https://arbiscan.io) - Official Arbitrum explorer
- [Etherscan](https://etherscan.io) - Also supports Arbitrum

**Analytics:**
- [Dune Analytics](https://dune.com) - Community dashboards
- [8-Bit Arcade Dashboard](https://8bitarcade.games/analytics) - Official analytics

**DeFi Tools:**
- [DexScreener](https://dexscreener.com) - Token price and liquidity
- [DexTools](https://www.dextools.io) - Trading analytics
- [UniswapInfo](https://info.uniswap.org) - Pool statistics

## Emergency Procedures

### Circuit Breakers

**If critical bug discovered:**

1. **Pause Functionality** (if implemented)
   - Multi-sig required
   - Halts new actions
   - Existing funds safe
   - Community notified

2. **Investigation**
   - Security team reviews
   - Impact assessed
   - Fix developed
   - Audit performed

3. **Resolution**
   - New contract deployed (if needed)
   - Migration path announced
   - Users given time to migrate
   - Old contract deprecated

**Note:** Most contracts are NOT pauseable by design. Emergency procedures vary by contract.

### Multi-Sig Protection

**Critical functions protected by multi-sig:**
- Minting new rewards (requires 3 of 5)
- Changing authorized contracts (3 of 5)
- Emergency pause (if exists) (3 of 5)
- Treasury management (3 of 5)

**Signers:**
- Team members (publicly identified)
- Community representatives (elected, Phase 4)
- Security partners

## Contract Audits

### Pre-Launch Audits

> 🚧 **Audits in progress**

**Planned audits:**
- Internal review (completed)
- Community review (open source, ongoing)
- Professional audit (scheduled before launch)

**Audit scope:**
- All contracts
- Integration testing
- Economic model review
- Security best practices

**Results:**
- Published on website
- Shared with community
- Issues fixed before launch

### Ongoing Security

**Post-launch:**
- Bug bounty program
- Continuous monitoring
- Community testing
- Regular reviews

## Developer Resources

### Contract Source Code

**GitHub Repository:**
- [github.com/8bitarcade/contracts](https://github.com/JayB77/8BitArcade)
- Fully open source
- Commented code
- Unit tests included
- Deployment scripts

### Integration Guide

**For developers building on 8-Bit Arcade:**

1. **Read Contract ABIs**
   - Available on Arbiscan
   - Also in GitHub repo
   - Import into your code

2. **Interact with Contracts**
   - Use ethers.js or web3.js
   - Example code in repo
   - Testnets available for testing

3. **Listen to Events**
   - Score submissions
   - Reward distributions
   - Tournament actions
   - Build custom dashboards

### Testnets

**Before mainnet:**
- Arbitrum Sepolia testnet
- Test all functionality
- No real money
- Same contracts as mainnet

## Frequently Asked Questions

**Q: Can the team mint unlimited tokens?**
A: No. Max supply is hardcoded at 500M. Cannot be exceeded.

**Q: Can the team pause trading?**
A: No. ERC-20 token has no pause function. Trades always work.

**Q: Can contracts be upgraded?**
A: No. Current contracts are immutable. New features = new contracts.

**Q: What if there's a bug?**
A: Audits minimize risk. If found, new contract deployed, migration announced.

**Q: Who controls the contracts?**
A: Initially team (multi-sig). Later community governance (Phase 4).

**Q: Are rewards guaranteed?**
A: Yes, as long as contracts have minting authority and haven't reached cap.

**Q: Can burns be reversed?**
A: No. Burn address has no private key. Tokens gone forever.

**Q: How do I verify contract code?**
A: Visit Arbiscan, search contract address, click "Contract" tab, read code.

## Next Steps

- [EightBitToken Contract](eight-bit-token.md) - Token details
- [GameRewards Contract](game-rewards.md) - Reward distribution
- [Security & Audits](security.md) - Security measures
- [Start Playing](https://play.8bitarcade.games) - Use the contracts!

---

*All contracts are open source, verified on Arbiscan, and publicly auditable. Trust through transparency.*
