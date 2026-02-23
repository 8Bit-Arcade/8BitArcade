import { ethers } from "hardhat";

// ═══════════════════════════════════════════════════════════════
//  TOURNAMENT MANAGER TOKEN RECOVERY
//
//  The deploy script incorrectly sent 35M tokens to TournamentManager
//  instead of the correct 20M (4% of supply per tokenomics).
//
//  This script:
//    1. Calls emergencyWithdraw() → pulls all 35M to the owner wallet
//    2. Transfers 20M back to TournamentManager (correct amount)
//    3. Verifies final balances
//
//  Prerequisites:
//    - PRIVATE_KEY in contracts/.env must be the OWNER wallet
//      (0x80361876... — the new safe wallet)
//    - Run: npx hardhat run scripts/recover-tournament-tokens.ts --network arbitrumOne
// ═══════════════════════════════════════════════════════════════

const TOKEN_ADDRESS        = "0x37ee26669659758109c94862e49B492247Be26df";
const TOURNAMENT_MANAGER   = "0xC0ab5FDF6Ef6A4e6bD60f9eD50b1CedB19B9741e";
const EXPECTED_OWNER       = "0x80361876199e2318d6993A07e37177cFd21B64a7";

const CORRECT_PRIZE_POOL   = ethers.parseEther("20000000"); // 20M — correct per tokenomics
const OVERFUNDED_AMOUNT    = ethers.parseEther("35000000"); // 35M — what's actually there

const TOURNAMENT_MANAGER_ABI = [
  "function owner() view returns (address)",
  "function emergencyWithdraw() external",
];

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
];

async function main() {
  const [signer] = await ethers.getSigners();

  console.log("═══════════════════════════════════════════════════════");
  console.log("  TOURNAMENT MANAGER TOKEN RECOVERY");
  console.log("═══════════════════════════════════════════════════════");
  console.log("Signer:            ", signer.address);
  console.log("TournamentManager: ", TOURNAMENT_MANAGER);
  console.log("8BIT Token:        ", TOKEN_ADDRESS);
  console.log();

  // Validate signer
  if (signer.address.toLowerCase() !== EXPECTED_OWNER.toLowerCase()) {
    throw new Error(
      `Wrong signer. Expected ${EXPECTED_OWNER}, got ${signer.address}.\n` +
      `Make sure PRIVATE_KEY in contracts/.env is the owner wallet.`
    );
  }

  const tournamentManager = new ethers.Contract(TOURNAMENT_MANAGER, TOURNAMENT_MANAGER_ABI, signer);
  const token = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, signer);

  // Confirm on-chain owner matches
  const onChainOwner: string = await tournamentManager.owner();
  if (onChainOwner.toLowerCase() !== signer.address.toLowerCase()) {
    throw new Error(`On-chain owner is ${onChainOwner}, not this signer. Was transferOwnership run?`);
  }

  // Check current balances
  const tmBalanceBefore  = await token.balanceOf(TOURNAMENT_MANAGER);
  const ownerBalanceBefore = await token.balanceOf(signer.address);

  console.log("─── Current balances ───────────────────────────────────");
  console.log("TournamentManager: ", ethers.formatEther(tmBalanceBefore), "8BIT");
  console.log("Owner wallet:      ", ethers.formatEther(ownerBalanceBefore), "8BIT");
  console.log();

  if (tmBalanceBefore !== OVERFUNDED_AMOUNT) {
    console.warn(
      `⚠️  TournamentManager balance is ${ethers.formatEther(tmBalanceBefore)} 8BIT, ` +
      `expected ${ethers.formatEther(OVERFUNDED_AMOUNT)}. Proceeding anyway.`
    );
  }

  // Step 1: Pull all tokens out via emergencyWithdraw
  console.log("Step 1: Calling emergencyWithdraw() on TournamentManager...");
  const withdrawTx = await tournamentManager.emergencyWithdraw();
  process.stdout.write(`  tx: ${withdrawTx.hash}  `);
  await withdrawTx.wait();
  console.log("✅");
  console.log();

  const ownerBalanceAfterWithdraw = await token.balanceOf(signer.address);
  console.log("Owner wallet after withdraw:", ethers.formatEther(ownerBalanceAfterWithdraw), "8BIT");
  console.log();

  // Step 2: Send the correct 20M back to TournamentManager
  console.log(`Step 2: Sending ${ethers.formatEther(CORRECT_PRIZE_POOL)} 8BIT back to TournamentManager...`);
  const refundTx = await token.transfer(TOURNAMENT_MANAGER, CORRECT_PRIZE_POOL);
  process.stdout.write(`  tx: ${refundTx.hash}  `);
  await refundTx.wait();
  console.log("✅");
  console.log();

  // Step 3: Verify final balances
  const tmBalanceAfter    = await token.balanceOf(TOURNAMENT_MANAGER);
  const ownerBalanceAfter = await token.balanceOf(signer.address);
  const recovered         = ownerBalanceAfter - ownerBalanceBefore;

  console.log("─── Final balances ─────────────────────────────────────");
  console.log("TournamentManager: ", ethers.formatEther(tmBalanceAfter),    "8BIT",
    tmBalanceAfter === CORRECT_PRIZE_POOL ? "✅" : "❌");
  console.log("Owner wallet:      ", ethers.formatEther(ownerBalanceAfter), "8BIT");
  console.log("Net recovered:     ", ethers.formatEther(recovered),         "8BIT",
    recovered === ethers.parseEther("15000000") ? "✅ (15M as expected)" : "⚠️  check this");
  console.log();

  if (tmBalanceAfter !== CORRECT_PRIZE_POOL) {
    throw new Error("TournamentManager balance is not 20M after recovery — check manually.");
  }

  console.log("✅ Recovery complete. TournamentManager now holds exactly 20M 8BIT.");
  console.log("   Owner wallet recovered 15M 8BIT for liquidity/marketing/team use.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ FAILED:", err.message);
    process.exit(1);
  });
