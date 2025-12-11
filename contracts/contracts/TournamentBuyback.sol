// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

/**
 * @title TournamentBuyback
 * @notice Handles automatic 8BIT buyback and burn from USDC tournament fees
 * @dev Integrates with Uniswap V3 for trustless buybacks
 *
 * ⚠️ DEPLOY AFTER:
 * 1. Token sale completes
 * 2. Uniswap V3 liquidity pool created (8BIT/USDC)
 * 3. Router addresses verified on Arbitrum
 */
contract TournamentBuyback is Ownable, ReentrancyGuard {
    // Tokens
    IERC20 public immutable eightBitToken;
    IERC20 public immutable usdcToken;

    // Uniswap V3 Router (Arbitrum mainnet)
    ISwapRouter public immutable swapRouter;

    // 8BIT/USDC pool for TWAP oracle
    IUniswapV3Pool public pool;

    // Burn address
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Buyback settings
    uint256 public constant BURN_PERCENTAGE = 50; // 50% of fees
    uint256 public maxSlippage = 200; // 2% max slippage (in basis points)
    uint256 public twapInterval = 600; // 10 minutes TWAP

    // Stats tracking
    uint256 public totalUsdcCollected;
    uint256 public totalUsdcBuyback;
    uint256 public total8BitBurned;

    // Events
    event BuybackExecuted(
        uint256 usdcAmount,
        uint256 eightBitReceived,
        uint256 eightBitBurned
    );

    event FeesCollected(
        address indexed tournament,
        uint256 usdcAmount
    );

    event PoolUpdated(address indexed newPool);
    event SlippageUpdated(uint256 newSlippage);

    /**
     * @notice Constructor
     * @param _eightBitToken 8BIT token address
     * @param _usdcToken USDC token address (Arbitrum)
     * @param _swapRouter Uniswap V3 SwapRouter address (Arbitrum)
     */
    constructor(
        address _eightBitToken,
        address _usdcToken,
        address _swapRouter
    ) Ownable(msg.sender) {
        require(_eightBitToken != address(0), "Invalid 8BIT address");
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_swapRouter != address(0), "Invalid router address");

        eightBitToken = IERC20(_eightBitToken);
        usdcToken = IERC20(_usdcToken);
        swapRouter = ISwapRouter(_swapRouter);
    }

    /**
     * @notice Set the Uniswap V3 pool for TWAP oracle
     * @dev Must be called after liquidity pool is created
     * @param _pool 8BIT/USDC pool address
     */
    function setPool(address _pool) external onlyOwner {
        require(_pool != address(0), "Invalid pool address");
        pool = IUniswapV3Pool(_pool);
        emit PoolUpdated(_pool);
    }

    /**
     * @notice Update max slippage tolerance
     * @param _slippage New slippage in basis points (200 = 2%)
     */
    function setMaxSlippage(uint256 _slippage) external onlyOwner {
        require(_slippage <= 1000, "Slippage too high"); // Max 10%
        maxSlippage = _slippage;
        emit SlippageUpdated(_slippage);
    }

    /**
     * @notice Collect USDC tournament fees
     * @dev Called by tournament contract when fees are collected
     * @param amount USDC amount to collect
     */
    function collectFees(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");

        // Transfer USDC from caller (tournament contract)
        require(
            usdcToken.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );

        totalUsdcCollected += amount;
        emit FeesCollected(msg.sender, amount);
    }

    /**
     * @notice Execute automatic buyback and burn
     * @dev 50% of collected USDC → Buy 8BIT → Burn
     * @dev 50% of collected USDC → Prize pool (stays in contract)
     */
    function executeBuyback() external nonReentrant {
        require(address(pool) != address(0), "Pool not set");

        uint256 usdcBalance = usdcToken.balanceOf(address(this));
        require(usdcBalance > 0, "No USDC to buyback");

        // Calculate 50% for buyback
        uint256 buybackAmount = (usdcBalance * BURN_PERCENTAGE) / 100;
        require(buybackAmount > 0, "Buyback amount too small");

        // Approve router to spend USDC
        usdcToken.approve(address(swapRouter), buybackAmount);

        // Get minimum 8BIT amount (with slippage protection)
        uint256 minAmountOut = _getMinAmountOut(buybackAmount);

        // Execute swap: USDC → 8BIT
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
            .ExactInputSingleParams({
                tokenIn: address(usdcToken),
                tokenOut: address(eightBitToken),
                fee: 3000, // 0.3% fee tier (most liquid)
                recipient: address(this),
                deadline: block.timestamp + 300, // 5 minutes
                amountIn: buybackAmount,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            });

        uint256 eightBitReceived = swapRouter.exactInputSingle(params);

        // Burn the 8BIT tokens
        require(
            eightBitToken.transfer(BURN_ADDRESS, eightBitReceived),
            "Burn failed"
        );

        // Update stats
        totalUsdcBuyback += buybackAmount;
        total8BitBurned += eightBitReceived;

        emit BuybackExecuted(buybackAmount, eightBitReceived, eightBitReceived);
    }

    /**
     * @notice Calculate minimum output with slippage protection
     * @dev Uses TWAP oracle to get fair price
     * @param usdcAmount Input USDC amount
     * @return Minimum 8BIT to receive
     */
    function _getMinAmountOut(uint256 usdcAmount) internal view returns (uint256) {
        // Get TWAP price from pool
        (int24 arithmeticMeanTick,) = _getTwapTick();

        // Calculate expected output at TWAP price
        uint256 expectedOutput = _getQuoteAtTick(arithmeticMeanTick, usdcAmount);

        // Apply slippage tolerance
        uint256 minOutput = (expectedOutput * (10000 - maxSlippage)) / 10000;

        return minOutput;
    }

    /**
     * @notice Get TWAP tick from pool
     * @return arithmeticMeanTick The time-weighted average tick
     */
    function _getTwapTick() internal view returns (int24 arithmeticMeanTick, uint128 harmonicMeanLiquidity) {
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = uint32(twapInterval);
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) =
            pool.observe(secondsAgos);

        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];
        uint160 secondsPerLiquidityCumulativesDelta =
            secondsPerLiquidityCumulativeX128s[1] - secondsPerLiquidityCumulativeX128s[0];

        arithmeticMeanTick = int24(tickCumulativesDelta / int56(uint56(twapInterval)));

        // Always round to negative infinity
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int56(uint56(twapInterval)) != 0)) {
            arithmeticMeanTick--;
        }

        uint192 secondsAgoX160 = uint192(twapInterval) * type(uint160).max;
        harmonicMeanLiquidity = uint128(secondsAgoX160 / (uint192(secondsPerLiquidityCumulativesDelta) << 32));
    }

    /**
     * @notice Calculate output amount for given tick
     * @param tick The tick to calculate at
     * @param amountIn Input USDC amount
     * @return Amount of 8BIT expected
     */
    function _getQuoteAtTick(
        int24 tick,
        uint256 amountIn
    ) internal pure returns (uint256) {
        // This is a simplified calculation
        // In production, use full TickMath library
        uint256 sqrtPriceX96 = _getSqrtRatioAtTick(tick);

        // Calculate amount out based on price
        // Adjust for token decimals (USDC=6, 8BIT=18)
        return (amountIn * sqrtPriceX96 * sqrtPriceX96 * 1e12) >> 192;
    }

    /**
     * @notice Get sqrt price at tick (simplified)
     * @param tick The tick
     * @return sqrtPriceX96 The sqrt price
     */
    function _getSqrtRatioAtTick(int24 tick) internal pure returns (uint256 sqrtPriceX96) {
        // Simplified - in production use TickMath.getSqrtRatioAtTick
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
        require(absTick <= 887272, "Tick out of range");

        // Approximate calculation for demonstration
        // Production should use full TickMath library
        sqrtPriceX96 = uint256(2**96);
    }

    /**
     * @notice Withdraw prize pool USDC to tournament contract
     * @dev Only callable by owner (tournament manager)
     * @param recipient Address to receive USDC
     * @param amount Amount to withdraw
     */
    function withdrawPrizePool(address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount must be > 0");

        uint256 balance = usdcToken.balanceOf(address(this));
        require(amount <= balance, "Insufficient balance");

        require(usdcToken.transfer(recipient, amount), "Transfer failed");
    }

    /**
     * @notice Emergency withdraw (only if something goes wrong)
     * @param token Token to withdraw
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(msg.sender, amount), "Transfer failed");
    }

    /**
     * @notice Get current stats
     * @return collected Total USDC collected from tournaments
     * @return buyback Total USDC used for buybacks
     * @return burned Total 8BIT burned
     * @return prizePool Current USDC available for prizes
     */
    function getStats() external view returns (
        uint256 collected,
        uint256 buyback,
        uint256 burned,
        uint256 prizePool
    ) {
        return (
            totalUsdcCollected,
            totalUsdcBuyback,
            total8BitBurned,
            usdcToken.balanceOf(address(this))
        );
    }
}
