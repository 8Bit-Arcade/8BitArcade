import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";

const db = getFirestore();

export const initializeTournamentIfMissing = onCall({ cors: true }, async (request) => {
  const { tournamentId, tier, period, startTime, endTime, entryFee, prizePool } = request.data;

  if (!tournamentId) {
    throw new HttpsError('invalid-argument', 'Missing tournamentId');
  }

  try {
    // Check if tournament already exists
    const tournamentRef = db.collection('tournaments').doc(tournamentId.toString());
    const doc = await tournamentRef.get();

    if (doc.exists) {
      // Tournament exists - ensure status is 'active' if tournament is currently running
      const currentData = doc.data();
      const now = Math.floor(Date.now() / 1000);
      const tournamentEndTime = currentData?.endTime || endTime;
      const tournamentStartTime = currentData?.startTime || startTime;

      // If tournament is currently active (started and not ended), ensure status is 'active'
      if (now >= tournamentStartTime && now < tournamentEndTime && currentData?.status !== 'active') {
        logger.info(`Tournament ${tournamentId} exists with status '${currentData?.status}', updating to 'active'`);
        await tournamentRef.update({
          status: 'active',
          updatedAt: new Date().toISOString(),
        });
        return { success: true, message: 'Tournament status updated to active' };
      }

      logger.info(`Tournament ${tournamentId} already exists with status '${currentData?.status}'`);
      return { success: true, message: 'Tournament already initialized' };
    }

    // Create tournament doc
    await tournamentRef.set({
      id: tournamentId,
      tier,
      period,
      startTime,
      endTime,
      entryFee: parseFloat(entryFee),
      prizePool: parseFloat(prizePool),
      status: 'active',
      totalEntries: 0,
      leaderboards: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Initialize empty leaderboard
    await db.collection('tournaments').doc(tournamentId.toString()).collection('leaderboard').doc('global').set({
      rank: 1,
      score: 0,
      playerCount: 0,
      updatedAt: new Date().toISOString(),
    });

    logger.info(`✅ Created tournament ${tournamentId}`);
    return { success: true, message: `Tournament ${tournamentId} initialized` };
    
  } catch (error) {
    logger.error(`Failed to initialize tournament ${tournamentId}:`, error);
    throw new HttpsError('internal', 'Failed to initialize tournament');
  }
});
