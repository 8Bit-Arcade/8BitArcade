'use client';

import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useBalance } from 'wagmi';
import { formatEther, parseEther, parseUnits } from 'viem';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { formatNumber } from '@/lib/utils';
import {
  TOKEN_SALE_ADDRESS,
  TOKEN_SALE_ABI,
  EIGHT_BIT_TOKEN_ADDRESS,
  USDC_ADDRESS,
  USDC_ABI,
} from '@/config/contracts';

type PaymentMethod = 'eth' | 'usdc';

export default function TokenSalePage() {
  const { address, isConnected } = useAccount();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('eth');
  const [amount, setAmount] = useState('');
  const [needsApproval, setNeedsApproval] = useState(false);

  // Read sale data
  const { data: tokensForSale } = useReadContract({
    address: TOKEN_SALE_ADDRESS as `0x${string}`,
    abi: TOKEN_SALE_ABI,
    functionName: 'TOKENS_FOR_SALE',
  });

  const { data: tokensSold } = useReadContract({
    address: TOKEN_SALE_ADDRESS as `0x${string}`,
    abi: TOKEN_SALE_ABI,
    functionName: 'tokensSold',
  });

  const { data: ethRaised } = useReadContract({
    address: TOKEN_SALE_ADDRESS as `0x${string}`,
    abi: TOKEN_SALE_ABI,
    functionName: 'ethRaised',
  });

  const { data: usdcRaised } = useReadContract({
    address: TOKEN_SALE_ADDRESS as `0x${string}`,
    abi: TOKEN_SALE_ABI,
    functionName: 'usdcRaised',
  });

  const { data: saleEndTime } = useReadContract({
    address: TOKEN_SALE_ADDRESS as `0x${string}`,
    abi: TOKEN_SALE_ABI,
    functionName: 'saleEndTime',
  });

  const { data: tokensPerEth } = useReadContract({
    address: TOKEN_SALE_ADDRESS as `0x${string}`,
    abi: TOKEN_SALE_ABI,
    functionName: 'tokensPerEth',
  });

  const { data: tokensPerUsdc } = useReadContract({
    address: TOKEN_SALE_ADDRESS as `0x${string}`,
    abi: TOKEN_SALE_ABI,
    functionName: 'tokensPerUsdc',
  });

  const { data: isSaleActive } = useReadContract({
    address: TOKEN_SALE_ADDRESS as `0x${string}`,
    abi: TOKEN_SALE_ABI,
    functionName: 'isSaleActive',
  });

  const { data: userPurchased } = useReadContract({
    address: TOKEN_SALE_ADDRESS as `0x${string}`,
    abi: TOKEN_SALE_ABI,
    functionName: 'purchasedTokens',
    args: address ? [address] : undefined,
  });

  // Check USDC allowance
  const { data: usdcAllowance } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: 'allowance',
    args: address ? [address, TOKEN_SALE_ADDRESS] : undefined,
  });

  // Get USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS as `0x${string}`,
    abi: USDC_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  // Get ETH balance
  const { data: ethBalance } = useBalance({
    address: address,
  });

  // Approve USDC
  const { writeContract: approveUsdc, data: approveHash } = useWriteContract();
  const { isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
  });

  // Buy with ETH
  const { writeContract: buyWithEth, data: buyEthHash } = useWriteContract();
  const { isSuccess: isBuyEthSuccess } = useWaitForTransactionReceipt({
    hash: buyEthHash,
  });

  // Buy with USDC
  const { writeContract: buyWithUsdc, data: buyUsdcHash } = useWriteContract();
  const { isSuccess: isBuyUsdcSuccess } = useWaitForTransactionReceipt({
    hash: buyUsdcHash,
  });

  // Calculate tokens based on input
  const calculateTokens = () => {
    if (!amount || isNaN(parseFloat(amount))) return 0;

    if (paymentMethod === 'eth' && tokensPerEth) {
      const ethAmount = parseEther(amount);
      const tokens = (ethAmount * (tokensPerEth as bigint)) / parseEther('1');
      return Number(formatEther(tokens));
    }

    if (paymentMethod === 'usdc' && tokensPerUsdc) {
      const usdcAmount = parseUnits(amount, 6); // USDC has 6 decimals
      const tokens = (usdcAmount * (tokensPerUsdc as bigint)) / BigInt(10 ** 6);
      return Number(formatEther(tokens));
    }

    return 0;
  };

  // Check if USDC approval is needed
  useEffect(() => {
    if (paymentMethod === 'usdc' && amount && usdcAllowance !== undefined) {
      const usdcAmount = parseUnits(amount, 6);
      setNeedsApproval((usdcAllowance as bigint) < usdcAmount);
    } else {
      setNeedsApproval(false);
    }
  }, [paymentMethod, amount, usdcAllowance]);

  // Reset success states
  useEffect(() => {
    if (isApproveSuccess) {
      setNeedsApproval(false);
    }
  }, [isApproveSuccess]);

  useEffect(() => {
    if (isBuyEthSuccess || isBuyUsdcSuccess) {
      setAmount('');
    }
  }, [isBuyEthSuccess, isBuyUsdcSuccess]);

  const handleApprove = async () => {
    if (!amount) return;

    const usdcAmount = parseUnits(amount, 6);
    approveUsdc({
      address: USDC_ADDRESS as `0x${string}`,
      abi: USDC_ABI,
      functionName: 'approve',
      args: [TOKEN_SALE_ADDRESS, usdcAmount],
    });
  };

  const handleBuy = async () => {
    if (!amount) return;

    if (paymentMethod === 'eth') {
      const ethAmount = parseEther(amount);
      buyWithEth({
        address: TOKEN_SALE_ADDRESS as `0x${string}`,
        abi: TOKEN_SALE_ABI,
        functionName: 'buyWithEth',
        value: ethAmount,
      });
    } else {
      const usdcAmount = parseUnits(amount, 6);
      buyWithUsdc({
        address: TOKEN_SALE_ADDRESS as `0x${string}`,
        abi: TOKEN_SALE_ABI,
        functionName: 'buyWithUsdc',
        args: [usdcAmount],
      });
    }
  };

  const saleProgress = tokensForSale && tokensSold
    ? Number((tokensSold as bigint) * BigInt(100) / (tokensForSale as bigint))
    : 0;

  const timeRemaining = saleEndTime
    ? Math.max(0, Number(saleEndTime) - Math.floor(Date.now() / 1000))
    : 0;

  const formatTimeRemaining = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const totalRaised = ethRaised && usdcRaised && tokensPerEth
    ? (Number(formatEther(ethRaised as bigint)) * 5000) + (Number(usdcRaised) / 1e6)
    : 0;

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-pixel text-2xl md:text-3xl text-arcade-yellow glow-yellow mb-2">
            8BIT TOKEN SALE
          </h1>
          <p className="font-arcade text-gray-400 mb-4">
            Join the future of blockchain gaming
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-arcade-dark border border-arcade-green/30 rounded">
            {isSaleActive ? (
              <>
                <span className="w-2 h-2 bg-arcade-green rounded-full animate-pulse"></span>
                <span className="font-pixel text-arcade-green text-sm">SALE LIVE</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                <span className="font-pixel text-gray-500 text-sm">SALE ENDED</span>
              </>
            )}
          </div>
        </div>

        {/* Sale Stats */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card>
            <div className="text-center">
              <p className="font-arcade text-xs text-gray-500 mb-1">Tokens Sold</p>
              <p className="font-pixel text-arcade-cyan text-lg">
                {formatNumber(Number(formatEther(tokensSold || BigInt(0))))}
              </p>
              <p className="font-arcade text-xs text-gray-400">
                / {formatNumber(Number(formatEther(tokensForSale || BigInt(0))))}
              </p>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <p className="font-arcade text-xs text-gray-500 mb-1">Total Raised</p>
              <p className="font-pixel text-arcade-green text-lg">
                ${formatNumber(totalRaised)}
              </p>
              <p className="font-arcade text-xs text-gray-400">
                Goal: $50,000
              </p>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <p className="font-arcade text-xs text-gray-500 mb-1">Time Remaining</p>
              <p className="font-pixel text-arcade-pink text-lg">
                {timeRemaining > 0 ? formatTimeRemaining(timeRemaining) : 'ENDED'}
              </p>
              <p className="font-arcade text-xs text-gray-400">
                4 Week Sale
              </p>
            </div>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card className="mb-8">
          <div className="mb-2 flex justify-between items-center">
            <span className="font-pixel text-xs text-arcade-cyan">Sale Progress</span>
            <span className="font-pixel text-xs text-arcade-yellow">{saleProgress}%</span>
          </div>
          <div className="w-full bg-arcade-dark rounded-full h-4 overflow-hidden border border-arcade-cyan/30">
            <div
              className="bg-gradient-to-r from-arcade-cyan to-arcade-green h-full transition-all duration-500 glow-cyan"
              style={{ width: `${saleProgress}%` }}
            />
          </div>
        </Card>

        {/* Purchase Section */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Buy Card */}
          <Card>
            <h2 className="font-pixel text-arcade-pink mb-4">BUY 8BIT TOKENS</h2>

            {/* Payment Method Selection */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={paymentMethod === 'eth' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setPaymentMethod('eth')}
                className="flex-1"
              >
                Pay with ETH
              </Button>
              <Button
                variant={paymentMethod === 'usdc' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setPaymentMethod('usdc')}
                className="flex-1"
              >
                Pay with USDC
              </Button>
            </div>

            {/* Amount Input */}
            <div className="mb-4">
              <label className="font-arcade text-xs text-gray-400 mb-2 block">
                {paymentMethod === 'eth' ? 'ETH Amount' : 'USDC Amount'}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={paymentMethod === 'eth' ? '0.1' : '10'}
                className="w-full px-4 py-3 bg-arcade-dark border border-arcade-cyan/30 rounded font-arcade text-white focus:border-arcade-cyan focus:outline-none"
              />
              <div className="flex justify-between mt-2">
                <span className="font-arcade text-xs text-gray-500">
                  Balance: {paymentMethod === 'eth'
                    ? `${Number(ethBalance?.formatted || 0).toFixed(4)} ETH`
                    : `${((Number(usdcBalance || BigInt(0)) / 1e6) || 0).toFixed(2)} USDC`}
                </span>
                <span className="font-arcade text-xs text-arcade-yellow">
                  You get: {formatNumber(calculateTokens())} 8BIT
                </span>
              </div>
            </div>

            {/* Current Price */}
            <div className="mb-6 p-3 bg-arcade-dark/50 rounded border border-arcade-yellow/30">
              <p className="font-arcade text-xs text-gray-400 mb-1">Current Price</p>
              <p className="font-pixel text-arcade-yellow">
                {paymentMethod === 'eth'
                  ? `1 ETH = ${formatNumber(Number(formatEther(tokensPerEth || BigInt(0))))} 8BIT`
                  : `1 USDC = ${formatNumber(Number(formatEther(tokensPerUsdc || BigInt(0))))} 8BIT`}
              </p>
              <p className="font-arcade text-xs text-gray-400 mt-1">
                ($0.0005 per token)
              </p>
            </div>

            {/* Buy Button */}
            {!isConnected ? (
              <Button variant="secondary" size="lg" className="w-full" disabled>
                Connect Wallet to Buy
              </Button>
            ) : !isSaleActive ? (
              <Button variant="secondary" size="lg" className="w-full" disabled>
                Sale Ended
              </Button>
            ) : needsApproval ? (
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={handleApprove}
                disabled={!!approveHash}
              >
                {approveHash ? 'Approving USDC...' : 'Approve USDC'}
              </Button>
            ) : (
              <Button
                variant="primary"
                size="lg"
                className="w-full"
                onClick={handleBuy}
                disabled={!amount || !!buyEthHash || !!buyUsdcHash}
              >
                {buyEthHash || buyUsdcHash ? 'Processing...' : 'Buy Tokens'}
              </Button>
            )}

            {/* User Purchase Info */}
            {isConnected && userPurchased && Number(userPurchased) > 0 && (
              <div className="mt-4 p-3 bg-arcade-green/10 rounded border border-arcade-green/30">
                <p className="font-arcade text-xs text-gray-400">Your Purchase</p>
                <p className="font-pixel text-arcade-green">
                  {formatNumber(Number(formatEther(userPurchased as bigint)))} 8BIT
                </p>
              </div>
            )}
          </Card>

          {/* Info Card */}
          <Card>
            <h2 className="font-pixel text-arcade-green mb-4">SALE DETAILS</h2>

            <div className="space-y-3 font-arcade text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Token Price:</span>
                <span className="text-white">$0.0005</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Supply:</span>
                <span className="text-white">1 Billion</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">For Sale:</span>
                <span className="text-white">100M (10%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Raise Goal:</span>
                <span className="text-arcade-yellow">$50,000</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Vesting:</span>
                <span className="text-arcade-green">None</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Unsold Tokens:</span>
                <span className="text-arcade-red">Burned</span>
              </div>
            </div>

            <div className="mt-6 p-3 bg-arcade-pink/10 rounded border border-arcade-pink/30">
              <p className="font-arcade text-xs text-arcade-pink font-bold mb-2">
                🔥 EARLY BIRD BONUS
              </p>
              <p className="font-arcade text-xs text-gray-300">
                Buy early and benefit from potential price appreciation as the platform grows!
              </p>
            </div>
          </Card>
        </div>

        {/* Benefits */}
        <Card>
          <h2 className="font-pixel text-arcade-cyan text-center mb-6">WHY BUY 8BIT?</h2>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl mb-2">🎮</div>
              <p className="font-pixel text-sm text-arcade-green mb-2">Play & Earn</p>
              <p className="font-arcade text-xs text-gray-400">
                Earn tokens by playing games and ranking on leaderboards
              </p>
            </div>

            <div className="text-center">
              <div className="text-3xl mb-2">🏆</div>
              <p className="font-pixel text-sm text-arcade-yellow mb-2">Tournaments</p>
              <p className="font-arcade text-xs text-gray-400">
                Enter tournaments and compete for massive prize pools
              </p>
            </div>

            <div className="text-center">
              <div className="text-3xl mb-2">🔥</div>
              <p className="font-pixel text-sm text-arcade-red mb-2">Deflationary</p>
              <p className="font-arcade text-xs text-gray-400">
                50% of tournament fees burned, reducing supply over time
              </p>
            </div>
          </div>
        </Card>

        {/* Disclaimer */}
        <div className="mt-6 p-4 bg-arcade-dark/50 border border-gray-700 rounded text-center">
          <p className="font-arcade text-xs text-gray-500">
            ⚠️ Cryptocurrency investments carry risk. Only invest what you can afford to lose.
            This is not financial advice. DYOR (Do Your Own Research).
          </p>
        </div>
      </div>
    </div>
  );
}
