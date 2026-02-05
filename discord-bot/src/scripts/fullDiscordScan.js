require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const firebase = require('../firebase');
const { GUILD_ID } = require('../config');

firebase.initFirebase();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

async function scan() {
  await client.login(process.env.DISCORD_BOT_TOKEN);
  console.log('🤖 Logged in');

  const guild = await client.guilds.fetch(GUILD_ID);
  if (!guild) {
    console.error('❌ Guild not found:', GUILD_ID);
    process.exit(1);
  }

  console.log('🏰 Guild loaded:', guild.name);

  const channels = guild.channels.cache.filter(c => c.isTextBased());
  console.log(`📡 Scanning ${channels.size} channels...`);

  const userCounts = new Map();

  for (const channel of channels.values()) {
    console.log(`🔍 Channel: #${channel.name}`);
    let lastId = null;

    while (true) {
      const messages = await channel.messages.fetch({
        limit: 100,
        before: lastId
      });

      if (messages.size === 0) break;

      for (const msg of messages.values()) {
        if (msg.author.bot) continue;

        const id = msg.author.id;
        userCounts.set(id, (userCounts.get(id) || 0) + 1);
      }

      lastId = messages.last().id;
    }
  }

  console.log(`📊 Users found: ${userCounts.size}`);
  console.log('💾 Writing to Firebase...');

  for (const [discordId, count] of userCounts.entries()) {
    await firebase.storeDiscordActivity(discordId, {
      discordId,
      messageCount: count,
      updatedAt: new Date()
    });
  }

  console.log('✅ Scan complete');
  process.exit(0);
}

scan();
