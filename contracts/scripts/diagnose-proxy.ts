import { ethers } from "hardhat";

/**
 * Diagnose proxy setup - READ ONLY, deploys nothing
 *
 * USAGE:
 *   npx hardhat run scripts/diagnose-proxy.ts --network arbitrumSepolia
 */

const BADGES_PROXY = "0xf70C7814C44D9f93Ab35c77a73f584e114783314";

// ERC-1967 storage slots
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = ethers.provider;

  console.log("═══════════════════════════════════════════════════");
  console.log("  PROXY DIAGNOSTIC (read-only, no deployments)");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Your wallet:", signer.address);
  console.log("Proxy:", BADGES_PROXY);
  console.log();

  // 1. Read ERC-1967 slots
  console.log("── ERC-1967 Storage Slots ──");
  const implSlotData = await provider.getStorage(BADGES_PROXY, IMPL_SLOT);
  const adminSlotData = await provider.getStorage(BADGES_PROXY, ADMIN_SLOT);

  const implAddress = "0x" + implSlotData.slice(26);
  const adminAddress = "0x" + adminSlotData.slice(26);

  console.log("Implementation slot:", implSlotData);
  console.log("  → Implementation address:", implAddress);
  console.log("Admin slot:", adminSlotData);
  console.log("  → Admin address:", adminAddress);
  console.log();

  const isImplZero = implSlotData === "0x" + "0".repeat(64);
  const isAdminZero = adminSlotData === "0x" + "0".repeat(64);

  if (isImplZero) {
    console.log("⚠ Implementation slot is EMPTY - this is NOT a standard ERC-1967 proxy!");
  }
  if (!isAdminZero) {
    console.log("⚠ Admin slot is SET - this might be a Transparent Proxy, not UUPS!");
    console.log("  The ProxyAdmin contract at", adminAddress, "controls upgrades.");
  }
  console.log();

  // 2. Check contract owner via delegatecall
  console.log("── Contract State (via proxy) ──");
  const proxy = new ethers.Contract(BADGES_PROXY, [
    "function owner() view returns (address)",
    "function baseTokenURI() view returns (string)",
    "function nextTokenId() view returns (uint256)"
  ], signer);

  try {
    const owner = await proxy.owner();
    console.log("owner():", owner);
    console.log("  Matches your wallet?", owner.toLowerCase() === signer.address.toLowerCase());
  } catch (e: any) {
    console.log("owner() call failed:", e.message);
  }

  try {
    const baseURI = await proxy.baseTokenURI();
    console.log("baseTokenURI():", baseURI);
  } catch (e: any) {
    console.log("baseTokenURI() call failed:", e.message);
  }

  try {
    const nextId = await proxy.nextTokenId();
    console.log("nextTokenId():", nextId.toString());
  } catch (e: any) {
    console.log("nextTokenId() call failed:", e.message);
  }
  console.log();

  // 3. Check if implementation has proxiableUUID
  if (!isImplZero) {
    console.log("── Implementation Check ──");
    const impl = new ethers.Contract(implAddress, [
      "function proxiableUUID() view returns (bytes32)"
    ], signer);

    try {
      const uuid = await impl.proxiableUUID();
      console.log("proxiableUUID():", uuid);
      const expected = IMPL_SLOT;
      console.log("  Matches ERC-1967 slot?", uuid.toLowerCase() === expected.toLowerCase());
    } catch (e: any) {
      console.log("proxiableUUID() call failed:", e.message);
    }
  }
  console.log();

  // 4. Summary & recommendation
  console.log("── Recommendation ──");
  if (!isAdminZero) {
    console.log("This is a TRANSPARENT PROXY. To upgrade:");
    console.log("  Call upgradeToAndCall on the ProxyAdmin contract at:", adminAddress);
    console.log("  NOT on the proxy directly.");
  } else if (isImplZero) {
    console.log("Implementation slot is empty. The proxy may use a non-standard pattern.");
  } else {
    console.log("This appears to be a standard UUPS proxy.");
    console.log("upgradeToAndCall should work when called by the owner.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
