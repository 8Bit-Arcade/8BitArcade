'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { callFunction } from '@/lib/firebase-functions';
import { useAuthStore } from '@/stores/authStore';
import { shortenAddress } from '@/lib/utils';

interface LeaderboardEntry {
  player: string;
  username: string;
  score: number;
  rank: number;
}

interface Participant {
  player: string;
  username: string;
  hasPlayed: boolean;
  bestScore: number;
  joinedAt: number;
}

interface TournamentLeaderboardProps {
  tournamentId: number;
  tournamentName: string;
  isActive: boolean;
}

interface LeaderboardResponse {
  success: boolean;
  leaderboard: {
    player: string;
    username: string;
    score: number;
    rank: number;
    timestamp: number;
  }[];
  total: number;
}

interface ParticipantsResponse {
  success: boolean;
  participants: Participant[];
  total: number;
  playedCount: number;
}

type ViewMode = 'leaderboard' | 'participants';

export default function TournamentLeaderboard({
  tournamentId,
  tournamentName,
  isActive,
}: TournamentLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [playedCount, setPlayedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('leaderboard');

  const { users } = useAuthStore();

  // Fetch leaderboard from Firebase
  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const result = await callFunction<any, LeaderboardResponse>(
        'getTournamentLeaderboard',
        { tournamentId: String(tournamentId), limit: 100 }
      );

      if (result.success && result.leaderboard) {
        const entries: LeaderboardEntry[] = result.leaderboard.map((entry) => ({
          player: entry.player,
          username: entry.username || '',
          score: entry.score || 0,
          rank: entry.rank,
        }));
        setLeaderboard(entries);
      } else {
        setLeaderboard([]);
      }
    } catch (error) {
      console.error('Error fetching tournament leaderboard:', error);
      setLeaderboard([]);
    } finally {
      setLoading(false);
    }
  }, [tournamentId]);

  // Fetch participants from Firebase
  const fetchParticipants = useCallback(async () => {
    try {
      const result = await callFunction<any, ParticipantsResponse>(
        'getTournamentParticipants',
        { tournamentId: String(tournamentId) }
      );

      if (result.success && result.participants) {
        setParticipants(result.participants);
        setPlayedCount(result.playedCount || 0);
      } else {
        setParticipants([]);
        setPlayedCount(0);
      }
    } catch (error) {
      console.error('Error fetching tournament participants:', error);
      setParticipants([]);
      setPlayedCount(0);
    }
  }, [tournamentId]);

  // Initial fetch
  useEffect(() => {
    fetchLeaderboard();
    fetchParticipants();
  }, [fetchLeaderboard, fetchParticipants]);

  // Refresh every 30 seconds if tournament is active
  useEffect(() => {
    if (isActive) {
      const interval = setInterval(() => {
        fetchLeaderboard();
        fetchParticipants();
      }, 30000);

      return () => clearInterval(interval);
    }
  }, [isActive, fetchLeaderboard, fetchParticipants]);

  // Get display name for a player
  const getPlayerDisplayName = (player: string, username?: string): string => {
    const userData = users[player.toLowerCase()];

    if (!userData) {
      return username || shortenAddress(player);
    }

    const preference = userData.displayPreference ||
      (userData.ensName ? 'ens' : userData.username ? 'username' : 'address');

    switch (preference) {
      case 'ens':
        return userData.ensName || userData.username || username || shortenAddress(player);
      case 'username':
        return userData.username || userData.ensName || username || shortenAddress(player);
      case 'address':
      default:
        return shortenAddress(player);
    }
  };

  // Filter leaderboard based on search query
  const filteredLeaderboard = useMemo(() => {
    if (!searchQuery.trim()) return leaderboard;

    const query = searchQuery.toLowerCase();
    return leaderboard.filter((entry) => {
      const displayName = getPlayerDisplayName(entry.player, entry.username).toLowerCase();
      const address = entry.player.toLowerCase();
      const username = entry.username?.toLowerCase() || '';

      return (
        displayName.includes(query) ||
        address.includes(query) ||
        username.includes(query)
      );
    });
  }, [leaderboard, searchQuery, users]);

  // Filter participants based on search query
  const filteredParticipants = useMemo(() => {
    if (!searchQuery.trim()) return participants;

    const query = searchQuery.toLowerCase();
    return participants.filter((p) => {
      const displayName = getPlayerDisplayName(p.player, p.username).toLowerCase();
      const address = p.player.toLowerCase();
      const username = p.username?.toLowerCase() || '';

      return (
        displayName.includes(query) ||
        address.includes(query) ||
        username.includes(query)
      );
    });
  }, [participants, searchQuery, users]);

  if (loading) {
    return (
      <div>
        <p className="font-arcade text-gray-500 text-sm text-center py-4">Loading...</p>
      </div>
    );
  }

  const totalParticipants = participants.length;
  const hasNoEntries = leaderboard.length === 0 && participants.length === 0;

  if (hasNoEntries) {
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
      {/* View Mode Tabs */}
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setViewMode('leaderboard')}
          className={`px-3 py-1 font-arcade text-xs rounded transition-colors ${
            viewMode === 'leaderboard'
              ? 'bg-arcade-green/20 text-arcade-green border border-arcade-green/40'
              : 'bg-arcade-dark/30 text-gray-400 border border-gray-600 hover:text-white'
          }`}
        >
          Leaderboard ({leaderboard.length})
        </button>
        <button
          onClick={() => setViewMode('participants')}
          className={`px-3 py-1 font-arcade text-xs rounded transition-colors ${
            viewMode === 'participants'
              ? 'bg-arcade-pink/20 text-arcade-pink border border-arcade-pink/40'
              : 'bg-arcade-dark/30 text-gray-400 border border-gray-600 hover:text-white'
          }`}
        >
          All Participants ({totalParticipants})
        </button>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between mb-3">
        <span className="font-arcade text-gray-500 text-xs">
          {viewMode === 'leaderboard'
            ? `${filteredLeaderboard.length} of ${leaderboard.length} players with scores`
            : `${filteredParticipants.length} of ${totalParticipants} participants (${playedCount} played)`
          }
        </span>
      </div>

      {/* Search Input */}
      {(leaderboard.length > 5 || participants.length > 5) && (
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search by address, ENS, or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-arcade-dark border border-arcade-green/30 rounded text-white font-arcade text-sm placeholder:text-gray-500 focus:outline-none focus:border-arcade-green"
          />
        </div>
      )}

      {/* Leaderboard View */}
      {viewMode === 'leaderboard' && (
        <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {filteredLeaderboard.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-arcade text-gray-400 text-sm">
                {searchQuery ? `No players found matching "${searchQuery}"` : 'No scores yet. Join and play to get on the leaderboard!'}
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
                    <p className="font-arcade text-white text-sm">{getPlayerDisplayName(entry.player, entry.username)}</p>
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
            ))
          )}
        </div>
      )}

      {/* Participants View */}
      {viewMode === 'participants' && (
        <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          {filteredParticipants.length === 0 ? (
            <div className="text-center py-8">
              <p className="font-arcade text-gray-400 text-sm">
                {searchQuery ? `No participants found matching "${searchQuery}"` : 'No participants yet.'}
              </p>
            </div>
          ) : (
            filteredParticipants.map((participant) => (
              <div
                key={participant.player}
                className={`flex items-center justify-between p-2 rounded ${
                  participant.hasPlayed
                    ? 'bg-arcade-green/5 border border-arcade-green/20'
                    : 'bg-arcade-dark/30 border border-gray-700'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className={`font-pixel text-sm w-6 ${participant.hasPlayed ? 'text-arcade-green' : 'text-gray-600'}`}>
                    {participant.hasPlayed ? '✓' : '○'}
                  </span>
                  <div>
                    <p className="font-arcade text-white text-sm">{getPlayerDisplayName(participant.player, participant.username)}</p>
                    <p className="font-mono text-gray-500 text-xs">
                      {participant.player.slice(0, 6)}...{participant.player.slice(-4)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  {participant.hasPlayed ? (
                    <>
                      <p className="font-pixel text-arcade-green text-sm">{participant.bestScore.toLocaleString()}</p>
                      <p className="font-arcade text-gray-500 text-xs">best score</p>
                    </>
                  ) : (
                    <p className="font-arcade text-gray-500 text-xs">Not played yet</p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {!isActive && (
        <div className="mt-3 p-2 bg-gray-500/10 rounded text-center">
          <p className="font-arcade text-gray-400 text-xs">Tournament Ended</p>
        </div>
      )}
    </div>
  );
}
