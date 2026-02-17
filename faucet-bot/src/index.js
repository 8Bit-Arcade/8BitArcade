require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { ethers } = require('ethers');
const admin = require('firebase-admin');
const path = require('path');

// ============================================
// Configuration
// ============================================
const CONFIG = {
  discord: {
    token: process.env.DISCORD_BOT_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.DISCORD_GUILD_ID,
    faucetChannelId: process.env.FAUCET_CHANNEL_ID || null,
  },
  faucet: {
    privateKey: process.env.FAUCET_PRIVATE_KEY,
    amount: process.env.FAUCET_AMOUNT || '0.01',
    minBalanceThreshold: process.env.MIN_BALANCE_THRESHOLD || '0.002',
    cooldownHours: parseInt(process.env.COOLDOWN_HOURS || '24'),
  },
  network: {
    name: 'Arbitrum Sepolia',
    chainId: 421614,
    rpcUrl: 'https://sepolia-rollup.arbitrum.io/rpc',
    explorerUrl: 'https://sepolia.arbiscan.io',
  },
  images: {
    token: 'https://8bitarcade.games/images/8bit-token.png',
  },
};

// ============================================
// Firebase Setup
// ============================================
let db;

function initFirebase() {
  if (admin.apps.length === 0) {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT || './service-account.json';

    try {
      const serviceAccount = require(path.resolve(serviceAccountPath));
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('✅ Firebase initialized');
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error.message);
      console.log('   Make sure service-account.json exists in faucet-bot folder');
      process.exit(1);
    }
  }

  db = admin.firestore();
  return db;
}

// ============================================
// Ethereum Setup
// ============================================
const provider = new ethers.providers.JsonRpcProvider(CONFIG.network.rpcUrl);
let faucetWallet;

function initWallet() {
  if (!CONFIG.faucet.privateKey) {
    console.error('❌ FAUCET_PRIVATE_KEY not set in .env');
    process.exit(1);
  }

  faucetWallet = new ethers.Wallet(CONFIG.faucet.privateKey, provider);
  console.log(`✅ Faucet wallet: ${faucetWallet.address}`);
  return faucetWallet;
}

// ============================================
// Helper Functions
// ============================================

// Check if user can request (24h cooldown)
async function canUserRequest(discordId) {
  const doc = await db.collection('faucet_requests').doc(discordId).get();

  if (!doc.exists) {
    return { canRequest: true };
  }

  const data = doc.data();
  const lastRequest = data.lastRequestAt?.toDate();

  if (!lastRequest) {
    return { canRequest: true };
  }

  const hoursSinceLastRequest = (Date.now() - lastRequest.getTime()) / (1000 * 60 * 60);

  if (hoursSinceLastRequest >= CONFIG.faucet.cooldownHours) {
    return { canRequest: true };
  }

  const hoursRemaining = CONFIG.faucet.cooldownHours - hoursSinceLastRequest;
  const nextRequestTime = new Date(lastRequest.getTime() + CONFIG.faucet.cooldownHours * 60 * 60 * 1000);

  return {
    canRequest: false,
    hoursRemaining: hoursRemaining.toFixed(1),
    nextRequestTime,
  };
}

// Record a faucet request
async function recordRequest(discordId, discordUsername, walletAddress, txHash, amount) {
  await db.collection('faucet_requests').doc(discordId).set({
    discordId,
    discordUsername,
    walletAddress,
    lastRequestAt: admin.firestore.FieldValue.serverTimestamp(),
    lastTxHash: txHash,
    lastAmount: amount,
    totalRequests: admin.firestore.FieldValue.increment(1),
  }, { merge: true });
}

// Check wallet balance
async function getBalance(address) {
  const balance = await provider.getBalance(address);
  return ethers.utils.formatEther(balance);
}

// Send ETH from faucet
async function sendEth(toAddress, amount) {
  const tx = await faucetWallet.sendTransaction({
    to: toAddress,
    value: ethers.utils.parseEther(amount),
  });

  const receipt = await tx.wait();
  return { tx, receipt };
}

// ============================================
// Discord Bot
// ============================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
  ]
});

client.once('ready', async () => {
  console.log(`🚰 8-Bit Arcade Faucet Bot online as ${client.user.tag}`);

  // Show faucet balance
  const balance = await getBalance(faucetWallet.address);
  console.log(`💰 Faucet balance: ${balance} ETH`);

  if (parseFloat(balance) < parseFloat(CONFIG.faucet.amount)) {
    console.warn('⚠️  Warning: Faucet balance is low!');
  }

  client.user.setActivity('Arbitrum Sepolia Faucet | /faucet', { type: 3 });
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'faucet') {
    await handleFaucet(interaction);
  } else if (commandName === 'faucet-balance') {
    await handleFaucetBalance(interaction);
  }
});

// /faucet command
async function handleFaucet(interaction) {
  // Check if in correct channel (if configured)
  if (CONFIG.discord.faucetChannelId && interaction.channelId !== CONFIG.discord.faucetChannelId) {
    return interaction.reply({
      content: `❌ This command can only be used in <#${CONFIG.discord.faucetChannelId}>`,
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const walletAddress = interaction.options.getString('wallet');
  const discordId = interaction.user.id;
  const discordUsername = interaction.user.username;

  // Validate wallet address
  if (!ethers.utils.isAddress(walletAddress)) {
    return interaction.editReply({
      embeds: [createErrorEmbed('Invalid wallet address. Please provide a valid Ethereum address (0x...)')]
    });
  }

  try {
    // Check 24h cooldown
    const cooldownCheck = await canUserRequest(discordId);

    if (!cooldownCheck.canRequest) {
      const embed = new EmbedBuilder()
        .setColor('#ff6600')
        .setTitle('⏰ Cooldown Active')
        .setDescription(`You can request again in **${cooldownCheck.hoursRemaining} hours**`)
        .addFields({
          name: 'Next Request Available',
          value: `<t:${Math.floor(cooldownCheck.nextRequestTime.getTime() / 1000)}:R>`,
        })
        .setThumbnail(CONFIG.images.token)
        .setFooter({ text: '8-Bit Arcade Faucet' });

      return interaction.editReply({ embeds: [embed] });
    }

    // Check user's current balance
    const userBalance = await getBalance(walletAddress);
    const threshold = parseFloat(CONFIG.faucet.minBalanceThreshold);

    if (parseFloat(userBalance) >= threshold) {
      const embed = new EmbedBuilder()
        .setColor('#ff6600')
        .setTitle('💰 Balance Too High')
        .setDescription(`Your wallet already has **${parseFloat(userBalance).toFixed(4)} ETH**`)
        .addFields({
          name: 'Requirement',
          value: `You need less than **${threshold} ETH** to use the faucet`,
        })
        .setThumbnail(CONFIG.images.token)
        .setFooter({ text: '8-Bit Arcade Faucet' });

      return interaction.editReply({ embeds: [embed] });
    }

    // Check faucet balance
    const faucetBalance = await getBalance(faucetWallet.address);

    if (parseFloat(faucetBalance) < parseFloat(CONFIG.faucet.amount)) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('🚫 Faucet Empty')
        .setDescription('The faucet is currently empty. Please try again later or contact an admin.')
        .setThumbnail(CONFIG.images.token)
        .setFooter({ text: '8-Bit Arcade Faucet' });

      return interaction.editReply({ embeds: [embed] });
    }

    // Send ETH
    const sendingEmbed = new EmbedBuilder()
      .setColor('#00d4ff')
      .setTitle('🚰 Sending ETH...')
      .setDescription('Please wait while we process your request...')
      .setThumbnail(CONFIG.images.token);

    await interaction.editReply({ embeds: [sendingEmbed] });

    const { tx, receipt } = await sendEth(walletAddress, CONFIG.faucet.amount);

    // Record the request
    await recordRequest(discordId, discordUsername, walletAddress, tx.hash, CONFIG.faucet.amount);

    // Success embed
    const successEmbed = new EmbedBuilder()
      .setColor('#00ff88')
      .setTitle('✅ ETH Sent!')
      .setDescription(`Successfully sent **${CONFIG.faucet.amount} ETH** to your wallet!`)
      .addFields(
        { name: '📬 Wallet', value: `\`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\``, inline: true },
        { name: '💎 Amount', value: `${CONFIG.faucet.amount} ETH`, inline: true },
        { name: '🔗 Transaction', value: `[View on Arbiscan](${CONFIG.network.explorerUrl}/tx/${tx.hash})`, inline: false }
      )
      .setThumbnail(CONFIG.images.token)
      .setFooter({ text: '8-Bit Arcade Faucet • Come back in 24 hours!' })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });

    console.log(`✅ Sent ${CONFIG.faucet.amount} ETH to ${walletAddress} (${discordUsername})`);

  } catch (error) {
    console.error('Faucet error:', error);

    let errorMessage = 'An error occurred while processing your request.';

    if (error.code === 'INSUFFICIENT_FUNDS') {
      errorMessage = 'Faucet wallet has insufficient funds.';
    } else if (error.code === 'NETWORK_ERROR') {
      errorMessage = 'Network error. Please try again.';
    }

    await interaction.editReply({
      embeds: [createErrorEmbed(errorMessage)]
    });
  }
}

// /faucet-balance command (check faucet status)
async function handleFaucetBalance(interaction) {
  const faucetBalance = await getBalance(faucetWallet.address);
  const dripAmount = parseFloat(CONFIG.faucet.amount);
  const dripsRemaining = Math.floor(parseFloat(faucetBalance) / dripAmount);

  const embed = new EmbedBuilder()
    .setColor('#00d4ff')
    .setTitle('🚰 Faucet Status')
    .addFields(
      { name: '💰 Balance', value: `${parseFloat(faucetBalance).toFixed(4)} ETH`, inline: true },
      { name: '💧 Drip Amount', value: `${CONFIG.faucet.amount} ETH`, inline: true },
      { name: '📊 Drips Remaining', value: `~${dripsRemaining}`, inline: true },
      { name: '⏰ Cooldown', value: `${CONFIG.faucet.cooldownHours} hours`, inline: true },
      { name: '📋 Min Balance Req', value: `< ${CONFIG.faucet.minBalanceThreshold} ETH`, inline: true },
      { name: '🔗 Network', value: CONFIG.network.name, inline: true }
    )
    .setThumbnail(CONFIG.images.token)
    .setFooter({ text: '8-Bit Arcade Faucet' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

// Helper to create error embed
function createErrorEmbed(message) {
  return new EmbedBuilder()
    .setColor('#ff0000')
    .setTitle('❌ Error')
    .setDescription(message)
    .setThumbnail(CONFIG.images.token)
    .setFooter({ text: '8-Bit Arcade Faucet' });
}

// ============================================
// Start Bot
// ============================================
initFirebase();
initWallet();
client.login(CONFIG.discord.token);
