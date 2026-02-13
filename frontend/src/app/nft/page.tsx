'use client';

import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAchievements } from '@/hooks/useAchievements';

export default function NFTPage() {
  const { address, isConnected } = useAccount();
  const { goals, achievementCount, badgeBalance, isLoading } = useAchievements();

  if (!isConnected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
        <h1 className="font-pixel text-2xl text-arcade-green text-center">
          NFT Achievements
        </h1>
        <p className="font-arcade text-gray-400 text-center max-w-md">
          Connect your wallet to view your achievement badges and tradeable NFTs.
        </p>
        <ConnectButton />
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="text-center mb-8">
        <h1 className="font-pixel text-2xl md:text-3xl text-arcade-green mb-2">
          NFT Achievements
        </h1>
        <p className="font-arcade text-gray-400">
          Earn soulbound badges by completing goals. Unlock tradeable items.
        </p>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-arcade-dark border border-arcade-green/30 rounded-lg p-4 text-center">
          <p className="font-pixel text-xl text-arcade-green">{badgeBalance ?? 0}</p>
          <p className="font-arcade text-xs text-gray-500 mt-1">Badges Earned</p>
        </div>
        <div className="bg-arcade-dark border border-arcade-cyan/30 rounded-lg p-4 text-center">
          <p className="font-pixel text-xl text-arcade-cyan">{achievementCount ?? 0}</p>
          <p className="font-arcade text-xs text-gray-500 mt-1">Achievements</p>
        </div>
        <div className="bg-arcade-dark border border-arcade-pink/30 rounded-lg p-4 text-center col-span-2 md:col-span-1">
          <p className="font-pixel text-xl text-arcade-pink">{goals?.length ?? 0}</p>
          <p className="font-arcade text-xs text-gray-500 mt-1">Total Goals</p>
        </div>
      </div>

      {/* Goals List */}
      <div className="mb-8">
        <h2 className="font-pixel text-lg text-arcade-cyan mb-4">Goals</h2>
        {isLoading ? (
          <div className="text-center py-12">
            <p className="font-arcade text-gray-400 animate-pulse">Loading goals...</p>
          </div>
        ) : goals && goals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal: any, index: number) => (
              <div
                key={index}
                className="bg-arcade-dark border border-arcade-green/20 rounded-lg p-4 hover:border-arcade-green/50 transition-all"
              >
                <h3 className="font-pixel text-sm text-arcade-green mb-1">
                  {goal.name || `Goal #${index + 1}`}
                </h3>
                <p className="font-arcade text-xs text-gray-400 mb-3">
                  {goal.description || 'Complete this goal to earn a badge.'}
                </p>
                <div className="flex items-center justify-between">
                  <span className="font-arcade text-xs text-gray-500">
                    {goal.category || 'General'}
                  </span>
                  <span className="font-pixel text-xs text-arcade-yellow">
                    Target: {goal.threshold ?? '?'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-arcade-dark border border-arcade-green/20 rounded-lg">
            <p className="font-pixel text-gray-500 mb-2">No goals available yet</p>
            <p className="font-arcade text-xs text-gray-600">
              Goals will appear here once the achievement contracts are deployed.
            </p>
          </div>
        )}
      </div>

      {/* Coming Soon */}
      <div className="text-center py-8 bg-arcade-dark border border-arcade-pink/20 rounded-lg">
        <h2 className="font-pixel text-lg text-arcade-pink mb-2">Tradeable Items</h2>
        <p className="font-arcade text-sm text-gray-400">
          Coming soon — unlock and trade exclusive 8-Bit items on the marketplace.
        </p>
      </div>
    </div>
  );
}
