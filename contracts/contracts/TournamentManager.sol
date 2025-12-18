// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TournamentManager
 * @dev Manages two-tier tournament system for 8-Bit Arcade
 *
 * Features:
 * - Standard Tier: $1/$5 entry (weekly/monthly)
 * - High Roller Tier: $5/$25 entry (weekly/monthly)
 * - Both tiers run simultaneously
 * - 50% of entry fees burned
 * - Automated prize distribution to winners
 * - Time-based tournament periods
 */
contract TournamentManager is Ownable, ReentrancyGuard {
    IERC20 public immutable eightBitToken;

    // Tournament tiers
    enum Tier { STANDARD, HIGH_ROLLER }

    // Tournament periods
    enum Period { WEEKLY, MONTHLY }

    // Tournament entry fees (in 8BIT tokens with 18 decimals)
    uint256 public constant STANDARD_WEEKLY_FEE = 2_000 * 10**18;      // $1
    uint256 public constant STANDARD_MONTHLY_FEE = 10_000 * 10**18;    // $5
    uint256 public constant HIGH_ROLLER_WEEKLY_FEE = 10_000 * 10**18;  // $5
    uint256 public constant HIGH_ROLLER_MONTHLY_FEE = 50_000 * 10**18; // $25

    // Prize pools (fixed amounts)
    uint256 public constant STANDARD_WEEKLY_PRIZE = 50_000 * 10**18;      // $25
    uint256 public constant STANDARD_MONTHLY_PRIZE = 100_000 * 10**18;    // $50
    uint256 public constant HIGH_ROLLER_WEEKLY_PRIZE = 150_000 * 10**18;  // $75
    uint256 public constant HIGH_ROLLER_MONTHLY_PRIZE = 500_000 * 10**18; // $250

    // Burn address
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Tournament data structure
    struct Tournament {
        uint256 tournamentId;
        Tier tier;
        Period period;
        uint256 startTime;
        uint256 endTime;
        uint256 entryFee;
        uint256 prizePool;
        uint256 totalEntries;
        uint256 totalFeesCollected;
        address[] participants;
        address winner;
        bool isActive;
        bool isPaid;
    }

    // Storage
    mapping(uint256 => Tournament) public tournaments;
    mapping(uint256 => mapping(address => bool)) public hasEntered; // tournamentId => player => entered
    mapping(uint256 => mapping(address => uint256)) public playerScores; // tournamentId => player => score

    uint256 public nextTournamentId = 1;

    // Tournament manager (can create tournaments and set winners)
    address public tournamentManager;

    // Events
    event TournamentCreated(
        uint256 indexed tournamentId,
        Tier tier,
        Period period,
        uint256 startTime,
        uint256 endTime,
        uint256 entryFee,
        uint256 prizePool
    );

    event PlayerEntered(
        uint256 indexed tournamentId,
        address indexed player,
        uint256 entryFee
    );

    event WinnerDeclared(
        uint256 indexed tournamentId,
        address indexed winner,
        uint256 prizeAmount
    );

    event FeeBurned(
        uint256 indexed tournamentId,
        uint256 amount
    );

    event TournamentManagerSet(address indexed newManager);

    /**
     * @dev Constructor
     * @param _tokenAddress Address of the 8BIT token contract
     */
    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "Invalid token address");
        eightBitToken = IERC20(_tokenAddress);
        tournamentManager = msg.sender;
    }

    /**
     * @dev Set tournament manager address
     */
    function setTournamentManager(address _manager) external onlyOwner {
        require(_manager != address(0), "Invalid manager address");
        tournamentManager = _manager;
        emit TournamentManagerSet(_manager);
    }

    /**
     * @dev Create a new tournament
     * @param tier Tournament tier (STANDARD or HIGH_ROLLER)
     * @param period Tournament period (WEEKLY or MONTHLY)
     * @param startTime Tournament start timestamp
     * @param endTime Tournament end timestamp
     */
    function createTournament(
        Tier tier,
        Period period,
        uint256 startTime,
        uint256 endTime
    ) external onlyOwner returns (uint256) {
        require(startTime >= block.timestamp, "Start time must be in future");
        require(endTime > startTime, "End time must be after start");

        uint256 entryFee;
        uint256 prizePool;

        // Set entry fee and prize pool based on tier and period
        if (tier == Tier.STANDARD) {
            if (period == Period.WEEKLY) {
                entryFee = STANDARD_WEEKLY_FEE;
                prizePool = STANDARD_WEEKLY_PRIZE;
            } else {
                entryFee = STANDARD_MONTHLY_FEE;
                prizePool = STANDARD_MONTHLY_PRIZE;
            }
        } else {
            if (period == Period.WEEKLY) {
                entryFee = HIGH_ROLLER_WEEKLY_FEE;
                prizePool = HIGH_ROLLER_WEEKLY_PRIZE;
            } else {
                entryFee = HIGH_ROLLER_MONTHLY_FEE;
                prizePool = HIGH_ROLLER_MONTHLY_PRIZE;
            }
        }

        uint256 tournamentId = nextTournamentId++;

        Tournament storage t = tournaments[tournamentId];
        t.tournamentId = tournamentId;
        t.tier = tier;
        t.period = period;
        t.startTime = startTime;
        t.endTime = endTime;
        t.entryFee = entryFee;
        t.prizePool = prizePool;
        t.isActive = true;
        t.isPaid = false;

        emit TournamentCreated(
            tournamentId,
            tier,
            period,
            startTime,
            endTime,
            entryFee,
            prizePool
        );

        return tournamentId;
    }

    /**
     * @dev Enter a tournament
     * @param tournamentId ID of the tournament to enter
     */
    function enterTournament(uint256 tournamentId) external nonReentrant {
        Tournament storage t = tournaments[tournamentId];

        require(t.isActive, "Tournament is not active");
        require(block.timestamp >= t.startTime, "Tournament has not started");
        require(block.timestamp < t.endTime, "Tournament has ended");
        require(!hasEntered[tournamentId][msg.sender], "Already entered");

        // Transfer entry fee from player
        require(
            eightBitToken.transferFrom(msg.sender, address(this), t.entryFee),
            "Entry fee transfer failed"
        );

        // Mark player as entered
        hasEntered[tournamentId][msg.sender] = true;
        t.participants.push(msg.sender);
        t.totalEntries++;
        t.totalFeesCollected += t.entryFee;

        // Burn 50% of entry fee
        uint256 burnAmount = t.entryFee / 2;
        require(
            eightBitToken.transfer(BURN_ADDRESS, burnAmount),
            "Burn transfer failed"
        );

        emit PlayerEntered(tournamentId, msg.sender, t.entryFee);
        emit FeeBurned(tournamentId, burnAmount);
    }

    /**
     * @dev Submit player score (called by backend)
     * @param tournamentId Tournament ID
     * @param player Player address
     * @param score Player's score
     */
    function submitScore(
        uint256 tournamentId,
        address player,
        uint256 score
    ) external {
        require(msg.sender == tournamentManager, "Only tournament manager");
        require(hasEntered[tournamentId][player], "Player not entered");
        require(block.timestamp < tournaments[tournamentId].endTime, "Tournament ended");

        // Only update if new score is higher
        if (score > playerScores[tournamentId][player]) {
            playerScores[tournamentId][player] = score;
        }
    }

    /**
     * @dev Declare winner and distribute prize
     * @param tournamentId Tournament ID
     * @param winner Winner's address
     */
    function declareWinner(
        uint256 tournamentId,
        address winner
    ) external nonReentrant {
        require(msg.sender == tournamentManager, "Only tournament manager");

        Tournament storage t = tournaments[tournamentId];

        require(t.isActive, "Tournament is not active");
        require(block.timestamp >= t.endTime, "Tournament has not ended");
        require(!t.isPaid, "Prize already paid");
        require(hasEntered[tournamentId][winner], "Winner did not enter");

        t.winner = winner;
        t.isActive = false;
        t.isPaid = true;

        // Transfer prize to winner
        require(
            eightBitToken.transfer(winner, t.prizePool),
            "Prize transfer failed"
        );

        emit WinnerDeclared(tournamentId, winner, t.prizePool);
    }

    /**
     * @dev Get tournament details
     */
    function getTournament(uint256 tournamentId) external view returns (
        Tier tier,
        Period period,
        uint256 startTime,
        uint256 endTime,
        uint256 entryFee,
        uint256 prizePool,
        uint256 totalEntries,
        address winner,
        bool isActive
    ) {
        Tournament storage t = tournaments[tournamentId];
        return (
            t.tier,
            t.period,
            t.startTime,
            t.endTime,
            t.entryFee,
            t.prizePool,
            t.totalEntries,
            t.winner,
            t.isActive
        );
    }

    /**
     * @dev Get all participants for a tournament
     */
    function getParticipants(uint256 tournamentId) external view returns (address[] memory) {
        return tournaments[tournamentId].participants;
    }

    /**
     * @dev Check if player has entered tournament
     */
    function hasPlayerEntered(uint256 tournamentId, address player) external view returns (bool) {
        return hasEntered[tournamentId][player];
    }

    /**
     * @dev Get player score for tournament
     */
    function getPlayerScore(uint256 tournamentId, address player) external view returns (uint256) {
        return playerScores[tournamentId][player];
    }

    /**
     * @dev Emergency withdrawal (only owner)
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = eightBitToken.balanceOf(address(this));
        require(eightBitToken.transfer(owner(), balance), "Withdrawal failed");
    }

    /**
     * @dev Cancel tournament (only before it starts)
     */
    function cancelTournament(uint256 tournamentId) external onlyOwner {
        Tournament storage t = tournaments[tournamentId];
        require(block.timestamp < t.startTime, "Tournament already started");
        require(t.totalEntries == 0, "Cannot cancel with entries");

        t.isActive = false;
    }

    /**
     * @dev Get active tournaments count
     */
    function getActiveTournamentsCount() external view returns (uint256) {
        uint256 count = 0;
        for (uint256 i = 1; i < nextTournamentId; i++) {
            if (tournaments[i].isActive && block.timestamp < tournaments[i].endTime) {
                count++;
            }
        }
        return count;
    }
}
