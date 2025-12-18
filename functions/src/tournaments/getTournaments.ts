import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config/firebase';
import { TournamentDocument, TournamentEntryDocument } from '../types';
import { Timestamp } from 'firebase-admin/firestore';

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
    let query = db.collection('tournaments').orderBy('startTime', 'desc');

    // Apply status filter
    if (status) {
      if (status === 'active') {
        const now = Timestamp.now();
        query = query
          .where('startTime', '<=', now)
          .where('endTime', '>', now)
          .where('status', '==', 'active') as any;
      } else if (status === 'upcoming') {
        const now = Timestamp.now();
        query = query
          .where('startTime', '>', now)
          .where('status', '==', 'upcoming') as any;
      } else if (status === 'ended') {
        query = query.where('status', 'in', ['ended', 'finalized']) as any;
      }
    }

    // Apply tier filter
    if (tier) {
      query = query.where('tier', '==', tier) as any;
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
