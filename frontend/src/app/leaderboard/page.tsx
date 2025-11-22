'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Button from '@/components/ui/Button';
import { formatNumber, getOrdinalSuffix } from '@/lib/utils';

type Period = 'daily' | 'weekly' | 'allTime';

// Placeholder data
const LEADERBOARD_DATA = Array.from({ length: 100 }, (_, i) => ({
  rank: i + 1,
  username: `Player${i + 1}`,
  score: Math.floor(1500000 - i * 12000 + Math.random() * 5000),
  gamesPlayed: Math.floor(50 + Math.random() * 200),
}));

const GAMES = [
  { id: 'all', name: 'All Games' },
  { id: 'space-rocks', name: 'Space Rocks' },
  { id: 'alien-assault', name: 'Alien Assault' },
  { id: 'bug-blaster', name: 'Bug Blaster' },
  { id: 'chomper', name: 'Chomper' },
];

export default function LeaderboardPage() {
  const { address } = useAccount();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('weekly');
  const [selectedGame, setSelectedGame] = useState('all');

  // Simulate user's rank
  const userRank = address ? 42 : null;

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-pixel text-2xl md:text-3xl text-arcade-green glow-green mb-2">
            LEADERBOARD
          </h1>
          <p className="font-arcade text-gray-400">
            Top players ranked by total score
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Period Filter */}
          <div className="flex gap-2">
            {(['daily', 'weekly', 'allTime'] as Period[]).map((period) => (
              <Button
                key={period}
                variant={selectedPeriod === period ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setSelectedPeriod(period)}
              >
                {period === 'allTime' ? 'All Time' : period}
              </Button>
            ))}
          </div>

          {/* Game Filter */}
          <select
            value={selectedGame}
            onChange={(e) => setSelectedGame(e.target.value)}
            className="input-arcade text-sm py-2"
          >
            {GAMES.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
        </div>

        {/* User's Rank Card */}
        {userRank && (
          <div className="card-arcade mb-6 border-arcade-cyan">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-pixel text-arcade-cyan text-lg">
                  #{userRank}
                </span>
                <div>
                  <p className="font-arcade text-white">Your Rank</p>
                  <p className="font-arcade text-xs text-gray-400">
                    Top {Math.round((userRank / 100) * 100)}%
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-arcade text-arcade-green">
                  {formatNumber(875420)}
                </p>
                <p className="font-arcade text-xs text-gray-400">Total Score</p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="card-arcade overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-arcade-green/30">
                  <th className="font-pixel text-xs text-arcade-green text-left py-3 px-4">
                    Rank
                  </th>
                  <th className="font-pixel text-xs text-arcade-green text-left py-3 px-4">
                    Player
                  </th>
                  <th className="font-pixel text-xs text-arcade-green text-right py-3 px-4">
                    Score
                  </th>
                  <th className="font-pixel text-xs text-arcade-green text-right py-3 px-4 hidden sm:table-cell">
                    Games
                  </th>
                </tr>
              </thead>
              <tbody>
                {LEADERBOARD_DATA.slice(0, 50).map((player) => (
                  <tr
                    key={player.rank}
                    className={`
                      border-b border-arcade-green/10 last:border-0
                      hover:bg-arcade-green/5 transition-colors
                      ${player.rank <= 3 ? 'bg-arcade-green/5' : ''}
                    `}
                  >
                    <td className="py-3 px-4">
                      <span
                        className={`
                          font-pixel text-sm
                          ${player.rank === 1 ? 'text-arcade-yellow' : ''}
                          ${player.rank === 2 ? 'text-gray-300' : ''}
                          ${player.rank === 3 ? 'text-arcade-orange' : ''}
                          ${player.rank > 3 ? 'text-gray-500' : ''}
                        `}
                      >
                        {player.rank <= 3 ? (
                          <span className="text-lg">
                            {player.rank === 1 && '🥇'}
                            {player.rank === 2 && '🥈'}
                            {player.rank === 3 && '🥉'}
                          </span>
                        ) : (
                          getOrdinalSuffix(player.rank)
                        )}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-arcade text-white">
                        {player.username}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-arcade text-arcade-green">
                        {formatNumber(player.score)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right hidden sm:table-cell">
                      <span className="font-arcade text-gray-400">
                        {player.gamesPlayed}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rewards Info */}
        <div className="mt-8 text-center">
          <h3 className="font-pixel text-arcade-yellow text-xs mb-4">
            DAILY REWARDS
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { rank: 'Top 1', reward: '1,000 8BIT' },
              { rank: 'Top 2-5', reward: '500 8BIT' },
              { rank: 'Top 6-10', reward: '250 8BIT' },
              { rank: 'Top 11-100', reward: '50-100 8BIT' },
            ].map((tier) => (
              <div key={tier.rank} className="card-arcade text-center py-4">
                <p className="font-arcade text-gray-400 text-sm">{tier.rank}</p>
                <p className="font-pixel text-arcade-green text-xs mt-1">
                  {tier.reward}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
