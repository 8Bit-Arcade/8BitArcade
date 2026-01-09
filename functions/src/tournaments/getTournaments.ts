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
    // Simple query - fetch all and filter in code to avoid index requirements
    const snapshot = await db.collection('tournaments').get();

    let filteredDocs = snapshot.docs;

    // Filter by status in code
    if (status) {
      filteredDocs = filteredDocs.filter(doc => {
        const data = doc.data();
        if (status === 'active') return data.status === 'active';
        if (status === 'upcoming') return data.status === 'upcoming';
        if (status === 'ended') return data.status === 'ended' || data.status === 'finalized';
        return true;
      });
    }

    // Filter by tier in code
    if (tier) {
      filteredDocs = filteredDocs.filter(doc => doc.data().tier === tier);
    }

    // Sort by startTime descending
    filteredDocs.sort((a, b) => {
      const aTime = a.data().startTime?.toMillis?.() || 0;
      const bTime = b.data().startTime?.toMillis?.() || 0;
      return bTime - aTime;
    });

    // Limit to 50
    filteredDocs = filteredDocs.slice(0, 50);

    const tournaments: TournamentWithUserData[] = [];

    for (const doc of filteredDocs) {
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
