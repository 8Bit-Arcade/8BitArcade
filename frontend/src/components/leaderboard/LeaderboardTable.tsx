'use client';

import { formatNumber, shortenAddress } from '@/lib/utils';
import { useAuthStore } from '@/stores/authStore';

interface LeaderboardEntry {
  odedId: string;
  username: string;
  score: number;
  timestamp: number;
}

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
  userAddress?: string;
  isLoading?: boolean;
}

// Helper to get display name for a user
function useEntryDisplayName(entry: LeaderboardEntry): string {
  const { users } = useAuthStore();
  const userData = users[entry.odedId.toLowerCase()];

  if (!userData) {
    // No local data - use server-provided username or shortened address
    return entry.username || shortenAddress(entry.odedId);
  }

  const preference = userData.displayPreference ||
    (userData.ensName ? 'ens' : userData.username ? 'username' : 'address');

  switch (preference) {
    case 'ens':
      return userData.ensName || userData.username || entry.username || shortenAddress(entry.odedId);
    case 'username':
      return userData.username || userData.ensName || entry.username || shortenAddress(entry.odedId);
    case 'address':
    default:
      return shortenAddress(entry.odedId);
  }
}

export default function LeaderboardTable({
  entries,
  userAddress,
  isLoading,
}: LeaderboardTableProps) {
  if (isLoading) {
    return (
      <div className="card-arcade p-8 text-center">
        <div className="animate-pulse">
          <div className="font-pixel text-arcade-green">LOADING...</div>
        </div>
      </div>
    );
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="card-arcade p-8 text-center">
        <p className="font-pixel text-gray-400">No scores yet. Be the first!</p>
      </div>
    );
  }

  return (
    <div className="card-arcade overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-arcade-green/30">
            <th className="p-3 text-left font-pixel text-arcade-green text-xs">
              RANK
            </th>
            <th className="p-3 text-left font-pixel text-arcade-green text-xs">
              PLAYER
            </th>
            <th className="p-3 text-right font-pixel text-arcade-green text-xs">
              SCORE
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const rank = index + 1;
            const isCurrentUser =
              userAddress?.toLowerCase() === entry.odedId.toLowerCase();
            const displayName = useEntryDisplayName(entry);

            return (
              <tr
                key={entry.odedId}
                className={`
                  border-b border-arcade-dark/50 transition-colors
                  ${isCurrentUser ? 'bg-arcade-green/10' : 'hover:bg-arcade-dark/30'}
                `}
              >
                <td className="p-3">
                  <span
                    className={`
                      font-pixel text-sm
                      ${rank === 1 ? 'text-yellow-400' : ''}
                      ${rank === 2 ? 'text-gray-300' : ''}
                      ${rank === 3 ? 'text-amber-600' : ''}
                      ${rank > 3 ? 'text-gray-400' : ''}
                    `}
                  >
                    {rank === 1 && '🥇 '}
                    {rank === 2 && '🥈 '}
                    {rank === 3 && '🥉 '}
                    #{rank}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`
                        font-arcade text-sm
                        ${isCurrentUser ? 'text-arcade-cyan' : 'text-white'}
                      `}
                    >
                      {displayName}
                    </span>
                    {isCurrentUser && (
                      <span className="font-pixel text-xs text-arcade-yellow">
                        (YOU)
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-3 text-right">
                  <span className="font-pixel text-arcade-yellow text-sm">
                    {formatNumber(entry.score)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
