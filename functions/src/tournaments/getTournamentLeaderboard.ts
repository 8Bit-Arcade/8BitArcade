import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config/firebase';
import { TournamentDocument, TournamentEntryDocument, TournamentLeaderboardEntry } from '../types';

interface GetTournamentLeaderboardRequest {
  tournamentId: string;
  limit?: number; // Default 100
}

/**
 * Get leaderboard for a specific tournament
 * Supports both single-game tournaments (sort by that game's score)
 * and all-games tournaments (sort by total score across all games)
 */
export const getTournamentLeaderboard = onCall<GetTournamentLeaderboardRequest>(
  async (request) => {
    const { tournamentId, limit = 100 } = request.data;

    if (!tournamentId) {
      throw new HttpsError('invalid-argument', 'Tournament ID required');
    }

    try {
      // Get tournament to check if it's single-game or all-games
      const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();

      if (!tournamentDoc.exists) {
        throw new HttpsError('not-found', 'Tournament not found');
      }

      const tournament = tournamentDoc.data() as TournamentDocument;
      const isSingleGame = tournament.gameId && tournament.gameId !== null;

      // Get all entries - we'll sort in code for flexibility
      const entriesSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('entries')
        .get();

      // Build entries with calculated scores
      const entries: Array<{
        entry: TournamentEntryDocument;
        calculatedScore: number;
        docId: string;
      }> = [];

      for (const entryDoc of entriesSnapshot.docs) {
        const entry = entryDoc.data() as TournamentEntryDocument;

        let calculatedScore: number;

        if (isSingleGame && tournament.gameId) {
          // Single-game tournament: use score for that specific game
          calculatedScore = entry.bestScores?.[tournament.gameId] || entry.bestScore || 0;
        } else {
          // All-games tournament: use total score (sum of all games)
          if (entry.bestScores && Object.keys(entry.bestScores).length > 0) {
            calculatedScore = Object.values(entry.bestScores).reduce((sum, score) => sum + score, 0);
          } else {
            // Fallback to legacy bestScore
            calculatedScore = entry.bestScore || 0;
          }
        }

        entries.push({
          entry,
          calculatedScore,
          docId: entryDoc.id,
        });
      }

      // Sort by calculated score (descending)
      entries.sort((a, b) => b.calculatedScore - a.calculatedScore);

      // Apply limit
      const limitedEntries = entries.slice(0, limit);

      // Build leaderboard with usernames
      const leaderboard: TournamentLeaderboardEntry[] = [];
      let rank = 1;

      for (const { entry, calculatedScore } of limitedEntries) {
        // Get username from users collection
        const userDoc = await db.collection('users').doc(entry.player).get();
        const username = userDoc.exists
          ? userDoc.data()?.username || entry.player.slice(0, 8)
          : entry.player.slice(0, 8);

        leaderboard.push({
          player: entry.player,
          username,
          score: calculatedScore,
          timestamp: entry.lastPlayedAt || entry.enteredAt,
          rank,
        });

        rank++;
      }

      return {
        success: true,
        leaderboard,
        total: entriesSnapshot.size,
        tournamentType: isSingleGame ? 'single-game' : 'all-games',
        gameId: tournament.gameId || null,
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
