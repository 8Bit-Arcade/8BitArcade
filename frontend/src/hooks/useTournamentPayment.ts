import { useState, useCallback } from 'react';
import { useAccount, useContractWrite, useContractRead, usePrepareContractWrite } from 'wagmi';
import { parseEther, parseUnits } from 'viem';
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
  const { data: feeInUsdc } = useContractRead({
    address: tournamentPaymentsAddress,
    abi: TOURNAMENT_PAYMENTS_ABI,
    functionName: 'tournamentFees',
    args: [BigInt(tournamentId)],
  });

  // Check if user has paid
  const { data: hasPaid } = useContractRead({
    address: tournamentPaymentsAddress,
    abi: TOURNAMENT_PAYMENTS_ABI,
    functionName: 'hasPaid',
    args: address ? [BigInt(tournamentId), address] : undefined,
    enabled: !!address,
  });

  // Check USDC allowance
  const { data: usdcAllowance } = useContractRead({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, tournamentPaymentsAddress] : undefined,
    enabled: !!address,
  });

  // Calculate values
  const feeInUsd = feeInUsdc ? Number(feeInUsdc) / 1e6 : 0;
  const feeInEth = ethPrice ? calculateEthAmount(feeInUsd, ethPrice) : null;
  const needsApproval = !!(feeInUsdc && usdcAllowance && usdcAllowance < feeInUsdc);

  // USDC Approval
  const { write: writeApprove } = useContractWrite({
    address: usdcAddress,
    abi: USDC_ABI,
    functionName: 'approve',
    args: feeInUsdc ? [tournamentPaymentsAddress, feeInUsdc] : undefined,
  });

  const approveUsdc = useCallback(async () => {
    if (!writeApprove) {
      setError('Unable to prepare approval transaction');
      return;
    }

    setIsApproving(true);
    setError(null);

    try {
      const tx = await writeApprove();
      await tx.wait();
      console.log('USDC approved successfully');
    } catch (err: any) {
      console.error('Approval error:', err);
      setError(err.message || 'Approval failed');
    } finally {
      setIsApproving(false);
    }
  }, [writeApprove]);

  // Pay with USDC
  const { write: writePayUsdc } = useContractWrite({
    address: tournamentPaymentsAddress,
    abi: TOURNAMENT_PAYMENTS_ABI,
    functionName: 'payWithUsdc',
    args: [BigInt(tournamentId)],
  });

  const payWithUsdc = useCallback(async () => {
    if (needsApproval) {
      setError('Please approve USDC first');
      return;
    }

    if (!writePayUsdc) {
      setError('Unable to prepare payment transaction');
      return;
    }

    setIsPaying(true);
    setError(null);

    try {
      const tx = await writePayUsdc();
      await tx.wait();
      console.log('Tournament entry paid with USDC');
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed');
    } finally {
      setIsPaying(false);
    }
  }, [writePayUsdc, needsApproval]);

  // Pay with ETH
  const { write: writePayEth } = useContractWrite({
    address: tournamentPaymentsAddress,
    abi: TOURNAMENT_PAYMENTS_ABI,
    functionName: 'payWithEth',
    args: [BigInt(tournamentId)],
    value: feeInEth ? parseEther(feeInEth.toString()) : undefined,
  });

  const payWithEth = useCallback(async () => {
    if (!writePayEth) {
      setError('Unable to prepare payment transaction');
      return;
    }

    if (!feeInEth) {
      setError('ETH price not available');
      return;
    }

    setIsPaying(true);
    setError(null);

    try {
      const tx = await writePayEth();
      await tx.wait();
      console.log('Tournament entry paid with ETH');
    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed');
    } finally {
      setIsPaying(false);
    }
  }, [writePayEth, feeInEth]);

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
