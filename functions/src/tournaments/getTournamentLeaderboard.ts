import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config/firebase';
import { TournamentEntryDocument, TournamentLeaderboardEntry } from '../types';

interface GetTournamentLeaderboardRequest {
  tournamentId: string;
  limit?: number; // Default 100
}

/**
 * Get leaderboard for a specific tournament
 * Returns sorted list of participants by best score
 */
export const getTournamentLeaderboard = onCall<GetTournamentLeaderboardRequest>(
  async (request) => {
    const { tournamentId, limit = 100 } = request.data;

    if (!tournamentId) {
      throw new HttpsError('invalid-argument', 'Tournament ID required');
    }

    try {
      // Verify tournament exists
      const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();

      if (!tournamentDoc.exists) {
        throw new HttpsError('not-found', 'Tournament not found');
      }

      // Get all entries sorted by best score
      const entriesSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('entries')
        .orderBy('bestScore', 'desc')
        .limit(limit)
        .get();

      // Build leaderboard with usernames
      const leaderboard: TournamentLeaderboardEntry[] = [];
      let rank = 1;

      for (const entryDoc of entriesSnapshot.docs) {
        const entry = entryDoc.data() as TournamentEntryDocument;

        // Get username from users collection
        const userDoc = await db.collection('users').doc(entry.player).get();
        const username = userDoc.exists
          ? userDoc.data()?.username || entry.player.slice(0, 8)
          : entry.player.slice(0, 8);

        leaderboard.push({
          player: entry.player,
          username,
          score: entry.bestScore,
          timestamp: entry.lastPlayedAt || entry.enteredAt,
          rank,
        });

        rank++;
      }

      return {
        success: true,
        leaderboard,
        total: entriesSnapshot.size,
      };
    } catch (error) {
      console.error('Error fetching tournament leaderboard:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to fetch tournament leaderboard');
    }
  }
);
