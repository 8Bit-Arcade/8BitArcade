// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./EightBitToken.sol";

/**
 * @title GameRewardsV2
 * @notice Manages daily leaderboard rewards with staking multipliers
 * @dev Distributes 8BIT tokens to top players, with bonus multipliers for stakers
 */
contract GameRewardsV2 is Ownable, ReentrancyGuard {
    EightBitToken public token;

    /// @notice Staking contract interface for checking balances
    IStaking public stakingContract;

    /// @notice Backend wallet that calls distributeRewards()
    address public rewardsDistributor;

    /// @notice Daily reward pool size in tokens
    uint256 public dailyRewardPool = 10_000 * 10**18; // 10,000 8BIT per day

    /// @notice Track if rewards have been distributed for a specific day
    mapping(uint256 => bool) public rewardsDistributed;

    /// @notice Track total rewards earned by each player
    mapping(address => uint256) public totalRewardsEarned;

    // ============ Staking Multiplier Tiers (Adjustable) ============

    /// @notice Tier thresholds (tokens staked required)
    uint256 public tier1Threshold = 100_000 * 10**18;   // 100k tokens
    uint256 public tier2Threshold = 500_000 * 10**18;   // 500k tokens
    uint256 public tier3Threshold = 1_000_000 * 10**18; // 1M tokens

    /// @notice Tier multipliers (basis points, 10000 = 1x)
    uint256 public tier1Multiplier = 11000; // 1.1x (10% bonus)
    uint256 public tier2Multiplier = 12500; // 1.25x (25% bonus)
    uint256 public tier3Multiplier = 15000; // 1.5x (50% bonus)

    uint256 public constant BASIS_POINTS = 10000;

    // ============ Rank Reward Distribution ============

    /// @dev Reward percentages (basis points out of 10000)
    uint256 public constant RANK_1_BPS = 2500;    // 25%
    uint256 public constant RANK_2_5_BPS = 1250;  // 12.5% each
    uint256 public constant RANK_6_10_BPS = 500;  // 5% each

    // ============ Events ============

    event RewardDistributed(
        uint256 indexed dayId,
        address indexed player,
        uint256 rank,
        uint256 baseAmount,
        uint256 multiplier,
        uint256 finalAmount
    );
    event RewardPoolUpdated(uint256 newAmount);
    event DistributorUpdated(address indexed oldAddress, address indexed newAddress);
    event StakingContractUpdated(address indexed newAddress);
    event TierThresholdsUpdated(uint256 tier1, uint256 tier2, uint256 tier3);
    event TierMultipliersUpdated(uint256 tier1, uint256 tier2, uint256 tier3);

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        token = EightBitToken(_token);
        rewardsDistributor = msg.sender;
    }

    // ============ Admin Functions ============

    /**
     * @notice Set the staking contract address
     * @param _stakingContract Address of the staking contract
     */
    function setStakingContract(address _stakingContract) external onlyOwner {
        require(_stakingContract != address(0), "Invalid address");
        stakingContract = IStaking(_stakingContract);
        emit StakingContractUpdated(_stakingContract);
    }

    /**
     * @notice Update the rewards distributor address
     * @param _distributor New distributor address
     */
    function setRewardsDistributor(address _distributor) external onlyOwner {
        require(_distributor != address(0), "Invalid address");
        address oldAddress = rewardsDistributor;
        rewardsDistributor = _distributor;
        emit DistributorUpdated(oldAddress, _distributor);
    }

    /**
     * @notice Update daily reward pool size
     * @param _newAmount New daily reward amount
     */
    function setDailyRewardPool(uint256 _newAmount) external onlyOwner {
        dailyRewardPool = _newAmount;
        emit RewardPoolUpdated(_newAmount);
    }

    /**
     * @notice Update staking tier thresholds
     * @param _tier1 Tokens required for tier 1
     * @param _tier2 Tokens required for tier 2
     * @param _tier3 Tokens required for tier 3
     */
    function setTierThresholds(
        uint256 _tier1,
        uint256 _tier2,
        uint256 _tier3
    ) external onlyOwner {
        require(_tier1 < _tier2 && _tier2 < _tier3, "Tiers must be ascending");
        tier1Threshold = _tier1;
        tier2Threshold = _tier2;
        tier3Threshold = _tier3;
        emit TierThresholdsUpdated(_tier1, _tier2, _tier3);
    }

    /**
     * @notice Update staking tier multipliers
     * @param _tier1 Multiplier for tier 1 (basis points, 11000 = 1.1x)
     * @param _tier2 Multiplier for tier 2
     * @param _tier3 Multiplier for tier 3
     */
    function setTierMultipliers(
        uint256 _tier1,
        uint256 _tier2,
        uint256 _tier3
    ) external onlyOwner {
        require(_tier1 >= BASIS_POINTS, "Tier 1 must be >= 1x");
        require(_tier1 <= _tier2 && _tier2 <= _tier3, "Multipliers must be ascending");
        require(_tier3 <= 30000, "Max multiplier is 3x"); // Safety cap
        tier1Multiplier = _tier1;
        tier2Multiplier = _tier2;
        tier3Multiplier = _tier3;
        emit TierMultipliersUpdated(_tier1, _tier2, _tier3);
    }

    // ============ View Functions ============

    /**
     * @notice Get staking multiplier for a player
     * @param player Player address
     * @return Multiplier in basis points (10000 = 1x, 15000 = 1.5x)
     */
    function getStakingMultiplier(address player) public view returns (uint256) {
        if (address(stakingContract) == address(0)) {
            return BASIS_POINTS; // No staking contract set, return 1x
        }

        uint256 staked = stakingContract.balanceOf(player);

        if (staked >= tier3Threshold) return tier3Multiplier;
        if (staked >= tier2Threshold) return tier2Multiplier;
        if (staked >= tier1Threshold) return tier1Multiplier;
        return BASIS_POINTS; // 1x (no bonus)
    }

    /**
     * @notice Calculate base reward amount for a given rank
     * @param rank Player's rank (1-10)
     * @return Base reward amount in tokens
     */
    function getRewardForRank(uint256 rank) public view returns (uint256) {
        if (rank == 1) {
            return (dailyRewardPool * RANK_1_BPS) / BASIS_POINTS;
        } else if (rank >= 2 && rank <= 5) {
            return (dailyRewardPool * RANK_2_5_BPS) / BASIS_POINTS;
        } else if (rank >= 6 && rank <= 10) {
            return (dailyRewardPool * RANK_6_10_BPS) / BASIS_POINTS;
        }
        return 0;
    }

    /**
     * @notice Calculate final reward with staking multiplier
     * @param player Player address
     * @param rank Player's rank
     * @return finalReward The reward after applying staking multiplier
     */
    function calculateReward(address player, uint256 rank) public view returns (uint256 finalReward) {
        uint256 baseReward = getRewardForRank(rank);
        uint256 multiplier = getStakingMultiplier(player);
        finalReward = (baseReward * multiplier) / BASIS_POINTS;
    }

    /**
     * @notice Get current tier configuration
     * @return thresholds Array of [tier1, tier2, tier3] thresholds
     * @return multipliers Array of [tier1, tier2, tier3] multipliers
     */
    function getTierConfig() external view returns (
        uint256[3] memory thresholds,
        uint256[3] memory multipliers
    ) {
        thresholds = [tier1Threshold, tier2Threshold, tier3Threshold];
        multipliers = [tier1Multiplier, tier2Multiplier, tier3Multiplier];
    }

    // ============ Core Functions ============

    /**
     * @notice Distribute rewards for a specific day
     * @dev Only callable by rewardsDistributor
     * @param dayId Day identifier (YYYYMMDD format)
     * @param players Array of player addresses (in rank order)
     * @param ranks Array of ranks corresponding to players
     */
    function distributeRewards(
        uint256 dayId,
        address[] calldata players,
        uint256[] calldata ranks
    ) external nonReentrant {
        require(msg.sender == rewardsDistributor, "Only distributor can call");
        require(!rewardsDistributed[dayId], "Already distributed for this day");
        require(players.length == ranks.length, "Arrays length mismatch");
        require(players.length <= 10, "Max 10 rewards per day");

        rewardsDistributed[dayId] = true;

        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            uint256 rank = ranks[i];

            uint256 baseReward = getRewardForRank(rank);
            uint256 multiplier = getStakingMultiplier(player);
            uint256 finalReward = (baseReward * multiplier) / BASIS_POINTS;

            if (finalReward > 0 && player != address(0)) {
                token.mintReward(player, finalReward);
                totalRewardsEarned[player] += finalReward;
                emit RewardDistributed(dayId, player, rank, baseReward, multiplier, finalReward);
            }
        }
    }

    /**
     * @notice Check if rewards have been distributed for a day
     * @param dayId Day identifier
     * @return bool True if rewards were distributed
     */
    function isDistributed(uint256 dayId) external view returns (bool) {
        return rewardsDistributed[dayId];
    }

    /**
     * @notice Get total rewards earned by a player
     * @param player Player address
     * @return uint256 Total rewards earned
     */
    function getPlayerRewards(address player) external view returns (uint256) {
        return totalRewardsEarned[player];
    }
}

/**
 * @title IStaking
 * @notice Interface for the Staking contract
 */
interface IStaking {
    function balanceOf(address account) external view returns (uint256);
}
