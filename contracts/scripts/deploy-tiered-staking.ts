import { ethers, network } from "hardhat";

/**
 * TieredStaking Deployment Script
 *
 * Deploys the TieredStaking contract and funds it with 25M 8BIT tokens
 *
 * BEFORE DEPLOYMENT:
 * 1. Ensure contracts/.env has PRIVATE_KEY and ETHERSCAN_API_KEY
 * 2. Ensure deployer wallet has:
 *    - Some ETH for gas
 *    - At least 25M 8BIT tokens to fund the staking pool
 * 3. Update TOKEN_ADDRESS below with your deployed 8BIT token address
 *
 * USAGE:
 *   npx hardhat run scripts/deploy-tiered-staking.ts --network arbitrumSepolia
 *   npx hardhat run scripts/deploy-tiered-staking.ts --network arbitrumOne
 */

// ═══════════════════════════════════════════════════════════════════
// UPDATE THIS ADDRESS BEFORE DEPLOYMENT
// ═══════════════════════════════════════════════════════════════════
const TOKEN_ADDRESSES: Record<string, string> = {
  arbitrumSepolia: "0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d", // Testnet 8BIT
  arbitrumOne: "0x0000000000000000000000000000000000000000",     // TODO: Add mainnet address
};

const STAKING_POOL_AMOUNT = ethers.parseEther("25000000"); // 25M 8BIT

async function main() {
  const [deployer] = await ethers.getSigners();
  const networkName = network.name;

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  TIERED STAKING CONTRACT DEPLOYMENT");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  console.log("Network:", networkName);
  console.log("Deployer:", deployer.address);
  console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  console.log();

  // Get token address for this network
  const tokenAddress = TOKEN_ADDRESSES[networkName];
  if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(`Token address not configured for network: ${networkName}`);
  }
  console.log("8BIT Token:", tokenAddress);
  console.log();

  // Check deployer's token balance
  const token = await ethers.getContractAt("IERC20", tokenAddress);
  const deployerTokenBalance = await token.balanceOf(deployer.address);
  console.log("Deployer 8BIT Balance:", ethers.formatEther(deployerTokenBalance), "8BIT");

  if (deployerTokenBalance < STAKING_POOL_AMOUNT) {
    throw new Error(
      `Insufficient 8BIT balance. Need ${ethers.formatEther(STAKING_POOL_AMOUNT)} 8BIT, ` +
      `have ${ethers.formatEther(deployerTokenBalance)} 8BIT`
    );
  }
  console.log("✅ Sufficient balance for staking pool");
  console.log();

  // Deploy TieredStaking
  console.log("📝 Deploying TieredStaking...");
  const TieredStaking = await ethers.getContractFactory("TieredStaking");
  const staking = await TieredStaking.deploy(tokenAddress);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log("✅ TieredStaking deployed to:", stakingAddress);
  console.log();

  // Fund the staking contract with 25M tokens
  console.log("💰 Funding TieredStaking with 25M 8BIT...");
  const fundTx = await token.transfer(stakingAddress, STAKING_POOL_AMOUNT);
  await fundTx.wait();
  console.log("✅ TieredStaking funded with", ethers.formatEther(STAKING_POOL_AMOUNT), "8BIT");
  console.log();

  // Verify the funding
  const stakingBalance = await token.balanceOf(stakingAddress);
  console.log("Staking Contract Balance:", ethers.formatEther(stakingBalance), "8BIT");
  console.log();

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  console.log("TieredStaking Address:", stakingAddress);
  console.log();
  console.log("NEXT STEPS:");
  console.log("1. Verify the contract on Arbiscan:");
  console.log(`   npx hardhat verify --network ${networkName} ${stakingAddress} ${tokenAddress}`);
  console.log();
  console.log("2. Update frontend/src/config/contracts.ts:");
  console.log(`   TIERED_STAKING: '${stakingAddress}',`);
  console.log();
  console.log("3. Update sale-site/staking.html with the contract address");
  console.log();

  return stakingAddress;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
