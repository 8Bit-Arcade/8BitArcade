'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import { callFunction } from '@/lib/firebase-functions';

interface LeaderboardEntry {
  player: string;
  username: string;
  score: number;
  rank: number;
  timestamp: any;
}

interface TournamentLeaderboardProps {
  tournamentId: number;
  tournamentName: string;
  isActive: boolean;
}

export default function TournamentLeaderboard({
  tournamentId,
  tournamentName,
  isActive,
}: TournamentLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchLeaderboard() {
      setLoading(true);
      setError(null);

      try {
        const result = await callFunction<
          { tournamentId: string; limit?: number },
          { success: boolean; leaderboard: LeaderboardEntry[]; total: number }
        >('getTournamentLeaderboard', {
          tournamentId: tournamentId.toString(),
          limit: 10,
        });

        if (result.success) {
          setLeaderboard(result.leaderboard || []);
        } else {
          setError('Failed to load leaderboard');
        }
      } catch (err) {
        console.error('Error fetching tournament leaderboard:', err);
        setError('Failed to load leaderboard');
      } finally {
        setLoading(false);
      }
    }

    fetchLeaderboard();

    // Refresh every 30 seconds if tournament is active
    const interval = isActive ? setInterval(fetchLeaderboard, 30000) : null;

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [tournamentId, isActive]);

  if (loading) {
    return (
      <Card className="mt-4">
        <h3 className="font-pixel text-arcade-cyan text-sm mb-3">LEADERBOARD</h3>
        <p className="font-arcade text-gray-500 text-sm text-center py-4">Loading...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-4">
        <h3 className="font-pixel text-arcade-cyan text-sm mb-3">LEADERBOARD</h3>
        <p className="font-arcade text-gray-500 text-sm text-center py-4">{error}</p>
      </Card>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <Card className="mt-4">
        <h3 className="font-pixel text-arcade-cyan text-sm mb-3">LEADERBOARD</h3>
        <p className="font-arcade text-gray-400 text-sm text-center py-4">
          No entries yet. Be the first to join!
        </p>
      </Card>
    );
  }

  return (
    <Card className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-pixel text-arcade-cyan text-sm">LEADERBOARD</h3>
        <span className="font-arcade text-gray-500 text-xs">
          {leaderboard.length} {leaderboard.length === 1 ? 'Player' : 'Players'}
        </span>
      </div>

      <div className="space-y-2">
        {leaderboard.map((entry, index) => (
          <div
            key={entry.player}
            className={`flex items-center justify-between p-2 rounded ${
              index === 0
                ? 'bg-arcade-yellow/10 border border-arcade-yellow/30'
                : index === 1
                ? 'bg-gray-500/10 border border-gray-500/30'
                : index === 2
                ? 'bg-orange-500/10 border border-orange-500/30'
                : 'bg-arcade-dark/30'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`font-pixel text-sm w-6 ${
                  index === 0
                    ? 'text-arcade-yellow'
                    : index === 1
                    ? 'text-gray-400'
                    : index === 2
                    ? 'text-orange-400'
                    : 'text-gray-500'
                }`}
              >
                {entry.rank}
                {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : ''}
              </span>
              <div>
                <p className="font-arcade text-white text-sm">{entry.username}</p>
                <p className="font-mono text-gray-500 text-xs">
                  {entry.player.slice(0, 6)}...{entry.player.slice(-4)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-pixel text-arcade-green text-sm">{entry.score.toLocaleString()}</p>
              <p className="font-arcade text-gray-500 text-xs">points</p>
            </div>
          </div>
        ))}
      </div>

      {!isActive && (
        <div className="mt-3 p-2 bg-gray-500/10 rounded text-center">
          <p className="font-arcade text-gray-400 text-xs">Tournament Ended</p>
        </div>
      )}
    </Card>
  );
}
