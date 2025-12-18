import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { db } from '../config/firebase';
import { TournamentDocument, TournamentTier, TournamentPeriod } from '../types';
import { Timestamp } from 'firebase-admin/firestore';

interface CreateTournamentRequest {
  tier: TournamentTier;
  period: TournamentPeriod;
  startTime: number; // Unix timestamp in milliseconds
  endTime: number; // Unix timestamp in milliseconds
  entryFee: number; // In 8BIT tokens
  prizePool: number; // In 8BIT tokens
}

/**
 * Admin function to create a new tournament
 * Only callable by authorized admin accounts
 */
export const createTournament = onCall<CreateTournamentRequest>(async (request) => {
  const { tier, period, startTime, endTime, entryFee, prizePool } = request.data;

  // Verify caller is authenticated
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  // TODO: Check if user is admin
  // For now, we'll add admin role checking later
  // const userDoc = await db.collection('users').doc(request.auth.uid).get();
  // if (!userDoc.exists || !userDoc.data()?.isAdmin) {
  //   throw new HttpsError('permission-denied', 'Only admins can create tournaments');
  // }

  // Validate inputs
  if (!tier || !period || !startTime || !endTime || entryFee === undefined || prizePool === undefined) {
    throw new HttpsError('invalid-argument', 'Missing required fields');
  }

  if (!['standard', 'highRoller'].includes(tier)) {
    throw new HttpsError('invalid-argument', 'Invalid tier');
  }

  if (!['weekly', 'monthly'].includes(period)) {
    throw new HttpsError('invalid-argument', 'Invalid period');
  }

  if (endTime <= startTime) {
    throw new HttpsError('invalid-argument', 'End time must be after start time');
  }

  if (entryFee < 0 || prizePool < 0) {
    throw new HttpsError('invalid-argument', 'Fees and prizes must be positive');
  }

  try {
    const now = Timestamp.now();
    const startTimestamp = Timestamp.fromMillis(startTime);
    const endTimestamp = Timestamp.fromMillis(endTime);

    // Determine initial status
    const status = startTimestamp.toMillis() > now.toMillis() ? 'upcoming' : 'active';

    // Create tournament document
    const tournamentRef = db.collection('tournaments').doc();
    const tournament: TournamentDocument = {
      id: tournamentRef.id,
      tier,
      period,
      startTime: startTimestamp,
      endTime: endTimestamp,
      entryFee,
      prizePool,
      status,
      participants: [],
      createdAt: now,
      finalizedAt: null,
      winnerId: null,
    };

    await tournamentRef.set(tournament);

    return {
      success: true,
      tournamentId: tournamentRef.id,
      tournament,
    };
  } catch (error) {
    console.error('Error creating tournament:', error);
    throw new HttpsError('internal', 'Failed to create tournament');
  }
});
