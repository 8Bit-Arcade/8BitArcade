// ═══════════════════════════════════════════════════════════════
//  8-Bit Arcade – Token Sale Admin Panel
// ═══════════════════════════════════════════════════════════════

// ── Firebase ────────────────────────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyBqFKw6v6RB0P1HHup9jO10Cziqfnuiig4",
    authDomain: "bitarcade-679b7.firebaseapp.com",
    projectId: "bitarcade-679b7",
    storageBucket: "bitarcade-679b7.firebasestorage.app",
    messagingSenderId: "163469341654",
    appId: "1:163469341654:web:f5e231834fa4426a396a77"
};
firebase.initializeApp(firebaseConfig);
const functions = firebase.functions();
const db = firebase.firestore();

// ── Contract config ──────────────────────────────────────────────
const CONTRACTS = {
    TOKEN_SALE:      '0x057B1130dD6E8FcBc144bb34172e45293C6839fE',
    EIGHT_BIT_TOKEN: '0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d',
    USDC:            '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    CHAIN_ID:        421614,
    CHAIN_NAME:      'Arbitrum Sepolia'
};

// ── Full ABI (all functions used by the admin panel) ────────────
const TOKEN_SALE_ABI = [
    // State reads
    "function TOKENS_FOR_SALE() view returns (uint256)",
    "function tokensSold() view returns (uint256)",
    "function ethRaised() view returns (uint256)",
    "function usdcRaised() view returns (uint256)",
    "function saleStartTime() view returns (uint256)",
    "function saleEndTime() view returns (uint256)",
    "function tokensPerEth() view returns (uint256)",
    "function tokensPerUsdc() view returns (uint256)",
    "function minPurchaseUsdc() view returns (uint256)",
    "function maxPurchasePerWallet() view returns (uint256)",
    "function saleFinalized() view returns (bool)",
    "function paused() view returns (bool)",
    "function isSaleActive() view returns (bool)",
    "function getTimeRemaining() view returns (uint256)",
    "function getSaleProgress() view returns (uint256)",
    "function getBuyerCount() view returns (uint256)",
    "function getBuyers() view returns (address[])",
    "function purchasedTokens(address buyer) view returns (uint256)",
    "function tokensClaimed(address buyer) view returns (bool)",
    "function spentEth(address buyer) view returns (uint256)",
    "function spentUsdc(address buyer) view returns (uint256)",
    "function getPurchaseInfo(address buyer) view returns (uint256 tokens, uint256 eth, uint256 usdc)",
    // Write functions
    "function updatePrices(uint256 _tokensPerEth, uint256 _tokensPerUsdc) external",
    "function updateLimits(uint256 _minPurchaseUsdc, uint256 _maxPurchasePerWallet) external",
    "function pause() external",
    "function unpause() external",
    "function setSaleStartTime(uint256 newStartTime) external",
    "function extendSale(uint256 additionalTime) external",
    "function finalizeSale() external",
    "function withdrawFunds(address payable recipient) external",
    "function distributeTokens(uint256 startIndex, uint256 count) external",
    // Events (for log scanning if needed)
    "event TokensPurchased(address indexed buyer, uint256 amount, uint256 ethSpent, uint256 usdcSpent)",
    "event TokensDistributed(address indexed buyer, uint256 amount)",
    "event SaleScheduled(uint256 newStartTime, uint256 newEndTime)",
    "event SaleFinalized(uint256 tokensSold, uint256 tokensBurned, uint256 ethRaised, uint256 usdcRaised)",
    "event FundsWithdrawn(address indexed recipient, uint256 ethAmount, uint256 usdcAmount)",
];

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)",
];

// ── Admin wallets ────────────────────────────────────────────────
const ADMIN_ADDRESSES = [
    '0x80361876199e2318d6993a07e37177cfd21b64a7',
];

// ── Global state ─────────────────────────────────────────────────
let provider     = null;
let signer       = null;
let userAddress  = null;
let saleContract = null;
let tokenContract= null;
let usdcContract = null;
let isAdmin      = false;
let ethPrice     = 3000;   // Fallback ETH/USD price
let buyerCache   = [];     // Cached full buyer list from on-chain
let countdownInterval      = null;
let startCountdownInterval = null;
let saleEndTimestamp       = 0;
let saleStartTimestamp     = 0;

// ── Init ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupEventListeners();
    fetchEthPrice();
    setupPricePreviews();
});

// ═══════════════════════════════════════════════════════════════
//  TABS
// ═══════════════════════════════════════════════════════════════
function setupTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        });
    });
}

// ═══════════════════════════════════════════════════════════════
//  EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════
function setupEventListeners() {
    // Auth
    document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('refreshBtn').addEventListener('click', refreshData);

    // Schedule
    document.getElementById('btnStartNow').addEventListener('click', startSaleNow);
    document.getElementById('btnScheduleStart').addEventListener('click', scheduleSaleStart);
    document.getElementById('inputSaleStartDateTime').addEventListener('input', updateSchedulePreviews);

    // Sale controls
    document.getElementById('btnPauseSale').addEventListener('click', pauseSale);
    document.getElementById('btnUnpauseSale').addEventListener('click', unpauseSale);
    document.getElementById('btnExtendSale').addEventListener('click', extendSale);
    document.getElementById('btnWithdrawFunds').addEventListener('click', withdrawFunds);
    document.getElementById('btnFinalizeSale').addEventListener('click', finalizeSale);

    // Pricing & Limits
    document.getElementById('btnUpdatePrices').addEventListener('click', updatePrices);
    document.getElementById('btnUpdateLimits').addEventListener('click', updateLimits);

    // Distribution
    document.getElementById('btnDistribute').addEventListener('click', distributeTokens);
    document.getElementById('btnDistributeAll').addEventListener('click', distributeAll);
    document.getElementById('btnDistributeNext50').addEventListener('click', () => distributeNext(50));
    document.getElementById('btnDistributeNext100').addEventListener('click', () => distributeNext(100));
    document.getElementById('btnCheckDistStatus').addEventListener('click', checkDistributionStatus);

    // Buyers
    document.getElementById('btnLoadBuyers').addEventListener('click', loadBuyersOnChain);
    document.getElementById('btnExportCSV').addEventListener('click', exportCSV);

    // Live preview for pricing
    document.getElementById('inputTokensPerEth').addEventListener('input', updatePricePreviews);
    document.getElementById('inputTokensPerUsdc').addEventListener('input', updatePricePreviews);
}

// ═══════════════════════════════════════════════════════════════
//  WALLET / AUTH
// ═══════════════════════════════════════════════════════════════
async function connectWallet() {
    if (typeof window.ethereum === 'undefined') {
        showLoginError('Please install MetaMask or another Web3 wallet.');
        return;
    }
    try {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        provider    = new ethers.providers.Web3Provider(window.ethereum);
        signer      = provider.getSigner();
        userAddress = await signer.getAddress();

        const network = await provider.getNetwork();
        if (network.chainId !== CONTRACTS.CHAIN_ID) {
            await switchNetwork();
            return;
        }
        if (!ADMIN_ADDRESSES.includes(userAddress.toLowerCase())) {
            showLoginError('Access denied: this wallet is not authorized.');
            return;
        }

        // ── Firebase Auth sign-in via wallet signature ────────────────
        // Always sign in fresh to guarantee a valid token for protected
        // callable functions (getAllPurchases etc. check request.auth).
        const auth = firebase.auth();
        // Sign out any stale session so we always obtain a fresh ID token.
        await auth.signOut();
        const nonce = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
        const timestamp = Date.now();
        const isoTimestamp = new Date(timestamp).toISOString();
        const sep = '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
        const message = [
            sep,
            '       🎮 8-BIT ARCADE 🎮',
            sep,
            '',
            'Sign in to 8-Bit Arcade to access ranked games, leaderboards, and earn rewards.',
            '',
            'Please sign this message to verify your wallet ownership.',
            'This action will NOT cost any gas fees.',
            '',
            sep,
            '',
            'Action: Sign In',
            '',
            `Address: ${userAddress}`,
            '',
            `Nonce: ${nonce}`,
            '',
            `Timestamp: ${timestamp}`,
            `ISO-Time: ${isoTimestamp}`,
            '',
            sep,
        ].join('\n');

        const signature = await signer.signMessage(message);
        const verifyWalletFn = functions.httpsCallable('verifyWallet');
        const result = await verifyWalletFn({ address: userAddress, message, signature });
        await auth.signInWithCustomToken(result.data.customToken);
        // Confirm auth is active AND force-refresh the ID token so the
        // callable SDK has a valid bearer token before hitting getAllPurchases.
        await new Promise((resolve, reject) => {
            const unsub = auth.onAuthStateChanged(user => {
                unsub();
                if (user) {
                    // forceRefresh=true guarantees a brand-new ID token from Firebase servers
                    user.getIdToken(true).then(resolve).catch(reject);
                } else {
                    reject(new Error('Firebase sign-in did not produce a user'));
                }
            });
        });

        saleContract  = new ethers.Contract(CONTRACTS.TOKEN_SALE,      TOKEN_SALE_ABI, signer);
        tokenContract = new ethers.Contract(CONTRACTS.EIGHT_BIT_TOKEN, ERC20_ABI,      provider);
        usdcContract  = new ethers.Contract(CONTRACTS.USDC,            ERC20_ABI,      provider);

        isAdmin = true;
        document.getElementById('loginScreen').classList.add('hidden');
        document.getElementById('adminPanel').classList.remove('hidden');
        document.getElementById('adminAddress').textContent =
            userAddress.slice(0, 6) + '...' + userAddress.slice(-4);

        await refreshData();

        // Watch for network/account changes
        window.ethereum.on('accountsChanged', () => logout());
        window.ethereum.on('chainChanged',    () => window.location.reload());
    } catch (err) {
        showLoginError('Failed to connect: ' + err.message);
    }
}

async function switchNetwork() {
    try {
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + CONTRACTS.CHAIN_ID.toString(16) }],
        });
        setTimeout(connectWallet, 1000);
    } catch {
        showLoginError('Please switch to ' + CONTRACTS.CHAIN_NAME + ' in your wallet.');
    }
}

function logout() {
    isAdmin = false; provider = null; signer = null;
    userAddress = null; saleContract = null;
    if (countdownInterval)      clearInterval(countdownInterval);
    if (startCountdownInterval) clearInterval(startCountdownInterval);
    document.getElementById('adminPanel').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════════════
//  REFRESH  –  loads all data sections in parallel
// ═══════════════════════════════════════════════════════════════
async function refreshData() {
    if (!isAdmin) return;
    try {
        await Promise.all([
            loadContractState(),
            loadPurchaseHistory(),
        ]);
        showStatus('Data refreshed.', 'success', 3000);
    } catch (err) {
        showStatus('Error refreshing data: ' + err.message, 'error');
        console.error(err);
    }
}

// ─── Master contract state loader ───────────────────────────────
async function loadContractState() {
    if (!saleContract) return;

    // Fetch all read values in parallel
    const [
        tokensSold, ethRaised, usdcRaised,
        saleStartTime, saleEndTime,
        tokensPerEth, tokensPerUsdc,
        minPurchaseUsdc, maxPurchasePerWallet,
        saleFinalized, paused, buyerCount,
        tokenBalance, ethBalance, usdcBalance,
    ] = await Promise.all([
        saleContract.tokensSold(),
        saleContract.ethRaised(),
        saleContract.usdcRaised(),
        saleContract.saleStartTime(),
        saleContract.saleEndTime(),
        saleContract.tokensPerEth(),
        saleContract.tokensPerUsdc(),
        saleContract.minPurchaseUsdc(),
        saleContract.maxPurchasePerWallet(),
        saleContract.saleFinalized(),
        saleContract.paused(),
        saleContract.getBuyerCount(),
        tokenContract.balanceOf(CONTRACTS.TOKEN_SALE),
        provider.getBalance(CONTRACTS.TOKEN_SALE),
        usdcContract.balanceOf(CONTRACTS.TOKEN_SALE),
    ]);

    // Derived numbers
    const soldF       = parseFloat(ethers.utils.formatEther(tokensSold));
    const totalF      = 200_000_000;
    const pct         = Math.min((soldF / totalF) * 100, 100).toFixed(1);
    const ethRaisedF  = parseFloat(ethers.utils.formatEther(ethRaised));
    const usdcRaisedF = parseFloat(ethers.utils.formatUnits(usdcRaised, 6));
    const totalUsd    = ethRaisedF * ethPrice + usdcRaisedF;
    const tpeF        = parseFloat(ethers.utils.formatEther(tokensPerEth));
    const tpuF        = parseFloat(ethers.utils.formatEther(tokensPerUsdc));
    const tokenBalF   = parseFloat(ethers.utils.formatEther(tokenBalance));
    const ethBalF     = parseFloat(ethers.utils.formatEther(ethBalance));
    const usdcBalF    = parseFloat(ethers.utils.formatUnits(usdcBalance, 6));
    const minPurchUsd = parseFloat(ethers.utils.formatUnits(minPurchaseUsdc, 6));
    const maxTokensF  = parseFloat(ethers.utils.formatEther(maxPurchasePerWallet));

    const now          = Math.floor(Date.now() / 1000);
    const startTs      = saleStartTime.toNumber();
    const endTs        = saleEndTime.toNumber();
    saleEndTimestamp   = endTs;
    saleStartTimestamp = startTs;
    const notConfigured = !saleFinalized && startTs === 0; // contract deployed but never started
    const isUpcoming   = !saleFinalized && startTs > 0 && now < startTs;
    const isActive     = !saleFinalized && !paused && startTs > 0 && now >= startTs && now < endTs;
    const isEnded      = !saleFinalized && startTs > 0 && now >= endTs;
    const buyers       = buyerCount.toNumber();

    // ── Status Banner ─────────────────────────────────────────
    const banner = document.getElementById('saleBanner');
    const bannerText = document.getElementById('bannerText');
    banner.className = '';
    if (saleFinalized) {
        banner.classList.add('banner-finalized');
        bannerText.textContent = 'SALE FINALIZED — Distribute tokens to buyers via the Token Distribution tab.';
    } else if (notConfigured) {
        banner.classList.add('banner-paused');
        bannerText.textContent = 'SALE NOT STARTED — Go to Sale Controls and click "Start Sale NOW" to launch.';
    } else if (paused) {
        banner.classList.add('banner-paused');
        bannerText.textContent = 'SALE PAUSED — Purchases are halted. Use Sale Controls to resume.';
    } else if (isEnded) {
        banner.classList.add('banner-ended');
        bannerText.textContent = 'SALE ENDED — Finalize the sale to burn unsold tokens, then distribute.';
    } else if (isUpcoming) {
        banner.classList.add('banner-paused');
        bannerText.textContent = 'SALE SCHEDULED — Starting ' + fmtDatetime(new Date(startTs * 1000)) + '. Use Sale Controls to change the start time.';
    } else {
        banner.classList.add('banner-active');
        bannerText.textContent = 'SALE ACTIVE — Accepting purchases.';
    }

    // ── Stats Cards ───────────────────────────────────────────
    const statusLabel = saleFinalized ? 'FINALIZED'
                      : notConfigured  ? 'NOT STARTED'
                      : paused         ? 'PAUSED'
                      : isEnded        ? 'ENDED'
                      : isActive       ? 'ACTIVE' : 'UPCOMING';
    document.getElementById('statStatus').textContent    = statusLabel;
    document.getElementById('statStatusSub').textContent = saleFinalized
        ? 'Tokens burned & locked'
        : paused ? 'Purchases halted' : '';

    document.getElementById('statRaised').textContent   = '$' + fmtNum(totalUsd);
    document.getElementById('statRaisedSub').textContent = ethRaisedF.toFixed(3) + ' ETH + $' + fmtNum(usdcRaisedF) + ' USDC';
    document.getElementById('statPct').textContent      = pct + '%';
    document.getElementById('progBar').style.width      = pct + '%';
    document.getElementById('statTokensSold').textContent = fmtNum(soldF) + ' / ' + fmtNum(totalF) + ' 8BIT';

    document.getElementById('statEth').textContent     = ethBalF.toFixed(4) + ' ETH';
    document.getElementById('statEthUsd').textContent  = '≈ $' + fmtNum(ethBalF * ethPrice);
    document.getElementById('statUsdc').textContent    = '$' + fmtNum(usdcBalF);
    document.getElementById('statBuyers').textContent  = buyers.toString();

    // ── Countdown ────────────────────────────────────────────
    if (countdownInterval)      clearInterval(countdownInterval);
    if (startCountdownInterval) clearInterval(startCountdownInterval);

    if (saleFinalized || (startTs > 0 && now >= endTs)) {
        document.getElementById('statCountdown').textContent = 'ENDED';
    } else if (notConfigured) {
        document.getElementById('statCountdown').textContent = '--:--:--';
    } else if (!isUpcoming) {
        startCountdown(endTs);
    }
    document.getElementById('statEndDate').textContent =
        endTs > 0 ? new Date(endTs * 1000).toLocaleDateString() : 'Not set';

    // STARTS IN card — show only when sale is upcoming
    const cardTimeToStart   = document.getElementById('cardTimeToStart');
    const cardTimeRemaining = document.getElementById('cardTimeRemaining');
    if (isUpcoming) {
        cardTimeToStart.classList.remove('hidden');
        cardTimeRemaining.classList.add('hidden');
        document.getElementById('statStartDate').textContent = 'on ' + new Date(startTs * 1000).toLocaleDateString();
        startStartCountdown(startTs);
    } else {
        cardTimeToStart.classList.add('hidden');
        cardTimeRemaining.classList.remove('hidden');
    }

    // Schedule panel: show whenever sale is not finalized and not currently active
    // (covers "not yet started", "upcoming", or "ended but not finalized" states)
    const panelSchedule = document.getElementById('panelScheduleStart');
    if (panelSchedule) panelSchedule.style.display = (!saleFinalized && !isActive) ? '' : 'none';

    // Pre-fill datetime picker with current start time if sale not yet started
    if (isUpcoming) {
        const dtInput = document.getElementById('inputSaleStartDateTime');
        if (dtInput && !dtInput.value) {
            // Convert unix → datetime-local value (local time, no seconds)
            const d = new Date(startTs * 1000);
            const pad2 = n => String(n).padStart(2, '0');
            dtInput.value = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
                          + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
            updateSchedulePreviews();
        }
    }
    document.getElementById('dispEndDate') && (document.getElementById('dispEndDate').textContent = new Date(endTs * 1000).toLocaleString());

    // ── Overview Tab ─────────────────────────────────────────
    document.getElementById('dispStartTime').value = fmtDatetime(new Date(startTs * 1000));
    document.getElementById('dispEndTime').value   = fmtDatetime(new Date(endTs * 1000));
    const secsLeft = Math.max(endTs - now, 0);
    document.getElementById('dispTimeLeft').value  = secsLeft > 0 ? fmtDuration(secsLeft) : 'Sale ended';

    document.getElementById('dispTokensPerEth').value  = fmtNum(tpeF) + ' 8BIT / ETH';
    document.getElementById('dispTokensPerUsdc').value = fmtNum(tpuF) + ' 8BIT / USDC';
    const effPrice = tpuF > 0 ? (1 / tpuF).toFixed(6) : '0';
    document.getElementById('dispTokenPrice').value    = '$' + effPrice + ' per 8BIT';

    document.getElementById('dispMinPurchase').value  = '$' + minPurchUsd.toFixed(2) + ' USDC minimum';
    document.getElementById('dispMaxPurchase').value  = fmtNum(maxTokensF) + ' 8BIT per wallet';

    document.getElementById('disp8bitBalance').value = fmtNum(tokenBalF) + ' 8BIT';
    document.getElementById('dispEthBalance').value  = ethBalF.toFixed(6) + ' ETH';
    document.getElementById('dispUsdcBalance').value = '$' + usdcBalF.toFixed(2) + ' USDC';

    // ── Pricing tab: populate current values as hints ────────
    document.getElementById('hintTokensPerEth').textContent  = fmtNum(tpeF);
    document.getElementById('hintTokensPerUsdc').textContent = fmtNum(tpuF);
    document.getElementById('hintMinPurchase').textContent   = '$' + minPurchUsd.toFixed(2);
    document.getElementById('hintMaxTokens').textContent     = fmtNum(maxTokensF);

    // Pre-populate pricing inputs if empty
    if (!document.getElementById('inputTokensPerEth').value)
        document.getElementById('inputTokensPerEth').value = Math.round(tpeF);
    if (!document.getElementById('inputTokensPerUsdc').value)
        document.getElementById('inputTokensPerUsdc').value = Math.round(tpuF);
    if (!document.getElementById('inputMinPurchaseUsd').value)
        document.getElementById('inputMinPurchaseUsd').value = minPurchUsd.toFixed(2);
    if (!document.getElementById('inputMaxTokens').value)
        document.getElementById('inputMaxTokens').value = Math.round(maxTokensF);

    updatePricePreviews();

    // ── Distribution Tab status ───────────────────────────────
    document.getElementById('distTotalBuyers').textContent = buyers;
    const canDistribute = saleFinalized;
    ['btnDistribute','btnDistributeAll','btnDistributeNext50','btnDistributeNext100'].forEach(id => {
        document.getElementById(id).disabled = !canDistribute;
    });
    document.getElementById('distRequirement').style.display = canDistribute ? 'none' : 'block';
    if (canDistribute) {
        document.getElementById('inputDistCount').value = Math.min(100, buyers) || 100;
    }
}

// ─── Countdown to end ────────────────────────────────────────────
function startCountdown(endTs) {
    const el = document.getElementById('statCountdown');
    const update = () => {
        const secs = Math.max(endTs - Math.floor(Date.now() / 1000), 0);
        el.textContent = fmtDuration(secs);
        if (secs <= 86400) el.classList.add('urgent');
        else               el.classList.remove('urgent');
        if (secs === 0) clearInterval(countdownInterval);
    };
    update();
    countdownInterval = setInterval(update, 1000);
}

// ─── Countdown to start (for UPCOMING state) ─────────────────────
function startStartCountdown(startTs) {
    const el = document.getElementById('statStartCountdown');
    const update = () => {
        const secs = Math.max(startTs - Math.floor(Date.now() / 1000), 0);
        el.textContent = fmtDuration(secs);
        if (secs === 0) {
            clearInterval(startCountdownInterval);
            refreshData(); // reload — sale may now be active
        }
    };
    update();
    startCountdownInterval = setInterval(update, 1000);
}

// ═══════════════════════════════════════════════════════════════
//  PURCHASE HISTORY  (Firebase)
// ═══════════════════════════════════════════════════════════════
async function loadPurchaseHistory() {
    const tbody = document.getElementById('purchasesTableBody');
    try {
        const getAllPurchases = functions.httpsCallable('getAllPurchases');
        const result = await getAllPurchases({ limit: 100 });
        const purchases = result.data || [];

        if (purchases.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#555;">No purchases recorded yet.</td></tr>';
            return;
        }
        tbody.innerHTML = purchases.map(p => {
            const tokens = fmtNum(parseFloat(ethers.utils.formatEther(p.tokenAmount || '0')));
            const payment = p.paymentMethod === 'ETH'
                ? parseFloat(ethers.utils.formatEther(p.ethSpent || '0')).toFixed(4) + ' ETH'
                : '$' + parseFloat(ethers.utils.formatUnits(p.usdcSpent || '0', 6)).toFixed(2) + ' USDC';
            const txUrl = 'https://sepolia.arbiscan.io/tx/' + p.txHash;
            return `<tr>
                <td>${new Date(p.timestamp).toLocaleString()}</td>
                <td class="addr">${p.buyer.slice(0,6)}...${p.buyer.slice(-4)}</td>
                <td>${tokens} 8BIT</td>
                <td>${payment}</td>
                <td><span class="badge badge-grey">${p.paymentMethod}</span></td>
                <td><a href="${txUrl}" target="_blank" style="color:#00ff88;">${p.txHash.slice(0,10)}...</a></td>
            </tr>`;
        }).join('');
    } catch {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#555;">Could not load from Firebase (may not be configured).</td></tr>';
    }
}

// ═══════════════════════════════════════════════════════════════
//  BUYERS  (on-chain)
// ═══════════════════════════════════════════════════════════════
async function loadBuyersOnChain() {
    const status = document.getElementById('buyerLoadStatus');
    const tbody  = document.getElementById('buyersTableBody');
    status.textContent = 'Loading buyers from chain...';
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;"><span class="spinner"></span> Loading...</td></tr>';

    try {
        const buyers = await saleContract.getBuyers();
        buyerCache = buyers;
        status.textContent = buyers.length + ' buyers loaded.';

        if (buyers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#555;">No buyers yet.</td></tr>';
            return;
        }

        // Batch-fetch purchase info and claim status
        status.textContent = 'Fetching purchase details...';
        const CHUNK = 20;
        const rows = [];
        for (let i = 0; i < buyers.length; i += CHUNK) {
            const chunk = buyers.slice(i, i + CHUNK);
            const infos = await Promise.all(chunk.map(addr => saleContract.getPurchaseInfo(addr)));
            const claims= await Promise.all(chunk.map(addr => saleContract.tokensClaimed(addr)));
            chunk.forEach((addr, j) => {
                const [tokens, eth, usdc] = infos[j];
                rows.push({
                    addr,
                    tokens: parseFloat(ethers.utils.formatEther(tokens)),
                    eth:    parseFloat(ethers.utils.formatEther(eth)),
                    usdc:   parseFloat(ethers.utils.formatUnits(usdc, 6)),
                    claimed: claims[j],
                });
            });
            status.textContent = `Fetching details... ${Math.min(i + CHUNK, buyers.length)}/${buyers.length}`;
        }

        tbody.innerHTML = rows.map((r, idx) => `
            <tr>
                <td>${idx + 1}</td>
                <td class="addr">${r.addr.slice(0,6)}...${r.addr.slice(-4)}
                    <a href="https://sepolia.arbiscan.io/address/${r.addr}" target="_blank" style="color:#555; margin-left:4px;">&#x2197;</a>
                </td>
                <td>${fmtNum(r.tokens)} 8BIT</td>
                <td>${r.eth.toFixed(4) === '0.0000' ? '—' : r.eth.toFixed(4) + ' ETH'}</td>
                <td>${r.usdc > 0 ? '$' + r.usdc.toFixed(2) : '—'}</td>
                <td>${r.claimed
                    ? '<span class="badge badge-green">Distributed</span>'
                    : '<span class="badge badge-yellow">Pending</span>'}</td>
            </tr>`).join('');

        // Update distribution stats while we're here
        const received = rows.filter(r => r.claimed).length;
        const pending  = rows.length - received;
        const totalAmt = rows.reduce((s, r) => s + r.tokens, 0);
        updateDistStats(rows.length, received, pending, totalAmt);
        status.textContent = `${buyers.length} buyers loaded. ${received} distributed, ${pending} pending.`;
    } catch (err) {
        status.textContent = 'Error: ' + err.message;
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#ff4444;">Error loading buyers.</td></tr>';
    }
}

function updateDistStats(total, received, pending, totalAmt) {
    document.getElementById('distTotalBuyers').textContent = total;
    document.getElementById('distReceived').textContent    = received;
    document.getElementById('distPending').textContent     = pending;
    document.getElementById('distTotalAmt').textContent    = fmtNum(totalAmt);
    document.getElementById('statDistributed').textContent = received + '/' + total;
    document.getElementById('statDistributedSub').textContent = 'buyers received tokens';
    const pct = total > 0 ? ((received / total) * 100).toFixed(0) : 0;
    document.getElementById('distProgBar').style.width = pct + '%';
    document.getElementById('distPctLabel').textContent = pct + '%';
}

function exportCSV() {
    if (!buyerCache.length) {
        showStatus('Load buyers first.', 'warning');
        return;
    }
    const rows = [['Index','Address','Tokens','ETH Spent','USDC Spent','Distributed']];
    const tbody = document.getElementById('buyersTableBody');
    const trs = tbody.querySelectorAll('tr');
    trs.forEach((tr, i) => {
        const tds = tr.querySelectorAll('td');
        if (tds.length < 6) return;
        rows.push([
            tds[0].textContent.trim(),
            tds[1].textContent.trim().replace(/\s+/g, ''),
            tds[2].textContent.trim(),
            tds[3].textContent.trim(),
            tds[4].textContent.trim(),
            tds[5].textContent.trim(),
        ]);
    });
    const csv = rows.map(r => r.map(c => '"' + c + '"').join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = '8bit_buyers.csv'; a.click();
    URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
//  DISTRIBUTION STATUS CHECK
// ═══════════════════════════════════════════════════════════════
async function checkDistributionStatus() {
    if (!saleContract) return;
    showStatus('Checking distribution status on-chain...', 'info');
    try {
        const buyers = await saleContract.getBuyers();
        buyerCache = buyers;
        const total = buyers.length;
        if (total === 0) {
            showStatus('No buyers found on-chain.', 'warning');
            return;
        }

        let received = 0;
        let firstPending = -1;
        const CHUNK = 20;
        for (let i = 0; i < total; i += CHUNK) {
            const chunk = buyers.slice(i, i + CHUNK);
            const claims = await Promise.all(chunk.map(a => saleContract.tokensClaimed(a)));
            claims.forEach((claimed, j) => {
                if (claimed) received++;
                else if (firstPending < 0) firstPending = i + j;
            });
        }

        const pending = total - received;
        document.getElementById('nextDistIndex').textContent =
            firstPending >= 0 ? firstPending.toString() : 'All distributed!';
        if (firstPending >= 0) {
            document.getElementById('inputDistStart').value = firstPending;
        }

        updateDistStats(total, received, pending, 0);
        showStatus(`${received}/${total} buyers have received tokens. ${pending} pending.`, 'success');
    } catch (err) {
        showStatus('Error checking status: ' + err.message, 'error');
    }
}

// ═══════════════════════════════════════════════════════════════
//  CONTRACT WRITE ACTIONS
// ═══════════════════════════════════════════════════════════════

// ─── Pause ──────────────────────────────────────────────────────
async function pauseSale() {
    if (!guardAdmin()) return;
    if (!confirm('Pause the sale? No one will be able to purchase tokens until you unpause.')) return;
    await sendTx(
        () => saleContract.pause(),
        'Pausing sale...',
        'Sale paused successfully.',
        'Error pausing sale'
    );
}

// ─── Unpause ─────────────────────────────────────────────────────
async function unpauseSale() {
    if (!guardAdmin()) return;
    await sendTx(
        () => saleContract.unpause(),
        'Resuming sale...',
        'Sale resumed successfully.',
        'Error resuming sale'
    );
}

// ─── Extend ──────────────────────────────────────────────────────
async function extendSale() {
    if (!guardAdmin()) return;
    const days  = parseFloat(document.getElementById('inputExtendDays').value)  || 0;
    const hours = parseFloat(document.getElementById('inputExtendHours').value) || 0;
    const totalSecs = Math.round((days * 86400) + (hours * 3600));
    if (totalSecs <= 0) {
        showStatus('Enter a positive number of days or hours to extend.', 'error');
        return;
    }
    const label = [days > 0 ? days + ' day(s)' : null, hours > 0 ? hours + ' hour(s)' : null].filter(Boolean).join(' and ');
    if (!confirm('Extend the sale by ' + label + '?')) return;
    await sendTx(
        () => saleContract.extendSale(totalSecs),
        'Extending sale...',
        'Sale extended by ' + label + '.',
        'Error extending sale'
    );
}

// ─── Start Sale Immediately ───────────────────────────────────────
async function startSaleNow() {
    if (!guardAdmin()) return;
    const newStartTs = Math.floor(Date.now() / 1000) + 60; // starts in ~60 seconds
    const endTs      = newStartTs + 6 * 7 * 24 * 3600;    // 6 weeks duration
    const startStr   = fmtDatetime(new Date(newStartTs * 1000));
    const endStr     = fmtDatetime(new Date(endTs * 1000));
    if (!confirm('Start the sale NOW?\n\nStart: ' + startStr + '\nEnd (6 wks): ' + endStr + '\n\nThe sale will become live within ~60 seconds.')) return;
    await sendTx(
        () => saleContract.setSaleStartTime(newStartTs),
        'Starting sale now...',
        'Sale started! Goes live in ~60 seconds. Start: ' + startStr,
        'Error starting sale'
    );
}

// ─── Schedule Sale Start ─────────────────────────────────────────
async function scheduleSaleStart() {
    if (!guardAdmin()) return;
    const dtVal = document.getElementById('inputSaleStartDateTime').value;
    if (!dtVal) {
        showStatus('Pick a start date and time first.', 'error');
        return;
    }
    const newStartTs = Math.floor(new Date(dtVal).getTime() / 1000);
    if (isNaN(newStartTs) || newStartTs <= Math.floor(Date.now() / 1000)) {
        showStatus('Start time must be in the future.', 'error');
        return;
    }
    const endTs   = newStartTs + 6 * 7 * 24 * 3600; // 6 weeks
    const startStr = fmtDatetime(new Date(newStartTs * 1000));
    const endStr   = fmtDatetime(new Date(endTs * 1000));
    if (!confirm('Schedule sale start?\n\nStart: ' + startStr + '\nEnd:   ' + endStr + '\n\nThis replaces the current start time.')) return;
    await sendTx(
        () => saleContract.setSaleStartTime(newStartTs),
        'Scheduling sale start...',
        'Sale start time updated! Starts: ' + startStr,
        'Error scheduling sale start'
    );
    document.getElementById('inputSaleStartDateTime').value = '';
}

function updateSchedulePreviews() {
    const dtVal = document.getElementById('inputSaleStartDateTime').value;
    const startPrev = document.getElementById('previewStartTime');
    const endPrev   = document.getElementById('previewEndTime');
    if (!dtVal) {
        startPrev.textContent = '--';
        endPrev.textContent   = '--';
        return;
    }
    const startTs = Math.floor(new Date(dtVal).getTime() / 1000);
    const endTs   = startTs + 6 * 7 * 24 * 3600;
    startPrev.textContent = fmtDatetime(new Date(startTs * 1000));
    endPrev.textContent   = fmtDatetime(new Date(endTs   * 1000));
}

// ─── Withdraw Funds ──────────────────────────────────────────────
async function withdrawFunds() {
    if (!guardAdmin()) return;
    const recipient = document.getElementById('inputWithdrawAddress').value.trim();
    if (!ethers.utils.isAddress(recipient)) {
        showStatus('Enter a valid recipient address.', 'error');
        return;
    }
    if (!confirm('Withdraw ALL ETH and USDC from the contract to ' + recipient + '?\n\nThis does NOT affect 8BIT tokens held for distribution.')) return;
    await sendTx(
        () => saleContract.withdrawFunds(recipient),
        'Withdrawing funds...',
        'Funds withdrawn to ' + recipient.slice(0,8) + '...',
        'Error withdrawing funds'
    );
}

// ─── Finalize ────────────────────────────────────────────────────
async function finalizeSale() {
    if (!guardAdmin()) return;
    const confirmation = document.getElementById('inputFinalizeConfirm').value.trim();
    if (confirmation !== 'FINALIZE') {
        showStatus('Type FINALIZE in the confirmation field to proceed.', 'error');
        return;
    }
    if (!confirm('FINAL WARNING: This will permanently burn all unsold 8BIT tokens and lock the sale. This CANNOT be undone. Are you 100% sure?')) return;
    await sendTx(
        () => saleContract.finalizeSale(),
        'Finalizing sale... Please confirm in your wallet.',
        'Sale finalized! Unsold tokens burned. You can now distribute to buyers.',
        'Error finalizing sale'
    );
    document.getElementById('inputFinalizeConfirm').value = '';
}

// ─── Update Prices ───────────────────────────────────────────────
async function updatePrices() {
    if (!guardAdmin()) return;
    const tpeRaw = document.getElementById('inputTokensPerEth').value;
    const tpuRaw = document.getElementById('inputTokensPerUsdc').value;
    if (!tpeRaw || !tpuRaw || isNaN(tpeRaw) || isNaN(tpuRaw) || +tpeRaw <= 0 || +tpuRaw <= 0) {
        showStatus('Enter valid positive values for both prices.', 'error');
        return;
    }
    const tpeWei = ethers.utils.parseEther(Math.round(+tpeRaw).toString());
    const tpuWei = ethers.utils.parseEther(Math.round(+tpuRaw).toString());
    if (!confirm('Update prices?\n• Tokens per ETH:  ' + fmtNum(+tpeRaw) + '\n• Tokens per USDC: ' + fmtNum(+tpuRaw))) return;
    await sendTx(
        () => saleContract.updatePrices(tpeWei, tpuWei),
        'Updating prices...',
        'Prices updated successfully.',
        'Error updating prices'
    );
}

// ─── Update Limits ───────────────────────────────────────────────
async function updateLimits() {
    if (!guardAdmin()) return;
    const minUsd  = parseFloat(document.getElementById('inputMinPurchaseUsd').value);
    const maxToks = parseFloat(document.getElementById('inputMaxTokens').value);
    if (isNaN(minUsd) || isNaN(maxToks) || minUsd < 0 || maxToks <= 0) {
        showStatus('Enter valid values for minimum USD and maximum tokens.', 'error');
        return;
    }
    // minPurchaseUsdc uses 6 decimals (USDC), maxPurchasePerWallet uses 18 decimals (8BIT)
    const minWei = ethers.utils.parseUnits(minUsd.toFixed(6), 6);
    const maxWei = ethers.utils.parseEther(Math.round(maxToks).toString());
    if (!confirm('Update limits?\n• Minimum purchase: $' + minUsd.toFixed(2) + ' USDC\n• Max per wallet: ' + fmtNum(maxToks) + ' 8BIT')) return;
    await sendTx(
        () => saleContract.updateLimits(minWei, maxWei),
        'Updating limits...',
        'Purchase limits updated.',
        'Error updating limits'
    );
}

// ─── Distribute batch ────────────────────────────────────────────
async function distributeTokens() {
    if (!guardAdmin()) return;
    const startIndex = parseInt(document.getElementById('inputDistStart').value) || 0;
    const count      = parseInt(document.getElementById('inputDistCount').value)  || 50;
    if (count <= 0) { showStatus('Count must be positive.', 'error'); return; }
    if (!confirm('Distribute tokens to buyers ' + startIndex + ' through ' + (startIndex + count - 1) + '?')) return;
    const result = await sendTx(
        () => saleContract.distributeTokens(startIndex, count),
        'Distributing tokens (batch ' + startIndex + '-' + (startIndex + count) + ')...',
        'Batch distributed! Advance start index for next batch.',
        'Error distributing tokens'
    );
    if (result) {
        // Advance start index for next call
        document.getElementById('inputDistStart').value = startIndex + count;
    }
}

async function distributeAll() {
    if (!guardAdmin()) return;
    const totalBuyers = parseInt(document.getElementById('distTotalBuyers').textContent) || 0;
    if (totalBuyers === 0) {
        showStatus('No buyers found. Refresh data first.', 'error');
        return;
    }
    if (!confirm('Distribute tokens to ALL ' + totalBuyers + ' buyers in a single transaction?\n\nThis may fail with a gas limit error if there are many buyers. Use batches of 50-100 for safety.')) return;
    await sendTx(
        () => saleContract.distributeTokens(0, totalBuyers),
        'Distributing tokens to all ' + totalBuyers + ' buyers...',
        'All tokens distributed!',
        'Error distributing tokens (try using batches instead)'
    );
}

async function distributeNext(batchSize) {
    if (!guardAdmin()) return;
    // Find next undistributed batch start via stored nextDistIndex, or fallback to 0
    const nextIdx = parseInt(document.getElementById('nextDistIndex').textContent) || 0;
    if (isNaN(nextIdx) || nextIdx < 0) {
        showStatus('All buyers already distributed, or run "Check Distribution Status" first.', 'warning');
        return;
    }
    document.getElementById('inputDistStart').value = nextIdx;
    document.getElementById('inputDistCount').value = batchSize;
    await distributeTokens();
}

// ═══════════════════════════════════════════════════════════════
//  PRICING PREVIEW
// ═══════════════════════════════════════════════════════════════
function setupPricePreviews() { updatePricePreviews(); }

function updatePricePreviews() {
    const tpe = parseFloat(document.getElementById('inputTokensPerEth').value) || 0;
    const tpu = parseFloat(document.getElementById('inputTokensPerUsdc').value) || 0;
    document.getElementById('previewEth').textContent   = tpe > 0 ? fmtNum(tpe) + ' 8BIT per ETH' : '--';
    document.getElementById('previewUsdc').textContent  = tpu > 0 ? fmtNum(tpu) + ' 8BIT per USDC' : '--';
    document.getElementById('previewPrice').textContent = tpu > 0 ? '$' + (1 / tpu).toFixed(6) + ' per 8BIT' : '--';
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

// Generic tx wrapper with status feedback
async function sendTx(txFn, pendingMsg, successMsg, errorPrefix) {
    showStatus(pendingMsg, 'warning');
    try {
        const tx = await txFn();
        showStatus(pendingMsg + ' Waiting for confirmation...', 'warning');
        await tx.wait();
        showStatus(successMsg, 'success');
        await loadContractState();
        return true;
    } catch (err) {
        const msg = err?.reason || err?.data?.message || err.message || 'Unknown error';
        showStatus(errorPrefix + ': ' + msg, 'error');
        console.error(errorPrefix, err);
        return false;
    }
}

function guardAdmin() {
    if (!isAdmin || !saleContract) {
        showStatus('Not authenticated or contract not loaded.', 'error');
        return false;
    }
    return true;
}

function showStatus(msg, type, autoClearMs = 0) {
    const el = document.getElementById('globalStatus');
    el.className = 'status-' + type;
    el.innerHTML = '<span>' + msg + '</span>';
    el.style.display = 'flex';
    if (autoClearMs > 0) setTimeout(() => { el.style.display = 'none'; }, autoClearMs);
}

function showLoginError(msg) {
    const el = document.getElementById('loginError');
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 6000);
}

// Number formatter
function fmtNum(n) {
    const v = parseFloat(n);
    if (isNaN(v)) return '0';
    if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M';
    if (v >= 1_000)     return (v / 1_000).toFixed(2) + 'K';
    return v.toLocaleString();
}

// Duration formatter (seconds → Xd Xh Xm Xs)
function fmtDuration(secs) {
    const d = Math.floor(secs / 86400);
    const h = Math.floor((secs % 86400) / 3600);
    const m = Math.floor((secs % 3600)  / 60);
    const s = secs % 60;
    if (d > 0)  return d + 'd ' + pad(h) + 'h ' + pad(m) + 'm';
    if (h > 0)  return pad(h) + 'h ' + pad(m) + 'm ' + pad(s) + 's';
    return pad(m) + 'm ' + pad(s) + 's';
}

function pad(n) { return String(n).padStart(2, '0'); }

function fmtDatetime(date) {
    return date.toLocaleString(undefined, {
        year:'numeric', month:'short', day:'numeric',
        hour:'2-digit', minute:'2-digit', timeZoneName:'short'
    });
}

// ETH price fetch (coingecko)
async function fetchEthPrice() {
    try {
        const resp = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
        const data = await resp.json();
        if (data?.ethereum?.usd) ethPrice = data.ethereum.usd;
    } catch { /* use fallback */ }
}
