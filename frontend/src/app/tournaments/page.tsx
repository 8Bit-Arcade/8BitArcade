'use client';

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
  const [filter, setFilter] = useState<'all' | Tier>('all');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<number | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);

  // ✅ READ YOUR 3 TOURNAMENTS DIRECTLY FROM CHAIN (IDs 1,2,3)
  const { data: tournamentData } = useReadContracts({
    contracts: [
      {
        address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
        abi: TOURNAMENT_MANAGER_ABI,
        functionName: 'getTournament',
        args: [1n],
      },
      {
        address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
        abi: TOURNAMENT_MANAGER_ABI,
        functionName: 'getTournament',
        args: [2n],
      },
      {
        address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
        abi: TOURNAMENT_MANAGER_ABI,
        functionName: 'getTournament',
        args: [3n],
      },
    ],
  });

  // Convert contract data to UI format
  useEffect(() => {
    if (!tournamentData) return;
    
    const formatted: Tournament[] = tournamentData
      .map((data, index) => {
        if (!data.result) return null;
        const t = data.result as any;
        return {
          id: index + 1,
          tier: Number(t[0]) === 0 ? 'Standard' : 'High Roller',
          period: Number(t[1]) === 0 ? 'Weekly' : 'Monthly',
          startTime: new Date(Number(t[2]) * 1000),
          endTime: new Date(Number(t[3]) * 1000),
          entryFee: t[4],
          prizePool: t[5],
          totalEntries: Number(t[6]),
          winner: t[7],
          isActive: Boolean(t[8]),
          status: t[8] ? 'active' : 'ended',
        };
      })
      .filter(Boolean) as Tournament[];

    setTournaments(formatted);
    setLoading(false);
  }, [tournamentData]);

  // REST OF YOUR CODE (allowance, approve, enter) STAYS IDENTICAL
  const { data: allowance } = useReadContract({
    address: EIGHT_BIT_TOKEN_ADDRESS as `0x${string}`,
    abi: EIGHT_BIT_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, TOURNAMENT_MANAGER_ADDRESS] : undefined,
  });

  const { writeContract: approve, data: approveHash } = useWriteContract();
  const { isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { writeContract: enterTournament, data: enterHash } = useWriteContract();
  const { isSuccess: isEnterSuccess } = useWaitForTransactionReceipt({ hash: enterHash });

  // Copy ALL your existing JSX from "return (" to end of file
  // Header, filters, cards, everything stays EXACTLY the same

  const filteredTournaments = filter === 'all' 
    ? tournaments 
    : tournaments.filter(t => t.tier === filter);

  // ... ALL YOUR EXISTING FUNCTIONS (getStatusColor, getStatusBadge, etc.) ...

  return (
    // PASTE YOUR EXISTING JSX HERE - Header, Filters, Tournament List, etc.
    <div className="min-h-screen py-8">
      {/* Your complete existing JSX from line ~250 */}
    </div>
  );
}
'use client';

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
  const [filter, setFilter] = useState<'all' | Tier>('all');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<number | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState(false);

  // ✅ READ YOUR 3 TOURNAMENTS DIRECTLY FROM CHAIN (IDs 1,2,3)
  const { data: tournamentData } = useReadContracts({
    contracts: [
      {
        address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
        abi: TOURNAMENT_MANAGER_ABI,
        functionName: 'getTournament',
        args: [1n],
      },
      {
        address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
        abi: TOURNAMENT_MANAGER_ABI,
        functionName: 'getTournament',
        args: [2n],
      },
      {
        address: TOURNAMENT_MANAGER_ADDRESS as `0x${string}`,
        abi: TOURNAMENT_MANAGER_ABI,
        functionName: 'getTournament',
        args: [3n],
      },
    ],
  });

  // Convert contract data to UI format
  useEffect(() => {
    if (!tournamentData) return;
    
    const formatted: Tournament[] = tournamentData
      .map((data, index) => {
        if (!data.result) return null;
        const t = data.result as any;
        return {
          id: index + 1,
          tier: Number(t[0]) === 0 ? 'Standard' : 'High Roller',
          period: Number(t[1]) === 0 ? 'Weekly' : 'Monthly',
          startTime: new Date(Number(t[2]) * 1000),
          endTime: new Date(Number(t[3]) * 1000),
          entryFee: t[4],
          prizePool: t[5],
          totalEntries: Number(t[6]),
          winner: t[7],
          isActive: Boolean(t[8]),
          status: t[8] ? 'active' : 'ended',
        };
      })
      .filter(Boolean) as Tournament[];

    setTournaments(formatted);
    setLoading(false);
  }, [tournamentData]);

  // REST OF YOUR CODE (allowance, approve, enter) STAYS IDENTICAL
  const { data: allowance } = useReadContract({
    address: EIGHT_BIT_TOKEN_ADDRESS as `0x${string}`,
    abi: EIGHT_BIT_TOKEN_ABI,
    functionName: 'allowance',
    args: address ? [address, TOURNAMENT_MANAGER_ADDRESS] : undefined,
  });

  const { writeContract: approve, data: approveHash } = useWriteContract();
  const { isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });
  const { writeContract: enterTournament, data: enterHash } = useWriteContract();
  const { isSuccess: isEnterSuccess } = useWaitForTransactionReceipt({ hash: enterHash });

  // Copy ALL your existing JSX from "return (" to end of file
  // Header, filters, cards, everything stays EXACTLY the same

  const filteredTournaments = filter === 'all' 
    ? tournaments 
    : tournaments.filter(t => t.tier === filter);

  // ... ALL YOUR EXISTING FUNCTIONS (getStatusColor, getStatusBadge, etc.) ...

  return (
    // PASTE YOUR EXISTING JSX HERE - Header, Filters, Tournament List, etc.
    <div className="min-h-screen py-8">
      {/* Your complete existing JSX from line ~250 */}
    </div>
  );
}
