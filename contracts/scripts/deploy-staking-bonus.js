/**
 * Deploy StakingBonus Contract
 *
 * This contract provides bonus rewards to stakers who win daily leaderboard.
 * Works alongside existing GameRewards - does NOT replace it.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-staking-bonus.js --network arbitrumSepolia
 *
 * After deployment:
 * 1. Call setBonusDistributor(REWARDS_WALLET) on StakingBonus
 * 2. Call setAuthorizedMinter(STAKING_BONUS_ADDRESS, true) on EightBitToken
 * 3. Update STAKING_BONUS_ADDRESS in functions/src/config.ts
 * 4. Redeploy Firebase functions
 */

const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying StakingBonus with account:", deployer.address);

  // Get network
  const network = hre.network.name;
  console.log("Network:", network);

  // Token address - UPDATE THESE FOR YOUR NETWORK
  const TOKEN_ADDRESS = network === "arbitrumSepolia"
    ? "0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d"  // Arbitrum Sepolia
    : "0x0000000000000000000000000000000000000000"; // Mainnet - UPDATE

  const REWARDS_DISTRIBUTOR = "0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B"; // Same as GameRewards

  console.log("Token address:", TOKEN_ADDRESS);
  console.log("Rewards distributor:", REWARDS_DISTRIBUTOR);

  // Deploy StakingBonus
  console.log("\nDeploying StakingBonus...");
  const StakingBonus = await hre.ethers.getContractFactory("StakingBonus");
  const stakingBonus = await StakingBonus.deploy(TOKEN_ADDRESS);
  await stakingBonus.waitForDeployment();

  const stakingBonusAddress = await stakingBonus.getAddress();
  console.log("✅ StakingBonus deployed to:", stakingBonusAddress);

  // Set bonus distributor
  console.log("\nSetting bonus distributor...");
  const tx = await stakingBonus.setBonusDistributor(REWARDS_DISTRIBUTOR);
  await tx.wait();
  console.log("✅ Bonus distributor set to:", REWARDS_DISTRIBUTOR);

  // Log tier configuration
  const [thresholds, bonuses] = await stakingBonus.getTierConfig();
  console.log("\n📊 Tier Configuration:");
  console.log("  Tier 1:", hre.ethers.formatEther(thresholds[0]), "tokens →", Number(bonuses[0]) / 100, "% bonus");
  console.log("  Tier 2:", hre.ethers.formatEther(thresholds[1]), "tokens →", Number(bonuses[1]) / 100, "% bonus");
  console.log("  Tier 3:", hre.ethers.formatEther(thresholds[2]), "tokens →", Number(bonuses[2]) / 100, "% bonus");

  console.log("\n" + "=".repeat(60));
  console.log("DEPLOYMENT COMPLETE");
  console.log("=".repeat(60));
  console.log("\nStakingBonus Address:", stakingBonusAddress);
  console.log("\n⚠️  NEXT STEPS:");
  console.log("1. Authorize minting on token contract:");
  console.log(`   EightBitToken.setAuthorizedMinter("${stakingBonusAddress}", true)`);
  console.log("\n2. Update functions/src/config.ts:");
  console.log(`   STAKING_BONUS_ADDRESS = '${stakingBonusAddress}'`);
  console.log("\n3. Merge to main and redeploy Firebase functions");
  console.log("=".repeat(60));

  // Verify contract on Arbiscan (if not localhost)
  if (network !== "hardhat" && network !== "localhost") {
    console.log("\n⏳ Waiting 30s before verification...");
    await new Promise(r => setTimeout(r, 30000));

    try {
      await hre.run("verify:verify", {
        address: stakingBonusAddress,
        constructorArguments: [TOKEN_ADDRESS],
      });
      console.log("✅ Contract verified on Arbiscan");
    } catch (error) {
      console.log("⚠️  Verification failed (you can verify manually later):", error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
