'use client';  // ← FIXED: FIRST LINE

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useReadContracts } from 'wagmi';
import { formatEther } from 'viem';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatNumber, formatTimeRemaining } from '@/lib/utils';
import {
  TOURNAMENT_MANAGER_ADDRESS,
  TOURNAMENT_MANAGER_ABI,
  EIGHT_BIT_TOKEN_ADDRESS,
  EIGHT_BIT_TOKEN_ABI,
} from '@/config/contracts';

// ... ALL YOUR EXISTING TYPE DEFINITIONS AND INTERFACES ...

export default function TournamentsPage() {
  // ... ALL YOUR EXISTING CODE UNTIL THE FIREBASE useEffect ...

  // ✅ REPLACE ONLY THIS useEffect (around line 110):
  useEffect(() => {
    const loadTournaments = async () => {
      setLoading(true);
      const tournamentsData = await Promise.all([
        readContract({
          address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
          abi: TOURNAMENT_MANAGER_ABI,
          functionName: 'getTournament',
          args: [1n],
        }),
        readContract({
          address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
          abi: TOURNAMENT_MANAGER_ABI,
          functionName: 'getTournament',
          args: [2n],
        }),
        readContract({
          address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
          abi: TOURNAMENT_MANAGER_ABI,
          functionName: 'getTournament',
          args: [3n],
        }),
      ]);

      const formattedTournaments: Tournament[] = tournamentsData
        .map((t, index) => {
          if (!t.result) return null;
          const data = t.result as any;
          return {
            id: index + 1,
            tier: Number(data[0]) === 0 ? 'Standard' : 'High Roller',
            period: Number(data[1]) === 0 ? 'Weekly' : 'Monthly',
            startTime: new Date(Number(data[2]) * 1000),
            endTime: new Date(Number(data[3]) * 1000),
            entryFee: data[4],
            prizePool: data[5],
            totalEntries: Number(data[6]),
            winner: data[7],
            isActive: Boolean(data[8]),
            status: 'active' as TournamentStatus,
          };
        })
        .filter(Boolean) as Tournament[];

      setTournaments(formattedTournaments);
      setLoading(false);
    };

    if (isConnected) loadTournaments();
  }, [isConnected]);

  // ... KEEP ALL YOUR EXISTING CODE BELOW (allowance, approve, enter, JSX) ...
}
