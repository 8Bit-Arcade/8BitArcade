import { useState, useCallback } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseEther } from 'viem';
import { useEthPrice, calculateEthAmount } from './useEthPrice';

// Contract ABI (minimal - only what we need)
const TOURNAMENT_PAYMENTS_ABI = [
  {
    name: 'payWithUsdc',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'tournamentId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'payWithEth',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'tournamentId', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'tournamentFees',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'tournamentId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'hasPaid',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tournamentId', type: 'uint256' },
      { name: 'player', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

const USDC_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

export type PaymentMethod = 'USDC' | 'ETH';

interface UseTournamentPaymentProps {
  tournamentId: number;
  tournamentPaymentsAddress: `0x${string}`;
  usdcAddress: `0x${string}`;
}

interface UseTournamentPaymentReturn {
  // Payment state
  hasPaid: boolean;
  feeInUsd: number;
  feeInUsdc: bigint;
  feeInEth: number | null;

  // ETH price
  ethPrice: number | null;
  ethPriceLoading: boolean;

  // Payment functions
  payWithUsdc: () => Promise<void>;
  payWithEth: () => Promise<void>;

  // Approval
  needsApproval: boolean;
  approveUsdc: () => Promise<void>;

  // Status
  isPaying: boolean;
  isApproving: boolean;
  error: string | null;
}

export function useTournamentPayment({
  tournamentId,
  tournamentPaymentsAddress,
  usdcAddress,
}: UseTournamentPaymentProps): UseTournamentPaymentReturn {
  const { address } = useAccount();
  const { ethPrice, isLoading: ethPriceLoading } = useEthPrice();

  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Get tournament fee in USDC (6 decimals)
  const { data: feeInUsdc } = useReadContract({
    address: tournamentPaymentsAddress,
    abi: TOURNAMENT_PAYMENTS_ABI,
    functionName: 'tournamentFees',
    args: [BigInt(tournamentId)],
  });

  // Check if user has paid
  const { data: hasPaid } = useReadContract({
    address: tournamentPaymentsAddress,
    abi: TOURNAMENT_PAYMENTS_ABI,
    functionName: 'hasPaid',
    args: address ? [BigInt(tournamentId), address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Check USDC allowance
  const { data: usdcAllowance } = useReadContract({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, tournamentPaymentsAddress] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Calculate values
  const feeInUsd = feeInUsdc ? Number(feeInUsdc) / 1e6 : 0;
  const feeInEth = ethPrice ? calculateEthAmount(feeInUsd, ethPrice) : null;
  const needsApproval = !!(feeInUsdc && usdcAllowance && usdcAllowance < feeInUsdc);

  // Write contracts
  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writePayUsdc } = useWriteContract();
  const { writeContractAsync: writePayEth } = useWriteContract();

  // USDC Approval
  const approveUsdc = useCallback(async () => {
    if (!feeInUsdc) {
      setError('Fee not loaded');
      return;
    }

    setIsApproving(true);
    setError(null);

    try {
      const hash = await writeApprove({
        address: usdcAddress,
        abi: USDC_ABI,
        functionName: 'approve',
        args: [tournamentPaymentsAddress, feeInUsdc],
      });

      console.log('USDC approval transaction sent:', hash);
      // Note: In production, you'd want to wait for confirmation
      // using useWaitForTransactionReceipt or similar
    } catch (err: any) {
      console.error('Approval error:', err);
      setError(err.message || 'Approval failed');
    } finally {
      setIsApproving(false);
    }
  }, [writeApprove, feeInUsdc, usdcAddress, tournamentPaymentsAddress]);

  // Pay with USDC
  const payWithUsdc = useCallback(async () => {
    if (needsApproval) {
      setError('Please approve USDC first');
      return;
    }

    setIsPaying(true);
    setError(null);

    try {
      const hash = await writePayUsdc({
        address: tournamentPaymentsAddress,
        abi: TOURNAMENT_PAYMENTS_ABI,
        functionName: 'payWithUsdc',
        args: [BigInt(tournamentId)],
      });

      console.log('USDC payment transaction sent:', hash);
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed');
    } finally {
      setIsPaying(false);
    }
  }, [writePayUsdc, needsApproval, tournamentPaymentsAddress, tournamentId]);

  // Pay with ETH
  const payWithEth = useCallback(async () => {
    if (!feeInEth) {
      setError('ETH price not available');
      return;
    }

    setIsPaying(true);
    setError(null);

    try {
      const hash = await writePayEth({
        address: tournamentPaymentsAddress,
        abi: TOURNAMENT_PAYMENTS_ABI,
        functionName: 'payWithEth',
        args: [BigInt(tournamentId)],
        value: parseEther(feeInEth.toString()),
      });

      console.log('ETH payment transaction sent:', hash);
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed');
    } finally {
      setIsPaying(false);
    }
  }, [writePayEth, feeInEth, tournamentPaymentsAddress, tournamentId]);

  return {
    hasPaid: hasPaid || false,
    feeInUsd,
    feeInUsdc: feeInUsdc || BigInt(0),
    feeInEth,
    ethPrice,
    ethPriceLoading,
    payWithUsdc,
    payWithEth,
    needsApproval,
    approveUsdc,
    isPaying,
    isApproving,
    error,
  };
}
