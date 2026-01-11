import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config/firebase';
import { TournamentEntryDocument } from '../types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions';

interface SyncTournamentEntryRequest {
  tournamentId: string;
  player: string;
}

/**
 * Sync an existing tournament entry from blockchain to Firebase
 * For players who joined before Firebase sync was implemented
 */
export const syncTournamentEntry = onCall<SyncTournamentEntryRequest>(async (request) => {
  const { tournamentId, player } = request.data;

  if (!tournamentId || !player) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  const playerAddress = player.toLowerCase();

  try {
    // Get tournament document
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      // Try to create the tournament doc if it doesn't exist
      logger.info(`Tournament ${tournamentId} not found, attempting to create...`);

      await tournamentRef.set({
        id: tournamentId,
        tier: 'Standard', // Default
        period: 'Weekly', // Default
        status: 'active',
        totalEntries: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
    }

    // Check for existing entry
    const entryRef = tournamentRef.collection('entries').doc(playerAddress);
    const existingEntry = await entryRef.get();

    if (existingEntry.exists) {
      logger.info(`Entry already exists for ${playerAddress} in tournament ${tournamentId}`);
      return {
        success: true,
        message: 'Entry already synced',
        alreadyExists: true,
      };
    }

    const now = Timestamp.now();

    // Create entry (marked as synced from blockchain)
    const entry: TournamentEntryDocument = {
      tournamentId,
      player: playerAddress,
      enteredAt: now,
      bestScore: 0,
      bestScores: {},
      lastPlayedAt: null,
      totalPlays: 0,
      paid: true,
      txHash: 'synced-from-blockchain', // Marker for synced entries
    };

    // Batch write
    const batch = db.batch();

    // Create entry
    batch.set(entryRef, entry);

    // Add participant to parent doc
    batch.update(tournamentRef, {
      participants: FieldValue.arrayUnion(playerAddress),
      totalEntries: FieldValue.increment(1),
      updatedAt: now,
    });

    // Initialize leaderboard record
    const leaderboardRef = tournamentRef.collection('leaderboard').doc(playerAddress);
    batch.set(
      leaderboardRef,
      {
        address: playerAddress,
        score: 0,
        joinedAt: now,
        hasPaid: true,
        lastUpdated: now,
      },
      { merge: true }
    );

    await batch.commit();

    logger.info(`✅ Synced entry for ${playerAddress} in tournament ${tournamentId}`);

    return {
      success: true,
      message: 'Tournament entry synced from blockchain',
      entry,
    };
  } catch (error) {
    logger.error('Error syncing tournament entry:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to sync tournament entry');
  }
});
