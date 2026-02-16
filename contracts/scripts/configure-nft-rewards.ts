import { ethers } from "hardhat";

/**
 * Post-Deployment Configuration for NFT Rewards System
 *
 * Run AFTER deploy-nft-rewards.ts to complete the remaining setup steps:
 * 1. Authorize AchievementManager as minter on EightBitToken
 * 2. Set backend wallet as authorized verifier on AchievementManager
 *
 * PREREQUISITES:
 * - NFT Rewards contracts already deployed (run deploy-nft-rewards.ts first)
 * - Update addresses below with your deployed contract addresses
 *
 * USAGE:
 *   npx hardhat run scripts/configure-nft-rewards.ts --network arbitrumSepolia
 */

// ═══════════════════════════════════════════════════════════
// UPDATE THESE WITH YOUR DEPLOYED ADDRESSES
// ═══════════════════════════════════════════════════════════
const EIGHT_BIT_TOKEN_ADDRESS = "0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d";
const ACHIEVEMENT_MANAGER_ADDRESS = "0xcD7b55b846b5FC306ab1B4D2f30FBd3073315e84";

// Backend wallet that will verify achievements and call awardAchievement()
// Set this to your Firebase Functions / backend wallet address
const BACKEND_VERIFIER_WALLET = "0x3879aA591532B8a7BCe322Edff8fD09F7FB5dC9B";

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════");
  console.log("  NFT REWARDS - POST-DEPLOYMENT CONFIGURATION");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("Deployer:", deployer.address);
  console.log();

  // ─── 1. Authorize AchievementManager as minter on EightBitToken ───
  console.log("Step 1: Authorizing AchievementManager as minter on EightBitToken...");
  console.log("  Token:", EIGHT_BIT_TOKEN_ADDRESS);
  console.log("  Minter:", ACHIEVEMENT_MANAGER_ADDRESS);

  const token = await ethers.getContractAt(
    ["function setAuthorizedMinter(address minter, bool authorized) external"],
    EIGHT_BIT_TOKEN_ADDRESS
  );

  try {
    const tx1 = await token.setAuthorizedMinter(ACHIEVEMENT_MANAGER_ADDRESS, true);
    await tx1.wait();
    console.log("  ✓ AchievementManager authorized as minter on EightBitToken");
  } catch (error: any) {
    console.log("  ✗ Failed:", error.reason || error.message);
    console.log("  (You may need to call this manually from the token owner wallet)");
  }
  console.log();

  // ─── 2. Set backend wallet as authorized verifier ───
  console.log("Step 2: Setting backend wallet as authorized verifier...");
  console.log("  Manager:", ACHIEVEMENT_MANAGER_ADDRESS);
  console.log("  Verifier:", BACKEND_VERIFIER_WALLET);

  const manager = await ethers.getContractAt(
    ["function setAuthorizedVerifier(address verifier, bool authorized) external"],
    ACHIEVEMENT_MANAGER_ADDRESS
  );

  try {
    const tx2 = await manager.setAuthorizedVerifier(BACKEND_VERIFIER_WALLET, true);
    await tx2.wait();
    console.log("  ✓ Backend wallet authorized as verifier");
  } catch (error: any) {
    console.log("  ✗ Failed:", error.reason || error.message);
  }
  console.log();

  // ─── Summary ───
  console.log("═══════════════════════════════════════════════════");
  console.log("  CONFIGURATION COMPLETE");
  console.log("═══════════════════════════════════════════════════");
  console.log();
  console.log("REMAINING MANUAL STEPS:");
  console.log("───────────────────────────────────────────────────");
  console.log("1. Upload badge metadata JSON files to IPFS (Pinata)");
  console.log("   - Create JSON files 1.json through 20.json");
  console.log("   - Each JSON should have: name, description, image, attributes");
  console.log("   - Upload the folder to Pinata and get the CID");
  console.log();
  console.log("2. Set the base URI on AchievementBadges:");
  console.log('   badges.setBaseTokenURI("ipfs://YOUR_METADATA_CID/")');
  console.log();
  console.log("3. Set the base URI on AchievementManager:");
  console.log('   manager.setBadgeMetadataBaseURI("ipfs://YOUR_METADATA_CID/")');
  console.log();
  console.log("4. Deploy updated Firebase functions:");
  console.log("   cd functions && firebase deploy --only functions");
  console.log();
  console.log("5. Verify contracts on Arbiscan:");
  console.log("   npx hardhat verify --network arbitrumSepolia <IMPLEMENTATION_ADDRESS>");
  console.log("═══════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
