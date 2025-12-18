/**
 * Tournament Prize Distribution
 *
 * Distributes prizes to tournament winners by calling the
 * TournamentManager smart contract on Arbitrum.
 *
 * Setup:
 * 1. Set tournament manager wallet private key:
 *    firebase functions:config:set tournament.private_key="0xYourKey"
 * 2. Ensure wallet is set as tournamentManager in the contract
 * 3. Contract must have sufficient 8BIT tokens for prizes
 */

import { ethers } from 'ethers';
import * as functions from 'firebase-functions';
import { ARBITRUM_RPC_URL } from '../config';

// TournamentManager contract ABI (minimal)
const TOURNAMENT_MANAGER_ABI = [
  'function declareWinner(uint256 tournamentId, address winner) external',
  'function getTournament(uint256 tournamentId) external view returns (uint8 tier, uint8 period, uint256 startTime, uint256 endTime, uint256 entryFee, uint256 prizePool, uint256 totalEntries, address winner, bool isActive)',
];

/**
 * Get TournamentManager contract address
 */
function getTournamentManagerAddress(): string {
  // Use environment variable or config
  const address = process.env.TOURNAMENT_MANAGER_ADDRESS ||
                  functions.config().tournament?.contract_address;

  if (!address) {
    throw new Error('TournamentManager address not configured');
  }

  return address;
}

/**
 * Distribute prize to tournament winner
 * @param tournamentId Tournament ID (from smart contract)
 * @param winnerId Winner's wallet address
 * @param prizeAmount Prize amount in 8BIT tokens (for logging)
 * @returns Transaction hash
 */
export async function distributeTournamentPrize(
  tournamentId: string,
  winnerId: string,
  prizeAmount: number
): Promise<string> {
  try {
    console.log(`Distributing prize for tournament ${tournamentId} to ${winnerId}`);

    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(ARBITRUM_RPC_URL);

    // Get private key from Firebase config
    const privateKey = functions.config().tournament?.private_key;
    if (!privateKey) {
      throw new Error(
        'Tournament private key not configured. Run: firebase functions:config:set tournament.private_key="0xYourKey"'
      );
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    console.log('Tournament manager wallet:', wallet.address);

    // Check wallet balance
    const balance = await provider.getBalance(wallet.address);
    console.log('Wallet balance:', ethers.formatEther(balance), 'ETH');

    if (balance < ethers.parseEther('0.001')) {
      console.warn('⚠️  WARNING: Low wallet balance for gas fees');
    }

    // Connect to TournamentManager contract
    const contractAddress = getTournamentManagerAddress();
    const tournamentContract = new ethers.Contract(
      contractAddress,
      TOURNAMENT_MANAGER_ABI,
      wallet
    );

    console.log('TournamentManager contract:', contractAddress);

    // Verify tournament exists on-chain (optional but recommended)
    try {
      const tournamentData = await tournamentContract.getTournament(tournamentId);
      console.log('Tournament data:', {
        prizePool: ethers.formatEther(tournamentData.prizePool),
        totalEntries: tournamentData.totalEntries.toString(),
        isActive: tournamentData.isActive,
      });
    } catch (error) {
      console.error('Warning: Could not fetch tournament data:', error);
    }

    // Estimate gas
    const estimatedGas = await tournamentContract.declareWinner.estimateGas(
      tournamentId,
      winnerId
    );

    console.log('Estimated gas:', estimatedGas.toString());

    // Execute prize distribution
    console.log('Calling declareWinner on smart contract...');
    const tx = await tournamentContract.declareWinner(tournamentId, winnerId, {
      gasLimit: (estimatedGas * 120n) / 100n, // Add 20% buffer
    });

    console.log('Transaction sent:', tx.hash);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log('✅ Prize distributed successfully!');
    console.log('Block:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());

    return tx.hash;
  } catch (error) {
    console.error('Error distributing prize:', error);
    if (error instanceof Error) {
      throw new Error(`Prize distribution failed: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate winner address format
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}
