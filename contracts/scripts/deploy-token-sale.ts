import { ethers, network } from "hardhat";

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION  ← Edit before running
// ═══════════════════════════════════════════════════════════════

const CONFIG = {
  // ── Existing 8BIT token address (already deployed, DO NOT redeploy) ──
  // Testnet:  0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d
  // Mainnet:  set this after full mainnet deploy, or run deploy.ts for fresh start
  TOKEN_ADDRESS: {
    arbitrumSepolia: "0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d",
    arbitrumOne:     "",   // ← fill in after mainnet EightBitToken is deployed
  },

  // ── USDC addresses (do not change) ────────────────────────────────────
  USDC_ADDRESS: {
    arbitrumSepolia: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
    arbitrumOne:     "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  },

  // ── Sale start time ────────────────────────────────────────────────────
  //  0           → starts immediately at deployment
  //  unix ts     → scheduled start  (e.g. 1700000000)
  //
  //  To get a unix timestamp for a future date:
  //    Math.floor(new Date("2025-04-01T18:00:00Z").getTime() / 1000)
  SALE_START_TIME: 0,

  // ── Tokens to send to the new contract ────────────────────────────────
  //  This is taken from the deployer wallet.
  //  The deployer must hold at least this many 8BIT tokens.
  TOKENS_FOR_SALE: "200000000", // 200M

  // ── (Optional) Old TokenSale to recover tokens from before redeploying ─
  //  Leave empty to skip recovery.
  //  Only works if the old contract is finalized (saleFinalized = true).
  //  Call finalizeSale() on the old contract manually if needed first.
  OLD_SALE_ADDRESS: "",
};

// ═══════════════════════════════════════════════════════════════

const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

const OLD_SALE_ABI = [
  "function saleFinalized() view returns (bool)",
  "function emergencyWithdrawTokens(address token, address recipient) external",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const netName = network.name as "arbitrumSepolia" | "arbitrumOne";
  const isMainnet = netName === "arbitrumOne";

  const tokenAddress = CONFIG.TOKEN_ADDRESS[netName];
  const usdcAddress  = CONFIG.USDC_ADDRESS[netName];

  console.log("═══════════════════════════════════════════════════════");
  console.log("  8-BIT ARCADE — TOKEN SALE DEPLOYMENT");
  console.log("═══════════════════════════════════════════════════════");
  console.log();
  console.log("Network:   ", netName, isMainnet ? "🔴 MAINNET" : "🟡 TESTNET");
  console.log("Deployer:  ", deployer.address);
  console.log("ETH balance:", ethers.formatEther(
    await ethers.provider.getBalance(deployer.address)
  ), "ETH");
  console.log();

  // ── Validate config ────────────────────────────────────────────────────
  if (!tokenAddress) {
    throw new Error(
      `TOKEN_ADDRESS not set for ${netName}. ` +
      `Fill in CONFIG.TOKEN_ADDRESS.${netName} and re-run.`
    );
  }
  if (!ethers.isAddress(tokenAddress)) throw new Error("Invalid TOKEN_ADDRESS");
  if (!ethers.isAddress(usdcAddress))  throw new Error("Invalid USDC_ADDRESS");

  const token = new ethers.Contract(tokenAddress, ERC20_ABI, deployer);

  // ── (Optional) Recover tokens from old sale contract ──────────────────
  if (CONFIG.OLD_SALE_ADDRESS && ethers.isAddress(CONFIG.OLD_SALE_ADDRESS)) {
    console.log("─── Recovering tokens from old TokenSale ───────────────");
    const oldSale = new ethers.Contract(CONFIG.OLD_SALE_ADDRESS, OLD_SALE_ABI, deployer);

    let finalized = false;
    try { finalized = await oldSale.saleFinalized(); } catch {
      console.log("⚠️  Could not read saleFinalized from old contract. Skipping recovery.");
    }

    if (finalized) {
      const oldBalance = await token.balanceOf(CONFIG.OLD_SALE_ADDRESS);
      if (oldBalance > 0n) {
        console.log(
          "Recovering",
          ethers.formatEther(oldBalance),
          "8BIT from old contract..."
        );
        const recoverTx = await oldSale.emergencyWithdrawTokens(tokenAddress, deployer.address);
        await recoverTx.wait();
        console.log("✅ Tokens recovered to deployer wallet.");
      } else {
        console.log("Old contract has 0 8BIT balance — nothing to recover.");
      }
    } else {
      console.log(
        "⚠️  Old contract is NOT finalized. Cannot recover tokens via emergencyWithdrawTokens.",
        "\n   To finalize the old sale, call finalizeSale() on it first (after sale end time)."
      );
    }
    console.log();
  }

  // ── Check deployer token balance ───────────────────────────────────────
  const deployerBalance = await token.balanceOf(deployer.address);
  const tokensNeeded    = ethers.parseEther(CONFIG.TOKENS_FOR_SALE);

  console.log("─── Deployer token balance ─────────────────────────────");
  console.log("Available:", ethers.formatEther(deployerBalance), "8BIT");
  console.log("Required: ", CONFIG.TOKENS_FOR_SALE, "8BIT");
  console.log();

  if (deployerBalance < tokensNeeded) {
    throw new Error(
      `Deployer has insufficient 8BIT tokens.\n` +
      `  Has:   ${ethers.formatEther(deployerBalance)} 8BIT\n` +
      `  Needs: ${CONFIG.TOKENS_FOR_SALE} 8BIT\n\n` +
      `If tokens are in the old TokenSale, set CONFIG.OLD_SALE_ADDRESS and re-run,\n` +
      `or finalize the old contract first then call emergencyWithdrawTokens manually.`
    );
  }

  // ── Deploy TokenSale ───────────────────────────────────────────────────
  console.log("─── Deploying TokenSale ────────────────────────────────");
  console.log("8BIT Token:", tokenAddress);
  console.log("USDC:      ", usdcAddress);

  let startLabel: string;
  if (CONFIG.SALE_START_TIME === 0) {
    startLabel = "immediately (block.timestamp at deployment)";
  } else {
    startLabel = new Date(CONFIG.SALE_START_TIME * 1000).toUTCString();
  }
  console.log("Sale start:", startLabel);
  console.log();

  const TokenSale = await ethers.getContractFactory("TokenSale");
  const tokenSale = await TokenSale.deploy(
    tokenAddress,
    usdcAddress,
    CONFIG.SALE_START_TIME
  );
  await tokenSale.waitForDeployment();
  const tokenSaleAddress = await tokenSale.getAddress();
  console.log("✅ TokenSale deployed:", tokenSaleAddress);
  console.log();

  // ── Fund the contract with 200M tokens ────────────────────────────────
  console.log("─── Funding TokenSale with", CONFIG.TOKENS_FOR_SALE, "8BIT ───────");
  const fundTx = await token.transfer(tokenSaleAddress, tokensNeeded);
  await fundTx.wait();

  const saleBalance = await token.balanceOf(tokenSaleAddress);
  const funded      = saleBalance >= tokensNeeded;
  console.log(
    funded ? "✅ Funded:" : "❌ Funding mismatch:",
    ethers.formatEther(saleBalance),
    "8BIT in contract"
  );
  if (!funded) throw new Error("Token funding verification failed!");
  console.log();

  // ── Verify constructor args ────────────────────────────────────────────
  const startTime  = await tokenSale.saleStartTime();
  const endTime    = await tokenSale.saleEndTime();
  const tokensOnChain = await tokenSale.TOKENS_FOR_SALE();

  console.log("─── Contract state verification ────────────────────────");
  console.log("Start time:", new Date(Number(startTime) * 1000).toUTCString());
  console.log("End time:  ", new Date(Number(endTime)   * 1000).toUTCString());
  console.log("Tokens for sale:", ethers.formatEther(tokensOnChain), "8BIT");
  console.log("Sale finalized:", await tokenSale.saleFinalized());
  console.log("Paused:        ", await tokenSale.paused());
  console.log();

  // ── Summary ───────────────────────────────────────────────────────────
  console.log("═══════════════════════════════════════════════════════");
  console.log("  DEPLOYMENT SUCCESSFUL");
  console.log("═══════════════════════════════════════════════════════");
  console.log();
  console.log("  New TokenSale address:", tokenSaleAddress);
  console.log();

  // ── Verify command ────────────────────────────────────────────────────
  const networkFlag = `--network ${netName}`;
  const constructorArgs = [tokenAddress, usdcAddress, CONFIG.SALE_START_TIME].join(" ");
  console.log("─── Verify on Arbiscan ─────────────────────────────────");
  console.log(`npx hardhat verify ${networkFlag} ${tokenSaleAddress} ${constructorArgs}`);
  console.log();

  // ── Frontend addresses to update ──────────────────────────────────────
  console.log("─── Update these addresses in your frontend/admin ──────");
  console.log();
  console.log("sale-site/js/sale.js");
  console.log("  TOKEN_SALE:     '" + tokenSaleAddress + "'");
  console.log("  EIGHT_BIT_TOKEN: '" + tokenAddress + "'");
  console.log();
  console.log("sale-site/js/sale-admin.js");
  console.log("  TOKEN_SALE:     '" + tokenSaleAddress + "'");
  console.log("  EIGHT_BIT_TOKEN: '" + tokenAddress + "'");
  console.log();
  console.log("contracts/scripts/check-balances.ts");
  console.log("  TOKEN_SALE = '" + tokenSaleAddress + "'");
  console.log();

  if (isMainnet) {
    console.log("─── Mainnet next steps ─────────────────────────────────");
    console.log("1. Verify on Arbiscan (command above)");
    console.log("2. Update contract addresses in frontend and admin panel");
    console.log("3. Test buyWithEth() and buyWithUsdc() with a small amount");
    console.log("4. After sale ends: call finalizeSale() via admin panel");
    console.log("5. After TGE: call distributeTokens() via admin panel → Token Distribution tab");
  } else {
    console.log("─── Testnet next steps ─────────────────────────────────");
    console.log("1. Update contract addresses in frontend and admin panel");
    console.log("2. Run check-balances.ts to verify funding");
    console.log("3. Test purchases before going to mainnet");
  }
  console.log();
  console.log("═══════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ DEPLOYMENT FAILED:", err.message);
    process.exit(1);
  });
