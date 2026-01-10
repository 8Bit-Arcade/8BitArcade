'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/lib/firebase';
import { VESTED_AIRDROP_ADDRESS, VESTED_AIRDROP_ABI } from '@/config/contracts';

/**
 * Airdrop status from Firebase
 */
interface AirdropStatus {
  eligible: boolean;
  airdropId?: string;
  wallet?: string;
  tier?: 'legendary' | 'epic' | 'rare' | 'common';
  rank?: number;
  points?: number;
  tokenAmount?: string; // Wei
  tokenAmountFormatted?: number;
  proof?: string[];
  claimed?: boolean;
  claimedAt?: string | null;
  claimDeadline?: string;
  merkleRoot?: string;
  contractAddress?: string | null;
  status?: 'pending_deployment' | 'active' | 'ended';
  message?: string;
  reason?: string;
  vesting?: {
    vestedAmount: number;
    nextUnlockDate: string | null;
    nextUnlockAmount: number;
    totalAmount: number;
    schedule: Array<{
      month: number;
      percent: number;
      unlocked: boolean;
    }>;
  };
  stats?: {
    gamesPlayed: number;
    tournamentEntries: number;
    tournamentTop10Finishes: number;
    isEarlyAdopter: boolean;
  };
}

/**
 * Leaderboard entry
 */
interface LeaderboardEntry {
  rank: number;
  wallet: string;
  tier: string;
  points: number;
  tokenAmountFormatted: number;
  claimed: boolean;
}

/**
 * Contract vesting info
 */
interface ContractVestingInfo {
  totalAmount: bigint;
  claimed: bigint;
  vested: bigint;
  claimable: bigint;
  nextUnlockTimestamp: bigint;
  nextUnlockAmount: bigint;
}

/**
 * Hook return type
 */
interface UseAirdropReturn {
  // Status
  isLoading: boolean;
  isContractReady: boolean;
  error: string | null;

  // Eligibility & allocation
  status: AirdropStatus | null;
  isEligible: boolean;
  hasClaimed: boolean;

  // Contract state
  contractStats: {
    totalAllocated: string;
    totalClaimed: string;
    remaining: string;
    isActive: boolean;
    claimDeadline: Date | null;
    timeRemaining: number;
  } | null;
  vestingInfo: ContractVestingInfo | null;

  // Actions
  initiateClaim: () => Promise<void>;
  claimVested: () => Promise<void>;
  refreshStatus: () => Promise<void>;

  // Transaction state
  isClaimPending: boolean;
  isClaimConfirming: boolean;
  claimTxHash: string | null;

  // Leaderboard
  leaderboard: LeaderboardEntry[];
  loadLeaderboard: () => Promise<void>;
}

/**
 * Hook for managing airdrop claims
 */
export function useAirdrop(): UseAirdropReturn {
  const { address, isConnected } = useAccount();
  const [status, setStatus] = useState<AirdropStatus | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimTxHash, setClaimTxHash] = useState<string | null>(null);

  const functions = getFunctions(app);

  // Check if contract is deployed
  const isContractReady = VESTED_AIRDROP_ADDRESS !== '0x0000000000000000000000000000000000000000';

  // Read contract stats
  const { data: contractStatsData, refetch: refetchStats } = useReadContract({
    address: isContractReady ? VESTED_AIRDROP_ADDRESS as `0x${string}` : undefined,
    abi: VESTED_AIRDROP_ABI,
    functionName: 'getStats',
    query: {
      enabled: isContractReady,
    },
  });

  // Read vesting info for user
  const { data: vestingInfoData, refetch: refetchVesting } = useReadContract({
    address: isContractReady ? VESTED_AIRDROP_ADDRESS as `0x${string}` : undefined,
    abi: VESTED_AIRDROP_ABI,
    functionName: 'getVestingInfo',
    args: address ? [address] : undefined,
    query: {
      enabled: isContractReady && !!address,
    },
  });

  // Write contract functions
  const { writeContract: writeInitiateClaim, data: initiateClaimHash, isPending: isInitiateClaimPending } = useWriteContract();
  const { writeContract: writeClaimVested, data: claimVestedHash, isPending: isClaimVestedPending } = useWriteContract();

  // Wait for transaction confirmations
  const { isLoading: isInitiateConfirming, isSuccess: isInitiateSuccess } = useWaitForTransactionReceipt({
    hash: initiateClaimHash,
  });
  const { isLoading: isClaimVestedConfirming, isSuccess: isClaimVestedSuccess } = useWaitForTransactionReceipt({
    hash: claimVestedHash,
  });

  // Parse contract stats
  const contractStats = contractStatsData ? {
    totalAllocated: formatEther(contractStatsData[0]),
    totalClaimed: formatEther(contractStatsData[1]),
    remaining: formatEther(contractStatsData[2]),
    isActive: contractStatsData[3],
    claimDeadline: contractStatsData[4] ? new Date(Number(contractStatsData[4]) * 1000) : null,
    timeRemaining: Number(contractStatsData[5]),
  } : null;

  // Parse vesting info
  const vestingInfo: ContractVestingInfo | null = vestingInfoData ? {
    totalAmount: vestingInfoData[0],
    claimed: vestingInfoData[1],
    vested: vestingInfoData[2],
    claimable: vestingInfoData[3],
    nextUnlockTimestamp: vestingInfoData[4],
    nextUnlockAmount: vestingInfoData[5],
  } : null;

  // Fetch airdrop status from Firebase
  const fetchStatus = useCallback(async () => {
    if (!isConnected || !address) {
      setStatus(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 Fetching airdrop status for:', address);
      const getAirdropStatus = httpsCallable(functions, 'getAirdropStatus');
      const result = await getAirdropStatus({ wallet: address.toLowerCase() });
      const data = result.data as AirdropStatus;

      console.log('📊 Airdrop status:', data);
      setStatus(data);
    } catch (err) {
      console.error('❌ Error fetching airdrop status:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch airdrop status');
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, functions]);

  // Fetch leaderboard
  const loadLeaderboard = useCallback(async () => {
    try {
      console.log('📋 Fetching airdrop leaderboard...');
      const getAirdropLeaderboard = httpsCallable(functions, 'getAirdropLeaderboard');
      const result = await getAirdropLeaderboard({ limit: 100 });
      const data = result.data as { leaderboard: LeaderboardEntry[] };

      console.log('📋 Leaderboard loaded:', data.leaderboard.length, 'entries');
      setLeaderboard(data.leaderboard);
    } catch (err) {
      console.error('❌ Error fetching leaderboard:', err);
    }
  }, [functions]);

  // Initiate claim (first time)
  const initiateClaim = useCallback(async () => {
    if (!status?.eligible || !status.tokenAmount || !status.proof) {
      setError('Not eligible for airdrop or missing data');
      return;
    }

    if (!isContractReady) {
      setError('Airdrop contract not deployed yet');
      return;
    }

    try {
      console.log('🚀 Initiating airdrop claim...');
      console.log('   Amount:', status.tokenAmount);
      console.log('   Proof:', status.proof);

      writeInitiateClaim({
        address: VESTED_AIRDROP_ADDRESS as `0x${string}`,
        abi: VESTED_AIRDROP_ABI,
        functionName: 'initiateClaim',
        args: [BigInt(status.tokenAmount), status.proof as `0x${string}`[]],
      });
    } catch (err) {
      console.error('❌ Error initiating claim:', err);
      setError(err instanceof Error ? err.message : 'Failed to initiate claim');
    }
  }, [status, isContractReady, writeInitiateClaim]);

  // Claim vested tokens
  const claimVested = useCallback(async () => {
    if (!vestingInfo || vestingInfo.claimable === BigInt(0)) {
      setError('No tokens available to claim');
      return;
    }

    try {
      console.log('🚀 Claiming vested tokens...');
      console.log('   Claimable:', formatEther(vestingInfo.claimable));

      writeClaimVested({
        address: VESTED_AIRDROP_ADDRESS as `0x${string}`,
        abi: VESTED_AIRDROP_ABI,
        functionName: 'claimVested',
      });
    } catch (err) {
      console.error('❌ Error claiming vested:', err);
      setError(err instanceof Error ? err.message : 'Failed to claim vested tokens');
    }
  }, [vestingInfo, writeClaimVested]);

  // Mark claim in Firebase after successful transaction
  useEffect(() => {
    const markClaim = async () => {
      if (isInitiateSuccess && initiateClaimHash && status?.airdropId) {
        try {
          console.log('✅ Marking claim in Firebase...');
          const markAirdropClaimed = httpsCallable(functions, 'markAirdropClaimed');
          await markAirdropClaimed({
            snapshotId: status.airdropId,
            txHash: initiateClaimHash,
          });
          console.log('✅ Claim marked successfully');

          // Refresh status
          fetchStatus();
          refetchStats();
          refetchVesting();
        } catch (err) {
          console.error('⚠️ Error marking claim:', err);
        }
      }
    };

    markClaim();
  }, [isInitiateSuccess, initiateClaimHash, status?.airdropId, functions, fetchStatus, refetchStats, refetchVesting]);

  // Refresh after vested claim
  useEffect(() => {
    if (isClaimVestedSuccess) {
      console.log('✅ Vested claim successful, refreshing...');
      refetchStats();
      refetchVesting();
    }
  }, [isClaimVestedSuccess, refetchStats, refetchVesting]);

  // Track transaction hashes
  useEffect(() => {
    if (initiateClaimHash) {
      setClaimTxHash(initiateClaimHash);
    } else if (claimVestedHash) {
      setClaimTxHash(claimVestedHash);
    }
  }, [initiateClaimHash, claimVestedHash]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Derived state
  const isEligible = status?.eligible ?? false;
  const hasClaimed = vestingInfo ? vestingInfo.totalAmount > BigInt(0) : (status?.claimed ?? false);
  const isClaimPending = isInitiateClaimPending || isClaimVestedPending;
  const isClaimConfirming = isInitiateConfirming || isClaimVestedConfirming;

  return {
    // Status
    isLoading,
    isContractReady,
    error,

    // Eligibility & allocation
    status,
    isEligible,
    hasClaimed,

    // Contract state
    contractStats,
    vestingInfo,

    // Actions
    initiateClaim,
    claimVested,
    refreshStatus: fetchStatus,

    // Transaction state
    isClaimPending,
    isClaimConfirming,
    claimTxHash,

    // Leaderboard
    leaderboard,
    loadLeaderboard,
  };
}
