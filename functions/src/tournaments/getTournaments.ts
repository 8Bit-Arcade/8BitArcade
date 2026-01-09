import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config/firebase';
import { TournamentDocument, TournamentEntryDocument } from '../types';

interface GetTournamentsRequest {
  status?: 'active' | 'upcoming' | 'ended';
  tier?: 'standard' | 'highRoller';
  player?: string; // Optional: filter by player participation
}

interface TournamentWithUserData extends TournamentDocument {
  hasEntered: boolean;
  userBestScore?: number;
  userRank?: number;
}

/**
 * Get tournaments based on status and tier filters
 * Optionally includes user participation data if player address provided
 */
export const getTournaments = onCall<GetTournamentsRequest>(async (request) => {
  const { status, tier, player } = request.data;

  try {
    let query: FirebaseFirestore.Query = db.collection('tournaments').orderBy('startTime', 'desc');

    // Apply status filter - just use the status field directly
    // The status field is managed by backend (initializeTournamentIfMissing, finalizeTournament)
    if (status) {
      if (status === 'active') {
        query = query.where('status', '==', 'active');
      } else if (status === 'upcoming') {
        query = query.where('status', '==', 'upcoming');
      } else if (status === 'ended') {
        query = query.where('status', 'in', ['ended', 'finalized']);
      }
    }

    // Apply tier filter
    if (tier) {
      query = query.where('tier', '==', tier);
    }

    const snapshot = await query.limit(50).get();

    const tournaments: TournamentWithUserData[] = [];

    for (const doc of snapshot.docs) {
      const tournament = { id: doc.id, ...doc.data() } as TournamentDocument;

      // If player address provided, check if they've entered and get their stats
      let hasEntered = false;
      let userBestScore: number | undefined;
      let userRank: number | undefined;

      if (player) {
        const entryDoc = await db
          .collection('tournaments')
          .doc(tournament.id)
          .collection('entries')
          .doc(player.toLowerCase())
          .get();

        if (entryDoc.exists) {
          hasEntered = true;
          const entryData = entryDoc.data() as TournamentEntryDocument;
          userBestScore = entryData.bestScore;

          // Calculate rank by counting entries with higher scores
          const higherScores = await db
            .collection('tournaments')
            .doc(tournament.id)
            .collection('entries')
            .where('bestScore', '>', entryData.bestScore)
            .get();

          userRank = higherScores.size + 1;
        }
      }

      tournaments.push({
        ...tournament,
        hasEntered,
        userBestScore,
        userRank,
      });
    }

    return {
      success: true,
      tournaments,
    };
  } catch (error) {
    console.error('Error fetching tournaments:', error);
    throw new HttpsError('internal', 'Failed to fetch tournaments');
  }
});
