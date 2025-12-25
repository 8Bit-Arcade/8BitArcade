'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
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

  // Create dynamic hasEntered queries (only if wallet connected)
  const hasEnteredQueries = address
    ? tournamentIds.map(id =>
        useReadContract({
          address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER as `0x${string}`,
          abi: TOURNAMENT_MANAGER_ABI,
          functionName: 'hasPlayerEntered',
          args: [BigInt(id), address],
        })
      )
    : [];

  // Check token allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: TESTNET_CONTRACTS.EIGHT_BIT_TOKEN as `0x${string}`,
    abi: EIGHT_BIT_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, TESTNET_CONTRACTS.TOURNAMENT_MANAGER as `0x${string}`] : undefined,
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

  // DYNAMIC TOURNAMENT PROCESSING - Process all tournament data
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
      const hasEntered = hasEnteredQueries[index]?.data ?? false;

      // Skip if no data or error
      if (!tournamentData || tQuery.error) {
        if (tQuery.error) {
          console.log(`⚠️ Tournament ${tournamentIds[index]} error:`, tQuery.error);
        }
        return;
      }

      // Parse tournament data - wagmi returns tuple as array-like object
      const data = tournamentData as any;
      const fields = Object.values(data);

      if (fields.length < 9) {
        console.log(`⚠️ Tournament ${tournamentIds[index]} incomplete data:`, fields.length, 'fields');
        return;
      }

      const [tier, period, startTime, endTime, entryFee, prizePool, totalEntries, winner, isActive] = fields;

      // Only include active tournaments
      if (!isActive) {
        console.log(`⏸️ Tournament ${tournamentIds[index]} is inactive`);
        return;
      }

      // Determine tournament status
      const now = Math.floor(Date.now() / 1000);
      let status: TournamentStatus;
      if (now < Number(startTime)) {
        status = 'upcoming';
      } else if (now < Number(endTime)) {
        status = 'active';
      } else {
        status = 'ended';
      }

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
        hasEntered: hasEntered as boolean,
      });
    });

    console.log('🏁 [FINAL] Dynamic tournaments found:', formattedTournaments.length);
    console.log('📊 Tournament IDs:', formattedTournaments.map(t => t.id));

    setTournaments(formattedTournaments);
    setLoading(anyLoading);
  }, [
    ...tournamentQueries.map(q => q.data),
    ...tournamentQueries.map(q => q.isLoading),
    ...tournamentQueries.map(q => q.error),
    ...(hasEnteredQueries?.map(q => q.data) ?? []),
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

  const handleEnterTournament = async (tournamentId: number, entryFee: bigint) => {
    if (!address) {
      alert('Please connect your wallet');
      return;
    }

    console.log('🎮 Entering tournament:', tournamentId);
    console.log('💰 Entry fee:', formatEther(entryFee), '8BIT');
    console.log('✅ Current allowance:', allowance ? formatEther(allowance as bigint) : '0');

    setSelectedTournament(tournamentId);
    setEntering(true);

    try {
      // Check if approval is needed
      const currentAllowance = (allowance as bigint) || BigInt(0);
      if (currentAllowance < entryFee) {
        console.log('⚠️ Insufficient allowance, requesting approval for:', formatEther(entryFee));
        setNeedsApproval(true);

        // Approve tournament manager to spend entry fee
        const approvalAmount = entryFee * BigInt(10); // Approve 10x for future entries
        console.log('📝 Requesting approval for:', formatEther(approvalAmount), '8BIT');

        approve({
          address: TESTNET_CONTRACTS.EIGHT_BIT_TOKEN as `0x${string}`,
          abi: EIGHT_BIT_TOKEN_ABI,
          functionName: 'approve',
          args: [TESTNET_CONTRACTS.TOURNAMENT_MANAGER as `0x${string}`, approvalAmount],
        });

        // Entry will happen after approval is confirmed
        return;
      }

      console.log('✅ Sufficient allowance, entering tournament directly');

      // Enter tournament
      enterTournament({
        address: TESTNET_CONTRACTS.TOURNAMENT_MANAGER as `0x${string}`,
        abi: TOURNAMENT_MANAGER_ABI,
        functionName: 'enterTournament',
        args: [BigInt(tournamentId)],
      });
    } catch (error) {
      console.error('❌ Error entering tournament:', error);
      setEntering(false);
      alert('Failed to enter tournament. Please try again.');
    }
  };

  // When approval succeeds, automatically enter tournament
  useEffect(() => {
    if (isApproveSuccess && selectedTournament && needsApproval) {
      console.log('✅ Approval successful, now entering tournament...');

      const tournament = tournaments.find(t => t.id === selectedTournament);
      if (tournament) {
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
  }, [isApproveSuccess, selectedTournament, needsApproval, tournaments]);

  const filteredTournaments =
    filter === 'all' ? tournaments : tournaments.filter(t => t.tier === filter);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            8-Bit Tournaments
          </h1>
          <p className="text-xl text-gray-300">
            Compete for glory and prizes in weekly and monthly tournaments
          </p>
        </div>

        {/* Filter Buttons */}
        <div className="flex justify-center gap-4 mb-8">
          <Button
            onClick={() => setFilter('all')}
            variant={filter === 'all' ? 'primary' : 'secondary'}
            size="md"
          >
            All Tournaments
          </Button>
          <Button
            onClick={() => setFilter('Standard')}
            variant={filter === 'Standard' ? 'primary' : 'secondary'}
            size="md"
          >
            Standard
          </Button>
          <Button
            onClick={() => setFilter('High Roller')}
            variant={filter === 'High Roller' ? 'primary' : 'secondary'}
            size="md"
          >
            High Roller
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="text-2xl text-purple-400 animate-pulse">Loading tournaments...</div>
          </div>
        )}

        {/* No Tournaments */}
        {!loading && filteredTournaments.length === 0 && (
          <div className="text-center py-12">
            <div className="text-2xl text-gray-400">
              No tournaments available. Check back soon for upcoming tournaments!
            </div>
          </div>
        )}

        {/* Tournament Grid */}
        {!loading && filteredTournaments.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map(tournament => (
              <Card key={tournament.id} className="bg-gray-800/50 backdrop-blur-sm border-purple-500/30">
                <div className="p-6">
                  {/* Tournament Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-purple-400">
                        {tournament.tier} {tournament.period}
                      </h3>
                      <div className="text-sm text-gray-400 mt-1">Tournament #{tournament.id}</div>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        tournament.status === 'active'
                          ? 'bg-green-500/20 text-green-400'
                          : tournament.status === 'upcoming'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {tournament.status.toUpperCase()}
                    </span>
                  </div>

                  {/* Tournament Details */}
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Entry Fee:</span>
                      <span className="font-semibold">{formatNumber(Number(formatEther(tournament.entryFee)))} 8BIT</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Prize Pool:</span>
                      <span className="font-semibold text-yellow-400">
                        {formatNumber(Number(formatEther(tournament.prizePool)))} 8BIT
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Participants:</span>
                      <span className="font-semibold">{tournament.totalEntries}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">
                        {tournament.status === 'upcoming' ? 'Starts:' : tournament.status === 'active' ? 'Ends:' : 'Ended:'}
                      </span>
                      <span className="text-sm">
                        {tournament.status === 'upcoming' || tournament.status === 'active'
                          ? formatTimeRemaining(
                              tournament.status === 'upcoming' ? tournament.startTime : tournament.endTime
                            )
                          : tournament.endTime.toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Entry Button */}
                  {isConnected && tournament.status !== 'ended' && (
                    <Button
                      onClick={() => handleEnterTournament(tournament.id, tournament.entryFee)}
                      variant="primary"
                      size="lg"
                      className="w-full"
                      disabled={
                        tournament.hasEntered ||
                        (entering && selectedTournament === tournament.id)
                      }
                    >
                      {tournament.hasEntered
                        ? '✅ Already Entered'
                        : entering && selectedTournament === tournament.id
                        ? needsApproval
                          ? 'Approving...'
                          : 'Entering...'
                        : 'Enter Tournament'}
                    </Button>
                  )}

                  {!isConnected && (
                    <Button variant="secondary" size="lg" className="w-full" disabled>
                      Connect Wallet to Enter
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Info Section */}
        <div className="mt-12 text-center text-gray-400">
          <p className="mb-2">
            Enter tournaments to compete for prizes! Your highest score during the tournament period will count.
          </p>
          <p>Entry fees are burned, and prize pools are distributed to top performers.</p>
        </div>
      </div>
    </div>
  );
}
