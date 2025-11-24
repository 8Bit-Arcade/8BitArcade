import { useState, useCallback } from 'react';

// Types matching the backend
interface GameInput {
  t: number;
  type: 'direction' | 'action';
  data?: {
    up?: boolean;
    down?: boolean;
    left?: boolean;
    right?: boolean;
    action?: boolean;
  };
}

interface GameData {
  sessionId: string;
  gameId: string;
  seed: number;
  inputs: GameInput[];
  finalScore: number;
  duration: number;
  checksum: string;
}

interface CreateSessionResponse {
  sessionId: string;
  seed: number;
  expiresAt: number;
}

interface SubmitScoreResponse {
  success: boolean;
  verified: boolean;
  score: number;
  newBest: boolean;
  rank?: number;
  flags?: string[];
}

/**
 * Generate a SHA-256 checksum for game data
 */
async function generateChecksum(inputs: GameInput[], seed: number): Promise<string> {
  const data = JSON.stringify({ inputs, seed });
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function useScoreSubmission() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Create a new game session for ranked/tournament play
   */
  const createSession = useCallback(
    async (
      gameId: string,
      mode: 'ranked' | 'tournament',
      tournamentId?: string
    ): Promise<CreateSessionResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Dynamic import to avoid bundling undici at build time
        const { callFunction } = await import('@/lib/firebase-functions');

        const result = await callFunction<any, CreateSessionResponse>('createSession', {
          gameId,
          mode,
          tournamentId,
        });

        return result;
      } catch (err: any) {
        console.error('Failed to create session:', err);
        setError(err.message || 'Failed to create session');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Submit a score for validation
   */
  const submitScore = useCallback(
    async (
      sessionId: string,
      gameId: string,
      seed: number,
      inputs: GameInput[],
      finalScore: number,
      duration: number
    ): Promise<SubmitScoreResponse | null> => {
      setIsLoading(true);
      setError(null);

      try {
        // Generate checksum
        const checksum = await generateChecksum(inputs, seed);

        const gameData: GameData = {
          sessionId,
          gameId,
          seed,
          inputs,
          finalScore,
          duration,
          checksum,
        };

        // Dynamic import to avoid bundling undici at build time
        const { callFunction } = await import('@/lib/firebase-functions');

        const result = await callFunction<any, SubmitScoreResponse>('submitScore', { gameData });
        return result;
      } catch (err: any) {
        console.error('Failed to submit score:', err);
        setError(err.message || 'Failed to submit score');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  return {
    createSession,
    submitScore,
    isLoading,
    error,
  };
}
