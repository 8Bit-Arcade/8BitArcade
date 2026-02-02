# 8-Bit Arcade Telegram Bot

Tracks Telegram activity for the 8-Bit Arcade airdrop.

## Setup

### 1. Create a Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow the prompts
3. Copy the bot token

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your bot token:
```
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

### 3. Add Firebase Service Account

Option A: Place `serviceAccountKey.json` in this folder

Option B: Set as environment variable:
```
FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
```

### 4. Install & Run

```bash
npm install
npm run dev   # Development with hot reload
npm start     # Production
```

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Welcome message |
| `/help` | Show all commands |
| `/link <wallet>` | Link your wallet address |
| `/unlink` | Remove wallet link |
| `/status` | Check your activity stats |
| `/points` | See your airdrop points breakdown |
| `/stats` | Group stats (in group chats) |

## Points System

| Activity | Points |
|----------|--------|
| Link wallet | +5 |
| 50+ messages | +25 |
| 200+ messages | +50 |
| 500+ messages | +100 |

## Firebase Collections

- `telegram_activity` - Message counts by Telegram user ID
- `telegram_links` - Wallet links by Telegram user ID
- `telegram_users` - Activity data by wallet address (for airdrop lookup)

## Deployment

### Railway/Render/Fly.io

1. Set environment variables in dashboard
2. Deploy from Git

### VPS/Server

```bash
npm run build
npm start
```

Use PM2 for process management:
```bash
pm2 start dist/index.js --name telegram-bot
```

## Add Bot to Group

1. Add bot to your Telegram group
2. Make bot an admin (to read messages)
3. Bot will start tracking activity automatically
