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
        <p className="font-arcade text-gray-400 max-w-2xl mx-auto">
          Earn soulbound achievement badges by playing games and hitting milestones.
          Badges are minted as NFTs on Arbitrum and live in your wallet forever.
        </p>
      </div>

      {/* How It Works */}
      <div className="bg-arcade-dark border border-arcade-green/20 rounded-lg p-6 mb-8">
        <h2 className="font-pixel text-sm text-arcade-cyan mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="font-pixel text-xs text-arcade-green mb-1">Automatic Minting</p>
            <p className="font-arcade text-xs text-gray-400">
              Badges are checked and minted automatically every hour. No claiming needed — they appear in your wallet.
            </p>
          </div>
          <div>
            <p className="font-pixel text-xs text-arcade-green mb-1">Zero Gas Fees</p>
            <p className="font-arcade text-xs text-gray-400">
              All minting costs are covered by 8-Bit Arcade. You never pay gas to receive a badge.
            </p>
          </div>
          <div>
            <p className="font-pixel text-xs text-arcade-green mb-1">Soulbound NFTs</p>
            <p className="font-arcade text-xs text-gray-400">
              Achievement badges are non-transferable. They prove what you accomplished and stay with your wallet permanently.
            </p>
          </div>
        </div>
      </div>

      {/* Tier Badges */}
      <div className="bg-arcade-dark border border-arcade-yellow/20 rounded-lg p-6 mb-8">
        <h2 className="font-pixel text-sm text-arcade-yellow mb-4">Tier Badges</h2>
        <p className="font-arcade text-xs text-gray-400 mb-4">
          Collect enough achievement badges to unlock tier ranks. Each tier earns bonus 8BIT token rewards.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 border border-arcade-green/30 rounded-lg">
            <p className="font-pixel text-sm text-arcade-green">8Bit Gamer</p>
            <p className="font-arcade text-xs text-gray-400 mt-1">10 badges</p>
            <p className="font-pixel text-xs text-arcade-yellow mt-2">500 8BIT</p>
          </div>
          <div className="text-center p-4 border border-arcade-cyan/30 rounded-lg">
            <p className="font-pixel text-sm text-arcade-cyan">8Bit Prodigy</p>
            <p className="font-arcade text-xs text-gray-400 mt-1">15 badges</p>
            <p className="font-pixel text-xs text-arcade-yellow mt-2">2,000 8BIT</p>
          </div>
          <div className="text-center p-4 border border-arcade-pink/30 rounded-lg">
            <p className="font-pixel text-sm text-arcade-pink">8Bit God</p>
            <p className="font-arcade text-xs text-gray-400 mt-1">18 badges</p>
            <p className="font-pixel text-xs text-arcade-yellow mt-2">25,000 8BIT</p>
          </div>
        </div>
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
        <h2 className="font-pixel text-lg text-arcade-cyan mb-4">Your Goals</h2>
        {isLoading ? (
          <div className="text-center py-12">
            <p className="font-arcade text-gray-400 animate-pulse">Loading goals...</p>
          </div>
        ) : goals && goals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {goals.map((goal: any, index: number) => (
              <div
                key={index}
                className={`bg-arcade-dark border rounded-lg p-4 transition-all ${
                  goal.completed
                    ? 'border-arcade-green/60 bg-arcade-green/5'
                    : 'border-arcade-green/20 hover:border-arcade-green/50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-pixel text-sm text-arcade-green">
                    {goal.name || `Goal #${index + 1}`}
                  </h3>
                  {goal.completed && (
                    <span className="font-pixel text-xs text-arcade-green">EARNED</span>
                  )}
                </div>
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
