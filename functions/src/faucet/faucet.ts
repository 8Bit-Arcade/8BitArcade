import { ethers } from "ethers";
import { CONFIG } from "./config";

const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
const wallet = new ethers.Wallet(process.env.FAUCET_PRIVATE_KEY!, provider);

export async function getUserBalance(address: string) {
  return provider.getBalance(address);
}

export async function sendETH(to: string) {
  const tx = await wallet.sendTransaction({
    to,
    value: ethers.parseEther(CONFIG.FAUCET_AMOUNT),
  });
  return tx.wait();
}

export async function faucetBalance() {
  return provider.getBalance(wallet.address);
}
