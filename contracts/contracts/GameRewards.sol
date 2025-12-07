// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./EightBitToken.sol";

/**
 * @title GameRewards
 * @notice Manages daily leaderboard rewards for 8-Bit Arcade
 * @dev Distributes 8BIT tokens to top players based on daily rankings
 */
contract GameRewards is Ownable, ReentrancyGuard {
    EightBitToken public token;

    /**
     * ⚠️ IMPORTANT: UPDATE THIS ADDRESS BEFORE USE ⚠️
     *
     * This is the backend server wallet that calls distributeRewards().
     * Set this to a secure wallet you control.
     *
     * The rewardsDistributor is the only address that can trigger reward distributions
     * based on the daily leaderboard results verified by your Firebase functions.
     */
    address public rewardsDistributor;

    /// @notice Daily reward pool size in tokens
    uint256 public dailyRewardPool = 10_000 * 10**18; // 10,000 8BIT per day

    /// @notice Track if rewards have been distributed for a specific day
    mapping(uint256 => bool) public rewardsDistributed;

    /// @notice Track total rewards earned by each player
    mapping(address => uint256) public totalRewardsEarned;

    event RewardDistributed(
        uint256 indexed dayId,
        address indexed player,
        uint256 rank,
        uint256 amount
    );
    event RewardPoolUpdated(uint256 newAmount);
    event DistributorUpdated(address indexed oldAddress, address indexed newAddress);

    /**
     * @dev Reward distribution percentages (basis points out of 10000)
     * Rank 1: 25% = 2500 basis points
     * Rank 2-5: 12.5% each = 1250 basis points
     * Rank 6-10: 5% each = 500 basis points
     */
    uint256 public constant RANK_1_BPS = 2500;
    uint256 public constant RANK_2_5_BPS = 1250;
    uint256 public constant RANK_6_10_BPS = 500;
    uint256 public constant BASIS_POINTS = 10000;

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        token = EightBitToken(_token);
        rewardsDistributor = msg.sender; // Initially set to deployer
    }

    /**
     * @notice Update the rewards distributor address
     * @dev ⚠️ IMPORTANT: Set this to your secure backend wallet
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
     * @notice Calculate reward amount for a given rank
     * @param rank Player's rank (1-10)
     * @return Reward amount in tokens
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
     * @notice Distribute rewards for a specific day
     * @dev Only callable by rewardsDistributor (your backend)
     * @param dayId Day identifier (e.g., YYYYMMDD format)
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
            uint256 reward = getRewardForRank(rank);

            if (reward > 0 && player != address(0)) {
                token.mintReward(player, reward);
                totalRewardsEarned[player] += reward;
                emit RewardDistributed(dayId, player, rank, reward);
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
