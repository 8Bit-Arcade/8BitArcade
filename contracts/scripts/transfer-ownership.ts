import { ethers, network } from "hardhat";

// ═══════════════════════════════════════════════════════════════
//  OWNERSHIP TRANSFER SCRIPT
//  Transfers ownership of all deployed contracts from the
//  current signer (compromised wallet) to NEW_OWNER.
//
//  Usage:
//    1. Set PRIVATE_KEY in contracts/.env to the COMPROMISED wallet's key
//    2. Set NEW_OWNER below to your new safe wallet address
//    3. npx hardhat run scripts/transfer-ownership.ts --network arbitrumOne
//    4. Verify each contract on Arbiscan — owner() should show NEW_OWNER
//    5. Remove the compromised key from .env immediately after
// ═══════════════════════════════════════════════════════════════

const NEW_OWNER = "0x80361876199e2318d6993A07e37177cFd21B64a7";

// ── Mainnet contract addresses ───────────────────────────────────
const MAINNET_CONTRACTS: Record<string, string> = {
  EightBitToken:      "0x37ee26669659758109c94862e49B492247Be26df",
  GameRewards:        "0x6e22b6b488f42FaBebE2a52fe759594650ef1B0e",
  TournamentManager:  "0xC0ab5FDF6Ef6A4e6bD60f9eD50b1CedB19B9741e",
  TournamentPayments: "0xa009e23658609EC3d6b98b1e0904b77005A73e59",
  TokenSale:          "0x14c07e8dEcA1EB1415aFA4590626613Fe1764FaA",
  TreasuryGasManager: "0x2185cF31B507620C412b00cde9B1BCd1B62983d6",
};

// ── Testnet contract addresses ───────────────────────────────────
const TESTNET_CONTRACTS: Record<string, string> = {
  TokenSale: "0x057B1130dD6E8FcBc144bb34172e45293C6839fE",
};

const OWNABLE_ABI = [
  "function owner() view returns (address)",
  "function transferOwnership(address newOwner) external",
];

async function main() {
  const [signer] = await ethers.getSigners();
  const net = network.name;
  const isMainnet = net === "arbitrumOne";

  console.log("═══════════════════════════════════════════════════════");
  console.log("  OWNERSHIP TRANSFER");
  console.log("═══════════════════════════════════════════════════════");
  console.log("Network:   ", net);
  console.log("From:      ", signer.address);
  console.log("To:        ", NEW_OWNER);
  console.log();

  if (!ethers.isAddress(NEW_OWNER)) throw new Error("NEW_OWNER is not a valid address");
  if (signer.address.toLowerCase() === NEW_OWNER.toLowerCase()) {
    throw new Error("Signer IS already the new owner — wrong private key in .env?");
  }

  const contracts = isMainnet ? MAINNET_CONTRACTS : TESTNET_CONTRACTS;

  for (const [name, address] of Object.entries(contracts)) {
    process.stdout.write(`${name.padEnd(20)} ${address}  →  `);
    try {
      const contract = new ethers.Contract(address, OWNABLE_ABI, signer);

      const currentOwner: string = await contract.owner();
      if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
        console.log(`SKIP (owner is ${currentOwner.slice(0, 8)}..., not this signer)`);
        continue;
      }

      const tx = await contract.transferOwnership(NEW_OWNER);
      process.stdout.write(`tx ${tx.hash.slice(0, 10)}...  `);
      await tx.wait();
      console.log("✅ done");
    } catch (err: any) {
      console.log(`❌ FAILED: ${err.message?.slice(0, 80)}`);
    }
  }

  console.log();
  console.log("─── Verify on Arbiscan ─────────────────────────────────");
  for (const [name, address] of Object.entries(contracts)) {
    const explorer = isMainnet ? "https://arbiscan.io" : "https://sepolia.arbiscan.io";
    console.log(`${name}: ${explorer}/address/${address}#readContract  (check owner())`);
  }
  console.log();
  console.log("Remove the compromised private key from contracts/.env now.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("\n❌ FATAL:", err.message);
    process.exit(1);
  });
