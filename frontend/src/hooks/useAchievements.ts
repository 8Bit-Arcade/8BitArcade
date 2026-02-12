import { useState, useCallback, useEffect } from 'react';
import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import {
  ACHIEVEMENT_BADGES_ADDRESS,
  ACHIEVEMENT_MANAGER_ADDRESS,
  ACHIEVEMENT_BADGES_ABI,
  ACHIEVEMENT_MANAGER_ABI,
} from '@/config/contracts';

/**
 * Goal categories matching the AchievementManager contract
 */
export enum GoalCategory {
  SCORE = 0,
  GAMES_PLAYED = 1,
  WINS = 2,
  STREAK = 3,
  COLLECTION = 4,
  SOCIAL = 5,
  SPECIAL = 6,
}

export interface Goal {
  id: number;
  name: string;
  description: string;
  category: GoalCategory;
  threshold: bigint;
  gameId: string;
  achievementTypeId: bigint;
  rewardItemTypeId: bigint;
  rewardTokenAmount: bigint;
  active: boolean;
  completed: boolean;
}

export interface AchievementBadge {
  tokenId: bigint;
  achievementTypeId: bigint;
  tokenURI: string;
}

/**
 * Hook for interacting with the Achievement/Badge system
 *
 * Provides:
 * - List of all goals and player completion status
 * - Player's earned badges
 * - Achievement count
 * - Badge metadata
 */
export function useAchievements() {
  const { address, isConnected } = useAccount();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractAddress = ACHIEVEMENT_MANAGER_ADDRESS as `0x${string}`;
  const badgesAddress = ACHIEVEMENT_BADGES_ADDRESS as `0x${string}`;

  // Get total number of goals
  const { data: nextGoalId } = useReadContract({
    address: contractAddress,
    abi: ACHIEVEMENT_MANAGER_ABI,
    functionName: 'nextGoalId',
    query: {
      enabled: contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Get player's total achievement count
  const { data: achievementCount } = useReadContract({
    address: contractAddress,
    abi: ACHIEVEMENT_MANAGER_ABI,
    functionName: 'getPlayerAchievementCount',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Get player's total badge count
  const { data: badgeBalance } = useReadContract({
    address: badgesAddress,
    abi: ACHIEVEMENT_BADGES_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && badgesAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Get global stats
  const { data: totalAwarded } = useReadContract({
    address: contractAddress,
    abi: ACHIEVEMENT_MANAGER_ABI,
    functionName: 'totalAchievementsAwarded',
    query: {
      enabled: contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  /**
   * Fetch all goals and player completion statuses
   */
  const fetchGoals = useCallback(async () => {
    if (!nextGoalId || contractAddress === '0x0000000000000000000000000000000000000000') return;

    setIsLoading(true);
    setError(null);

    try {
      const goalCount = Number(nextGoalId) - 1;
      if (goalCount <= 0) {
        setGoals([]);
        return;
      }

      // Build goal IDs array
      const goalIds = Array.from({ length: goalCount }, (_, i) => BigInt(i + 1));

      // Fetch goal completion statuses for the player
      // This will be done via the Firebase backend for off-chain data,
      // but we can check on-chain completion status
      const fetchedGoals: Goal[] = [];

      // Note: In production, you'd batch these reads using multicall.
      // For now, we fetch from the backend API which has cached goal data.
      const { callFunction } = await import('@/lib/firebase-functions');

      const result = await callFunction<{ walletAddress: string }, { goals: any[] }>(
        'getAchievements',
        { walletAddress: address || '' }
      );

      if (result?.goals) {
        for (const g of result.goals) {
          fetchedGoals.push({
            id: g.id,
            name: g.name,
            description: g.description,
            category: g.category as GoalCategory,
            threshold: BigInt(g.threshold),
            gameId: g.gameId || '',
            achievementTypeId: BigInt(g.achievementTypeId),
            rewardItemTypeId: BigInt(g.rewardItemTypeId || 0),
            rewardTokenAmount: BigInt(g.rewardTokenAmount || 0),
            active: g.active,
            completed: g.completed || false,
          });
        }
      }

      setGoals(fetchedGoals);
    } catch (err: any) {
      console.error('Failed to fetch achievements:', err);
      setError(err.message || 'Failed to fetch achievements');
    } finally {
      setIsLoading(false);
    }
  }, [nextGoalId, contractAddress, address]);

  /**
   * Check if the player has a specific achievement badge
   */
  const hasAchievement = useCallback(
    async (achievementTypeId: number): Promise<boolean> => {
      if (!address || badgesAddress === '0x0000000000000000000000000000000000000000') return false;

      try {
        // This would be done via a direct contract read in production
        const { callFunction } = await import('@/lib/firebase-functions');
        const result = await callFunction<
          { walletAddress: string; achievementTypeId: number },
          { hasAchievement: boolean }
        >('checkAchievement', { walletAddress: address, achievementTypeId });
        return result?.hasAchievement || false;
      } catch {
        return false;
      }
    },
    [address, badgesAddress]
  );

  // Auto-fetch goals when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      fetchGoals();
    }
  }, [isConnected, address, fetchGoals]);

  return {
    goals,
    achievementCount: achievementCount ? Number(achievementCount) : 0,
    badgeBalance: badgeBalance ? Number(badgeBalance) : 0,
    totalAwarded: totalAwarded ? Number(totalAwarded) : 0,
    hasAchievement,
    fetchGoals,
    isLoading,
    error,
  };
}
