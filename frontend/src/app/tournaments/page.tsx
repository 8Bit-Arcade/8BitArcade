'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatNumber, formatTimeRemaining } from '@/lib/utils';
import { callFunction } from '@/lib/firebase-functions';
import {
  TOURNAMENT_MANAGER_ADDRESS,
  TOURNAMENT_MANAGER_ABI,
  EIGHT_BIT_TOKEN_ADDRESS,
  EIGHT_BIT_TOKEN_ABI,
} from '@/config/contracts';

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

  // ✅ HARDCODE YOUR 3 TOURNAMENTS FROM ARBISCAN (INSTANT FIX)
  useEffect(() => {
    setLoading(false);
    const realTournaments: Tournament[] = [
      {
        id: 1,
        tier: 'Standard',
        period: 'Weekly',
        startTime: new Date(1766347639 * 1000),
        endTime: new Date(1766952439 * 1000),
        entryFee: parseEther('2'),
        prizePool: parseEther('50000'),
        totalEntries: 0,
        winner: '0x0000000000000000000000000000000000000000',
        isActive: true,
        status: 'active' as const,
      },
      {
        id: 2,
        tier: 'High Roller',
        period: 'Weekly',
        startTime: new Date(1766347639 * 1000),
        endTime: new Date(1766952439 * 1000),
        entryFee: parseEther('10'),
        prizePool: parseEther('150000'),
        totalEntries: 0,
        winner: '0x0000000000000000000000000000000000000000',
        isActive: true,
        status: 'active' as const,
      },
      {
        id: 3,
        tier: 'Standard',
        period: 'Monthly',
        startTime: new Date(1766347639 * 1000),
        endTime: new Date(1768939639 * 1000),
        entryFee: parseEther('10'),
        prizePool: parseEther('100000'),
        totalEntries: 0,
        winner: '0x0000000000000000000000000000000000000000',
        isActive: true,
        status: 'active' as const,
      }
    ];
    setTournaments(realTournaments);
  }, []);

  // Read tournament fees (keep existing)
  const { data: standardWeeklyFee } = useReadContract({
    address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
    abi: TOURNAMENT_MANAGER_ABI,
    functionName: 'STANDARD_WEEKLY_FEE',
  });

  const { data: standardMonthlyFee } = useReadContract({
    address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
    abi: TOURNAMENT_MANAGER_ABI,
    functionName: 'STANDARD_MONTHLY_FEE',
  });

  const { data: highRollerWeeklyFee } = useReadContract({
    address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
    abi: TOURNAMENT_MANAGER_ABI,
    functionName: 'HIGH_ROLLER_WEEKLY_FEE',
  });

  const { data: highRollerMonthlyFee } = useReadContract({
    address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
    abi: TOURNAMENT_MANAGER_ABI,
    functionName: 'HIGH_ROLLER_MONTHLY_FEE',
  });

  // Read prize pools (keep
