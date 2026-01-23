import { ethers } from "hardhat";

async function main() {
  const staking = await ethers.getContractAt("TieredStaking", "0xC193451f59De0df09EC8359D091F8890A80F20c4");

  console.log("=== TieredStaking Contract Verification ===");
  console.log("Address:", await staking.getAddress());
  console.log("Staking Start Time:", (await staking.stakingStartTime()).toString());
  console.log("Total Raw Staked:", ethers.formatEther(await staking.totalRawStake()));
  console.log("Total Weighted Stake:", ethers.formatEther(await staking.totalWeightedStake()));
  console.log("Rewards Remaining:", ethers.formatEther(await staking.rewardsRemaining()));
  console.log("Total Rewards Distributed:", ethers.formatEther(await staking.totalRewardsDistributed()));
  console.log("Distribution Period:", (await staking.DISTRIBUTION_PERIOD()).toString(), "seconds (5 years)");
  console.log("Min Stake:", ethers.formatEther(await staking.MIN_STAKE_AMOUNT()), "8BIT");
  console.log("Max Stakes Per User:", (await staking.MAX_STAKES_PER_USER()).toString());
  console.log("Early Withdrawal Penalty:", (await staking.EARLY_WITHDRAWAL_PENALTY_BPS()).toString(), "bps (25%)");

  // Check lock tier weights
  console.log("\n=== Lock Tier Weights ===");
  console.log("7 Days:", (await staking.WEIGHT_7_DAYS()).toString(), "(1.0x)");
  console.log("1 Month:", (await staking.WEIGHT_1_MONTH()).toString(), "(1.5x)");
  console.log("3 Months:", (await staking.WEIGHT_3_MONTHS()).toString(), "(2.0x)");
  console.log("6 Months:", (await staking.WEIGHT_6_MONTHS()).toString(), "(3.0x)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
