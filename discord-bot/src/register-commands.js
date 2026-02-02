require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');
const { CLIENT_ID, GUILD_ID, DISCORD_TOKEN } = require('./config');

const commands = [
  new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your wallet address to Discord for game roles & airdrop')
    .addStringOption(option =>
      option.setName('wallet')
        .setDescription('Your Ethereum wallet address (0x...)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription('View your activity stats and airdrop points'),

  new SlashCommandBuilder()
    .setName('roles')
    .setDescription('View all available roles and how to earn them'),

  new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Manually sync your roles based on current activity'),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View Discord activity leaderboard'),

  new SlashCommandBuilder()
    .setName('snapshot')
    .setDescription('(Admin) Scan message history and assign roles retroactively')
    .setDefaultMemberPermissions(0), // Admin only

  new SlashCommandBuilder()
    .setName('airdrop')
    .setDescription('View your estimated airdrop allocation'),

  new SlashCommandBuilder()
    .setName('airdrop-export')
    .setDescription('(Admin) Export full airdrop distribution as CSV')
    .setDefaultMemberPermissions(0), // Admin only
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log('🔄 Registering slash commands...');

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );

    console.log('✅ Successfully registered commands!');
    console.log('Commands:', commands.map(c => `/${c.name}`).join(', '));
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
})();
