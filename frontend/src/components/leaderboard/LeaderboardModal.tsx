'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import Modal from '@/components/ui/Modal';
import LeaderboardTable from '@/components/leaderboard/LeaderboardTable';
import LeaderboardTabs from '@/components/leaderboard/LeaderboardTabs';
import { useLeaderboard } from '@/hooks/useLeaderboard';

type Period = 'daily' | 'weekly' | 'allTime';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameName: string;
}

export default function LeaderboardModal({
  isOpen,
  onClose,
  gameId,
  gameName,
}: LeaderboardModalProps) {
  const { address } = useAccount();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>('allTime');

  // Fetch leaderboard data
  const { data, isLoading, error } = useLeaderboard(gameId, selectedPeriod);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${gameName} - Leaderboard`}
    >
      <div className="space-y-4">
        {/* Period Tabs */}
        <LeaderboardTabs
          activePeriod={selectedPeriod}
          onPeriodChange={setSelectedPeriod}
        />

        {/* Error State */}
        {error && (
          <div className="p-4 border border-arcade-red/50 bg-arcade-red/10 rounded">
            <p className="font-arcade text-arcade-red text-sm text-center">
              {error}
            </p>
          </div>
        )}

        {/* Leaderboard Table */}
        <div className="max-h-96 overflow-y-auto">
          <LeaderboardTable
            entries={data?.entries || []}
            userAddress={address}
            isLoading={isLoading}
          />
        </div>

        {/* Last Updated */}
        {data?.lastUpdated && (
          <p className="text-center font-arcade text-gray-500 text-xs">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </p>
        )}
      </div>
    </Modal>
  );
}
