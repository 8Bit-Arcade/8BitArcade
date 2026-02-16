/**
 * Achievement Verification & Minting Functions
 *
 * These Firebase functions:
 * 1. Check player progress against achievement goals
 * 2. Award achievements by calling the AchievementManager contract
 * 3. Serve achievement/goal data to the frontend
 *
 * SETUP:
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
  isHidden?: boolean; // hidden achievements show as "???" until earned
}

// 20 Goals: achievementTypeId 1-20 (sequential)
// goalId (id field) = on-chain ID assigned by AchievementManager
// After running reset-goals.ts with 17 existing goals, new goals start at ID 18
// If you re-run reset-goals.ts, update GOAL_ID_OFFSET to match the script output
const GOAL_ID_OFFSET = 18; // First goalId assigned by reset-goals.ts

const GOALS: GoalDefinition[] = [
  // ── SCORE (4) ──
  { id: GOAL_ID_OFFSET + 0, name: "Space Rocks Master", description: "Score 25,000 in Space Rocks", category: "SCORE", threshold: 25000, gameId: "space-rocks", achievementTypeId: 1, rewardItemTypeId: 0, rewardTokenAmount: "500000000000000000000" },
  { id: GOAL_ID_OFFSET + 1, name: "Galaxy Ace", description: "Score 50,000 in Galaxy Fighter", category: "SCORE", threshold: 50000, gameId: "galaxy-fighter", achievementTypeId: 2, rewardItemTypeId: 0, rewardTokenAmount: "200000000000000000000" },
  { id: GOAL_ID_OFFSET + 2, name: "Tetris God", description: "Score 5,000 in Block Drop", category: "SCORE", threshold: 5000, gameId: "block-drop", achievementTypeId: 3, rewardItemTypeId: 0, rewardTokenAmount: "300000000000000000000" },
  { id: GOAL_ID_OFFSET + 3, name: "Shutout King", description: "Win 11-0 three times in Paddle Battle", category: "SCORE", threshold: 3, gameId: "paddle-battle", achievementTypeId: 4, rewardItemTypeId: 0, rewardTokenAmount: "400000000000000000000" },

  // ── GAMES PLAYED (2) ──
  { id: GOAL_ID_OFFSET + 4, name: "First Steps", description: "Play 10 games", category: "GAMES_PLAYED", threshold: 10, gameId: "", achievementTypeId: 5, rewardItemTypeId: 0, rewardTokenAmount: "50000000000000000000" },
  { id: GOAL_ID_OFFSET + 5, name: "8-Bit Legend", description: "Play 1,000 games", category: "GAMES_PLAYED", threshold: 1000, gameId: "", achievementTypeId: 6, rewardItemTypeId: 0, rewardTokenAmount: "2500000000000000000000" },

  // ── WINS (1) ──
  { id: GOAL_ID_OFFSET + 6, name: "Tournament Champion", description: "Win 10 tournaments", category: "WINS", threshold: 10, gameId: "", achievementTypeId: 7, rewardItemTypeId: 0, rewardTokenAmount: "1000000000000000000000" },

  // ── STREAK (2) ──
  { id: GOAL_ID_OFFSET + 7, name: "Week Warrior", description: "Play 7 days in a row", category: "STREAK", threshold: 7, gameId: "", achievementTypeId: 8, rewardItemTypeId: 0, rewardTokenAmount: "150000000000000000000" },
  { id: GOAL_ID_OFFSET + 8, name: "Century Club", description: "Play 100 days in a row", category: "STREAK", threshold: 100, gameId: "", achievementTypeId: 9, rewardItemTypeId: 0, rewardTokenAmount: "5000000000000000000000" },

  // ── COLLECTION / TIER BADGES (3) ──
  { id: GOAL_ID_OFFSET + 9, name: "8Bit Gamer", description: "Earn 10 achievement badges - Gamer tier unlocked", category: "COLLECTION", threshold: 10, gameId: "", achievementTypeId: 10, rewardItemTypeId: 0, rewardTokenAmount: "500000000000000000000" },
  { id: GOAL_ID_OFFSET + 10, name: "8Bit Prodigy", description: "Earn 15 achievement badges - Prodigy tier unlocked", category: "COLLECTION", threshold: 15, gameId: "", achievementTypeId: 11, rewardItemTypeId: 0, rewardTokenAmount: "2000000000000000000000" },
  { id: GOAL_ID_OFFSET + 11, name: "8Bit God", description: "Earn 18 achievement badges - the ultimate tier", category: "COLLECTION", threshold: 18, gameId: "", achievementTypeId: 12, rewardItemTypeId: 0, rewardTokenAmount: "25000000000000000000000" },

  // ── SPECIAL (3) ──
  { id: GOAL_ID_OFFSET + 12, name: "Early Adopter", description: "Be among the first 100 players", category: "SPECIAL", threshold: 100, gameId: "", achievementTypeId: 13, rewardItemTypeId: 0, rewardTokenAmount: "500000000000000000000" },
  { id: GOAL_ID_OFFSET + 13, name: "Game Explorer", description: "Play all 12 games at least once", category: "SPECIAL", threshold: 12, gameId: "", achievementTypeId: 14, rewardItemTypeId: 0, rewardTokenAmount: "300000000000000000000" },
  { id: GOAL_ID_OFFSET + 14, name: "OG Member", description: "Verified OG community member", category: "SPECIAL", threshold: 1, gameId: "", achievementTypeId: 15, rewardItemTypeId: 0, rewardTokenAmount: "1000000000000000000000" },

  // ── HIDDEN (5) ──
  { id: GOAL_ID_OFFSET + 15, name: "Lucky 777", description: "Score exactly 777 in any game", category: "SPECIAL", threshold: 1, gameId: "", achievementTypeId: 16, rewardItemTypeId: 0, rewardTokenAmount: "777000000000000000000", isHidden: true },
  { id: GOAL_ID_OFFSET + 16, name: "Night Owl", description: "Play a game between 3:00-3:05 AM UTC", category: "SPECIAL", threshold: 1, gameId: "", achievementTypeId: 17, rewardItemTypeId: 0, rewardTokenAmount: "500000000000000000000", isHidden: true },
  { id: GOAL_ID_OFFSET + 17, name: "Palindrome Master", description: "Score a palindrome number over 1000 in any game", category: "SPECIAL", threshold: 1, gameId: "", achievementTypeId: 18, rewardItemTypeId: 0, rewardTokenAmount: "1000000000000000000000", isHidden: true },
  { id: GOAL_ID_OFFSET + 18, name: "Double Trouble", description: "Get the exact same score in two different games", category: "SPECIAL", threshold: 1, gameId: "", achievementTypeId: 19, rewardItemTypeId: 0, rewardTokenAmount: "750000000000000000000", isHidden: true },
  { id: GOAL_ID_OFFSET + 19, name: "The Answer", description: "Score exactly 42 in any game", category: "SPECIAL", threshold: 1, gameId: "", achievementTypeId: 20, rewardItemTypeId: 0, rewardTokenAmount: "420000000000000000000", isHidden: true },
];

/**
 * Check if a number is a palindrome
 */
function isPalindrome(n: number): boolean {
  const s = n.toString();
  return s === s.split('').reverse().join('');
}

/**
 * Get player's progress for a specific goal from Firestore
 */
async function getPlayerProgress(walletAddress: string, goal: GoalDefinition): Promise<number> {
  const db = admin.firestore();
  const addr = walletAddress.toLowerCase();

  switch (goal.category) {
    case 'SCORE': {
      // Shutout King (ID 4): count perfect wins (11-0) in Paddle Battle
      if (goal.achievementTypeId === 4) {
        const statsDoc = await db.collection('playerStats').doc(addr).get();
        if (!statsDoc.exists) return 0;
        return statsDoc.data()?.paddleBattleShutouts || 0;
      }

      // Default: get best score for the specific game
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
      const statsDoc = await db.collection('playerStats').doc(addr).get();
      if (!statsDoc.exists) return 0;
      return statsDoc.data()?.totalGamesPlayed || 0;
    }

    case 'WINS': {
      const statsDoc = await db.collection('playerStats').doc(addr).get();
      if (!statsDoc.exists) return 0;
      return statsDoc.data()?.tournamentWins || 0;
    }

    case 'STREAK': {
      const statsDoc = await db.collection('playerStats').doc(addr).get();
      if (!statsDoc.exists) return 0;
      return statsDoc.data()?.currentStreak || 0;
    }

    case 'COLLECTION': {
      const achievementsSnap = await db.collection('achievements')
        .where('walletAddress', '==', addr)
        .get();
      return achievementsSnap.size;
    }

    case 'SPECIAL': {
      // Early Adopter (ID 13)
      if (goal.achievementTypeId === 13) {
        const statsDoc = await db.collection('playerStats').doc(addr).get();
        if (!statsDoc.exists) return 999;
        return statsDoc.data()?.registrationOrder || 999;
      }

      // Game Explorer (ID 14)
      if (goal.achievementTypeId === 14) {
        const statsDoc = await db.collection('playerStats').doc(addr).get();
        if (!statsDoc.exists) return 0;
        const uniqueGames = statsDoc.data()?.uniqueGamesPlayed || [];
        return Array.isArray(uniqueGames) ? uniqueGames.length : 0;
      }

      // OG Member (ID 15)
      if (goal.achievementTypeId === 15) {
        const ogDoc = await db.collection('ogMembers').doc(addr).get();
        return ogDoc.exists ? 1 : 0;
      }

      // ── HIDDEN ACHIEVEMENTS ──

      // Lucky 777 (ID 16): score exactly 777
      if (goal.achievementTypeId === 16) {
        const snap = await db.collection('scores')
          .where('address', '==', addr)
          .where('score', '==', 777)
          .limit(1)
          .get();
        return snap.empty ? 0 : 1;
      }

      // Night Owl (ID 17): play between 3:00-3:05 AM UTC
      if (goal.achievementTypeId === 17) {
        const scoresSnap = await db.collection('scores')
          .where('address', '==', addr)
          .orderBy('playedAt', 'desc')
          .limit(200)
          .get();

        for (const doc of scoresSnap.docs) {
          const playedAt = doc.data().playedAt;
          if (playedAt && playedAt.toDate) {
            const date = playedAt.toDate() as Date;
            const hour = date.getUTCHours();
            const minute = date.getUTCMinutes();
            if (hour === 3 && minute < 5) {
              return 1;
            }
          }
        }
        return 0;
      }

      // Palindrome Master (ID 18): palindrome score > 1000
      if (goal.achievementTypeId === 18) {
        const scoresSnap = await db.collection('scores')
          .where('address', '==', addr)
          .where('score', '>', 1000)
          .orderBy('score', 'desc')
          .limit(500)
          .get();

        for (const doc of scoresSnap.docs) {
          const score = doc.data().score;
          if (score > 1000 && isPalindrome(score)) {
            return 1;
          }
        }
        return 0;
      }

      // Double Trouble (ID 19): same score in 2 different games
      if (goal.achievementTypeId === 19) {
        const scoresSnap = await db.collection('scores')
          .where('address', '==', addr)
          .orderBy('score', 'desc')
          .limit(500)
          .get();

        const scoreToGames = new Map<number, Set<string>>();
        for (const doc of scoresSnap.docs) {
          const { score, gameId } = doc.data();
          if (!scoreToGames.has(score)) {
            scoreToGames.set(score, new Set());
          }
          scoreToGames.get(score)!.add(gameId);
        }
        for (const games of scoreToGames.values()) {
          if (games.size >= 2) return 1;
        }
        return 0;
      }

      // The Answer (ID 20): score exactly 42
      if (goal.achievementTypeId === 20) {
        const snap = await db.collection('scores')
          .where('address', '==', addr)
          .where('score', '==', 42)
          .limit(1)
          .get();
        return snap.empty ? 0 : 1;
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
  // Early Adopter: registration order must be <= threshold (lower = better)
  if (goal.achievementTypeId === 13) {
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
export const getAchievements = onCall(async (request: any) => {
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
    completedSnap.docs.map((doc: any) => doc.data().goalId)
  );

  // Build goals list with completion status
  // Hidden achievements show "???" unless the player has already earned them
  const goals = GOALS.map(goal => {
    const completed = completedGoalIds.has(goal.id);
    const isHidden = goal.isHidden && !completed;

    return {
      ...goal,
      completed,
      name: isHidden ? '???' : goal.name,
      description: isHidden ? 'This is a secret achievement. Keep playing to discover it!' : goal.description,
      isHidden: goal.isHidden || false,
    };
  });

  return { goals };
});

/**
 * Check if a player has a specific achievement
 */
export const checkAchievement = onCall(async (request: any) => {
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
        completedSnap.docs.map((d: any) => d.data().goalId)
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
          const label = goal.isHidden ? `[HIDDEN] ${goal.name}` : goal.name;
          console.log(`Awarding goal ${goal.id} (${label}) to ${walletAddress}`);
          const tx = await contract.awardAchievement(walletAddress, goal.id);
          const receipt = await tx.wait();

          await db.collection('achievements').add({
            walletAddress,
            goalId: goal.id,
            achievementTypeId: goal.achievementTypeId,
            name: goal.name,
            awardedAt: admin.firestore.FieldValue.serverTimestamp(),
            txHash: receipt.hash,
            source: 'auto',
            isHidden: goal.isHidden || false,
          });

          totalAwarded++;
          console.log(`Awarded: ${label} to ${walletAddress} (tx: ${receipt.hash})`);
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
  async (request: any) => {
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
      completedSnap.docs.map((d: any) => d.data().goalId)
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
          isHidden: goal.isHidden || false,
        });

        results.push({ goalId: goal.id, name: goal.name, awarded: true });
      } catch (err: any) {
        results.push({ goalId: goal.id, name: goal.name, awarded: false, error: err.message });
      }
    }

    return { results };
  }
);
