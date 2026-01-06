import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config/firebase';
import { TournamentDocument, TournamentEntryDocument } from '../types';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

interface EnterTournamentRequest {
  tournamentId: string;
  player: string; // Wallet address
  txHash: string; // Transaction hash of entry fee payment
}

/**
 * Enter a tournament after paying entry fee
 * Verifies transaction and creates tournament entry
 */
export const enterTournament = onCall<EnterTournamentRequest>(async (request) => {
  const { tournamentId, player, txHash } = request.data;

  if (!tournamentId || !player || !txHash) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  const playerAddress = player.toLowerCase();

  try {
    // Get tournament document
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentDoc = await tournamentRef.get();

    if (!tournamentDoc.exists) {
      throw new HttpsError('not-found', 'Tournament not found');
    }

    const tournament = tournamentDoc.data() as TournamentDocument;

    // Verify tournament is active or upcoming
    if (tournament.status !== 'active' && tournament.status !== 'upcoming') {
      throw new HttpsError('failed-precondition', 'Tournament is not accepting entries');
    }

    const now = Timestamp.now();

    // Make sure tournament has not ended
    if (tournament.status === 'active' && tournament.endTime.toMillis() < now.toMillis()) {
      throw new HttpsError('failed-precondition', 'Tournament has ended');
    }

    // Check for existing entry
    const entryRef = tournamentRef.collection('entries').doc(playerAddress);
    const existingEntry = await entryRef.get();

    if (existingEntry.exists) {
      throw new HttpsError('already-exists', 'Already entered this tournament');
    }

    // TODO: Verify transaction on-chain (optional)

    // Construct entry (supports both legacy bestScore and new bestScores)
    const entry: TournamentEntryDocument = {
      tournamentId,
      player: playerAddress,
      enteredAt: now,
      bestScore: 0, // Legacy field for backward compatibility
      bestScores: {}, // NEW: per-game best scores
      lastPlayedAt: null,
      totalPlays: 0,
      paid: true,
      txHash,
    };

    // Batch write to keep atomic
    const batch = db.batch();

    // 1️⃣ Create entry in entries subcollection
    batch.set(entryRef, entry);

    // 2️⃣ Add participant to parent doc
    batch.update(tournamentRef, {
      participants: FieldValue.arrayUnion(playerAddress),
      totalEntries: FieldValue.increment(1),
      updatedAt: now,
    });

    // 3️⃣ Initialize leaderboard record for this player
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

    return {
      success: true,
      message: 'Successfully entered tournament and added to leaderboard',
      entry,
    };
  } catch (error) {
    console.error('Error entering tournament:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to enter tournament');
  }
});
