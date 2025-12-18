// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TestnetFaucet
 * @dev Distributes test 8BIT tokens on testnet
 *
 * Features:
 * - 10,000 8BIT per claim
 * - 24-hour cooldown between claims
 * - Only claim if balance < 5,000 8BIT
 * - Prevents abuse with rate limiting
 * - Testnet only (never deploy to mainnet!)
 */
contract TestnetFaucet is Ownable, ReentrancyGuard {
    // ═══════════════════════════════════════════════════════════
    // STORAGE
    // ═══════════════════════════════════════════════════════════

    IERC20 public immutable eightBitToken;

    // Faucet parameters
    uint256 public constant CLAIM_AMOUNT = 10_000 * 10**18; // 10,000 8BIT
    uint256 public constant COOLDOWN_PERIOD = 24 hours;
    uint256 public constant MIN_BALANCE_THRESHOLD = 5_000 * 10**18; // 5,000 8BIT

    // User claim tracking
    mapping(address => uint256) public lastClaimTime;
    mapping(address => uint256) public totalClaimed;

    // Stats
    uint256 public totalDistributed;
    uint256 public totalClaims;
    address[] public claimers;
    mapping(address => bool) private hasClaimed;

    // Emergency controls
    bool public isPaused;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event TokensClaimed(address indexed user, uint256 amount, uint256 timestamp);
    event FaucetFunded(address indexed funder, uint256 amount);
    event FaucetDrained(address indexed recipient, uint256 amount);
    event FaucetPaused(bool paused);

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Constructor
     * @param _tokenAddress 8BIT token contract address
     */
    constructor(address _tokenAddress) {
        require(_tokenAddress != address(0), "Invalid token address");
        eightBitToken = IERC20(_tokenAddress);
    }

    // ═══════════════════════════════════════════════════════════
    // CLAIM FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Claim test tokens from faucet
     */
    function claimTokens() external nonReentrant {
        require(!isPaused, "Faucet is paused");
        require(canClaim(msg.sender), "Cannot claim yet");

        // Check user's current balance
        uint256 userBalance = eightBitToken.balanceOf(msg.sender);
        require(
            userBalance < MIN_BALANCE_THRESHOLD,
            "Balance must be below 5,000 8BIT to claim"
        );

        // Check faucet has enough tokens
        uint256 faucetBalance = eightBitToken.balanceOf(address(this));
        require(
            faucetBalance >= CLAIM_AMOUNT,
            "Faucet is empty, please contact team"
        );

        // Update state
        lastClaimTime[msg.sender] = block.timestamp;
        totalClaimed[msg.sender] += CLAIM_AMOUNT;
        totalDistributed += CLAIM_AMOUNT;
        totalClaims++;

        // Track unique claimers
        if (!hasClaimed[msg.sender]) {
            claimers.push(msg.sender);
            hasClaimed[msg.sender] = true;
        }

        // Transfer tokens
        require(
            eightBitToken.transfer(msg.sender, CLAIM_AMOUNT),
            "Token transfer failed"
        );

        emit TokensClaimed(msg.sender, CLAIM_AMOUNT, block.timestamp);
    }

    // ═══════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Check if user can claim tokens
     */
    function canClaim(address user) public view returns (bool) {
        // First-time claimers can always claim
        if (lastClaimTime[user] == 0) return true;

        // Check cooldown period
        return block.timestamp >= lastClaimTime[user] + COOLDOWN_PERIOD;
    }

    /**
     * @dev Get time until user can claim again
     */
    function getTimeUntilNextClaim(address user) external view returns (uint256) {
        if (canClaim(user)) return 0;

        uint256 nextClaimTime = lastClaimTime[user] + COOLDOWN_PERIOD;
        return nextClaimTime - block.timestamp;
    }

    /**
     * @dev Get user claim info
     */
    function getUserInfo(address user) external view returns (
        uint256 lastClaim,
        uint256 totalUserClaimed,
        bool canUserClaim,
        uint256 userBalance,
        uint256 timeUntilNext
    ) {
        lastClaim = lastClaimTime[user];
        totalUserClaimed = totalClaimed[user];
        canUserClaim = canClaim(user);
        userBalance = eightBitToken.balanceOf(user);

        if (canUserClaim) {
            timeUntilNext = 0;
        } else {
            uint256 nextClaimTime = lastClaimTime[user] + COOLDOWN_PERIOD;
            timeUntilNext = nextClaimTime - block.timestamp;
        }
    }

    /**
     * @dev Get faucet statistics
     */
    function getFaucetStats() external view returns (
        uint256 balance,
        uint256 distributed,
        uint256 claims,
        uint256 uniqueClaimers
    ) {
        balance = eightBitToken.balanceOf(address(this));
        distributed = totalDistributed;
        claims = totalClaims;
        uniqueClaimers = claimers.length;
    }

    /**
     * @dev Get all claimers
     */
    function getClaimers() external view returns (address[] memory) {
        return claimers;
    }

    /**
     * @dev Calculate remaining claims the faucet can serve
     */
    function getRemainingClaims() external view returns (uint256) {
        uint256 balance = eightBitToken.balanceOf(address(this));
        return balance / CLAIM_AMOUNT;
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Fund the faucet with tokens
     */
    function fundFaucet(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0");

        require(
            eightBitToken.transferFrom(msg.sender, address(this), amount),
            "Transfer failed"
        );

        emit FaucetFunded(msg.sender, amount);
    }

    /**
     * @dev Emergency withdrawal (owner only)
     */
    function drainFaucet(address recipient) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");

        uint256 balance = eightBitToken.balanceOf(address(this));
        require(balance > 0, "Faucet is empty");

        require(
            eightBitToken.transfer(recipient, balance),
            "Transfer failed"
        );

        emit FaucetDrained(recipient, balance);
    }

    /**
     * @dev Pause/unpause faucet
     */
    function setPaused(bool paused) external onlyOwner {
        isPaused = paused;
        emit FaucetPaused(paused);
    }

    /**
     * @dev Reset user's claim time (emergency use only)
     */
    function resetUserClaim(address user) external onlyOwner {
        lastClaimTime[user] = 0;
    }

    /**
     * @dev Batch fund faucet (owner can airdrop to contract)
     */
    receive() external payable {
        revert("This faucet only distributes 8BIT tokens, not ETH");
    }
}
