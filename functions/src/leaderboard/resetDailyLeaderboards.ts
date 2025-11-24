import { onSchedule } from 'firebase-functions/v2/scheduler';
import { Timestamp } from 'firebase-admin/firestore';
import { collections } from '../config/firebase';
import { GAME_CONFIGS, getRewardForRank } from '../config/games';

/**
 * Scheduled function to reset daily leaderboards and distribute rewards
 * Runs every day at midnight UTC
 */
export const resetDailyLeaderboards = onSchedule(
  {
    schedule: '0 0 * * *', // Every day at midnight UTC
    timeZone: 'UTC',
  },
  async () => {
    console.log('Starting daily leaderboard reset...');

    const now = Timestamp.now();
    const gameIds = Object.keys(GAME_CONFIGS);

    for (const gameId of gameIds) {
      try {
        await processGameLeaderboard(gameId, now);
      } catch (error) {
        console.error(`Error processing leaderboard for ${gameId}:`, error);
      }
    }

    console.log('Daily leaderboard reset complete');
  }
);

async function processGameLeaderboard(gameId: string, now: Timestamp): Promise<void> {
  const leaderboardRef = collections.leaderboards.doc(gameId);
  const doc = await leaderboardRef.get();

  if (!doc.exists) {
    console.log(`No leaderboard found for ${gameId}`);
    return;
  }

  const data = doc.data();
  const dailyEntries = data?.daily || [];

  // Distribute rewards to top 100 players
  const rewardPromises = dailyEntries.slice(0, 100).map(async (entry: any, index: number) => {
    const rank = index + 1;
    const rewardAmount = getRewardForRank(rank);

    if (rewardAmount > 0) {
      await addPendingReward(entry.odedId, {
        amount: rewardAmount,
        reason: 'daily_rank',
        gameId,
        rank,
        timestamp: now,
      });
    }
  });

  await Promise.all(rewardPromises);

  // Archive daily leaderboard (optional - could store in separate collection)
  // await archiveDailyLeaderboard(gameId, dailyEntries, now);

  // Reset daily leaderboard
  await leaderboardRef.update({
    daily: [],
    lastUpdated: now,
  });

  console.log(`Reset daily leaderboard for ${gameId}, distributed ${dailyEntries.length} rewards`);
}

async function addPendingReward(
  playerId: string,
  reward: {
    amount: number;
    reason: string;
    gameId: string;
    rank: number;
    timestamp: any;
  }
): Promise<void> {
  const rewardRef = collections.rewards.doc(playerId);
  const doc = await rewardRef.get();

  if (doc.exists) {
    const data = doc.data();
    await rewardRef.update({
      pending: (data?.pending || 0) + reward.amount,
      history: [...(data?.history || []), { ...reward, claimed: false, txHash: null }],
    });
  } else {
    await rewardRef.set({
      odedId: playerId,
      pending: reward.amount,
      claimed: 0,
      lastClaimed: null,
      history: [{ ...reward, claimed: false, txHash: null }],
    });
  }
}

/**
 * Reset weekly leaderboards - runs every Monday at midnight UTC
 */
export const resetWeeklyLeaderboards = onSchedule(
  {
    schedule: '0 0 * * 1', // Every Monday at midnight UTC
    timeZone: 'UTC',
  },
  async () => {
    console.log('Starting weekly leaderboard reset...');

    const now = Timestamp.now();
    const gameIds = Object.keys(GAME_CONFIGS);

    for (const gameId of gameIds) {
      try {
        const leaderboardRef = collections.leaderboards.doc(gameId);
        const doc = await leaderboardRef.get();

        if (doc.exists) {
          await leaderboardRef.update({
            weekly: [],
            lastUpdated: now,
          });
          console.log(`Reset weekly leaderboard for ${gameId}`);
        }
      } catch (error) {
        console.error(`Error resetting weekly leaderboard for ${gameId}:`, error);
      }
    }

    console.log('Weekly leaderboard reset complete');
  }
);
