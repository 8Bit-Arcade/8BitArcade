'use client';

import { useState, useEffect, useMemo } from 'react';
import Card from '@/components/ui/Card';
import { callFunction } from '@/lib/firebase-functions';
import { useAuthStore } from '@/stores/authStore';
import { shortenAddress } from '@/lib/utils';

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
  const [searchQuery, setSearchQuery] = useState('');

  const { users } = useAuthStore();

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
          limit: 100, // Fetch more entries for search functionality
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

  // Get display name for a player
  const getPlayerDisplayName = (entry: LeaderboardEntry): string => {
    const userData = users[entry.player.toLowerCase()];

    if (!userData) {
      return entry.username || shortenAddress(entry.player);
    }

    const preference = userData.displayPreference ||
      (userData.ensName ? 'ens' : userData.username ? 'username' : 'address');

    switch (preference) {
      case 'ens':
        return userData.ensName || userData.username || entry.username || shortenAddress(entry.player);
      case 'username':
        return userData.username || userData.ensName || entry.username || shortenAddress(entry.player);
      case 'address':
      default:
        return shortenAddress(entry.player);
    }
  };

  // Filter leaderboard based on search query
  const filteredLeaderboard = useMemo(() => {
    if (!searchQuery.trim()) return leaderboard;

    const query = searchQuery.toLowerCase();
    return leaderboard.filter((entry) => {
      const displayName = getPlayerDisplayName(entry).toLowerCase();
      const address = entry.player.toLowerCase();
      const username = entry.username?.toLowerCase() || '';

      return (
        displayName.includes(query) ||
        address.includes(query) ||
        username.includes(query)
      );
    });
  }, [leaderboard, searchQuery, users]);

  if (loading) {
    return (
      <div>
        <p className="font-arcade text-gray-500 text-sm text-center py-4">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <p className="font-arcade text-gray-500 text-sm text-center py-4">{error}</p>
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div>
        <p className="font-arcade text-gray-400 text-sm text-center py-4">
          No entries yet. Be the first to join!
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="font-arcade text-gray-500 text-xs">
          {filteredLeaderboard.length} of {leaderboard.length} {leaderboard.length === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Search Input */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by address, ENS, or username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 bg-arcade-dark border border-arcade-green/30 rounded text-white font-arcade text-sm placeholder:text-gray-500 focus:outline-none focus:border-arcade-green"
        />
      </div>

      {/* Scrollable Leaderboard */}
      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {filteredLeaderboard.length === 0 ? (
          <div className="text-center py-8">
            <p className="font-arcade text-gray-400 text-sm">
              No players found matching "{searchQuery}"
            </p>
          </div>
        ) : (
          filteredLeaderboard.map((entry, index) => (
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
                <p className="font-arcade text-white text-sm">{getPlayerDisplayName(entry)}</p>
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
        )))}
      </div>

      {!isActive && (
        <div className="mt-3 p-2 bg-gray-500/10 rounded text-center">
          <p className="font-arcade text-gray-400 text-xs">Tournament Ended</p>
        </div>
      )}
    </div>
  );
}
