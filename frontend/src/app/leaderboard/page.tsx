'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { useSearchParams } from 'next/navigation';
import Button from '@/components/ui/Button';
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable';
import LeaderboardTabs from '@/components/leaderboard/LeaderboardTabs';
import GameSelector from '@/components/leaderboard/GameSelector';
import TournamentLeaderboard from '@/components/tournament/TournamentLeaderboard';
import { useLeaderboard } from '@/hooks/useLeaderboard';
import { formatNumber } from '@/lib/utils';
import { TESTNET_CONTRACTS, TOURNAMENT_MANAGER_ABI } from '@/config/contracts';

type Period = 'daily' | 'weekly' | 'allTime';
type ViewMode = 'games' | 'tournaments';
type TournamentStatus = 'upcoming' | 'active' | 'ended';

interface TournamentInfo {
  id: number;
  name: string;
  tier: string;
  period: string;
  isActive: boolean;
  status: TournamentStatus;
  endTime: number;
}

export default function LeaderboardPage() {
  const { address } = useAccount();
  const searchParams = useSearchParams();
  const gameParam = searchParams.get('game');

  const [viewMode, setViewMode] = useState<ViewMode>('games');
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('allTime');
  const [selectedGame, setSelectedGame] = useState(gameParam || 'all');
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  // Update selected game when query param changes
  useEffect(() => {
    if (gameParam) {
      setSelectedGame(gameParam);
    }
  }, [gameParam]);

  // Fetch leaderboard data
  const { data, isLoading, error } = useLeaderboard(
    selectedGame === 'all' ? undefined : selectedGame,
    selectedPeriod
  );

  // Fetch tournaments from blockchain
  const MAX_TOURNAMENTS = 12;
  const tournamentIds = Array.from({ length: MAX_TOURNAMENTS }, (_, i) => i + 1);

  // Create dynamic tournament queries
  const tournamentQueries = tournamentIds.map(id =>
    useReadContract({
      address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER as `0x${string}`,
      abi: TOURNAMENT_MANAGER_ABI,
      functionName: 'getTournament',
      args: [id], // Pass number directly - wagmi converts to uint256
    })
  );

  // Process tournament data from blockchain
  useEffect(() => {
    console.log('🏆 [Ranks] Processing tournament data...');
    const formattedTournaments: TournamentInfo[] = [];
    let anyLoading = false;

    tournamentQueries.forEach((tQuery, index) => {
      if (tQuery.isLoading) {
        anyLoading = true;
        return;
      }

      const tournamentData = tQuery.data;
      if (!tournamentData || tQuery.error) {
        if (tQuery.error) {
          console.log(`⚠️ [Ranks] Tournament ${tournamentIds[index]} error:`, tQuery.error);
        }
        return;
      }

      const data = tournamentData as any;
      if (!data || typeof data !== 'object') return;

      const fields = Object.values(data) as any[];
      if (fields.length < 9) return;

      const [tier, period, startTime, endTime, entryFee, prizePool, totalEntries, winner, isActive] = fields;

      // Skip inactive tournaments
      if (!isActive) {
        console.log(`⏸️ [Ranks] Tournament ${tournamentIds[index]} is inactive`);
        return;
      }

      // Determine status
      const now = Math.floor(Date.now() / 1000);
      const status: TournamentStatus =
        now < Number(startTime) ? 'upcoming' : now < Number(endTime) ? 'active' : 'ended';

      // Only show active and ended tournaments in leaderboard view
      if (status === 'upcoming') {
        console.log(`⏭️ [Ranks] Tournament ${tournamentIds[index]} is upcoming, skipping`);
        return;
      }

      const tierName = Number(tier) === 0 ? 'Standard' : 'High Roller';
      const periodName = Number(period) === 0 ? 'Weekly' : 'Monthly';

      console.log(`✅ [Ranks] Tournament ${tournamentIds[index]} added:`, {
        name: `${tierName} ${periodName}`,
        status,
        entries: Number(totalEntries)
      });

      formattedTournaments.push({
        id: tournamentIds[index],
        name: `${tierName} ${periodName}`,
        tier: tierName,
        period: periodName,
        isActive: status === 'active',
        status,
        endTime: Number(endTime),
      });
    });

    console.log(`🏁 [Ranks] Total tournaments found: ${formattedTournaments.length}`);
    setTournaments(formattedTournaments);
    setLoadingTournaments(anyLoading);
  }, [
    ...tournamentQueries.map(q => q.data),
    ...tournamentQueries.map(q => q.isLoading),
    ...tournamentQueries.map(q => q.error),
  ]);

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-pixel text-2xl md:text-3xl text-arcade-green glow-green mb-2">
            RANKINGS
          </h1>
          <p className="font-arcade text-gray-400">
            {viewMode === 'games' ? 'Top players ranked by score' : 'Tournament leaderboards'}
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex gap-2 mb-6 justify-center">
          <Button
            variant={viewMode === 'games' ? 'primary' : 'ghost'}
            size="md"
            onClick={() => setViewMode('games')}
          >
            Game Rankings
          </Button>
          <Button
            variant={viewMode === 'tournaments' ? 'primary' : 'ghost'}
            size="md"
            onClick={() => setViewMode('tournaments')}
          >
            Tournaments
          </Button>
        </div>

        {/* Game Leaderboard View */}
        {viewMode === 'games' && (
          <>
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
          </>
        )}

        {/* Tournament Leaderboard View */}
        {viewMode === 'tournaments' && (
          <>
            {loadingTournaments ? (
              <div className="card-arcade text-center py-8">
                <p className="font-arcade text-gray-400">Loading tournaments...</p>
              </div>
            ) : tournaments.length === 0 ? (
              <div className="card-arcade text-center py-8">
                <p className="font-pixel text-gray-400 mb-2">No active tournaments</p>
                <p className="font-arcade text-gray-500 text-sm">
                  Check back soon for upcoming tournaments!
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {tournaments.map((tournament) => (
                  <div key={tournament.id} className="card-arcade">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-arcade-green/20">
                      <div>
                        <h3 className="font-pixel text-arcade-cyan text-sm">
                          {tournament.name}
                        </h3>
                        <p className="font-arcade text-gray-400 text-xs">
                          {tournament.tier} • {tournament.period}
                        </p>
                      </div>
                      {tournament.status === 'active' ? (
                        <span className="px-2 py-1 bg-arcade-green/20 text-arcade-green font-pixel text-xs rounded">
                          LIVE
                        </span>
                      ) : tournament.status === 'ended' ? (
                        <span className="px-2 py-1 bg-gray-500/20 text-gray-500 font-pixel text-xs rounded">
                          ENDED
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-arcade-cyan/20 text-arcade-cyan font-pixel text-xs rounded">
                          SOON
                        </span>
                      )}
                    </div>
                    <TournamentLeaderboard
                      tournamentId={tournament.id}
                      tournamentName={tournament.name}
                      isActive={tournament.status === 'active'}
                    />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
