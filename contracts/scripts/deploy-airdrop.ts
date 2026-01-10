import { ethers, network } from "hardhat";

/**
 * Deployment Script for VestedAirdrop Contract
 *
 * This script deploys the airdrop contract and optionally funds it.
 *
 * PREREQUISITE:
 * 1. Run the triggerAirdropSnapshot Cloud Function to generate the Merkle root
 * 2. Copy the Merkle root from the Firebase console/function output
 *
 * DEPLOYMENT STEPS:
 * 1. Ensure .env has PRIVATE_KEY set
 * 2. Set MERKLE_ROOT environment variable: export MERKLE_ROOT=0x...
 * 3. Run: npx hardhat run scripts/deploy-airdrop.ts --network arbitrumSepolia
 * 4. Fund the contract with 15M tokens (or testnet amount)
 * 5. Call activate() on the contract
 * 6. Update Firebase with contract address using setAirdropContract function
 */

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  8-BIT ARCADE - VESTED AIRDROP DEPLOYMENT");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Network:", network.name);
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log();

  // Get configuration from environment
  const merkleRoot = process.env.MERKLE_ROOT;
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const treasuryAddress = process.env.TREASURY_ADDRESS || deployer.address;

  // Validate inputs
  if (!merkleRoot) {
    console.error("❌ ERROR: MERKLE_ROOT environment variable not set!");
    console.error("   Run triggerAirdropSnapshot first, then set:");
    console.error("   export MERKLE_ROOT=0x...");
    process.exit(1);
  }

  if (!tokenAddress) {
    console.error("❌ ERROR: TOKEN_ADDRESS environment variable not set!");
    console.error("   Set the 8BIT token address:");
    console.error("   export TOKEN_ADDRESS=0x...");
    process.exit(1);
  }

  console.log("Configuration:");
  console.log("  Token Address:", tokenAddress);
  console.log("  Merkle Root:", merkleRoot);
  console.log("  Treasury:", treasuryAddress);
  console.log();

  // Deploy VestedAirdrop
  console.log("📝 Deploying VestedAirdrop...");
  const VestedAirdrop = await ethers.getContractFactory("VestedAirdrop");
  const airdrop = await VestedAirdrop.deploy(
    tokenAddress,
    merkleRoot,
    treasuryAddress
  );
  await airdrop.waitForDeployment();
  const airdropAddress = await airdrop.getAddress();
  console.log("✅ VestedAirdrop deployed to:", airdropAddress);
  console.log();

  // Get deployment info
  const deployedAt = await airdrop.deployedAt();
  const claimDeadline = await airdrop.claimDeadline();

  console.log("═══════════════════════════════════════════════════");
  console.log("  DEPLOYMENT SUMMARY");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("VestedAirdrop:", airdropAddress);
  console.log("Token:", tokenAddress);
  console.log("Merkle Root:", merkleRoot);
  console.log("Treasury:", treasuryAddress);
  console.log("Deployed At:", new Date(Number(deployedAt) * 1000).toISOString());
  console.log("Claim Deadline:", new Date(Number(claimDeadline) * 1000).toISOString());
  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  NEXT STEPS");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("1. Fund the contract with 8BIT tokens:");
  console.log(`   - Testnet: Send 1,000,000 8BIT for testing`);
  console.log(`   - Mainnet: Send 15,000,000 8BIT (3% marketing allocation)`);
  console.log();
  console.log("2. Activate the airdrop:");
  console.log(`   await airdrop.activate()`);
  console.log();
  console.log("3. Update Firebase with contract address:");
  console.log(`   Call setAirdropContract({ snapshotId: "...", contractAddress: "${airdropAddress}" })`);
  console.log();
  console.log("4. Verify contract on Arbiscan:");
  console.log(`   npx hardhat verify --network ${network.name} ${airdropAddress} ${tokenAddress} ${merkleRoot} ${treasuryAddress}`);
  console.log();
  console.log("5. Update frontend config with airdrop address");
  console.log();

  // If AUTO_FUND is set, transfer tokens
  const autoFund = process.env.AUTO_FUND === "true";
  const fundAmount = process.env.FUND_AMOUNT || "1000000"; // 1M tokens for testing

  if (autoFund) {
    console.log("═══════════════════════════════════════════════════");
    console.log("  AUTO-FUNDING AIRDROP");
    console.log("═══════════════════════════════════════════════════");
    console.log();

    const token = await ethers.getContractAt("EightBitToken", tokenAddress);
    const amountWei = ethers.parseEther(fundAmount);

    // Check deployer balance
    const balance = await token.balanceOf(deployer.address);
    console.log("Deployer token balance:", ethers.formatEther(balance), "8BIT");

    if (balance < amountWei) {
      console.error("❌ Insufficient token balance!");
      console.error(`   Need: ${fundAmount} 8BIT`);
      console.error(`   Have: ${ethers.formatEther(balance)} 8BIT`);
    } else {
      console.log(`💰 Transferring ${fundAmount} 8BIT to airdrop contract...`);
      const tx = await token.transfer(airdropAddress, amountWei);
      await tx.wait();
      console.log("✅ Transfer complete!");
      console.log();

      // Activate the airdrop
      console.log("🔓 Activating airdrop...");
      const activateTx = await airdrop.activate();
      await activateTx.wait();
      console.log("✅ Airdrop activated!");
      console.log();

      // Verify stats
      const stats = await airdrop.getStats();
      console.log("Airdrop Stats:");
      console.log("  Total Allocated:", ethers.formatEther(stats[0]), "8BIT");
      console.log("  Total Claimed:", ethers.formatEther(stats[1]), "8BIT");
      console.log("  Remaining:", ethers.formatEther(stats[2]), "8BIT");
      console.log("  Is Active:", stats[3]);
    }
  }

  console.log();
  console.log("═══════════════════════════════════════════════════");
  console.log("  ✅ AIRDROP DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
