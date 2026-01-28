import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import { ethers } from "ethers";
import { CONFIG } from "./config";
import { getUserBalance, sendETH, faucetBalance } from "./faucet";
import { canClaim, recordClaim } from "./cooldown";

admin.initializeApp();

export const discord = functions.https.onRequest(async (req, res) => {
  const { data, member } = req.body;
  const userId = member.user.id;

  // Admin commands
  if (CONFIG.ADMIN_IDS.includes(userId)) {
    if (data.name === "pause") {
      await admin.firestore().doc("faucetState/config").set({ paused: true });
      return res.json({ content: "🚰 Faucet paused" });
    }
    if (data.name === "balance") {
      const bal = await faucetBalance();
      return res.json({
        content: `💰 Faucet balance: ${ethers.formatEther(bal)} ETH`,
      });
    }
  }

  // Faucet command
  const address = data.options[0].value;

  if (!ethers.isAddress(address)) {
    return res.json({ content: "❌ Invalid address" });
  }

  const state = await admin.firestore().doc("faucetState/config").get();
  if (state.exists && state.data()?.paused) {
    return res.json({ content: "⏸ Faucet is paused" });
  }

  if (!(await canClaim(userId))) {
    return res.json({ content: "⏳ 24h cooldown active" });
  }

  const bal = await getUserBalance(address);
  if (bal >= ethers.parseEther(CONFIG.MAX_BALANCE)) {
    return res.json({ content: "⚠️ Wallet already funded" });
  }

  const tx = await sendETH(address);
  await recordClaim(userId);

  return res.json({
    content: `🚰 **8bit ETH Faucet**
Sent ${CONFIG.FAUCET_AMOUNT} ETH  
${CONFIG.EXPLORER}${tx.hash}`,
  });
});
