// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title AchievementManager
 * @notice Coordinates goal definitions, achievement verification, and NFT minting for 8-Bit Arcade
 * @dev UUPS upgradeable. Acts as the central hub between the game backend and the NFT contracts.
 *
 * Goal System:
 *   - Goals are defined on-chain with unique IDs matching the backend goal system
 *   - Each goal has criteria thresholds (e.g., score >= 10000, games played >= 50)
 *   - Backend verifies player progress, then calls awardAchievement()
 *   - This contract mints the soulbound badge AND optionally a tradeable reward item
 *
 * Flow:
 *   1. Admin creates goals via createGoal()
 *   2. Player reaches goal in-game (tracked by Firebase)
 *   3. Backend calls awardAchievement() after verification
 *   4. AchievementManager mints soulbound badge + optional tradeable reward
 */
contract AchievementManager is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable
{

    // ═══════════════════════════════════════════════════════════
    // TYPES
    // ═══════════════════════════════════════════════════════════

    enum GoalCategory {
        SCORE,          // Reach a score threshold in a specific game
        GAMES_PLAYED,   // Play N total games
        WINS,           // Win N tournament games
        STREAK,         // Achieve a daily play streak
        COLLECTION,     // Own N different achievement badges
        SOCIAL,         // Refer N players, etc.
        SPECIAL         // One-time events, seasonal, etc.
    }

    struct Goal {
        uint256 id;
        string name;                    // Human-readable name (e.g., "Space Rocks Master")
        string description;             // What the player needs to do
        GoalCategory category;
        uint256 threshold;              // Numeric threshold to reach
        string gameId;                  // Specific game (empty = any/global)
        uint256 achievementTypeId;      // Maps to AchievementBadges achievement type
        uint256 rewardItemTypeId;       // Optional tradeable item reward (0 = none)
        uint256 rewardTokenAmount;      // Optional 8BIT token reward (0 = none)
        bool active;
    }

    // ═══════════════════════════════════════════════════════════
    // STATE
    // ═══════════════════════════════════════════════════════════

    /// @notice Achievement badges contract (soulbound)
    address public achievementBadges;

    /// @notice Tradeable items contract
    address public tradeableItems;

    /// @notice 8BIT token contract (for optional token rewards)
    address public eightBitToken;

    /// @notice Authorized backend wallet(s) that can award achievements
    mapping(address => bool) public authorizedVerifiers;

    /// @notice Goal definitions (goalId => Goal)
    mapping(uint256 => Goal) public goals;

    /// @notice Next goal ID
    uint256 public nextGoalId;

    /// @notice Track awarded achievements (player => goalId => awarded)
    mapping(address => mapping(uint256 => bool)) public playerGoalCompleted;

    /// @notice Total achievements awarded per player
    mapping(address => uint256) public playerTotalAchievements;

    /// @notice Total achievements awarded globally
    uint256 public totalAchievementsAwarded;

    /// @notice Metadata URI template for badges (used when minting)
    string public badgeMetadataBaseURI;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event GoalCreated(
        uint256 indexed goalId,
        string name,
        GoalCategory category,
        uint256 threshold
    );

    event GoalUpdated(uint256 indexed goalId, bool active);

    event AchievementAwarded(
        address indexed player,
        uint256 indexed goalId,
        uint256 badgeTokenId,
        uint256 rewardItemTokenId,
        uint256 rewardTokenAmount
    );

    event VerifierUpdated(address indexed verifier, bool authorized);

    // ═══════════════════════════════════════════════════════════
    // INITIALIZER (replaces constructor for proxy)
    // ═══════════════════════════════════════════════════════════

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address _achievementBadges,
        address _tradeableItems,
        address _eightBitToken,
        string memory _badgeMetadataBaseURI
    ) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();

        achievementBadges = _achievementBadges;
        tradeableItems = _tradeableItems;
        eightBitToken = _eightBitToken;
        badgeMetadataBaseURI = _badgeMetadataBaseURI;
        nextGoalId = 1;
    }

    // ═══════════════════════════════════════════════════════════
    // GOAL MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Create a new goal
     * @param name Human-readable goal name
     * @param description What the player needs to do
     * @param category Goal category
     * @param threshold Numeric threshold to reach
     * @param gameId Specific game ID (empty string for global goals)
     * @param achievementTypeId Maps to AchievementBadges type
     * @param rewardItemTypeId Tradeable item reward (0 = no item reward)
     * @param rewardTokenAmount 8BIT token reward (0 = no token reward)
     */
    function createGoal(
        string calldata name,
        string calldata description,
        GoalCategory category,
        uint256 threshold,
        string calldata gameId,
        uint256 achievementTypeId,
        uint256 rewardItemTypeId,
        uint256 rewardTokenAmount
    ) external onlyOwner returns (uint256) {
        uint256 goalId = nextGoalId++;

        goals[goalId] = Goal({
            id: goalId,
            name: name,
            description: description,
            category: category,
            threshold: threshold,
            gameId: gameId,
            achievementTypeId: achievementTypeId,
            rewardItemTypeId: rewardItemTypeId,
            rewardTokenAmount: rewardTokenAmount,
            active: true
        });

        emit GoalCreated(goalId, name, category, threshold);

        return goalId;
    }

    /**
     * @notice Activate or deactivate a goal
     */
    function setGoalActive(uint256 goalId, bool active) external onlyOwner {
        require(goalId > 0 && goalId < nextGoalId, "Invalid goal ID");
        goals[goalId].active = active;
        emit GoalUpdated(goalId, active);
    }

    /**
     * @notice Input struct for batch goal creation (avoids stack-too-deep)
     */
    struct GoalInput {
        string name;
        string description;
        GoalCategory category;
        uint256 threshold;
        string gameId;
        uint256 achievementTypeId;
        uint256 rewardItemTypeId;
        uint256 rewardTokenAmount;
    }

    /**
     * @notice Batch create multiple goals
     * @param inputs Array of GoalInput structs
     */
    function batchCreateGoals(GoalInput[] calldata inputs) external onlyOwner {
        for (uint256 i = 0; i < inputs.length; i++) {
            uint256 goalId = nextGoalId++;
            GoalInput calldata g = inputs[i];

            goals[goalId] = Goal({
                id: goalId,
                name: g.name,
                description: g.description,
                category: g.category,
                threshold: g.threshold,
                gameId: g.gameId,
                achievementTypeId: g.achievementTypeId,
                rewardItemTypeId: g.rewardItemTypeId,
                rewardTokenAmount: g.rewardTokenAmount,
                active: true
            });

            emit GoalCreated(goalId, g.name, g.category, g.threshold);
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ACHIEVEMENT AWARDING
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Award an achievement to a player after backend verification
     * @dev Only callable by authorized verifiers. Mints soulbound badge + optional rewards.
     * @param player Player address
     * @param goalId Goal that was completed
     */
    function awardAchievement(
        address player,
        uint256 goalId
    ) external nonReentrant {
        require(authorizedVerifiers[msg.sender], "Not authorized verifier");
        require(player != address(0), "Invalid player address");
        require(goalId > 0 && goalId < nextGoalId, "Invalid goal ID");

        Goal storage goal = goals[goalId];
        require(goal.active, "Goal not active");
        require(!playerGoalCompleted[player][goalId], "Goal already completed by player");

        // Mark as completed
        playerGoalCompleted[player][goalId] = true;
        playerTotalAchievements[player]++;
        totalAchievementsAwarded++;

        // 1. Mint soulbound achievement badge
        uint256 badgeTokenId = 0;
        if (achievementBadges != address(0)) {
            string memory badgeURI = string(
                abi.encodePacked(badgeMetadataBaseURI, _uint2str(goal.achievementTypeId), ".json")
            );

            (bool success, bytes memory data) = achievementBadges.call(
                abi.encodeWithSignature(
                    "mintBadge(address,uint256,string)",
                    player,
                    goal.achievementTypeId,
                    badgeURI
                )
            );
            if (success && data.length >= 32) {
                badgeTokenId = abi.decode(data, (uint256));
            }
        }

        // 2. Mint optional tradeable item reward
        uint256 rewardItemTokenId = 0;
        if (goal.rewardItemTypeId > 0 && tradeableItems != address(0)) {
            (bool success, bytes memory data) = tradeableItems.call(
                abi.encodeWithSignature(
                    "mintReward(address,uint256)",
                    player,
                    goal.rewardItemTypeId
                )
            );
            if (success && data.length >= 32) {
                rewardItemTokenId = abi.decode(data, (uint256));
            }
        }

        // 3. Mint optional 8BIT token reward
        if (goal.rewardTokenAmount > 0 && eightBitToken != address(0)) {
            (bool success, ) = eightBitToken.call(
                abi.encodeWithSignature(
                    "mintReward(address,uint256)",
                    player,
                    goal.rewardTokenAmount
                )
            );
            // Token mint is best-effort; don't revert if it fails
            success; // Suppress unused variable warning
        }

        emit AchievementAwarded(
            player,
            goalId,
            badgeTokenId,
            rewardItemTokenId,
            goal.rewardTokenAmount
        );
    }

    /**
     * @notice Batch award achievements to multiple players
     * @dev Useful for retroactive awards or event-based achievements
     * @param players Array of player addresses
     * @param goalId Goal to award to all players
     */
    function batchAwardAchievement(
        address[] calldata players,
        uint256 goalId
    ) external nonReentrant {
        require(authorizedVerifiers[msg.sender], "Not authorized verifier");
        require(goalId > 0 && goalId < nextGoalId, "Invalid goal ID");

        Goal storage goal = goals[goalId];
        require(goal.active, "Goal not active");

        for (uint256 i = 0; i < players.length; i++) {
            address player = players[i];
            if (player == address(0) || playerGoalCompleted[player][goalId]) {
                continue; // Skip invalid or already completed
            }

            playerGoalCompleted[player][goalId] = true;
            playerTotalAchievements[player]++;
            totalAchievementsAwarded++;

            // Mint soulbound badge
            uint256 badgeTokenId = 0;
            if (achievementBadges != address(0)) {
                string memory badgeURI = string(
                    abi.encodePacked(badgeMetadataBaseURI, _uint2str(goal.achievementTypeId), ".json")
                );

                (bool success, bytes memory data) = achievementBadges.call(
                    abi.encodeWithSignature(
                        "mintBadge(address,uint256,string)",
                        player,
                        goal.achievementTypeId,
                        badgeURI
                    )
                );
                if (success && data.length >= 32) {
                    badgeTokenId = abi.decode(data, (uint256));
                }
            }

            // Mint optional tradeable reward
            uint256 rewardItemTokenId = 0;
            if (goal.rewardItemTypeId > 0 && tradeableItems != address(0)) {
                (bool success, bytes memory data) = tradeableItems.call(
                    abi.encodeWithSignature(
                        "mintReward(address,uint256)",
                        player,
                        goal.rewardItemTypeId
                    )
                );
                if (success && data.length >= 32) {
                    rewardItemTokenId = abi.decode(data, (uint256));
                }
            }

            // Mint optional token reward
            if (goal.rewardTokenAmount > 0 && eightBitToken != address(0)) {
                (bool success, ) = eightBitToken.call(
                    abi.encodeWithSignature(
                        "mintReward(address,uint256)",
                        player,
                        goal.rewardTokenAmount
                    )
                );
                success;
            }

            emit AchievementAwarded(
                player,
                goalId,
                badgeTokenId,
                rewardItemTokenId,
                goal.rewardTokenAmount
            );
        }
    }

    // ═══════════════════════════════════════════════════════════
    // VIEWS
    // ═══════════════════════════════════════════════════════════

    /**
     * @notice Get goal details
     */
    function getGoal(uint256 goalId) external view returns (
        string memory name,
        string memory description,
        GoalCategory category,
        uint256 threshold,
        string memory gameId,
        uint256 achievementTypeId,
        uint256 rewardItemTypeId,
        uint256 rewardTokenAmount,
        bool active
    ) {
        Goal storage goal = goals[goalId];
        return (
            goal.name,
            goal.description,
            goal.category,
            goal.threshold,
            goal.gameId,
            goal.achievementTypeId,
            goal.rewardItemTypeId,
            goal.rewardTokenAmount,
            goal.active
        );
    }

    /**
     * @notice Check if a player has completed a specific goal
     */
    function hasCompletedGoal(address player, uint256 goalId) external view returns (bool) {
        return playerGoalCompleted[player][goalId];
    }

    /**
     * @notice Get total achievements for a player
     */
    function getPlayerAchievementCount(address player) external view returns (uint256) {
        return playerTotalAchievements[player];
    }

    /**
     * @notice Check which goals a player has completed from a list
     * @param player Player address
     * @param goalIds Array of goal IDs to check
     * @return completed Array of booleans indicating completion status
     */
    function getPlayerGoalStatuses(
        address player,
        uint256[] calldata goalIds
    ) external view returns (bool[] memory completed) {
        completed = new bool[](goalIds.length);
        for (uint256 i = 0; i < goalIds.length; i++) {
            completed[i] = playerGoalCompleted[player][goalIds[i]];
        }
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    function setAuthorizedVerifier(address verifier, bool authorized) external onlyOwner {
        require(verifier != address(0), "Invalid verifier address");
        authorizedVerifiers[verifier] = authorized;
        emit VerifierUpdated(verifier, authorized);
    }

    function setAchievementBadges(address _achievementBadges) external onlyOwner {
        achievementBadges = _achievementBadges;
    }

    function setTradeableItems(address _tradeableItems) external onlyOwner {
        tradeableItems = _tradeableItems;
    }

    function setEightBitToken(address _eightBitToken) external onlyOwner {
        eightBitToken = _eightBitToken;
    }

    function setBadgeMetadataBaseURI(string calldata _uri) external onlyOwner {
        badgeMetadataBaseURI = _uri;
    }

    // ═══════════════════════════════════════════════════════════
    // UUPS UPGRADE AUTHORIZATION
    // ═══════════════════════════════════════════════════════════

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // ═══════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Convert uint256 to string
     */
    function _uint2str(uint256 _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint256 j = _i;
        uint256 len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint256 k = len;
        while (_i != 0) {
            k = k - 1;
            uint8 temp = (48 + uint8(_i - (_i / 10) * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }
}
