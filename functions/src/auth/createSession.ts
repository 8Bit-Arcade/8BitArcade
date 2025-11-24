import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { collections, Timestamp } from '../config/firebase';
import { GAME_CONFIGS } from '../config/games';
import * as crypto from 'crypto';

interface CreateSessionRequest {
  gameId: string;
  mode: 'free' | 'ranked' | 'tournament';
  tournamentId?: string;
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

    // If tournament mode, verify tournament exists and is active
    if (mode === 'tournament' && tournamentId) {
      const tournament = await collections.tournaments.doc(tournamentId).get();
      if (!tournament.exists) {
        throw new HttpsError('not-found', 'Tournament not found');
      }
      const data = tournament.data();
      if (data?.status !== 'active') {
        throw new HttpsError('failed-precondition', 'Tournament is not active');
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
