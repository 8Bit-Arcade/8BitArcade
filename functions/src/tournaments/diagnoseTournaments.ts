import { onCall } from 'firebase-functions/v2/https';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

const db = getFirestore();

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

/**
 * Diagnose tournament data - shows what's in Firestore
 * Helps debug why tournaments/entries might not be showing
 */
export const diagnoseTournaments = onCall({ cors: true }, async () => {
  logger.info('Running tournament diagnostics...');

  const now = Timestamp.now();
  const nowMillis = now.toMillis();

  try {
    const allTournaments = await db.collection('tournaments').get();

    const diagnostics: any[] = [];

    for (const doc of allTournaments.docs) {
      const tournament = doc.data();
      const startMillis = toMillis(tournament.startTime);
      const endMillis = toMillis(tournament.endTime);

      // Get entries count
      const entriesSnapshot = await db
        .collection('tournaments')
        .doc(doc.id)
        .collection('entries')
        .get();

      // Determine what status SHOULD be
      let correctStatus = 'unknown';
      if (endMillis && endMillis <= nowMillis) {
        correctStatus = 'ended';
      } else if (startMillis && startMillis <= nowMillis) {
        correctStatus = 'active';
      } else if (startMillis && startMillis > nowMillis) {
        correctStatus = 'upcoming';
      }

      diagnostics.push({
        id: doc.id,
        tier: tournament.tier,
        period: tournament.period,
        currentStatus: tournament.status,
        correctStatus,
        statusMatch: tournament.status === correctStatus,
        startTimeFormat: typeof tournament.startTime,
        endTimeFormat: typeof tournament.endTime,
        startTime: startMillis ? new Date(startMillis).toISOString() : null,
        endTime: endMillis ? new Date(endMillis).toISOString() : null,
        entriesCount: entriesSnapshot.size,
        participantsArray: tournament.participants?.length || 0,
        totalEntriesField: tournament.totalEntries || 0,
        hasTimestampIssue: typeof tournament.startTime === 'number' || typeof tournament.endTime === 'number',
      });
    }

    // Summary
    const summary = {
      totalTournaments: allTournaments.size,
      withTimestampIssues: diagnostics.filter(d => d.hasTimestampIssue).length,
      withStatusMismatch: diagnostics.filter(d => !d.statusMatch).length,
      withNoEntries: diagnostics.filter(d => d.entriesCount === 0).length,
      byStatus: {
        active: diagnostics.filter(d => d.currentStatus === 'active').length,
        upcoming: diagnostics.filter(d => d.currentStatus === 'upcoming').length,
        ended: diagnostics.filter(d => d.currentStatus === 'ended').length,
        other: diagnostics.filter(d => !['active', 'upcoming', 'ended'].includes(d.currentStatus)).length,
      },
    };

    logger.info('Diagnostics complete:', summary);

    return {
      success: true,
      timestamp: new Date().toISOString(),
      summary,
      tournaments: diagnostics,
    };

  } catch (error) {
    logger.error('Error in diagnoseTournaments:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});

/**
 * Force sync entries for a specific player across all active tournaments
 * Useful for debugging and fixing missing entries
 */
export const forceSyncPlayerEntries = onCall({ cors: true }, async (request) => {
  const { player } = request.data;

  if (!player) {
    return { success: false, error: 'Player address required' };
  }

  const playerAddress = player.toLowerCase();
  logger.info(`Force syncing entries for ${playerAddress}...`);

  const now = Timestamp.now();

  try {
    // Get all active tournaments
    const activeTournaments = await db
      .collection('tournaments')
      .where('status', '==', 'active')
      .get();

    const results: any[] = [];

    for (const tournamentDoc of activeTournaments.docs) {
      const tournamentId = tournamentDoc.id;

      // Check if entry exists
      const entryRef = db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('entries')
        .doc(playerAddress);

      const entryDoc = await entryRef.get();

      if (entryDoc.exists) {
        results.push({
          tournamentId,
          action: 'already_exists',
          entry: entryDoc.data(),
        });
      } else {
        // Create entry
        const entry = {
          tournamentId,
          player: playerAddress,
          enteredAt: now,
          bestScore: 0,
          bestScores: {},
          lastPlayedAt: null,
          totalPlays: 0,
          paid: true,
          txHash: 'force-synced',
        };

        await entryRef.set(entry);

        // Update tournament doc
        await tournamentDoc.ref.update({
          participants: require('firebase-admin/firestore').FieldValue.arrayUnion(playerAddress),
          totalEntries: require('firebase-admin/firestore').FieldValue.increment(1),
          updatedAt: now,
        });

        results.push({
          tournamentId,
          action: 'created',
          entry,
        });
      }
    }

    return {
      success: true,
      player: playerAddress,
      tournamentsChecked: activeTournaments.size,
      results,
    };

  } catch (error) {
    logger.error('Error in forceSyncPlayerEntries:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
});
