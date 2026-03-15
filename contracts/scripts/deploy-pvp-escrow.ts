import { ethers, network, run } from "hardhat";

/**
 * PvPEscrow Deployment Script
 *
 * Deploys the PvPEscrow contract to Arbitrum Sepolia (testnet only).
 * The contract holds bet tokens in escrow during PvP matches and splits
 * the pot 95% winner / 2.5% burn / 2.5% tournament pool on resolution.
 *
 * BEFORE DEPLOYMENT:
 * 1. Ensure contracts/.env has:
 *    - PRIVATE_KEY      — deployer wallet private key (must have ETH for gas)
 *    - ETHERSCAN_API_KEY — Arbitrum/Etherscan API key for verification
 * 2. Set RESOLVER_ADDRESS below to your Firebase Admin wallet address.
 *    This is the wallet that calls resolveMatch() from Cloud Functions.
 *
 * USAGE:
 *   npx hardhat run scripts/deploy-pvp-escrow.ts --network arbitrumSepolia
 *
 * AFTER DEPLOYMENT:
 *   Update frontend/src/config/contracts.ts → PVP_ESCROW with the new address.
 */

// ═══════════════════════════════════════════════════════════════════
// CONFIGURE BEFORE DEPLOYMENT
// ═══════════════════════════════════════════════════════════════════

const CONFIG = {
  arbitrumSepolia: {
    // Testnet 8BIT token
    token: "0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d",
    // Tournament Manager contract — receives 2.5% pool contribution per match
    tournamentPool: "0xe06C92f15F426b0f6Fccb66302790E533C5Dfbb7",
    // Firebase Admin wallet that calls resolveMatch() from Cloud Functions
    // ⚠️  UPDATE THIS to your actual resolver/admin wallet address
    resolver: process.env.RESOLVER_ADDRESS || "0x0000000000000000000000000000000000000000",
  },
} as const;

// How many block confirmations to wait before attempting Arbiscan verification
const CONFIRMATIONS = 3;

// ═══════════════════════════════════════════════════════════════════

async function main() {
  const networkName = network.name;

  if (networkName !== "arbitrumSepolia") {
    throw new Error(
      `❌  This script is testnet-only.\n` +
      `   You are connected to: ${networkName}\n` +
      `   Run with: --network arbitrumSepolia`
    );
  }

  const cfg = CONFIG[networkName];

  const [deployer] = await ethers.getSigners();
  const ethBalance = await ethers.provider.getBalance(deployer.address);

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PvPEscrow CONTRACT DEPLOYMENT — Arbitrum Sepolia");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  console.log("Network      :", networkName, "(chain ID 421614)");
  console.log("Deployer     :", deployer.address);
  console.log("ETH Balance  :", ethers.formatEther(ethBalance), "ETH");
  console.log();
  console.log("Constructor arguments:");
  console.log("  _token          :", cfg.token);
  console.log("  _tournamentPool :", cfg.tournamentPool);
  console.log("  _resolver       :", cfg.resolver);
  console.log();

  // Guard: refuse to deploy if resolver is still the zero address
  if (cfg.resolver === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      "❌  RESOLVER_ADDRESS is not set.\n" +
      "   Set it in your .env file:\n" +
      "     RESOLVER_ADDRESS=0xYourFirebaseAdminWalletAddress\n" +
      "   This should be the wallet that calls resolveMatch() from Cloud Functions."
    );
  }

  // Guard: warn if ETH balance is very low
  if (ethBalance < ethers.parseEther("0.001")) {
    throw new Error(
      `❌  Deployer ETH balance is too low (${ethers.formatEther(ethBalance)} ETH).\n` +
      "   Fund the deployer wallet with testnet ETH from:\n" +
      "   https://www.alchemy.com/faucets/arbitrum-sepolia"
    );
  }

  // ── Deploy ──────────────────────────────────────────────────────
  console.log("📝 Deploying PvPEscrow...");
  const PvPEscrow = await ethers.getContractFactory("PvPEscrow");
  const escrow = await PvPEscrow.deploy(
    cfg.token,
    cfg.tournamentPool,
    cfg.resolver,
  );

  console.log("   Transaction hash:", escrow.deploymentTransaction()?.hash);
  console.log(`   Waiting for ${CONFIRMATIONS} confirmations...`);
  await escrow.deploymentTransaction()?.wait(CONFIRMATIONS);

  const escrowAddress = await escrow.getAddress();
  console.log("✅ PvPEscrow deployed to:", escrowAddress);
  console.log();

  // ── Sanity-check the deployed values ───────────────────────────
  console.log("🔍 Verifying on-chain constructor values...");
  const deployedToken    = await escrow.eightBitToken();
  const deployedPool     = await escrow.tournamentPool();
  const deployedResolver = await escrow.resolver();
  const deployedOwner    = await escrow.owner();

  console.log("   eightBitToken   :", deployedToken,
    deployedToken.toLowerCase() === cfg.token.toLowerCase() ? "✅" : "❌ MISMATCH");
  console.log("   tournamentPool  :", deployedPool,
    deployedPool.toLowerCase() === cfg.tournamentPool.toLowerCase() ? "✅" : "❌ MISMATCH");
  console.log("   resolver        :", deployedResolver,
    deployedResolver.toLowerCase() === cfg.resolver.toLowerCase() ? "✅" : "❌ MISMATCH");
  console.log("   owner           :", deployedOwner, "(deployer)");
  console.log();

  // ── Arbiscan verification ───────────────────────────────────────
  console.log("🔎 Submitting source code to Arbiscan for verification...");
  try {
    await run("verify:verify", {
      address: escrowAddress,
      constructorArguments: [cfg.token, cfg.tournamentPool, cfg.resolver],
    });
    console.log("✅ Contract verified on Arbiscan.");
  } catch (err: any) {
    // "Already Verified" is not a real error — everything else is worth surfacing
    if (err?.message?.toLowerCase().includes("already verified")) {
      console.log("ℹ️  Contract was already verified on Arbiscan.");
    } else {
      console.warn("⚠️  Verification failed — you can retry manually (see NEXT STEPS below).");
      console.warn("   Reason:", err?.message ?? err);
    }
  }
  console.log();

  // ── Summary ─────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  DEPLOYMENT COMPLETE");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();
  console.log("PvPEscrow address:", escrowAddress);
  console.log();
  console.log("NEXT STEPS:");
  console.log();
  console.log("1. Update frontend/src/config/contracts.ts:");
  console.log(`       PVP_ESCROW: '${escrowAddress}',`);
  console.log();
  console.log("2. Update functions/ resolver wallet in Firebase config");
  console.log("   (the Cloud Function that calls resolveMatch must use the");
  console.log("   same wallet as the resolver address above).");
  console.log();
  console.log("3. If Arbiscan verification failed, retry manually:");
  console.log(`   npx hardhat verify --network arbitrumSepolia \\`);
  console.log(`     ${escrowAddress} \\`);
  console.log(`     ${cfg.token} \\`);
  console.log(`     ${cfg.tournamentPool} \\`);
  console.log(`     ${cfg.resolver}`);
  console.log();
  console.log("4. View on Arbiscan:");
  console.log(`   https://sepolia.arbiscan.io/address/${escrowAddress}`);
  console.log();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n" + error.message);
    process.exit(1);
  });
