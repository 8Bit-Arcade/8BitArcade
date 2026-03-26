require('dotenv').config();
const { ethers } = require('ethers');

const rpcUrl = process.env.RPC_URL;
const privateKey = process.env.PRIVATE_KEY;
const contractAddress = process.env.CONTRACT_ADDRESS;

// ABI minimal for setSaleStartTime & extendSale
const abi = [
    "function setSaleStartTime(uint256 newStartTime) external",
    "function extendSale(uint256 additionalTime) external"
];

async function main() {
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const contract = new ethers.Contract(contractAddress, abi, wallet);

    // Calculate 6:30 PM EST today
    let now = new Date();
    let estOffset = -5; // EST = UTC-5
    let estHour = 18;   // 6 PM
    let estMinute = 30;

    // Convert to UTC timestamp
    let estDate = new Date(Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        estHour - estOffset,
        estMinute,
        0
    ));

    // If time already passed, schedule for tomorrow
    if(estDate < now) estDate.setUTCDate(estDate.getUTCDate() + 1);

    const unixTime = Math.floor(estDate.getTime() / 1000);
    console.log("Setting sale start time to:", estDate, "Unix:", unixTime);

    // Call setSaleStartTime
    let tx1 = await contract.setSaleStartTime(unixTime);
    await tx1.wait();
    console.log("Sale start time set!");

    // Extend sale by 15 days
    const fifteenDays = 15 * 24 * 60 * 60;
    let tx2 = await contract.extendSale(fifteenDays);
    await tx2.wait();
    console.log("Sale extended by 15 days!");
}

main().catch(console.error);