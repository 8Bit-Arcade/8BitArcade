'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Button from '@/components/ui/Button';
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable';
import LeaderboardTabs from '@/components/leaderboard/LeaderboardTabs';
import GameSelector from '@/components/leaderboard/GameSelector';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { formatNumber } from '@/lib/utils';

type Period = 'daily' | 'weekly' | 'allTime';

export default function LeaderboardPage() {
  const { address } = useAccount();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('allTime');
  const [selectedGame, setSelectedGame] = useState('all');

  // Fetch leaderboard data
  const { data, isLoading, error } = useLeaderboard(
    selectedGame === 'all' ? undefined : selectedGame,
    selectedPeriod
  );

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-pixel text-2xl md:text-3xl text-arcade-green glow-green mb-2">
            LEADERBOARD
          </h1>
          <p className="font-arcade text-gray-400">
            Top players ranked by score
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Period Filter */}
          <LeaderboardTabs
            activePeriod={selectedPeriod}
            onPeriodChange={setSelectedPeriod}
          />
        </div>

        {/* Game Filter */}
        <GameSelector
          selectedGame={selectedGame}
          onGameChange={setSelectedGame}
        />

        {/* User's Rank Card */}
        {address && data?.userRank && (
          <div className="card-arcade mb-6 border-arcade-cyan">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="font-pixel text-arcade-cyan text-lg">
                  #{data.userRank}
                </span>
                <div>
                  <p className="font-arcade text-white">Your Rank</p>
                  <p className="font-arcade text-xs text-gray-400">
                    {data.userRank <= 100 ? 'Top 100!' : `Top ${Math.round((data.userRank / 1000) * 100)}%`}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-arcade text-arcade-green">
                  {formatNumber(data.userScore || 0)}
                </p>
                <p className="font-arcade text-xs text-gray-400">Your Score</p>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="card-arcade mb-6 border-arcade-red">
            <p className="font-arcade text-arcade-red text-center">
              {error}
            </p>
          </div>
        )}

        {/* Leaderboard Table */}
        <LeaderboardTable
          entries={data?.entries || []}
          userAddress={address}
          isLoading={isLoading}
        />

        {/* Last Updated */}
        {data?.lastUpdated && (
          <p className="text-center font-arcade text-gray-500 text-xs mt-4">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </p>
        )}

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
