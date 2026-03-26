import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, Timestamp } from '../config/firebase';
import { TournamentDocument } from '../types';

interface GetPlayerActiveTournamentsRequest {
  player: string;
}

/**
 * Helper to convert time field to milliseconds
 */
function toMillis(value: any): number | null {
  if (!value) return null;
  if (typeof value === 'object' && typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (typeof value === 'number') {
    return value < 1000000000000 ? value * 1000 : value;
  }
  return null;
}

interface ActiveTournament {
  id: string;
  name: string;
  tier: string;
  period: string;
  gameId: string | null;
  endsAt: number;
}

/**
 * Get all active tournaments that a player has entered
 * Used to show tournament enrollment indicators on game pages
 */
export const getPlayerActiveTournaments = onCall<GetPlayerActiveTournamentsRequest>(
  async (request) => {
    const { player } = request.data;

    if (!player) {
      throw new HttpsError('invalid-argument', 'Player address required');
    }

    const playerAddress = player.toLowerCase();

    try {
      // Get all tournaments and filter in code to avoid index requirements
      const tournamentsSnapshot = await db.collection('tournaments').get();

      const now = Timestamp.now();
      const nowMillis = now.toMillis();

      // Filter to active tournaments - by status OR by time
      // This handles the case where status update job hasn't run yet
      const activeTournaments = tournamentsSnapshot.docs.filter(doc => {
        const data = doc.data();
        // Check by status
        if (data.status === 'active') return true;

        // Check by time (for 'upcoming' tournaments that are actually active)
        if (data.status === 'upcoming') {
          const startTimeMillis = toMillis(data.startTime);
          const endTimeMillis = toMillis(data.endTime);
          if (startTimeMillis && endTimeMillis &&
              startTimeMillis <= nowMillis && nowMillis < endTimeMillis) {
            return true;
          }
        }

        return false;
      });

      if (activeTournaments.length === 0) {
        return { success: true, tournaments: [] };
      }

      const enrolledTournaments: ActiveTournament[] = [];

      // Check each tournament for player's entry
      for (const tournamentDoc of activeTournaments) {
        const tournament = tournamentDoc.data() as TournamentDocument;
        const tournamentId = tournamentDoc.id;

        // Check if player has an entry in this tournament
        const entryRef = db
          .collection('tournaments')
          .doc(tournamentId)
          .collection('entries')
          .doc(playerAddress);

        const entryDoc = await entryRef.get();

        if (entryDoc.exists) {
          enrolledTournaments.push({
            id: tournamentId,
            name: `${tournament.tier || 'Standard'} ${tournament.period || 'Weekly'}`,
            tier: tournament.tier || 'Standard',
            period: tournament.period || 'Weekly',
            gameId: tournament.gameId || null,
            endsAt: tournament.endTime?.toMillis?.() || 0,
          });
        }
      }

      console.log('Player', playerAddress, 'enrolled in', enrolledTournaments.length, 'tournaments');

      return {
        success: true,
        tournaments: enrolledTournaments,
      };
    } catch (error) {
      console.error('Error fetching player active tournaments:', error);
      throw new HttpsError('internal', 'Failed to fetch tournament status');
    }
  }
);
