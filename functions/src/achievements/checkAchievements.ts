/**
 * Achievement Verification & Minting Functions
 *
 * These Firebase functions:
 * 1. Check player progress against achievement goals
 * 2. Award achievements by calling the AchievementManager contract
 * 3. Serve achievement/goal data to the frontend
 *
 * ⚠️ SETUP:
 * 1. Deploy NFT contracts (AchievementBadges, TradeableItems, AchievementManager)
 * 2. Update ACHIEVEMENT_MANAGER_ADDRESS in config.ts
 * 3. Set the backend wallet as an authorized verifier on AchievementManager
 * 4. Set the rewards private key:
 *    firebase functions:secrets:set REWARDS_PRIVATE_KEY
 */

import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { defineSecret } from 'firebase-functions/params';
import * as admin from 'firebase-admin';
import { ethers } from 'ethers';

import {
  ACHIEVEMENT_MANAGER_ADDRESS,
  ARBITRUM_RPC_URL,
} from '../config';

const rewardsPrivateKey = defineSecret('REWARDS_PRIVATE_KEY');

// AchievementManager ABI (minimal for minting)
const ACHIEVEMENT_MANAGER_ABI = [
  'function awardAchievement(address player, uint256 goalId) external',
  'function batchAwardAchievement(address[] calldata players, uint256 goalId) external',
  'function hasCompletedGoal(address player, uint256 goalId) view returns (bool)',
  'function getPlayerAchievementCount(address player) view returns (uint256)',
  'function nextGoalId() view returns (uint256)',
];

/**
 * Goal definitions matching the on-chain goals.
 * These are used for off-chain progress checking before calling the contract.
 */
interface GoalDefinition {
  id: number;
  name: string;
  description: string;
  category: 'SCORE' | 'GAMES_PLAYED' | 'WINS' | 'STREAK' | 'COLLECTION' | 'SOCIAL' | 'SPECIAL';
  threshold: number;
  gameId: string; // empty = global
  achievementTypeId: number;
  rewardItemTypeId: number;
  rewardTokenAmount: string; // in wei
}

// Goal definitions matching deploy-nft-rewards.ts seed data
const GOALS: GoalDefinition[] = [
  { id: 1, name: "Space Rocks Rookie", description: "Score 5,000 in Space Rocks", category: "SCORE", threshold: 5000, gameId: "space-rocks", achievementTypeId: 1, rewardItemTypeId: 0, rewardTokenAmount: "100000000000000000000" },
  { id: 2, name: "Space Rocks Master", description: "Score 25,000 in Space Rocks", category: "SCORE", threshold: 25000, gameId: "space-rocks", achievementTypeId: 2, rewardItemTypeId: 0, rewardTokenAmount: "500000000000000000000" },
  { id: 3, name: "Alien Slayer", description: "Score 10,000 in Alien Assault", category: "SCORE", threshold: 10000, gameId: "alien-assault", achievementTypeId: 3, rewardItemTypeId: 0, rewardTokenAmount: "100000000000000000000" },
  { id: 4, name: "Brick Breaker Pro", description: "Score 15,000 in Brick Breaker", category: "SCORE", threshold: 15000, gameId: "brick-breaker", achievementTypeId: 4, rewardItemTypeId: 0, rewardTokenAmount: "100000000000000000000" },
  { id: 5, name: "Snake Charmer", description: "Score 50 in Pixel Snake", category: "SCORE", threshold: 50, gameId: "pixel-snake", achievementTypeId: 5, rewardItemTypeId: 0, rewardTokenAmount: "100000000000000000000" },
  { id: 6, name: "First Steps", description: "Play 10 games", category: "GAMES_PLAYED", threshold: 10, gameId: "", achievementTypeId: 10, rewardItemTypeId: 0, rewardTokenAmount: "50000000000000000000" },
  { id: 7, name: "Regular Player", description: "Play 100 games", category: "GAMES_PLAYED", threshold: 100, gameId: "", achievementTypeId: 11, rewardItemTypeId: 0, rewardTokenAmount: "250000000000000000000" },
  { id: 8, name: "Arcade Veteran", description: "Play 500 games", category: "GAMES_PLAYED", threshold: 500, gameId: "", achievementTypeId: 12, rewardItemTypeId: 0, rewardTokenAmount: "1000000000000000000000" },
  { id: 9, name: "8-Bit Legend", description: "Play 1,000 games", category: "GAMES_PLAYED", threshold: 1000, gameId: "", achievementTypeId: 13, rewardItemTypeId: 0, rewardTokenAmount: "2500000000000000000000" },
  { id: 10, name: "First Victory", description: "Win your first tournament", category: "WINS", threshold: 1, gameId: "", achievementTypeId: 20, rewardItemTypeId: 0, rewardTokenAmount: "200000000000000000000" },
  { id: 11, name: "Tournament Champion", description: "Win 10 tournaments", category: "WINS", threshold: 10, gameId: "", achievementTypeId: 21, rewardItemTypeId: 0, rewardTokenAmount: "1000000000000000000000" },
  { id: 12, name: "Week Warrior", description: "Play 7 days in a row", category: "STREAK", threshold: 7, gameId: "", achievementTypeId: 30, rewardItemTypeId: 0, rewardTokenAmount: "150000000000000000000" },
  { id: 13, name: "Monthly Grinder", description: "Play 30 days in a row", category: "STREAK", threshold: 30, gameId: "", achievementTypeId: 31, rewardItemTypeId: 0, rewardTokenAmount: "750000000000000000000" },
  { id: 14, name: "Badge Collector", description: "Earn 5 achievement badges", category: "COLLECTION", threshold: 5, gameId: "", achievementTypeId: 40, rewardItemTypeId: 0, rewardTokenAmount: "200000000000000000000" },
  { id: 15, name: "Badge Master", description: "Earn 15 achievement badges", category: "COLLECTION", threshold: 15, gameId: "", achievementTypeId: 41, rewardItemTypeId: 0, rewardTokenAmount: "1000000000000000000000" },
  { id: 16, name: "Early Adopter", description: "Be among the first 100 players", category: "SPECIAL", threshold: 100, gameId: "", achievementTypeId: 50, rewardItemTypeId: 0, rewardTokenAmount: "500000000000000000000" },
  { id: 17, name: "Game Explorer", description: "Play all 12 games at least once", category: "SPECIAL", threshold: 12, gameId: "", achievementTypeId: 51, rewardItemTypeId: 0, rewardTokenAmount: "300000000000000000000" },

  // ─── Advanced Goals ───
  { id: 18, name: "Iron Will", description: "Play 60 days in a row", category: "STREAK", threshold: 60, gameId: "", achievementTypeId: 32, rewardItemTypeId: 0, rewardTokenAmount: "2000000000000000000000" },
  { id: 19, name: "Century Club", description: "Play 100 days in a row", category: "STREAK", threshold: 100, gameId: "", achievementTypeId: 33, rewardItemTypeId: 0, rewardTokenAmount: "5000000000000000000000" },
  { id: 20, name: "Prize Hoarder", description: "Earn 100,000 8BIT from tournament winnings", category: "WINS", threshold: 100000, gameId: "", achievementTypeId: 22, rewardItemTypeId: 0, rewardTokenAmount: "2500000000000000000000" },
  { id: 21, name: "Burn Baby Burn", description: "Burn 100,000 8BIT through tournament entry fees", category: "SPECIAL", threshold: 100000, gameId: "", achievementTypeId: 52, rewardItemTypeId: 0, rewardTokenAmount: "2000000000000000000000" },
  { id: 22, name: "Perfectionist", description: "Set new personal bests in 5 games in a single day", category: "SPECIAL", threshold: 5, gameId: "", achievementTypeId: 53, rewardItemTypeId: 0, rewardTokenAmount: "400000000000000000000" },
  { id: 23, name: "OG Member", description: "Verified OG community member", category: "SPECIAL", threshold: 1, gameId: "", achievementTypeId: 54, rewardItemTypeId: 0, rewardTokenAmount: "1000000000000000000000" },
  { id: 24, name: "The Completionist", description: "Earn every other achievement badge", category: "COLLECTION", threshold: 23, gameId: "", achievementTypeId: 42, rewardItemTypeId: 0, rewardTokenAmount: "10000000000000000000000" },
];

/**
 * Get player's progress for a specific goal from Firestore
 */
async function getPlayerProgress(walletAddress: string, goal: GoalDefinition): Promise<number> {
  const db = admin.firestore();
  const addr = walletAddress.toLowerCase();

  switch (goal.category) {
    case 'SCORE': {
      // Get best score for the specific game
      const scoresSnap = await db.collection('scores')
        .where('address', '==', addr)
        .where('gameId', '==', goal.gameId)
        .orderBy('score', 'desc')
        .limit(1)
        .get();

      if (scoresSnap.empty) return 0;
      return scoresSnap.docs[0].data().score || 0;
    }

    case 'GAMES_PLAYED': {
      // Count total games played
      const statsDoc = await db.collection('playerStats').doc(addr).get();
      if (!statsDoc.exists) return 0;
      return statsDoc.data()?.totalGamesPlayed || 0;
    }

    case 'WINS': {
      const statsDoc = await db.collection('playerStats').doc(addr).get();
      if (!statsDoc.exists) return 0;
      const stats = statsDoc.data()!;

      if (goal.achievementTypeId === 22) {
        // Prize Hoarder: total 8BIT earned from tournament prizes
        return stats.totalTournamentEarnings || 0;
      }

      // Default: count tournament wins
      return stats.tournamentWins || 0;
    }

    case 'STREAK': {
      // Get current daily play streak
      const statsDoc = await db.collection('playerStats').doc(addr).get();
      if (!statsDoc.exists) return 0;
      return statsDoc.data()?.currentStreak || 0;
    }

    case 'COLLECTION': {
      // Count achievement badges earned (from Firestore achievements collection)
      const achievementsSnap = await db.collection('achievements')
        .where('walletAddress', '==', addr)
        .get();
      const badgeCount = achievementsSnap.size;

      if (goal.achievementTypeId === 42) {
        // The Completionist: must have ALL other badges (exclude self to avoid circular dep)
        // Total goals minus The Completionist itself = 23
        return badgeCount;
      }

      return badgeCount;
    }

    case 'SPECIAL': {
      if (goal.achievementTypeId === 50) {
        // Early Adopter: check player registration order
        const statsDoc = await db.collection('playerStats').doc(addr).get();
        if (!statsDoc.exists) return 999; // Not eligible
        return statsDoc.data()?.registrationOrder || 999;
      }

      if (goal.achievementTypeId === 51) {
        // Game Explorer: count unique games played
        const statsDoc = await db.collection('playerStats').doc(addr).get();
        if (!statsDoc.exists) return 0;
        const uniqueGames = statsDoc.data()?.uniqueGamesPlayed || [];
        return Array.isArray(uniqueGames) ? uniqueGames.length : 0;
      }

      if (goal.achievementTypeId === 52) {
        // Burn Baby Burn: total 8BIT burned via tournament entry fees
        const statsDoc = await db.collection('playerStats').doc(addr).get();
        if (!statsDoc.exists) return 0;
        return statsDoc.data()?.totalTournamentBurned || 0;
      }

      if (goal.achievementTypeId === 53) {
        // Perfectionist: check if player set 5+ personal bests today
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const pbSnap = await db.collection('personalBests')
          .where('walletAddress', '==', addr)
          .where('setAt', '>=', startOfDay)
          .get();
        // Count unique game IDs with PBs today
        const uniqueGamesWithPB = new Set(pbSnap.docs.map(d => d.data().gameId));
        return uniqueGamesWithPB.size;
      }

      if (goal.achievementTypeId === 54) {
        // OG Member: check if wallet is flagged as OG in Firestore
        const ogDoc = await db.collection('ogMembers').doc(addr).get();
        return ogDoc.exists ? 1 : 0;
      }

      return 0;
    }

    default:
      return 0;
  }
}

/**
 * Check if a player meets a goal threshold
 */
function meetsThreshold(progress: number, goal: GoalDefinition): boolean {
  if (goal.category === 'SPECIAL' && goal.achievementTypeId === 50) {
    // Early Adopter: registration order must be <= threshold
    return progress <= goal.threshold;
  }
  return progress >= goal.threshold;
}

// ═══════════════════════════════════════════════════════════
// CALLABLE FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * Get all achievements and player completion status
 * Called by the frontend useAchievements hook
 */
export const getAchievements = onCall(async (request) => {
  const { walletAddress } = request.data;

  if (!walletAddress) {
    throw new HttpsError('invalid-argument', 'walletAddress is required');
  }

  const db = admin.firestore();
  const addr = walletAddress.toLowerCase();

  // Get player's completed achievements from Firestore
  const completedSnap = await db.collection('achievements')
    .where('walletAddress', '==', addr)
    .get();

  const completedGoalIds = new Set(
    completedSnap.docs.map(doc => doc.data().goalId)
  );

  // Build goals list with completion status
  const goals = GOALS.map(goal => ({
    ...goal,
    completed: completedGoalIds.has(goal.id),
  }));

  return { goals };
});

/**
 * Check if a player has a specific achievement
 */
export const checkAchievement = onCall(async (request) => {
  const { walletAddress, achievementTypeId } = request.data;

  if (!walletAddress || achievementTypeId === undefined) {
    throw new HttpsError('invalid-argument', 'walletAddress and achievementTypeId are required');
  }

  const db = admin.firestore();
  const addr = walletAddress.toLowerCase();

  const snap = await db.collection('achievements')
    .where('walletAddress', '==', addr)
    .where('achievementTypeId', '==', achievementTypeId)
    .limit(1)
    .get();

  return { hasAchievement: !snap.empty };
});

// ═══════════════════════════════════════════════════════════
// SCHEDULED ACHIEVEMENT CHECKER
// ═══════════════════════════════════════════════════════════

/**
 * Scheduled function that checks all active players for achievement progress
 * and awards achievements on-chain when goals are met.
 *
 * Runs every hour.
 */
export const checkAndAwardAchievements = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'UTC',
    secrets: [rewardsPrivateKey],
  },
  async () => {
    if (ACHIEVEMENT_MANAGER_ADDRESS === '0x0000000000000000000000000000000000000000') {
      console.log('AchievementManager not deployed yet, skipping');
      return;
    }

    const db = admin.firestore();

    // Get all players who have played in the last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    const recentPlayersSnap = await db.collection('playerStats')
      .where('lastPlayedAt', '>=', oneDayAgo)
      .get();

    if (recentPlayersSnap.empty) {
      console.log('No recent players to check');
      return;
    }

    // Set up contract connection
    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
    const wallet = new ethers.Wallet(rewardsPrivateKey.value(), provider);
    const contract = new ethers.Contract(ACHIEVEMENT_MANAGER_ADDRESS, ACHIEVEMENT_MANAGER_ABI, wallet);

    let totalAwarded = 0;

    for (const playerDoc of recentPlayersSnap.docs) {
      const walletAddress = playerDoc.id;

      // Get already completed achievements for this player
      const completedSnap = await db.collection('achievements')
        .where('walletAddress', '==', walletAddress)
        .get();
      const completedGoalIds = new Set(
        completedSnap.docs.map(d => d.data().goalId)
      );

      for (const goal of GOALS) {
        // Skip already completed goals
        if (completedGoalIds.has(goal.id)) continue;

        // Check progress
        const progress = await getPlayerProgress(walletAddress, goal);
        if (!meetsThreshold(progress, goal)) continue;

        // Double-check on-chain (in case Firestore is out of sync)
        try {
          const alreadyCompleted = await contract.hasCompletedGoal(walletAddress, goal.id);
          if (alreadyCompleted) {
            // Update Firestore to match
            await db.collection('achievements').add({
              walletAddress,
              goalId: goal.id,
              achievementTypeId: goal.achievementTypeId,
              awardedAt: admin.firestore.FieldValue.serverTimestamp(),
              source: 'sync',
            });
            continue;
          }
        } catch (err) {
          console.error(`Error checking on-chain status for ${walletAddress} goal ${goal.id}:`, err);
          continue;
        }

        // Award the achievement on-chain
        try {
          console.log(`Awarding goal ${goal.id} (${goal.name}) to ${walletAddress}`);
          const tx = await contract.awardAchievement(walletAddress, goal.id);
          const receipt = await tx.wait();

          // Record in Firestore
          await db.collection('achievements').add({
            walletAddress,
            goalId: goal.id,
            achievementTypeId: goal.achievementTypeId,
            name: goal.name,
            awardedAt: admin.firestore.FieldValue.serverTimestamp(),
            txHash: receipt.hash,
            source: 'auto',
          });

          totalAwarded++;
          console.log(`Awarded: ${goal.name} to ${walletAddress} (tx: ${receipt.hash})`);
        } catch (err) {
          console.error(`Failed to award goal ${goal.id} to ${walletAddress}:`, err);
        }
      }
    }

    console.log(`Achievement check complete. Awarded ${totalAwarded} achievements.`);
  }
);

/**
 * Manual trigger for achievement checking (admin use)
 */
export const manualCheckAchievements = onCall(
  { secrets: [rewardsPrivateKey] },
  async (request) => {
    const { walletAddress } = request.data;

    if (!walletAddress) {
      throw new HttpsError('invalid-argument', 'walletAddress is required');
    }

    if (ACHIEVEMENT_MANAGER_ADDRESS === '0x0000000000000000000000000000000000000000') {
      throw new HttpsError('failed-precondition', 'AchievementManager not deployed');
    }

    const db = admin.firestore();
    const addr = walletAddress.toLowerCase();

    // Get completed achievements
    const completedSnap = await db.collection('achievements')
      .where('walletAddress', '==', addr)
      .get();
    const completedGoalIds = new Set(
      completedSnap.docs.map(d => d.data().goalId)
    );

    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
    const wallet = new ethers.Wallet(rewardsPrivateKey.value(), provider);
    const contract = new ethers.Contract(ACHIEVEMENT_MANAGER_ADDRESS, ACHIEVEMENT_MANAGER_ABI, wallet);

    const results: { goalId: number; name: string; awarded: boolean; error?: string }[] = [];

    for (const goal of GOALS) {
      if (completedGoalIds.has(goal.id)) {
        results.push({ goalId: goal.id, name: goal.name, awarded: false, error: 'Already completed' });
        continue;
      }

      const progress = await getPlayerProgress(addr, goal);
      if (!meetsThreshold(progress, goal)) {
        results.push({ goalId: goal.id, name: goal.name, awarded: false, error: `Progress: ${progress}/${goal.threshold}` });
        continue;
      }

      try {
        const tx = await contract.awardAchievement(addr, goal.id);
        const receipt = await tx.wait();

        await db.collection('achievements').add({
          walletAddress: addr,
          goalId: goal.id,
          achievementTypeId: goal.achievementTypeId,
          name: goal.name,
          awardedAt: admin.firestore.FieldValue.serverTimestamp(),
          txHash: receipt.hash,
          source: 'manual',
        });

        results.push({ goalId: goal.id, name: goal.name, awarded: true });
      } catch (err: any) {
        results.push({ goalId: goal.id, name: goal.name, awarded: false, error: err.message });
      }
    }

    return { results };
  }
);
