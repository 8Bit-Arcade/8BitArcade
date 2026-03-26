// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
     * @notice Calculate output amount for given tick using Uniswap V3 TickMath
     * @param tick The tick to calculate at
     * @param amountIn Input USDC amount
     * @return Amount of 8BIT expected
     */
    function _getQuoteAtTick(
        int24 tick,
        uint256 amountIn
    ) internal pure returns (uint256) {
        // Get the sqrt price using inline TickMath logic
        uint160 sqrtPriceX96 = _getSqrtRatioAtTick(tick);

        // Calculate amount out based on price
        // Adjust for token decimals (USDC=6, 8BIT=18)
        uint256 sqrtPrice = uint256(sqrtPriceX96);
        return (amountIn * sqrtPrice * sqrtPrice * 1e12) >> 192;
    }

    /**
     * @notice Calculates sqrt(1.0001^tick) * 2^96
     * @dev Adapted from Uniswap V3 TickMath for Solidity 0.8.x
     * @param tick The input tick for the above formula
     * @return sqrtPriceX96 A Fixed point Q64.96 number representing the sqrt of the ratio of the two assets
     */
    function _getSqrtRatioAtTick(int24 tick) internal pure returns (uint160 sqrtPriceX96) {
        unchecked {
            uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
            require(absTick <= 887272, "T");

            uint256 ratio = absTick & 0x1 != 0
                ? 0xfffcb933bd6fad37aa2d162d1a594001
                : 0x100000000000000000000000000000000;
            if (absTick & 0x2 != 0) ratio = (ratio * 0xfff97272373d413259a46990580e213a) >> 128;
            if (absTick & 0x4 != 0) ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdcc) >> 128;
            if (absTick & 0x8 != 0) ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0) >> 128;
            if (absTick & 0x10 != 0) ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644) >> 128;
            if (absTick & 0x20 != 0) ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0) >> 128;
            if (absTick & 0x40 != 0) ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861) >> 128;
            if (absTick & 0x80 != 0) ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053) >> 128;
            if (absTick & 0x100 != 0) ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4) >> 128;
            if (absTick & 0x200 != 0) ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54) >> 128;
            if (absTick & 0x400 != 0) ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3) >> 128;
            if (absTick & 0x800 != 0) ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9) >> 128;
            if (absTick & 0x1000 != 0) ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825) >> 128;
            if (absTick & 0x2000 != 0) ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5) >> 128;
            if (absTick & 0x4000 != 0) ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7) >> 128;
            if (absTick & 0x8000 != 0) ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6) >> 128;
            if (absTick & 0x10000 != 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9) >> 128;
            if (absTick & 0x20000 != 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604) >> 128;
            if (absTick & 0x40000 != 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98) >> 128;
            if (absTick & 0x80000 != 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2) >> 128;

            if (tick > 0) ratio = type(uint256).max / ratio;

            // this divides by 1<<32 rounding up to go from a Q128.128 to a Q128.96.
            // we then downcast because we know the result always fits within 160 bits due to our tick input constraint
            // we round up in the division so getTickAtSqrtRatio of the output price is always consistent
            sqrtPriceX96 = uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
        }
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
