import { ethers } from "hardhat";

/**
 * Reset achievement completions so badges can be re-minted on the new AchievementBadges contract
 *
 * After upgrading AchievementManager with the resetPlayerGoalCompletions function,
 * this script:
 *   1. Queries all AchievementAwarded events from the manager
 *   2. Extracts unique (player, goalId) pairs
 *   3. Calls resetPlayerGoalCompletions() to clear old state
 *
 * The scheduled Firebase achievement checker will then re-detect eligible players
 * and mint new badges on the current AchievementBadges contract.
 *
 * USAGE:
 *   npx hardhat run scripts/reset-achievements.ts --network arbitrumSepolia
 */

const MANAGER_PROXY = "0xcD7b55b846b5FC306ab1B4D2f30FBd3073315e84";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  RESET ACHIEVEMENT COMPLETIONS");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Deployer:", deployer.address);
  console.log("Manager:", MANAGER_PROXY);
  console.log();

  const manager = new ethers.Contract(MANAGER_PROXY, [
    "function owner() view returns (address)",
    "function resetPlayerGoalCompletions(address[], uint256[]) external",
    "function hasCompletedGoal(address, uint256) view returns (bool)",
    "function totalAchievementsAwarded() view returns (uint256)",
    "event AchievementAwarded(address indexed player, uint256 indexed goalId, uint256 badgeTokenId, uint256 rewardItemTokenId, uint256 rewardTokenAmount)"
  ], deployer);

  // Pre-flight checks
  const owner = await manager.owner();
  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ ABORT: You don't own the AchievementManager!");
    console.error("   Owner is:", owner);
    process.exit(1);
  }
  console.log("✓ You own the AchievementManager");

  // Verify the reset function exists (will revert if not upgraded yet)
  try {
    // Dry-run with empty arrays to verify function exists
    await manager.resetPlayerGoalCompletions.staticCall([], []);
    console.log("✓ resetPlayerGoalCompletions function exists (manager upgraded)");
  } catch (e: any) {
    console.error("❌ ABORT: resetPlayerGoalCompletions not available!");
    console.error("   Did you run upgrade-manager.ts first?");
    console.error("   Error:", e.message?.slice(0, 200));
    process.exit(1);
  }

  const totalBefore = await manager.totalAchievementsAwarded();
  console.log("  Total achievements before reset:", totalBefore.toString());
  console.log();

  // ── Query AchievementAwarded events ──
  console.log("Querying AchievementAwarded events...");

  const filter = manager.filters.AchievementAwarded();
  // Query from block 0 to latest (Arbitrum Sepolia has fast blocks)
  const events = await manager.queryFilter(filter, 0, "latest");

  console.log(`  Found ${events.length} AchievementAwarded events`);
  console.log();

  if (events.length === 0) {
    console.log("No achievements to reset. Exiting.");
    return;
  }

  // Extract unique (player, goalId) pairs
  const players: string[] = [];
  const goalIds: bigint[] = [];

  for (const event of events) {
    const log = event as ethers.EventLog;
    const player = log.args[0]; // player address
    const goalId = log.args[1]; // goalId

    // Verify it's still marked as completed
    const stillCompleted = await manager.hasCompletedGoal(player, goalId);
    if (stillCompleted) {
      players.push(player);
      goalIds.push(goalId);
      console.log(`  Will reset: ${player} / goalId ${goalId}`);
    }
  }

  console.log();
  console.log(`Total pairs to reset: ${players.length}`);

  if (players.length === 0) {
    console.log("All already reset. Nothing to do.");
    return;
  }

  // ── Batch reset in chunks (to avoid gas limits) ──
  const BATCH_SIZE = 50;
  for (let i = 0; i < players.length; i += BATCH_SIZE) {
    const batchPlayers = players.slice(i, i + BATCH_SIZE);
    const batchGoalIds = goalIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(players.length / BATCH_SIZE);

    console.log(`Resetting batch ${batchNum}/${totalBatches} (${batchPlayers.length} entries)...`);
    const tx = await manager.resetPlayerGoalCompletions(batchPlayers, batchGoalIds);
    await tx.wait();
    console.log(`  Done: ${tx.hash}`);
  }

  // ── Verify ──
  console.log();
  console.log("── Verification ──");
  const totalAfter = await manager.totalAchievementsAwarded();
  console.log("  Total achievements after reset:", totalAfter.toString());

  // Spot check first player
  if (players.length > 0) {
    const checkCompleted = await manager.hasCompletedGoal(players[0], goalIds[0]);
    console.log(`  Spot check ${players[0]} / goalId ${goalIds[0]}: completed=${checkCompleted}`);
  }

  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  RESET COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log(`Reset ${players.length} achievement completions.`);
  console.log();
  console.log("The scheduled Firebase achievement checker will now:");
  console.log("  1. Re-detect eligible players");
  console.log("  2. Call awardAchievement() for each");
  console.log("  3. Mint new badges on the current AchievementBadges contract");
  console.log();
  console.log("To trigger immediately: run the checkAchievements function manually");
  console.log("or wait for the next scheduled run.");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
