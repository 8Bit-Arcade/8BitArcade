import { Telegraf, Context } from 'telegraf';
import { initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require('../serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount as ServiceAccount),
});

const db = getFirestore();

// Initialize Telegram Bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// Store for pending wallet links (telegramId -> verification code)
const pendingLinks: Map<string, { code: string; expires: number }> = new Map();

// Points thresholds (similar to Discord)
const TELEGRAM_POINTS = {
  LINKED: 5,           // Base points for linking wallet
  ACTIVE_50: 25,       // 50+ messages
  ACTIVE_200: 50,      // 200+ messages
  ACTIVE_500: 100,     // 500+ messages
};

/**
 * Track message activity
 */
bot.on('message', async (ctx) => {
  try {
    const userId = ctx.from?.id.toString();
    const chatId = ctx.chat?.id.toString();
    const username = ctx.from?.username || ctx.from?.first_name || 'Unknown';

    if (!userId || !chatId) return;

    // Only track group messages (not DMs for privacy)
    if (ctx.chat?.type === 'private') return;

    // Update message count in Firebase
    const activityRef = db.collection('telegram_activity').doc(userId);

    await activityRef.set({
      odedId: userId,
      username,
      messageCount: FieldValue.increment(1),
      lastMessage: FieldValue.serverTimestamp(),
      chatId,
    }, { merge: true });

    // console.log(`Tracked message from ${username} (${userId})`);
  } catch (error) {
    console.error('Error tracking message:', error);
  }
});

/**
 * /start command - Welcome message
 */
bot.command('start', async (ctx) => {
  const welcomeMessage = `
Welcome to 8-Bit Arcade!

I track your activity in this group for the airdrop.

Commands:
/link <wallet> - Link your wallet address
/status - Check your activity stats
/points - See your airdrop points breakdown
/help - Show this message

Link your wallet to earn airdrop points!
  `;

  await ctx.reply(welcomeMessage);
});

/**
 * /help command
 */
bot.command('help', async (ctx) => {
  const helpMessage = `
8-Bit Arcade Telegram Bot

Commands:
/link <wallet> - Link your Ethereum wallet (0x...)
/unlink - Remove your wallet link
/status - Check your message count and stats
/points - See your estimated airdrop points
/verify <code> - Verify wallet link with code from dapp

Earn points by:
- Linking your wallet: +5 points
- 50+ messages: +25 points
- 200+ messages: +50 points
- 500+ messages: +100 points

Questions? Join our Discord!
  `;

  await ctx.reply(helpMessage);
});

/**
 * /link command - Link wallet to Telegram account
 */
bot.command('link', async (ctx) => {
  const userId = ctx.from?.id.toString();
  const username = ctx.from?.username || ctx.from?.first_name || 'Unknown';

  if (!userId) {
    await ctx.reply('Error: Could not identify your account.');
    return;
  }

  // Extract wallet from message
  const args = ctx.message.text.split(' ').slice(1);
  const wallet = args[0]?.toLowerCase();

  if (!wallet) {
    await ctx.reply('Please provide your wallet address.\n\nUsage: /link 0x1234...');
    return;
  }

  // Validate wallet format
  if (!wallet.startsWith('0x') || wallet.length !== 42) {
    await ctx.reply('Invalid wallet address. Must be a valid Ethereum address (0x... 42 characters).');
    return;
  }

  try {
    // Check if wallet is already linked to another account
    const existingLink = await db.collection('telegram_links')
      .where('walletAddress', '==', wallet)
      .limit(1)
      .get();

    if (!existingLink.empty && existingLink.docs[0].id !== userId) {
      await ctx.reply('This wallet is already linked to another Telegram account.');
      return;
    }

    // Check if this Telegram is already linked to a different wallet
    const currentLink = await db.collection('telegram_links').doc(userId).get();
    if (currentLink.exists && currentLink.data()?.walletAddress !== wallet) {
      await ctx.reply(
        `Your account is already linked to ${currentLink.data()?.walletAddress.slice(0, 6)}...${currentLink.data()?.walletAddress.slice(-4)}\n\n` +
        'Use /unlink first to remove the existing link.'
      );
      return;
    }

    // Create the link
    await db.collection('telegram_links').doc(userId).set({
      odedId: userId,
      username,
      walletAddress: wallet,
      linkedAt: FieldValue.serverTimestamp(),
    });

    // Also store by wallet for quick lookup
    await db.collection('telegram_users').doc(wallet).set({
      odedId: userId,
      username,
      linkedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Copy over any existing activity
    const activityDoc = await db.collection('telegram_activity').doc(userId).get();
    if (activityDoc.exists) {
      const activity = activityDoc.data();
      await db.collection('telegram_users').doc(wallet).set({
        messageCount: activity?.messageCount || 0,
        lastMessage: activity?.lastMessage || null,
      }, { merge: true });
    }

    await ctx.reply(
      `Wallet linked successfully!\n\n` +
      `Wallet: ${wallet.slice(0, 6)}...${wallet.slice(-4)}\n` +
      `Telegram: @${username}\n\n` +
      `Your Telegram activity will now count towards your airdrop!`
    );

    console.log(`Linked wallet ${wallet} to Telegram user ${userId} (@${username})`);
  } catch (error) {
    console.error('Error linking wallet:', error);
    await ctx.reply('Error linking wallet. Please try again later.');
  }
});

/**
 * /unlink command - Remove wallet link
 */
bot.command('unlink', async (ctx) => {
  const userId = ctx.from?.id.toString();

  if (!userId) {
    await ctx.reply('Error: Could not identify your account.');
    return;
  }

  try {
    const linkDoc = await db.collection('telegram_links').doc(userId).get();

    if (!linkDoc.exists) {
      await ctx.reply('Your account is not linked to any wallet.');
      return;
    }

    const wallet = linkDoc.data()?.walletAddress;

    // Remove both link documents
    await db.collection('telegram_links').doc(userId).delete();
    if (wallet) {
      await db.collection('telegram_users').doc(wallet).delete();
    }

    await ctx.reply('Wallet unlinked successfully. Your activity will no longer count towards the airdrop.');
  } catch (error) {
    console.error('Error unlinking wallet:', error);
    await ctx.reply('Error unlinking wallet. Please try again later.');
  }
});

/**
 * /status command - Show activity stats
 */
bot.command('status', async (ctx) => {
  const userId = ctx.from?.id.toString();

  if (!userId) {
    await ctx.reply('Error: Could not identify your account.');
    return;
  }

  try {
    const activityDoc = await db.collection('telegram_activity').doc(userId).get();
    const linkDoc = await db.collection('telegram_links').doc(userId).get();

    const messageCount = activityDoc.data()?.messageCount || 0;
    const isLinked = linkDoc.exists;
    const wallet = linkDoc.data()?.walletAddress;

    let statusMessage = `Your 8-Bit Arcade Stats\n\n`;
    statusMessage += `Messages: ${messageCount}\n`;
    statusMessage += `Wallet: ${isLinked ? `${wallet?.slice(0, 6)}...${wallet?.slice(-4)}` : 'Not linked'}\n\n`;

    if (!isLinked) {
      statusMessage += `Link your wallet with /link <wallet> to earn airdrop points!`;
    } else {
      // Calculate points
      let points = TELEGRAM_POINTS.LINKED;
      if (messageCount >= 500) {
        points += TELEGRAM_POINTS.ACTIVE_500;
      } else if (messageCount >= 200) {
        points += TELEGRAM_POINTS.ACTIVE_200;
      } else if (messageCount >= 50) {
        points += TELEGRAM_POINTS.ACTIVE_50;
      }
      statusMessage += `Estimated Points: ${points}`;
    }

    await ctx.reply(statusMessage);
  } catch (error) {
    console.error('Error getting status:', error);
    await ctx.reply('Error fetching status. Please try again later.');
  }
});

/**
 * /points command - Show points breakdown
 */
bot.command('points', async (ctx) => {
  const userId = ctx.from?.id.toString();

  if (!userId) {
    await ctx.reply('Error: Could not identify your account.');
    return;
  }

  try {
    const activityDoc = await db.collection('telegram_activity').doc(userId).get();
    const linkDoc = await db.collection('telegram_links').doc(userId).get();

    const messageCount = activityDoc.data()?.messageCount || 0;
    const isLinked = linkDoc.exists;

    if (!isLinked) {
      await ctx.reply(
        'Your wallet is not linked!\n\n' +
        'Link your wallet with /link <wallet> to earn airdrop points.\n\n' +
        `Current messages: ${messageCount}`
      );
      return;
    }

    let breakdown = `Airdrop Points Breakdown\n\n`;
    let totalPoints = 0;

    // Linked bonus
    breakdown += `Wallet Linked: +${TELEGRAM_POINTS.LINKED}\n`;
    totalPoints += TELEGRAM_POINTS.LINKED;

    // Activity bonus
    breakdown += `Messages (${messageCount}): `;
    if (messageCount >= 500) {
      breakdown += `+${TELEGRAM_POINTS.ACTIVE_500}\n`;
      totalPoints += TELEGRAM_POINTS.ACTIVE_500;
    } else if (messageCount >= 200) {
      breakdown += `+${TELEGRAM_POINTS.ACTIVE_200}\n`;
      totalPoints += TELEGRAM_POINTS.ACTIVE_200;
    } else if (messageCount >= 50) {
      breakdown += `+${TELEGRAM_POINTS.ACTIVE_50}\n`;
      totalPoints += TELEGRAM_POINTS.ACTIVE_50;
    } else {
      breakdown += `+0 (need 50+ msgs)\n`;
    }

    breakdown += `\nTotal Telegram Points: ${totalPoints}\n\n`;
    breakdown += `These points combine with your game, Discord, and Zealy activity!`;

    await ctx.reply(breakdown);
  } catch (error) {
    console.error('Error getting points:', error);
    await ctx.reply('Error fetching points. Please try again later.');
  }
});

/**
 * /stats command (admin) - Show group stats
 */
bot.command('stats', async (ctx) => {
  // Only allow in groups
  if (ctx.chat?.type === 'private') {
    await ctx.reply('This command only works in groups.');
    return;
  }

  try {
    const linksSnapshot = await db.collection('telegram_links').get();
    const activitySnapshot = await db.collection('telegram_activity').get();

    const linkedCount = linksSnapshot.size;
    const totalMessages = activitySnapshot.docs.reduce(
      (sum, doc) => sum + (doc.data()?.messageCount || 0),
      0
    );
    const activeUsers = activitySnapshot.size;

    await ctx.reply(
      `8-Bit Arcade Telegram Stats\n\n` +
      `Active Users: ${activeUsers}\n` +
      `Linked Wallets: ${linkedCount}\n` +
      `Total Messages: ${totalMessages}`
    );
  } catch (error) {
    console.error('Error getting stats:', error);
    await ctx.reply('Error fetching stats.');
  }
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
});

// Start bot
bot.launch().then(() => {
  console.log('8-Bit Arcade Telegram Bot is running!');
});

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
