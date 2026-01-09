'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { callFunction } from '@/lib/firebase-functions';

interface ActiveTournament {
  id: string;
  name: string;
  tier: string;
  period: string;
  gameId?: string | null; // null/undefined = all games
  endsAt: number;
}

interface TournamentStatusResult {
  isEnrolled: boolean;
  activeTournaments: ActiveTournament[];
  tournamentsForGame: ActiveTournament[];
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to check if connected user is enrolled in any active tournaments
 * and which tournaments apply to a specific game
 */
export function useTournamentStatus(gameId?: string): TournamentStatusResult {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(false);
  const [activeTournaments, setActiveTournaments] = useState<ActiveTournament[]>([]);

  const fetchTournamentStatus = useCallback(async () => {
    if (!isConnected || !address) {
      setActiveTournaments([]);
      return;
    }

    setLoading(true);
    try {
      const result = await callFunction<
        { player: string },
        { success: boolean; tournaments: ActiveTournament[] }
      >('getPlayerActiveTournaments', { player: address });

      if (result.success && result.tournaments) {
        console.log('Player tournaments loaded:', result.tournaments);
        setActiveTournaments(result.tournaments);
      } else {
        console.log('No tournaments found for player');
        setActiveTournaments([]);
      }
    } catch (error) {
      console.error('Error fetching tournament status:', error);
      setActiveTournaments([]);
    } finally {
      setLoading(false);
    }
  }, [isConnected, address]);

  // Fetch on mount and when address changes
  useEffect(() => {
    fetchTournamentStatus();
  }, [fetchTournamentStatus]);

  // Filter tournaments that apply to this specific game
  // If tournament.gameId is null/undefined, it applies to ALL games
  const tournamentsForGame = gameId
    ? activeTournaments.filter(
        (t) => !t.gameId || t.gameId === null || t.gameId === gameId
      )
    : activeTournaments;

  console.log('tournamentsForGame for', gameId, ':', tournamentsForGame);

  return {
    isEnrolled: activeTournaments.length > 0,
    activeTournaments,
    tournamentsForGame,
    loading,
    refresh: fetchTournamentStatus,
  };
}
