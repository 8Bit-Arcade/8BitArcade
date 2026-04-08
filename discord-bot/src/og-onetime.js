require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// CONFIG
const DISCORD_TOKEN = process.env.DISCORD_BOT_TOKEN || process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID || process.env.GUILD_ID;
const ARCADE_OG_ROLE_ID = process.env.ROLE_ARCADE_OG;
const OG_CUTOFF_DATE = new Date(process.env.OG_CUTOFF_DATE); // IMPORTANT

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

client.once('ready', async () => {
  console.log('🎮 One-time OG script started...');
  console.log('📅 OG cutoff date:', OG_CUTOFF_DATE.toISOString());

  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.members.fetch();

  const members = guild.members.cache;

  let checked = 0;
  let added = 0;
  let skipped = 0;

  for (const member of members.values()) {
    checked++;

    // Skip bots
    if (member.user.bot) {
      skipped++;
      continue;
    }

    // Skip if already has OG role
    if (member.roles.cache.has(ARCADE_OG_ROLE_ID)) {
      skipped++;
      continue;
    }

    // Check join date
    if (member.joinedAt && member.joinedAt.getTime() < OG_CUTOFF_DATE.getTime()) {
      try {
        await member.roles.add(ARCADE_OG_ROLE_ID);
        added++;
        console.log(`✅ OG added → ${member.user.tag}`);
      } catch (err) {
        console.error(`❌ Failed → ${member.user.tag}:`, err.message);
      }

      // small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 300));
    } else {
      skipped++;
    }
  }

  console.log('==============================');
  console.log(`👥 Members checked: ${checked}`);
  console.log(`🏆 OG roles added: ${added}`);
  console.log(`⏭️ Skipped: ${skipped}`);
  console.log('✅ One-time OG script finished.');
  process.exit(0);
});

client.login(DISCORD_TOKEN);
