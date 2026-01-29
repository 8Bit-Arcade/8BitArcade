require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { DISCORD_TOKEN, GUILD_ID, ROLES, MESSAGE_THRESHOLDS, GAME_THRESHOLDS } = require('./config');
const firebase = require('./firebase');
const roleManager = require('./roleManager');
const { ethers } = require('ethers');

// Initialize Firebase
firebase.initFirebase();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

// Bot ready
client.once('ready', async () => {
  console.log(`🎮 8-Bit Arcade Bot is online as ${client.user.tag}`);
  console.log(`📊 Tracking activity in guild: ${GUILD_ID}`);

  // Set bot status
  client.user.setActivity('8-Bit Arcade | /link', { type: 3 }); // "Watching"
});

// Track messages for activity
client.on('messageCreate', async (message) => {
  // Ignore bots and DMs
  if (message.author.bot || !message.guild) return;

  // Ignore specific channels (like bot-spam) if needed
  // if (message.channel.name === 'bot-commands') return;

  try {
    // Increment message count
    const newCount = await firebase.incrementMessageCount(
      message.author.id,
      message.author.username
    );

    // Check if user crossed a role threshold
    for (const threshold of MESSAGE_THRESHOLDS) {
      if (newCount === threshold.count) {
        const role = ROLES[threshold.role];
        if (role?.id) {
          const member = message.member;
          if (member && !member.roles.cache.has(role.id)) {
            await member.roles.add(role.id);
            console.log(`🎉 ${message.author.tag} earned ${role.emoji} ${role.name}!`);

            // Optional: Send congratulations message
            message.channel.send({
              content: `🎉 <@${message.author.id}> just earned the **${role.emoji} ${role.name}** role!`
            }).catch(() => {}); // Ignore if can't send
          }
        }
      }
    }
  } catch (error) {
    console.error('Error tracking message:', error.message);
  }
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName, options, member, user } = interaction;

  try {
    switch (commandName) {
      case 'link':
        await handleLink(interaction, options.getString('wallet'));
        break;

      case 'stats':
        await handleStats(interaction);
        break;

      case 'roles':
        await handleRoles(interaction);
        break;

      case 'sync':
        await handleSync(interaction);
        break;

      case 'leaderboard':
        await handleLeaderboard(interaction);
        break;

      case 'snapshot':
        await handleSnapshot(interaction);
        break;

      default:
        await interaction.reply({ content: 'Unknown command', ephemeral: true });
    }
  } catch (error) {
    console.error(`Error handling /${commandName}:`, error);
    const reply = { content: `❌ Error: ${error.message}`, ephemeral: true };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
});

// /link command - Connect wallet to Discord
async function handleLink(interaction, walletAddress) {
  await interaction.deferReply({ ephemeral: true });

  // Validate wallet address
  if (!ethers.utils.isAddress(walletAddress)) {
    return interaction.editReply('❌ Invalid wallet address. Please provide a valid Ethereum address (0x...)');
  }

  const result = await firebase.linkWallet(
    interaction.user.id,
    walletAddress,
    interaction.user.username
  );

  if (!result.success) {
    return interaction.editReply(`❌ ${result.error}`);
  }

  // Sync roles after linking
  await roleManager.syncUserRoles(interaction.member);

  const embed = new EmbedBuilder()
    .setColor('#00ff88')
    .setTitle('🎮 Wallet Linked!')
    .setDescription(`Your wallet has been linked to your Discord account.`)
    .addFields(
      { name: '💳 Wallet', value: `\`${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}\``, inline: true },
      { name: '🎯 Status', value: 'Roles synced!', inline: true }
    )
    .setFooter({ text: 'Use /stats to see your airdrop points' });

  await interaction.editReply({ embeds: [embed] });
}

// /stats command - View activity and points
async function handleStats(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const discordId = interaction.user.id;
  const stats = await roleManager.calculateAirdropPoints(discordId);

  const embed = new EmbedBuilder()
    .setColor('#00d4ff')
    .setTitle(`📊 Stats for ${interaction.user.username}`)
    .setThumbnail(interaction.user.displayAvatarURL());

  // Add message count
  embed.addFields({ name: '💬 Discord Messages', value: `${stats.messageCount}`, inline: true });

  // Add wallet status
  if (stats.walletAddress) {
    embed.addFields({
      name: '💳 Linked Wallet',
      value: `\`${stats.walletAddress.slice(0, 6)}...${stats.walletAddress.slice(-4)}\``,
      inline: true
    });
  } else {
    embed.addFields({ name: '💳 Wallet', value: 'Not linked - use `/link`', inline: true });
  }

  // Add points breakdown
  if (stats.breakdown.length > 0) {
    const breakdownText = stats.breakdown
      .map(b => `${b.role}: **+${b.points}**`)
      .join('\n');
    embed.addFields({ name: '🏆 Points Breakdown', value: breakdownText, inline: false });
  }

  embed.addFields({ name: '⭐ Total Airdrop Points', value: `**${stats.totalPoints}**`, inline: false });

  embed.setFooter({ text: 'Keep playing games and chatting to earn more points!' });

  await interaction.editReply({ embeds: [embed] });
}

// /roles command - View all available roles
async function handleRoles(interaction) {
  const discordRoles = Object.values(ROLES).filter(r => r.type === 'discord');
  const gameRoles = Object.values(ROLES).filter(r => r.type === 'game');
  const holderRoles = Object.values(ROLES).filter(r => r.type === 'holder');

  const formatRole = (r) => {
    let threshold = '';
    if (typeof r.threshold === 'number' && r.threshold > 0) {
      threshold = r.type === 'discord' ? `${r.threshold}+ messages` :
                  r.type === 'game' ? `${r.threshold}+ games` :
                  r.type === 'holder' ? `${r.threshold.toLocaleString()}+ 8BIT` : '';
    } else if (r.threshold === 'og') {
      threshold = 'Joined early';
    } else if (r.threshold === 'leaderboard') {
      threshold = 'Hit daily top 10';
    } else if (r.threshold === 'tournament') {
      threshold = 'Win tournament';
    } else {
      threshold = 'Join server';
    }
    return `${r.emoji} **${r.name}** - ${threshold} (+${r.points} pts)`;
  };

  const embed = new EmbedBuilder()
    .setColor('#ff00ff')
    .setTitle('🎮 8-Bit Arcade Roles')
    .setDescription('Earn roles through Discord activity, gameplay, and holding tokens!')
    .addFields(
      { name: '💬 Discord Roles', value: discordRoles.map(formatRole).join('\n'), inline: false },
      { name: '🎯 Game Roles', value: gameRoles.map(formatRole).join('\n'), inline: false },
      { name: '💎 Holder Roles', value: holderRoles.map(formatRole).join('\n'), inline: false }
    )
    .setFooter({ text: 'Link your wallet with /link to unlock game & holder roles!' });

  await interaction.reply({ embeds: [embed] });
}

// /sync command - Manually sync roles
async function handleSync(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const result = await roleManager.syncUserRoles(interaction.member);

  if (result.success) {
    await interaction.editReply('✅ Roles synced! Your roles have been updated based on your activity.');
  } else {
    await interaction.editReply(`❌ Error syncing roles: ${result.error}`);
  }
}

// /leaderboard command - View top Discord activity
async function handleLeaderboard(interaction) {
  await interaction.deferReply();

  const allActivity = await firebase.getAllDiscordActivity();

  // Sort by message count
  const sorted = allActivity
    .filter(a => a.messageCount > 0)
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, 10);

  if (sorted.length === 0) {
    return interaction.editReply('No activity tracked yet!');
  }

  const leaderboardText = sorted
    .map((a, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      return `${medal} **${a.discordUsername || 'Unknown'}** - ${a.messageCount} messages`;
    })
    .join('\n');

  const embed = new EmbedBuilder()
    .setColor('#ffd700')
    .setTitle('🏆 Discord Activity Leaderboard')
    .setDescription(leaderboardText)
    .setFooter({ text: 'Keep chatting to climb the leaderboard!' });

  await interaction.editReply({ embeds: [embed] });
}

// /snapshot command - Admin: Scan history and assign roles
async function handleSnapshot(interaction) {
  // Check admin permission
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ Admin only command', ephemeral: true });
  }

  await interaction.deferReply();
  await interaction.editReply('🔄 Starting message history scan... This may take a while.');

  const guild = interaction.guild;
  const channels = guild.channels.cache.filter(c => c.isTextBased() && c.viewable);

  let totalMessages = 0;
  let usersUpdated = 0;
  const userCounts = new Map();

  for (const [channelId, channel] of channels) {
    try {
      let lastId;
      let fetchedMessages;

      // Fetch up to 1000 messages per channel
      let channelTotal = 0;
      const maxMessages = 1000;

      do {
        fetchedMessages = await channel.messages.fetch({
          limit: 100,
          ...(lastId && { before: lastId })
        });

        for (const [msgId, msg] of fetchedMessages) {
          if (!msg.author.bot) {
            const currentCount = userCounts.get(msg.author.id) || {
              id: msg.author.id,
              username: msg.author.username,
              count: 0
            };
            currentCount.count++;
            userCounts.set(msg.author.id, currentCount);
            totalMessages++;
          }
        }

        lastId = fetchedMessages.last()?.id;
        channelTotal += fetchedMessages.size;

        // Update progress every 500 messages
        if (totalMessages % 500 === 0) {
          await interaction.editReply(`🔄 Scanned ${totalMessages} messages from ${channels.size} channels...`);
        }
      } while (fetchedMessages.size === 100 && channelTotal < maxMessages);

    } catch (error) {
      console.log(`Skipping channel ${channel.name}: ${error.message}`);
    }
  }

  // Store counts and assign roles
  await interaction.editReply(`📊 Scanned ${totalMessages} messages. Assigning roles to ${userCounts.size} users...`);

  for (const [userId, userData] of userCounts) {
    try {
      // Store in Firebase
      await firebase.storeDiscordActivity(userId, {
        discordId: userId,
        discordUsername: userData.username,
        messageCount: userData.count,
        snapshotAt: new Date()
      });

      // Try to get member and sync roles
      const member = await guild.members.fetch(userId).catch(() => null);
      if (member) {
        await roleManager.syncUserRoles(member);
        usersUpdated++;
      }
    } catch (error) {
      console.error(`Error updating user ${userId}:`, error.message);
    }
  }

  const embed = new EmbedBuilder()
    .setColor('#00ff88')
    .setTitle('✅ Snapshot Complete!')
    .addFields(
      { name: '📨 Messages Scanned', value: totalMessages.toLocaleString(), inline: true },
      { name: '👥 Users Found', value: userCounts.size.toLocaleString(), inline: true },
      { name: '🎭 Roles Assigned', value: usersUpdated.toLocaleString(), inline: true }
    );

  await interaction.editReply({ content: '', embeds: [embed] });
}

// New member joined - give Player 1 role
client.on('guildMemberAdd', async (member) => {
  if (ROLES.PLAYER_1.id) {
    try {
      await member.roles.add(ROLES.PLAYER_1.id);
      console.log(`🎮 ${member.user.tag} joined and got Player 1 role`);
    } catch (error) {
      console.error('Error adding Player 1 role:', error.message);
    }
  }
});

// Login
client.login(DISCORD_TOKEN);
