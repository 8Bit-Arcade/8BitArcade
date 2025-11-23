import { useState, useEffect, useCallback } from 'react';
import { functions, httpsCallable, db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface LeaderboardEntry {
  odedId: string;
  username: string;
  score: number;
  timestamp: number;
}

interface LeaderboardData {
  entries: LeaderboardEntry[];
  lastUpdated: number;
  userRank?: number;
  userScore?: number;
}

type Period = 'daily' | 'weekly' | 'allTime';

export function useLeaderboard(gameId?: string, period: Period = 'allTime') {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch leaderboard data
  const fetchLeaderboard = useCallback(async () => {
    if (!functions) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const getLeaderboardFn = httpsCallable<any, LeaderboardData>(
        functions,
        'getLeaderboard'
      );

      const result = await getLeaderboardFn({
        gameId,
        period,
        limit: 100,
      });

      setData(result.data);
    } catch (err: any) {
      console.error('Failed to fetch leaderboard:', err);
      setError(err.message || 'Failed to fetch leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [gameId, period]);

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  // Real-time updates (optional - subscribe to Firestore directly)
  useEffect(() => {
    if (!db || !gameId) return;

    const leaderboardRef = doc(db, 'leaderboards', gameId);

    const unsubscribe = onSnapshot(
      leaderboardRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const entries = (data[period] || []).map((entry: any) => ({
            ...entry,
            timestamp: entry.timestamp?.toMillis?.() || Date.now(),
          }));

          setData((prev) => ({
            ...prev,
            entries,
            lastUpdated: data.lastUpdated?.toMillis?.() || Date.now(),
            userRank: prev?.userRank,
            userScore: prev?.userScore,
          }));
        }
      },
      (err) => {
        console.error('Leaderboard subscription error:', err);
      }
    );

    return () => unsubscribe();
  }, [gameId, period]);

  return {
    data,
    isLoading,
    error,
    refetch: fetchLeaderboard,
  };
}

// Hook for global leaderboard (all games combined)
export function useGlobalLeaderboard(period: Period = 'allTime') {
  return useLeaderboard(undefined, period);
}
