/**
 * Treasury Gas Manager Integration
 *
 * Utilities for managing gas wallet funding via TreasuryGasManager contract
 */

import { ethers } from 'ethers';
import * as functions from 'firebase-functions';

// TreasuryGasManager contract ABI (minimal)
const TREASURY_ABI = [
  'function needsRefill() view returns (bool)',
  'function getWalletStatus() view returns (uint256 currentBalance, bool needsRefill, bool refillAvailable)',
  'function refillGasWallet() returns (bool)',
  'function ensureFunding() returns (bool)',
  'function payoutWallet() view returns (address)',
  'function minimumThreshold() view returns (uint256)',
  'function refillAmount() view returns (uint256)',
  'function getStatistics() view returns (uint256 treasuryBalance, uint256 payoutBalance, uint256 totalSent, uint256 refills)',
  'function getRefillsRemaining() view returns (uint256)',
];

export interface TreasuryStatus {
  payoutBalance: string;      // Current balance of payout wallet (ETH)
  treasuryBalance: string;    // Current balance in treasury (ETH)
  needsRefill: boolean;       // True if payout wallet needs refill
  refillAvailable: boolean;   // True if treasury can refill
  minimumThreshold: string;   // Minimum threshold setting (ETH)
  refillAmount: string;       // Amount sent per refill (ETH)
  totalSent: string;          // Total ETH sent to payout wallet
  refillCount: number;        // Number of refills executed
  refillsRemaining: number;   // Estimated refills remaining
}

/**
 * Check if gas wallet needs refill and get status
 */
export async function checkTreasuryStatus(
  provider: ethers.Provider,
  treasuryAddress: string
): Promise<TreasuryStatus> {
  const treasury = new ethers.Contract(treasuryAddress, TREASURY_ABI, provider);

  try {
    // Get wallet status
    const [currentBalance, needsRefill, refillAvailable] = await treasury.getWalletStatus();

    // Get configuration
    const minimumThreshold = await treasury.minimumThreshold();
    const refillAmountValue = await treasury.refillAmount();

    // Get statistics
    const [treasuryBalance, , totalSent, refillCount] = await treasury.getStatistics();

    // Get remaining refills
    const refillsRemaining = await treasury.getRefillsRemaining();

    return {
      payoutBalance: ethers.formatEther(currentBalance),
      treasuryBalance: ethers.formatEther(treasuryBalance),
      needsRefill,
      refillAvailable,
      minimumThreshold: ethers.formatEther(minimumThreshold),
      refillAmount: ethers.formatEther(refillAmountValue),
      totalSent: ethers.formatEther(totalSent),
      refillCount: Number(refillCount),
      refillsRemaining: Number(refillsRemaining),
    };
  } catch (error) {
    console.error('Error checking treasury status:', error);
    throw new Error(`Failed to check treasury status: ${error}`);
  }
}

/**
 * Ensure payout wallet has sufficient gas before operations
 * Call this before batch reward distributions
 */
export async function ensureGasFunding(
  provider: ethers.Provider,
  treasuryAddress: string,
  wallet: ethers.Wallet
): Promise<{
  refilled: boolean;
  status: TreasuryStatus;
}> {
  console.log('Checking gas wallet funding status...');

  // Get current status
  const status = await checkTreasuryStatus(provider, treasuryAddress);

  console.log('Treasury Status:', {
    payoutBalance: status.payoutBalance + ' ETH',
    treasuryBalance: status.treasuryBalance + ' ETH',
    needsRefill: status.needsRefill,
    refillsRemaining: status.refillsRemaining,
  });

  // Warning if treasury is running low
  if (status.refillsRemaining < 10) {
    console.warn(`⚠️  WARNING: Treasury low! Only ${status.refillsRemaining} refills remaining`);
    console.warn('Please fund the treasury contract soon to avoid interruption');
  }

  // Critical alert if treasury can't refill
  if (status.needsRefill && !status.refillAvailable) {
    const error = new Error(
      'CRITICAL: Payout wallet needs refill but treasury has insufficient funds! ' +
      `Payout balance: ${status.payoutBalance} ETH, Treasury balance: ${status.treasuryBalance} ETH`
    );
    console.error(error.message);
    throw error;
  }

  // Attempt refill if needed
  if (status.needsRefill && status.refillAvailable) {
    console.log('Payout wallet needs refill. Triggering auto-refill...');

    try {
      const treasury = new ethers.Contract(treasuryAddress, TREASURY_ABI, wallet);

      // Call ensureFunding (cheaper gas, no revert on failure)
      const tx = await treasury.ensureFunding();
      const receipt = await tx.wait();

      console.log('✅ Gas wallet refilled successfully!');
      console.log('Transaction hash:', receipt.hash);
      console.log('Gas used:', receipt.gasUsed.toString());

      // Get updated status
      const updatedStatus = await checkTreasuryStatus(provider, treasuryAddress);

      return {
        refilled: true,
        status: updatedStatus,
      };
    } catch (error) {
      console.error('Error refilling gas wallet:', error);
      throw new Error(`Failed to refill gas wallet: ${error}`);
    }
  }

  console.log('✅ Gas wallet has sufficient funding');

  return {
    refilled: false,
    status,
  };
}

/**
 * Log treasury status for monitoring
 */
export async function logTreasuryStatus(
  provider: ethers.Provider,
  treasuryAddress: string
): Promise<void> {
  try {
    const status = await checkTreasuryStatus(provider, treasuryAddress);

    console.log('═══════════════════════════════════════');
    console.log('  TREASURY GAS MANAGER STATUS');
    console.log('═══════════════════════════════════════');
    console.log('Payout Wallet Balance:', status.payoutBalance, 'ETH');
    console.log('Treasury Balance:', status.treasuryBalance, 'ETH');
    console.log('Needs Refill:', status.needsRefill);
    console.log('Refill Available:', status.refillAvailable);
    console.log('Minimum Threshold:', status.minimumThreshold, 'ETH');
    console.log('Refill Amount:', status.refillAmount, 'ETH');
    console.log('Total Refills Executed:', status.refillCount);
    console.log('Total ETH Sent:', status.totalSent, 'ETH');
    console.log('Refills Remaining:', status.refillsRemaining);
    console.log('═══════════════════════════════════════');

    // Warnings
    if (status.refillsRemaining < 10) {
      console.warn('⚠️  WARNING: Less than 10 refills remaining!');
    }
    if (status.needsRefill && !status.refillAvailable) {
      console.error('❌ CRITICAL: Cannot refill - treasury out of funds!');
    }
  } catch (error) {
    console.error('Failed to log treasury status:', error);
  }
}

/**
 * Get treasury address from Firebase config
 */
export function getTreasuryAddress(): string {
  const treasuryAddress = functions.config().treasury?.address;
  if (!treasuryAddress) {
    throw new Error(
      'Treasury address not configured. Run: firebase functions:config:set treasury.address="0xYourTreasuryAddress"'
    );
  }
  return treasuryAddress;
}
