import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

const db = getFirestore();

export const initializeTournamentIfMissing = onCall({ cors: true }, async (request) => {
  const { tournamentId, tier, period, startTime, endTime, entryFee, prizePool } = request.data;

  if (!tournamentId) {
    throw new HttpsError('invalid-argument', 'Missing tournamentId');
  }

  try {
    // Convert Unix timestamps to Firebase Timestamps for proper queries
    const startTimestamp = Timestamp.fromMillis(startTime * 1000);
    const endTimestamp = Timestamp.fromMillis(endTime * 1000);
    const now = Timestamp.now();
    const nowSeconds = Math.floor(Date.now() / 1000);

    // Determine correct status based on current time
    let status: 'upcoming' | 'active' | 'ended';
    if (nowSeconds < startTime) {
      status = 'upcoming';
    } else if (nowSeconds >= startTime && nowSeconds < endTime) {
      status = 'active';
    } else {
      status = 'ended';
    }

    // Check if tournament already exists
    const tournamentRef = db.collection('tournaments').doc(tournamentId.toString());
    const doc = await tournamentRef.get();

    if (doc.exists) {
      // Tournament exists - update status if needed and fix timestamp format
      const currentData = doc.data();

      // Check if timestamps need to be converted (stored as numbers instead of Timestamps)
      const needsTimestampFix = typeof currentData?.startTime === 'number';

      if (needsTimestampFix || currentData?.status !== status) {
        logger.info(`Tournament ${tournamentId} updating: status '${currentData?.status}' -> '${status}', fixing timestamps: ${needsTimestampFix}`);
        await tournamentRef.update({
          status,
          startTime: startTimestamp,
          endTime: endTimestamp,
          updatedAt: now,
        });
        return { success: true, message: `Tournament status updated to ${status}` };
      }

      logger.info(`Tournament ${tournamentId} already exists with correct status '${currentData?.status}'`);
      return { success: true, message: 'Tournament already initialized' };
    }

    // Create tournament doc with proper Timestamps
    await tournamentRef.set({
      id: tournamentId,
      tier,
      period,
      startTime: startTimestamp,
      endTime: endTimestamp,
      entryFee: parseFloat(entryFee),
      prizePool: parseFloat(prizePool),
      status,
      totalEntries: 0,
      participants: [],
      leaderboards: {},
      createdAt: now,
      updatedAt: now,
    });

    // Initialize empty leaderboard
    await db.collection('tournaments').doc(tournamentId.toString()).collection('leaderboard').doc('global').set({
      rank: 1,
      score: 0,
      playerCount: 0,
      updatedAt: now,
    });

    logger.info(`✅ Created tournament ${tournamentId} with status '${status}'`);
    return { success: true, message: `Tournament ${tournamentId} initialized with status '${status}'` };

  } catch (error) {
    logger.error(`Failed to initialize tournament ${tournamentId}:`, error);
    throw new HttpsError('internal', 'Failed to initialize tournament');
  }
});
