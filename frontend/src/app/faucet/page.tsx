'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { formatEther } from 'viem';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatNumber } from '@/lib/utils';
import {
  TESTNET_FAUCET_ADDRESS,
  TESTNET_FAUCET_ABI,
  USE_TESTNET,
} from '@/config/contracts';

export default function FaucetPage() {
  const { address, isConnected } = useAccount();
  const [timeUntilNext, setTimeUntilNext] = useState(0);

  // Read faucet data
  const { data: claimAmount } = useReadContract({
    address: TESTNET_FAUCET_ADDRESS as `0x${string}`,
    abi: TESTNET_FAUCET_ABI,
    functionName: 'CLAIM_AMOUNT',
  });

  const { data: minBalance } = useReadContract({
    address: TESTNET_FAUCET_ADDRESS as `0x${string}`,
    abi: TESTNET_FAUCET_ABI,
    functionName: 'MIN_BALANCE_THRESHOLD',
  });

  const { data: userInfo, refetch: refetchUserInfo } = useReadContract({
    address: TESTNET_FAUCET_ADDRESS as `0x${string}`,
    abi: TESTNET_FAUCET_ABI,
    functionName: 'getUserInfo',
    args: address ? [address] : undefined,
  });

  const { data: faucetStats } = useReadContract({
    address: TESTNET_FAUCET_ADDRESS as `0x${string}`,
    abi: TESTNET_FAUCET_ABI,
    functionName: 'getFaucetStats',
  });

  // Claim tokens
  const { writeContract: claim, data: claimHash } = useWriteContract();
  const { isSuccess: isClaimSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
  });

  // Extract user info
  // Type-safe extraction of contract data
  const claimAmountValue = claimAmount as bigint | undefined;
  const minBalanceValue = minBalance as bigint | undefined;

  const lastClaim = userInfo ? Number((userInfo as readonly [bigint, bigint, boolean, bigint, bigint])[0]) : 0;
  const totalClaimed = userInfo ? (userInfo as readonly [bigint, bigint, boolean, bigint, bigint])[1] : BigInt(0);
  const canClaim = userInfo ? (userInfo as readonly [bigint, bigint, boolean, bigint, bigint])[2] : false;
  const userBalance = userInfo ? (userInfo as readonly [bigint, bigint, boolean, bigint, bigint])[3] : BigInt(0);
  const timeRemaining = userInfo ? Number((userInfo as readonly [bigint, bigint, boolean, bigint, bigint])[4]) : 0;

  // Extract faucet stats
  const faucetBalance = faucetStats ? (faucetStats as readonly [bigint, bigint, bigint, bigint])[0] : BigInt(0);
  const totalDistributed = faucetStats ? (faucetStats as readonly [bigint, bigint, bigint, bigint])[1] : BigInt(0);
  const totalClaims = faucetStats ? Number((faucetStats as readonly [bigint, bigint, bigint, bigint])[2]) : 0;
  const uniqueClaimers = faucetStats ? Number((faucetStats as readonly [bigint, bigint, bigint, bigint])[3]) : 0;

  // Update countdown timer
  useEffect(() => {
    if (timeRemaining > 0) {
      setTimeUntilNext(timeRemaining);

      const interval = setInterval(() => {
        setTimeUntilNext(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            refetchUserInfo();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    } else {
      setTimeUntilNext(0);
    }
  }, [timeRemaining, refetchUserInfo]);

  // Refetch after successful claim
  useEffect(() => {
    if (isClaimSuccess) {
      refetchUserInfo();
    }
  }, [isClaimSuccess, refetchUserInfo]);

  const handleClaim = () => {
    if (!isConnected) return;

    claim({
      address: TESTNET_FAUCET_ADDRESS as `0x${string}`,
      abi: TESTNET_FAUCET_ABI,
      functionName: 'claimTokens',
    });
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${secs}s`;
    return `${secs}s`;
  };

  // Show mainnet warning if not on testnet
  if (!USE_TESTNET || !TESTNET_FAUCET_ADDRESS) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="font-pixel text-arcade-red mb-4">FAUCET NOT AVAILABLE</h2>
          <p className="font-arcade text-gray-400 text-sm mb-4">
            The testnet faucet is only available on Arbitrum Sepolia testnet.
          </p>
          <p className="font-arcade text-gray-400 text-sm">
            To access the faucet, switch to testnet mode in the configuration.
          </p>
        </Card>
      </div>
    );
  }

  // Default to 5,000 8BIT (5000 * 10^18) if minBalance not loaded yet
  const defaultMinBalance = BigInt("5000000000000000000000");
  const belowMinBalance = Number(userBalance) < Number(minBalanceValue ?? defaultMinBalance);

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-pixel text-2xl md:text-3xl text-arcade-green glow-green mb-2">
            TESTNET FAUCET
          </h1>
          <p className="font-arcade text-gray-400 mb-4">
            Get free 8BIT tokens for testing
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-arcade-dark border border-arcade-cyan/30 rounded">
            <span className="w-2 h-2 bg-arcade-cyan rounded-full animate-pulse"></span>
            <span className="font-pixel text-arcade-cyan text-sm">ARBITRUM SEPOLIA TESTNET</span>
          </div>
        </div>

        {/* Main Claim Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Claim Card */}
          <Card>
            <h2 className="font-pixel text-arcade-green mb-4">CLAIM TOKENS</h2>

            <div className="mb-6">
              <div className="p-4 bg-arcade-green/10 rounded border border-arcade-green/30 text-center">
                <p className="font-arcade text-xs text-gray-400 mb-1">Claim Amount</p>
                <p className="font-pixel text-2xl text-arcade-green">
                  {formatNumber(Number(formatEther(claimAmountValue ?? BigInt(0))))} 8BIT
                </p>
                <p className="font-arcade text-xs text-gray-400 mt-2">
                  Every 24 hours
                </p>
              </div>
            </div>

            {/* User Status */}
            {isConnected && (
              <div className="mb-6 space-y-3">
                <div className="flex justify-between items-center font-arcade text-sm">
                  <span className="text-gray-400">Your Balance:</span>
                  <span className={belowMinBalance ? 'text-arcade-red' : 'text-arcade-green'}>
                    {formatNumber(Number(formatEther(userBalance)))} 8BIT
                  </span>
                </div>
                <div className="flex justify-between items-center font-arcade text-sm">
                  <span className="text-gray-400">Total Claimed:</span>
                  <span className="text-white">
                    {formatNumber(Number(formatEther(totalClaimed)))} 8BIT
                  </span>
                </div>
                {lastClaim > 0 && (
                  <div className="flex justify-between items-center font-arcade text-sm">
                    <span className="text-gray-400">Last Claim:</span>
                    <span className="text-gray-500">
                      {new Date(lastClaim * 1000).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Claim Button */}
            {!isConnected ? (
              <Button variant="secondary" size="lg" className="w-full" disabled>
                Connect Wallet to Claim
              </Button>
            ) : !belowMinBalance ? (
              <div>
                <Button variant="secondary" size="lg" className="w-full" disabled>
                  Balance Above Minimum
                </Button>
                <p className="font-arcade text-xs text-center text-gray-500 mt-2">
                  Your balance must be below {formatNumber(Number(formatEther(minBalanceValue ?? BigInt(0))))} 8BIT to claim
                </p>
              </div>
            ) : !canClaim ? (
              <div>
                <Button variant="secondary" size="lg" className="w-full" disabled>
                  Cooldown: {formatTime(timeUntilNext)}
                </Button>
                <p className="font-arcade text-xs text-center text-gray-500 mt-2">
                  Come back in {formatTime(timeUntilNext)} to claim again
                </p>
              </div>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleClaim}
                disabled={!!claimHash}
              >
                {claimHash ? 'Claiming...' : `Claim ${formatNumber(Number(formatEther(claimAmountValue ?? BigInt(0))))} 8BIT`}
              </Button>
            )}

            {/* Success Message */}
            {isClaimSuccess && (
              <div className="mt-4 p-3 bg-arcade-green/10 rounded border border-arcade-green/30">
                <p className="font-pixel text-arcade-green text-sm text-center">
                  ✅ Tokens Claimed Successfully!
                </p>
              </div>
            )}
          </Card>

          {/* Info Card */}
          <Card>
            <h2 className="font-pixel text-arcade-cyan mb-4">FAUCET INFO</h2>

            <div className="space-y-3 font-arcade text-sm mb-6">
              <div className="flex justify-between">
                <span className="text-gray-400">Claim Amount:</span>
                <span className="text-white">10,000 8BIT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Cooldown:</span>
                <span className="text-white">24 hours</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Min. Balance:</span>
                <span className="text-white">5,000 8BIT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network:</span>
                <span className="text-arcade-cyan">Arbitrum Sepolia</span>
              </div>
            </div>

            <div className="p-3 bg-arcade-yellow/10 rounded border border-arcade-yellow/30">
              <p className="font-arcade text-xs text-arcade-yellow font-bold mb-2">
                💡 TESTING ONLY
              </p>
              <p className="font-arcade text-xs text-gray-300">
                These are testnet tokens with no real value. Use them to test games, tournaments, and other features!
              </p>
            </div>
          </Card>
        </div>

        {/* Faucet Statistics */}
        <Card>
          <h2 className="font-pixel text-arcade-pink text-center mb-6">FAUCET STATISTICS</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="font-arcade text-xs text-gray-500 mb-1">Faucet Balance</p>
              <p className="font-pixel text-arcade-green">
                {formatNumber(Number(formatEther(faucetBalance)))}
              </p>
              <p className="font-arcade text-xs text-gray-400">8BIT</p>
            </div>

            <div className="text-center">
              <p className="font-arcade text-xs text-gray-500 mb-1">Total Distributed</p>
              <p className="font-pixel text-arcade-cyan">
                {formatNumber(Number(formatEther(totalDistributed)))}
              </p>
              <p className="font-arcade text-xs text-gray-400">8BIT</p>
            </div>

            <div className="text-center">
              <p className="font-arcade text-xs text-gray-500 mb-1">Total Claims</p>
              <p className="font-pixel text-arcade-yellow">
                {formatNumber(totalClaims)}
              </p>
              <p className="font-arcade text-xs text-gray-400">Claims</p>
            </div>

            <div className="text-center">
              <p className="font-arcade text-xs text-gray-500 mb-1">Unique Users</p>
              <p className="font-pixel text-arcade-pink">
                {formatNumber(uniqueClaimers)}
              </p>
              <p className="font-arcade text-xs text-gray-400">Users</p>
            </div>
          </div>
        </Card>

        {/* How to Use */}
        <Card className="mt-6">
          <h2 className="font-pixel text-arcade-green mb-4">HOW TO USE THE FAUCET</h2>

          <ol className="font-arcade text-sm text-gray-300 space-y-2">
            <li className="flex gap-2">
              <span className="text-arcade-green">1.</span>
              <span>Connect your wallet to Arbitrum Sepolia testnet</span>
            </li>
            <li className="flex gap-2">
              <span className="text-arcade-green">2.</span>
              <span>Make sure your balance is below 5,000 8BIT</span>
            </li>
            <li className="flex gap-2">
              <span className="text-arcade-green">3.</span>
              <span>Click "Claim Tokens" to receive 10,000 8BIT</span>
            </li>
            <li className="flex gap-2">
              <span className="text-arcade-green">4.</span>
              <span>Wait 24 hours before claiming again</span>
            </li>
            <li className="flex gap-2">
              <span className="text-arcade-green">5.</span>
              <span>Use tokens to test games, tournaments, and features!</span>
            </li>
          </ol>

          <div className="mt-6 p-3 bg-arcade-pink/10 rounded border border-arcade-pink/30">
            <p className="font-arcade text-xs text-arcade-pink font-bold mb-2">
              🎮 READY TO PLAY?
            </p>
            <p className="font-arcade text-xs text-gray-300">
              After claiming tokens, head to the games section to start playing and earning more!
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
