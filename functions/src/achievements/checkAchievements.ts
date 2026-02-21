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

// AchievementManager ABI (minimal for minting + batch status check)
const ACHIEVEMENT_MANAGER_ABI = [
  'function awardAchievement(address player, uint256 goalId) external',
  'function batchAwardAchievement(address[] calldata players, uint256 goalId) external',
  'function hasCompletedGoal(address player, uint256 goalId) view returns (bool)',
  'function getPlayerGoalStatuses(address player, uint256[] goalIds) view returns (bool[])',
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
// Fresh manager deployed 2026-02-21: goals are 1-20 (nextGoalId started at 1)
const GOAL_ID_OFFSET = 1;

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
 * Get player's progress for a specific goal from Firestore.
 *
 * Collection mapping:
 *   scores/{wallet}     → { games: { [gameId]: { bestScore, totalPlays, lastPlayed } }, totalGames }
 *   users/{wallet}      → { totalGamesPlayed, lastActive, createdAt }
 *   sessions            → { player, gameId, finalScore, startedAt, completedAt }
 *   tournaments         → { winnerId, status }
 *   ogMembers/{wallet}  → existence check
 *   achievements        → { walletAddress, goalId, achievementTypeId }
 */
async function getPlayerProgress(walletAddress: string, goal: GoalDefinition): Promise<number> {
  const db = admin.firestore();
  const addr = walletAddress.toLowerCase();

  switch (goal.category) {
    case 'SCORE': {
      // Shutout King (achievementTypeId 4): needs game-specific tracking not yet implemented
      if (goal.achievementTypeId === 4) {
        // Paddle Battle shutouts require game-specific event tracking
        // For now, check if a dedicated counter exists on the user doc
        const userDoc = await db.collection('users').doc(addr).get();
        if (!userDoc.exists) return 0;
        return userDoc.data()?.paddleBattleShutouts || 0;
      }

      // Default: get best score for the specific game from scores/{wallet}.games.{gameId}.bestScore
      const scoreDoc = await db.collection('scores').doc(addr).get();
      if (!scoreDoc.exists) return 0;
      const games = scoreDoc.data()?.games;
      if (!games || !games[goal.gameId]) return 0;
      return games[goal.gameId].bestScore || 0;
    }

    case 'GAMES_PLAYED': {
      // users/{wallet}.totalGamesPlayed tracks all games (ranked, free, tournament)
      const userDoc = await db.collection('users').doc(addr).get();
      if (!userDoc.exists) return 0;
      return userDoc.data()?.totalGamesPlayed || 0;
    }

    case 'WINS': {
      // Count finalized tournaments where this player won
      const winsSnap = await db.collection('tournaments')
        .where('winnerId', '==', addr)
        .where('status', '==', 'finalized')
        .get();
      return winsSnap.size;
    }

    case 'STREAK': {
      // Compute consecutive play days from completed sessions
      const sessionsSnap = await db.collection('sessions')
        .where('player', '==', addr)
        .where('completedAt', '!=', null)
        .orderBy('completedAt', 'desc')
        .limit(500)
        .get();

      if (sessionsSnap.empty) return 0;

      // Extract unique UTC dates
      const dates = new Set<string>();
      for (const doc of sessionsSnap.docs) {
        const completedAt = doc.data().completedAt;
        if (completedAt && completedAt.toDate) {
          const d = completedAt.toDate() as Date;
          dates.add(`${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`);
        }
      }

      // Sort dates descending and count consecutive days from today
      const today = new Date();
      const todayKey = `${today.getUTCFullYear()}-${today.getUTCMonth()}-${today.getUTCDate()}`;

      // Build sorted date list
      const sortedDates = Array.from(dates).sort().reverse();
      if (sortedDates.length === 0) return 0;

      // Check if the most recent play day is today or yesterday
      const mostRecentDate = sortedDates[0];
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const yesterdayKey = `${yesterday.getUTCFullYear()}-${yesterday.getUTCMonth()}-${yesterday.getUTCDate()}`;

      if (mostRecentDate !== todayKey && mostRecentDate !== yesterdayKey) {
        return 0; // Streak is broken
      }

      // Count consecutive days backwards
      let streak = 1;
      for (let i = 1; i < sortedDates.length; i++) {
        // Check if sortedDates[i] is exactly 1 day before sortedDates[i-1]
        const prevParts = sortedDates[i - 1].split('-').map(Number);
        const currParts = sortedDates[i].split('-').map(Number);
        const prevDate = new Date(Date.UTC(prevParts[0], prevParts[1], prevParts[2]));
        const currDate = new Date(Date.UTC(currParts[0], currParts[1], currParts[2]));
        const diffDays = (prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24);

        if (Math.abs(diffDays - 1) < 0.01) {
          streak++;
        } else {
          break;
        }
      }
      return streak;
    }

    case 'COLLECTION': {
      const achievementsSnap = await db.collection('achievements')
        .where('walletAddress', '==', addr)
        .get();
      return achievementsSnap.size;
    }

    case 'SPECIAL': {
      // Early Adopter (achievementTypeId 13): be among first 100 users by createdAt
      if (goal.achievementTypeId === 13) {
        const earlyUsersSnap = await db.collection('users')
          .orderBy('createdAt', 'asc')
          .limit(100)
          .get();

        let position = 999;
        earlyUsersSnap.docs.forEach((doc, index) => {
          if (doc.id === addr) {
            position = index + 1; // 1-indexed
          }
        });
        return position;
      }

      // Game Explorer (achievementTypeId 14): play all 12 games at least once
      if (goal.achievementTypeId === 14) {
        const scoreDoc = await db.collection('scores').doc(addr).get();
        if (!scoreDoc.exists) return 0;
        const games = scoreDoc.data()?.games;
        if (!games) return 0;
        return Object.keys(games).length;
      }

      // OG Member (achievementTypeId 15): Discord user who linked wallet before OG cutoff
      // OG cutoff: 2026-02-25 (matches discord-bot config OG_CUTOFF_DATE)
      if (goal.achievementTypeId === 15) {
        const OG_CUTOFF = new Date('2026-02-25T23:59:59Z');
        const linkSnap = await db.collection('discord_links')
          .where('walletAddress', '==', addr)
          .limit(1)
          .get();
        if (linkSnap.empty) return 0;
        const linkedAt = linkSnap.docs[0].data().linkedAt;
        if (linkedAt && linkedAt.toDate && linkedAt.toDate() < OG_CUTOFF) {
          return 1;
        }
        return 0;
      }

      // ── HIDDEN ACHIEVEMENTS ──

      // Lucky 777 (achievementTypeId 16): score exactly 777
      if (goal.achievementTypeId === 16) {
        const snap = await db.collection('sessions')
          .where('player', '==', addr)
          .where('finalScore', '==', 777)
          .limit(1)
          .get();
        return snap.empty ? 0 : 1;
      }

      // Night Owl (achievementTypeId 17): play between 3:00-3:05 AM UTC
      if (goal.achievementTypeId === 17) {
        const sessionsSnap = await db.collection('sessions')
          .where('player', '==', addr)
          .orderBy('startedAt', 'desc')
          .limit(200)
          .get();

        for (const doc of sessionsSnap.docs) {
          const startedAt = doc.data().startedAt;
          if (startedAt && startedAt.toDate) {
            const date = startedAt.toDate() as Date;
            const hour = date.getUTCHours();
            const minute = date.getUTCMinutes();
            if (hour === 3 && minute < 5) {
              return 1;
            }
          }
        }
        return 0;
      }

      // Palindrome Master (achievementTypeId 18): palindrome score > 1000
      if (goal.achievementTypeId === 18) {
        const scoreDoc = await db.collection('scores').doc(addr).get();
        if (!scoreDoc.exists) return 0;
        const games = scoreDoc.data()?.games;
        if (!games) return 0;

        for (const gameId of Object.keys(games)) {
          const best = games[gameId].bestScore;
          if (best > 1000 && isPalindrome(best)) {
            return 1;
          }
        }
        return 0;
      }

      // Double Trouble (achievementTypeId 19): same score in 2 different games
      if (goal.achievementTypeId === 19) {
        const scoreDoc = await db.collection('scores').doc(addr).get();
        if (!scoreDoc.exists) return 0;
        const games = scoreDoc.data()?.games;
        if (!games) return 0;

        const seenScores = new Map<number, string>();
        for (const gameId of Object.keys(games)) {
          const best = games[gameId].bestScore;
          if (best && seenScores.has(best) && seenScores.get(best) !== gameId) {
            return 1;
          }
          seenScores.set(best, gameId);
        }
        return 0;
      }

      // The Answer (achievementTypeId 20): score exactly 42
      if (goal.achievementTypeId === 20) {
        const snap = await db.collection('sessions')
          .where('player', '==', addr)
          .where('finalScore', '==', 42)
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
 *
 * Uses on-chain getPlayerGoalStatuses() as the source of truth for completion
 * status, NOT Firestore. This ensures accuracy after contract migrations.
 */
export const getAchievements = onCall(async (request: any) => {
  const { walletAddress } = request.data;

  if (!walletAddress) {
    throw new HttpsError('invalid-argument', 'walletAddress is required');
  }

  const addr = walletAddress.toLowerCase();

  // Check on-chain completion status (source of truth)
  let completedGoalIds = new Set<number>();
  try {
    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
    const contract = new ethers.Contract(ACHIEVEMENT_MANAGER_ADDRESS, ACHIEVEMENT_MANAGER_ABI, provider);
    const goalIds = GOALS.map(g => g.id);
    const statuses: boolean[] = await contract.getPlayerGoalStatuses(addr, goalIds);
    for (let i = 0; i < GOALS.length; i++) {
      if (statuses[i]) completedGoalIds.add(GOALS[i].id);
    }
  } catch (err) {
    console.error('Error checking on-chain goal statuses, falling back to Firestore:', err);
    // Fallback: use Firestore if on-chain check fails
    const db = admin.firestore();
    const completedSnap = await db.collection('achievements')
      .where('walletAddress', '==', addr)
      .get();
    completedGoalIds = new Set(
      completedSnap.docs.map((doc: any) => doc.data().goalId)
    );
  }

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

  const addr = walletAddress.toLowerCase();

  // Find the goal with this achievementTypeId
  const goal = GOALS.find(g => g.achievementTypeId === achievementTypeId);
  if (!goal) {
    return { hasAchievement: false };
  }

  // Check on-chain (source of truth)
  try {
    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
    const contract = new ethers.Contract(ACHIEVEMENT_MANAGER_ADDRESS, ACHIEVEMENT_MANAGER_ABI, provider);
    const hasCompleted = await contract.hasCompletedGoal(addr, goal.id);
    return { hasAchievement: hasCompleted };
  } catch (err) {
    console.error('Error checking on-chain achievement:', err);
    return { hasAchievement: false };
  }
});

// ═══════════════════════════════════════════════════════════
// SCHEDULED ACHIEVEMENT CHECKER
// ═══════════════════════════════════════════════════════════

/**
 * Scheduled function that checks all active players for achievement progress
 * and awards achievements on-chain when goals are met.
 *
 * Runs every 5 minutes.
 */
export const checkAndAwardAchievements = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'UTC',
    secrets: [rewardsPrivateKey],
  },
  async () => {
    if (ACHIEVEMENT_MANAGER_ADDRESS === '0x0000000000000000000000000000000000000000') {
      console.log('AchievementManager not deployed yet, skipping');
      return;
    }

    const db = admin.firestore();

    // Collect all unique wallet addresses from multiple sources
    const walletSet = new Set<string>();

    // 1. Recent players (active in last 24 hours) — from users collection
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    const recentPlayersSnap = await db.collection('users')
      .where('lastActive', '>=', oneDayAgo)
      .get();
    for (const doc of recentPlayersSnap.docs) {
      walletSet.add(doc.id.toLowerCase());
    }

    // 2. Discord-linked wallets
    const discordLinksSnap = await db.collection('discord_links').get();
    for (const doc of discordLinksSnap.docs) {
      const addr = doc.data().walletAddress;
      if (addr) walletSet.add(addr.toLowerCase());
    }

    // 3. Telegram-linked wallets
    const telegramLinksSnap = await db.collection('telegram_links').get();
    for (const doc of telegramLinksSnap.docs) {
      const addr = doc.data().walletAddress;
      if (addr) walletSet.add(addr.toLowerCase());
    }

    const allWallets = Array.from(walletSet);
    console.log(`Checking achievements for ${allWallets.length} wallets (${recentPlayersSnap.size} recent, ${discordLinksSnap.size} discord, ${telegramLinksSnap.size} telegram)`);

    if (allWallets.length === 0) {
      console.log('No wallets to check');
      return;
    }

    // Set up contract connection
    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
    const wallet = new ethers.Wallet(rewardsPrivateKey.value(), provider);
    const contract = new ethers.Contract(ACHIEVEMENT_MANAGER_ADDRESS, ACHIEVEMENT_MANAGER_ABI, wallet);

    let totalAwarded = 0;
    const goalIds = GOALS.map(g => g.id);

    for (const walletAddress of allWallets) {

      // Get on-chain completion status (source of truth, one RPC call per wallet)
      let completedStatuses: boolean[];
      try {
        completedStatuses = await contract.getPlayerGoalStatuses(walletAddress, goalIds);
      } catch (err) {
        console.error(`Error fetching on-chain statuses for ${walletAddress}:`, err);
        continue;
      }

      for (let i = 0; i < GOALS.length; i++) {
        const goal = GOALS[i];

        // Skip already completed on-chain
        if (completedStatuses[i]) continue;

        // Check progress
        const progress = await getPlayerProgress(walletAddress, goal);
        if (!meetsThreshold(progress, goal)) continue;

        // Award the achievement on-chain
        try {
          const label = goal.isHidden ? `[HIDDEN] ${goal.name}` : goal.name;
          console.log(`Awarding goal ${goal.id} (${label}) to ${walletAddress}`);
          const tx = await contract.awardAchievement(walletAddress, goal.id);
          const receipt = await tx.wait();

          // Write to Firestore for audit trail
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

    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);
    const signer = new ethers.Wallet(rewardsPrivateKey.value(), provider);
    const contract = new ethers.Contract(ACHIEVEMENT_MANAGER_ADDRESS, ACHIEVEMENT_MANAGER_ABI, signer);

    // Check on-chain completion status (source of truth)
    const goalIds = GOALS.map(g => g.id);
    const completedStatuses: boolean[] = await contract.getPlayerGoalStatuses(addr, goalIds);

    const results: { goalId: number; name: string; awarded: boolean; error?: string }[] = [];

    for (let i = 0; i < GOALS.length; i++) {
      const goal = GOALS[i];

      if (completedStatuses[i]) {
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
