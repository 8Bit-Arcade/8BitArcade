// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VestedAirdrop
 * @notice Merkle-based airdrop with 3-month vesting schedule for 8-Bit Arcade testnet rewards
 * @dev Uses Merkle proofs for gas-efficient claims. Tokens vest over 3 months:
 *      - Month 0 (claim): 33.33% immediately
 *      - Month 1: Additional 33.33%
 *      - Month 2: Final 33.34%
 *
 * The 90-day claim window ensures unclaimed tokens can be recovered for future use.
 */
contract VestedAirdrop is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // CONSTANTS
    // ============================================

    /// @notice Vesting period duration (30 days per period)
    uint256 public constant VESTING_PERIOD = 30 days;

    /// @notice Number of vesting periods (3 months)
    uint256 public constant TOTAL_VESTING_PERIODS = 3;

    /// @notice Claim window duration (90 days)
    uint256 public constant CLAIM_WINDOW = 90 days;

    // ============================================
    // STATE VARIABLES
    // ============================================

    /// @notice The 8BIT token being distributed
    IERC20 public immutable token;

    /// @notice Merkle root for verifying claims
    bytes32 public merkleRoot;

    /// @notice Timestamp when the airdrop was deployed
    uint256 public immutable deployedAt;

    /// @notice Timestamp when claims expire
    uint256 public immutable claimDeadline;

    /// @notice Treasury address for unclaimed token recovery
    address public treasury;

    /// @notice Total tokens allocated for this airdrop
    uint256 public totalAllocated;

    /// @notice Total tokens claimed so far
    uint256 public totalClaimed;

    /// @notice Whether the airdrop is active
    bool public isActive;

    // ============================================
    // VESTING TRACKING
    // ============================================

    struct VestingInfo {
        uint256 totalAmount;      // Total tokens allocated to this user
        uint256 claimed;          // Total tokens claimed so far
        uint256 vestingStart;     // Timestamp when vesting started (first claim)
        bool initiated;           // Whether the user has initiated their claim
    }

    /// @notice Vesting info per user
    mapping(address => VestingInfo) public vesting;

    // ============================================
    // EVENTS
    // ============================================

    event ClaimInitiated(address indexed user, uint256 totalAmount, uint256 initialRelease);
    event VestedClaimed(address indexed user, uint256 amount);
    event MerkleRootUpdated(bytes32 oldRoot, bytes32 newRoot);
    event AirdropActivated(uint256 totalTokens);
    event AirdropDeactivated();
    event UnclaimedRecovered(uint256 amount);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    // ============================================
    // ERRORS
    // ============================================

    error AirdropNotActive();
    error ClaimPeriodEnded();
    error ClaimPeriodNotEnded();
    error AlreadyInitiated();
    error NotInitiated();
    error InvalidProof();
    error NothingToClaim();
    error InvalidMerkleRoot();
    error InvalidTreasury();

    // ============================================
    // CONSTRUCTOR
    // ============================================

    /**
     * @notice Deploy the vested airdrop contract
     * @param _token The 8BIT token address
     * @param _merkleRoot Merkle root for claim verification
     * @param _treasury Address to receive unclaimed tokens
     */
    constructor(
        address _token,
        bytes32 _merkleRoot,
        address _treasury
    ) Ownable(msg.sender) {
        if (_token == address(0)) revert InvalidTreasury();
        if (_treasury == address(0)) revert InvalidTreasury();
        if (_merkleRoot == bytes32(0)) revert InvalidMerkleRoot();

        token = IERC20(_token);
        merkleRoot = _merkleRoot;
        treasury = _treasury;
        deployedAt = block.timestamp;
        claimDeadline = block.timestamp + CLAIM_WINDOW;
        isActive = false; // Must be activated after funding

        emit MerkleRootUpdated(bytes32(0), _merkleRoot);
    }

    // ============================================
    // ADMIN FUNCTIONS
    // ============================================

    /**
     * @notice Activate the airdrop after funding
     * @dev Only callable by owner. Verifies contract has tokens.
     */
    function activate() external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert NothingToClaim();

        totalAllocated = balance;
        isActive = true;

        emit AirdropActivated(balance);
    }

    /**
     * @notice Deactivate the airdrop in case of emergency
     * @dev Only callable by owner
     */
    function deactivate() external onlyOwner {
        isActive = false;
        emit AirdropDeactivated();
    }

    /**
     * @notice Update the merkle root (before activation only)
     * @param _newRoot New merkle root
     */
    function updateMerkleRoot(bytes32 _newRoot) external onlyOwner {
        if (isActive) revert AirdropNotActive();
        if (_newRoot == bytes32(0)) revert InvalidMerkleRoot();

        bytes32 oldRoot = merkleRoot;
        merkleRoot = _newRoot;

        emit MerkleRootUpdated(oldRoot, _newRoot);
    }

    /**
     * @notice Update treasury address
     * @param _newTreasury New treasury address
     */
    function setTreasury(address _newTreasury) external onlyOwner {
        if (_newTreasury == address(0)) revert InvalidTreasury();

        address oldTreasury = treasury;
        treasury = _newTreasury;

        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }

    /**
     * @notice Recover unclaimed tokens after claim period ends
     * @dev Can only be called after claim deadline
     */
    function recoverUnclaimed() external onlyOwner {
        if (block.timestamp <= claimDeadline) revert ClaimPeriodNotEnded();

        uint256 balance = token.balanceOf(address(this));
        if (balance == 0) revert NothingToClaim();

        token.safeTransfer(treasury, balance);

        emit UnclaimedRecovered(balance);
    }

    // ============================================
    // CLAIM FUNCTIONS
    // ============================================

    /**
     * @notice Initiate claim - verify merkle proof and start vesting
     * @dev First 33.33% is released immediately
     * @param amount Total allocation amount
     * @param proof Merkle proof for verification
     */
    function initiateClaim(uint256 amount, bytes32[] calldata proof) external nonReentrant {
        if (!isActive) revert AirdropNotActive();
        if (block.timestamp > claimDeadline) revert ClaimPeriodEnded();
        if (vesting[msg.sender].initiated) revert AlreadyInitiated();

        // Verify merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        if (!MerkleProof.verify(proof, merkleRoot, leaf)) revert InvalidProof();

        // Calculate initial release (33.33%)
        uint256 initialRelease = amount / 3;

        // Set up vesting
        vesting[msg.sender] = VestingInfo({
            totalAmount: amount,
            claimed: initialRelease,
            vestingStart: block.timestamp,
            initiated: true
        });

        // Transfer initial release
        token.safeTransfer(msg.sender, initialRelease);
        totalClaimed += initialRelease;

        emit ClaimInitiated(msg.sender, amount, initialRelease);
    }

    /**
     * @notice Claim vested tokens (months 2 & 3)
     * @dev Calculates vested amount based on time since claim initiation
     */
    function claimVested() external nonReentrant {
        VestingInfo storage info = vesting[msg.sender];
        if (!info.initiated) revert NotInitiated();

        uint256 vested = calculateVested(msg.sender);
        uint256 claimable = vested - info.claimed;

        if (claimable == 0) revert NothingToClaim();

        info.claimed = vested;
        token.safeTransfer(msg.sender, claimable);
        totalClaimed += claimable;

        emit VestedClaimed(msg.sender, claimable);
    }

    // ============================================
    // VIEW FUNCTIONS
    // ============================================

    /**
     * @notice Calculate total vested amount for a user
     * @param user User address
     * @return Total vested amount (not claimed amount)
     */
    function calculateVested(address user) public view returns (uint256) {
        VestingInfo memory info = vesting[user];
        if (!info.initiated) return 0;

        uint256 elapsed = block.timestamp - info.vestingStart;
        uint256 periodsElapsed = elapsed / VESTING_PERIOD;

        // Cap at 3 periods (100% vested)
        if (periodsElapsed >= TOTAL_VESTING_PERIODS) {
            return info.totalAmount;
        }

        // Each period = 33.33% (with period 3 getting 33.34%)
        uint256 vested;
        if (periodsElapsed == 0) {
            vested = info.totalAmount / 3; // 33.33%
        } else if (periodsElapsed == 1) {
            vested = (info.totalAmount * 2) / 3; // 66.66%
        } else {
            vested = info.totalAmount; // 100%
        }

        return vested;
    }

    /**
     * @notice Get claimable amount for a user
     * @param user User address
     * @return Claimable amount right now
     */
    function getClaimable(address user) external view returns (uint256) {
        VestingInfo memory info = vesting[user];
        if (!info.initiated) return 0;

        uint256 vested = calculateVested(user);
        return vested > info.claimed ? vested - info.claimed : 0;
    }

    /**
     * @notice Get full vesting info for a user
     * @param user User address
     * @return Total allocation
     * @return Claimed so far
     * @return Vested so far
     * @return Claimable now
     * @return Next unlock timestamp (0 if fully vested)
     * @return Next unlock amount
     */
    function getVestingInfo(address user) external view returns (
        uint256, // totalAmount
        uint256, // claimed
        uint256, // vested
        uint256, // claimable
        uint256, // nextUnlockTimestamp
        uint256  // nextUnlockAmount
    ) {
        VestingInfo memory info = vesting[user];

        if (!info.initiated) {
            return (0, 0, 0, 0, 0, 0);
        }

        uint256 vested = calculateVested(user);
        uint256 claimable = vested > info.claimed ? vested - info.claimed : 0;

        // Calculate next unlock
        uint256 elapsed = block.timestamp - info.vestingStart;
        uint256 periodsElapsed = elapsed / VESTING_PERIOD;
        uint256 nextUnlockTimestamp = 0;
        uint256 nextUnlockAmount = 0;

        if (periodsElapsed < TOTAL_VESTING_PERIODS) {
            nextUnlockTimestamp = info.vestingStart + ((periodsElapsed + 1) * VESTING_PERIOD);

            // Calculate next period's amount
            if (periodsElapsed == 0) {
                nextUnlockAmount = info.totalAmount / 3;
            } else if (periodsElapsed == 1) {
                nextUnlockAmount = info.totalAmount - (info.totalAmount * 2) / 3;
            }
        }

        return (
            info.totalAmount,
            info.claimed,
            vested,
            claimable,
            nextUnlockTimestamp,
            nextUnlockAmount
        );
    }

    /**
     * @notice Check if a user can claim (has valid allocation)
     * @param user User address
     * @param amount Allocation amount
     * @param proof Merkle proof
     * @return Whether the proof is valid
     */
    function canClaim(address user, uint256 amount, bytes32[] calldata proof) external view returns (bool) {
        if (vesting[user].initiated) return false;
        if (!isActive) return false;
        if (block.timestamp > claimDeadline) return false;

        bytes32 leaf = keccak256(abi.encodePacked(user, amount));
        return MerkleProof.verify(proof, merkleRoot, leaf);
    }

    /**
     * @notice Get airdrop stats
     * @return Total allocated tokens
     * @return Total claimed tokens
     * @return Remaining tokens
     * @return Active status
     * @return Claim deadline
     * @return Time remaining until deadline
     */
    function getStats() external view returns (
        uint256, // totalAllocated
        uint256, // totalClaimed
        uint256, // remaining
        bool,    // isActive
        uint256, // claimDeadline
        uint256  // timeRemaining
    ) {
        uint256 remaining = token.balanceOf(address(this));
        uint256 timeRemaining = block.timestamp < claimDeadline
            ? claimDeadline - block.timestamp
            : 0;

        return (
            totalAllocated,
            totalClaimed,
            remaining,
            isActive,
            claimDeadline,
            timeRemaining
        );
    }

    // ============================================
    // DEBUG FUNCTIONS (testnet only - remove for mainnet)
    // ============================================

    /**
     * @notice DEBUG: Get leaf hash for a claim (helps verify off-chain proof generation)
     * @param user User address
     * @param amount Allocation amount
     * @return Leaf hash
     */
    function getLeafHash(address user, uint256 amount) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(user, amount));
    }

    /**
     * @notice DEBUG: Verify a proof without claiming
     * @param user User address
     * @param amount Allocation amount
     * @param proof Merkle proof
     * @return valid Whether the proof is valid
     * @return computedLeaf The computed leaf hash
     * @return storedRoot The stored merkle root
     */
    function debugVerifyProof(address user, uint256 amount, bytes32[] calldata proof) external view returns (
        bool valid,
        bytes32 computedLeaf,
        bytes32 storedRoot
    ) {
        bytes32 leaf = keccak256(abi.encodePacked(user, amount));
        bool isValid = MerkleProof.verify(proof, merkleRoot, leaf);

        return (isValid, leaf, merkleRoot);
    }

    /**
     * @notice DEBUG: Manually set vesting start for testing
     * @dev Remove this function before mainnet deployment!
     * @param user User address
     * @param daysAgo How many days ago to set vesting start
     */
    function debugSetVestingStart(address user, uint256 daysAgo) external onlyOwner {
        VestingInfo storage info = vesting[user];
        if (info.initiated) {
            info.vestingStart = block.timestamp - (daysAgo * 1 days);
        }
    }
}
