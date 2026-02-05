const { Client, GatewayIntentBits } = require('discord.js');
const { initFirebase, storeDiscordActivity } = require('../firebase');
const { MESSAGE_THRESHOLDS, ROLES, GUILD_ID, DISCORD_TOKEN, OG_CUTOFF_DATE } = require('../config');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

(async () => {
  const db = initFirebase();

  await client.login(DISCORD_TOKEN);
  console.log('🤖 Logged in');

  const guild = await client.guilds.fetch(GUILD_ID);
  console.log(`🏰 Guild loaded: ${guild.name}`);

  const channels = guild.channels.cache.filter(c => c.isTextBased());
  const messageCounts = new Map();
  const joinDates = new Map();

  console.log(`📡 Scanning ${channels.size} channels...`);

  for (const channel of channels.values()) {
    console.log(`🔍 Channel: #${channel.name}`);
    let lastId = null;

    while (true) {
      const options = { limit: 100 };
      if (lastId) options.before = lastId;

      const messages = await channel.messages.fetch(options);
      if (messages.size === 0) break;

      for (const msg of messages.values()) {
        if (msg.author.bot) continue;

        const id = msg.author.id;
        messageCounts.set(id, (messageCounts.get(id) || 0) + 1);
      }

      lastId = messages.last().id;
    }
  }

  console.log(`📊 Users found: ${messageCounts.size}`);

  const members = await guild.members.fetch();

  for (const member of members.values()) {
    joinDates.set(member.id, member.joinedAt);
  }

  console.log('💾 Writing to Firebase...');

  for (const [discordId, count] of messageCounts.entries()) {
    const member = members.get(discordId);

    await storeDiscordActivity(discordId, {
      discordId,
      discordUsername: member?.user?.username || 'Unknown',
      messageCount: count,
      joinedAt: joinDates.get(discordId) || null,
      updatedAt: new Date()
    });
  }

  console.log('✅ Scan complete');
  process.exit(0);
})();
