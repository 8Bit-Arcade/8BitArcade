import { ethers } from "hardhat";

async function main() {
  const stakingAddress = '0xC193451f59De0df09EC8359D091F8890A80F20c4';

  console.log("Connecting to TieredStaking at:", stakingAddress);
  const staking = await ethers.getContractAt("TieredStaking", stakingAddress);

  // Check if already started
  const startTime = await staking.stakingStartTime();
  if (startTime > 0n) {
    console.log("Staking already started at:", new Date(Number(startTime) * 1000).toISOString());
    return;
  }

  console.log("Starting staking...");
  const tx = await staking.startStaking();
  console.log("TX sent:", tx.hash);
  await tx.wait();
  console.log("Staking started successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
