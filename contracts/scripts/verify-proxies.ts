import { run } from "hardhat";

/**
 * Verify all 3 NFT contracts on Arbiscan
 *
 * USAGE:
 *   npx hardhat clean
 *   npx hardhat compile --force
 *   npx hardhat run scripts/verify-proxies.ts --network arbitrumSepolia
 */

const CONTRACTS = [
  { name: "AchievementBadges", address: "0x8dE45E3e37f0721D64d63E32da5f37CfaCF9ca9f", contract: "contracts/AchievementBadges.sol:AchievementBadges" },
  { name: "TradeableItems", address: "0x3F09919fba62EAec1295F577D92fbF2555247c44", contract: "contracts/TradeableItems.sol:TradeableItems" },
  { name: "AchievementManager", address: "0xE68d3AdD44C541fF76C85D185d02BE5ceAC833B3", contract: "contracts/AchievementManager.sol:AchievementManager" },
];

async function main() {
  for (const { name, address, contract } of CONTRACTS) {
    console.log(`\n═══ Verifying ${name} at ${address} ═══`);
    try {
      await run("verify:verify", {
        address,
        constructorArguments: [],
        contract,
      });
      console.log(`${name} VERIFIED!`);
    } catch (err: any) {
      if (err.message.includes("Already Verified") || err.message.includes("already verified")) {
        console.log(`${name} already verified.`);
      } else {
        console.log(`${name} FAILED: ${err.message}`);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
