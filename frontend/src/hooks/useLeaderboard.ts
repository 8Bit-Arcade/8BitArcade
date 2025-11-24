import { useState, useEffect, useCallback } from 'react';
import { getFirestoreInstance, isFirebaseConfigured } from '@/lib/firebase-client';

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

  // Fetch leaderboard data directly from Firestore (no Cloud Functions needed)
  const fetchLeaderboard = useCallback(async () => {
    if (typeof window === 'undefined' || !isFirebaseConfigured()) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Dynamic imports - only loaded at runtime in browser
      const [db, { doc, getDoc }] = await Promise.all([
        getFirestoreInstance(),
        import('firebase/firestore'),
      ]);

      let entries: LeaderboardEntry[] = [];
      let lastUpdated = Date.now();

      if (gameId) {
        // Game-specific leaderboard
        const leaderboardRef = doc(db, 'leaderboards', gameId);
        const snapshot = await getDoc(leaderboardRef);

        if (snapshot.exists()) {
          const docData = snapshot.data();
          const periodData = docData?.[period] || [];
          entries = periodData.slice(0, 100).map((entry: any) => ({
            odedId: entry.odedId,
            username: entry.username || 'Anonymous',
            score: entry.score || 0,
            timestamp: entry.timestamp?.toMillis?.() || Date.now(),
          }));
          lastUpdated = docData?.lastUpdated?.toMillis?.() || Date.now();
        }
      } else {
        // Global leaderboard
        const globalRef = doc(db, 'globalLeaderboard', period);
        const snapshot = await getDoc(globalRef);

        if (snapshot.exists()) {
          const docData = snapshot.data();
          entries = (docData?.entries || []).slice(0, 100).map((entry: any) => ({
            odedId: entry.odedId,
            username: entry.username || 'Anonymous',
            score: entry.score || 0,
            timestamp: entry.timestamp?.toMillis?.() || Date.now(),
          }));
          lastUpdated = docData?.lastUpdated?.toMillis?.() || Date.now();
        }
      }

      setData({
        entries,
        lastUpdated,
      });
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

  // Real-time updates
  useEffect(() => {
    if (typeof window === 'undefined' || !isFirebaseConfigured()) return;

    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const [db, { doc, onSnapshot }] = await Promise.all([
          getFirestoreInstance(),
          import('firebase/firestore'),
        ]);

        const leaderboardRef = gameId
          ? doc(db, 'leaderboards', gameId)
          : doc(db, 'globalLeaderboard', period);

        unsubscribe = onSnapshot(
          leaderboardRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const docData = snapshot.data();
              const periodData = gameId ? (docData[period] || []) : (docData.entries || []);

              const entries = periodData.slice(0, 100).map((entry: any) => ({
                odedId: entry.odedId,
                username: entry.username || 'Anonymous',
                score: entry.score || 0,
                timestamp: entry.timestamp?.toMillis?.() || Date.now(),
              }));

              setData((prev) => ({
                ...prev,
                entries,
                lastUpdated: docData.lastUpdated?.toMillis?.() || Date.now(),
              }));
            }
          },
          (err) => {
            console.error('Leaderboard subscription error:', err);
          }
        );
      } catch (err) {
        console.error('Failed to setup leaderboard subscription:', err);
      }
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
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
