/**
 * Script to create test tournaments directly via smart contract
 * Run with: DEPLOYER_PRIVATE_KEY=your_key node create-test-tournaments.js
 */

const { ethers } = require('ethers');

// Contract configuration
const TOURNAMENT_MANAGER_ADDRESS = '0xe06C92f15F426b0f6Fccb66302790E533C5Dfbb7';
const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';

const TOURNAMENT_MANAGER_ABI = [
  'function createTournament(uint8 tier, uint8 period, uint256 startTime, uint256 endTime) external returns (uint256)',
  'function nextTournamentId() view returns (uint256)',
];

// Tournament enums (must match Solidity)
const Tier = {
  STANDARD: 0,
  HIGH_ROLLER: 1,
};

const Period = {
  WEEKLY: 0,
  MONTHLY: 1,
};

async function main() {
  // Get private key from environment
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY;

  if (!privateKey) {
    console.error('❌ Error: DEPLOYER_PRIVATE_KEY environment variable not set');
    console.log('\nRun with:');
    console.log('DEPLOYER_PRIVATE_KEY=your_backend_wallet_key node create-test-tournaments.js');
    process.exit(1);
  }

  console.log('🎮 Creating Test Tournaments on Arbitrum Sepolia...\n');

  // Connect to network
  const provider = new ethers.JsonRpcProvider(ARBITRUM_SEPOLIA_RPC);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log('📍 Wallet:', wallet.address);
  console.log('📍 Contract:', TOURNAMENT_MANAGER_ADDRESS);

  const balance = await provider.getBalance(wallet.address);
  console.log('💰 Balance:', ethers.formatEther(balance), 'ETH\n');

  const tournamentManager = new ethers.Contract(
    TOURNAMENT_MANAGER_ADDRESS,
    TOURNAMENT_MANAGER_ABI,
    wallet
  );

  const now = Math.floor(Date.now() / 1000);
  const oneHour = 3600;
  const oneWeek = 7 * 24 * 60 * 60;
  const oneMonth = 30 * 24 * 60 * 60;

  const tournaments = [
    {
      name: 'Standard Weekly',
      tier: Tier.STANDARD,
      period: Period.WEEKLY,
      startTime: now + oneHour,
      endTime: now + oneHour + oneWeek,
    },
    {
      name: 'High Roller Weekly',
      tier: Tier.HIGH_ROLLER,
      period: Period.WEEKLY,
      startTime: now + oneHour,
      endTime: now + oneHour + oneWeek,
    },
    {
      name: 'Standard Monthly',
      tier: Tier.STANDARD,
      period: Period.MONTHLY,
      startTime: now + oneHour,
      endTime: now + oneHour + oneMonth,
    },
    {
      name: 'High Roller Monthly',
      tier: Tier.HIGH_ROLLER,
      period: Period.MONTHLY,
      startTime: now + oneHour,
      endTime: now + oneHour + oneMonth,
    },
  ];

  for (const tournament of tournaments) {
    try {
      console.log(`\n🎯 Creating ${tournament.name} Tournament...`);
      console.log(`   Tier: ${tournament.tier === Tier.STANDARD ? 'Standard' : 'High Roller'}`);
      console.log(`   Period: ${tournament.period === Period.WEEKLY ? 'Weekly' : 'Monthly'}`);
      console.log(`   Start: ${new Date(tournament.startTime * 1000).toLocaleString()}`);
      console.log(`   End: ${new Date(tournament.endTime * 1000).toLocaleString()}`);

      const tx = await tournamentManager.createTournament(
        tournament.tier,
        tournament.period,
        tournament.startTime,
        tournament.endTime
      );

      console.log('   📝 Transaction:', tx.hash);
      console.log('   ⏳ Waiting for confirmation...');

      const receipt = await tx.wait();
      console.log('   ✅ Confirmed! Block:', receipt.blockNumber);

    } catch (error) {
      console.error(`   ❌ Failed:`, error.message);
    }
  }

  console.log('\n🎉 All test tournaments created!');
  console.log('\n📍 Check on Arbiscan:');
  console.log(`   https://sepolia.arbiscan.io/address/${TOURNAMENT_MANAGER_ADDRESS}`);
  console.log('\n🎮 Visit the tournaments page:');
  console.log('   https://play.8bitarcade.games/tournaments');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
