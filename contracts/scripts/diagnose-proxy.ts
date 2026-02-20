import { ethers } from "hardhat";

/**
 * Diagnose proxy setup - READ ONLY, deploys nothing
 *
 * IMPORTANT: Run with the deployer wallet (0x8FAF) in .env
 *
 * USAGE:
 *   npx hardhat run scripts/diagnose-proxy.ts --network arbitrumSepolia
 */

const BADGES_PROXY = "0xf70C7814C44D9f93Ab35c77a73f584e114783314";

// Already-deployed implementations (no need to redeploy)
const IMPL_CANDIDATE = "0x340809FBB22C32a6a4D73E10102a760B7a5e4444";

// ERC-1967 storage slots
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";
const BEACON_SLOT = "0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50";

async function main() {
  const [signer] = await ethers.getSigners();
  const provider = ethers.provider;

  console.log("═══════════════════════════════════════════════════");
  console.log("  PROXY DIAGNOSTIC v2 (read-only, no deployments)");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Your wallet:", signer.address);
  console.log("Target:", BADGES_PROXY);
  console.log();

  // ── 1. Bytecode size ──
  console.log("── Bytecode Check ──");
  const code = await provider.getCode(BADGES_PROXY);
  console.log("Bytecode length:", code.length / 2 - 1, "bytes");
  if (code.length / 2 - 1 < 500) {
    console.log("  → SMALL bytecode = likely a proxy contract");
  } else {
    console.log("  → LARGE bytecode = likely deployed directly (NOT a proxy)");
  }
  console.log();

  // ── 2. Read all ERC-1967 slots ──
  console.log("── ERC-1967 Storage Slots ──");
  const implSlotData = await provider.getStorage(BADGES_PROXY, IMPL_SLOT);
  const adminSlotData = await provider.getStorage(BADGES_PROXY, ADMIN_SLOT);
  const beaconSlotData = await provider.getStorage(BADGES_PROXY, BEACON_SLOT);

  const implAddr = "0x" + implSlotData.slice(26);
  const adminAddr = "0x" + adminSlotData.slice(26);
  const beaconAddr = "0x" + beaconSlotData.slice(26);

  console.log("Implementation:", implAddr, implSlotData === "0x" + "0".repeat(64) ? "(EMPTY)" : "");
  console.log("Admin:", adminAddr, adminSlotData === "0x" + "0".repeat(64) ? "(EMPTY)" : "");
  console.log("Beacon:", beaconAddr, beaconSlotData === "0x" + "0".repeat(64) ? "(EMPTY)" : "");
  console.log();

  // ── 3. Contract state ──
  console.log("── Contract State ──");
  const proxy = new ethers.Contract(BADGES_PROXY, [
    "function owner() view returns (address)",
    "function baseTokenURI() view returns (string)",
    "function nextTokenId() view returns (uint256)",
    "function tokenURI(uint256 tokenId) view returns (string)",
    "function tokenAchievementType(uint256 tokenId) view returns (uint256)"
  ], signer);

  try { console.log("owner():", await proxy.owner()); } catch (e: any) { console.log("owner() failed:", e.message); }
  try { console.log("baseTokenURI():", await proxy.baseTokenURI()); } catch (e: any) { console.log("baseTokenURI() failed:", e.message); }
  try { console.log("nextTokenId():", (await proxy.nextTokenId()).toString()); } catch (e: any) { console.log("nextTokenId() failed:", e.message); }

  // Check a couple of actual token URIs
  try {
    const uri1 = await proxy.tokenURI(1);
    const type1 = await proxy.tokenAchievementType(1);
    console.log("tokenURI(1):", uri1);
    console.log("  achievementTypeId:", type1.toString());
  } catch (e: any) { console.log("tokenURI(1) failed:", e.message); }

  try {
    const uri2 = await proxy.tokenURI(2);
    const type2 = await proxy.tokenAchievementType(2);
    console.log("tokenURI(2):", uri2);
    console.log("  achievementTypeId:", type2.toString());
  } catch (e: any) { console.log("tokenURI(2) failed:", e.message); }
  console.log();

  // ── 4. Try upgrade via staticCall to get exact revert reason ──
  console.log("── Upgrade Simulation (staticCall, no gas spent) ──");
  const upgradeProxy = new ethers.Contract(BADGES_PROXY, [
    "function upgradeToAndCall(address, bytes) external"
  ], signer);

  try {
    await upgradeProxy.upgradeToAndCall.staticCall(IMPL_CANDIDATE, "0x");
    console.log("✓ upgradeToAndCall would SUCCEED");
  } catch (e: any) {
    console.log("✗ upgradeToAndCall would REVERT");
    if (e.data) {
      console.log("  Revert data:", e.data);
      // Try to decode common errors
      try {
        const iface = new ethers.Interface([
          "error OwnableUnauthorizedAccount(address account)",
          "error UUPSUnexpectedCallContext()",
          "error ERC1967InvalidImplementation(address implementation)"
        ]);
        const decoded = iface.parseError(e.data);
        if (decoded) {
          console.log("  Decoded error:", decoded.name, decoded.args);
        }
      } catch {}
    }
    if (e.reason) console.log("  Reason:", e.reason);
    if (e.message) {
      // Extract just the useful part
      const match = e.message.match(/reason="([^"]+)"/);
      if (match) console.log("  Reason string:", match[1]);
    }
  }
  console.log();

  // ── 5. Check proxiableUUID on the contract itself ──
  console.log("── proxiableUUID Check ──");
  const selfCheck = new ethers.Contract(BADGES_PROXY, [
    "function proxiableUUID() view returns (bytes32)"
  ], signer);
  try {
    const uuid = await selfCheck.proxiableUUID();
    console.log("proxiableUUID() on proxy:", uuid);
    console.log("  (If this returns a value, the contract IS a proxy via delegatecall)");
  } catch (e: any) {
    const match = e.message?.match(/reason="([^"]+)"/);
    console.log("proxiableUUID() failed:", match ? match[1] : e.message?.slice(0, 200));
    console.log("  (If 'UUPSUnexpectedCallContext', this IS NOT a proxy - it's the implementation itself)");
  }
  console.log();

  // ── Summary ──
  console.log("═══════════════════════════════════════════════════");
  console.log("  DIAGNOSIS SUMMARY");
  console.log("═══════════════════════════════════════════════════");
  const isProxy = code.length / 2 - 1 < 500;
  if (isProxy) {
    console.log("Contract appears to be a PROXY (small bytecode).");
    console.log("But ERC-1967 implementation slot is empty.");
    console.log("It may use a non-standard storage pattern.");
  } else {
    console.log("Contract appears to be DEPLOYED DIRECTLY (large bytecode).");
    console.log("This is NOT a proxy - it cannot be upgraded.");
    console.log();
    console.log("WORKAROUND OPTIONS:");
    console.log("1. Set baseTokenURI to '' (empty) so tokenURI returns per-token stored URIs");
    console.log("2. Deploy a NEW proxy-based AchievementBadges and update AchievementManager");
    console.log("3. Fix metadata at the IPFS level (update JSONs, re-pin under same structure)");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
