// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title TieredStaking
 * @notice 8-Bit Arcade Tiered Staking Contract - 5 Year Distribution
 * @dev Allows users to stake 8BIT tokens with different lock periods for different reward weights
 *
 * Key Parameters:
 * - Total Staking Pool: 25,000,000 8BIT (5% of max supply)
 * - Distribution Period: 5 years (60 months)
 * - Monthly Distribution: ~416,666 8BIT (distributed proportionally by weighted shares)
 *
 * Lock Tiers:
 * - 7 days:   1.0x weight multiplier
 * - 1 month:  1.5x weight multiplier
 * - 3 months: 2.0x weight multiplier
 * - 6 months: 3.0x weight multiplier
 *
 * Security Features:
 * - ReentrancyGuard on all state-changing functions
 * - SafeERC20 for token transfers
 * - Pausable for emergency stops
 * - No external calls before state changes (CEI pattern)
 * - Overflow protection (Solidity 0.8+)
 */
contract TieredStaking is Ownable, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════

    /// @notice Total staking pool for 5-year distribution
    uint256 public constant TOTAL_STAKING_POOL = 25_000_000 * 10**18; // 25M 8BIT (5% of max supply)

    /// @notice Distribution period (5 years)
    uint256 public constant DISTRIBUTION_PERIOD = 5 * 365 days;

    /// @notice Reward rate per second (25M / 5 years in seconds)
    uint256 public constant REWARD_RATE_PER_SECOND = TOTAL_STAKING_POOL / DISTRIBUTION_PERIOD;

    /// @notice Early withdrawal penalty (25% of staked amount)
    uint256 public constant EARLY_WITHDRAWAL_PENALTY_BPS = 2500; // 25%

    /// @notice Basis points denominator
    uint256 public constant BPS_DENOMINATOR = 10000;

    /// @notice Precision for reward calculations
    uint256 public constant PRECISION = 1e18;

    /// @notice Minimum stake amount (1 8BIT) to prevent dust attacks
    uint256 public constant MIN_STAKE_AMOUNT = 1 * 10**18;

    /// @notice Maximum number of stakes per user to prevent gas issues
    uint256 public constant MAX_STAKES_PER_USER = 50;

    // Lock tier durations
    uint256 public constant LOCK_7_DAYS = 7 days;
    uint256 public constant LOCK_1_MONTH = 30 days;
    uint256 public constant LOCK_3_MONTHS = 90 days;
    uint256 public constant LOCK_6_MONTHS = 180 days;

    // Weight multipliers (in basis points, 10000 = 1x)
    uint256 public constant WEIGHT_7_DAYS = 10000;      // 1.0x
    uint256 public constant WEIGHT_1_MONTH = 15000;     // 1.5x
    uint256 public constant WEIGHT_3_MONTHS = 20000;    // 2.0x
    uint256 public constant WEIGHT_6_MONTHS = 30000;    // 3.0x

    // ═══════════════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════════════

    /// @notice The 8BIT token contract
    IERC20 public immutable stakingToken;

    /// @notice Interface for minting rewards (if token supports it)
    address public rewardMinter;

    /// @notice Timestamp when staking started
    uint256 public stakingStartTime;

    /// @notice Total weighted tokens staked (for reward calculation)
    uint256 public totalWeightedStake;

    /// @notice Total raw tokens staked (for TVL display)
    uint256 public totalRawStake;

    /// @notice Total rewards distributed so far
    uint256 public totalRewardsDistributed;

    /// @notice Accumulated reward per weighted token
    uint256 public rewardPerWeightedTokenStored;

    /// @notice Last time rewards were updated
    uint256 public lastUpdateTime;

    /// @notice Treasury address for penalties
    address public treasury;

    /// @notice Total penalties collected
    uint256 public totalPenaltiesCollected;

    // ═══════════════════════════════════════════════════════════════════
    // STRUCTS & ENUMS
    // ═══════════════════════════════════════════════════════════════════

    enum LockTier { DAYS_7, MONTH_1, MONTHS_3, MONTHS_6 }

    struct Stake {
        uint256 amount;              // Raw amount staked
        uint256 weightedAmount;      // Weighted amount for rewards
        uint256 rewardPerTokenPaid;  // Snapshot of rewardPerWeightedToken at last update
        uint256 pendingRewards;      // Accumulated pending rewards
        uint256 stakedAt;            // Timestamp when staked
        uint256 unlockTime;          // Timestamp when unlock is available
        LockTier tier;               // Lock tier
        bool exists;                 // Whether stake exists
    }

    /// @notice User stakes (address => stake ID => Stake)
    /// @dev Each user can have multiple stakes with different lock periods
    mapping(address => mapping(uint256 => Stake)) public userStakes;

    /// @notice Number of stakes per user
    mapping(address => uint256) public userStakeCount;

    /// @notice Total staked per user (for quick lookup)
    mapping(address => uint256) public userTotalStaked;

    // ═══════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════

    event StakingStarted(uint256 timestamp);
    event Staked(address indexed user, uint256 indexed stakeId, uint256 amount, LockTier tier, uint256 unlockTime);
    event Withdrawn(address indexed user, uint256 indexed stakeId, uint256 amount, uint256 penalty);
    event RewardsClaimed(address indexed user, uint256 indexed stakeId, uint256 reward);
    event RewardsMinted(address indexed user, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event RewardMinterUpdated(address indexed oldMinter, address indexed newMinter);
    event EmergencyWithdraw(address indexed user, uint256 indexed stakeId, uint256 amount);

    // ═══════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════

    constructor(address _stakingToken, address _treasury) Ownable(msg.sender) {
        require(_stakingToken != address(0), "Invalid token address");
        require(_treasury != address(0), "Invalid treasury address");

        stakingToken = IERC20(_stakingToken);
        treasury = _treasury;
    }

    // ═══════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Update reward state before any stake/withdraw/claim
     */
    modifier updateReward(address account, uint256 stakeId) {
        rewardPerWeightedTokenStored = rewardPerWeightedToken();
        lastUpdateTime = lastApplicableTime();

        if (account != address(0) && userStakes[account][stakeId].exists) {
            Stake storage userStake = userStakes[account][stakeId];
            userStake.pendingRewards = earned(account, stakeId);
            userStake.rewardPerTokenPaid = rewardPerWeightedTokenStored;
        }
        _;
    }

    // ═══════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Start the staking period
     * @dev Can only be called once by owner
     */
    function startStaking() external onlyOwner {
        require(stakingStartTime == 0, "Already started");
        stakingStartTime = block.timestamp;
        lastUpdateTime = block.timestamp;
        emit StakingStarted(block.timestamp);
    }

    /**
     * @notice Set the reward minter address (8BIT token contract)
     * @param _minter Address that can mint rewards
     */
    function setRewardMinter(address _minter) external onlyOwner {
        require(_minter != address(0), "Invalid minter");
        emit RewardMinterUpdated(rewardMinter, _minter);
        rewardMinter = _minter;
    }

    /**
     * @notice Update treasury address
     * @param _treasury New treasury address
     */
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        emit TreasuryUpdated(treasury, _treasury);
        treasury = _treasury;
    }

    /**
     * @notice Pause staking (emergency)
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause staking
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════════════
    // STAKING FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Stake tokens with a specific lock tier
     * @param amount Amount of tokens to stake
     * @param tier Lock tier (0=7days, 1=1month, 2=3months, 3=6months)
     */
    function stake(uint256 amount, LockTier tier)
        external
        nonReentrant
        whenNotPaused
        updateReward(msg.sender, userStakeCount[msg.sender])
    {
        require(stakingStartTime > 0, "Staking not started");
        require(amount >= MIN_STAKE_AMOUNT, "Below minimum stake");
        require(block.timestamp < stakingStartTime + DISTRIBUTION_PERIOD, "Staking ended");
        require(userStakeCount[msg.sender] < MAX_STAKES_PER_USER, "Too many stakes");

        uint256 stakeId = userStakeCount[msg.sender];
        uint256 lockDuration = getLockDuration(tier);
        uint256 weightMultiplier = getWeightMultiplier(tier);
        uint256 weightedAmount = (amount * weightMultiplier) / BPS_DENOMINATOR;

        // Update state BEFORE external call (CEI pattern)
        userStakes[msg.sender][stakeId] = Stake({
            amount: amount,
            weightedAmount: weightedAmount,
            rewardPerTokenPaid: rewardPerWeightedTokenStored,
            pendingRewards: 0,
            stakedAt: block.timestamp,
            unlockTime: block.timestamp + lockDuration,
            tier: tier,
            exists: true
        });

        userStakeCount[msg.sender]++;
        userTotalStaked[msg.sender] += amount;
        totalWeightedStake += weightedAmount;
        totalRawStake += amount;

        // External call AFTER state changes
        stakingToken.safeTransferFrom(msg.sender, address(this), amount);

        emit Staked(msg.sender, stakeId, amount, tier, block.timestamp + lockDuration);
    }

    /**
     * @notice Withdraw staked tokens (with penalty if before unlock)
     * @param stakeId The stake ID to withdraw
     */
    function withdraw(uint256 stakeId)
        external
        nonReentrant
        updateReward(msg.sender, stakeId)
    {
        Stake storage userStake = userStakes[msg.sender][stakeId];
        require(userStake.exists, "Stake not found");
        require(userStake.amount > 0, "Nothing to withdraw");

        uint256 amount = userStake.amount;
        uint256 weightedAmount = userStake.weightedAmount;
        uint256 penalty = 0;

        // Calculate penalty if withdrawing early
        if (block.timestamp < userStake.unlockTime) {
            penalty = (amount * EARLY_WITHDRAWAL_PENALTY_BPS) / BPS_DENOMINATOR;
        }

        uint256 amountAfterPenalty = amount - penalty;

        // Claim any pending rewards first
        uint256 reward = userStake.pendingRewards;
        userStake.pendingRewards = 0;

        // Update state BEFORE external calls
        userStake.amount = 0;
        userStake.weightedAmount = 0;
        userStake.exists = false;

        userTotalStaked[msg.sender] -= amount;
        totalWeightedStake -= weightedAmount;
        totalRawStake -= amount;

        if (penalty > 0) {
            totalPenaltiesCollected += penalty;
        }

        // External calls AFTER state changes
        if (amountAfterPenalty > 0) {
            stakingToken.safeTransfer(msg.sender, amountAfterPenalty);
        }

        if (penalty > 0) {
            stakingToken.safeTransfer(treasury, penalty);
        }

        if (reward > 0) {
            _mintReward(msg.sender, reward);
        }

        emit Withdrawn(msg.sender, stakeId, amountAfterPenalty, penalty);
        if (reward > 0) {
            emit RewardsClaimed(msg.sender, stakeId, reward);
        }
    }

    /**
     * @notice Claim rewards without withdrawing stake
     * @param stakeId The stake ID to claim rewards for
     */
    function claimRewards(uint256 stakeId)
        external
        nonReentrant
        updateReward(msg.sender, stakeId)
    {
        Stake storage userStake = userStakes[msg.sender][stakeId];
        require(userStake.exists, "Stake not found");

        uint256 reward = userStake.pendingRewards;
        require(reward > 0, "No rewards to claim");

        // Update state BEFORE external call
        userStake.pendingRewards = 0;

        // External call AFTER state change
        _mintReward(msg.sender, reward);

        emit RewardsClaimed(msg.sender, stakeId, reward);
    }

    /**
     * @notice Claim rewards from all stakes
     */
    function claimAllRewards() external nonReentrant {
        uint256 totalReward = 0;
        uint256 count = userStakeCount[msg.sender];

        // Update global state first
        rewardPerWeightedTokenStored = rewardPerWeightedToken();
        lastUpdateTime = lastApplicableTime();

        for (uint256 i = 0; i < count; i++) {
            Stake storage userStake = userStakes[msg.sender][i];
            if (userStake.exists && userStake.amount > 0) {
                uint256 reward = _calculateEarned(userStake);
                if (reward > 0) {
                    totalReward += reward;
                    userStake.pendingRewards = 0;
                    userStake.rewardPerTokenPaid = rewardPerWeightedTokenStored;
                    emit RewardsClaimed(msg.sender, i, reward);
                }
            }
        }

        require(totalReward > 0, "No rewards to claim");
        _mintReward(msg.sender, totalReward);
    }

    /**
     * @notice Emergency withdraw without rewards (when paused)
     * @param stakeId The stake ID to emergency withdraw
     */
    function emergencyWithdraw(uint256 stakeId) external nonReentrant {
        Stake storage userStake = userStakes[msg.sender][stakeId];
        require(userStake.exists, "Stake not found");
        require(userStake.amount > 0, "Nothing to withdraw");

        uint256 amount = userStake.amount;
        uint256 weightedAmount = userStake.weightedAmount;

        // Update state BEFORE external call
        userStake.amount = 0;
        userStake.weightedAmount = 0;
        userStake.pendingRewards = 0;
        userStake.exists = false;

        userTotalStaked[msg.sender] -= amount;
        totalWeightedStake -= weightedAmount;
        totalRawStake -= amount;

        // External call AFTER state changes (no penalty in emergency)
        stakingToken.safeTransfer(msg.sender, amount);

        emit EmergencyWithdraw(msg.sender, stakeId, amount);
    }

    // ═══════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Get the last applicable time for rewards
     */
    function lastApplicableTime() public view returns (uint256) {
        if (stakingStartTime == 0) return 0;
        uint256 endTime = stakingStartTime + DISTRIBUTION_PERIOD;
        return block.timestamp < endTime ? block.timestamp : endTime;
    }

    /**
     * @notice Calculate current reward per weighted token
     */
    function rewardPerWeightedToken() public view returns (uint256) {
        if (totalWeightedStake == 0) {
            return rewardPerWeightedTokenStored;
        }

        uint256 timeDelta = lastApplicableTime() - lastUpdateTime;
        uint256 rewardAccrued = timeDelta * REWARD_RATE_PER_SECOND;

        // Check we don't exceed total pool
        if (totalRewardsDistributed + rewardAccrued > TOTAL_STAKING_POOL) {
            rewardAccrued = TOTAL_STAKING_POOL - totalRewardsDistributed;
        }

        return rewardPerWeightedTokenStored + ((rewardAccrued * PRECISION) / totalWeightedStake);
    }

    /**
     * @notice Calculate earned rewards for a specific stake
     * @param account User address
     * @param stakeId Stake ID
     */
    function earned(address account, uint256 stakeId) public view returns (uint256) {
        Stake storage userStake = userStakes[account][stakeId];
        if (!userStake.exists) return 0;
        return _calculateEarned(userStake);
    }

    /**
     * @notice Calculate total earned rewards for a user across all stakes
     * @param account User address
     */
    function totalEarned(address account) external view returns (uint256) {
        uint256 total = 0;
        uint256 count = userStakeCount[account];

        for (uint256 i = 0; i < count; i++) {
            total += earned(account, i);
        }

        return total;
    }

    /**
     * @notice Get lock duration for a tier
     */
    function getLockDuration(LockTier tier) public pure returns (uint256) {
        if (tier == LockTier.DAYS_7) return LOCK_7_DAYS;
        if (tier == LockTier.MONTH_1) return LOCK_1_MONTH;
        if (tier == LockTier.MONTHS_3) return LOCK_3_MONTHS;
        if (tier == LockTier.MONTHS_6) return LOCK_6_MONTHS;
        revert("Invalid tier");
    }

    /**
     * @notice Get weight multiplier for a tier (in basis points)
     */
    function getWeightMultiplier(LockTier tier) public pure returns (uint256) {
        if (tier == LockTier.DAYS_7) return WEIGHT_7_DAYS;
        if (tier == LockTier.MONTH_1) return WEIGHT_1_MONTH;
        if (tier == LockTier.MONTHS_3) return WEIGHT_3_MONTHS;
        if (tier == LockTier.MONTHS_6) return WEIGHT_6_MONTHS;
        revert("Invalid tier");
    }

    /**
     * @notice Get user's stake details
     */
    function getStake(address account, uint256 stakeId) external view returns (
        uint256 amount,
        uint256 weightedAmount,
        uint256 pendingRewards,
        uint256 stakedAt,
        uint256 unlockTime,
        LockTier tier,
        bool isUnlocked
    ) {
        Stake storage userStake = userStakes[account][stakeId];
        return (
            userStake.amount,
            userStake.weightedAmount,
            earned(account, stakeId),
            userStake.stakedAt,
            userStake.unlockTime,
            userStake.tier,
            block.timestamp >= userStake.unlockTime
        );
    }

    /**
     * @notice Get all active stakes for a user
     */
    function getUserStakes(address account) external view returns (
        uint256[] memory amounts,
        uint256[] memory unlockTimes,
        uint256[] memory rewards,
        LockTier[] memory tiers
    ) {
        uint256 count = userStakeCount[account];
        uint256 activeCount = 0;

        // Count active stakes
        for (uint256 i = 0; i < count; i++) {
            if (userStakes[account][i].exists && userStakes[account][i].amount > 0) {
                activeCount++;
            }
        }

        amounts = new uint256[](activeCount);
        unlockTimes = new uint256[](activeCount);
        rewards = new uint256[](activeCount);
        tiers = new LockTier[](activeCount);

        uint256 index = 0;
        for (uint256 i = 0; i < count && index < activeCount; i++) {
            Stake storage userStake = userStakes[account][i];
            if (userStake.exists && userStake.amount > 0) {
                amounts[index] = userStake.amount;
                unlockTimes[index] = userStake.unlockTime;
                rewards[index] = earned(account, i);
                tiers[index] = userStake.tier;
                index++;
            }
        }
    }

    /**
     * @notice Calculate estimated APY for a given tier (in basis points)
     * @dev This is an estimate based on current total weighted stake
     */
    function getEstimatedAPY(LockTier tier) external view returns (uint256) {
        if (totalWeightedStake == 0) return 0;

        uint256 weight = getWeightMultiplier(tier);
        uint256 annualRewards = REWARD_RATE_PER_SECOND * 365 days;

        // APY = (annual rewards * weight / total weighted) / BPS_DENOMINATOR
        // Result in basis points
        return (annualRewards * weight * BPS_DENOMINATOR) / (totalWeightedStake * BPS_DENOMINATOR / PRECISION);
    }

    /**
     * @notice Get staking statistics
     */
    function getStakingStats() external view returns (
        uint256 _totalRawStake,
        uint256 _totalWeightedStake,
        uint256 _totalRewardsDistributed,
        uint256 _remainingRewards,
        uint256 _stakingStartTime,
        uint256 _timeRemaining
    ) {
        uint256 endTime = stakingStartTime > 0 ? stakingStartTime + DISTRIBUTION_PERIOD : 0;
        uint256 remaining = block.timestamp < endTime ? endTime - block.timestamp : 0;

        return (
            totalRawStake,
            totalWeightedStake,
            totalRewardsDistributed,
            TOTAL_STAKING_POOL - totalRewardsDistributed,
            stakingStartTime,
            remaining
        );
    }

    /**
     * @notice Get tier information
     */
    function getTierInfo() external pure returns (
        uint256[4] memory durations,
        uint256[4] memory weights
    ) {
        durations = [LOCK_7_DAYS, LOCK_1_MONTH, LOCK_3_MONTHS, LOCK_6_MONTHS];
        weights = [WEIGHT_7_DAYS, WEIGHT_1_MONTH, WEIGHT_3_MONTHS, WEIGHT_6_MONTHS];
    }

    // ═══════════════════════════════════════════════════════════════════
    // INTERNAL FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════

    /**
     * @notice Internal function to calculate earned rewards
     */
    function _calculateEarned(Stake storage userStake) internal view returns (uint256) {
        uint256 currentRewardPerToken = rewardPerWeightedToken();
        uint256 rewardDelta = currentRewardPerToken - userStake.rewardPerTokenPaid;
        return userStake.pendingRewards + ((userStake.weightedAmount * rewardDelta) / PRECISION);
    }

    /**
     * @notice Internal function to mint or transfer rewards
     * @dev Tries to mint via EightBitToken.mintReward(), falls back to transfer
     */
    function _mintReward(address to, uint256 amount) internal {
        require(totalRewardsDistributed + amount <= TOTAL_STAKING_POOL, "Exceeds pool");

        totalRewardsDistributed += amount;

        // Try to mint rewards through the token contract
        if (rewardMinter != address(0)) {
            // Call mintReward on the token contract
            (bool success, ) = rewardMinter.call(
                abi.encodeWithSignature("mintReward(address,uint256)", to, amount)
            );

            if (success) {
                emit RewardsMinted(to, amount);
                return;
            }
        }

        // Fallback: transfer from contract balance (requires pre-funding)
        stakingToken.safeTransfer(to, amount);
        emit RewardsMinted(to, amount);
    }
}
