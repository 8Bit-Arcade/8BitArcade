// Token Sale Web3 Integration
// Uses ethers.js v5 (loaded from CDN)

// Contract addresses (UPDATE THESE AFTER DEPLOYMENT)
const CONTRACTS = {
    TOKEN_SALE: '0x0000000000000000000000000000000000000000', // UPDATE
    EIGHT_BIT_TOKEN: '0x0000000000000000000000000000000000000000', // UPDATE
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // Arbitrum One USDC
    CHAIN_ID: 42161, // Arbitrum One
    CHAIN_NAME: 'Arbitrum One'
};

// Contract ABIs (minimal)
const TOKEN_SALE_ABI = [
    "function buyWithEth() external payable",
    "function buyWithUsdc(uint256 usdcAmount) external",
    "function TOKENS_FOR_SALE() view returns (uint256)",
    "function tokensSold() view returns (uint256)",
    "function ethRaised() view returns (uint256)",
    "function usdcRaised() view returns (uint256)",
    "function saleEndTime() view returns (uint256)",
    "function tokensPerEth() view returns (uint256)",
    "function tokensPerUsdc() view returns (uint256)",
    "function purchasedTokens(address buyer) view returns (uint256)",
    "function isSaleActive() view returns (bool)",
    "function calculateTokensForEth(uint256 ethAmount) view returns (uint256)",
    "function calculateTokensForUsdc(uint256 usdcAmount) view returns (uint256)",
];

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
];

// Global state
let provider = null;
let signer = null;
let userAddress = null;
let saleContract = null;
let tokenContract = null;
let usdcContract = null;
let paymentMethod = 'eth';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await loadSaleData();
    startRefreshInterval();
});

function setupEventListeners() {
    // Connect wallet button
    document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);

    // Payment method toggle
    document.getElementById('ethToggle').addEventListener('click', () => setPaymentMethod('eth'));
    document.getElementById('usdcToggle').addEventListener('click', () => setPaymentMethod('usdc'));

    // Amount input
    document.getElementById('amountInput').addEventListener('input', updateTokensReceive);

    // Buy button
    document.getElementById('buyButton').addEventListener('click', handleBuy);
}

function setPaymentMethod(method) {
    paymentMethod = method;

    // Update UI
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (method === 'eth') {
        document.getElementById('ethToggle').classList.add('active');
    } else {
        document.getElementById('usdcToggle').classList.add('active');
    }

    updateTokensReceive();
    updateBalance();
}

async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            showError('Please install MetaMask or another Web3 wallet');
            return;
        }

        // Request account access
        await window.ethereum.request({ method: 'eth_requestAccounts' });

        // Setup provider and signer
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        userAddress = await signer.getAddress();

        // Check network
        const network = await provider.getNetwork();
        if (network.chainId !== CONTRACTS.CHAIN_ID) {
            await switchNetwork();
            return;
        }

        // Initialize contracts
        saleContract = new ethers.Contract(CONTRACTS.TOKEN_SALE, TOKEN_SALE_ABI, signer);
        tokenContract = new ethers.Contract(CONTRACTS.EIGHT_BIT_TOKEN, ERC20_ABI, signer);
        usdcContract = new ethers.Contract(CONTRACTS.USDC, ERC20_ABI, signer);

        // Update UI
        updateConnectedState();
        await loadUserData();

        console.log('Wallet connected:', userAddress);
    } catch (error) {
        console.error('Error connecting wallet:', error);
        showError('Failed to connect wallet: ' + error.message);
    }
}

async function switchNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + CONTRACTS.CHAIN_ID.toString(16) }],
        });

        // Retry connection after switch
        setTimeout(connectWallet, 1000);
    } catch (error) {
        console.error('Error switching network:', error);
        showError('Please switch to ' + CONTRACTS.CHAIN_NAME + ' in your wallet');
    }
}

function updateConnectedState() {
    const connectBtn = document.getElementById('connectWalletBtn');
    const buyBtn = document.getElementById('buyButton');

    connectBtn.textContent = userAddress.slice(0, 6) + '...' + userAddress.slice(-4);
    connectBtn.classList.add('connected');

    buyBtn.disabled = false;
    buyBtn.textContent = 'Buy Tokens';
}

async function loadSaleData() {
    try {
        // If contracts not initialized, use read-only provider
        if (!saleContract) {
            const readProvider = new ethers.providers.JsonRpcProvider('https://arb1.arbitrum.io/rpc');
            saleContract = new ethers.Contract(CONTRACTS.TOKEN_SALE, TOKEN_SALE_ABI, readProvider);
        }

        // Load sale stats
        const [tokensForSale, tokensSold, ethRaised, usdcRaised, saleEndTime, isSaleActive, tokensPerEth, tokensPerUsdc] =
            await Promise.all([
                saleContract.TOKENS_FOR_SALE(),
                saleContract.tokensSold(),
                saleContract.ethRaised(),
                saleContract.usdcRaised(),
                saleContract.saleEndTime(),
                saleContract.isSaleActive(),
                saleContract.tokensPerEth(),
                saleContract.tokensPerUsdc(),
            ]);

        // Update UI
        document.getElementById('tokensSold').textContent = formatNumber(ethers.utils.formatEther(tokensSold));
        document.getElementById('tokensSoldSub').textContent = '/ ' + formatNumber(ethers.utils.formatEther(tokensForSale)) + ' 8BIT';

        // Calculate total raised
        const ethValue = parseFloat(ethers.utils.formatEther(ethRaised)) * 5000; // Assume $5000 ETH
        const usdcValue = parseFloat(ethers.utils.formatUnits(usdcRaised, 6));
        document.getElementById('totalRaised').textContent = '$' + formatNumber(ethValue + usdcValue);

        // Update progress
        const progress = (parseFloat(ethers.utils.formatEther(tokensSold)) / parseFloat(ethers.utils.formatEther(tokensForSale))) * 100;
        document.getElementById('progressPercent').textContent = progress.toFixed(1) + '%';
        document.getElementById('progressFill').style.width = progress + '%';

        // Update sale status
        updateSaleStatus(isSaleActive, saleEndTime);

        // Update price display
        const ethPrice = '1 ETH = ' + formatNumber(ethers.utils.formatEther(tokensPerEth)) + ' 8BIT';
        const usdcPrice = '1 USDC = ' + formatNumber(ethers.utils.formatEther(tokensPerUsdc)) + ' 8BIT';
        document.getElementById('currentPrice').textContent = paymentMethod === 'eth' ? ethPrice : usdcPrice;

    } catch (error) {
        console.error('Error loading sale data:', error);
    }
}

function updateSaleStatus(isActive, endTime) {
    const statusEl = document.getElementById('saleStatus');
    const statusText = document.getElementById('saleStatusText');
    const timeEl = document.getElementById('timeRemaining');

    if (isActive) {
        statusEl.querySelector('.status-dot').style.background = '#00ff88';
        statusText.textContent = 'SALE LIVE';

        // Update countdown
        const now = Math.floor(Date.now() / 1000);
        const remaining = endTime - now;

        if (remaining > 0) {
            timeEl.textContent = formatTimeRemaining(remaining);
        } else {
            timeEl.textContent = 'ENDED';
        }
    } else {
        statusEl.querySelector('.status-dot').style.background = '#888';
        statusText.textContent = 'SALE ENDED';
        timeEl.textContent = 'ENDED';
    }
}

async function loadUserData() {
    if (!saleContract || !userAddress) return;

    try {
        const purchased = await saleContract.purchasedTokens(userAddress);

        if (purchased.gt(0)) {
            document.getElementById('userPurchaseInfo').style.display = 'block';
            document.getElementById('userTokens').textContent = formatNumber(ethers.utils.formatEther(purchased)) + ' 8BIT';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function updateBalance() {
    if (!signer || !userAddress) return;

    try {
        let balance;
        if (paymentMethod === 'eth') {
            balance = await signer.getBalance();
            document.getElementById('balanceDisplay').textContent = 'Balance: ' + parseFloat(ethers.utils.formatEther(balance)).toFixed(4) + ' ETH';
        } else {
            balance = await usdcContract.balanceOf(userAddress);
            document.getElementById('balanceDisplay').textContent = 'Balance: ' + parseFloat(ethers.utils.formatUnits(balance, 6)).toFixed(2) + ' USDC';
        }
    } catch (error) {
        console.error('Error updating balance:', error);
    }
}

async function updateTokensReceive() {
    const amount = document.getElementById('amountInput').value;

    if (!amount || isNaN(amount) || !saleContract) {
        document.getElementById('tokensReceive').textContent = '0 8BIT';
        return;
    }

    try {
        let tokens;
        if (paymentMethod === 'eth') {
            const ethAmount = ethers.utils.parseEther(amount);
            tokens = await saleContract.calculateTokensForEth(ethAmount);
        } else {
            const usdcAmount = ethers.utils.parseUnits(amount, 6);
            tokens = await saleContract.calculateTokensForUsdc(usdcAmount);
        }

        document.getElementById('tokensReceive').textContent = formatNumber(ethers.utils.formatEther(tokens)) + ' 8BIT';
    } catch (error) {
        console.error('Error calculating tokens:', error);
    }
}

async function handleBuy() {
    if (!signer || !userAddress) {
        showError('Please connect your wallet first');
        return;
    }

    const amount = document.getElementById('amountInput').value;
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        showError('Please enter a valid amount');
        return;
    }

    try {
        showStatus('Processing...', 'pending');

        if (paymentMethod === 'eth') {
            await buyWithEth(amount);
        } else {
            await buyWithUsdc(amount);
        }
    } catch (error) {
        console.error('Error buying tokens:', error);
        showError(error.message || 'Transaction failed');
    }
}

async function buyWithEth(amount) {
    const ethAmount = ethers.utils.parseEther(amount);

    const tx = await saleContract.buyWithEth({ value: ethAmount });
    showStatus('Transaction submitted... waiting for confirmation', 'pending');

    await tx.wait();
    showStatus('✅ Tokens purchased successfully!', 'success');

    // Refresh data
    await loadSaleData();
    await loadUserData();
    document.getElementById('amountInput').value = '';
}

async function buyWithUsdc(amount) {
    const usdcAmount = ethers.utils.parseUnits(amount, 6);

    // Check allowance
    const allowance = await usdcContract.allowance(userAddress, CONTRACTS.TOKEN_SALE);

    if (allowance.lt(usdcAmount)) {
        showStatus('Approving USDC...', 'pending');
        const approveTx = await usdcContract.approve(CONTRACTS.TOKEN_SALE, usdcAmount);
        await approveTx.wait();
    }

    showStatus('Purchasing tokens...', 'pending');
    const tx = await saleContract.buyWithUsdc(usdcAmount);

    showStatus('Transaction submitted... waiting for confirmation', 'pending');
    await tx.wait();

    showStatus('✅ Tokens purchased successfully!', 'success');

    // Refresh data
    await loadSaleData();
    await loadUserData();
    document.getElementById('amountInput').value = '';
}

function showStatus(message, type) {
    const statusEl = document.getElementById('txStatus');
    statusEl.textContent = message;
    statusEl.className = 'tx-status ' + type;
    statusEl.style.display = 'block';

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }
}

function showError(message) {
    showStatus('❌ ' + message, 'error');
}

function formatNumber(num) {
    const n = parseFloat(num);
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toFixed(0);
}

function formatTimeRemaining(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return days + 'd ' + hours + 'h';
    if (hours > 0) return hours + 'h ' + minutes + 'm';
    return minutes + 'm';
}

function startRefreshInterval() {
    // Refresh sale data every 30 seconds
    setInterval(loadSaleData, 30000);

    // Update countdown every second
    setInterval(() => {
        if (saleContract) {
            saleContract.saleEndTime().then(endTime => {
                saleContract.isSaleActive().then(isActive => {
                    updateSaleStatus(isActive, endTime);
                });
            });
        }
    }, 1000);
}
