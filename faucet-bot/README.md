# 8-Bit Arcade Faucet Bot

Discord bot that dispenses Arbitrum Sepolia testnet ETH.

## Features

- `/faucet <wallet>` - Request 0.005 ETH
- Checks if user has < 0.003 ETH before sending
- 24-hour cooldown per Discord user
- Uses 8bit-token.png branding
- Tracks all requests in Firebase

## Setup

### 1. Create Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application → "8-Bit Faucet"
3. Go to Bot tab → Add Bot
4. Copy the **Bot Token**
5. Get **Client ID** from OAuth2 tab

### 2. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create new project (or use existing)
3. Go to Project Settings → Service Accounts
4. Click "Generate new private key"
5. Save as `service-account.json` in this folder

### 3. Fund the Faucet Wallet

1. Create a new wallet (or use existing)
2. Get the private key
3. Fund it with Arbitrum Sepolia ETH from:
   - https://faucet.quicknode.com/arbitrum/sepolia
   - https://www.alchemy.com/faucets/arbitrum-sepolia

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_server_id
FAUCET_CHANNEL_ID=optional_channel_id
FAUCET_PRIVATE_KEY=your_faucet_wallet_private_key
```

### 5. Invite Bot to Server

Use this URL (replace CLIENT_ID):
```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2048&scope=bot%20applications.commands
```

### 6. (Optional) Restrict to Channel

To restrict the faucet to a specific channel:
1. Right-click the channel → Copy Channel ID
2. Add to `.env`: `FAUCET_CHANNEL_ID=your_channel_id`

### 7. Install & Run

```bash
npm install
npm run register  # Register slash commands (once)
npm start         # Start bot
```

## Commands

| Command | Description |
|---------|-------------|
| `/faucet <wallet>` | Request testnet ETH |
| `/faucet-balance` | Check faucet status |

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `FAUCET_AMOUNT` | 0.005 | ETH to send per request |
| `MIN_BALANCE_THRESHOLD` | 0.003 | Max balance to qualify |
| `COOLDOWN_HOURS` | 24 | Hours between requests |

## Firebase Collections

The bot creates one collection:

**`faucet_requests`** - Tracks all requests
- `discordId` - Discord user ID
- `discordUsername` - Username
- `walletAddress` - Recipient wallet
- `lastRequestAt` - Timestamp
- `lastTxHash` - Transaction hash
- `totalRequests` - Count

## Hosting

For production hosting options:
- **Railway** - Easy deploy
- **Render** - Free tier
- **Firebase Functions** - Could be adapted

Using PM2:
```bash
npm install -g pm2
pm2 start src/index.js --name "faucet-bot"
pm2 save
pm2 startup
```
