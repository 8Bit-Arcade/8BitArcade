/**
 * Tournament Status Manager
 *
 * Scheduled function that runs every hour to:
 * 1. Transition 'upcoming' tournaments to 'active' when their start time passes
 * 2. Transition 'active' tournaments to 'ended' when their end time passes
 *
 * This ensures tournament scores sync correctly since updateActiveTournamentEntries
 * only syncs scores for tournaments with status === 'active'
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions';
import { db } from '../config/firebase';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * Update Tournament Statuses
 * Runs every hour to transition tournament statuses based on time
 */
export const updateTournamentStatuses = onSchedule(
  {
    schedule: '0 * * * *', // Every hour at minute 0
    timeZone: 'UTC',
    region: 'us-central1',
  },
  async () => {
    logger.info('Running tournament status update...');

    const now = Timestamp.now();
    let upcomingToActive = 0;
    let activeToEnded = 0;

    try {
      // 1. Transition 'upcoming' to 'active' where startTime has passed
      const upcomingSnapshot = await db
        .collection('tournaments')
        .where('status', '==', 'upcoming')
        .get();

      for (const doc of upcomingSnapshot.docs) {
        const tournament = doc.data();
        const startTime = tournament.startTime as Timestamp;

        if (startTime && startTime.toMillis() <= now.toMillis()) {
          await doc.ref.update({
            status: 'active',
            updatedAt: now,
          });
          upcomingToActive++;
          logger.info(`Tournament ${doc.id} transitioned from 'upcoming' to 'active'`);
        }
      }

      // 2. Transition 'active' to 'ended' where endTime has passed
      const activeSnapshot = await db
        .collection('tournaments')
        .where('status', '==', 'active')
        .get();

      for (const doc of activeSnapshot.docs) {
        const tournament = doc.data();
        const endTime = tournament.endTime as Timestamp;

        if (endTime && endTime.toMillis() <= now.toMillis()) {
          await doc.ref.update({
            status: 'ended',
            updatedAt: now,
          });
          activeToEnded++;
          logger.info(`Tournament ${doc.id} transitioned from 'active' to 'ended'`);
        }
      }

      logger.info(
        `Tournament status update complete: ${upcomingToActive} activated, ${activeToEnded} ended`
      );

    } catch (error) {
      logger.error('Error updating tournament statuses:', error);
      throw error;
    }
  }
);

/**
 * Manual trigger to update tournament statuses immediately
 * Useful for testing or fixing stuck tournaments
 */
export const updateTournamentStatusesManual = onSchedule(
  {
    schedule: 'every 24 hours', // Dummy schedule, trigger manually
    timeZone: 'UTC',
    region: 'us-central1',
  },
  async () => {
    logger.info('Manual tournament status update triggered');

    const now = Timestamp.now();

    try {
      // Get all tournaments and check their status
      const allTournaments = await db.collection('tournaments').get();

      for (const doc of allTournaments.docs) {
        const tournament = doc.data();
        const startTime = tournament.startTime as Timestamp;
        const endTime = tournament.endTime as Timestamp;
        const currentStatus = tournament.status;

        let newStatus = currentStatus;

        // Determine correct status based on time
        if (endTime && endTime.toMillis() <= now.toMillis()) {
          newStatus = 'ended';
        } else if (startTime && startTime.toMillis() <= now.toMillis()) {
          newStatus = 'active';
        } else if (startTime && startTime.toMillis() > now.toMillis()) {
          newStatus = 'upcoming';
        }

        // Update if status changed
        if (newStatus !== currentStatus) {
          await doc.ref.update({
            status: newStatus,
            updatedAt: now,
          });
          logger.info(`Tournament ${doc.id}: ${currentStatus} -> ${newStatus}`);
        }
      }

      logger.info('Manual tournament status update complete');

    } catch (error) {
      logger.error('Error in manual tournament status update:', error);
      throw error;
    }
  }
);
