import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

const db = getFirestore();

/**
 * Helper to convert time field to milliseconds
 * Handles both Firebase Timestamps and Unix timestamp numbers
 */
function toMillis(timeField: Timestamp | number | undefined): number | null {
  if (!timeField) return null;

  if (typeof timeField === 'object' && 'toMillis' in timeField) {
    return timeField.toMillis();
  }

  if (typeof timeField === 'number') {
    return timeField < 1000000000000 ? timeField * 1000 : timeField;
  }

  return null;
}

/**
 * Fix tournament data - converts number timestamps to Firestore Timestamps
 * and updates statuses based on current time.
 *
 * Call this function to repair any corrupted tournament data.
 */
export const fixTournamentData = onCall({ cors: true }, async () => {
  logger.info('Starting tournament data fix...');

  const now = Timestamp.now();
  const nowMillis = now.toMillis();

  let fixed = 0;
  let errors = 0;

  try {
    const allTournaments = await db.collection('tournaments').get();
    logger.info(`Found ${allTournaments.size} tournaments to check`);

    for (const doc of allTournaments.docs) {
      try {
        const tournament = doc.data();
        const startTimeMillis = toMillis(tournament.startTime);
        const endTimeMillis = toMillis(tournament.endTime);

        // Check if any fixes needed
        const needsTimestampFix = typeof tournament.startTime === 'number' || typeof tournament.endTime === 'number';

        // Determine correct status
        let correctStatus = tournament.status;
        if (endTimeMillis && endTimeMillis <= nowMillis) {
          correctStatus = 'ended';
        } else if (startTimeMillis && startTimeMillis <= nowMillis) {
          correctStatus = 'active';
        } else if (startTimeMillis && startTimeMillis > nowMillis) {
          correctStatus = 'upcoming';
        }

        const needsStatusFix = tournament.status !== correctStatus;

        if (needsTimestampFix || needsStatusFix) {
          const updates: Record<string, any> = {
            updatedAt: now,
          };

          if (needsStatusFix) {
            updates.status = correctStatus;
            logger.info(`Tournament ${doc.id}: status ${tournament.status} -> ${correctStatus}`);
          }

          if (typeof tournament.startTime === 'number' && startTimeMillis) {
            updates.startTime = Timestamp.fromMillis(startTimeMillis);
            logger.info(`Tournament ${doc.id}: fixing startTime format`);
          }

          if (typeof tournament.endTime === 'number' && endTimeMillis) {
            updates.endTime = Timestamp.fromMillis(endTimeMillis);
            logger.info(`Tournament ${doc.id}: fixing endTime format`);
          }

          // Ensure participants array exists
          if (!tournament.participants) {
            updates.participants = [];
          }

          await doc.ref.update(updates);
          fixed++;
        }
      } catch (docError) {
        logger.error(`Error fixing tournament ${doc.id}:`, docError);
        errors++;
      }
    }

    const result = {
      success: true,
      message: `Fixed ${fixed} tournaments, ${errors} errors`,
      totalChecked: allTournaments.size,
      fixed,
      errors,
    };

    logger.info('Tournament data fix complete:', result);
    return result;

  } catch (error) {
    logger.error('Error in fixTournamentData:', error);
    throw new HttpsError('internal', 'Failed to fix tournament data');
  }
});
