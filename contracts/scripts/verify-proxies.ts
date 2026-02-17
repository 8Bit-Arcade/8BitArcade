import { ethers, upgrades, run } from "hardhat";

/**
 * Verify UUPS proxy contracts on Arbiscan
 *
 * Uses @openzeppelin/hardhat-upgrades to read implementation addresses,
 * then verifies the implementation contract source code.
 *
 * USAGE:
 *   npx hardhat run scripts/verify-proxies.ts --network arbitrumSepolia
 */

const PROXIES = [
  { name: "AchievementBadges", proxy: "0xf70C7814C44D9f93Ab35c77a73f584e114783314", contract: "contracts/AchievementBadges.sol:AchievementBadges" },
  { name: "TradeableItems", proxy: "0x3F09919fba62EAec1295F577D92fbF2555247c44", contract: "contracts/TradeableItems.sol:TradeableItems" },
  { name: "AchievementManager", proxy: "0xcD7b55b846b5FC306ab1B4D2f30FBd3073315e84", contract: "contracts/AchievementManager.sol:AchievementManager" },
];

// EIP-1967 implementation slot
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function getImplAddress(proxyAddress: string): Promise<string> {
  // Try OpenZeppelin helper first
  try {
    const addr = await upgrades.erc1967.getImplementationAddress(proxyAddress);
    return addr;
  } catch {
    // Fallback: raw storage read
    const raw = await ethers.provider.getStorage(proxyAddress, IMPL_SLOT);
    console.log(`  Raw storage slot value: ${raw}`);
    const addr = ethers.getAddress("0x" + raw.slice(26));
    return addr;
  }
}

async function main() {
  // First, check if the proxies have code at all
  for (const { name, proxy } of PROXIES) {
    const code = await ethers.provider.getCode(proxy);
    console.log(`${name} (${proxy}): ${code.length > 2 ? "HAS CODE" : "NO CODE"} (${code.length} bytes)`);
  }
  console.log();

  for (const { name, proxy, contract } of PROXIES) {
    console.log(`═══ ${name} ═══`);
    console.log(`Proxy: ${proxy}`);

    const implAddress = await getImplAddress(proxy);
    console.log(`Implementation: ${implAddress}`);

    if (implAddress === ethers.ZeroAddress) {
      console.log(`  SKIPPED - no implementation found. Is this address correct?`);
      continue;
    }

    // Verify implementation
    try {
      await run("verify:verify", {
        address: implAddress,
        constructorArguments: [],
        contract: contract,
      });
      console.log(`${name} implementation verified!`);
    } catch (err: any) {
      if (err.message.includes("Already Verified") || err.message.includes("already verified")) {
        console.log(`${name} implementation already verified.`);
      } else {
        console.error(`${name} verification failed:`, err.message);
      }
    }
    console.log();
  }

  console.log("═══ Done ═══");
  console.log("After verification, mark each as proxy on Arbiscan:");
  console.log("  Contract > More Options > Is this a proxy? > Verify");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
