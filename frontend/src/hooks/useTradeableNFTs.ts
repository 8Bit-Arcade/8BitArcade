import { useState, useCallback, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import {
  TRADEABLE_ITEMS_ADDRESS,
  TRADEABLE_ITEMS_ABI,
} from '@/config/contracts';

export interface ItemType {
  id: number;
  maxSupply: bigint;
  totalMinted: bigint;
  requiredAchievement: bigint;
  priceInWei: bigint;
  active: boolean;
  uri: string;
}

export interface OwnedItem {
  tokenId: bigint;
  itemTypeId: bigint;
  tokenURI: string;
}

/**
 * Hook for interacting with the TradeableItems NFT contract
 *
 * Provides:
 * - Item type listings and details
 * - Mint functionality (public + achievement-gated)
 * - Player's owned items
 * - Eligibility checks
 */
export function useTradeableNFTs() {
  const { address, isConnected } = useAccount();
  const [ownedItems, setOwnedItems] = useState<OwnedItem[]>([]);
  const [availableItems, setAvailableItems] = useState<ItemType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contractAddress = TRADEABLE_ITEMS_ADDRESS as `0x${string}`;

  // Mint transaction state
  const { data: mintHash, writeContract: writeMint, isPending: isMintPending, error: mintError } = useWriteContract();
  const { isLoading: isMintConfirming, isSuccess: isMintConfirmed } = useWaitForTransactionReceipt({ hash: mintHash });

  // Get total number of item types
  const { data: nextItemTypeId } = useReadContract({
    address: contractAddress,
    abi: TRADEABLE_ITEMS_ABI,
    functionName: 'nextItemTypeId',
    query: {
      enabled: contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Get player's item balance
  const { data: itemBalance } = useReadContract({
    address: contractAddress,
    abi: TRADEABLE_ITEMS_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  // Get total supply
  const { data: totalSupply } = useReadContract({
    address: contractAddress,
    abi: TRADEABLE_ITEMS_ABI,
    functionName: 'totalSupply',
    query: {
      enabled: contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  /**
   * Fetch available item types from the contract
   */
  const fetchAvailableItems = useCallback(async () => {
    if (!nextItemTypeId || contractAddress === '0x0000000000000000000000000000000000000000') return;

    setIsLoading(true);
    setError(null);

    try {
      const itemCount = Number(nextItemTypeId) - 1;
      if (itemCount <= 0) {
        setAvailableItems([]);
        return;
      }

      // Fetch from backend which caches item type data
      const { callFunction } = await import('@/lib/firebase-functions');
      const result = await callFunction<
        { walletAddress: string },
        { items: any[] }
      >('getTradeableItems', { walletAddress: address || '' });

      if (result?.items) {
        const items: ItemType[] = result.items.map((item: any) => ({
          id: item.id,
          maxSupply: BigInt(item.maxSupply),
          totalMinted: BigInt(item.totalMinted),
          requiredAchievement: BigInt(item.requiredAchievement || 0),
          priceInWei: BigInt(item.priceInWei || 0),
          active: item.active,
          uri: item.uri,
        }));
        setAvailableItems(items);
      }
    } catch (err: any) {
      console.error('Failed to fetch items:', err);
      setError(err.message || 'Failed to fetch items');
    } finally {
      setIsLoading(false);
    }
  }, [nextItemTypeId, contractAddress, address]);

  /**
   * Fetch player's owned items
   */
  const fetchOwnedItems = useCallback(async () => {
    if (!address || !itemBalance || contractAddress === '0x0000000000000000000000000000000000000000') return;

    try {
      const balance = Number(itemBalance);
      if (balance === 0) {
        setOwnedItems([]);
        return;
      }

      // Fetch from backend which indexes player's tokens
      const { callFunction } = await import('@/lib/firebase-functions');
      const result = await callFunction<
        { walletAddress: string },
        { tokens: any[] }
      >('getOwnedItems', { walletAddress: address });

      if (result?.tokens) {
        setOwnedItems(
          result.tokens.map((t: any) => ({
            tokenId: BigInt(t.tokenId),
            itemTypeId: BigInt(t.itemTypeId),
            tokenURI: t.tokenURI,
          }))
        );
      }
    } catch (err: any) {
      console.error('Failed to fetch owned items:', err);
    }
  }, [address, itemBalance, contractAddress]);

  /**
   * Mint a tradeable item
   * @param itemTypeId The item type to mint
   * @param priceInWei ETH price (pass 0n for free items)
   */
  const mintItem = useCallback(
    (itemTypeId: number, priceInWei: bigint = 0n) => {
      if (contractAddress === '0x0000000000000000000000000000000000000000') {
        setError('Contract not deployed');
        return;
      }

      writeMint({
        address: contractAddress,
        abi: TRADEABLE_ITEMS_ABI,
        functionName: 'mint',
        args: [BigInt(itemTypeId)],
        value: priceInWei,
      });
    },
    [contractAddress, writeMint]
  );

  /**
   * Check if current player can mint a specific item type
   */
  const { data: canMintResult } = useReadContract({
    address: contractAddress,
    abi: TRADEABLE_ITEMS_ABI,
    functionName: 'canMint',
    args: address ? [address, 1n] : undefined,
    query: {
      enabled: !!address && contractAddress !== '0x0000000000000000000000000000000000000000',
    },
  });

  /**
   * Check mint eligibility for a specific item type
   */
  const checkCanMint = useCallback(
    async (itemTypeId: number): Promise<boolean> => {
      if (!address || contractAddress === '0x0000000000000000000000000000000000000000') return false;

      try {
        const { callFunction } = await import('@/lib/firebase-functions');
        const result = await callFunction<
          { walletAddress: string; itemTypeId: number },
          { canMint: boolean }
        >('checkCanMintItem', { walletAddress: address, itemTypeId });
        return result?.canMint || false;
      } catch {
        return false;
      }
    },
    [address, contractAddress]
  );

  // Auto-fetch when wallet connects
  useEffect(() => {
    if (isConnected && address) {
      fetchAvailableItems();
      fetchOwnedItems();
    }
  }, [isConnected, address, fetchAvailableItems, fetchOwnedItems]);

  // Refresh after successful mint
  useEffect(() => {
    if (isMintConfirmed) {
      fetchOwnedItems();
      fetchAvailableItems();
    }
  }, [isMintConfirmed, fetchOwnedItems, fetchAvailableItems]);

  return {
    // Data
    availableItems,
    ownedItems,
    itemBalance: itemBalance ? Number(itemBalance) : 0,
    totalSupply: totalSupply ? Number(totalSupply) : 0,

    // Actions
    mintItem,
    checkCanMint,
    fetchAvailableItems,
    fetchOwnedItems,

    // Mint transaction state
    isMintPending,
    isMintConfirming,
    isMintConfirmed,
    mintHash,
    mintError: mintError?.message || null,

    // General state
    isLoading,
    error,
  };
}
