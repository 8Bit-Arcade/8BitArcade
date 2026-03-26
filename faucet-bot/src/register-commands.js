require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('faucet')
    .setDescription('Get free testnet ETH for Arbitrum Sepolia')
    .addStringOption(option =>
      option.setName('wallet')
        .setDescription('Your wallet address (0x...)')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('faucet-balance')
    .setDescription('Check the faucet status and remaining balance'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('🔄 Registering faucet commands...');

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID
      ),
      { body: commands }
    );

    console.log('✅ Successfully registered commands!');
    console.log('Commands: /faucet, /faucet-balance');
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }
})();
