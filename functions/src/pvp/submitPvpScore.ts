import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

const db = admin.firestore();

/**
 * submitPvpScore — a player submits their score for one round of a PvP match.
 *
 * Score hiding: both players' scores for a round are stored but neither is
 * visible to the opponent until BOTH have finished that round.
 * Once both finish, the round winner is determined and totals updated.
 * After the final round, the overall match winner is determined.
 */
export const submitPvpScore = onCall({ memory: '128MiB', maxInstances: 10 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');

  const { matchId, roundIndex, score } = request.data;
  const player = request.auth.uid.toLowerCase();

  if (!matchId || typeof roundIndex !== 'number' || typeof score !== 'number' || score < 0) {
    throw new HttpsError('invalid-argument', 'Invalid parameters');
  }

  const matchRef = db.collection('pvpMatches').doc(matchId);

  const updateResult = await db.runTransaction(async (txn) => {
    const snap = await txn.get(matchRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Match not found');

    const match = snap.data()!;
    if (match.status !== 'active') {
      throw new HttpsError('failed-precondition', 'Match not active');
    }

    const isCreator = match.creator === player;
    const isChallenger = match.challenger === player;

    if (!isCreator && !isChallenger) {
      throw new HttpsError('permission-denied', 'Not a participant');
    }

    if (roundIndex < 0 || roundIndex >= match.rounds.length) {
      throw new HttpsError('invalid-argument', 'Invalid round index');
    }

    const rounds = [...match.rounds];
    const round = { ...rounds[roundIndex] };

    // Prevent double submission
    if (isCreator && round.creatorFinished) {
      throw new HttpsError('already-exists', 'Already submitted score for this round');
    }
    if (isChallenger && round.challengerFinished) {
      throw new HttpsError('already-exists', 'Already submitted score for this round');
    }

    // Record score
    if (isCreator) {
      round.creatorScore = score;
      round.creatorFinished = true;
    } else {
      round.challengerScore = score;
      round.challengerFinished = true;
    }

    let bothFinished = false;
    let roundWinner: string | null = null;

    // If both finished this round, determine round winner
    if (round.creatorFinished && round.challengerFinished) {
      bothFinished = true;
      round.completedAt = admin.firestore.Timestamp.now();

      if ((round.creatorScore ?? 0) >= (round.challengerScore ?? 0)) {
        round.winner = match.creator;
        roundWinner = match.creator;
      } else {
        round.winner = match.challenger;
        roundWinner = match.challenger;
      }
    }

    rounds[roundIndex] = round;

    // Recompute totals from all completed rounds
    const creatorTotal = rounds.reduce((sum: number, r: any) => sum + (r.creatorScore ?? 0), 0);
    const challengerTotal = rounds.reduce((sum: number, r: any) => sum + (r.challengerScore ?? 0), 0);

    // Check if all rounds complete
    const allRoundsComplete = rounds.every((r: any) => r.creatorFinished && r.challengerFinished);
    let matchWinner: string | null = null;
    let matchStatus = match.status;

    if (allRoundsComplete) {
      matchWinner = creatorTotal >= challengerTotal ? match.creator : match.challenger;
      matchStatus = 'completed';
    }

    const updates: any = {
      rounds,
      creatorTotalScore: creatorTotal,
      challengerTotalScore: challengerTotal,
      updatedAt: admin.firestore.Timestamp.now(),
    };

    if (matchStatus === 'completed') {
      updates.status = 'completed';
      updates.winner = matchWinner;
      updates.completedAt = admin.firestore.Timestamp.now();
    }

    txn.update(matchRef, updates);

    return {
      bothFinished,
      roundWinner,
      allRoundsComplete,
      matchWinner,
      creatorTotal,
      challengerTotal,
    };
  });

  // If match completed, trigger prize resolution for paid matches
  if (updateResult.allRoundsComplete && updateResult.matchWinner) {
    await triggerMatchResolution(matchId, updateResult.matchWinner);
  }

  return updateResult;
});

/**
 * Update profile stats and record match result when a match concludes.
 */
async function triggerMatchResolution(matchId: string, winner: string) {
  try {
    const matchSnap = await db.collection('pvpMatches').doc(matchId).get();
    if (!matchSnap.exists) return;
    const match = matchSnap.data()!;
    const loser = winner === match.creator ? match.challenger : match.creator;

    const batch = db.batch();
    const now = admin.firestore.Timestamp.now();

    // Update winner profile
    const winnerProfileRef = db.collection('userProfiles').doc(winner);
    const prizeAmount = match.betAmount > 0 ? Math.floor(match.betAmount * 2 * 0.95) : 0;
    batch.set(winnerProfileRef, {
      pvpWins: admin.firestore.FieldValue.increment(1),
      pvpEarnings: admin.firestore.FieldValue.increment(prizeAmount),
      updatedAt: now,
    }, { merge: true });

    // Update loser profile
    if (loser) {
      const loserProfileRef = db.collection('userProfiles').doc(loser);
      batch.set(loserProfileRef, {
        pvpLosses: admin.firestore.FieldValue.increment(1),
        updatedAt: now,
      }, { merge: true });
    }

    await batch.commit();
  } catch (err) {
    console.error('triggerMatchResolution error:', err);
  }
}
