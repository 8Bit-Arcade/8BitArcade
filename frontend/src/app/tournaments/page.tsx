'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatNumber, formatTimeRemaining } from '@/lib/utils';
import { callFunction } from '@/lib/firebase-functions';
import { TESTNET_CONTRACTS, TOURNAMENT_MANAGER_ABI, EIGHT_BIT_TOKEN_ABI } from '@/config/contracts';
//import { parseUnits } from 'ethers';

type Tier = 'Standard' | 'High Roller';
type Period = 'Weekly' | 'Monthly';
type TournamentStatus = 'upcoming' | 'active' | 'ended';

interface Tournament {
  id: number;
  tier: Tier;
  period: Period;
  startTime: Date;
  endTime: Date;
  entryFee: bigint;
  prizePool: bigint;
  totalEntries: number;
  winner: string;
  isActive: boolean;
  status: TournamentStatus;
  hasEntered?: boolean;
}

export default function TournamentsPage() {
  const { address, isConnected } = useAccount();
  const [filter, setFilter] = useState<Tier | 'all'>('all');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<number | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);

  // Check token allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TESTNET_CONTRACTS.EIGHT_BIT_TOKEN,
    abi: EIGHT_BIT_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, TESTNET_CONTRACTS.TOURNAMENT_MANAGER] : undefined,
  });

  // Approve tokens
  const { writeContract: approve, data: approveHash } = useWriteContract();
  const { isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Enter tournament
  const { writeContract: enterTournament, data: enterHash, error: enterError } = useWriteContract();
  const { isSuccess: isEnterSuccess } = useWaitForTransactionReceipt({
    hash: enterHash,
  });

  // Handle successful approval - refetch allowance
  useEffect(() => {
    if (isApproveSuccess && approveHash) {
      console.log('✅ Approval confirmed! Tx:', approveHash);
      console.log('🔄 Refetching allowance...');

      // Refetch allowance to update UI
      refetchAllowance?.();

      // Clear needsApproval flag after refetch
      setTimeout(() => {
        setNeedsApproval(false);
        console.log('✅ Approval complete - button should change to "Enter Now"');
      }, 1000);
    }
  }, [isApproveSuccess, approveHash, refetchAllowance]);

  // DEBUG: Track wagmi errors
  useEffect(() => {
    if (enterError) {
      console.error('❌ enterTournament ERROR:', enterError);
      setEntering(false);
    }
  }, [enterError]);

  // Fetch tournament data from blockchain
  const { data: tournament1 } = useReadContract({
    address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER,
    abi: TOURNAMENT_MANAGER_ABI,
    functionName: 'getTournament',
    args: [BigInt(1)],
  });

  const { data: tournament2 } = useReadContract({
    address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER,
    abi: TOURNAMENT_MANAGER_ABI,
    functionName: 'getTournament',
    args: [BigInt(2)],
  });

  const { data: tournament3 } = useReadContract({
    address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER,
    abi: TOURNAMENT_MANAGER_ABI,
    functionName: 'getTournament',
    args: [BigInt(3)],
  });

  // Check if user has entered tournaments
  const { data: hasEntered1 } = useReadContract({
    address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER,
    abi: TOURNAMENT_MANAGER_ABI,
    functionName: 'hasPlayerEntered',
    args: address ? [BigInt(1), address] : undefined,
  });

  const { data: hasEntered2 } = useReadContract({
    address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER,
    abi: TOURNAMENT_MANAGER_ABI,
    functionName: 'hasPlayerEntered',
    args: address ? [BigInt(2), address] : undefined,
  });

  const { data: hasEntered3 } = useReadContract({
  address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER,
  abi: TOURNAMENT_MANAGER_ABI,
  functionName: 'hasPlayerEntered',
  args: address ? [BigInt(3), address] : undefined,
});

  // Convert blockchain data to frontend format
  useEffect(() => {
    const formattedTournaments: Tournament[] = [];

    // Helper to map tier enum to display string
    const getTierName = (tier: number): Tier => {
      return tier === 0 ? 'Standard' : 'High Roller';
    };

    // Helper to map period enum to display string
    const getPeriodName = (period: number): Period => {
      return period === 0 ? 'Weekly' : 'Monthly';
    };

    // Helper to determine tournament status
    const getStatus = (startTime: bigint, endTime: bigint, isActive: boolean): TournamentStatus => {
      const now = Math.floor(Date.now() / 1000);
      if (!isActive) return 'ended';
      if (now < Number(startTime)) return 'upcoming';
      if (now >= Number(startTime) && now < Number(endTime)) return 'active';
      return 'ended';
    };

    // Process tournament 1
    if (tournament1 && Array.isArray(tournament1) && tournament1.length >= 9) {
      const [tier, period, startTime, endTime, entryFee, prizePool, totalEntries, winner, isActive] = tournament1;
      formattedTournaments.push({
        id: 1,
        tier: getTierName(tier as number),
        period: getPeriodName(period as number),
        startTime: new Date(Number(startTime) * 1000),
        endTime: new Date(Number(endTime) * 1000),
        entryFee: entryFee as bigint,
        prizePool: prizePool as bigint,
        totalEntries: Number(totalEntries),
        winner: winner as string,
        isActive: isActive as boolean,
        status: getStatus(startTime as bigint, endTime as bigint, isActive as boolean),
        hasEntered: hasEntered1 as boolean || false,
      });
    }

    // Process tournament 2
    if (tournament2 && Array.isArray(tournament2) && tournament2.length >= 9) {
      const [tier, period, startTime, endTime, entryFee, prizePool, totalEntries, winner, isActive] = tournament2;
      formattedTournaments.push({
        id: 2,
        tier: getTierName(tier as number),
        period: getPeriodName(period as number),
        startTime: new Date(Number(startTime) * 1000),
        endTime: new Date(Number(endTime) * 1000),
        entryFee: entryFee as bigint,
        prizePool: prizePool as bigint,
        totalEntries: Number(totalEntries),
        winner: winner as string,
        isActive: isActive as boolean,
        status: getStatus(startTime as bigint, endTime as bigint, isActive as boolean),
        hasEntered: hasEntered2 as boolean || false,
      });
    }

    // Process tournament 3
    if (tournament3 && Array.isArray(tournament3) && tournament3.length >= 9) {
      const [tier, period, startTime, endTime, entryFee, prizePool, totalEntries, winner, isActive] = tournament3;
      formattedTournaments.push({
        id: 3,
        tier: getTierName(tier as number),
        period: getPeriodName(period as number),
        startTime: new Date(Number(startTime) * 1000),
        endTime: new Date(Number(endTime) * 1000),
        entryFee: entryFee as bigint,
        prizePool: prizePool as bigint,
        totalEntries: Number(totalEntries),
        winner: winner as string,
        isActive: isActive as boolean,
        status: getStatus(startTime as bigint, endTime as bigint, isActive as boolean),
        hasEntered: hasEntered3 as boolean || false,
      });
    }

    setTournaments(formattedTournaments);

    // Stop loading once we've received data (even if empty)
    // This prevents infinite "Loading..." when tournaments don't exist
    setLoading(false);
    }
  }, [tournament1, tournament2, tournament3, hasEntered1, hasEntered2, hasEntered3]);

  // Check if approval is needed
  useEffect(() => {
    if (selectedTournament !== null && allowance !== undefined) {
      const tournament = tournaments.find(t => t.id === selectedTournament);
      if (tournament) {
        setNeedsApproval((allowance as bigint) < tournament.entryFee);
      }
    }
  }, [selectedTournament, allowance, tournaments]);

  const handleApprove = async (tournament: Tournament) => {
  if (!isConnected) return;

  console.log(`🔑 Approving 8BIT tokens for tournament ${tournament.id}`);
  console.log(`💰 Entry fee: ${formatEther(tournament.entryFee)} 8BIT`);

  // Approve exactly the tournament entry fee
  const approvalAmount = tournament.entryFee;

approve({
  address: TESTNET_CONTRACTS.EIGHT_BIT_TOKEN,
  abi: EIGHT_BIT_TOKEN_ABI,
  functionName: 'approve',
  args: [TESTNET_CONTRACTS.TOURNAMENT_MANAGER, approvalAmount],
});
};
  
  const handleEnter = async (tournamentId: string) => {
    console.log('🎮 ENTER CLICKED - tournament:', tournamentId);

    if (!address || !isConnected) {
      console.log('❌ Wallet not connected');
      return;
    }

    // Find the tournament
    const tournament = tournaments.find(t => t.id === parseInt(tournamentId));
    if (!tournament) {
      console.error('❌ Tournament not found:', tournamentId);
      return;
    }

    console.log('📊 Tournament data:', {
      id: tournament.id,
      entryFee: formatEther(tournament.entryFee),
      allowance: allowance ? formatEther(allowance as bigint) : '0',
    });

    // Check if we have sufficient allowance
    if (!allowance || (allowance as bigint) < tournament.entryFee) {
      console.log('⚠️ Insufficient allowance - user needs to approve first');
      // Set selected tournament so approval button appears
      setSelectedTournament(parseInt(tournamentId));
      return;
    }

    // We have sufficient allowance, proceed with entry
    console.log('✅ Sufficient allowance detected, entering tournament...');
    setEntering(true);
    setSelectedTournament(parseInt(tournamentId));

    enterTournament({
      address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER,
      abi: TOURNAMENT_MANAGER_ABI,
      functionName: 'enterTournament',
      args: [BigInt(tournamentId)],
    });

    console.log('🚀 Tournament entry transaction sent');
  };

  // Handle successful tournament entry
  useEffect(() => {
    async function handleEntrySuccess() {
      if (isEnterSuccess && enterHash && selectedTournament) {
        console.log(`✅ Tournament entry successful! Tx: ${enterHash}`);

        // Optional: Notify backend for analytics/indexing (non-critical)
        // The blockchain is the source of truth
        if (address) {
          try {
            await callFunction('recordTournamentEntry', {
              tournamentId: selectedTournament.toString(),
              player: address.toLowerCase(),
              txHash: enterHash,
            }).catch(err => {
              console.warn('Backend notification failed (non-critical):', err);
            });
          } catch (error) {
            // Ignore backend errors - blockchain entry succeeded
            console.warn('Backend notification skipped:', error);
          }
        }

        setEntering(false);
        setSelectedTournament(null);

        // Tournament data will auto-refresh via useReadContract hooks
        // The hasEntered check will update automatically
      }
    }

    handleEntrySuccess();
  }, [isEnterSuccess, enterHash, selectedTournament, address]);

  const filteredTournaments =
    filter === 'all'
      ? tournaments
      : tournaments.filter((t) => t.tier === filter);

  const getStatusColor = (status: TournamentStatus) => {
    switch (status) {
      case 'active':
        return 'text-arcade-green';
      case 'upcoming':
        return 'text-arcade-cyan';
      case 'ended':
        return 'text-gray-500';
    }
  };

  const getStatusBadge = (status: TournamentStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-1 bg-arcade-green/20 text-arcade-green font-pixel text-xs rounded">
            LIVE
          </span>
        );
      case 'upcoming':
        return (
          <span className="px-2 py-1 bg-arcade-cyan/20 text-arcade-cyan font-pixel text-xs rounded">
            SOON
          </span>
        );
      case 'ended':
        return (
          <span className="px-2 py-1 bg-gray-500/20 text-gray-500 font-pixel text-xs rounded">
            ENDED
          </span>
        );
    }
  };

  const getTierBadge = (tier: Tier) => {
    if (tier === 'High Roller') {
      return (
        <span className="px-2 py-1 bg-arcade-pink/20 text-arcade-pink font-pixel text-xs rounded">
          ⭐ HIGH ROLLER
        </span>
      );
    }
    return (
      <span className="px-2 py-1 bg-arcade-purple/20 text-arcade-purple font-pixel text-xs rounded">
        STANDARD
      </span>
    );
  };

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-pixel text-2xl md:text-3xl text-arcade-pink glow-pink mb-2">
            TOURNAMENTS
          </h1>
          <p className="font-arcade text-gray-400 mb-4">
            Two-Tier Competition System - Standard & High Roller
          </p>
          <div className="flex flex-wrap gap-4 justify-center text-sm font-arcade">
            <div className="card-arcade px-4 py-2">
              <span className="text-gray-400">Standard: </span>
              <span className="text-arcade-green">$1 Weekly / $5 Monthly</span>
            </div>
            <div className="card-arcade px-4 py-2">
              <span className="text-gray-400">High Roller: </span>
              <span className="text-arcade-pink">$5 Weekly / $25 Monthly</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6 justify-center">
          {(['all', 'Standard', 'High Roller'] as const).map((tierFilter) => (
            <Button
              key={tierFilter}
              variant={filter === tierFilter ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setFilter(tierFilter)}
            >
              {tierFilter === 'all' ? 'All Tiers' : tierFilter}
            </Button>
          ))}
        </div>

        {/* Tournament List */}
        <div className="space-y-4">
          {loading ? (
            <Card>
              <div className="text-center py-8">
                <p className="font-arcade text-gray-400">Loading tournaments...</p>
              </div>
            </Card>
          ) : filteredTournaments.length === 0 ? (
            <Card>
              <div className="text-center py-8">
                <p className="font-pixel text-gray-400 mb-2">No tournaments available</p>
                <p className="font-arcade text-sm text-gray-500">
                  Check back soon for upcoming tournaments!
                </p>
              </div>
            </Card>
          ) : (
            filteredTournaments.map((tournament) => (
            <Card key={tournament.id} className="hover:border-arcade-pink/60">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Tournament Info */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-2">
                    <h3 className="font-pixel text-white text-sm">
                      {tournament.tier} {tournament.period}
                    </h3>
                    {getTierBadge(tournament.tier)}
                    {getStatusBadge(tournament.status)}
                  </div>
                  <p className="font-arcade text-gray-400 text-sm mb-2">
                    Compete across all games for {tournament.period.toLowerCase()} glory
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-2 py-1 bg-arcade-dark border border-arcade-green/30 text-arcade-green font-arcade text-xs rounded">
                      All 12 Games
                    </span>
                    {tournament.tier === 'High Roller' && (
                      <span className="px-2 py-1 bg-arcade-dark border border-arcade-pink/30 text-arcade-pink font-arcade text-xs rounded">
                        Premium Prizes
                      </span>
                    )}
                  </div>
                </div>

                {/* Prize & Stats */}
                <div className="flex flex-col items-end gap-2">
                  <div className="text-right">
                    <p className="font-arcade text-xs text-gray-500">Prize Pool</p>
                    <p className="font-pixel text-arcade-yellow">
                      {formatNumber(Number(formatEther(tournament.prizePool)))} 8BIT
                    </p>
                    <p className="font-arcade text-xs text-gray-400">
                      ${(Number(formatEther(tournament.prizePool)) * 0.0005).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-arcade text-xs text-gray-500">Entry Fee</p>
                    <p className="font-arcade text-arcade-cyan">
                      {formatNumber(Number(formatEther(tournament.entryFee)))} 8BIT
                    </p>
                    <p className="font-arcade text-xs text-gray-400">
                      ${(Number(formatEther(tournament.entryFee)) * 0.0005).toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-arcade text-xs text-gray-500">Players</p>
                    <p className="font-arcade text-white">{tournament.totalEntries}</p>
                  </div>
                </div>

                {/* Action */}
                <div className="flex flex-col items-center gap-2 md:ml-4 min-w-[120px]">
                  {tournament.status === 'active' && (
                    <>
                      <p className="font-arcade text-xs text-gray-500">Ends in</p>
                      <p className={`font-pixel text-sm ${getStatusColor(tournament.status)}`}>
                        {formatTimeRemaining(tournament.endTime)}
                      </p>
                      {isConnected ? (
                        <>
                          {needsApproval && selectedTournament === tournament.id ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleApprove(tournament)}
                              disabled={!!approveHash}
                            >
                              {approveHash ? 'Approving...' : 'Approve 8BIT'}
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => {
                                setSelectedTournament(tournament.id);
                                handleEnter(tournament.id.toString());
                              }}
                              disabled={!!enterHash || entering || tournament.hasEntered}
                            >
                              {entering || enterHash
                                ? 'Entering...'
                                : tournament.hasEntered
                                ? 'Entered'
                                : 'Enter Now'}
                            </Button>
                          )}
                        </>
                      ) : (
                        <Button variant="secondary" size="sm" disabled>
                          Connect Wallet
                        </Button>
                      )}
                    </>
                  )}
                  {tournament.status === 'upcoming' && (
                    <>
                      <p className="font-arcade text-xs text-gray-500">Starts in</p>
                      <p className={`font-pixel text-sm ${getStatusColor(tournament.status)}`}>
                        {formatTimeRemaining(tournament.startTime)}
                      </p>
                      <Button variant="ghost" size="sm">
                        View Details
                      </Button>
                    </>
                  )}
                  {tournament.status === 'ended' && (
                    <Button variant="ghost" size="sm">
                      View Results
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
          )}
        </div>

        {/* Info Cards */}
        <div className="grid md:grid-cols-2 gap-6 mt-12">
          {/* How It Works */}
          <Card>
            <h2 className="font-pixel text-arcade-green text-sm mb-4">HOW TOURNAMENTS WORK</h2>
            <ul className="font-arcade text-sm text-gray-300 space-y-2">
              <li className="flex gap-2">
                <span className="text-arcade-green">1.</span>
                <span>Choose your tier: Standard or High Roller</span>
              </li>
              <li className="flex gap-2">
                <span className="text-arcade-green">2.</span>
                <span>Pay entry fee in 8BIT tokens (50% burned)</span>
              </li>
              <li className="flex gap-2">
                <span className="text-arcade-green">3.</span>
                <span>Play all 12 games during tournament period</span>
              </li>
              <li className="flex gap-2">
                <span className="text-arcade-green">4.</span>
                <span>Highest combined score wins the prize pool</span>
              </li>
              <li className="flex gap-2">
                <span className="text-arcade-green">5.</span>
                <span>Winner receives 8BIT tokens automatically</span>
              </li>
            </ul>
          </Card>

          {/* Fee Distribution */}
          <Card>
            <h2 className="font-pixel text-arcade-pink text-sm mb-4">ENTRY FEE BREAKDOWN</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center font-arcade text-sm">
                <span className="text-gray-300">Prize Pool</span>
                <span className="text-arcade-green font-pixel">Fixed Amount</span>
              </div>
              <div className="flex justify-between items-center font-arcade text-sm">
                <span className="text-gray-300">Burned (Deflationary)</span>
                <span className="text-arcade-red font-pixel">50%</span>
              </div>
              <div className="flex justify-between items-center font-arcade text-sm">
                <span className="text-gray-300">Platform Reserve</span>
                <span className="text-arcade-cyan font-pixel">50%</span>
              </div>
              <div className="mt-4 p-3 bg-arcade-dark/50 rounded border border-arcade-yellow/30">
                <p className="font-arcade text-xs text-arcade-yellow">
                  💡 Entry fees help reduce token supply while funding bigger prize pools!
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Free Daily Rewards Reminder */}
        <Card className="mt-6 bg-gradient-to-r from-arcade-purple/10 to-arcade-pink/10 border-arcade-pink/30">
          <div className="text-center">
            <h3 className="font-pixel text-arcade-pink mb-2">FREE DAILY REWARDS</h3>
            <p className="font-arcade text-sm text-gray-300">
              Don't want to pay entry fees? Play for free and earn daily rewards!
            </p>
            <p className="font-arcade text-xs text-gray-400 mt-2">
              Top 10 players per game earn 280-1,250 8BIT every day. No entry fee required.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
