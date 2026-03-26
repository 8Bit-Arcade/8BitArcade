// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title PvPEscrow
 * @dev Handles token escrow for head-to-head PvP matches in 8-Bit Arcade
 *
 * Flow:
 * 1. Creator locks betAmount tokens when creating a match
 * 2. Challenger locks betAmount tokens when joining
 * 3. Backend resolver calls resolveMatch() after match completes
 * 4. Winner receives 95% of pot; 2.5% burned; 2.5% to tournament prize pool
 * 5. Unchallenged matches can be cancelled after CANCEL_TIMEOUT for full refund
 *
 * FREE matches (betAmount == 0) bypass the contract entirely — handled off-chain.
 */
contract PvPEscrow is Ownable, ReentrancyGuard {

    IERC20 public immutable eightBitToken;
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;
    address public tournamentPool;
    address public resolver;

    uint256 public constant WINNER_BPS    = 9500; // 95.00%
    uint256 public constant BURN_BPS      =  250; //  2.50%
    uint256 public constant POOL_BPS      =  250; //  2.50%
    uint256 public constant CANCEL_TIMEOUT = 1 hours;

    enum MatchStatus { Open, Active, Completed, Cancelled }

    struct Match {
        address creator;
        address challenger;
        uint256 betAmount;
        uint256 createdAt;
        MatchStatus status;
        address winner;
    }

    // matchId (bytes32 derived from off-chain UUID) => Match
    mapping(bytes32 => Match) public matches;

    // ─── Events ───────────────────────────────────────────────
    event MatchCreated(bytes32 indexed matchId, address indexed creator, uint256 betAmount);
    event MatchJoined(bytes32 indexed matchId, address indexed challenger);
    event MatchResolved(bytes32 indexed matchId, address indexed winner, uint256 payout, uint256 burned, uint256 pooled);
    event MatchCancelled(bytes32 indexed matchId, address indexed cancelledBy, bool challengerRefunded);
    event ResolverUpdated(address indexed oldResolver, address indexed newResolver);
    event TournamentPoolUpdated(address indexed oldPool, address indexed newPool);

    // ─── Modifiers ────────────────────────────────────────────
    modifier onlyResolver() {
        require(msg.sender == resolver || msg.sender == owner(), "PvPEscrow: not authorized");
        _;
    }

    // ─── Constructor ──────────────────────────────────────────
    constructor(
        address _token,
        address _tournamentPool,
        address _resolver
    ) Ownable(msg.sender) {
        require(_token != address(0), "PvPEscrow: zero token address");
        require(_tournamentPool != address(0), "PvPEscrow: zero pool address");
        require(_resolver != address(0), "PvPEscrow: zero resolver address");
        eightBitToken = IERC20(_token);
        tournamentPool = _tournamentPool;
        resolver = _resolver;
    }

    // ─── Player Actions ───────────────────────────────────────

    /**
     * @notice Creator locks their bet to open a match.
     * @dev Caller must have approved this contract for at least betAmount.
     *      MUST hold at least betAmount before calling.
     */
    function createMatch(bytes32 matchId, uint256 betAmount) external nonReentrant {
        require(matches[matchId].creator == address(0), "PvPEscrow: match already exists");
        require(betAmount > 0, "PvPEscrow: bet must be > 0 (use off-chain for free matches)");
        require(
            eightBitToken.balanceOf(msg.sender) >= betAmount,
            "PvPEscrow: insufficient 8BIT balance"
        );
        require(
            eightBitToken.allowance(msg.sender, address(this)) >= betAmount,
            "PvPEscrow: insufficient allowance, call approve() first"
        );

        eightBitToken.transferFrom(msg.sender, address(this), betAmount);

        matches[matchId] = Match({
            creator:    msg.sender,
            challenger: address(0),
            betAmount:  betAmount,
            createdAt:  block.timestamp,
            status:     MatchStatus.Open,
            winner:     address(0)
        });

        emit MatchCreated(matchId, msg.sender, betAmount);
    }

    /**
     * @notice Challenger joins an open match by locking the same bet.
     * @dev Caller MUST hold at least betAmount and have approved this contract.
     */
    function joinMatch(bytes32 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.creator != address(0),        "PvPEscrow: match not found");
        require(m.status == MatchStatus.Open,    "PvPEscrow: match not open");
        require(m.challenger == address(0),      "PvPEscrow: match already has challenger");
        require(msg.sender != m.creator,         "PvPEscrow: cannot join own match");
        require(
            eightBitToken.balanceOf(msg.sender) >= m.betAmount,
            "PvPEscrow: insufficient 8BIT balance"
        );
        require(
            eightBitToken.allowance(msg.sender, address(this)) >= m.betAmount,
            "PvPEscrow: insufficient allowance, call approve() first"
        );

        eightBitToken.transferFrom(msg.sender, address(this), m.betAmount);

        m.challenger = msg.sender;
        m.status     = MatchStatus.Active;

        emit MatchJoined(matchId, msg.sender);
    }

    /**
     * @notice Creator cancels their open (unchallened) match, recovering full bet.
     *         Anyone can cancel after CANCEL_TIMEOUT has elapsed.
     */
    function cancelMatch(bytes32 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.Open, "PvPEscrow: match not open");
        require(
            msg.sender == m.creator ||
            msg.sender == owner() ||
            block.timestamp >= m.createdAt + CANCEL_TIMEOUT,
            "PvPEscrow: cannot cancel yet"
        );

        m.status = MatchStatus.Cancelled;
        eightBitToken.transfer(m.creator, m.betAmount);

        emit MatchCancelled(matchId, msg.sender, false);
    }

    // ─── Resolver Actions ─────────────────────────────────────

    /**
     * @notice Called by the backend once both players have submitted verified scores.
     * @param winner Must be either the creator or challenger address.
     */
    function resolveMatch(bytes32 matchId, address winner) external onlyResolver nonReentrant {
        Match storage m = matches[matchId];
        require(m.status == MatchStatus.Active, "PvPEscrow: match not active");
        require(
            winner == m.creator || winner == m.challenger,
            "PvPEscrow: winner must be a participant"
        );

        m.status = MatchStatus.Completed;
        m.winner = winner;

        uint256 totalPot     = m.betAmount * 2;
        uint256 burnAmount   = (totalPot * BURN_BPS) / 10_000;
        uint256 poolAmount   = (totalPot * POOL_BPS) / 10_000;
        uint256 winnerPayout = totalPot - burnAmount - poolAmount;

        eightBitToken.transfer(BURN_ADDRESS,    burnAmount);
        eightBitToken.transfer(tournamentPool,  poolAmount);
        eightBitToken.transfer(winner,          winnerPayout);

        emit MatchResolved(matchId, winner, winnerPayout, burnAmount, poolAmount);
    }

    // ─── Owner / Admin ────────────────────────────────────────

    /**
     * @notice Force-cancel a stuck match (open or active) and refund both parties.
     *         Only callable by owner.
     */
    function forceCancel(bytes32 matchId) external onlyOwner nonReentrant {
        Match storage m = matches[matchId];
        require(
            m.status == MatchStatus.Open || m.status == MatchStatus.Active,
            "PvPEscrow: match not cancellable"
        );

        bool challengerRefunded = m.challenger != address(0);
        m.status = MatchStatus.Cancelled;

        eightBitToken.transfer(m.creator, m.betAmount);
        if (challengerRefunded) {
            eightBitToken.transfer(m.challenger, m.betAmount);
        }

        emit MatchCancelled(matchId, msg.sender, challengerRefunded);
    }

    function setResolver(address _resolver) external onlyOwner {
        require(_resolver != address(0), "PvPEscrow: zero address");
        emit ResolverUpdated(resolver, _resolver);
        resolver = _resolver;
    }

    function setTournamentPool(address _pool) external onlyOwner {
        require(_pool != address(0), "PvPEscrow: zero address");
        emit TournamentPoolUpdated(tournamentPool, _pool);
        tournamentPool = _pool;
    }

    // ─── Views ────────────────────────────────────────────────

    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    function isMatchOpen(bytes32 matchId) external view returns (bool) {
        return matches[matchId].status == MatchStatus.Open;
    }

    function isMatchActive(bytes32 matchId) external view returns (bool) {
        return matches[matchId].status == MatchStatus.Active;
    }
}
