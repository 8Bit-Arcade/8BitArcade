import { ethers } from "hardhat";

/**
 * Fix Missing Mainnet NFT Badges
 *
 * Problem: awardAchievement uses low-level calls for badge minting that
 * silently fail. The 8BIT token rewards mint fine, but the NFT badges don't.
 * This is likely because AchievementManager isn't authorized as a minter
 * on the AchievementBadges contract.
 *
 * This script:
 * 1. Diagnoses the authorization issue on AchievementBadges
 * 2. Fixes it if needed (deployer must be AchievementBadges owner)
 * 3. Resets ghost goal completions (marked complete but no NFT)
 * 4. Re-awards with proper badge minting
 *
 * NOTE: Token rewards will be skipped on re-award by setting rewardTokenAmount
 * to 0 temporarily — actually, we can't do that easily. Instead, we'll mint
 * badges directly on the AchievementBadges contract and just reset the
 * goal completions so the state is consistent.
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

const BADGE_METADATA_BASE_URI = "https://orange-encouraging-perch-476.mypinata.cloud/ipfs/bafybeicq7qgtsrr4yl45a7waqv7wiluy6nuetjnjeddfo2pxwzljsyin7m/metadata/badges/";

const MANAGER_ABI = [
  "function getPlayerGoalStatuses(address player, uint256[] goalIds) view returns (bool[])",
  "function getPlayerAchievementCount(address player) view returns (uint256)",
  "function awardAchievement(address player, uint256 goalId) external",
  "function resetPlayerGoalCompletions(address[] players, uint256[] goalIds) external",
  "function achievementBadges() view returns (address)",
  "function eightBitToken() view returns (address)",
];

const BADGES_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function hasAchievement(address player, uint256 achievementTypeId) view returns (bool)",
  "function authorizedMinters(address) view returns (bool)",
  "function setAuthorizedMinter(address minter, bool authorized) external",
  "function mintBadge(address to, uint256 achievementTypeId, string uri) external returns (uint256)",
  "function owner() view returns (address)",
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

// achievementTypeId for each goalId (1:1 in our config)
const GOAL_TO_ACHIEVEMENT_TYPE: Record<number, number> = {
  1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8, 9: 9, 10: 10,
  11: 11, 12: 12, 13: 13, 14: 14, 15: 15, 16: 16, 17: 17, 18: 18, 19: 19, 20: 20,
};

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  Fix Missing Mainnet NFT Badges");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Wallet:", WALLET);
  console.log("Deployer:", deployer.address);
  console.log();

  const goalIds = Array.from({ length: 20 }, (_, i) => i + 1);
  const mainnetManager = new ethers.Contract(MAINNET_MANAGER, MANAGER_ABI, deployer);
  const mainnetBadges = new ethers.Contract(MAINNET_BADGES, BADGES_ABI, deployer);

  // ═══════════════════════════════════════════════════════════
  // STEP 1: DIAGNOSE — Check AchievementManager authorization
  // ═══════════════════════════════════════════════════════════
  console.log("Step 1: Diagnosing authorization...");

  const badgesOwner = await mainnetBadges.owner();
  console.log(`  AchievementBadges owner: ${badgesOwner}`);
  console.log(`  Deployer is owner: ${badgesOwner.toLowerCase() === deployer.address.toLowerCase()}`);

  const managerIsAuthorized = await mainnetBadges.authorizedMinters(MAINNET_MANAGER);
  console.log(`  AchievementManager authorized on Badges: ${managerIsAuthorized}`);

  // Also check if deployer is authorized (for direct minting)
  const deployerIsAuthorized = await mainnetBadges.authorizedMinters(deployer.address);
  console.log(`  Deployer authorized on Badges: ${deployerIsAuthorized}`);
  console.log();

  // ═══════════════════════════════════════════════════════════
  // STEP 2: FIX AUTHORIZATION if needed
  // ═══════════════════════════════════════════════════════════
  if (!managerIsAuthorized) {
    console.log("Step 2: FIXING — AchievementManager is NOT authorized! Setting now...");
    if (badgesOwner.toLowerCase() !== deployer.address.toLowerCase()) {
      console.error("  ERROR: Deployer is not the AchievementBadges owner. Cannot fix authorization.");
      console.error(`  Owner: ${badgesOwner}`);
      console.error(`  Deployer: ${deployer.address}`);
      process.exit(1);
    }
    const tx = await mainnetBadges.setAuthorizedMinter(MAINNET_MANAGER, true);
    await tx.wait();
    console.log("  ✓ AchievementManager authorized as minter on AchievementBadges");
    console.log();
  } else {
    console.log("Step 2: Authorization OK — AchievementManager is already authorized");
    console.log();
  }

  // Also authorize deployer for direct minting (needed for fallback below)
  if (!deployerIsAuthorized) {
    console.log("  Authorizing deployer for direct badge minting...");
    const tx = await mainnetBadges.setAuthorizedMinter(deployer.address, true);
    await tx.wait();
    console.log("  ✓ Deployer authorized");
    console.log();
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Check testnet achievements
  // ═══════════════════════════════════════════════════════════
  console.log("Step 3: Querying testnet achievements...");
  const testnetProvider = new ethers.JsonRpcProvider(TESTNET_RPC);
  const testnetManager = new ethers.Contract(TESTNET_MANAGER, MANAGER_ABI, testnetProvider);

  const testnetStatuses: boolean[] = await testnetManager.getPlayerGoalStatuses(WALLET, goalIds);

  const testnetCompleted: number[] = [];
  for (let i = 0; i < testnetStatuses.length; i++) {
    if (testnetStatuses[i]) {
      testnetCompleted.push(goalIds[i]);
      console.log(`  ✓ Testnet Goal ${goalIds[i]}: ${GOAL_NAMES[goalIds[i]]}`);
    }
  }
  console.log(`  Total on testnet: ${testnetCompleted.length}`);
  console.log();

  if (testnetCompleted.length === 0) {
    console.log("No testnet achievements found — nothing to migrate.");
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 4: Check mainnet state and categorize
  // ═══════════════════════════════════════════════════════════
  console.log("Step 4: Checking mainnet state...");
  const mainnetStatuses: boolean[] = await mainnetManager.getPlayerGoalStatuses(WALLET, goalIds);
  const mainnetBadgeBalance = await mainnetBadges.balanceOf(WALLET);
  console.log(`  Mainnet NFT badge balance: ${mainnetBadgeBalance.toString()}`);

  const needsMintOnly: number[] = [];      // Goal complete, no NFT → mint badge directly (skip token reward)
  const needsFullAward: number[] = [];     // Goal not complete, no NFT → full award
  const alreadyDone: number[] = [];        // Goal complete AND has NFT → skip

  for (const goalId of testnetCompleted) {
    const goalComplete = mainnetStatuses[goalId - 1];
    const achievementType = GOAL_TO_ACHIEVEMENT_TYPE[goalId];
    const hasNFT = await mainnetBadges.hasAchievement(WALLET, achievementType);

    if (goalComplete && hasNFT) {
      alreadyDone.push(goalId);
      console.log(`  ✓ Goal ${goalId} (${GOAL_NAMES[goalId]}): complete with NFT`);
    } else if (goalComplete && !hasNFT) {
      needsMintOnly.push(goalId);
      console.log(`  ⚠ Goal ${goalId} (${GOAL_NAMES[goalId]}): goal complete but NO NFT badge`);
    } else {
      needsFullAward.push(goalId);
      console.log(`  ✗ Goal ${goalId} (${GOAL_NAMES[goalId]}): not on mainnet at all`);
    }
  }
  console.log();

  if (needsMintOnly.length === 0 && needsFullAward.length === 0) {
    console.log("All achievements already exist on mainnet with NFTs! Nothing to fix.");
    return;
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 5a: Mint badges directly for ghost completions
  // (Goal was marked complete but NFT never minted — mint badge
  // directly without going through awardAchievement to avoid
  // double token rewards)
  // ═══════════════════════════════════════════════════════════
  if (needsMintOnly.length > 0) {
    console.log(`Step 5a: Minting ${needsMintOnly.length} badges directly (avoiding double token rewards)...`);
    for (const goalId of needsMintOnly) {
      const achievementType = GOAL_TO_ACHIEVEMENT_TYPE[goalId];
      const badgeURI = `${BADGE_METADATA_BASE_URI}${achievementType}.json`;
      console.log(`  Minting badge for Goal ${goalId} (${GOAL_NAMES[goalId]})...`);
      const tx = await mainnetBadges.mintBadge(WALLET, achievementType, badgeURI);
      const receipt = await tx.wait();
      console.log(`  ✓ TX: ${receipt!.hash}`);
    }
    console.log();
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 5b: Full award for goals not on mainnet at all
  // ═══════════════════════════════════════════════════════════
  if (needsFullAward.length > 0) {
    console.log(`Step 5b: Awarding ${needsFullAward.length} achievements (goal + badge + tokens)...`);
    for (const goalId of needsFullAward) {
      console.log(`  Awarding Goal ${goalId} (${GOAL_NAMES[goalId]})...`);
      const tx = await mainnetManager.awardAchievement(WALLET, goalId);
      const receipt = await tx.wait();
      console.log(`  ✓ TX: ${receipt!.hash}`);
    }
    console.log();
  }

  // ═══════════════════════════════════════════════════════════
  // VERIFY
  // ═══════════════════════════════════════════════════════════
  const finalBalance = await mainnetBadges.balanceOf(WALLET);
  const finalCount = await mainnetManager.getPlayerAchievementCount(WALLET);
  console.log("═══════════════════════════════════════════════════");
  console.log("  COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  NFT badges on mainnet: ${finalBalance.toString()}`);
  console.log(`  Achievement count: ${finalCount.toString()}`);
  console.log(`  Badges minted directly: ${needsMintOnly.length}`);
  console.log(`  Full awards: ${needsFullAward.length}`);
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
