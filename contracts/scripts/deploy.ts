import { ethers } from "hardhat";

/**
 * Deployment Script for 8-Bit Arcade Smart Contracts
 *
 * This script deploys:
 * 1. EightBitToken (8BIT)
 * 2. GameRewards
 * 3. TournamentManager
 *
 * And automatically links them together.
 *
 * DEPLOYMENT STEPS:
 * 1. Create contracts/.env file with PRIVATE_KEY and ARBISCAN_API_KEY
 * 2. Fund your deployer wallet with Arbitrum Sepolia ETH (for testnet)
 *    Get testnet ETH from: https://faucet.quicknode.com/arbitrum/sepolia
 * 3. Run: npm run deploy:testnet
 * 4. Save the deployed contract addresses
 * 5. Update frontend/src/config/contracts.ts with the addresses
 * 6. Verify contracts on Arbiscan
 */

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  8-BIT ARCADE - SMART CONTRACT DEPLOYMENT");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log();

  // Deploy 8BIT Token
  console.log("📝 Deploying EightBitToken...");
  const EightBitToken = await ethers.getContractFactory("EightBitToken");
  const token = await EightBitToken.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  console.log("✅ EightBitToken deployed to:", tokenAddress);
  console.log();

  // Deploy GameRewards
  console.log("📝 Deploying GameRewards...");
  const GameRewards = await ethers.getContractFactory("GameRewards");
  const rewards = await GameRewards.deploy(tokenAddress);
  await rewards.waitForDeployment();
  const rewardsAddress = await rewards.getAddress();
  console.log("✅ GameRewards deployed to:", rewardsAddress);
  console.log();

  // Deploy TournamentManager
  console.log("📝 Deploying TournamentManager...");
  const TournamentManager = await ethers.getContractFactory("TournamentManager");
  const tournaments = await TournamentManager.deploy(tokenAddress);
  await tournaments.waitForDeployment();
  const tournamentsAddress = await tournaments.getAddress();
  console.log("✅ TournamentManager deployed to:", tournamentsAddress);
  console.log();

  // Deploy TreasuryGasManager
  console.log("📝 Deploying TreasuryGasManager...");
  // Initial configuration:
  // - Minimum threshold: 0.05 ETH (when payout wallet drops below this, trigger refill)
  // - Refill amount: 0.1 ETH (send this much on each refill)
  // - Payout wallet: deployer address initially (update later with setPayoutWallet)
  const minThreshold = ethers.parseEther("0.05"); // 0.05 ETH
  const refillAmount = ethers.parseEther("0.1");  // 0.1 ETH

  const TreasuryGasManager = await ethers.getContractFactory("TreasuryGasManager");
  const treasury = await TreasuryGasManager.deploy(
    deployer.address, // Initial payout wallet (update this later!)
    minThreshold,
    refillAmount
  );
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("✅ TreasuryGasManager deployed to:", treasuryAddress);
  console.log();

  // Authorize GameRewards as a minter
  console.log("🔗 Authorizing GameRewards as minter...");
  const authTx = await token.setAuthorizedMinter(rewardsAddress, true);
  await authTx.wait();
  console.log("✅ GameRewards authorized to mint rewards");
  console.log();

  // Fund TournamentManager with tokens for prize pools
  // Transfer 20M tokens to TournamentManager for prizes (4% of max supply)
  console.log("💰 Funding TournamentManager with prize pool tokens...");
  const prizePoolAmount = ethers.parseEther("20000000"); // 20M tokens
  const mintTx = await token.transfer(tournamentsAddress, prizePoolAmount);
  await mintTx.wait();
  console.log("✅ TournamentManager funded with", ethers.formatEther(prizePoolAmount), "8BIT");
  console.log();

  // Deploy TokenSale
  console.log("📝 Deploying TokenSale...");
  // USDC addresses:
  // Arbitrum Sepolia: 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d
  // Arbitrum One: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831
  const usdcAddress = network.name === "arbitrumSepolia"
    ? "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"
    : "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";

  const TokenSale = await ethers.getContractFactory("TokenSale");
  const tokenSale = await TokenSale.deploy(
    tokenAddress,
    usdcAddress,
    0 // Start immediately (0 = use block.timestamp)
  );
  await tokenSale.waitForDeployment();
  const tokenSaleAddress = await tokenSale.getAddress();
  console.log("✅ TokenSale deployed to:", tokenSaleAddress);
  console.log();

  // Fund TokenSale with 200M tokens (40% of max supply)
  console.log("💰 Funding TokenSale with 200M tokens...");
  const saleAmount = ethers.parseEther("200000000"); // 200M tokens
  const saleFundTx = await token.transfer(tokenSaleAddress, saleAmount);
  await saleFundTx.wait();
  console.log("✅ TokenSale funded with", ethers.formatEther(saleAmount), "8BIT");
  console.log();

  // Deploy TestnetFaucet (testnet only)
  let faucetAddress = "";
  if (network.name === "arbitrumSepolia") {
    console.log("📝 Deploying TestnetFaucet (testnet only)...");
    const TestnetFaucet = await ethers.getContractFactory("TestnetFaucet");
    const faucet = await TestnetFaucet.deploy(tokenAddress);
    await faucet.waitForDeployment();
    faucetAddress = await faucet.getAddress();
    console.log("✅ TestnetFaucet deployed to:", faucetAddress);
    console.log();

    // Fund faucet with 50M tokens for testing
    console.log("💰 Funding TestnetFaucet with 50M tokens...");
    const faucetAmount = ethers.parseEther("50000000"); // 50M tokens
    const faucetFundTx = await token.transfer(faucetAddress, faucetAmount);
    await faucetFundTx.wait();
    console.log("✅ TestnetFaucet funded with", ethers.formatEther(faucetAmount), "8BIT");
    console.log();
  } else {
    console.log("⚠️  Skipping TestnetFaucet deployment (mainnet - faucet is testnet only)");
    console.log();
  }

  // Deploy TournamentPayments (handles ETH/USDC payments + buyback/burn)
  console.log("📝 Deploying TournamentPayments...");

  // Arbitrum addresses
  const wethAddress = network.name === "arbitrumSepolia"
    ? "0x980B62Da83eFf3D4576C647993b0c1D7faf17c73" // WETH on Arbitrum Sepolia
    : "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1"; // WETH on Arbitrum One

  const swapRouterAddress = "0xE592427A0AEce92De3Edee1F18E0157C05861564"; // Uniswap V3 SwapRouter (same on both networks)

  const TournamentPayments = await ethers.getContractFactory("TournamentPayments");
  const tournamentPayments = await TournamentPayments.deploy(
    tokenAddress,
    usdcAddress,
    wethAddress,
    swapRouterAddress
  );
  await tournamentPayments.waitForDeployment();
  const tournamentPaymentsAddress = await tournamentPayments.getAddress();
  console.log("✅ TournamentPayments deployed to:", tournamentPaymentsAddress);
  console.log();

  console.log("═══════════════════════════════════════════════════");
  console.log("  DEPLOYMENT SUMMARY");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("EightBitToken (8BIT):", tokenAddress);
  console.log("GameRewards:", rewardsAddress);
  console.log("TournamentManager:", tournamentsAddress);
  console.log("TournamentPayments:", tournamentPaymentsAddress);
  console.log("TokenSale:", tokenSaleAddress);
  console.log("TreasuryGasManager:", treasuryAddress);
  if (faucetAddress) {
    console.log("TestnetFaucet:", faucetAddress);
  }
  console.log("Deployer:", deployer.address);
  console.log();

  // Verify token balances
  console.log("═══════════════════════════════════════════════════");
  console.log("  TOKEN BALANCE VERIFICATION");
  console.log("═══════════════════════════════════════════════════");
  console.log();

  const tournamentBalance = await token.balanceOf(tournamentsAddress);
  const saleBalance = await token.balanceOf(tokenSaleAddress);
  const faucetBalance = faucetAddress ? await token.balanceOf(faucetAddress) : BigInt(0);
  const deployerBalance = await token.balanceOf(deployer.address);
  const totalDistributed = tournamentBalance + saleBalance + faucetBalance + deployerBalance;

  console.log("TournamentManager:", ethers.formatEther(tournamentBalance), "8BIT");
  console.log("  Expected: 20,000,000 8BIT");
  console.log("  Status:", tournamentBalance === ethers.parseEther("20000000") ? "✅ CORRECT" : "❌ INCORRECT");
  console.log();

  console.log("TokenSale:", ethers.formatEther(saleBalance), "8BIT");
  console.log("  Expected: 200,000,000 8BIT");
  console.log("  Status:", saleBalance === ethers.parseEther("200000000") ? "✅ CORRECT" : "❌ INCORRECT");
  console.log();

  if (faucetAddress) {
    console.log("TestnetFaucet:", ethers.formatEther(faucetBalance), "8BIT");
    console.log("  Expected: 50,000,000 8BIT");
    console.log("  Status:", faucetBalance === ethers.parseEther("50000000") ? "✅ CORRECT" : "❌ INCORRECT");
    console.log();
  }

  console.log("Deployer:", ethers.formatEther(deployerBalance), "8BIT");
  const expectedDeployerBalance = faucetAddress
    ? ethers.parseEther("30000000") // Testnet: 30M remaining
    : ethers.parseEther("80000000"); // Mainnet: 80M remaining (no faucet)
  console.log("  Expected:", ethers.formatEther(expectedDeployerBalance), "8BIT");
  console.log("  Status:", deployerBalance === expectedDeployerBalance ? "✅ CORRECT" : "❌ INCORRECT");
  console.log();

  console.log("Total Distributed:", ethers.formatEther(totalDistributed), "8BIT");
  console.log("  Expected: 300,000,000 8BIT");
  console.log("  Status:", totalDistributed === ethers.parseEther("300000000") ? "✅ CORRECT" : "❌ INCORRECT");
  console.log();

  // Check if all balances are correct
  const balancesCorrect =
    tournamentBalance === ethers.parseEther("20000000") &&
    saleBalance === ethers.parseEther("200000000") &&
    (!faucetAddress || faucetBalance === ethers.parseEther("50000000")) &&
    deployerBalance === expectedDeployerBalance &&
    totalDistributed === ethers.parseEther("300000000");

  if (!balancesCorrect) {
    console.log("❌❌❌ TOKEN BALANCE MISMATCH DETECTED! ❌❌❌");
    console.log("DEPLOYMENT MAY HAVE FAILED! CHECK BALANCES IMMEDIATELY!");
    console.log("═══════════════════════════════════════════════════");
    throw new Error("Token balance verification failed!");
  }

  console.log("✅✅✅ ALL TOKEN BALANCES VERIFIED CORRECT! ✅✅✅");
  console.log();
  console.log("⚠️  IMPORTANT NEXT STEPS:");
  console.log("───────────────────────────────────────────────────");
  console.log("1. Save these addresses in frontend/src/config/contracts.ts");
  console.log("2. Update TESTNET_CONTRACTS or MAINNET_CONTRACTS accordingly");
  console.log("3. Set rewardsDistributor in GameRewards contract:");
  console.log("   - Create a secure backend wallet");
  console.log("   - Call: rewards.setRewardsDistributor(BACKEND_WALLET)");
  console.log("4. Set tournamentManager in TournamentManager:");
  console.log("   - Call: tournaments.setTournamentManager(BACKEND_WALLET)");
  console.log("5. Configure TreasuryGasManager:");
  console.log("   - Call: treasury.setPayoutWallet(BACKEND_WALLET)");
  console.log("   - Fund treasury: Send ETH to", treasuryAddress);
  console.log("   - Recommended: 1 ETH for testnet, 5+ ETH for mainnet");
  console.log("6. Configure TournamentPayments:");
  console.log("   - Set tournament fees: tournamentPayments.setTournamentFee(id, feeInUsdc)");
  console.log("   - After adding liquidity, set pools: tournamentPayments.setPools(8bitUsdcPool, wethUsdcPool)");
  console.log("7. Add Treasury address to Firebase functions config:");
  console.log("   firebase functions:config:set treasury.address=\"" + treasuryAddress + "\"");
  console.log("8. Verify contracts on Arbiscan:");
  console.log(`   npx hardhat verify --network arbitrumSepolia ${tokenAddress}`);
  console.log(`   npx hardhat verify --network arbitrumSepolia ${rewardsAddress} ${tokenAddress}`);
  console.log(`   npx hardhat verify --network arbitrumSepolia ${tournamentsAddress} ${tokenAddress}`);
  console.log(`   npx hardhat verify --network arbitrumSepolia ${tournamentPaymentsAddress} ${tokenAddress} ${usdcAddress} ${wethAddress} ${swapRouterAddress}`);
  console.log(`   npx hardhat verify --network arbitrumSepolia ${tokenSaleAddress} ${tokenAddress} ${usdcAddress} 0`);
  console.log(`   npx hardhat verify --network arbitrumSepolia ${treasuryAddress} ${deployer.address} ${minThreshold} ${refillAmount}`);
  console.log("9. Add liquidity to DEX for 8BIT/USDC and WETH/USDC pools");
  console.log("10. Create automated tournament scheduler (Firebase Cloud Function)");
  console.log();
  console.log("For mainnet deployment, run: npm run deploy:mainnet");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
