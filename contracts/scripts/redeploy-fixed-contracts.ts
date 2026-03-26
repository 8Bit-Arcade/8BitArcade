import { ethers, network } from "hardhat";

/**
 * Redeploy ONLY the fixed contracts:
 * - TournamentPayments (TickMath fix)
 * - TournamentBuyback (TickMath fix)
 *
 * Run with: npx hardhat run scripts/redeploy-fixed-contracts.ts --network arbitrumSepolia
 */
async function main() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  REDEPLOY FIXED CONTRACTS ONLY");
  console.log("  TournamentPayments & TournamentBuyback");
  console.log("═══════════════════════════════════════════════════\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // ═══════════════════════════════════════════════════
  // EXISTING CONTRACT ADDRESSES (DO NOT CHANGE)
  // These are your already-deployed contracts on Arbitrum Sepolia
  // ═══════════════════════════════════════════════════
  const EXISTING = {
    EIGHTBIT_TOKEN: "0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d",
    USDC: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",           // Arbitrum Sepolia USDC
    WETH: "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73",           // Arbitrum Sepolia WETH
    SWAP_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564",    // Uniswap V3 SwapRouter
  };

  console.log("Using existing addresses:");
  console.log("  8BIT Token:", EXISTING.EIGHTBIT_TOKEN);
  console.log("  USDC:", EXISTING.USDC);
  console.log("  WETH:", EXISTING.WETH);
  console.log("  SwapRouter:", EXISTING.SWAP_ROUTER);
  console.log();

  // ═══════════════════════════════════════════════════
  // Deploy TournamentPayments (with TickMath fix)
  // ═══════════════════════════════════════════════════
  console.log("📝 Deploying TournamentPayments (FIXED)...");
  const TournamentPayments = await ethers.getContractFactory("TournamentPayments");
  const tournamentPayments = await TournamentPayments.deploy(
    EXISTING.EIGHTBIT_TOKEN,
    EXISTING.USDC,
    EXISTING.WETH,
    EXISTING.SWAP_ROUTER
  );
  await tournamentPayments.waitForDeployment();
  const paymentsAddress = await tournamentPayments.getAddress();
  console.log("✅ TournamentPayments deployed to:", paymentsAddress);
  console.log();

  // ═══════════════════════════════════════════════════
  // Deploy TournamentBuyback (with TickMath fix)
  // ═══════════════════════════════════════════════════
  console.log("📝 Deploying TournamentBuyback (FIXED)...");
  const TournamentBuyback = await ethers.getContractFactory("TournamentBuyback");
  const tournamentBuyback = await TournamentBuyback.deploy(
    EXISTING.EIGHTBIT_TOKEN,
    EXISTING.USDC,
    EXISTING.SWAP_ROUTER
  );
  await tournamentBuyback.waitForDeployment();
  const buybackAddress = await tournamentBuyback.getAddress();
  console.log("✅ TournamentBuyback deployed to:", buybackAddress);
  console.log();

  // ═══════════════════════════════════════════════════
  // Summary
  // ═══════════════════════════════════════════════════
  console.log("═══════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════\n");
  console.log("NEW ADDRESSES (update frontend/src/config/contracts.ts):\n");
  console.log(`  TOURNAMENT_PAYMENTS: '${paymentsAddress}',`);
  console.log(`  TOURNAMENT_BUYBACK: '${buybackAddress}',`);
  console.log();

  console.log("VERIFY COMMANDS:\n");
  console.log(`npx hardhat verify --network arbitrumSepolia ${paymentsAddress} "${EXISTING.EIGHTBIT_TOKEN}" "${EXISTING.USDC}" "${EXISTING.WETH}" "${EXISTING.SWAP_ROUTER}"`);
  console.log();
  console.log(`npx hardhat verify --network arbitrumSepolia ${buybackAddress} "${EXISTING.EIGHTBIT_TOKEN}" "${EXISTING.USDC}" "${EXISTING.SWAP_ROUTER}"`);
  console.log();

  console.log("POST-DEPLOYMENT SETUP:\n");
  console.log("1. Update frontend/src/config/contracts.ts with new addresses");
  console.log("2. Set pools on TournamentBuyback (if you have a Uniswap V3 pool):");
  console.log(`   await tournamentBuyback.setPool("YOUR_8BIT_USDC_POOL_ADDRESS");`);
  console.log("3. Set tournament fees on TournamentPayments:");
  console.log(`   await tournamentPayments.setTournamentFee(1, 1000000); // $1 USDC`);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
