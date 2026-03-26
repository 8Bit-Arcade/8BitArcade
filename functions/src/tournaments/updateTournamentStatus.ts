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
 * Helper to convert time field to milliseconds
 * Handles Firebase Timestamps, Unix timestamps (seconds or ms), Dates, and ISO strings
 */
function toMillis(value: any): number | null {
  if (!value) return null;

  // Firestore Timestamp with toMillis method
  if (typeof value === 'object' && typeof value.toMillis === 'function') {
    return value.toMillis();
  }

  // JS Date
  if (value instanceof Date) {
    return value.getTime();
  }

  // ISO string
  if (typeof value === 'string') {
    const t = new Date(value).getTime();
    return isNaN(t) ? null : t;
  }

  // Unix timestamp (number) - detect if seconds or milliseconds
  if (typeof value === 'number') {
    // If less than year 2001 in milliseconds, assume it's seconds
    return value < 1000000000000 ? value * 1000 : value;
  }

  return null;
}

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
    const nowMillis = now.toMillis();
    let upcomingToActive = 0;
    let activeToEnded = 0;
    let timestampsFixed = 0;

    try {
      // 1. Transition 'upcoming' to 'active' where startTime has passed
      const upcomingSnapshot = await db
        .collection('tournaments')
        .where('status', '==', 'upcoming')
        .get();

      for (const doc of upcomingSnapshot.docs) {
        const tournament = doc.data();
        const startTimeMillis = toMillis(tournament.startTime);
        const endTimeMillis = toMillis(tournament.endTime);

        if (startTimeMillis && startTimeMillis <= nowMillis) {
          // Also fix timestamp format if needed
          const updates: Record<string, any> = {
            status: 'active',
            updatedAt: now,
          };

          // Convert number timestamps to proper Timestamps
          if (typeof tournament.startTime === 'number') {
            updates.startTime = Timestamp.fromMillis(startTimeMillis);
            timestampsFixed++;
          }
          if (typeof tournament.endTime === 'number' && endTimeMillis) {
            updates.endTime = Timestamp.fromMillis(endTimeMillis);
          }

          await doc.ref.update(updates);
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
        const endTimeMillis = toMillis(tournament.endTime);
        const startTimeMillis = toMillis(tournament.startTime);

        if (endTimeMillis && endTimeMillis <= nowMillis) {
          // Also fix timestamp format if needed
          const updates: Record<string, any> = {
            status: 'ended',
            updatedAt: now,
          };

          // Convert number timestamps to proper Timestamps
          if (typeof tournament.startTime === 'number' && startTimeMillis) {
            updates.startTime = Timestamp.fromMillis(startTimeMillis);
            timestampsFixed++;
          }
          if (typeof tournament.endTime === 'number') {
            updates.endTime = Timestamp.fromMillis(endTimeMillis);
          }

          await doc.ref.update(updates);
          activeToEnded++;
          logger.info(`Tournament ${doc.id} transitioned from 'active' to 'ended'`);
        }
      }

      logger.info(
        `Tournament status update complete: ${upcomingToActive} activated, ${activeToEnded} ended, ${timestampsFixed} timestamps fixed`
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
    const nowMillis = now.toMillis();

    try {
      // Get all tournaments and check their status
      const allTournaments = await db.collection('tournaments').get();

      for (const doc of allTournaments.docs) {
        const tournament = doc.data();
        const startTimeMillis = toMillis(tournament.startTime);
        const endTimeMillis = toMillis(tournament.endTime);
        const currentStatus = tournament.status;

        let newStatus = currentStatus;

        // Determine correct status based on time
        if (endTimeMillis && endTimeMillis <= nowMillis) {
          newStatus = 'ended';
        } else if (startTimeMillis && startTimeMillis <= nowMillis) {
          newStatus = 'active';
        } else if (startTimeMillis && startTimeMillis > nowMillis) {
          newStatus = 'upcoming';
        }

        // Update if status changed OR timestamps need fixing
        const needsTimestampFix = typeof tournament.startTime === 'number' || typeof tournament.endTime === 'number';

        if (newStatus !== currentStatus || needsTimestampFix) {
          const updates: Record<string, any> = {
            status: newStatus,
            updatedAt: now,
          };

          // Fix timestamp format
          if (typeof tournament.startTime === 'number' && startTimeMillis) {
            updates.startTime = Timestamp.fromMillis(startTimeMillis);
          }
          if (typeof tournament.endTime === 'number' && endTimeMillis) {
            updates.endTime = Timestamp.fromMillis(endTimeMillis);
          }

          await doc.ref.update(updates);
          logger.info(`Tournament ${doc.id}: ${currentStatus} -> ${newStatus}${needsTimestampFix ? ' (timestamps fixed)' : ''}`);
        }
      }

      logger.info('Manual tournament status update complete');

    } catch (error) {
      logger.error('Error in manual tournament status update:', error);
      throw error;
    }
  }
);
