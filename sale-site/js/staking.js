// 8BIT Staking - Contract Interactions
// Network: Arbitrum Sepolia (Testnet)
// Version: 2.1.0 - Added explicit gas limit to fix MetaMask estimation issues

const NETWORK_CONFIG = {
    chainId: '0x66eee', // 421614 in hex
    chainName: 'Arbitrum Sepolia',
    rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://sepolia.arbiscan.io'],
    nativeCurrency: {
        name: 'ETH',
        symbol: 'ETH',
        decimals: 18
    }
};

// Direct RPC provider for read operations (bypasses MetaMask's potentially bad RPC)
const DIRECT_RPC = 'https://sepolia-rollup.arbitrum.io/rpc';

const CONTRACT_ADDRESSES = {
    TOKEN: '0xC1C665D66A9F8433cBBD4e70a543eDc19C56707d',
    STAKING: '0xC193451f59De0df09EC8359D091F8890A80F20c4'
};

// Minimal ABIs for the contracts
const TOKEN_ABI = [
    'function balanceOf(address account) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
];

const STAKING_ABI = [
    // Core staking functions
    'function stake(uint256 amount, uint8 lockTier) external',
    'function withdraw(uint256 stakeId) external',
    'function claimReward(uint256 stakeId) external',
    'function claimAllRewards() external',
    'function emergencyWithdraw(uint256 stakeId) external',

    // View functions - user data
    'function getUserStakes(address account) view returns (uint256[] amounts, uint256[] unlockTimes, uint256[] rewards, uint8[] tiers)',
    'function userTotalStaked(address) view returns (uint256)',
    'function userStakeCount(address) view returns (uint256)',
    'function earned(address account, uint256 stakeId) view returns (uint256)',
    'function totalEarned(address account) view returns (uint256)',

    // View functions - pool stats
    'function getStakingStats() view returns (uint256 totalRawStake, uint256 totalWeightedStake, uint256 totalRewardsDistributed, uint256 remainingRewards, uint256 stakingStartTime, uint256 timeRemaining)',
    'function totalRawStake() view returns (uint256)',
    'function totalWeightedStake() view returns (uint256)',
    'function totalRewardsDistributed() view returns (uint256)',
    'function stakingStartTime() view returns (uint256)',
    'function rewardPerWeightedToken() view returns (uint256)',

    // Constants
    'function TOTAL_STAKING_POOL() view returns (uint256)',
    'function DISTRIBUTION_PERIOD() view returns (uint256)',
    'function MIN_STAKE_AMOUNT() view returns (uint256)',
    'function MAX_STAKES_PER_USER() view returns (uint256)',
    'function EARLY_WITHDRAWAL_PENALTY_BPS() view returns (uint256)',

    // Tier info
    'function getLockDuration(uint8 tier) view returns (uint256)',
    'function getWeightMultiplier(uint8 tier) view returns (uint256)',
    'function getEstimatedAPY(uint8 tier) view returns (uint256)',

    // Pausable
    'function paused() view returns (bool)',

    // Events
    'event Staked(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 weightedAmount, uint8 tier)',
    'event Withdrawn(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 penalty)',
    'event RewardClaimed(address indexed user, uint256 indexed stakeId, uint256 reward)'
];

// Lock tier configurations
const LOCK_TIERS = [
    { name: '7 Days', duration: 7 * 24 * 60 * 60, weight: 10000, multiplier: '1x' },
    { name: '1 Month', duration: 30 * 24 * 60 * 60, weight: 15000, multiplier: '1.5x' },
    { name: '3 Months', duration: 90 * 24 * 60 * 60, weight: 20000, multiplier: '2x' },
    { name: '6 Months', duration: 180 * 24 * 60 * 60, weight: 30000, multiplier: '3x' }
];

// State
let provider = null;
let signer = null;
let userAddress = null;
let tokenContract = null;
let stakingContract = null;
let selectedTier = 2; // Default to 3 months
let walletProvider = null; // The actual wallet provider (bypasses aggregators)

// DOM Elements
const connectWalletBtn = document.getElementById('connectWalletBtn');
const stakeButton = document.getElementById('stakeButton');
const stakeAmountInput = document.getElementById('stakeAmount');
const tokenBalanceEl = document.getElementById('tokenBalance');
const weightedStakeEl = document.getElementById('weightedStake');
const unlockDateEl = document.getElementById('unlockDate');
const txStatusEl = document.getElementById('txStatus');
const userStakesSection = document.getElementById('userStakesSection');
const stakesListEl = document.getElementById('stakesList');

// EIP-6963 provider storage - populated lazily on user action
const discoveredProviders = [];
let eip6963Initialized = false;

// Initialize EIP-6963 discovery (only call after user interaction)
function initEIP6963() {
    if (eip6963Initialized) return;
    eip6963Initialized = true;

    window.addEventListener('eip6963:announceProvider', (event) => {
        if (event.detail && event.detail.info && event.detail.provider) {
            console.log('EIP-6963 provider discovered:', event.detail.info.name);
            // Avoid duplicates
            if (!discoveredProviders.some(p => p.info.uuid === event.detail.info.uuid)) {
                discoveredProviders.push(event.detail);
            }
        }
    });

    // Request providers - this triggers wallet extensions to announce themselves
    window.dispatchEvent(new Event('eip6963:requestProvider'));
}

// Get the best available wallet provider - ONLY call after user clicks connect
function getWalletProvider() {
    // If we already have a working provider cached, use it
    if (walletProvider) return walletProvider;

    // BEST: Use EIP-6963 discovered providers (bypasses aggregators completely)
    if (discoveredProviders.length > 0) {
        // Prefer MetaMask
        const mm = discoveredProviders.find(p =>
            p.info.rdns === 'io.metamask' ||
            p.info.name.toLowerCase().includes('metamask')
        );
        if (mm) {
            console.log('Using EIP-6963 MetaMask provider');
            walletProvider = mm.provider;
            return walletProvider;
        }
        // Use first discovered provider
        console.log('Using EIP-6963 provider:', discoveredProviders[0].info.name);
        walletProvider = discoveredProviders[0].provider;
        return walletProvider;
    }

    // FALLBACK: Check for providers array (EIP-5749 style)
    if (window.ethereum?.providers?.length > 0) {
        const metaMask = window.ethereum.providers.find(p => p.isMetaMask && !p.isBraveWallet);
        if (metaMask) {
            console.log('Using MetaMask from providers array');
            walletProvider = metaMask;
            return metaMask;
        }
        console.log('Using first provider from providers array');
        walletProvider = window.ethereum.providers[0];
        return walletProvider;
    }

    // FALLBACK: Direct provider check (only if clearly a real wallet)
    if (window.ethereum) {
        if (window.ethereum.isMetaMask || window.ethereum.isCoinbaseWallet ||
            window.ethereum.isTrust || window.ethereum.isRabby ||
            window.ethereum.isBraveWallet || window.ethereum.isTokenPocket) {
            console.log('Using direct window.ethereum provider');
            walletProvider = window.ethereum;
            return walletProvider;
        }
    }

    // Return window.ethereum anyway for user-initiated connect (aggregator may work with user gesture)
    return window.ethereum || null;
}

// Initialize on page load - NO WALLET INTERACTION
document.addEventListener('DOMContentLoaded', async () => {
    initTierSelection();
    initInputListeners();

    // DO NOT touch any wallet/ethereum stuff here
    // Just load public stats using direct RPC
    await loadPoolStats();
});

// Initialize tier selection
function initTierSelection() {
    const tierOptions = document.querySelectorAll('.tier-option');
    tierOptions.forEach(option => {
        option.addEventListener('click', () => {
            tierOptions.forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            selectedTier = parseInt(option.dataset.tier);
            updateStakePreview();
        });
    });
}

// Initialize input listeners
function initInputListeners() {
    stakeAmountInput.addEventListener('input', updateStakePreview);
}

// Initialize wallet connection with known accounts (no prompts)
async function initializeWithAccounts(accounts) {
    if (!accounts || accounts.length === 0) return;

    const wp = getWalletProvider();
    if (!wp) return;

    try {
        userAddress = accounts[0];

        // Check and switch network
        await switchToArbitrumSepolia();

        // Setup ethers with the specific provider
        const directProvider = new ethers.providers.JsonRpcProvider(DIRECT_RPC);
        provider = new ethers.providers.Web3Provider(wp);
        signer = provider.getSigner();

        // Setup contracts
        const tokenRead = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, directProvider);
        const stakingRead = new ethers.Contract(CONTRACT_ADDRESSES.STAKING, STAKING_ABI, directProvider);
        tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, signer);
        stakingContract = new ethers.Contract(CONTRACT_ADDRESSES.STAKING, STAKING_ABI, signer);
        tokenContract.read = tokenRead;
        stakingContract.read = stakingRead;

        // Update UI
        connectWalletBtn.textContent = formatAddress(userAddress);
        connectWalletBtn.classList.add('connected');
        stakeButton.disabled = false;
        stakeButton.textContent = 'Stake 8BIT';

        // Load user data
        await Promise.all([
            loadTokenBalance(),
            loadUserStakes(),
            loadPoolStats()
        ]);

        // Listen for account changes
        wp.on('accountsChanged', handleAccountsChanged);
        wp.on('chainChanged', () => window.location.reload());

    } catch (error) {
        console.error('Error initializing wallet:', error);
    }
}

// Connect wallet (user clicked button)
async function connectWallet() {
    // Initialize EIP-6963 discovery on first connect attempt
    initEIP6963();

    // Give providers time to announce (user gesture already happened, so this is safe)
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get provider - for user-initiated connect, also try window.ethereum as last resort
    let wp = getWalletProvider();
    if (!wp && window.ethereum) {
        console.log('Using window.ethereum as fallback for user-initiated connect');
        wp = window.ethereum;
    }

    if (!wp) {
        alert('Please install MetaMask or another Web3 wallet to use this feature.');
        return;
    }

    try {
        let accounts;

        // Request accounts - this requires user interaction
        try {
            accounts = await wp.request({ method: 'eth_requestAccounts' });
            // If successful with aggregator fallback, cache it
            if (!walletProvider) walletProvider = wp;
        } catch (requestError) {
            console.error('Wallet request error:', requestError);

            // Handle wallet aggregator errors
            if (requestError.message && (
                requestError.message.includes('Unexpected') ||
                requestError.message.includes('User rejected') ||
                requestError.code === 4001
            )) {
                if (requestError.code === 4001) {
                    showTxStatus('Connection rejected. Please approve the connection in your wallet.', 'error');
                } else {
                    showTxStatus('Wallet error. Try: 1) Click your wallet extension icon first, 2) Then click Connect here.', 'error');
                }
                return;
            }
            throw requestError;
        }

        if (!accounts || accounts.length === 0) {
            showTxStatus('No accounts found. Please unlock your wallet.', 'error');
            return;
        }

        userAddress = accounts[0];

        // Check and switch network (also updates RPC to working endpoint)
        await switchToArbitrumSepolia();

        // Setup ethers - use direct RPC for reads to bypass MetaMask's potentially bad RPC
        const directProvider = new ethers.providers.JsonRpcProvider(DIRECT_RPC);
        provider = new ethers.providers.Web3Provider(wp);
        signer = provider.getSigner();

        // Setup contracts - use direct provider for reads, signer for writes
        // Read contracts (for allowance, balance checks)
        const tokenRead = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, directProvider);
        const stakingRead = new ethers.Contract(CONTRACT_ADDRESSES.STAKING, STAKING_ABI, directProvider);

        // Write contracts (for approve, stake, withdraw - needs signer)
        tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, signer);
        stakingContract = new ethers.Contract(CONTRACT_ADDRESSES.STAKING, STAKING_ABI, signer);

        // Store read contracts for use in read operations
        tokenContract.read = tokenRead;
        stakingContract.read = stakingRead;

        // Update UI
        connectWalletBtn.textContent = formatAddress(userAddress);
        connectWalletBtn.classList.add('connected');
        stakeButton.disabled = false;
        stakeButton.textContent = 'Stake 8BIT';

        // Load user data
        await Promise.all([
            loadTokenBalance(),
            loadUserStakes(),
            loadPoolStats()
        ]);

        // Listen for account changes
        wp.on('accountsChanged', handleAccountsChanged);
        wp.on('chainChanged', () => window.location.reload());

    } catch (error) {
        console.error('Connection error:', error);
        showTxStatus('Failed to connect: ' + error.message, 'error');
    }
}

// Switch to Arbitrum Sepolia
async function switchToArbitrumSepolia() {
    const wp = getWalletProvider();
    if (!wp) return;

    try {
        // First try to switch
        await wp.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: NETWORK_CONFIG.chainId }]
        });
    } catch (switchError) {
        // Chain not added, try to add it
        if (switchError.code === 4902) {
            await wp.request({
                method: 'wallet_addEthereumChain',
                params: [NETWORK_CONFIG]
            });
        } else {
            throw switchError;
        }
    }

    // Force update RPC to working public endpoint (fixes expired Alchemy keys)
    try {
        await wp.request({
            method: 'wallet_addEthereumChain',
            params: [{
                chainId: NETWORK_CONFIG.chainId,
                chainName: 'Arbitrum Sepolia',
                rpcUrls: ['https://sepolia-rollup.arbitrum.io/rpc'],
                blockExplorerUrls: ['https://sepolia.arbiscan.io'],
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }
            }]
        });
    } catch (e) {
        // Ignore - some wallets don't support updating existing networks
        console.log('Could not update network RPC:', e.message);
    }
}

// Handle account changes
async function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // Disconnected
        userAddress = null;
        connectWalletBtn.textContent = 'Connect Wallet';
        connectWalletBtn.classList.remove('connected');
        stakeButton.disabled = true;
        stakeButton.textContent = 'Connect Wallet to Stake';
        userStakesSection.style.display = 'none';
    } else {
        userAddress = accounts[0];
        connectWalletBtn.textContent = formatAddress(userAddress);
        await Promise.all([
            loadTokenBalance(),
            loadUserStakes()
        ]);
    }
}

// Load token balance
async function loadTokenBalance() {
    if (!tokenContract || !userAddress) return;

    try {
        const balance = await tokenContract.read.balanceOf(userAddress);
        const formatted = ethers.utils.formatEther(balance);
        tokenBalanceEl.textContent = `Balance: ${formatNumber(formatted)} 8BIT`;
    } catch (error) {
        console.error('Error loading balance:', error);
        tokenBalanceEl.textContent = 'Balance: Error';
    }
}

// Load pool stats
async function loadPoolStats() {
    try {
        // Always use direct RPC for reads (bypasses MetaMask's potentially bad RPC)
        const readProvider = new ethers.providers.JsonRpcProvider(DIRECT_RPC);
        const readStaking = new ethers.Contract(CONTRACT_ADDRESSES.STAKING, STAKING_ABI, readProvider);

        // Use getStakingStats() which returns all stats in one call
        const [stats, isPaused] = await Promise.all([
            readStaking.getStakingStats(),
            readStaking.paused()
        ]);

        // Destructure stats: (totalRawStake, totalWeightedStake, totalRewardsDistributed, remainingRewards, stakingStartTime, timeRemaining)
        const totalStaked = stats[0];
        const totalWeightedStake = stats[1];
        const totalDistributed = stats[2];
        const rewardsRemaining = stats[3];
        const stakingStartTime = stats[4];
        const timeRemaining = stats[5];

        // Update stats display
        document.getElementById('totalStaked').textContent = formatNumber(ethers.utils.formatEther(totalStaked));
        document.getElementById('rewardsRemaining').textContent = formatNumber(ethers.utils.formatEther(rewardsRemaining));
        document.getElementById('totalDistributed').textContent = formatNumber(ethers.utils.formatEther(totalDistributed));

        // Display time remaining
        const remainingSeconds = timeRemaining.toNumber();
        if (remainingSeconds > 0) {
            const years = Math.floor(remainingSeconds / (365 * 24 * 60 * 60));
            const months = Math.floor((remainingSeconds % (365 * 24 * 60 * 60)) / (30 * 24 * 60 * 60));
            document.getElementById('timeRemaining').textContent = `${years}y ${months}m`;
        } else {
            document.getElementById('timeRemaining').textContent = 'Ended';
        }

        // Update staking status
        const statusEl = document.getElementById('stakingStatus');
        const statusTextEl = document.getElementById('stakingStatusText');
        if (isPaused) {
            statusEl.classList.add('status-paused');
            statusTextEl.textContent = 'PAUSED';
        } else if (stakingStartTime.toNumber() === 0) {
            statusEl.classList.add('status-paused');
            statusTextEl.textContent = 'NOT STARTED';
        } else {
            statusEl.classList.add('status-live');
            statusTextEl.textContent = 'LIVE';
        }

        // Get APY estimates for each tier from contract
        for (let i = 0; i < 4; i++) {
            try {
                const apyBps = await readStaking.getEstimatedAPY(i);
                const apyPercent = apyBps.toNumber() / 100; // Convert basis points to percent
                document.getElementById(`apy${i}`).textContent = `~${apyPercent.toFixed(0)}% APY`;
            } catch (e) {
                // Fallback if no stakes yet
                document.getElementById(`apy${i}`).textContent = 'Est. APY';
            }
        }

    } catch (error) {
        console.error('Error loading pool stats:', error);
    }
}

// Countdown interval reference
let countdownInterval = null;

// Format countdown time
function formatCountdown(seconds) {
    if (seconds <= 0) return 'UNLOCKED!';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (days > 0) {
        return `${days}d ${hours}h ${minutes}m ${secs}s`;
    } else if (hours > 0) {
        return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
        return `${minutes}m ${secs}s`;
    }
    return `${secs}s`;
}

// Calculate progress percentage
function calculateProgress(unlockTime, tierDuration) {
    const now = Math.floor(Date.now() / 1000);
    const startTime = unlockTime - tierDuration;
    const elapsed = now - startTime;
    const progress = Math.min(100, Math.max(0, (elapsed / tierDuration) * 100));
    return progress;
}

// Load user stakes
async function loadUserStakes() {
    if (!stakingContract || !userAddress) return;

    try {
        // getUserStakes returns 4 arrays: (amounts[], unlockTimes[], rewards[], tiers[])
        const result = await stakingContract.read.getUserStakes(userAddress);
        const amounts = result[0];
        const unlockTimes = result[1];
        const rewards = result[2];
        const tiers = result[3];

        if (amounts.length === 0) {
            userStakesSection.style.display = 'none';
            return;
        }

        userStakesSection.style.display = 'block';

        // Calculate totals
        let totalStaked = ethers.BigNumber.from(0);
        let totalRewards = ethers.BigNumber.from(0);

        // Clear and populate stakes list
        stakesListEl.innerHTML = '';

        for (let i = 0; i < amounts.length; i++) {
            const amount = amounts[i];
            const unlockTime = unlockTimes[i];
            const reward = rewards[i];
            const tier = tiers[i];

            totalStaked = totalStaked.add(amount);
            totalRewards = totalRewards.add(reward);

            const now = Math.floor(Date.now() / 1000);
            const isUnlocked = now >= unlockTime.toNumber();

            const unlockTimestamp = unlockTime.toNumber();
            const tierDuration = LOCK_TIERS[tier].duration;
            const progress = calculateProgress(unlockTimestamp, tierDuration);
            const remainingSeconds = unlockTimestamp - now;

            const stakeEl = document.createElement('div');
            stakeEl.className = `stake-item ${isUnlocked ? 'unlocked' : 'locked'}`;
            stakeEl.dataset.stakeId = i;
            stakeEl.dataset.unlockTime = unlockTimestamp;
            stakeEl.innerHTML = `
                <div class="stake-header">
                    <div class="stake-amount pixel-text">${formatNumber(ethers.utils.formatEther(amount))} 8BIT</div>
                    <div class="stake-status ${isUnlocked ? 'unlocked' : 'locked'} pixel-text">
                        ${isUnlocked ? 'UNLOCKED' : 'LOCKED'}
                    </div>
                </div>

                <!-- Countdown Timer -->
                <div class="countdown-container" style="margin: 1rem 0; text-align: center;">
                    <div class="countdown-label" style="font-size: 0.7rem; color: #888; margin-bottom: 0.5rem;">
                        ${isUnlocked ? 'Ready to withdraw!' : 'Time Remaining'}
                    </div>
                    <div class="countdown-timer pixel-text ${isUnlocked ? 'glow-green' : 'glow-yellow'}"
                         data-unlock="${unlockTimestamp}"
                         style="font-size: 1.2rem; letter-spacing: 2px;">
                        ${isUnlocked ? 'UNLOCKED!' : formatCountdown(remainingSeconds)}
                    </div>
                </div>

                <!-- Progress Bar -->
                <div class="progress-container" style="margin: 1rem 0;">
                    <div class="progress-bar-bg" style="background: rgba(0,0,0,0.3); border-radius: 10px; height: 12px; overflow: hidden; border: 1px solid #333;">
                        <div class="progress-bar-fill" style="height: 100%; background: linear-gradient(90deg, ${isUnlocked ? '#00ff88' : '#00d4ff'}, ${isUnlocked ? '#00ff88' : '#ff00ff'}); width: ${progress}%; transition: width 1s linear; border-radius: 10px;"></div>
                    </div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.6rem; color: #666; margin-top: 0.25rem;">
                        <span>Staked</span>
                        <span>${progress.toFixed(1)}% complete</span>
                        <span>Unlock</span>
                    </div>
                </div>

                <div class="stake-details">
                    <div class="stake-detail">
                        <div class="stake-detail-label">Lock Tier</div>
                        <div class="stake-detail-value pixel-text">${LOCK_TIERS[tier].name}</div>
                    </div>
                    <div class="stake-detail">
                        <div class="stake-detail-label">Multiplier</div>
                        <div class="stake-detail-value pixel-text">${LOCK_TIERS[tier].multiplier}</div>
                    </div>
                    <div class="stake-detail">
                        <div class="stake-detail-label">Pending Rewards</div>
                        <div class="stake-detail-value pixel-text glow-green">${formatNumber(ethers.utils.formatEther(reward))} 8BIT</div>
                    </div>
                </div>
                <div class="stake-detail" style="margin-bottom: 1rem;">
                    <div class="stake-detail-label">Unlock Date</div>
                    <div class="stake-detail-value">${new Date(unlockTimestamp * 1000).toLocaleDateString()} ${new Date(unlockTimestamp * 1000).toLocaleTimeString()}</div>
                </div>
                ${!isUnlocked ? `
                <div class="warning-box">
                    Early withdrawal will incur a 25% penalty on staked amount.
                </div>
                ` : ''}
                <div class="stake-actions" style="margin-top: 1rem;">
                    <button class="btn btn-secondary ${isUnlocked ? '' : 'btn-disabled'}" onclick="claimReward(${i})" ${isUnlocked ? '' : 'disabled'} title="${isUnlocked ? 'Claim accumulated rewards' : 'Unlock required to claim rewards'}">
                        ${isUnlocked ? 'Claim Rewards' : 'Claim (Locked)'}
                    </button>
                    <button class="btn ${isUnlocked ? 'btn-primary' : 'btn-warning'}" onclick="withdrawStake(${i}, ${!isUnlocked})">
                        ${isUnlocked ? 'Withdraw' : 'Withdraw (25% Penalty)'}
                    </button>
                </div>
            `;
            stakesListEl.appendChild(stakeEl);
        }

        document.getElementById('userTotalStaked').textContent = `${formatNumber(ethers.utils.formatEther(totalStaked))} 8BIT`;
        document.getElementById('userTotalRewards').textContent = `${formatNumber(ethers.utils.formatEther(totalRewards))} 8BIT`;

        // Start countdown timer (clear previous if exists)
        if (countdownInterval) {
            clearInterval(countdownInterval);
        }

        countdownInterval = setInterval(() => {
            const now = Math.floor(Date.now() / 1000);
            const countdownElements = document.querySelectorAll('.countdown-timer[data-unlock]');

            countdownElements.forEach(el => {
                const unlockTime = parseInt(el.dataset.unlock);
                const remaining = unlockTime - now;

                if (remaining <= 0) {
                    el.textContent = 'UNLOCKED!';
                    el.classList.remove('glow-yellow');
                    el.classList.add('glow-green');
                } else {
                    el.textContent = formatCountdown(remaining);
                }
            });
        }, 1000);

    } catch (error) {
        console.error('Error loading user stakes:', error);
    }
}

// Update stake preview
function updateStakePreview() {
    const amount = parseFloat(stakeAmountInput.value) || 0;
    const tier = LOCK_TIERS[selectedTier];
    const weighted = amount * (tier.weight / 10000);

    weightedStakeEl.textContent = `${formatNumber(weighted)} 8BIT`;

    const unlockDate = new Date(Date.now() + tier.duration * 1000);
    unlockDateEl.textContent = `Unlocks: ${unlockDate.toLocaleDateString()}`;
}

// Set max stake amount
async function setMaxStake() {
    if (!tokenContract || !userAddress) return;

    try {
        const balance = await tokenContract.read.balanceOf(userAddress);
        stakeAmountInput.value = ethers.utils.formatEther(balance);
        updateStakePreview();
    } catch (error) {
        console.error('Error getting balance:', error);
    }
}

// Get gas settings with buffer to prevent "max fee < base fee" errors
async function getGasSettings() {
    const feeData = await provider.getFeeData();
    return {
        maxFeePerGas: feeData.maxFeePerGas.mul(115).div(100), // 15% buffer
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas
    };
}

// Estimate gas with buffer, fallback to safe default
async function estimateGasWithBuffer(contract, method, args, fallbackLimit) {
    try {
        const estimated = await contract.estimateGas[method](...args);
        // Add 20% buffer to estimate
        return estimated.mul(120).div(100);
    } catch (e) {
        console.log(`Gas estimation failed for ${method}, using fallback:`, fallbackLimit);
        return ethers.BigNumber.from(fallbackLimit);
    }
}

// Stake tokens
async function stakeTokens() {
    if (!stakingContract || !userAddress) {
        await connectWallet();
        return;
    }

    const amount = stakeAmountInput.value;
    if (!amount || parseFloat(amount) <= 0) {
        showTxStatus('Please enter an amount to stake', 'error');
        return;
    }

    const amountWei = ethers.utils.parseEther(amount);

    try {
        stakeButton.disabled = true;
        stakeButton.textContent = 'Processing...';

        // Check balance first
        const balance = await tokenContract.read.balanceOf(userAddress);
        if (balance.lt(amountWei)) {
            showTxStatus('Insufficient 8BIT balance. You have ' + ethers.utils.formatEther(balance) + ' 8BIT', 'error');
            return;
        }

        // Check allowance using direct RPC (bypasses MetaMask's bad RPC)
        const allowance = await tokenContract.read.allowance(userAddress, CONTRACT_ADDRESSES.STAKING);
        console.log('Current allowance:', ethers.utils.formatEther(allowance));

        if (allowance.lt(amountWei)) {
            showTxStatus('Approving tokens...', 'pending');

            const gasSettings = await getGasSettings();
            const gasLimit = await estimateGasWithBuffer(
                tokenContract, 'approve',
                [CONTRACT_ADDRESSES.STAKING, ethers.constants.MaxUint256],
                100000
            );

            const approveTx = await tokenContract.approve(CONTRACT_ADDRESSES.STAKING, ethers.constants.MaxUint256, {
                gasLimit,
                ...gasSettings
            });
            console.log('Approve TX:', approveTx.hash, 'Gas:', gasLimit.toString());
            await approveTx.wait();
            showTxStatus('Tokens approved! Now staking...', 'pending');
        }

        // Simulate stake using direct RPC (bypasses MetaMask's potentially bad RPC)
        showTxStatus('Preparing stake transaction...', 'pending');
        console.log('Staking:', amount, '8BIT with tier:', selectedTier);

        try {
            // Use read contract (direct RPC) for simulation
            await stakingContract.read.callStatic.stake(amountWei, selectedTier, { from: userAddress });
            console.log('Simulation passed via direct RPC!');
        } catch (simError) {
            console.error('Stake simulation failed:', simError);
            const reason = simError.reason || simError.error?.message || simError.message;
            showTxStatus('Stake would fail: ' + reason, 'error');
            return;
        }

        // Re-verify allowance after potential approval
        const finalAllowance = await tokenContract.read.allowance(userAddress, CONTRACT_ADDRESSES.STAKING);
        console.log('Final allowance before stake:', ethers.utils.formatEther(finalAllowance));

        if (finalAllowance.lt(amountWei)) {
            showTxStatus('Token approval failed or insufficient. Please try again.', 'error');
            return;
        }

        // Stake with dynamic gas estimation
        showTxStatus('Staking tokens... Confirm in wallet', 'pending');

        const stakeGasSettings = await getGasSettings();
        const stakeGasLimit = await estimateGasWithBuffer(
            stakingContract, 'stake',
            [amountWei, selectedTier],
            350000
        );

        const stakeTx = await stakingContract.stake(amountWei, selectedTier, {
            gasLimit: stakeGasLimit,
            ...stakeGasSettings
        });
        console.log('Stake TX:', stakeTx.hash, 'Gas:', stakeGasLimit.toString());
        showTxStatus('Transaction sent, waiting for confirmation...', 'pending');
        await stakeTx.wait();

        showTxStatus('Successfully staked ' + amount + ' 8BIT!', 'success');
        stakeAmountInput.value = '';
        updateStakePreview();

        // Reload data
        await Promise.all([
            loadTokenBalance(),
            loadUserStakes(),
            loadPoolStats()
        ]);

    } catch (error) {
        console.error('Staking error:', error);
        // Extract more useful error message
        let errorMsg = error.reason || error.message;
        if (error.error && error.error.message) {
            errorMsg = error.error.message;
        }
        if (error.data && error.data.message) {
            errorMsg = error.data.message;
        }
        showTxStatus('Staking failed: ' + errorMsg, 'error');
    } finally {
        stakeButton.disabled = false;
        stakeButton.textContent = 'Stake 8BIT';
    }
}

// Claim rewards for a single stake
async function claimReward(stakeIndex) {
    if (!stakingContract || !userAddress) return;

    try {
        // Check if stake is unlocked first to avoid wasted gas
        const result = await stakingContract.getUserStakes(userAddress);
        const unlockTimes = result[1];
        const unlockTime = unlockTimes[stakeIndex]?.toNumber() || 0;
        const now = Math.floor(Date.now() / 1000);

        if (now < unlockTime) {
            const remaining = formatCountdown(unlockTime - now);
            showTxStatus(`Cannot claim yet. Stake unlocks in ${remaining}`, 'error');
            return;
        }

        showTxStatus('Claiming rewards...', 'pending');
        const gasSettings = await getGasSettings();
        const gasLimit = await estimateGasWithBuffer(stakingContract, 'claimReward', [stakeIndex], 200000);
        const tx = await stakingContract.claimReward(stakeIndex, { gasLimit, ...gasSettings });
        console.log('Claim TX:', tx.hash, 'Gas:', gasLimit.toString());
        await tx.wait();
        showTxStatus('Rewards claimed successfully!', 'success');

        await Promise.all([
            loadTokenBalance(),
            loadUserStakes()
        ]);
    } catch (error) {
        console.error('Claim error:', error);
        showTxStatus('Claim failed: ' + (error.reason || error.message), 'error');
    }
}

// Claim all rewards
async function claimAllRewards() {
    if (!stakingContract || !userAddress) return;

    try {
        showTxStatus('Claiming all rewards...', 'pending');
        const gasSettings = await getGasSettings();
        const gasLimit = await estimateGasWithBuffer(stakingContract, 'claimAllRewards', [], 500000);
        const tx = await stakingContract.claimAllRewards({ gasLimit, ...gasSettings });
        console.log('ClaimAll TX:', tx.hash, 'Gas:', gasLimit.toString());
        await tx.wait();
        showTxStatus('All rewards claimed successfully!', 'success');

        await Promise.all([
            loadTokenBalance(),
            loadUserStakes()
        ]);
    } catch (error) {
        console.error('Claim all error:', error);
        showTxStatus('Claim failed: ' + (error.reason || error.message), 'error');
    }
}

// Withdraw stake
async function withdrawStake(stakeIndex, hasEarlyPenalty) {
    if (!stakingContract || !userAddress) return;

    if (hasEarlyPenalty) {
        const confirmed = confirm('WARNING: Early withdrawal will incur a 25% penalty on your staked amount. Are you sure you want to proceed?');
        if (!confirmed) return;
    }

    try {
        showTxStatus('Withdrawing stake...', 'pending');
        const gasSettings = await getGasSettings();
        const gasLimit = await estimateGasWithBuffer(stakingContract, 'withdraw', [stakeIndex], 300000);
        const tx = await stakingContract.withdraw(stakeIndex, { gasLimit, ...gasSettings });
        console.log('Withdraw TX:', tx.hash, 'Gas:', gasLimit.toString());
        await tx.wait();
        showTxStatus('Stake withdrawn successfully!', 'success');

        await Promise.all([
            loadTokenBalance(),
            loadUserStakes(),
            loadPoolStats()
        ]);
    } catch (error) {
        console.error('Withdraw error:', error);
        showTxStatus('Withdrawal failed: ' + (error.reason || error.message), 'error');
    }
}

// Add 8BIT token to wallet
async function addTokenToWallet() {
    const wp = getWalletProvider();
    if (!wp) return;

    try {
        await wp.request({
            method: 'wallet_watchAsset',
            params: {
                type: 'ERC20',
                options: {
                    address: CONTRACT_ADDRESSES.TOKEN,
                    symbol: '8BIT',
                    decimals: 18,
                    image: 'https://8bitarcade.games/images/8bit-logo.png'
                }
            }
        });
    } catch (error) {
        console.error('Error adding token:', error);
    }
}

// Show transaction status
function showTxStatus(message, type) {
    txStatusEl.style.display = 'block';
    txStatusEl.className = `tx-status tx-${type}`;
    txStatusEl.textContent = message;

    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            txStatusEl.style.display = 'none';
        }, 5000);
    }
}

// Format address
function formatAddress(address) {
    return address.slice(0, 6) + '...' + address.slice(-4);
}

// Format number with commas
function formatNumber(num) {
    const n = parseFloat(num);
    if (n >= 1000000) {
        return (n / 1000000).toFixed(2) + 'M';
    }
    if (n >= 1000) {
        return (n / 1000).toFixed(2) + 'K';
    }
    return n.toFixed(2);
}

// Event listeners
connectWalletBtn.addEventListener('click', connectWallet);
stakeButton.addEventListener('click', stakeTokens);
