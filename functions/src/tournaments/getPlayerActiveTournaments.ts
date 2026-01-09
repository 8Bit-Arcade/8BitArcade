import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config/firebase';
import { TournamentDocument } from '../types';

interface GetPlayerActiveTournamentsRequest {
  player: string;
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

      // Filter to active tournaments in code
      const activeTournaments = tournamentsSnapshot.docs.filter(doc =>
        doc.data().status === 'active'
      );

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
