# Discord Webhook Setup for Winner Announcements

This guide explains how to set up automatic Discord notifications for daily reward distributions.

## Why Discord Webhooks?

Discord notifications provide **transparency and proof** that payouts are legitimate by:
- ✅ Posting winners' wallet addresses (not usernames) publicly
- ✅ Including blockchain transaction hash for verification
- ✅ Showing exact reward amounts distributed
- ✅ Linking directly to Arbiscan for on-chain proof

## Setup Steps

### 1. Create a Discord Webhook

1. Go to your Discord server
2. Right-click the channel where you want announcements (e.g., `#rewards` or `#announcements`)
3. Click **Edit Channel** → **Integrations** → **Webhooks**
4. Click **New Webhook**
5. Give it a name (e.g., "8-Bit Arcade Rewards Bot")
6. Optionally upload an avatar image
7. Click **Copy Webhook URL**

### 2. Configure Firebase Function

Add the webhook URL to your Firebase Functions config:

```bash
firebase functions:config:set discord.webhook_url="YOUR_WEBHOOK_URL_HERE"
```

**Example:**
```bash
firebase functions:config:set discord.webhook_url="https://discord.com/api/webhooks/123456789/abcdefghijklmnop"
```

### 3. Verify Configuration

Check that it's set correctly:

```bash
firebase functions:config:get
```

You should see:
```json
{
  "discord": {
    "webhook_url": "https://discord.com/api/webhooks/..."
  }
}
```

### 4. Deploy Functions

Deploy the updated reward distribution function:

```bash
cd functions
npm run build
firebase deploy --only functions:distributeDailyRewards
```

## What Gets Posted?

After each daily reward distribution, Discord will receive a message with:

### Example Message Format:

```
🎉 Daily rewards have been distributed!

🎮 Daily Winners - All Games
Day: 2025-01-15
Rewards distributed on-chain

🥇 Rank #1 - 12500 8BIT
CryptoGamer123
0x1234567890abcdef1234567890abcdef12345678
Score: 125,000

🥈 Rank #2 - 6250 8BIT
vitalik.eth
0xabcdef1234567890abcdef1234567890abcdef12
Score: 98,500

🥉 Rank #3 - 6250 8BIT
0xdef1234567890abcdef1234567890abcdef12345
Score: 87,300

... (top 10 players)

📋 Blockchain Proof
[View Transaction on Arbiscan](https://arbiscan.io/tx/0x...)

8-Bit Arcade • Transparent & Verifiable Rewards
```

**Display Names:**
- Shows each user's preferred display setting (username, ENS domain, or wallet address)
- Wallet address is ALWAYS shown for transparency and verification
- If a user has set a username or ENS, it appears above their address
- Users control their own display preference in the app settings

**How Display Preferences Work:**
1. System checks user's `displayPreference` setting in Firestore (`users` collection)
2. If set to `username` → shows their username (if they have one set)
3. If set to `ens` → shows their ENS domain (if they have one)
4. If set to `address` or no preference → shows wallet address only
5. Wallet address is ALWAYS included for verification, regardless of preference

## Security Notes

- ⚠️ **Never commit the webhook URL to git**
- ✅ Webhook URL is stored securely in Firebase config
- ✅ User display names shown based on their preference (username/ENS/address)
- ✅ Wallet addresses ALWAYS shown for transparency and verification
- ✅ Discord posting is non-critical - if it fails, rewards still distribute

## Testing

To test the webhook without waiting for daily distribution:

```bash
# Trigger manual distribution (testnet)
firebase functions:call manualDistributeRewards
```

Watch your Discord channel for the announcement!

## Customization

You can customize the Discord messages by editing:
- `/functions/src/notifications/discordWebhook.ts`

Available customizations:
- Embed colors
- Message format
- Which ranks to show (currently shows all top 10)
- Add game-specific channels
- Add custom emojis

## Per-Game Announcements

To post winners for each game separately (optional):

1. Modify the reward distribution to call per-game
2. Use `postWinnersToDiscord()` for each game individually
3. Set up multiple webhooks (one per game channel)

## Troubleshooting

**Webhook not posting:**
1. Check Firebase Functions logs: `firebase functions:log`
2. Verify webhook URL is correct: `firebase functions:config:get`
3. Test the webhook URL manually using curl:
   ```bash
   curl -X POST "YOUR_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d '{"content": "Test message"}'
   ```

**Discord says "Unknown Webhook":**
- Webhook was deleted or URL is incorrect
- Recreate the webhook and update Firebase config

## Rate Limits

Discord webhooks have rate limits:
- 30 requests per minute per webhook
- 5 requests per second per webhook

The current implementation respects these limits (1 post per daily distribution).

---

**Need Help?** Check Discord Developer Documentation: https://discord.com/developers/docs/resources/webhook
