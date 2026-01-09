'use client';

import { useState, useEffect, useCallback } from 'react';
import { callFunction } from '@/lib/firebase-functions';

interface ActiveTournament {
  id: string;
  name?: string;
  tier: string;
  period: string;
  gameId?: string | null; // null/undefined = all games
  startTime: { _seconds: number };
  endTime: { _seconds: number };
  entryFee: number | string;
  prizePool: number | string;
  status: string;
}

interface UseActiveTournamentsResult {
  activeTournaments: ActiveTournament[];
  gamesWithTournaments: Set<string>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch all active tournaments
 * Used to show tournament indicators on game carousel
 */
export function useActiveTournaments(): UseActiveTournamentsResult {
  const [activeTournaments, setActiveTournaments] = useState<ActiveTournament[]>([]);
  const [gamesWithTournaments, setGamesWithTournaments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActiveTournaments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await callFunction<
        { status: 'active' },
        { success: boolean; tournaments: ActiveTournament[] }
      >('getTournaments', { status: 'active' });

      if (result.success && result.tournaments) {
        setActiveTournaments(result.tournaments);

        // Build set of game IDs that have active tournaments
        const gameIds = new Set<string>();
        result.tournaments.forEach((t) => {
          // If gameId is null, undefined, or not set, tournament applies to ALL games
          if (t.gameId === null || t.gameId === undefined || !t.gameId) {
            gameIds.add('__all__');
          } else {
            gameIds.add(t.gameId);
          }
        });
        setGamesWithTournaments(gameIds);

        console.log('Active tournaments loaded:', result.tournaments.length, 'Games with tournaments:', Array.from(gameIds));
      } else {
        setActiveTournaments([]);
        setGamesWithTournaments(new Set());
      }
    } catch (err) {
      console.error('Error fetching active tournaments:', err);
      setError('Failed to load tournaments');
      setActiveTournaments([]);
      setGamesWithTournaments(new Set());
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchActiveTournaments();
  }, [fetchActiveTournaments]);

  return {
    activeTournaments,
    gamesWithTournaments,
    loading,
    error,
    refresh: fetchActiveTournaments,
  };
}

/**
 * Check if a specific game has an active tournament
 */
export function hasActiveTournament(gameId: string, gamesWithTournaments: Set<string>): boolean {
  // If __all__ is set, all games have tournaments
  if (gamesWithTournaments.has('__all__')) {
    return true;
  }
  return gamesWithTournaments.has(gameId);
}
