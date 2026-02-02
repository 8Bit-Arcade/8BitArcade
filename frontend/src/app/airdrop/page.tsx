'use client';

import { useAccount } from 'wagmi';
import { formatEther } from 'viem';
import { useAirdrop } from '@/hooks/useAirdrop';
import Button from '@/components/ui/Button';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { getTxExplorerUrl, USE_TESTNET } from '@/config/contracts';

/**
 * Testnet Airdrop Claim Page
 *
 * Rewards testnet participants with 8BIT tokens based on their activity.
 * Uses a 3-month vesting schedule (33.33% per month).
 */
export default function AirdropPage() {
  const { address, isConnected } = useAccount();
  const {
    isLoading,
    isContractReady,
    error,
    status,
    isEligible,
    hasClaimed,
    contractStats,
    vestingInfo,
    initiateClaim,
    claimVested,
    refreshStatus,
    isClaimPending,
    isClaimConfirming,
    claimTxHash,
  } = useAirdrop();

  // Format numbers
  const formatNumber = (num: number) => num.toLocaleString();
  const formatTokens = (amount: bigint) => {
    const formatted = parseFloat(formatEther(amount));
    return formatted.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  // Calculate time remaining
  const getTimeRemaining = () => {
    if (!status?.claimDeadline) return null;
    const deadline = new Date(status.claimDeadline);
    const now = new Date();
    const diff = deadline.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    return `${days}d ${hours}h remaining`;
  };

  // Get tier color
  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'legendary':
        return 'text-yellow-400';
      case 'epic':
        return 'text-purple-400';
      case 'rare':
        return 'text-blue-400';
      case 'common':
        return 'text-gray-400';
      default:
        return 'text-white';
    }
  };

  // Get tier badge
  const getTierBadge = (tier?: string) => {
    switch (tier) {
      case 'legendary':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
      case 'epic':
        return 'bg-purple-500/20 border-purple-500/50 text-purple-400';
      case 'rare':
        return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
      case 'common':
        return 'bg-gray-500/20 border-gray-500/50 text-gray-400';
      default:
        return 'bg-gray-500/20 border-gray-500/50 text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-arcade-dark text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-arcade-purple via-arcade-pink to-arcade-cyan py-12">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 font-arcade">
            TESTNET AIRDROP
          </h1>
          <p className="text-lg opacity-90">
            Thank you for participating in the 8-Bit Arcade testnet!
          </p>
          <p className="text-sm opacity-75 mt-2">
            15 million 8BIT tokens distributed to our most active testers
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Contract Status Banner */}
        {!isContractReady && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6 text-center">
            <p className="text-yellow-400 font-bold">Airdrop Contract Not Yet Deployed</p>
            <p className="text-sm text-yellow-300/80 mt-1">
              The claim page is ready, but the airdrop contract hasn&apos;t been deployed yet.
              Check back soon!
            </p>
          </div>
        )}

        {/* Testnet Notice */}
        {USE_TESTNET && (
          <div className="bg-arcade-cyan/20 border border-arcade-cyan/50 rounded-lg p-4 mb-6 text-center">
            <p className="text-arcade-cyan font-bold">Testnet Mode</p>
            <p className="text-sm text-arcade-cyan/80 mt-1">
              This is the testnet airdrop. Connect your wallet to check eligibility.
            </p>
          </div>
        )}

        {/* Live Preview Notice */}
        {status?.status === 'preview' && (
          <div className="bg-arcade-green/20 border border-arcade-green/50 rounded-lg p-4 mb-6 text-center">
            <p className="text-arcade-green font-bold">Live Preview</p>
            <p className="text-sm text-arcade-green/80 mt-1">
              {status.message || 'Showing your estimated allocation based on current activity. Final allocation determined at snapshot.'}
            </p>
          </div>
        )}

        {/* Demo Mode Notice */}
        {status?.status === 'demo' && (
          <div className="bg-arcade-purple/20 border border-arcade-purple/50 rounded-lg p-4 mb-6 text-center">
            <p className="text-arcade-purple font-bold">Demo Mode</p>
            <p className="text-sm text-arcade-purple/80 mt-1">
              Showing sample eligibility data for testing. Actual airdrop data will appear when available.
            </p>
          </div>
        )}

        {/* Connect Wallet */}
        {!isConnected ? (
          <div className="bg-arcade-gray rounded-lg p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
            <p className="text-gray-400 mb-6">
              Connect your wallet to check if you&apos;re eligible for the airdrop
            </p>
            <div className="flex justify-center">
              <ConnectButton />
            </div>
          </div>
        ) : isLoading ? (
          <div className="bg-arcade-gray rounded-lg p-8 text-center">
            <div className="animate-spin w-12 h-12 border-4 border-arcade-cyan border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Checking eligibility...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-6 text-center">
            <p className="text-red-400 font-bold">Error</p>
            <p className="text-sm text-red-300/80 mt-1">{error}</p>
            <Button onClick={refreshStatus} className="mt-4">
              Try Again
            </Button>
          </div>
        ) : !isEligible ? (
          /* Not Eligible */
          <div className="bg-arcade-gray rounded-lg p-8 text-center">
            <div className="text-6xl mb-4">😢</div>
            <h2 className="text-2xl font-bold mb-4">Not Eligible</h2>
            <p className="text-gray-400 mb-2">
              {status?.reason || 'Your wallet is not eligible for this airdrop.'}
            </p>
            {status?.stats && (
              <div className="mt-6 p-4 bg-arcade-dark rounded-lg inline-block text-left">
                <p className="text-sm text-gray-500 mb-2">Your testnet activity:</p>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                  <p>Games Played: <span className="font-bold">{status.stats.gamesPlayed || 0}</span></p>
                  <p>Tournaments: <span className="font-bold">{status.stats.tournamentEntries || 0}</span></p>
                  {status.stats.discordMessages !== undefined && (
                    <p>Discord Messages: <span className="font-bold">{status.stats.discordMessages}</span></p>
                  )}
                  {status.stats.zealyXP !== undefined && (
                    <p>Zealy XP: <span className="font-bold">{status.stats.zealyXP}</span></p>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  Minimum required: 5 games, 1 tournament, or 50 Discord messages
                </p>
              </div>
            )}
          </div>
        ) : (
          /* Eligible - Show Claim Card */
          <div className="bg-arcade-gray rounded-lg overflow-hidden">
            {/* Tier Header */}
            <div className={`p-4 ${
              status?.tier === 'legendary' ? 'bg-gradient-to-r from-yellow-600/30 to-yellow-500/10' :
              status?.tier === 'epic' ? 'bg-gradient-to-r from-purple-600/30 to-purple-500/10' :
              status?.tier === 'rare' ? 'bg-gradient-to-r from-blue-600/30 to-blue-500/10' :
              'bg-gradient-to-r from-gray-600/30 to-gray-500/10'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-full border text-sm font-bold uppercase ${getTierBadge(status?.tier)}`}>
                    {status?.tier}
                  </span>
                  <span className="text-gray-400">Rank #{status?.rank}</span>
                </div>
                <span className="text-sm text-gray-400">{status?.points} points</span>
              </div>
            </div>

            {/* Allocation */}
            <div className="p-6">
              <div className="text-center mb-6">
                <p className="text-gray-400 text-sm mb-2">Your Allocation</p>
                <p className={`text-4xl font-bold ${getTierColor(status?.tier)}`}>
                  {formatNumber(status?.tokenAmountFormatted || 0)} 8BIT
                </p>
              </div>

              {/* Vesting Schedule */}
              <div className="bg-arcade-dark rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-400 mb-3">Vesting Schedule (3 months)</p>
                <div className="space-y-2">
                  {status?.vesting?.schedule.map((period, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-4 h-4 rounded-full ${
                          period.unlocked ? 'bg-arcade-green' : 'bg-gray-600'
                        }`}></span>
                        <span className="text-sm">
                          {i === 0 ? 'Immediate' : `Month ${period.month}`}
                        </span>
                      </div>
                      <span className={`text-sm ${period.unlocked ? 'text-arcade-green' : 'text-gray-500'}`}>
                        {period.percent}% ({formatNumber(Math.floor((status?.tokenAmountFormatted || 0) * period.percent / 100))} 8BIT)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Points Breakdown (for preview mode) */}
              {status?.stats?.breakdown && (
                <div className="bg-arcade-dark rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-400 mb-3">Your Points Breakdown</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Games ({status.stats.gamesPlayed})</span>
                      <span className="font-bold text-arcade-cyan">+{status.stats.breakdown.gamePoints}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Tournaments ({status.stats.tournamentEntries})</span>
                      <span className="font-bold text-arcade-cyan">+{status.stats.breakdown.tournamentEntryPoints}</span>
                    </div>
                    {status.stats.breakdown.tournamentFinishPoints > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Top 10 Finishes</span>
                        <span className="font-bold text-arcade-cyan">+{status.stats.breakdown.tournamentFinishPoints}</span>
                      </div>
                    )}
                    {status.stats.breakdown.highScorePoints > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">High Scores ({status.stats.highScoreAchievements})</span>
                        <span className="font-bold text-arcade-cyan">+{status.stats.breakdown.highScorePoints}</span>
                      </div>
                    )}
                    {status.stats.breakdown.discordPoints > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Discord ({status.stats.discordMessages} msgs)</span>
                        <span className="font-bold text-arcade-purple">+{status.stats.breakdown.discordPoints}</span>
                      </div>
                    )}
                    {status.stats.breakdown.zealyPoints > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Zealy ({status.stats.zealyXP} XP)</span>
                        <span className="font-bold text-arcade-pink">+{status.stats.breakdown.zealyPoints}</span>
                      </div>
                    )}
                  </div>
                  {status.stats.breakdown.multiplier > 1 && (
                    <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between">
                      <span className="text-yellow-400">Early Adopter Bonus</span>
                      <span className="font-bold text-yellow-400">x{status.stats.breakdown.multiplier}</span>
                    </div>
                  )}
                  <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between">
                    <span className="font-bold">Total Points</span>
                    <span className="font-bold text-white">{status.stats.breakdown.totalPoints}</span>
                  </div>
                </div>
              )}

              {/* Contract Vesting Info (if claimed) */}
              {vestingInfo && vestingInfo.totalAmount > BigInt(0) && (
                <div className="bg-arcade-dark rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-400 mb-3">Your Vesting Status</p>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500">Total Allocated</p>
                      <p className="font-bold">{formatTokens(vestingInfo.totalAmount)} 8BIT</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Already Claimed</p>
                      <p className="font-bold text-arcade-green">{formatTokens(vestingInfo.claimed)} 8BIT</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Currently Vested</p>
                      <p className="font-bold">{formatTokens(vestingInfo.vested)} 8BIT</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Available to Claim</p>
                      <p className="font-bold text-arcade-cyan">{formatTokens(vestingInfo.claimable)} 8BIT</p>
                    </div>
                  </div>
                  {vestingInfo.nextUnlockTimestamp > BigInt(0) && (
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <p className="text-xs text-gray-500">
                        Next unlock: {new Date(Number(vestingInfo.nextUnlockTimestamp) * 1000).toLocaleDateString()} ({formatTokens(vestingInfo.nextUnlockAmount)} 8BIT)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Claim Button */}
              <div className="space-y-3">
                {!hasClaimed ? (
                  /* Initial Claim */
                  <Button
                    onClick={initiateClaim}
                    disabled={!isContractReady || isClaimPending || isClaimConfirming}
                    className="w-full bg-gradient-to-r from-arcade-purple to-arcade-pink hover:from-arcade-pink hover:to-arcade-purple text-white font-bold py-4 text-lg"
                  >
                    {isClaimPending
                      ? 'Confirm in Wallet...'
                      : isClaimConfirming
                      ? 'Claiming...'
                      : `Claim ${formatNumber(Math.floor((status?.tokenAmountFormatted || 0) / 3))} 8BIT`}
                  </Button>
                ) : vestingInfo && vestingInfo.claimable > BigInt(0) ? (
                  /* Claim Vested */
                  <Button
                    onClick={claimVested}
                    disabled={isClaimPending || isClaimConfirming}
                    className="w-full bg-gradient-to-r from-arcade-cyan to-arcade-green hover:from-arcade-green hover:to-arcade-cyan text-white font-bold py-4 text-lg"
                  >
                    {isClaimPending
                      ? 'Confirm in Wallet...'
                      : isClaimConfirming
                      ? 'Claiming...'
                      : `Claim ${formatTokens(vestingInfo.claimable)} 8BIT`}
                  </Button>
                ) : hasClaimed ? (
                  /* Fully Claimed or Waiting */
                  <div className="text-center py-4">
                    <span className="text-arcade-green font-bold">Claim Initiated</span>
                    {vestingInfo && vestingInfo.nextUnlockTimestamp > BigInt(0) && (
                      <p className="text-sm text-gray-400 mt-1">
                        Next tokens unlock on {new Date(Number(vestingInfo.nextUnlockTimestamp) * 1000).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                ) : null}

                {/* Transaction Link */}
                {claimTxHash && (
                  <a
                    href={getTxExplorerUrl(claimTxHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-sm text-arcade-cyan hover:underline"
                  >
                    View transaction on Arbiscan
                  </a>
                )}
              </div>

              {/* Deadline */}
              <div className="mt-6 pt-4 border-t border-gray-700 text-center text-sm text-gray-500">
                <p>Claim deadline: {getTimeRemaining()}</p>
                {status?.claimDeadline && (
                  <p className="text-xs mt-1">
                    {new Date(status.claimDeadline).toLocaleDateString()} {new Date(status.claimDeadline).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Airdrop Stats */}
        {contractStats && (
          <div className="mt-8 bg-arcade-gray rounded-lg p-6">
            <h3 className="text-lg font-bold mb-4">Airdrop Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-arcade-cyan">
                  {parseFloat(contractStats.totalAllocated).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-400">Total Allocated</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-arcade-green">
                  {parseFloat(contractStats.totalClaimed).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-400">Claimed</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-arcade-pink">
                  {parseFloat(contractStats.remaining).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-xs text-gray-400">Remaining</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {contractStats.timeRemaining > 0
                    ? `${Math.floor(contractStats.timeRemaining / 86400)}d`
                    : 'Ended'}
                </p>
                <p className="text-xs text-gray-400">Time Left</p>
              </div>
            </div>
          </div>
        )}

        {/* How It Works */}
        <div className="mt-8 bg-arcade-gray rounded-lg p-6">
          <h3 className="text-lg font-bold mb-4">How The Airdrop Works</h3>
          <div className="space-y-4 text-sm text-gray-300">
            <div className="flex items-start gap-3">
              <span className="text-arcade-cyan font-bold">1.</span>
              <div>
                <p className="font-bold">Eligibility</p>
                <p className="text-gray-400">
                  Players who participated in the testnet (played 5+ games or entered 1+ tournament) are eligible.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-arcade-cyan font-bold">2.</span>
              <div>
                <p className="font-bold">Point System</p>
                <p className="text-gray-400">
                  Points are earned based on games played, tournament participation, high scores, and early adopter status.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-arcade-cyan font-bold">3.</span>
              <div>
                <p className="font-bold">Tier Allocation</p>
                <p className="text-gray-400">
                  Top 1% = Legendary, Top 5% = Epic, Top 20% = Rare, Everyone else = Common.
                  Higher tiers receive larger token allocations.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-arcade-cyan font-bold">4.</span>
              <div>
                <p className="font-bold">Vesting Schedule</p>
                <p className="text-gray-400">
                  33.33% released immediately on claim, 33.33% after 30 days, final 33.34% after 60 days.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-arcade-cyan font-bold">5.</span>
              <div>
                <p className="font-bold">Claim Deadline</p>
                <p className="text-gray-400">
                  You have 90 days to initiate your claim. Unclaimed tokens return to the treasury.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
