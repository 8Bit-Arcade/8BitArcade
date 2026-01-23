// 8BIT Staking - Contract Interactions
// Network: Arbitrum Sepolia (Testnet)

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
    'function stake(uint256 amount, uint8 lockTier) external',
    'function withdraw(uint256 stakeIndex) external',
    'function claimRewards(uint256 stakeIndex) external',
    'function claimAllRewards() external',
    'function calculatePendingRewards(address user, uint256 stakeIndex) view returns (uint256)',
    'function getUserStakes(address user) view returns (tuple(uint256 amount, uint256 weightedAmount, uint256 startTime, uint256 unlockTime, uint256 lastClaimTime, uint8 lockTier, bool active)[])',
    'function getTotalUserStaked(address user) view returns (uint256)',
    'function getTotalUserWeightedStake(address user) view returns (uint256)',
    'function getUserActiveStakeCount(address user) view returns (uint256)',
    'function totalStaked() view returns (uint256)',
    'function totalWeightedStake() view returns (uint256)',
    'function totalRewardsDistributed() view returns (uint256)',
    'function rewardsRemaining() view returns (uint256)',
    'function stakingEndTime() view returns (uint256)',
    'function getRewardRate() view returns (uint256)',
    'function paused() view returns (bool)',
    'function MIN_STAKE() view returns (uint256)',
    'function MAX_STAKES_PER_USER() view returns (uint256)',
    'function EARLY_WITHDRAWAL_PENALTY_BPS() view returns (uint256)',
    'event Staked(address indexed user, uint256 amount, uint256 weightedAmount, uint8 lockTier, uint256 unlockTime)',
    'event Withdrawn(address indexed user, uint256 stakeIndex, uint256 amount, uint256 penalty)',
    'event RewardsClaimed(address indexed user, uint256 stakeIndex, uint256 amount)'
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

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    initTierSelection();
    initInputListeners();

    // Check if already connected
    if (window.ethereum) {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
            await connectWallet();
        }
    }

    // Load public stats
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

// Connect wallet
async function connectWallet() {
    if (!window.ethereum) {
        alert('Please install MetaMask or another Web3 wallet to use this feature.');
        return;
    }

    try {
        // Request accounts
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];

        // Check and switch network (also updates RPC to working endpoint)
        await switchToArbitrumSepolia();

        // Setup ethers
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();

        // Setup contracts
        tokenContract = new ethers.Contract(CONTRACT_ADDRESSES.TOKEN, TOKEN_ABI, signer);
        stakingContract = new ethers.Contract(CONTRACT_ADDRESSES.STAKING, STAKING_ABI, signer);

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
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', () => window.location.reload());

    } catch (error) {
        console.error('Connection error:', error);
        showTxStatus('Failed to connect: ' + error.message, 'error');
    }
}

// Switch to Arbitrum Sepolia
async function switchToArbitrumSepolia() {
    try {
        // First try to switch
        await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: NETWORK_CONFIG.chainId }]
        });
    } catch (switchError) {
        // Chain not added, try to add it
        if (switchError.code === 4902) {
            await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [NETWORK_CONFIG]
            });
        } else {
            throw switchError;
        }
    }

    // Force update RPC to working public endpoint (fixes expired Alchemy keys)
    try {
        await window.ethereum.request({
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
        const balance = await tokenContract.balanceOf(userAddress);
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
        // Create a read-only provider if not connected
        const readProvider = provider || new ethers.providers.JsonRpcProvider(NETWORK_CONFIG.rpcUrls[0]);
        const readStaking = new ethers.Contract(CONTRACT_ADDRESSES.STAKING, STAKING_ABI, readProvider);

        const [totalStaked, rewardsRemaining, totalDistributed, stakingEndTime, rewardRate, paused] = await Promise.all([
            readStaking.totalStaked(),
            readStaking.rewardsRemaining(),
            readStaking.totalRewardsDistributed(),
            readStaking.stakingEndTime(),
            readStaking.getRewardRate(),
            readStaking.paused()
        ]);

        // Update stats display
        document.getElementById('totalStaked').textContent = formatNumber(ethers.utils.formatEther(totalStaked));
        document.getElementById('rewardsRemaining').textContent = formatNumber(ethers.utils.formatEther(rewardsRemaining));
        document.getElementById('totalDistributed').textContent = formatNumber(ethers.utils.formatEther(totalDistributed));

        // Calculate time remaining
        const now = Math.floor(Date.now() / 1000);
        const remaining = stakingEndTime.toNumber() - now;
        if (remaining > 0) {
            const years = Math.floor(remaining / (365 * 24 * 60 * 60));
            const months = Math.floor((remaining % (365 * 24 * 60 * 60)) / (30 * 24 * 60 * 60));
            document.getElementById('timeRemaining').textContent = `${years}y ${months}m`;
        } else {
            document.getElementById('timeRemaining').textContent = 'Ended';
        }

        // Update staking status
        const statusEl = document.getElementById('stakingStatus');
        const statusTextEl = document.getElementById('stakingStatusText');
        if (paused) {
            statusEl.classList.add('status-paused');
            statusTextEl.textContent = 'PAUSED';
        } else {
            statusEl.classList.add('status-live');
            statusTextEl.textContent = 'LIVE';
        }

        // Calculate and display APYs for each tier
        // APY = (rewardRate * secondsPerYear * weight) / (totalWeightedStake * 10000) * 100
        const totalWeightedStake = await readStaking.totalWeightedStake();
        if (!totalWeightedStake.isZero()) {
            const secondsPerYear = 365 * 24 * 60 * 60;
            for (let i = 0; i < 4; i++) {
                const weight = LOCK_TIERS[i].weight;
                // APY = (rewardRate * secondsPerYear * weight) / totalWeightedStake / 10000 * 100
                const apyBN = rewardRate.mul(secondsPerYear).mul(weight).mul(100).div(totalWeightedStake).div(10000);
                const apy = apyBN.toNumber();
                document.getElementById(`apy${i}`).textContent = `~${apy}% APY`;
            }
        } else {
            // No stakes yet, show estimated APY based on initial rewards
            for (let i = 0; i < 4; i++) {
                document.getElementById(`apy${i}`).textContent = 'Est. APY';
            }
        }

    } catch (error) {
        console.error('Error loading pool stats:', error);
    }
}

// Load user stakes
async function loadUserStakes() {
    if (!stakingContract || !userAddress) return;

    try {
        const stakes = await stakingContract.getUserStakes(userAddress);
        const activeStakes = stakes.filter(s => s.active);

        if (activeStakes.length === 0) {
            userStakesSection.style.display = 'none';
            return;
        }

        userStakesSection.style.display = 'block';

        // Calculate totals
        let totalStaked = ethers.BigNumber.from(0);
        let totalRewards = ethers.BigNumber.from(0);

        // Clear and populate stakes list
        stakesListEl.innerHTML = '';

        for (let i = 0; i < stakes.length; i++) {
            const stake = stakes[i];
            if (!stake.active) continue;

            totalStaked = totalStaked.add(stake.amount);

            const pendingRewards = await stakingContract.calculatePendingRewards(userAddress, i);
            totalRewards = totalRewards.add(pendingRewards);

            const now = Math.floor(Date.now() / 1000);
            const isUnlocked = now >= stake.unlockTime.toNumber();

            const stakeEl = document.createElement('div');
            stakeEl.className = `stake-item ${isUnlocked ? 'unlocked' : 'locked'}`;
            stakeEl.innerHTML = `
                <div class="stake-header">
                    <div class="stake-amount pixel-text">${formatNumber(ethers.utils.formatEther(stake.amount))} 8BIT</div>
                    <div class="stake-status ${isUnlocked ? 'unlocked' : 'locked'} pixel-text">
                        ${isUnlocked ? 'UNLOCKED' : 'LOCKED'}
                    </div>
                </div>
                <div class="stake-details">
                    <div class="stake-detail">
                        <div class="stake-detail-label">Lock Tier</div>
                        <div class="stake-detail-value pixel-text">${LOCK_TIERS[stake.lockTier].name}</div>
                    </div>
                    <div class="stake-detail">
                        <div class="stake-detail-label">Multiplier</div>
                        <div class="stake-detail-value pixel-text">${LOCK_TIERS[stake.lockTier].multiplier}</div>
                    </div>
                    <div class="stake-detail">
                        <div class="stake-detail-label">Pending Rewards</div>
                        <div class="stake-detail-value pixel-text glow-green">${formatNumber(ethers.utils.formatEther(pendingRewards))} 8BIT</div>
                    </div>
                </div>
                <div class="stake-detail" style="margin-bottom: 1rem;">
                    <div class="stake-detail-label">Unlock Date</div>
                    <div class="stake-detail-value">${new Date(stake.unlockTime.toNumber() * 1000).toLocaleDateString()} ${new Date(stake.unlockTime.toNumber() * 1000).toLocaleTimeString()}</div>
                </div>
                ${!isUnlocked ? `
                <div class="warning-box">
                    Early withdrawal will incur a 25% penalty on staked amount.
                </div>
                ` : ''}
                <div class="stake-actions" style="margin-top: 1rem;">
                    <button class="btn btn-secondary" onclick="claimRewards(${i})">Claim Rewards</button>
                    <button class="btn ${isUnlocked ? 'btn-primary' : 'btn-warning'}" onclick="withdrawStake(${i}, ${!isUnlocked})">
                        ${isUnlocked ? 'Withdraw' : 'Withdraw (25% Penalty)'}
                    </button>
                </div>
            `;
            stakesListEl.appendChild(stakeEl);
        }

        document.getElementById('userTotalStaked').textContent = `${formatNumber(ethers.utils.formatEther(totalStaked))} 8BIT`;
        document.getElementById('userTotalRewards').textContent = `${formatNumber(ethers.utils.formatEther(totalRewards))} 8BIT`;

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
        const balance = await tokenContract.balanceOf(userAddress);
        stakeAmountInput.value = ethers.utils.formatEther(balance);
        updateStakePreview();
    } catch (error) {
        console.error('Error getting balance:', error);
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

        // Check allowance
        const allowance = await tokenContract.allowance(userAddress, CONTRACT_ADDRESSES.STAKING);

        if (allowance.lt(amountWei)) {
            showTxStatus('Approving tokens...', 'pending');
            const approveTx = await tokenContract.approve(CONTRACT_ADDRESSES.STAKING, ethers.constants.MaxUint256);
            await approveTx.wait();
            showTxStatus('Tokens approved! Now staking...', 'pending');
        }

        // Stake
        showTxStatus('Staking tokens...', 'pending');
        const stakeTx = await stakingContract.stake(amountWei, selectedTier);
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
        showTxStatus('Staking failed: ' + (error.reason || error.message), 'error');
    } finally {
        stakeButton.disabled = false;
        stakeButton.textContent = 'Stake 8BIT';
    }
}

// Claim rewards for a single stake
async function claimRewards(stakeIndex) {
    if (!stakingContract || !userAddress) return;

    try {
        showTxStatus('Claiming rewards...', 'pending');
        const tx = await stakingContract.claimRewards(stakeIndex);
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
        const tx = await stakingContract.claimAllRewards();
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
        const tx = await stakingContract.withdraw(stakeIndex);
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
    if (!window.ethereum) return;

    try {
        await window.ethereum.request({
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
