import { ethers } from "hardhat";

/**
 * Reset Goals Script
 *
 * Deactivates all existing goals from the old deployment and creates
 * the correct 20 goals with sequential achievementTypeIds 1-20.
 *
 * After running, update the Firebase checkAchievements.ts GOALS array
 * with the new goalIds printed at the end.
 *
 * USAGE:
 *   npx hardhat run scripts/reset-goals.ts --network arbitrumSepolia
 */

const ACHIEVEMENT_MANAGER_ADDRESS = "0xcD7b55b846b5FC306ab1B4D2f30FBd3073315e84";

const MANAGER_ABI = [
  "function nextGoalId() view returns (uint256)",
  "function setGoalActive(uint256 goalId, bool active) external",
  "function createGoal(string name, string description, uint8 category, uint256 threshold, string gameId, uint256 achievementTypeId, uint256 rewardItemTypeId, uint256 rewardTokenAmount) external returns (uint256)",
  "function getGoal(uint256 goalId) view returns (string name, string description, uint8 category, uint256 threshold, string gameId, uint256 achievementTypeId, uint256 rewardItemTypeId, uint256 rewardTokenAmount, bool active)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const manager = new ethers.Contract(ACHIEVEMENT_MANAGER_ADDRESS, MANAGER_ABI, deployer);

  console.log("═══════════════════════════════════════════════════");
  console.log("  RESET GOALS - Deactivate old, create correct 20");
  console.log("═══════════════════════════════════════════════════");
  console.log("Deployer:", deployer.address);
  console.log();

  // ─── 1. Check existing goals ───
  const nextId = await manager.nextGoalId();
  const existingCount = Number(nextId) - 1;
  console.log(`Found ${existingCount} existing goals (IDs 1-${existingCount})`);
  console.log();

  // ─── 2. Deactivate all existing goals ───
  console.log("Deactivating old goals...");
  for (let i = 1; i <= existingCount; i++) {
    try {
      const goal = await manager.getGoal(i);
      if (goal.active) {
        const tx = await manager.setGoalActive(i, false);
        await tx.wait();
        console.log(`  Deactivated goal ${i}: ${goal.name}`);
      } else {
        console.log(`  Goal ${i} already inactive: ${goal.name}`);
      }
    } catch (err: any) {
      console.log(`  Goal ${i}: skip (${err.reason || err.message})`);
    }
  }
  console.log();

  // ─── 3. Create the correct 20 goals ───
  console.log("Creating 20 correct goals...");

  const goalConfigs = [
    // ── SCORE (4) ──
    { name: "Space Rocks Master", desc: "Score 25,000 in Space Rocks", category: 0, threshold: 25000, gameId: "space-rocks", achievementType: 1, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "Galaxy Ace", desc: "Score 50,000 in Galaxy Fighter", category: 0, threshold: 50000, gameId: "galaxy-fighter", achievementType: 2, rewardItem: 0, rewardTokens: ethers.parseEther("200") },
    { name: "Tetris God", desc: "Score 5,000 in Block Drop", category: 0, threshold: 5000, gameId: "block-drop", achievementType: 3, rewardItem: 0, rewardTokens: ethers.parseEther("300") },
    { name: "Shutout King", desc: "Win 11-0 three times in Paddle Battle", category: 0, threshold: 3, gameId: "paddle-battle", achievementType: 4, rewardItem: 0, rewardTokens: ethers.parseEther("400") },

    // ── GAMES PLAYED (2) ──
    { name: "First Steps", desc: "Play 10 games", category: 1, threshold: 10, gameId: "", achievementType: 5, rewardItem: 0, rewardTokens: ethers.parseEther("50") },
    { name: "8-Bit Legend", desc: "Play 1,000 games", category: 1, threshold: 1000, gameId: "", achievementType: 6, rewardItem: 0, rewardTokens: ethers.parseEther("2500") },

    // ── WINS (1) ──
    { name: "Tournament Champion", desc: "Win 10 tournaments", category: 2, threshold: 10, gameId: "", achievementType: 7, rewardItem: 0, rewardTokens: ethers.parseEther("1000") },

    // ── STREAK (2) ──
    { name: "Week Warrior", desc: "Play 7 days in a row", category: 3, threshold: 7, gameId: "", achievementType: 8, rewardItem: 0, rewardTokens: ethers.parseEther("150") },
    { name: "Century Club", desc: "Play 100 days in a row", category: 3, threshold: 100, gameId: "", achievementType: 9, rewardItem: 0, rewardTokens: ethers.parseEther("5000") },

    // ── COLLECTION / TIER BADGES (3) ──
    { name: "8Bit Gamer", desc: "Earn 10 achievement badges - Gamer tier unlocked", category: 4, threshold: 10, gameId: "", achievementType: 10, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "8Bit Prodigy", desc: "Earn 15 achievement badges - Prodigy tier unlocked", category: 4, threshold: 15, gameId: "", achievementType: 11, rewardItem: 0, rewardTokens: ethers.parseEther("2000") },
    { name: "8Bit God", desc: "Earn 18 achievement badges - the ultimate tier", category: 4, threshold: 18, gameId: "", achievementType: 12, rewardItem: 0, rewardTokens: ethers.parseEther("25000") },

    // ── SPECIAL (3) ──
    { name: "Early Adopter", desc: "Be among the first 100 players", category: 6, threshold: 100, gameId: "", achievementType: 13, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "Game Explorer", desc: "Play all 12 games at least once", category: 6, threshold: 12, gameId: "", achievementType: 14, rewardItem: 0, rewardTokens: ethers.parseEther("300") },
    { name: "OG Member", desc: "Verified OG community member", category: 6, threshold: 1, gameId: "", achievementType: 15, rewardItem: 0, rewardTokens: ethers.parseEther("1000") },

    // ── HIDDEN (5) ──
    { name: "Lucky 777", desc: "???", category: 6, threshold: 1, gameId: "", achievementType: 16, rewardItem: 0, rewardTokens: ethers.parseEther("777") },
    { name: "Night Owl", desc: "???", category: 6, threshold: 1, gameId: "", achievementType: 17, rewardItem: 0, rewardTokens: ethers.parseEther("500") },
    { name: "Palindrome Master", desc: "???", category: 6, threshold: 1, gameId: "", achievementType: 18, rewardItem: 0, rewardTokens: ethers.parseEther("1000") },
    { name: "Double Trouble", desc: "???", category: 6, threshold: 1, gameId: "", achievementType: 19, rewardItem: 0, rewardTokens: ethers.parseEther("750") },
    { name: "The Answer", desc: "???", category: 6, threshold: 1, gameId: "", achievementType: 20, rewardItem: 0, rewardTokens: ethers.parseEther("420") },
  ];

  const startingGoalId = Number(nextId);
  const goalIdMap: { name: string; goalId: number; achievementTypeId: number }[] = [];

  for (let i = 0; i < goalConfigs.length; i++) {
    const g = goalConfigs[i];
    const expectedId = startingGoalId + i;
    const tx = await manager.createGoal(
      g.name,
      g.desc,
      g.category,
      g.threshold,
      g.gameId,
      g.achievementType,
      g.rewardItem,
      g.rewardTokens
    );
    await tx.wait();
    goalIdMap.push({ name: g.name, goalId: expectedId, achievementTypeId: g.achievementType });
    console.log(`  Goal ${expectedId}: ${g.name} (achievementType: ${g.achievementType})`);
  }

  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  DONE! New goal IDs:");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Update Firebase checkAchievements.ts GOALS array:");
  console.log("  id field values should be:", goalIdMap.map(g => g.goalId).join(", "));
  console.log();
  for (const g of goalIdMap) {
    console.log(`  { id: ${g.goalId}, name: "${g.name}", achievementTypeId: ${g.achievementTypeId} }`);
  }
  console.log();
  console.log(`Old goals 1-${existingCount}: DEACTIVATED`);
  console.log(`New goals ${startingGoalId}-${startingGoalId + 19}: ACTIVE`);
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
