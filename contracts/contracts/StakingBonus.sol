// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./EightBitToken.sol";

/**
 * @title StakingBonus
 * @notice Distributes bonus rewards to stakers who win daily leaderboard
 * @dev Works alongside GameRewards - this only handles the BONUS portion
 *
 * Flow:
 * 1. GameRewards distributes base rewards (existing, unchanged)
 * 2. Firebase calculates staking bonus for each winner
 * 3. Firebase calls this contract to mint bonus tokens
 *
 * Example: Player wins rank 1 (2500 base tokens)
 * - If staking 1M tokens (Tier 3, 1.5x multiplier)
 * - Bonus = 2500 * 0.5 = 1250 tokens (the extra 50%)
 * - This contract mints the 1250 bonus
 */
contract StakingBonus is Ownable, ReentrancyGuard {
    EightBitToken public token;

    /// @notice Address authorized to distribute bonuses (Firebase backend wallet)
    address public bonusDistributor;

    // ============ Adjustable Tier Thresholds ============

    /// @notice Tokens required for each tier
    uint256 public tier1Threshold = 100_000 * 10**18;   // 100k tokens (~$50 at launch)
    uint256 public tier2Threshold = 500_000 * 10**18;   // 500k tokens (~$250 at launch)
    uint256 public tier3Threshold = 1_000_000 * 10**18; // 1M tokens (~$500 at launch)

    /// @notice Bonus percentages for each tier (basis points)
    /// These represent the EXTRA bonus, not the multiplier
    /// e.g., 1000 = 10% bonus on top of base reward
    uint256 public tier1BonusBps = 1000;  // 10% bonus (equivalent to 1.1x)
    uint256 public tier2BonusBps = 2500;  // 25% bonus (equivalent to 1.25x)
    uint256 public tier3BonusBps = 5000;  // 50% bonus (equivalent to 1.5x)

    uint256 public constant BASIS_POINTS = 10000;
    uint256 public constant MAX_BONUS_BPS = 10000; // Max 100% bonus (2x)

    /// @notice Track bonuses distributed per day to prevent double-distribution
    mapping(uint256 => mapping(address => bool)) public bonusDistributed;

    /// @notice Track total bonuses earned by each player
    mapping(address => uint256) public totalBonusEarned;

    /// @notice Total bonuses distributed all-time
    uint256 public totalBonusesDistributed;

    // ============ Events ============

    event BonusDistributed(
        uint256 indexed dayId,
        address indexed player,
        uint256 baseReward,
        uint256 stakedAmount,
        uint256 bonusBps,
        uint256 bonusAmount
    );
    event DistributorUpdated(address indexed oldAddress, address indexed newAddress);
    event TierThresholdsUpdated(uint256 tier1, uint256 tier2, uint256 tier3);
    event TierBonusesUpdated(uint256 tier1Bps, uint256 tier2Bps, uint256 tier3Bps);

    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        token = EightBitToken(_token);
        bonusDistributor = msg.sender;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update the bonus distributor address
     * @param _distributor New distributor address (Firebase wallet)
     */
    function setBonusDistributor(address _distributor) external onlyOwner {
        require(_distributor != address(0), "Invalid address");
        address oldAddress = bonusDistributor;
        bonusDistributor = _distributor;
        emit DistributorUpdated(oldAddress, _distributor);
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
     * @notice Update tier bonus percentages
     * @param _tier1Bps Bonus for tier 1 (basis points, 1000 = 10%)
     * @param _tier2Bps Bonus for tier 2
     * @param _tier3Bps Bonus for tier 3
     */
    function setTierBonuses(
        uint256 _tier1Bps,
        uint256 _tier2Bps,
        uint256 _tier3Bps
    ) external onlyOwner {
        require(_tier1Bps <= _tier2Bps && _tier2Bps <= _tier3Bps, "Bonuses must be ascending");
        require(_tier3Bps <= MAX_BONUS_BPS, "Exceeds max bonus");
        tier1BonusBps = _tier1Bps;
        tier2BonusBps = _tier2Bps;
        tier3BonusBps = _tier3Bps;
        emit TierBonusesUpdated(_tier1Bps, _tier2Bps, _tier3Bps);
    }

    // ============ View Functions ============

    /**
     * @notice Get bonus percentage for a staked amount
     * @param stakedAmount Amount of tokens staked
     * @return Bonus in basis points (0 if below tier 1)
     */
    function getBonusBps(uint256 stakedAmount) public view returns (uint256) {
        if (stakedAmount >= tier3Threshold) return tier3BonusBps;
        if (stakedAmount >= tier2Threshold) return tier2BonusBps;
        if (stakedAmount >= tier1Threshold) return tier1BonusBps;
        return 0; // No bonus
    }

    /**
     * @notice Calculate bonus amount for a player
     * @param baseReward The base reward amount from GameRewards
     * @param stakedAmount Amount player has staked
     * @return bonusAmount The bonus tokens to mint
     */
    function calculateBonus(uint256 baseReward, uint256 stakedAmount) public view returns (uint256) {
        uint256 bonusBps = getBonusBps(stakedAmount);
        if (bonusBps == 0) return 0;
        return (baseReward * bonusBps) / BASIS_POINTS;
    }

    /**
     * @notice Get current tier configuration
     */
    function getTierConfig() external view returns (
        uint256[3] memory thresholds,
        uint256[3] memory bonuses
    ) {
        thresholds = [tier1Threshold, tier2Threshold, tier3Threshold];
        bonuses = [tier1BonusBps, tier2BonusBps, tier3BonusBps];
    }

    // ============ Core Functions ============

    /**
     * @notice Distribute bonus to a single player
     * @dev Called by Firebase after GameRewards distribution
     * @param dayId Day identifier (YYYYMMDD)
     * @param player Player address
     * @param baseReward Base reward they received from GameRewards
     * @param stakedAmount Amount they have staked (from Firebase reading staking contract)
     */
    function distributeBonus(
        uint256 dayId,
        address player,
        uint256 baseReward,
        uint256 stakedAmount
    ) external nonReentrant {
        require(msg.sender == bonusDistributor, "Only distributor can call");
        require(player != address(0), "Invalid player");
        require(!bonusDistributed[dayId][player], "Bonus already distributed");

        uint256 bonusBps = getBonusBps(stakedAmount);
        if (bonusBps == 0) {
            // No bonus for this player, but mark as processed
            bonusDistributed[dayId][player] = true;
            emit BonusDistributed(dayId, player, baseReward, stakedAmount, 0, 0);
            return;
        }

        uint256 bonusAmount = (baseReward * bonusBps) / BASIS_POINTS;

        bonusDistributed[dayId][player] = true;
        totalBonusEarned[player] += bonusAmount;
        totalBonusesDistributed += bonusAmount;

        // Mint bonus tokens
        token.mintReward(player, bonusAmount);

        emit BonusDistributed(dayId, player, baseReward, stakedAmount, bonusBps, bonusAmount);
    }

    /**
     * @notice Batch distribute bonuses to multiple players
     * @dev More gas efficient for distributing to all winners at once
     * @param dayId Day identifier
     * @param players Array of player addresses
     * @param baseRewards Array of base rewards each player received
     * @param stakedAmounts Array of staked amounts for each player
     */
    function distributeBonusBatch(
        uint256 dayId,
        address[] calldata players,
        uint256[] calldata baseRewards,
        uint256[] calldata stakedAmounts
    ) external nonReentrant {
        require(msg.sender == bonusDistributor, "Only distributor can call");
        require(players.length == baseRewards.length, "Arrays length mismatch");
        require(players.length == stakedAmounts.length, "Arrays length mismatch");
        require(players.length <= 10, "Max 10 players per batch");

        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];

            if (player == address(0) || bonusDistributed[dayId][player]) {
                continue; // Skip invalid or already processed
            }

            uint256 bonusBps = getBonusBps(stakedAmounts[i]);
            bonusDistributed[dayId][player] = true;

            if (bonusBps == 0) {
                emit BonusDistributed(dayId, player, baseRewards[i], stakedAmounts[i], 0, 0);
                continue;
            }

            uint256 bonusAmount = (baseRewards[i] * bonusBps) / BASIS_POINTS;
            totalBonusEarned[player] += bonusAmount;
            totalBonusesDistributed += bonusAmount;

            token.mintReward(player, bonusAmount);
            emit BonusDistributed(dayId, player, baseRewards[i], stakedAmounts[i], bonusBps, bonusAmount);
        }
    }

    /**
     * @notice Check if bonus was distributed for a player on a day
     */
    function isBonusDistributed(uint256 dayId, address player) external view returns (bool) {
        return bonusDistributed[dayId][player];
    }
}
