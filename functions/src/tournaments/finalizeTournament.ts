import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config/firebase';
import { TournamentDocument, TournamentEntryDocument } from '../types';
import { Timestamp } from 'firebase-admin/firestore';
import { distributeTournamentPrize, isValidAddress } from './distributePrize';

interface FinalizeTournamentRequest {
  tournamentId: string;
}

/**
 * Internal function to finalize a tournament
 * Used by both the callable function and scheduled function
 */
async function finalizeTournamentInternal(tournamentId: string) {
  const tournamentRef = db.collection('tournaments').doc(tournamentId);
  const tournamentDoc = await tournamentRef.get();

  if (!tournamentDoc.exists) {
    throw new HttpsError('not-found', 'Tournament not found');
  }

  const tournament = tournamentDoc.data() as TournamentDocument;

  // Verify tournament has ended
  const now = Timestamp.now();
  if (tournament.endTime.toMillis() > now.toMillis()) {
    throw new HttpsError('failed-precondition', 'Tournament has not ended yet');
  }

  // Verify not already finalized
  if (tournament.status === 'finalized') {
    throw new HttpsError('already-exists', 'Tournament already finalized');
  }

  // Get all entries sorted by best score
  const entriesSnapshot = await tournamentRef
    .collection('entries')
    .orderBy('bestScore', 'desc')
    .limit(1)
    .get();

  let winnerId: string | null = null;

  if (!entriesSnapshot.empty) {
    const winnerEntry = entriesSnapshot.docs[0].data() as TournamentEntryDocument;
    winnerId = winnerEntry.player;

    console.log(
      `Tournament ${tournamentId} winner: ${winnerId} with score ${winnerEntry.bestScore}`
    );
  } else {
    console.log(`Tournament ${tournamentId} has no participants`);
  }

  // Update tournament status
  await tournamentRef.update({
    status: 'finalized',
    finalizedAt: now,
    winnerId,
  });

  // Distribute prize to winner via smart contract
  let txHash: string | null = null;
  if (winnerId) {
    try {
      // Validate winner address
      if (!isValidAddress(winnerId)) {
        throw new Error(`Invalid winner address: ${winnerId}`);
      }

      // Call smart contract to distribute prize
      txHash = await distributeTournamentPrize(
        tournamentId,
        winnerId,
        tournament.prizePool
      );

      console.log(`Prize distributed to ${winnerId}, tx: ${txHash}`);

      // Record prize distribution in Firestore
      await db.collection('prize_distributions').add({
        tournamentId,
        winnerId,
        prizeAmount: tournament.prizePool,
        tier: tournament.tier,
        period: tournament.period,
        txHash,
        distributedAt: now,
        blockchainConfirmed: true,
      });
    } catch (error) {
      console.error('Error distributing prize:', error);

      // Log the error but don't fail tournament finalization
      // Admin can manually distribute prize later
      await db.collection('prize_distribution_errors').add({
        tournamentId,
        winnerId,
        prizeAmount: tournament.prizePool,
        error: error instanceof Error ? error.message : String(error),
        timestamp: now,
      });

      console.warn('Tournament finalized but prize distribution failed. Manual intervention required.');
    }
  }

  return { winnerId, txHash };
}

/**
 * Finalize a tournament after it ends
 * - Determines winner
 * - Updates tournament status
 * - Triggers prize distribution (TODO)
 */
export const finalizeTournament = onCall<FinalizeTournamentRequest>(async (request) => {
  const { tournamentId } = request.data;

  if (!tournamentId) {
    throw new HttpsError('invalid-argument', 'Tournament ID required');
  }

  try {
    const { winnerId, txHash } = await finalizeTournamentInternal(tournamentId);

    return {
      success: true,
      winnerId,
      txHash,
      message: winnerId
        ? `Tournament finalized. Winner: ${winnerId}${txHash ? `, Prize distributed: ${txHash}` : ''}`
        : 'Tournament finalized with no participants',
    };
  } catch (error) {
    console.error('Error finalizing tournament:', error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', 'Failed to finalize tournament');
  }
});

/**
 * Scheduled function to automatically finalize ended tournaments
 * Runs every hour to check for tournaments that need finalization
 */
export const autoFinalizeTournaments = async () => {
  try {
    const now = Timestamp.now();

    // Find tournaments that have ended but not finalized
    const endedTournaments = await db
      .collection('tournaments')
      .where('status', '==', 'ended')
      .where('endTime', '<', now)
      .get();

    console.log(`Found ${endedTournaments.size} tournaments to finalize`);

    for (const doc of endedTournaments.docs) {
      try {
        await finalizeTournamentInternal(doc.id);
        console.log(`Finalized tournament ${doc.id}`);
      } catch (error) {
        console.error(`Error finalizing tournament ${doc.id}:`, error);
      }
    }

    return {
      success: true,
      finalized: endedTournaments.size,
    };
  } catch (error) {
    console.error('Error in autoFinalizeTournaments:', error);
    throw error;
  }
};
