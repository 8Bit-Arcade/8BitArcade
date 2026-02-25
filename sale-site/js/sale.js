// Token Sale Web3 Integration
// Uses ethers.js v5 (loaded from CDN)

// Contract addresses — Arbitrum One Mainnet
const CONTRACTS = {
    TOKEN_SALE: '0x14c07e8deca1eb1415afa4590626613fe1764faa',      // TokenSale (200M 8BIT held)
    EIGHT_BIT_TOKEN: '0x37ee26669659758109c94862e49b492247be26df', // 8BIT token
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',            // Arbitrum One native USDC
    CHAIN_ID: 42161, // Arbitrum One Mainnet
    CHAIN_NAME: 'Arbitrum One'
};

// Contract ABIs (minimal)
const TOKEN_SALE_ABI = [
    "function buyWithEth() external payable",
    "function buyWithUsdc(uint256 usdcAmount) external",
    "function TOKENS_FOR_SALE() view returns (uint256)",
    "function SOFT_CAP_USD() view returns (uint256)",
    "function tokensSold() view returns (uint256)",
    "function ethRaised() view returns (uint256)",
    "function usdcRaised() view returns (uint256)",
    "function saleStartTime() view returns (uint256)",
    "function saleEndTime() view returns (uint256)",
    "function tokensPerEth() view returns (uint256)",
    "function tokensPerUsdc() view returns (uint256)",
    "function purchasedTokens(address buyer) view returns (uint256)",
    "function isSaleActive() view returns (bool)",
    "function calculateTokensForEth(uint256 ethAmount) view returns (uint256)",
    "function calculateTokensForUsdc(uint256 usdcAmount) view returns (uint256)",
    "function getBuyerCount() view returns (uint256)",
    "function getBuyers() view returns (address[])",
    "function getPurchaseInfo(address buyer) view returns (uint256 tokens, uint256 eth, uint256 usdc)",
    // Admin functions
    "function updatePrices(uint256 _tokensPerEth, uint256 _tokensPerUsdc) external",
    "function pause() external",
    "function unpause() external",
    "function withdrawFunds(address payable recipient) external",
    "function finalizeSale() external",
    "function extendSale(uint256 additionalTime) external",
    "function distributeTokens(uint256 startIndex, uint256 count) external",
    "function tokensClaimed(address buyer) view returns (bool)",
    "event TokensDistributed(address indexed buyer, uint256 amount)",
];

const ERC20_ABI = [
    "function balanceOf(address account) view returns (uint256)",
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
];

// Token metadata for wallet integration
const TOKEN_INFO = {
    address: '0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d',
    symbol: '8BIT',
    decimals: 18,
    image: 'https://firebasestorage.googleapis.com/v0/b/bitarcade-679b7.firebasestorage.app/o/8bit-token.jpg?alt=media&token=37f53dfb-2225-454c-96d9-f2823d73b538'
};

// Global state
let provider = null;
let signer = null;
let userAddress = null;
let saleContract = null;
let tokenContract = null;
let usdcContract = null;
let paymentMethod = 'eth';
let currentEthPrice = 3300; // Fallback default (approximate ETH price)

// Token pricing
const TOKEN_PRICE_USD = 0.0005; // $0.0005 per 8BIT token

// Price cache settings
const PRICE_CACHE_KEY = '8bit_eth_price';
const PRICE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (reduced API calls)

// Initialize - wait for ethers.js to be loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Wait for ethers to be available
    if (typeof ethers === 'undefined') {
        console.error('ethers.js not loaded');
        return;
    }

    setupEventListeners();
    await fetchEthPrice(); // Get ETH price first
    await loadSaleData();
    startRefreshInterval();
});

async function fetchEthPrice() {
    try {
        // Check local cache first (for quick page loads)
        const cached = localStorage.getItem(PRICE_CACHE_KEY);
        if (cached) {
            try {
                const { price, timestamp } = JSON.parse(cached);
                const age = Date.now() - timestamp;

                // Use cached price if still valid (1 minute local cache)
                if (age < 60000 && price > 0) {
                    currentEthPrice = price;
                    console.log('Using locally cached ETH price:', price);
                    return price;
                }
            } catch (e) {
                localStorage.removeItem(PRICE_CACHE_KEY);
            }
        }

        // Fetch from Firebase function (handles server-side caching and API fallbacks)
        if (typeof firebase !== 'undefined' && firebase.functions) {
            try {
                const getEthPriceFn = firebase.functions().httpsCallable('getEthPrice');
                const result = await getEthPriceFn();
                // Firebase function returns `ethUsd` (not `price`)
                const { ethUsd, source } = result.data;

                if (ethUsd && ethUsd > 0) {
                    // Cache locally for quick subsequent access
                    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({
                        price: ethUsd,
                        timestamp: Date.now()
                    }));
                    currentEthPrice = ethUsd;
                    console.log(`ETH price from Firebase (${source}): $${ethUsd}`);
                    return ethUsd;
                }
            } catch (e) {
                console.warn('Firebase getEthPrice failed:', e);
            }
        }

        // Fallback: fetch directly from CoinGecko (CORS allowed on free tier)
        try {
            const resp = await fetch(
                'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd',
                { headers: { Accept: 'application/json' } }
            );
            if (resp.ok) {
                const data = await resp.json();
                const cgPrice = data?.ethereum?.usd;
                if (cgPrice > 0) {
                    localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify({
                        price: cgPrice,
                        timestamp: Date.now()
                    }));
                    currentEthPrice = cgPrice;
                    console.log(`ETH price from CoinGecko (direct): $${cgPrice}`);
                    return cgPrice;
                }
            }
        } catch (e) {
            console.warn('CoinGecko direct fetch failed:', e);
        }

        // Fallback: use any cached price (even expired)
        if (cached) {
            try {
                const { price: cachedPrice } = JSON.parse(cached);
                if (cachedPrice > 0) {
                    currentEthPrice = cachedPrice;
                    console.log('Using expired cached ETH price:', cachedPrice);
                    return cachedPrice;
                }
            } catch (e) { }
        }

        // Final fallback - use default
        console.log('Using fallback ETH price: $3300');
        currentEthPrice = 3300;
        return 3300;

    } catch (error) {
        console.error('Error in fetchEthPrice:', error);
        if (!currentEthPrice || currentEthPrice <= 0) {
            currentEthPrice = 3300;
        }
        return currentEthPrice;
    }
}

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

async function setPaymentMethod(method) {
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

    // Refresh price display immediately when switching payment methods
    await loadSaleData();
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
            // Use Alchemy RPC for reliable CORS-enabled access
            const readProvider = new ethers.providers.JsonRpcProvider('https://arb-mainnet.g.alchemy.com/v2/eu4fg53KRs9jneLNPjxcd');
            saleContract = new ethers.Contract(CONTRACTS.TOKEN_SALE, TOKEN_SALE_ABI, readProvider);
        }

        // Load sale stats from contract (including constants)
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

        // Calculate total raised using real-time ETH price
        const ethValue = parseFloat(ethers.utils.formatEther(ethRaised)) * currentEthPrice;
        const usdcValue = parseFloat(ethers.utils.formatUnits(usdcRaised, 6));
        const totalRaised = ethValue + usdcValue;

        document.getElementById('totalRaised').textContent = '$' + formatNumber(totalRaised);

        // Update progress
        const progress = (parseFloat(ethers.utils.formatEther(tokensSold)) / parseFloat(ethers.utils.formatEther(tokensForSale))) * 100;

        // Show more precision for small amounts (0.001% instead of 0.0%)
        let progressText;
        if (progress < 0.01 && progress > 0) {
            // Show 3 decimals for very small progress
            progressText = progress.toFixed(3) + '%';
        } else if (progress < 1) {
            // Show 2 decimals for small progress
            progressText = progress.toFixed(2) + '%';
        } else {
            // Show 1 decimal for normal progress
            progressText = progress.toFixed(1) + '%';
        }

        document.getElementById('progressPercent').textContent = progressText;
        document.getElementById('progressFill').style.width = Math.max(progress, 0.1) + '%'; // Minimum 0.1% width so it's visible

        // Update sale status
        updateSaleStatus(isSaleActive, saleEndTime);

        // Update price display - calculate based on real-time ETH price
        const calculatedTokensPerEth = currentEthPrice / TOKEN_PRICE_USD; // ETH price / token price = tokens per ETH
        const ethPrice = '1 ETH = ' + formatNumber(calculatedTokensPerEth) + ' 8BIT';
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

    if (!amount || isNaN(amount)) {
        document.getElementById('tokensReceive').textContent = '0 8BIT';
        return;
    }

    try {
        let tokens;
        if (paymentMethod === 'eth') {
            // Calculate based on real-time ETH price for consistent display
            const calculatedTokensPerEth = currentEthPrice / TOKEN_PRICE_USD;
            tokens = parseFloat(amount) * calculatedTokensPerEth;
            document.getElementById('tokensReceive').textContent = formatNumber(tokens) + ' 8BIT';
        } else {
            // USDC is stable, use contract calculation
            if (!saleContract) {
                document.getElementById('tokensReceive').textContent = '0 8BIT';
                return;
            }
            const usdcAmount = ethers.utils.parseUnits(amount, 6);
            const tokensBN = await saleContract.calculateTokensForUsdc(usdcAmount);
            document.getElementById('tokensReceive').textContent = formatNumber(ethers.utils.formatEther(tokensBN)) + ' 8BIT';
        }
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

    const receipt = await tx.wait();
    showStatus('✅ Tokens purchased successfully!', 'success');

    // Track purchase in Firestore (if Firebase is available)
    if (typeof firebase !== 'undefined' && firebase.functions) {
        try {
            await trackPurchase(receipt, amount, 'ETH');
        } catch (error) {
            console.error('Error tracking purchase:', error);
        }
    }

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
    const receipt = await tx.wait();

    showStatus('✅ Tokens purchased successfully!', 'success');

    // Track purchase in Firestore (if Firebase is available)
    if (typeof firebase !== 'undefined' && firebase.functions) {
        try {
            await trackPurchase(receipt, amount, 'USDC');
        } catch (error) {
            console.error('Error tracking purchase:', error);
        }
    }

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
    if (n >= 1) return n.toFixed(0);
    // For very small numbers, show decimal places
    if (n > 0) return n.toFixed(2);
    return '0';
}

function formatTimeRemaining(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return days + 'd ' + hours + 'h';
    if (hours > 0) return hours + 'h ' + minutes + 'm';
    return minutes + 'm';
}

async function trackPurchase(receipt, amount, paymentMethod) {
    // Parse the receipt to get purchase details
    const event = receipt.events.find(e => e.event === 'TokensPurchased');
    if (!event) {
        console.error('TokensPurchased event not found in receipt');
        return;
    }

    const { buyer, amount: tokenAmount, ethSpent, usdcSpent } = event.args;

    // Call Firebase function to track purchase
    const trackPurchaseFn = firebase.functions().httpsCallable('trackPurchase');
    await trackPurchaseFn({
        txHash: receipt.transactionHash,
        buyer: buyer,
        amount: tokenAmount.toString(),
        ethSpent: ethSpent.toString(),
        usdcSpent: usdcSpent.toString(),
        timestamp: Math.floor(Date.now() / 1000),
    });

    console.log('Purchase tracked:', receipt.transactionHash);
}

function startRefreshInterval() {
    // Refresh ETH price every 5 minutes (matches cache duration)
    setInterval(async () => {
        await fetchEthPrice();
        await loadSaleData();
    }, PRICE_CACHE_DURATION);

    // Refresh sale data every 60 seconds (reduced frequency)
    setInterval(loadSaleData, 60000);

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

// Add 8BIT token to user's wallet (MetaMask, Coinbase Wallet, Trust Wallet, etc.)
async function addTokenToWallet() {
    if (typeof window.ethereum === 'undefined') {
        showError('Please install a Web3 wallet like MetaMask');
        return false;
    }

    try {
        const wasAdded = await window.ethereum.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: TOKEN_INFO.address,
                    symbol: TOKEN_INFO.symbol,
                    decimals: TOKEN_INFO.decimals,
                    image: TOKEN_INFO.image
                }
            }
        });

        if (wasAdded) {
            showStatus('✅ 8BIT token added to your wallet!', 'success');
        } else {
            showStatus('Token was not added', 'error');
        }
        return wasAdded;
    } catch (error) {
        console.error('Error adding token to wallet:', error);
        showError('Failed to add token: ' + error.message);
        return false;
    }
}

// Expose function globally for button onclick
window.addTokenToWallet = addTokenToWallet;
