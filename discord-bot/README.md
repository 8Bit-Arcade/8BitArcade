# 8-Bit Arcade Discord Bot

Activity tracking, role management, and airdrop integration for 8-Bit Arcade.

## Features

- **Wallet Linking**: `/link <wallet>` - Connect Discord to wallet
- **Activity Tracking**: Automatic message counting for Discord roles
- **Game Roles**: Sync roles based on gameplay from Firebase
- **Holder Roles**: Check token balance for holder/whale roles
- **Airdrop Points**: Discord activity contributes to airdrop allocation
- **Retroactive Snapshot**: Admin command to scan message history

## Setup

### 1. Create Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" → Name it "8-Bit Arcade Bot"
3. Go to "Bot" tab → Click "Add Bot"
4. Enable these Privileged Gateway Intents:
   - SERVER MEMBERS INTENT
   - MESSAGE CONTENT INTENT
5. Copy the **Bot Token**

### 2. Get IDs

1. Enable Developer Mode in Discord (User Settings → Advanced → Developer Mode)
2. Right-click your server → "Copy Server ID" (this is GUILD_ID)
3. Copy the Application ID from Developer Portal (this is CLIENT_ID)

### 3. Create Roles in Discord

Create these roles **in this order** (top = highest priority):

| Role | Color |
|------|-------|
| 🥇 Tournament Victor | `#ffd700` |
| 🔥 Whale | `#ffd700` |
| 🏆 Leaderboard Legend | `#ffff00` |
| 💎 Token Holder | `#9933ff` |
| 👾 High Scorer | `#00ff88` |
| ⭐ OG Gamer | `#ff6600` |
| 🎖️ Arcade Veteran | `#ffff00` |
| 💪 Dedicated Player | `#00ff88` |
| 🔥 Getting Warmed Up | `#ff00ff` |
| 🎯 First Blood | `#00d4ff` |
| 🏅 Daily Top 10 | `#ff6600` |
| 🎮 Arcade Regular | `#ff00ff` |
| 🕹️ Player 1 | `#00d4ff` |

Right-click each role → "Copy Role ID"

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:
- `DISCORD_BOT_TOKEN` - Bot token from step 1
- `DISCORD_CLIENT_ID` - Application ID
- `DISCORD_GUILD_ID` - Server ID
- `ROLE_*` - All role IDs from step 3

### 5. Add Firebase Service Account

1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate new private key"
3. Save as `service-account.json` in the `discord-bot` folder

### 6. Invite Bot to Server

Use this URL (replace CLIENT_ID):
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=268437504&scope=bot%20applications.commands
```

Permissions needed:
- Manage Roles
- Send Messages
- Read Message History
- Use Slash Commands

### 7. Install & Run

```bash
cd discord-bot
npm install

# Register slash commands (run once)
npm run register

# Start bot
npm start

# Or for development (auto-restart on changes)
npm run dev
```

## Commands

| Command | Description | Who |
|---------|-------------|-----|
| `/link <wallet>` | Link wallet to Discord | Everyone |
| `/stats` | View your activity & points | Everyone |
| `/roles` | View all available roles | Everyone |
| `/sync` | Manually sync your roles | Everyone |
| `/leaderboard` | View Discord activity top 10 | Everyone |
| `/snapshot` | Scan history & assign roles | Admin only |

## Role Thresholds

### Discord Roles
- 🕹️ Player 1 - Join server
- 🎮 Arcade Regular - 50+ messages
- 👾 High Scorer - 200+ messages
- 🏆 Leaderboard Legend - 500+ messages
- ⭐ OG Gamer - Joined before mainnet

### Game Roles (requires linked wallet)
- 🎯 First Blood - 1+ games
- 🔥 Getting Warmed Up - 25+ games
- 💪 Dedicated Player - 100+ games
- 🎖️ Arcade Veteran - 500+ games
- 🏅 Daily Top 10 - Hit daily leaderboard
- 🥇 Tournament Victor - Win a tournament

### Holder Roles (requires linked wallet)
- 💎 Token Holder - Hold any 8BIT
- 🔥 Whale - Hold 100k+ 8BIT

## Airdrop Points

Discord activity contributes to airdrop allocation:
- Player 1: +5 points
- Arcade Regular: +25 points
- High Scorer: +50 points
- Leaderboard Legend: +100 points
- Game roles: +10 to +200 points
- Holder roles: +50 to +100 points

## Hosting

For production, consider:
- **Railway** - Easy Node.js hosting
- **Render** - Free tier available
- **DigitalOcean** - $5/month droplet
- **Your own server** - Use PM2 for process management

Example with PM2:
```bash
npm install -g pm2
pm2 start src/index.js --name "8bit-discord-bot"
pm2 save
pm2 startup
```
