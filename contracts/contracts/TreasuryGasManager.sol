// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title TreasuryGasManager
 * @notice Automated gas funding system for 8-Bit Arcade backend operations
 * @dev Manages ETH treasury and automatically refills payout wallets for gas
 *
 * PURPOSE:
 * - Holds ETH for funding backend operations (daily rewards, tournament payouts)
 * - Automatically refills payout wallet when balance drops below threshold
 * - Prevents manual intervention and missed payouts due to insufficient gas
 *
 * USAGE:
 * 1. Deploy contract and fund with ETH
 * 2. Set payout wallet address and thresholds
 * 3. Call refillGasWallet() before batch operations or let anyone call it
 * 4. Monitor via events and view functions
 */
contract TreasuryGasManager is Ownable, ReentrancyGuard {

    /// @notice Payout wallet that needs gas for transactions
    address public payoutWallet;

    /// @notice Minimum balance threshold (when to refill)
    uint256 public minimumThreshold;

    /// @notice Amount to send when refilling
    uint256 public refillAmount;

    /// @notice Emergency mode - stops all refills
    bool public emergencyStop;

    /// @notice Track total ETH sent for monitoring
    uint256 public totalEthSent;

    /// @notice Track number of refills for statistics
    uint256 public refillCount;

    // Events
    event WalletRefilled(
        address indexed wallet,
        uint256 amount,
        uint256 newBalance,
        uint256 timestamp
    );

    event ThresholdUpdated(
        uint256 oldThreshold,
        uint256 newThreshold
    );

    event RefillAmountUpdated(
        uint256 oldAmount,
        uint256 newAmount
    );

    event PayoutWalletUpdated(
        address indexed oldWallet,
        address indexed newWallet
    );

    event EmergencyStopToggled(bool stopped);

    event TreasuryFunded(
        address indexed funder,
        uint256 amount,
        uint256 newBalance
    );

    event EmergencyWithdrawal(
        address indexed recipient,
        uint256 amount
    );

    /**
     * @dev Constructor
     * @param _payoutWallet Initial payout wallet address
     * @param _minimumThreshold Minimum balance before refill (default: 0.05 ETH)
     * @param _refillAmount Amount to send on refill (default: 0.1 ETH)
     */
    constructor(
        address _payoutWallet,
        uint256 _minimumThreshold,
        uint256 _refillAmount
    ) Ownable(msg.sender) {
        require(_payoutWallet != address(0), "Invalid payout wallet");
        require(_minimumThreshold > 0, "Threshold must be > 0");
        require(_refillAmount > _minimumThreshold, "Refill must be > threshold");

        payoutWallet = _payoutWallet;
        minimumThreshold = _minimumThreshold;
        refillAmount = _refillAmount;
        emergencyStop = false;
    }

    /**
     * @notice Receive ETH deposits
     */
    receive() external payable {
        emit TreasuryFunded(msg.sender, msg.value, address(this).balance);
    }

    /**
     * @notice Check if payout wallet needs refill
     * @return bool True if balance is below threshold
     */
    function needsRefill() public view returns (bool) {
        return payoutWallet.balance < minimumThreshold;
    }

    /**
     * @notice Get current status of payout wallet
     * @return currentBalance Current ETH balance of payout wallet
     * @return needsRefill_ True if refill is needed
     * @return refillAvailable True if treasury has enough ETH to refill
     */
    function getWalletStatus() external view returns (
        uint256 currentBalance,
        bool needsRefill_,
        bool refillAvailable
    ) {
        currentBalance = payoutWallet.balance;
        needsRefill_ = needsRefill();
        refillAvailable = address(this).balance >= refillAmount;
    }

    /**
     * @notice Refill payout wallet if below threshold
     * @dev Can be called by anyone - permissionless for maximum uptime
     * @return refilled True if refill was executed
     */
    function refillGasWallet() external nonReentrant returns (bool refilled) {
        require(!emergencyStop, "Emergency stop active");
        require(payoutWallet != address(0), "Payout wallet not set");

        // Check if refill is needed
        if (!needsRefill()) {
            return false; // No refill needed
        }

        // Check treasury has enough funds
        require(address(this).balance >= refillAmount, "Insufficient treasury balance");

        // Send ETH to payout wallet
        (bool success, ) = payoutWallet.call{value: refillAmount}("");
        require(success, "ETH transfer failed");

        // Update statistics
        totalEthSent += refillAmount;
        refillCount++;

        emit WalletRefilled(
            payoutWallet,
            refillAmount,
            payoutWallet.balance,
            block.timestamp
        );

        return true;
    }

    /**
     * @notice Check and refill if needed (convenience function)
     * @dev Useful for backend to call before batch operations
     * @return refilled True if refill was executed
     */
    function ensureFunding() external nonReentrant returns (bool refilled) {
        if (emergencyStop || !needsRefill()) {
            return false;
        }

        if (address(this).balance < refillAmount) {
            return false;
        }

        (bool success, ) = payoutWallet.call{value: refillAmount}("");
        if (!success) {
            return false;
        }

        totalEthSent += refillAmount;
        refillCount++;

        emit WalletRefilled(
            payoutWallet,
            refillAmount,
            payoutWallet.balance,
            block.timestamp
        );

        return true;
    }

    /**
     * @notice Update payout wallet address
     * @param _newWallet New payout wallet address
     */
    function setPayoutWallet(address _newWallet) external onlyOwner {
        require(_newWallet != address(0), "Invalid wallet address");
        address oldWallet = payoutWallet;
        payoutWallet = _newWallet;
        emit PayoutWalletUpdated(oldWallet, _newWallet);
    }

    /**
     * @notice Update minimum threshold
     * @param _newThreshold New threshold in wei (e.g., 0.05 ETH = 50000000000000000)
     */
    function setMinimumThreshold(uint256 _newThreshold) external onlyOwner {
        require(_newThreshold > 0, "Threshold must be > 0");
        require(_newThreshold < refillAmount, "Threshold must be < refill amount");
        uint256 oldThreshold = minimumThreshold;
        minimumThreshold = _newThreshold;
        emit ThresholdUpdated(oldThreshold, _newThreshold);
    }

    /**
     * @notice Update refill amount
     * @param _newAmount New refill amount in wei (e.g., 0.1 ETH = 100000000000000000)
     */
    function setRefillAmount(uint256 _newAmount) external onlyOwner {
        require(_newAmount > minimumThreshold, "Refill must be > threshold");
        uint256 oldAmount = refillAmount;
        refillAmount = _newAmount;
        emit RefillAmountUpdated(oldAmount, _newAmount);
    }

    /**
     * @notice Toggle emergency stop
     * @dev Stops all refills in case of issues
     */
    function toggleEmergencyStop() external onlyOwner {
        emergencyStop = !emergencyStop;
        emit EmergencyStopToggled(emergencyStop);
    }

    /**
     * @notice Fund treasury with ETH
     * @dev Owner can send ETH to contract
     */
    function fundTreasury() external payable onlyOwner {
        require(msg.value > 0, "Must send ETH");
        emit TreasuryFunded(msg.sender, msg.value, address(this).balance);
    }

    /**
     * @notice Emergency withdrawal (owner only)
     * @dev Use only in emergencies or contract migration
     * @param recipient Address to receive funds
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address payable recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(amount <= address(this).balance, "Insufficient balance");

        (bool success, ) = recipient.call{value: amount}("");
        require(success, "Withdrawal failed");

        emit EmergencyWithdrawal(recipient, amount);
    }

    /**
     * @notice Get contract statistics
     * @return treasuryBalance Current ETH balance in treasury
     * @return payoutBalance Current ETH balance of payout wallet
     * @return totalSent Total ETH sent to payout wallet
     * @return refills Number of refills executed
     */
    function getStatistics() external view returns (
        uint256 treasuryBalance,
        uint256 payoutBalance,
        uint256 totalSent,
        uint256 refills
    ) {
        return (
            address(this).balance,
            payoutWallet.balance,
            totalEthSent,
            refillCount
        );
    }

    /**
     * @notice Estimate how many refills are possible with current balance
     * @return Number of refills possible
     */
    function getRefillsRemaining() external view returns (uint256) {
        if (refillAmount == 0) return 0;
        return address(this).balance / refillAmount;
    }

    /**
     * @notice Calculate estimated days until treasury runs out
     * @param refillsPerDay Average refills per day (e.g., 1 for daily rewards)
     * @return Estimated days remaining
     */
    function getEstimatedDaysRemaining(uint256 refillsPerDay) external view returns (uint256) {
        if (refillsPerDay == 0 || refillAmount == 0) return 0;
        uint256 totalRefills = address(this).balance / refillAmount;
        return totalRefills / refillsPerDay;
    }
}
