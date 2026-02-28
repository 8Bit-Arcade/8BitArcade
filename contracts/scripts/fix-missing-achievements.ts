import { ethers } from "hardhat";

/**
 * Fix Missing Mainnet Achievements
 *
 * Handles two scenarios:
 *   A) Wallet was missed entirely by migration → just award on mainnet
 *   B) playerGoalCompleted was set but NFT mint silently failed → reset then re-award
 *
 * Checks testnet for earned achievements, cross-references mainnet contract state
 * AND actual NFT badge ownership, then fixes any gaps.
 *
 * Usage:
 *   cd contracts
 *   npx hardhat run scripts/fix-missing-achievements.ts --network arbitrumOne
 */

const WALLET = "0x96e0B627454cE3b8C55C6d36b5FCBb13849Dc297";

const TESTNET_MANAGER = "0xE68d3AdD44C541fF76C85D185d02BE5ceAC833B3";
const TESTNET_BADGES = "0x8dE45E3e37f0721D64d63E32da5f37CfaCF9ca9f";
const TESTNET_RPC = "https://sepolia-rollup.arbitrum.io/rpc";

const MAINNET_MANAGER = "0xF9f1067873bCe779D35e8796bfE9A32EFf5DAF1f";
const MAINNET_BADGES = "0x5b0ee0abc08fA668c6B215CCD9f9A28a77789d2c";

const MANAGER_ABI = [
  "function getPlayerGoalStatuses(address player, uint256[] goalIds) view returns (bool[])",
  "function getPlayerAchievementCount(address player) view returns (uint256)",
  "function awardAchievement(address player, uint256 goalId) external",
  "function resetPlayerGoalCompletions(address[] players, uint256[] goalIds) external",
];

const BADGES_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function hasAchievement(address player, uint256 achievementTypeId) view returns (bool)",
];

const GOAL_NAMES: Record<number, string> = {
  1: "Space Rocks Master", 2: "Galaxy Ace", 3: "Tetris God", 4: "Shutout King",
  5: "First Steps", 6: "8-Bit Legend", 7: "Tournament Champion",
  8: "Week Warrior", 9: "Century Club",
  10: "8Bit Gamer", 11: "8Bit Prodigy", 12: "8Bit God",
  13: "Early Adopter", 14: "Game Explorer", 15: "OG Member",
  16: "Lucky 777", 17: "Night Owl", 18: "Palindrome Master",
  19: "Double Trouble", 20: "The Answer",
};

// achievementTypeId for each goalId (they match 1:1 in our config)
const GOAL_TO_ACHIEVEMENT_TYPE: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20,
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  Fix Missing Mainnet Achievements");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Wallet:", WALLET);
  console.log("Deployer (owner):", deployer.address);
  console.log();

  const goalIds = Array.from({ length: 20 }, (_, i) => i + 1);

  // ── Step 1: Query testnet achievements ──
  console.log("Step 1: Querying testnet achievements...");
  const testnetProvider = new ethers.JsonRpcProvider(TESTNET_RPC);
  const testnetManager = new ethers.Contract(TESTNET_MANAGER, MANAGER_ABI, testnetProvider);
  const testnetBadges = new ethers.Contract(TESTNET_BADGES, BADGES_ABI, testnetProvider);

  const testnetStatuses: boolean[] = await testnetManager.getPlayerGoalStatuses(WALLET, goalIds);

  const testnetCompleted: number[] = [];
  for (let i = 0; i < testnetStatuses.length; i++) {
    if (testnetStatuses[i]) {
      testnetCompleted.push(goalIds[i]);
      console.log(`  ✓ Testnet Goal ${goalIds[i]}: ${GOAL_NAMES[goalIds[i]]}`);
    }
  }

  const testnetBadgeBalance = await testnetBadges.balanceOf(WALLET);
  console.log(`  Testnet goals completed: ${testnetCompleted.length}`);
  console.log(`  Testnet NFT badge balance: ${testnetBadgeBalance.toString()}`);
  console.log();

  if (testnetCompleted.length === 0) {
    console.log("No testnet achievements found — nothing to migrate.");
    return;
  }

  // ── Step 2: Check mainnet state ──
  console.log("Step 2: Checking mainnet state...");
  const mainnetManager = new ethers.Contract(MAINNET_MANAGER, MANAGER_ABI, deployer);
  const mainnetBadges = new ethers.Contract(MAINNET_BADGES, BADGES_ABI, deployer);

  const mainnetStatuses: boolean[] = await mainnetManager.getPlayerGoalStatuses(WALLET, goalIds);
  const mainnetBadgeBalance = await mainnetBadges.balanceOf(WALLET);

  console.log(`  Mainnet NFT badge balance: ${mainnetBadgeBalance.toString()}`);

  // Categorize each testnet achievement
  const needsAward: number[] = [];       // Not marked complete, no NFT → just award
  const needsResetAndAward: number[] = []; // Marked complete but no NFT → reset then award
  const alreadyDone: number[] = [];      // Marked complete AND has NFT → skip

  for (const goalId of testnetCompleted) {
    const goalComplete = mainnetStatuses[goalId - 1]; // 0-indexed array for 1-indexed goalIds
    const achievementType = GOAL_TO_ACHIEVEMENT_TYPE[goalId];
    const hasNFT = await mainnetBadges.hasAchievement(WALLET, achievementType);

    if (goalComplete && hasNFT) {
      alreadyDone.push(goalId);
      console.log(`  ✓ Goal ${goalId} (${GOAL_NAMES[goalId]}): already complete with NFT`);
    } else if (goalComplete && !hasNFT) {
      needsResetAndAward.push(goalId);
      console.log(`  ⚠ Goal ${goalId} (${GOAL_NAMES[goalId]}): marked complete but NO NFT (silent mint failure)`);
    } else {
      needsAward.push(goalId);
      console.log(`  ✗ Goal ${goalId} (${GOAL_NAMES[goalId]}): not on mainnet at all`);
    }
  }
  console.log();

  if (needsAward.length === 0 && needsResetAndAward.length === 0) {
    console.log("All achievements already exist on mainnet with NFTs! Nothing to fix.");
    return;
  }

  // ── Step 3: Reset goals that were marked complete without NFTs ──
  if (needsResetAndAward.length > 0) {
    console.log(`Step 3a: Resetting ${needsResetAndAward.length} ghost completions (no NFT)...`);
    const players = needsResetAndAward.map(() => WALLET);
    const tx = await mainnetManager.resetPlayerGoalCompletions(players, needsResetAndAward);
    const receipt = await tx.wait();
    console.log(`  ✓ Reset TX: ${receipt!.hash}`);
    console.log();
  }

  // ── Step 4: Award all missing achievements ──
  const toAward = [...needsAward, ...needsResetAndAward];
  console.log(`Step ${needsResetAndAward.length > 0 ? '3b' : '3'}: Awarding ${toAward.length} achievements on mainnet...`);

  for (const goalId of toAward) {
    console.log(`  Awarding Goal ${goalId} (${GOAL_NAMES[goalId]})...`);
    const tx = await mainnetManager.awardAchievement(WALLET, goalId);
    const receipt = await tx.wait();
    console.log(`  ✓ TX: ${receipt!.hash}`);
  }

  // ── Verify ──
  console.log();
  const finalBalance = await mainnetBadges.balanceOf(WALLET);
  const finalCount = await mainnetManager.getPlayerAchievementCount(WALLET);
  console.log("═══════════════════════════════════════════════════");
  console.log("  COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  NFT badges on mainnet: ${finalBalance.toString()}`);
  console.log(`  Achievement count: ${finalCount.toString()}`);
  console.log(`  Awarded: ${toAward.length} achievements`);
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
