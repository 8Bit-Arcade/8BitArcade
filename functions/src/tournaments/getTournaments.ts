import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db, Timestamp } from '../config/firebase';
import { TournamentDocument, TournamentEntryDocument } from '../types';

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
    const now = Timestamp.now();
    const nowMillis = now.toMillis();

    // Filter by status in code - using time-based checks for accuracy
    if (status) {
      filteredDocs = filteredDocs.filter(doc => {
        const data = doc.data();

        if (status === 'active') {
          // Active by status OR by time
          if (data.status === 'active') return true;
          // Check time-based activity for 'upcoming' tournaments
          if (data.status === 'upcoming') {
            const startTimeMillis = toMillis(data.startTime);
            const endTimeMillis = toMillis(data.endTime);
            if (startTimeMillis && endTimeMillis &&
                startTimeMillis <= nowMillis && nowMillis < endTimeMillis) {
              return true;
            }
          }
          return false;
        }

        if (status === 'upcoming') {
          // Only truly upcoming (hasn't started yet)
          const startTimeMillis = toMillis(data.startTime);
          if (startTimeMillis && startTimeMillis > nowMillis) {
            return true;
          }
          return false;
        }

        if (status === 'ended') {
          // Ended by status OR by time
          if (data.status === 'ended' || data.status === 'finalized') return true;
          const endTimeMillis = toMillis(data.endTime);
          if (endTimeMillis && endTimeMillis <= nowMillis) {
            return true;
          }
          return false;
        }

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
