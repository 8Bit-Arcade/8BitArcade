'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther, parseEther } from 'viem';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatNumber, formatTimeRemaining } from '@/lib/utils';
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

  // ✅ YOUR 3 REAL TOURNAMENTS FROM ARBISCAN - NO FIREBASE
  useEffect(() => {
    setLoading(false);
    setTournaments([
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
        status: 'active' as TournamentStatus,
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
        status: 'active' as TournamentStatus,
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
        status: 'active' as TournamentStatus,
      }
    ]);
  }, []);

  // All your original readContract calls
  const { data
