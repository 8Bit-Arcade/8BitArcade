import { ethers, run } from "hardhat";

/**
 * Verify UUPS proxy contracts on Arbiscan
 *
 * Reads the implementation address from each proxy's EIP-1967 storage slot,
 * then verifies the implementation contract source code.
 *
 * USAGE:
 *   npx hardhat run scripts/verify-proxies.ts --network arbitrumSepolia
 */

// EIP-1967 implementation slot
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const PROXIES = [
  { name: "AchievementBadges", proxy: "0xf70C7814C44D9f93Ab35c77a73f584e114783314", contract: "contracts/AchievementBadges.sol:AchievementBadges" },
  { name: "TradeableItems", proxy: "0x3F09919fba62EAec1295F577D92fbF2555247c44", contract: "contracts/TradeableItems.sol:TradeableItems" },
  { name: "AchievementManager", proxy: "0xcD7b55b846b5FC306ab1B4D2f30FBd3073315e84", contract: "contracts/AchievementManager.sol:AchievementManager" },
];

async function main() {
  for (const { name, proxy, contract } of PROXIES) {
    console.log(`\n═══ ${name} ═══`);
    console.log(`Proxy: ${proxy}`);

    // Read implementation address from EIP-1967 slot
    const implSlotValue = await ethers.provider.getStorage(proxy, IMPL_SLOT);
    const implAddress = "0x" + implSlotValue.slice(26); // Extract address from 32-byte slot
    console.log(`Implementation: ${implAddress}`);

    // Verify implementation
    try {
      await run("verify:verify", {
        address: implAddress,
        constructorArguments: [],
        contract: contract,
      });
      console.log(`${name} implementation verified!`);
    } catch (err: any) {
      if (err.message.includes("Already Verified")) {
        console.log(`${name} implementation already verified.`);
      } else {
        console.error(`${name} verification failed:`, err.message);
      }
    }
  }

  console.log("\n═══ Done ═══");
  console.log("If implementations verified, Arbiscan should auto-detect proxies.");
  console.log("If not, manually mark as proxy on Arbiscan:");
  console.log("  Contract > More Options > Is this a proxy? > Verify");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
