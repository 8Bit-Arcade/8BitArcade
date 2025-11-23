'use client';

import { useState, useEffect } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';

export interface TopPlayer {
  rank: number;
  username: string;
  score: number;
}

export interface GameLeaderboardData {
  [gameId: string]: TopPlayer[];
}

export function useGameLeaderboards(gameIds: string[]) {
  const [leaderboards, setLeaderboards] = useState<GameLeaderboardData>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboards() {
      if (!isFirebaseConfigured() || typeof window === 'undefined') {
        setLoading(false);
        return;
      }

      try {
        const results: GameLeaderboardData = {};

        // Fetch top 3 for each game in parallel
        await Promise.all(
          gameIds.map(async (gameId) => {
            try {
              const leaderboardRef = collection(db, 'leaderboards', gameId, 'allTime');
              const q = query(leaderboardRef, orderBy('score', 'desc'), limit(3));
              const snapshot = await getDocs(q);

              results[gameId] = snapshot.docs.map((doc, index) => {
                const data = doc.data();
                return {
                  rank: index + 1,
                  username: data.username || 'Anonymous',
                  score: data.score || 0,
                };
              });
            } catch {
              // If no leaderboard exists yet, use empty array
              results[gameId] = [];
            }
          })
        );

        setLeaderboards(results);
        setError(null);
      } catch (err) {
        console.error('Error fetching game leaderboards:', err);
        setError('Failed to load leaderboards');
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboards();
  }, [gameIds.join(',')]);

  return { leaderboards, loading, error };
}
