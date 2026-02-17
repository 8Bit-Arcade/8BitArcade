# NFT Achievement Badges

> **Status:** Live on Arbitrum Sepolia Testnet

## Overview

8-Bit Arcade features an on-chain achievement system that rewards players with soulbound NFT badges. There are 20 achievements across multiple categories — 15 visible and 5 hidden. Each badge is minted as an ERC-721 NFT directly to your wallet.

## How It Works

1. **Play games** and hit milestones (high scores, streaks, tournaments, etc.)
2. **Automatic detection** — our backend checks all player progress every hour
3. **Auto-mint** — when you qualify, a soulbound badge NFT is minted to your wallet
4. **Zero gas fees** — all minting costs are covered by 8-Bit Arcade
5. **No claiming needed** — badges appear in your wallet automatically

You can also earn badges by linking your wallet through our Discord or Telegram bots. All linked wallets are checked every hour.

## Achievement Categories

### Score (4 badges)
Hit specific high scores in individual games. Examples include scoring 25,000 in Space Rocks or 50,000 in Galaxy Fighter.

### Games Played (2 badges)
Play a total number of games across all titles. Milestones at 10 and 1,000 games.

### Wins (1 badge)
Win 10 tournaments to earn the Tournament Champion badge.

### Streak (2 badges)
Play on consecutive days. Milestones at 7 days (Week Warrior) and 100 days (Century Club).

### Collection / Tier Badges (3 badges)
Earn enough achievement badges to unlock tier ranks:

| Tier | Badges Required | 8BIT Reward |
|------|----------------|-------------|
| **8Bit Gamer** | 10 | 500 8BIT |
| **8Bit Prodigy** | 15 | 2,000 8BIT |
| **8Bit God** | 18 | 25,000 8BIT |

### Special (3 badges)
- **Early Adopter** — Be among the first 100 players
- **Game Explorer** — Play all 12 games at least once
- **OG Member** — Verified OG community member

### Hidden (5 badges)
Five secret achievements that show as "???" until you earn them. Keep playing to discover them.

## Token Rewards

Every achievement badge comes with an 8BIT token reward, ranging from 50 8BIT to 25,000 8BIT depending on difficulty. Token rewards are minted automatically alongside the badge.

## Soulbound (Non-Transferable)

Achievement badges are **soulbound** — they cannot be transferred or sold. They serve as permanent proof of your accomplishments and stay with your wallet forever. This prevents achievement farming and ensures badges reflect genuine player skill.

## Smart Contracts

The achievement system uses three smart contracts on Arbitrum:

| Contract | Address | Purpose |
|----------|---------|---------|
| **AchievementBadges** | [`0xf70C7814C44D9f93Ab35c77a73f584e114783314`](https://sepolia.arbiscan.io/address/0xf70C7814C44D9f93Ab35c77a73f584e114783314) | Soulbound ERC-721 badge NFTs |
| **TradeableItems** | [`0x3F09919fba62EAec1295F577D92fbF2555247c44`](https://sepolia.arbiscan.io/address/0x3F09919fba62EAec1295F577D92fbF2555247c44) | Future tradeable NFT items |
| **AchievementManager** | [`0xcD7b55b846b5FC306ab1B4D2f30FBd3073315e84`](https://sepolia.arbiscan.io/address/0xcD7b55b846b5FC306ab1B4D2f30FBd3073315e84) | Goal tracking, verification, and minting coordinator |

All badge metadata and images are stored on IPFS via Pinata for permanent decentralized storage.

## FAQ

**Do I need to claim my badges?**
No. Badges are minted automatically when you qualify. Check the NFT page to see your progress.

**Do I pay gas?**
No. 8-Bit Arcade covers all minting costs.

**How often are achievements checked?**
Every hour. If you just hit a milestone, your badge will arrive within the next hour.

**Can I sell my badges?**
No. Achievement badges are soulbound and cannot be transferred. They are permanent proof of your accomplishments.

**What are the hidden achievements?**
That would ruin the surprise. Keep playing and experimenting — you might unlock one when you least expect it.

**I linked my wallet via Discord/Telegram. Will I get badges?**
Yes. All wallets linked through our Discord bot, Telegram bot, or the website are checked every hour.
