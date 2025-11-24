import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { collections } from '../config/firebase';
import { GAME_CONFIGS } from '../config/games';

interface GetLeaderboardRequest {
  gameId?: string; // Omit for global
  period: 'daily' | 'weekly' | 'allTime';
  limit?: number;
}

interface LeaderboardEntryResponse {
  odedId: string;
  username: string;
  score: number;
  timestamp: number; // Milliseconds
}

interface GetLeaderboardResponse {
  entries: LeaderboardEntryResponse[];
  lastUpdated: number;
  userRank?: number;
  userScore?: number;
}

export const getLeaderboard = onCall<GetLeaderboardRequest, Promise<GetLeaderboardResponse>>(
  async (request) => {
    const { gameId, period, limit = 100 } = request.data;
    const playerAddress = request.auth?.uid?.toLowerCase();

    // Validate period
    if (!['daily', 'weekly', 'allTime'].includes(period)) {
      throw new HttpsError('invalid-argument', 'Invalid period');
    }

    // Validate limit
    const safeLimit = Math.min(Math.max(1, limit), 100);

    let entries: any[] = [];
    let lastUpdated = Date.now();

    if (gameId) {
      // Game-specific leaderboard
      if (!GAME_CONFIGS[gameId]) {
        throw new HttpsError('invalid-argument', `Invalid game: ${gameId}`);
      }

      const doc = await collections.leaderboards.doc(gameId).get();

      if (doc.exists) {
        const data = doc.data();
        entries = (data?.[period] || []).slice(0, safeLimit);
        lastUpdated = data?.lastUpdated?.toMillis() || Date.now();
      }
    } else {
      // Global leaderboard - aggregate all games
      const globalDoc = await collections.globalLeaderboard.doc(period).get();

      if (globalDoc.exists) {
        const data = globalDoc.data();
        entries = (data?.entries || []).slice(0, safeLimit);
        lastUpdated = data?.lastUpdated?.toMillis() || Date.now();
      } else {
        // Build global leaderboard from scores collection
        const scoresSnapshot = await collections.scores
          .orderBy('totalScore', 'desc')
          .limit(safeLimit)
          .get();

        entries = scoresSnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            odedId: data.odedId,
            username: data.username,
            score: data.totalScore || 0,
            timestamp: data.lastUpdated || { toMillis: () => Date.now() },
          };
        });
      }
    }

    // Find user's rank if authenticated
    let userRank: number | undefined;
    let userScore: number | undefined;

    if (playerAddress) {
      const userIndex = entries.findIndex((e) => e.odedId === playerAddress);

      if (userIndex >= 0) {
        userRank = userIndex + 1;
        userScore = entries[userIndex].score;
      } else {
        // User not in top 100, find their actual rank
        if (gameId) {
          const scoreDoc = await collections.scores.doc(playerAddress).get();
          if (scoreDoc.exists) {
            const data = scoreDoc.data();
            userScore = data?.games?.[gameId]?.bestScore || 0;

            // Count how many players have higher scores
            const higherScores = await collections.scores
              .where(`games.${gameId}.bestScore`, '>', userScore)
              .count()
              .get();

            userRank = higherScores.data().count + 1;
          }
        } else {
          // Global ranking
          const scoreDoc = await collections.scores.doc(playerAddress).get();
          if (scoreDoc.exists) {
            const data = scoreDoc.data();
            userScore = data?.totalScore || 0;

            const higherScores = await collections.scores
              .where('totalScore', '>', userScore)
              .count()
              .get();

            userRank = higherScores.data().count + 1;
          }
        }
      }
    }

    return {
      entries: entries.map((e) => ({
        odedId: e.odedId,
        username: e.username,
        score: e.score,
        timestamp: e.timestamp?.toMillis ? e.timestamp.toMillis() : Date.now(),
      })),
      lastUpdated,
      userRank,
      userScore,
    };
  }
);
