// Sale Admin Panel JavaScript
// Handles authentication, data loading, and contract interactions

// Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", // TODO: Add your Firebase config
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const functions = firebase.functions();
const db = firebase.firestore();

// Contract addresses (UPDATE THESE AFTER DEPLOYMENT)
const CONTRACTS = {
    TOKEN_SALE: '0x057B1130dD6E8FcBc144bb34172e45293C6839fE', // Testnet contract
    EIGHT_BIT_TOKEN: '0x0000000000000000000000000000000000000000', // UPDATE
    USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d', // Arbitrum Sepolia USDC
    CHAIN_ID: 421614, // Arbitrum Sepolia Testnet
    CHAIN_NAME: 'Arbitrum Sepolia'
};

// Contract constants (hard-coded from deployed contract)
const TOKENS_FOR_SALE = ethers.BigNumber.from('200000000000000000000000000'); // 200M tokens
const SOFT_CAP_USD = ethers.BigNumber.from('100000000000'); // $100K (6 decimals USDC)

// Contract ABIs
const TOKEN_SALE_ABI = [
    "function tokensSold() view returns (uint256)",
    "function ethRaised() view returns (uint256)",
    "function usdcRaised() view returns (uint256)",
    "function saleStartTime() view returns (uint256)",
    "function saleEndTime() view returns (uint256)",
    "function tokensPerEth() view returns (uint256)",
    "function tokensPerUsdc() view returns (uint256)",
    "function updatePrices(uint256 _tokensPerEth, uint256 _tokensPerUsdc) external",
    "function pause() external",
    "function unpause() external",
    "function withdrawFunds(address payable recipient) external",
    "function finalizeSale() external",
    "function extendSale(uint256 additionalTime) external",
    "function paused() view returns (bool)",
    "function getBuyerCount() view returns (uint256)",
    "function getBuyers() view returns (address[])",
];

// Global state
let provider = null;
let signer = null;
let userAddress = null;
let saleContract = null;
let isAdmin = false;

// Admin wallet addresses (must match backend)
const ADMIN_ADDRESSES = [
    '0x92f5523c2329ee281e7feb8808fce4b49ab1ebf8', // 8BitToken owner wallet
    // Add more admin addresses here as needed
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    setupTabs();
});

function setupEventListeners() {
    // Auth
    document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('refreshBtn').addEventListener('click', refreshData);

    // Config
    document.getElementById('btnUpdateConfig').addEventListener('click', updateSaleConfig);
    document.getElementById('btnExtendSale').addEventListener('click', extendSale);

    // Contract controls
    document.getElementById('btnUpdatePrices').addEventListener('click', updatePrices);
    document.getElementById('btnPauseSale').addEventListener('click', pauseSale);
    document.getElementById('btnUnpauseSale').addEventListener('click', unpauseSale);
    document.getElementById('btnFinalizeSale').addEventListener('click', finalizeSale);
    document.getElementById('btnWithdrawFunds').addEventListener('click', withdrawFunds);
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // Add active class to clicked tab
            tab.classList.add('active');
            const tabId = 'tab-' + tab.dataset.tab;
            document.getElementById(tabId).classList.add('active');
        });
    });
}

async function connectWallet() {
    try {
        if (typeof window.ethereum === 'undefined') {
            showError('Please install MetaMask or another Web3 wallet', 'loginError');
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

        // Check if user is admin
        if (!ADMIN_ADDRESSES.includes(userAddress.toLowerCase())) {
            showError('Access denied. This wallet is not authorized as an admin.', 'loginError');
            return;
        }

        // Initialize contracts
        saleContract = new ethers.Contract(CONTRACTS.TOKEN_SALE, TOKEN_SALE_ABI, signer);

        // User is authenticated
        isAdmin = true;
        showAdminPanel();

        console.log('Admin authenticated:', userAddress);
    } catch (error) {
        console.error('Error connecting wallet:', error);
        showError('Failed to connect wallet: ' + error.message, 'loginError');
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
        showError('Please switch to ' + CONTRACTS.CHAIN_NAME + ' in your wallet', 'loginError');
    }
}

function showAdminPanel() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('adminAddress').textContent =
        userAddress.slice(0, 6) + '...' + userAddress.slice(-4);

    // Load all data
    refreshData();
}

function logout() {
    isAdmin = false;
    provider = null;
    signer = null;
    userAddress = null;
    saleContract = null;

    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
}

async function refreshData() {
    if (!isAdmin) return;

    try {
        await Promise.all([
            loadStats(),
            loadSaleConfig(),
            loadPurchases(),
            loadBuyers(),
        ]);

        showStatus('Data refreshed successfully', 'success');
    } catch (error) {
        console.error('Error refreshing data:', error);
        showStatus('Error refreshing data: ' + error.message, 'error');
    }
}

async function loadStats() {
    try {
        // Get stats from contract
        const [tokensSold, ethRaised, usdcRaised] = await Promise.all([
            saleContract.tokensSold(),
            saleContract.ethRaised(),
            saleContract.usdcRaised(),
        ]);

        // Get ETH price (simplified - you may want to fetch from an API)
        const ethPrice = 5000; // Default
        const ethValue = parseFloat(ethers.utils.formatEther(ethRaised)) * ethPrice;
        const usdcValue = parseFloat(ethers.utils.formatUnits(usdcRaised, 6));
        const totalRaised = ethValue + usdcValue;

        // Get buyer count
        const buyerCount = await saleContract.getBuyerCount();

        const tokensSoldFormatted = parseFloat(ethers.utils.formatEther(tokensSold));
        const avgPurchase = buyerCount.gt(0)
            ? tokensSoldFormatted / buyerCount.toNumber()
            : 0;

        // Update UI
        document.getElementById('statTotalRaised').textContent = '$' + formatNumber(totalRaised);
        document.getElementById('statTokensSold').textContent = formatNumber(tokensSoldFormatted);
        document.getElementById('statTotalBuyers').textContent = buyerCount.toString();
        document.getElementById('statAvgPurchase').textContent = formatNumber(avgPurchase);
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadSaleConfig() {
    try {
        // Get from Firestore
        const getSaleConfig = functions.httpsCallable('getSaleConfig');
        const result = await getSaleConfig();
        const config = result.data;

        // Update form fields
        if (config.startTime) {
            const startDate = new Date(config.startTime * 1000);
            document.getElementById('inputStartTime').value = formatDateTimeLocal(startDate);
        }
        if (config.endTime) {
            const endDate = new Date(config.endTime * 1000);
            document.getElementById('inputEndTime').value = formatDateTimeLocal(endDate);
        }

        // Also get contract values (using hard-coded constants for cap and tokens)
        const [startTime, endTime] = await Promise.all([
            saleContract.saleStartTime(),
            saleContract.saleEndTime(),
        ]);

        console.log('Contract config:', {
            startTime: new Date(startTime.toNumber() * 1000),
            endTime: new Date(endTime.toNumber() * 1000),
            hardCap: '$100,000 (hard-coded constant)',
            tokensForSale: '200M (hard-coded constant)',
        });
    } catch (error) {
        console.error('Error loading sale config:', error);
    }
}

async function loadPurchases() {
    try {
        const getAllPurchases = functions.httpsCallable('getAllPurchases');
        const result = await getAllPurchases({ limit: 50 });
        const purchases = result.data;

        const tbody = document.getElementById('purchasesTableBody');
        if (purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No purchases yet</td></tr>';
            return;
        }

        tbody.innerHTML = purchases.map(p => `
            <tr>
                <td>${new Date(p.timestamp).toLocaleString()}</td>
                <td class="address-short">${p.buyer.slice(0, 6)}...${p.buyer.slice(-4)}</td>
                <td>${formatNumber(parseFloat(ethers.utils.formatEther(p.tokenAmount)))}</td>
                <td>${p.paymentMethod === 'ETH'
                    ? parseFloat(ethers.utils.formatEther(p.ethSpent)).toFixed(4) + ' ETH'
                    : parseFloat(ethers.utils.formatUnits(p.usdcSpent, 6)).toFixed(2) + ' USDC'
                }</td>
                <td>${p.paymentMethod}</td>
                <td><a href="https://arbiscan.io/tx/${p.txHash}" target="_blank" style="color: #00ff88;">${p.txHash.slice(0, 10)}...</a></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading purchases:', error);
        document.getElementById('purchasesTableBody').innerHTML =
            '<tr><td colspan="6" style="text-align: center; color: #ff4444;">Error loading purchases</td></tr>';
    }
}

async function loadBuyers() {
    try {
        const getAllBuyers = functions.httpsCallable('getAllBuyers');
        const result = await getAllBuyers({ limit: 50 });
        const buyers = result.data;

        const tbody = document.getElementById('buyersTableBody');
        if (buyers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No buyers yet</td></tr>';
            return;
        }

        tbody.innerHTML = buyers.map(b => `
            <tr>
                <td class="address-short">${b.address.slice(0, 6)}...${b.address.slice(-4)}</td>
                <td>${formatNumber(b.totalTokens)}</td>
                <td>${b.totalEthSpent.toFixed(4)} ETH</td>
                <td>${b.totalUsdcSpent.toFixed(2)} USDC</td>
                <td>${b.purchaseCount}</td>
                <td>${b.lastPurchase ? new Date(b.lastPurchase.seconds * 1000).toLocaleString() : 'N/A'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading buyers:', error);
        document.getElementById('buyersTableBody').innerHTML =
            '<tr><td colspan="6" style="text-align: center; color: #ff4444;">Error loading buyers</td></tr>';
    }
}

async function updateSaleConfig() {
    if (!isAdmin) {
        showStatus('Not authenticated as admin', 'error');
        return;
    }

    try {
        const startTimeInput = document.getElementById('inputStartTime').value;
        const endTimeInput = document.getElementById('inputEndTime').value;
        const hardCap = document.getElementById('inputHardCap').value;
        const tokensForSale = document.getElementById('inputTokensForSale').value;

        const data = {};

        if (startTimeInput) {
            data.startTime = Math.floor(new Date(startTimeInput).getTime() / 1000);
        }
        if (endTimeInput) {
            data.endTime = Math.floor(new Date(endTimeInput).getTime() / 1000);
        }
        if (hardCap) {
            data.hardCap = parseFloat(hardCap);
        }
        if (tokensForSale) {
            data.tokensForSale = parseFloat(tokensForSale);
        }

        showStatus('Updating configuration...', 'warning');

        const updateSaleConfig = functions.httpsCallable('updateSaleConfig');
        await updateSaleConfig(data);

        showStatus('Configuration updated successfully!', 'success');
        await refreshData();
    } catch (error) {
        console.error('Error updating config:', error);
        showStatus('Error updating configuration: ' + error.message, 'error');
    }
}

async function extendSale() {
    if (!isAdmin || !saleContract) {
        showStatus('Not authenticated or contract not loaded', 'error');
        return;
    }

    try {
        const daysToExtend = prompt('Enter number of days to extend the sale:');
        if (!daysToExtend || isNaN(daysToExtend)) {
            showStatus('Invalid number of days', 'error');
            return;
        }

        const secondsToExtend = parseFloat(daysToExtend) * 24 * 60 * 60;

        showStatus('Extending sale... Please confirm transaction', 'warning');

        const tx = await saleContract.extendSale(secondsToExtend);
        await tx.wait();

        showStatus(`Sale extended by ${daysToExtend} days!`, 'success');
        await refreshData();
    } catch (error) {
        console.error('Error extending sale:', error);
        showStatus('Error extending sale: ' + error.message, 'error');
    }
}

async function updatePrices() {
    if (!isAdmin || !saleContract) {
        showStatus('Not authenticated or contract not loaded', 'error');
        return;
    }

    try {
        const tokensPerEth = document.getElementById('inputTokensPerEth').value;
        const tokensPerUsdc = document.getElementById('inputTokensPerUsdc').value;

        if (!tokensPerEth || !tokensPerUsdc) {
            showStatus('Please enter both ETH and USDC prices', 'error');
            return;
        }

        showStatus('Updating prices... Please confirm transaction', 'warning');

        const tokensPerEthWei = ethers.utils.parseEther(tokensPerEth);
        const tokensPerUsdcWei = ethers.utils.parseEther(tokensPerUsdc);

        const tx = await saleContract.updatePrices(tokensPerEthWei, tokensPerUsdcWei);
        await tx.wait();

        showStatus('Prices updated successfully!', 'success');
        await refreshData();
    } catch (error) {
        console.error('Error updating prices:', error);
        showStatus('Error updating prices: ' + error.message, 'error');
    }
}

async function pauseSale() {
    if (!isAdmin || !saleContract) {
        showStatus('Not authenticated or contract not loaded', 'error');
        return;
    }

    if (!confirm('Are you sure you want to PAUSE the sale? Users will not be able to buy tokens.')) {
        return;
    }

    try {
        showStatus('Pausing sale... Please confirm transaction', 'warning');

        const tx = await saleContract.pause();
        await tx.wait();

        showStatus('Sale paused successfully!', 'success');
        await refreshData();
    } catch (error) {
        console.error('Error pausing sale:', error);
        showStatus('Error pausing sale: ' + error.message, 'error');
    }
}

async function unpauseSale() {
    if (!isAdmin || !saleContract) {
        showStatus('Not authenticated or contract not loaded', 'error');
        return;
    }

    try {
        showStatus('Unpausing sale... Please confirm transaction', 'warning');

        const tx = await saleContract.unpause();
        await tx.wait();

        showStatus('Sale unpaused successfully!', 'success');
        await refreshData();
    } catch (error) {
        console.error('Error unpausing sale:', error);
        showStatus('Error unpausing sale: ' + error.message, 'error');
    }
}

async function finalizeSale() {
    if (!isAdmin || !saleContract) {
        showStatus('Not authenticated or contract not loaded', 'error');
        return;
    }

    if (!confirm('⚠️ WARNING: This will permanently end the sale and burn all unsold tokens. This action CANNOT be undone. Are you absolutely sure?')) {
        return;
    }

    if (!confirm('FINAL CONFIRMATION: Type "FINALIZE" in the next prompt to continue')) {
        return;
    }

    const confirmation = prompt('Type FINALIZE to confirm:');
    if (confirmation !== 'FINALIZE') {
        showStatus('Finalize cancelled', 'warning');
        return;
    }

    try {
        showStatus('Finalizing sale... Please confirm transaction', 'warning');

        const tx = await saleContract.finalizeSale();
        await tx.wait();

        showStatus('Sale finalized successfully! Unsold tokens have been burned.', 'success');
        await refreshData();
    } catch (error) {
        console.error('Error finalizing sale:', error);
        showStatus('Error finalizing sale: ' + error.message, 'error');
    }
}

async function withdrawFunds() {
    if (!isAdmin || !saleContract) {
        showStatus('Not authenticated or contract not loaded', 'error');
        return;
    }

    const recipient = document.getElementById('inputWithdrawAddress').value;
    if (!recipient || !ethers.utils.isAddress(recipient)) {
        showStatus('Please enter a valid recipient address', 'error');
        return;
    }

    if (!confirm(`Withdraw all funds to ${recipient}? This will transfer all ETH and USDC from the contract.`)) {
        return;
    }

    try {
        showStatus('Withdrawing funds... Please confirm transaction', 'warning');

        const tx = await saleContract.withdrawFunds(recipient);
        await tx.wait();

        showStatus('Funds withdrawn successfully!', 'success');
        await refreshData();
    } catch (error) {
        console.error('Error withdrawing funds:', error);
        showStatus('Error withdrawing funds: ' + error.message, 'error');
    }
}

function showStatus(message, type) {
    const statusEl = document.getElementById('statusMessage');
    statusEl.textContent = message;
    statusEl.className = 'status-message status-' + type;
    statusEl.style.display = 'block';

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }
}

function showError(message, elementId) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.style.display = 'block';

    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
}

function formatNumber(num) {
    const n = parseFloat(num);
    if (isNaN(n)) return '0';
    if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(2) + 'K';
    return n.toFixed(2);
}

function formatDateTimeLocal(date) {
    const pad = (num) => String(num).padStart(2, '0');
    return date.getFullYear() + '-' +
           pad(date.getMonth() + 1) + '-' +
           pad(date.getDate()) + 'T' +
           pad(date.getHours()) + ':' +
           pad(date.getMinutes());
}
