'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import TournamentLeaderboard from '@/components/tournament/TournamentLeaderboard';
import { formatNumber, formatTimeRemaining } from '@/lib/utils';
import { callFunction } from '@/lib/firebase-functions';
import { TESTNET_CONTRACTS, TOURNAMENT_MANAGER_ABI, EIGHT_BIT_TOKEN_ABI } from '@/config/contracts';
import { parseUnits } from 'ethers';

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

  // DYNAMIC TOURNAMENT DISCOVERY - Check first 12 tournament slots
  const MAX_TOURNAMENTS = 12;
  const tournamentIds = Array.from({ length: MAX_TOURNAMENTS }, (_, i) => i + 1);

  // Create dynamic tournament queries
  const tournamentQueries = tournamentIds.map(id =>
    useReadContract({
      address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER as `0x${string}`,
      abi: TOURNAMENT_MANAGER_ABI,
      functionName: 'getTournament',
      args: [BigInt(id)],
    })
  );

  // Create dynamic hasEntered queries (always create hooks, but disable when no wallet)
  const hasEnteredQueries = tournamentIds.map(id =>
    useReadContract({
      address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER as `0x${string}`,
      abi: TOURNAMENT_MANAGER_ABI,
      functionName: 'hasPlayerEntered',
      args: address ? [BigInt(id), address] : undefined,
      query: {
        enabled: !!address, // Only fetch when wallet is connected
      },
    })
  );

  // Check token allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TESTNET_CONTRACTS.EIGHT_BIT_TOKEN as `0x${string}`,
    abi: EIGHT_BIT_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, TESTNET_CONTRACTS.TOURNAMENT_MANAGER as `0x${string}`] : undefined,
  });

  // Check token balance
  const { data: tokenBalance } = useReadContract({
    address: TESTNET_CONTRACTS.EIGHT_BIT_TOKEN as `0x${string}`,
    abi: EIGHT_BIT_TOKEN_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Approve tokens
  const { writeContract: approve, data: approveHash, error: approveError } = useWriteContract();
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

  // DEBUG: Track all transaction states
  useEffect(() => {
    console.log('📊 TRANSACTION STATE UPDATE:', {
      approveHash,
      enterHash,
      approveError: approveError?.message,
      enterError: enterError?.message,
      isApproveSuccess,
      isEnterSuccess,
      needsApproval,
      entering,
    });
  }, [approveHash, enterHash, approveError, enterError, isApproveSuccess, isEnterSuccess, needsApproval, entering]);

  // DEBUG: Track approve errors
  useEffect(() => {
    if (approveError) {
      console.error('❌ approve ERROR:', approveError);
      setEntering(false);
      setNeedsApproval(false);
      alert(`Approval failed: ${approveError.message || 'Unknown error'}`);
    }
  }, [approveError]);

  // DEBUG: Track enter errors
  useEffect(() => {
    if (enterError) {
      console.error('❌ enterTournament ERROR:', enterError);
      setEntering(false);

      // Parse error message to provide helpful feedback
      const errorMsg = enterError.message || 'Unknown error';
      let userMessage = 'Tournament entry failed!\n\n';

      if (errorMsg.includes('Internal JSON-RPC error') || errorMsg.includes('reverted')) {
        userMessage += 'Possible reasons:\n';
        userMessage += '• You may have already entered this tournament\n';
        userMessage += '• Tournament may be full or ended\n';
        userMessage += '• Insufficient 8BIT tokens\n\n';
        userMessage += 'Check the console for details.';
      } else if (errorMsg.includes('User rejected')) {
        userMessage += 'You cancelled the transaction.';
      } else {
        userMessage += `Error: ${errorMsg}`;
      }

      alert(userMessage);
    }
  }, [enterError]);

  // DYNAMIC TOURNAMENT PROCESSING - BULLETPROOF VERSION
  useEffect(() => {
    console.log('🔍 [DYNAMIC] Processing tournament data...');

    const formattedTournaments: Tournament[] = [];
    let anyLoading = false;

    tournamentQueries.forEach((tQuery, index) => {
      // Check if still loading
      if (tQuery.isLoading) {
        anyLoading = true;
        return;
      }

      const tournamentData = tQuery.data;

      // SAFEGUARD: Skip if no tournament data or error
      if (!tournamentData || tQuery.error) {
        if (tQuery.error) {
          console.log(`⚠️ Tournament ${tournamentIds[index]} error:`, tQuery.error);
        }
        return;
      }

      // SAFEGUARD: Safe hasEntered access - only check if wallet connected
      const hasEntered = (address && hasEnteredQueries[index]?.data) ?? false;

      // Parse tournament data safely
      const data = tournamentData as any;

      // ✅ FIX: Check if data has values before Object.values
      if (!data || typeof data !== 'object') {
        console.log(`⚠️ Tournament ${tournamentIds[index]} invalid data type:`, typeof data);
        return;
      }

      const fields = Object.values(data) as any[];

      // ✅ FIX: Validate fields length BEFORE destructuring
      if (fields.length < 9) {
        console.log(`⚠️ Tournament ${tournamentIds[index]} incomplete data:`, fields.length, 'fields');
        return;
      }

      const [tier, period, startTime, endTime, entryFee, prizePool, totalEntries, winner, isActive] = fields;

      // Skip inactive tournaments
      if (!isActive) {
        console.log(`⏸️ Tournament ${tournamentIds[index]} is inactive`);
        return;
      }

      // Determine status
      const now = Math.floor(Date.now() / 1000);
      const status: TournamentStatus =
        now < Number(startTime) ? 'upcoming' : now < Number(endTime) ? 'active' : 'ended';

      console.log(`✅ Tournament ${tournamentIds[index]} processed:`, {
        tier: Number(tier),
        period: Number(period),
        status,
        totalEntries: Number(totalEntries),
      });

      formattedTournaments.push({
        id: tournamentIds[index],
        tier: Number(tier) === 0 ? 'Standard' : 'High Roller',
        period: Number(period) === 0 ? 'Weekly' : 'Monthly',
        startTime: new Date(Number(startTime) * 1000),
        endTime: new Date(Number(endTime) * 1000),
        entryFee: entryFee as bigint,
        prizePool: prizePool as bigint,
        totalEntries: Number(totalEntries),
        winner: winner as string,
        isActive: true,
        status,
        hasEntered: Boolean(hasEntered),
      });
    });

    console.log('🏁 [FINAL] Dynamic tournaments found:', formattedTournaments.length);
    setTournaments(formattedTournaments);
    setLoading(anyLoading);
  }, [
    // ✅ SAFE DEPENDENCIES - only tournamentQueries properties
    ...tournamentQueries.map(q => q.data),
    ...tournamentQueries.map(q => q.isLoading),
    ...tournamentQueries.map(q => q.error),
    address, // Only re-run when address changes (wallet connect/disconnect)
  ]);

  // Handle successful entry
  useEffect(() => {
    if (isEnterSuccess && enterHash) {
      console.log('✅ Tournament entry confirmed! Tx:', enterHash);
      setEntering(false);
      setSelectedTournament(null);

      // Show success message
      alert('Successfully entered tournament! Good luck! 🎮');
    }
  }, [isEnterSuccess, enterHash]);

  const handleEnterTournament = (tournamentId: number, entryFee: bigint) => {
    console.log('🚀 handleEnterTournament CALLED:', {
      tournamentId,
      entryFee: formatEther(entryFee),
      address,
      isConnected,
    });

    if (!address || !isConnected) {
      console.log('❌ No wallet connected');
      alert('Please connect your wallet');
      return;
    }

    // Check if user already entered
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (tournament?.hasEntered) {
      console.log('⚠️ User already entered this tournament');
      alert('You have already entered this tournament!');
      return;
    }

    // Check 8BIT token balance
    const currentBalance = (tokenBalance as bigint) || BigInt(0);
    console.log('💰 Balance check:', {
      balance: formatEther(currentBalance),
      required: formatEther(entryFee),
      hasEnough: currentBalance >= entryFee,
    });

    if (currentBalance < entryFee) {
      console.log('❌ Insufficient 8BIT balance');
      alert(
        `Insufficient 8BIT tokens!\n\nYou need: ${formatEther(entryFee)} 8BIT\nYou have: ${formatEther(currentBalance)} 8BIT\n\nGet more tokens from the faucet or buy some.`
      );
      return;
    }

    console.log('📊 Current state:', {
      allowance: allowance ? formatEther(allowance as bigint) : 'undefined',
      balance: formatEther(currentBalance),
      selectedTournament,
      entering,
      needsApproval,
    });

    setSelectedTournament(tournamentId);
    setEntering(true);
    setNeedsApproval(false);

    // Check if approval is needed
    const currentAllowance = (allowance as bigint) || BigInt(0);
    console.log('🔍 Allowance check:', {
      current: formatEther(currentAllowance),
      required: formatEther(entryFee),
      needsApproval: currentAllowance < entryFee,
    });

    if (currentAllowance < entryFee) {
      console.log('🔑 Need approval - calling approve()');
      setNeedsApproval(true);

      const approvalAmount = entryFee * BigInt(10);
      console.log('💳 Approve call:', {
        tokenAddress: TESTNET_CONTRACTS.EIGHT_BIT_TOKEN,
        spenderAddress: TESTNET_CONTRACTS.TOURNAMENT_MANAGER,
        amount: formatEther(approvalAmount),
        amountRaw: approvalAmount.toString(),
      });

      approve({
        address: TESTNET_CONTRACTS.EIGHT_BIT_TOKEN as `0x${string}`,
        abi: EIGHT_BIT_TOKEN_ABI,
        functionName: 'approve',
        args: [TESTNET_CONTRACTS.TOURNAMENT_MANAGER as `0x${string}`, approvalAmount],
      });

      console.log('✅ approve() function called - waiting for wallet popup...');
      return;
    }

    // Direct entry if already approved
    console.log('🎮 Calling enterTournament directly (already approved)');
    console.log('💳 enterTournament call:', {
      contractAddress: TESTNET_CONTRACTS.TOURNAMENT_MANAGER,
      tournamentId,
      balance: formatEther(currentBalance),
      allowance: formatEther(currentAllowance),
      entryFee: formatEther(entryFee),
      abiHasFunction: TOURNAMENT_MANAGER_ABI.some((item: any) => item.name === 'enterTournament'),
    });

    enterTournament({
      address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER as `0x${string}`,
      abi: TOURNAMENT_MANAGER_ABI,
      functionName: 'enterTournament',
      args: [BigInt(tournamentId)],
    });

    console.log('📤 enterTournament() function called - waiting for wallet popup...');
  };

  // When approval succeeds, automatically enter tournament
  useEffect(() => {
    if (isApproveSuccess && selectedTournament && needsApproval) {
      console.log('✅ Approval successful, now entering tournament...');

      const tournament = tournaments.find(t => t.id === selectedTournament);
      if (tournament) {
        // Double-check balance before auto-entering
        const currentBalance = (tokenBalance as bigint) || BigInt(0);
        console.log('💰 Pre-entry balance check:', {
          balance: formatEther(currentBalance),
          required: formatEther(tournament.entryFee),
          hasEnough: currentBalance >= tournament.entryFee,
        });

        if (currentBalance < tournament.entryFee) {
          console.log('❌ Insufficient balance for auto-entry');
          setEntering(false);
          setNeedsApproval(false);
          alert(`Insufficient 8BIT tokens!\n\nYou need: ${formatEther(tournament.entryFee)} 8BIT\nYou have: ${formatEther(currentBalance)} 8BIT`);
          return;
        }

        setTimeout(() => {
          console.log('🎮 Auto-entering tournament after approval');
          enterTournament({
            address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER as `0x${string}`,
            abi: TOURNAMENT_MANAGER_ABI,
            functionName: 'enterTournament',
            args: [BigInt(selectedTournament)],
          });
        }, 1500); // Wait for allowance to update
      }
    }
  }, [isApproveSuccess, selectedTournament, needsApproval, tournaments, tokenBalance]);

  const filteredTournaments =
    filter === 'all' ? tournaments : tournaments.filter(t => t.tier === filter);

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

  const getStatusColor = (status: TournamentStatus) => {
    return status === 'active'
      ? 'text-arcade-green'
      : status === 'upcoming'
      ? 'text-arcade-yellow'
      : 'text-gray-400';
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
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => {
                              console.log('🔥 BUTTON CLICKED!', {
                                tournamentId: tournament.id,
                                entryFee: formatEther(tournament.entryFee),
                                wallet: { address, isConnected },
                                buttonDisabled:
                                  entering ||
                                  tournament.hasEntered ||
                                  (selectedTournament === tournament.id && (!!approveHash || !!enterHash)),
                              });
                              handleEnterTournament(tournament.id, tournament.entryFee);
                            }}
                            disabled={
                              entering ||
                              tournament.hasEntered ||
                              (selectedTournament === tournament.id && (!!approveHash || !!enterHash))
                            }
                          >
                            {selectedTournament === tournament.id && approveHash && !enterHash
                              ? 'Approving...'
                              : selectedTournament === tournament.id && enterHash
                              ? 'Entering...'
                              : tournament.hasEntered
                              ? 'Entered'
                              : 'Enter Now'}
                          </Button>
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

                {/* Tournament Leaderboard */}
                {(tournament.status === 'active' || tournament.status === 'ended') && (
                  <div className="mt-4 pt-4 border-t border-arcade-green/20">
                    <TournamentLeaderboard
                      tournamentId={tournament.id}
                      tournamentName={`${tournament.tier} ${tournament.period}`}
                      isActive={tournament.status === 'active'}
                    />
                  </div>
                )}
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
