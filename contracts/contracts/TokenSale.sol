// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title TokenSale
 * @dev Public token sale contract for 8BIT token
 *
 * Sale Parameters:
 * - Amount: 10% of supply (100M tokens)
 * - Price: $0.0005 per token
 * - Goal: $50,000 USD
 * - Duration: 4 weeks
 * - Payments: ETH + USDC
 * - Access: Fully public, no KYC
 * - Vesting: None (immediate unlock)
 * - Unsold: Burned at sale end
 */
contract TokenSale is Ownable, ReentrancyGuard, Pausable {
    // ═══════════════════════════════════════════════════════════
    // STORAGE
    // ═══════════════════════════════════════════════════════════

    IERC20 public immutable eightBitToken;
    IERC20 public immutable usdcToken;

    // Sale parameters
    uint256 public constant TOKENS_FOR_SALE = 100_000_000 * 10**18; // 100M tokens
    uint256 public constant TOKEN_PRICE_USD = 500; // $0.0005 (in millionths)
    uint256 public constant SALE_DURATION = 4 weeks;
    uint256 public constant SOFT_CAP_USD = 50_000 * 10**6; // $50K in USDC decimals (6)

    // Pricing (can be updated by owner for market changes)
    uint256 public tokensPerEth = 10_000 * 10**18; // Default: 1 ETH = 10,000 8BIT ($5000 ETH price)
    uint256 public tokensPerUsdc = 2000 * 10**18;  // 1 USDC = 2000 8BIT ($0.0005 per token)

    // Sale state
    uint256 public saleStartTime;
    uint256 public saleEndTime;
    uint256 public tokensSold;
    uint256 public ethRaised;
    uint256 public usdcRaised;
    bool public saleFinalized;

    // Burn address
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Purchase tracking
    mapping(address => uint256) public purchasedTokens;
    mapping(address => uint256) public spentEth;
    mapping(address => uint256) public spentUsdc;

    address[] public buyers;
    mapping(address => bool) private isBuyer;

    // Limits (optional, can be set by owner)
    uint256 public minPurchaseUsdc = 10 * 10**6; // $10 minimum
    uint256 public maxPurchasePerWallet = 10_000_000 * 10**18; // 10M tokens max per wallet

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event TokensPurchased(
        address indexed buyer,
        uint256 amount,
        uint256 ethSpent,
        uint256 usdcSpent
    );

    event PriceUpdated(
        uint256 newTokensPerEth,
        uint256 newTokensPerUsdc
    );

    event SaleFinalized(
        uint256 tokensSold,
        uint256 tokensBurned,
        uint256 ethRaised,
        uint256 usdcRaised
    );

    event FundsWithdrawn(
        address indexed recipient,
        uint256 ethAmount,
        uint256 usdcAmount
    );

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Constructor
     * @param _tokenAddress 8BIT token contract address
     * @param _usdcAddress USDC token contract address
     * @param _startTime Sale start timestamp (0 = start immediately)
     */
    constructor(
        address _tokenAddress,
        address _usdcAddress,
        uint256 _startTime
    ) {
        require(_tokenAddress != address(0), "Invalid token address");
        require(_usdcAddress != address(0), "Invalid USDC address");

        eightBitToken = IERC20(_tokenAddress);
        usdcToken = IERC20(_usdcAddress);

        saleStartTime = _startTime == 0 ? block.timestamp : _startTime;
        saleEndTime = saleStartTime + SALE_DURATION;
    }

    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    modifier saleActive() {
        require(block.timestamp >= saleStartTime, "Sale has not started");
        require(block.timestamp < saleEndTime, "Sale has ended");
        require(!saleFinalized, "Sale is finalized");
        require(tokensSold < TOKENS_FOR_SALE, "All tokens sold");
        _;
    }

    // ═══════════════════════════════════════════════════════════
    // PURCHASE FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Purchase tokens with ETH
     */
    function buyWithEth() external payable nonReentrant whenNotPaused saleActive {
        require(msg.value > 0, "Must send ETH");

        uint256 tokenAmount = (msg.value * tokensPerEth) / 1 ether;
        require(tokenAmount > 0, "Amount too small");

        _processPurchase(msg.sender, tokenAmount, msg.value, 0);

        emit TokensPurchased(msg.sender, tokenAmount, msg.value, 0);
    }

    /**
     * @dev Purchase tokens with USDC
     * @param usdcAmount Amount of USDC to spend (6 decimals)
     */
    function buyWithUsdc(uint256 usdcAmount) external nonReentrant whenNotPaused saleActive {
        require(usdcAmount >= minPurchaseUsdc, "Below minimum purchase");

        // Transfer USDC from buyer
        require(
            usdcToken.transferFrom(msg.sender, address(this), usdcAmount),
            "USDC transfer failed"
        );

        // Calculate token amount (USDC has 6 decimals, 8BIT has 18)
        uint256 tokenAmount = (usdcAmount * tokensPerUsdc) / 10**6;
        require(tokenAmount > 0, "Amount too small");

        _processPurchase(msg.sender, tokenAmount, 0, usdcAmount);

        emit TokensPurchased(msg.sender, tokenAmount, 0, usdcAmount);
    }

    /**
     * @dev Internal function to process purchase
     */
    function _processPurchase(
        address buyer,
        uint256 tokenAmount,
        uint256 ethSpent,
        uint256 usdcSpent
    ) private {
        // Check limits
        require(
            purchasedTokens[buyer] + tokenAmount <= maxPurchasePerWallet,
            "Exceeds max purchase per wallet"
        );

        require(
            tokensSold + tokenAmount <= TOKENS_FOR_SALE,
            "Exceeds tokens available"
        );

        // Update state
        tokensSold += tokenAmount;
        purchasedTokens[buyer] += tokenAmount;

        if (ethSpent > 0) {
            ethRaised += ethSpent;
            spentEth[buyer] += ethSpent;
        }

        if (usdcSpent > 0) {
            usdcRaised += usdcSpent;
            spentUsdc[buyer] += usdcSpent;
        }

        // Track unique buyers
        if (!isBuyer[buyer]) {
            buyers.push(buyer);
            isBuyer[buyer] = true;
        }

        // Transfer tokens immediately (no vesting)
        require(
            eightBitToken.transfer(buyer, tokenAmount),
            "Token transfer failed"
        );
    }

    // ═══════════════════════════════════════════════════════════
    // SALE MANAGEMENT
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Finalize sale and burn unsold tokens
     * Can only be called after sale ends
     */
    function finalizeSale() external onlyOwner {
        require(block.timestamp >= saleEndTime, "Sale has not ended");
        require(!saleFinalized, "Already finalized");

        saleFinalized = true;

        // Burn unsold tokens
        uint256 unsoldTokens = TOKENS_FOR_SALE - tokensSold;
        if (unsoldTokens > 0) {
            require(
                eightBitToken.transfer(BURN_ADDRESS, unsoldTokens),
                "Burn failed"
            );
        }

        emit SaleFinalized(tokensSold, unsoldTokens, ethRaised, usdcRaised);
    }

    /**
     * @dev Withdraw raised funds (ETH + USDC)
     * Can be called multiple times during/after sale
     */
    function withdrawFunds(address payable recipient) external onlyOwner nonReentrant {
        require(recipient != address(0), "Invalid recipient");

        uint256 ethBalance = address(this).balance;
        uint256 usdcBalance = usdcToken.balanceOf(address(this));

        if (ethBalance > 0) {
            (bool success, ) = recipient.call{value: ethBalance}("");
            require(success, "ETH transfer failed");
        }

        if (usdcBalance > 0) {
            require(
                usdcToken.transfer(recipient, usdcBalance),
                "USDC transfer failed"
            );
        }

        emit FundsWithdrawn(recipient, ethBalance, usdcBalance);
    }

    /**
     * @dev Update token prices (for market volatility)
     * @param _tokensPerEth Tokens received per 1 ETH
     * @param _tokensPerUsdc Tokens received per 1 USDC
     */
    function updatePrices(
        uint256 _tokensPerEth,
        uint256 _tokensPerUsdc
    ) external onlyOwner {
        require(_tokensPerEth > 0, "Invalid ETH price");
        require(_tokensPerUsdc > 0, "Invalid USDC price");

        tokensPerEth = _tokensPerEth;
        tokensPerUsdc = _tokensPerUsdc;

        emit PriceUpdated(_tokensPerEth, _tokensPerUsdc);
    }

    /**
     * @dev Update purchase limits
     */
    function updateLimits(
        uint256 _minPurchaseUsdc,
        uint256 _maxPurchasePerWallet
    ) external onlyOwner {
        minPurchaseUsdc = _minPurchaseUsdc;
        maxPurchasePerWallet = _maxPurchasePerWallet;
    }

    /**
     * @dev Extend sale duration
     */
    function extendSale(uint256 additionalTime) external onlyOwner {
        require(!saleFinalized, "Sale is finalized");
        saleEndTime += additionalTime;
    }

    /**
     * @dev Pause/unpause sale
     */
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ═══════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Get sale progress percentage (0-100)
     */
    function getSaleProgress() external view returns (uint256) {
        return (tokensSold * 100) / TOKENS_FOR_SALE;
    }

    /**
     * @dev Get time remaining in sale
     */
    function getTimeRemaining() external view returns (uint256) {
        if (block.timestamp >= saleEndTime) return 0;
        return saleEndTime - block.timestamp;
    }

    /**
     * @dev Check if sale is active
     */
    function isSaleActive() external view returns (bool) {
        return block.timestamp >= saleStartTime &&
               block.timestamp < saleEndTime &&
               !saleFinalized &&
               tokensSold < TOKENS_FOR_SALE;
    }

    /**
     * @dev Get total USD raised (combining ETH + USDC)
     * Assumes current ETH price for estimation
     */
    function getTotalRaisedUsd() external view returns (uint256) {
        // ETH value = ethRaised * tokensPerEth / TOKENS_FOR_SALE * TOKEN_PRICE_USD
        // USDC value = usdcRaised (already in USD with 6 decimals)

        // For simplicity, calculate based on tokens sold
        return (tokensSold * TOKEN_PRICE_USD) / 10**18; // Returns in millionths
    }

    /**
     * @dev Get all buyers
     */
    function getBuyers() external view returns (address[] memory) {
        return buyers;
    }

    /**
     * @dev Get buyer count
     */
    function getBuyerCount() external view returns (uint256) {
        return buyers.length;
    }

    /**
     * @dev Get purchase info for a buyer
     */
    function getPurchaseInfo(address buyer) external view returns (
        uint256 tokens,
        uint256 eth,
        uint256 usdc
    ) {
        return (purchasedTokens[buyer], spentEth[buyer], spentUsdc[buyer]);
    }

    /**
     * @dev Calculate tokens for ETH amount
     */
    function calculateTokensForEth(uint256 ethAmount) external view returns (uint256) {
        return (ethAmount * tokensPerEth) / 1 ether;
    }

    /**
     * @dev Calculate tokens for USDC amount
     */
    function calculateTokensForUsdc(uint256 usdcAmount) external view returns (uint256) {
        return (usdcAmount * tokensPerUsdc) / 10**6;
    }

    // ═══════════════════════════════════════════════════════════
    // EMERGENCY
    // ═══════════════════════════════════════════════════════════

    /**
     * @dev Emergency withdrawal of tokens (if needed)
     */
    function emergencyWithdrawTokens(address token, address recipient) external onlyOwner {
        require(saleFinalized, "Can only use after sale finalized");
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(IERC20(token).transfer(recipient, balance), "Transfer failed");
    }

    /**
     * @dev Receive ETH
     */
    receive() external payable {
        revert("Use buyWithEth() function");
    }
}
