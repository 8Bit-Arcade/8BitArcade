import { ethers } from "hardhat";

/**
 * Deploy TournamentPayments contract to Arbitrum
 *
 * This contract handles tournament entry fees in both USDC and ETH,
 * with automatic ETH->USDC conversion via Uniswap V3
 */
async function main() {
  console.log("Deploying TournamentPayments contract to Arbitrum...\n");

  // Arbitrum mainnet addresses
  const ADDRESSES = {
    // Will be set after 8BIT token is deployed
    EIGHTBIT_TOKEN: process.env.EIGHTBIT_TOKEN_ADDRESS || "0x0000000000000000000000000000000000000000",

    // Arbitrum mainnet addresses (verified)
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Native USDC on Arbitrum
    WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // Wrapped ETH on Arbitrum
    UNISWAP_ROUTER: "0xE592427A0AEce92De3Edee1F18E0157C05861564", // SwapRouter on Arbitrum
  };

  // Validate addresses
  if (ADDRESSES.EIGHTBIT_TOKEN === "0x0000000000000000000000000000000000000000") {
    console.error("⚠️  ERROR: EIGHTBIT_TOKEN_ADDRESS not set!");
    console.error("Please deploy EightBitToken first and set the address in .env");
    process.exit(1);
  }

  console.log("Contract Addresses:");
  console.log("  8BIT Token:", ADDRESSES.EIGHTBIT_TOKEN);
  console.log("  USDC:", ADDRESSES.USDC);
  console.log("  WETH:", ADDRESSES.WETH);
  console.log("  Uniswap Router:", ADDRESSES.UNISWAP_ROUTER);
  console.log();

  // Get deployer
  const [deployer] = await ethers.getSigners();
  console.log("Deploying from account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "ETH");
  console.log();

  // Deploy TournamentPayments
  console.log("Deploying TournamentPayments...");
  const TournamentPayments = await ethers.getContractFactory("TournamentPayments");
  const tournamentPayments = await TournamentPayments.deploy(
    ADDRESSES.EIGHTBIT_TOKEN,
    ADDRESSES.USDC,
    ADDRESSES.WETH,
    ADDRESSES.UNISWAP_ROUTER
  );

  await tournamentPayments.waitForDeployment();
  const tournamentPaymentsAddress = await tournamentPayments.getAddress();

  console.log("✅ TournamentPayments deployed to:", tournamentPaymentsAddress);
  console.log();

  // Post-deployment setup
  console.log("📝 Post-Deployment Setup Required:");
  console.log();
  console.log("1. Set Uniswap V3 Pools (after liquidity is added):");
  console.log(`   tournamentPayments.setPools(eightBitUsdcPool, wethUsdcPool);`);
  console.log();
  console.log("2. Set Tournament Fees:");
  console.log("   Standard Weekly ($1):");
  console.log(`   tournamentPayments.setTournamentFee(1, ${1e6}); // $1 in USDC (6 decimals)`);
  console.log("   Standard Monthly ($5):");
  console.log(`   tournamentPayments.setTournamentFee(2, ${5e6}); // $5`);
  console.log("   High Roller Weekly ($5):");
  console.log(`   tournamentPayments.setTournamentFee(3, ${5e6}); // $5`);
  console.log("   High Roller Monthly ($25):");
  console.log(`   tournamentPayments.setTournamentFee(4, ${25e6}); // $25`);
  console.log();
  console.log("3. Verify contract on Arbiscan:");
  console.log(`   npx hardhat verify --network arbitrum ${tournamentPaymentsAddress} "${ADDRESSES.EIGHTBIT_TOKEN}" "${ADDRESSES.USDC}" "${ADDRESSES.WETH}" "${ADDRESSES.UNISWAP_ROUTER}"`);
  console.log();

  // Save deployment info
  const deploymentInfo = {
    network: "arbitrum",
    tournamentPayments: tournamentPaymentsAddress,
    eightBitToken: ADDRESSES.EIGHTBIT_TOKEN,
    usdc: ADDRESSES.USDC,
    weth: ADDRESSES.WETH,
    uniswapRouter: ADDRESSES.UNISWAP_ROUTER,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };

  console.log("\n📄 Deployment Info:");
  console.log(JSON.stringify(deploymentInfo, null, 2));

  // Save to file
  const fs = require("fs");
  const path = require("path");
  const deploymentsDir = path.join(__dirname, "../deployments");

  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `tournament-payments-${Date.now()}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log(`\n✅ Deployment info saved to: ${deploymentFile}`);
  console.log("\n🎉 Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
