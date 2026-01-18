import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { collections, Timestamp, FieldValue } from '../config/firebase';
import { GAME_CONFIGS } from '../config/games';
import * as crypto from 'crypto';

interface CreateSessionRequest {
  gameId: string;
  mode: 'free' | 'ranked' | 'tournament';
  tournamentId?: string;
}

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

interface CreateSessionResponse {
  sessionId: string;
  seed: number;
  expiresAt: number;
}

export const createSession = onCall<CreateSessionRequest, Promise<CreateSessionResponse>>(
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in to create a session');
    }

    const { gameId, mode, tournamentId } = request.data;
    const playerAddress = request.auth.uid.toLowerCase();

    // Validate game exists
    if (!GAME_CONFIGS[gameId]) {
      throw new HttpsError('invalid-argument', `Invalid game: ${gameId}`);
    }

    // Validate mode
    if (!['free', 'ranked', 'tournament'].includes(mode)) {
      throw new HttpsError('invalid-argument', 'Invalid game mode');
    }

    // If tournament mode, verify tournament exists and is active (by time OR status)
    if (mode === 'tournament' && tournamentId) {
      const tournamentRef = collections.tournaments.doc(tournamentId);
      const tournament = await tournamentRef.get();
      if (!tournament.exists) {
        throw new HttpsError('not-found', 'Tournament not found');
      }
      const data = tournament.data();

      // Check if tournament is active - either by status OR by time
      const now = Timestamp.now();
      const nowMillis = now.toMillis();
      const startTimeMillis = toMillis(data?.startTime);
      const endTimeMillis = toMillis(data?.endTime);
      const isTimeActive = startTimeMillis && endTimeMillis &&
        startTimeMillis <= nowMillis && nowMillis < endTimeMillis;
      const isStatusActive = data?.status === 'active';

      if (!isStatusActive && !isTimeActive) {
        throw new HttpsError('failed-precondition', 'Tournament is not active');
      }

      // Auto-enroll player in tournament if they don't have an entry yet
      // This allows scores to be tracked without requiring separate entry flow
      const entryRef = tournamentRef.collection('entries').doc(playerAddress);
      const entryDoc = await entryRef.get();

      if (!entryDoc.exists) {
        const now = Timestamp.now();
        console.log(`Auto-enrolling player ${playerAddress} in tournament ${tournamentId}`);

        // Create entry for the player
        await entryRef.set({
          tournamentId,
          player: playerAddress,
          enteredAt: now,
          bestScore: 0,
          bestScores: {},
          lastPlayedAt: null,
          totalPlays: 0,
          paid: false, // Auto-enrolled, not paid (for testnet)
          txHash: null,
        });

        // Update tournament participants
        await tournamentRef.update({
          participants: FieldValue.arrayUnion(playerAddress),
          totalEntries: FieldValue.increment(1),
          updatedAt: now,
        });
      }
    }

    // Generate session ID and seed
    const sessionId = crypto.randomUUID();
    const seed = Math.floor(Math.random() * 2147483647);

    // Session expires in 30 minutes
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + 30 * 60 * 1000);

    // Create session document
    await collections.sessions.doc(sessionId).set({
      id: sessionId,
      player: playerAddress,
      gameId,
      mode,
      tournamentId: tournamentId || null,
      seed,
      startedAt: now,
      expiresAt,
      completedAt: null,
      finalScore: null,
      verified: false,
    });

    return {
      sessionId,
      seed,
      expiresAt: expiresAt.toMillis(),
    };
  }
);
