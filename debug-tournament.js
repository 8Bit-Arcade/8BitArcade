const { ethers } = require('ethers');

const TOURNAMENT_MANAGER_ADDRESS = '0xe06C92f15F426b0f6Fccb66302790E533C5Dfbb7';
const EIGHT_BIT_TOKEN_ADDRESS = '0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d';
const ARBITRUM_SEPOLIA_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';
const USER_WALLET = '0x92f5523c2329eE281E7FEB8808FcE4b49ab1ebf8';

const TOURNAMENT_MANAGER_ABI = [
  'function getTournament(uint256 tournamentId) view returns (uint8 tier, uint8 period, uint256 startTime, uint256 endTime, uint256 entryFee, uint256 prizePool, uint256 totalEntries, address winner, bool isActive)',
  'function hasPlayerEntered(uint256 tournamentId, address player) view returns (bool)',
];

const TOKEN_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

async function main() {
  const provider = new ethers.JsonRpcProvider(ARBITRUM_SEPOLIA_RPC);
  const tournamentManager = new ethers.Contract(TOURNAMENT_MANAGER_ADDRESS, TOURNAMENT_MANAGER_ABI, provider);
  const token = new ethers.Contract(EIGHT_BIT_TOKEN_ADDRESS, TOKEN_ABI, provider);

  console.log('🔍 Debugging Tournament Entry for Tournament #1\n');

  // Check tournament details
  console.log('📊 Tournament Info:');
  const tournament = await tournamentManager.getTournament(1);
  const now = Math.floor(Date.now() / 1000);

  console.log(`  Tier: ${tournament[0] === 0 ? 'Standard' : 'High Roller'}`);
  console.log(`  Period: ${tournament[1] === 0 ? 'Weekly' : 'Monthly'}`);
  console.log(`  Start Time: ${new Date(Number(tournament[2]) * 1000).toISOString()}`);
  console.log(`  End Time: ${new Date(Number(tournament[3]) * 1000).toISOString()}`);
  console.log(`  Entry Fee: ${ethers.formatEther(tournament[4])} 8BIT`);
  console.log(`  Prize Pool: ${ethers.formatEther(tournament[5])} 8BIT`);
  console.log(`  Total Entries: ${tournament[6]}`);
  console.log(`  Is Active: ${tournament[8]}`);

  console.log(`\n⏰ Timing Check:`);
  console.log(`  Current Time: ${new Date(now * 1000).toISOString()}`);
  console.log(`  Has Started: ${now >= Number(tournament[2])} ${now >= Number(tournament[2]) ? '✅' : '❌'}`);
  console.log(`  Not Ended: ${now < Number(tournament[3])} ${now < Number(tournament[3]) ? '✅' : '❌'}`);

  // Check if user already entered
  const hasEntered = await tournamentManager.hasPlayerEntered(1, USER_WALLET);
  console.log(`\n👤 User Status:`);
  console.log(`  Already Entered: ${hasEntered} ${hasEntered ? '❌' : '✅'}`);

  // Check token balance
  const balance = await token.balanceOf(USER_WALLET);
  console.log(`\n💰 Token Balance:`);
  console.log(`  User Balance: ${ethers.formatEther(balance)} 8BIT`);
  console.log(`  Entry Fee: ${ethers.formatEther(tournament[4])} 8BIT`);
  console.log(`  Has Enough: ${balance >= tournament[4]} ${balance >= tournament[4] ? '✅' : '❌'}`);

  // Check allowance
  const allowance = await token.allowance(USER_WALLET, TOURNAMENT_MANAGER_ADDRESS);
  console.log(`\n🔑 Approval Status:`);
  console.log(`  Allowance: ${ethers.formatEther(allowance)} 8BIT`);
  console.log(`  Entry Fee: ${ethers.formatEther(tournament[4])} 8BIT`);
  console.log(`  Approved Enough: ${allowance >= tournament[4]} ${allowance >= tournament[4] ? '✅' : '❌'}`);

  console.log(`\n📋 Summary:`);
  const checks = {
    'Tournament Active': tournament[8],
    'Tournament Started': now >= Number(tournament[2]),
    'Tournament Not Ended': now < Number(tournament[3]),
    'User Not Already Entered': !hasEntered,
    'User Has Enough Tokens': balance >= tournament[4],
    'Sufficient Allowance': allowance >= tournament[4],
  };

  for (const [check, passed] of Object.entries(checks)) {
    console.log(`  ${check}: ${passed ? '✅ PASS' : '❌ FAIL'}`);
  }

  const allPassed = Object.values(checks).every(v => v);
  console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED - Entry should work!' : '❌ SOME CHECKS FAILED - See above'}`);
}

main().catch(console.error);
