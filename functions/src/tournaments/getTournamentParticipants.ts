import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config/firebase';
import { TournamentDocument, TournamentEntryDocument } from '../types';

interface GetTournamentParticipantsRequest {
  tournamentId: string;
}

interface Participant {
  player: string;
  username: string;
  hasPlayed: boolean;
  bestScore: number;
  joinedAt: number;
}

/**
 * Get all participants in a tournament, including those who haven't played yet
 * This helps tournament organizers and players see who's competing
 */
export const getTournamentParticipants = onCall<GetTournamentParticipantsRequest>(
  async (request) => {
    const { tournamentId } = request.data;

    if (!tournamentId) {
      throw new HttpsError('invalid-argument', 'Tournament ID required');
    }

    try {
      // Get tournament document
      const tournamentDoc = await db.collection('tournaments').doc(tournamentId).get();

      if (!tournamentDoc.exists) {
        throw new HttpsError('not-found', 'Tournament not found');
      }

      const tournament = tournamentDoc.data() as TournamentDocument;

      // Get all entries
      const entriesSnapshot = await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('entries')
        .get();

      const participants: Participant[] = [];

      for (const entryDoc of entriesSnapshot.docs) {
        const entry = entryDoc.data() as TournamentEntryDocument;

        // Get username
        const userDoc = await db.collection('users').doc(entry.player).get();
        const username = userDoc.exists
          ? userDoc.data()?.username || entry.player.slice(0, 8)
          : entry.player.slice(0, 8);

        // Calculate if they've played (has any score)
        const hasPlayed = (entry.totalPlays || 0) > 0;
        const bestScore = entry.bestScore || 0;

        participants.push({
          player: entry.player,
          username,
          hasPlayed,
          bestScore,
          joinedAt: entry.enteredAt?.toMillis?.() || 0,
        });
      }

      // Sort by join date (earliest first)
      participants.sort((a, b) => a.joinedAt - b.joinedAt);

      return {
        success: true,
        tournament: {
          id: tournamentId,
          name: `${tournament.tier || 'Standard'} ${tournament.period || 'Weekly'}`,
          status: tournament.status,
          gameId: tournament.gameId || null,
        },
        participants,
        total: participants.length,
        playedCount: participants.filter((p) => p.hasPlayed).length,
      };
    } catch (error) {
      console.error('Error fetching tournament participants:', error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', 'Failed to fetch tournament participants');
    }
  }
);
