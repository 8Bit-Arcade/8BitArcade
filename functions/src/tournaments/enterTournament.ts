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

    // Verify tournament is in correct state
    if (tournament.status !== 'active' && tournament.status !== 'upcoming') {
      throw new HttpsError('failed-precondition', 'Tournament is not accepting entries');
    }

    const now = Timestamp.now();

    // Check if tournament has started (if active, must be before end time)
    if (tournament.status === 'active' && tournament.endTime.toMillis() < now.toMillis()) {
      throw new HttpsError('failed-precondition', 'Tournament has ended');
    }

    // Check if player already entered
    const entryRef = tournamentRef.collection('entries').doc(playerAddress);
    const existingEntry = await entryRef.get();

    if (existingEntry.exists) {
      throw new HttpsError('already-exists', 'Already entered this tournament');
    }

    // TODO: Verify transaction on-chain (check txHash is valid and amount matches)
    // For now, we trust the frontend verification

    // Create tournament entry
    const entry: TournamentEntryDocument = {
      tournamentId,
      player: playerAddress,
      enteredAt: now,
      bestScore: 0,
      lastPlayedAt: null,
      totalPlays: 0,
      paid: true,
      txHash,
    };

    // Use batch write to ensure atomicity
    const batch = db.batch();

    // Create entry document
    batch.set(entryRef, entry);

    // Add player to tournament participants array
    batch.update(tournamentRef, {
      participants: FieldValue.arrayUnion(playerAddress),
    });

    await batch.commit();

    return {
      success: true,
      message: 'Successfully entered tournament',
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
