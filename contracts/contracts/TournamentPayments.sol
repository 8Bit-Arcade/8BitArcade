// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol";

/**
 * @title TournamentPayments
 * @notice Handles tournament entry fees in both USDC and ETH with automatic buyback & burn
 * @dev Allows players to pay in USDC or ETH - ETH is auto-converted to USDC via Uniswap V3
 *
 * Features:
 * - Accept USDC or ETH for tournament entry
 * - Auto-convert ETH to USDC via Uniswap
 * - 50% of fees → Buyback 8BIT and burn
 * - 50% of fees → Prize pool
 * - Real-time ETH/USDC pricing via Uniswap TWAP
 */
contract TournamentPayments is Ownable, ReentrancyGuard {
    // Tokens
    IERC20 public immutable eightBitToken;
    IERC20 public immutable usdcToken;
    IERC20 public immutable wethToken; // Wrapped ETH on Arbitrum

    // Uniswap V3 Router (Arbitrum mainnet: 0xE592427A0AEce92De3Edee1F18E0157C05861564)
    ISwapRouter public immutable swapRouter;

    // Uniswap V3 pools
    IUniswapV3Pool public eightBitUsdcPool; // 8BIT/USDC pool
    IUniswapV3Pool public wethUsdcPool;     // WETH/USDC pool for ETH pricing

    // Burn address
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Fee settings
    uint256 public constant BURN_PERCENTAGE = 50; // 50% burned, 50% to prizes
    uint256 public maxSlippage = 200; // 2% max slippage (200 basis points)
    uint256 public twapInterval = 600; // 10 minutes TWAP for price oracles

    // Stats tracking
    uint256 public totalUsdcCollected;
    uint256 public totalEthCollected;
    uint256 public totalUsdcFromEth; // ETH converted to USDC
    uint256 public totalUsdcBuyback;
    uint256 public total8BitBurned;

    // Tournament entry fees (in USD cents, 6 decimals like USDC)
    mapping(uint256 => uint256) public tournamentFees; // tournamentId => feeInUsdcCents

    // Payment tracking
    mapping(uint256 => mapping(address => bool)) public hasPaid; // tournamentId => player => paid

    // Events
    event TournamentFeeSet(uint256 indexed tournamentId, uint256 feeInUsdc);

    event PaymentReceived(
        uint256 indexed tournamentId,
        address indexed player,
        address paymentToken, // address(0) for ETH, token address for ERC20
        uint256 amountPaid,
        uint256 usdcValue
    );

    event EthConverted(
        uint256 ethAmount,
        uint256 usdcReceived,
        uint256 ethPriceInUsdc
    );

    event BuybackExecuted(
        uint256 usdcAmount,
        uint256 eightBitReceived,
        uint256 eightBitBurned
    );

    event PoolsUpdated(address indexed eightBitUsdcPool, address indexed wethUsdcPool);
    event SlippageUpdated(uint256 newSlippage);

    /**
     * @notice Constructor
     * @param _eightBitToken 8BIT token address
     * @param _usdcToken USDC token address (Arbitrum: 0xaf88d065e77c8cC2239327C5EDb3A432268e5831)
     * @param _wethToken WETH token address (Arbitrum: 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1)
     * @param _swapRouter Uniswap V3 SwapRouter (Arbitrum: 0xE592427A0AEce92De3Edee1F18E0157C05861564)
     */
    constructor(
        address _eightBitToken,
        address _usdcToken,
        address _wethToken,
        address _swapRouter
    ) Ownable(msg.sender) {
        require(_eightBitToken != address(0), "Invalid 8BIT address");
        require(_usdcToken != address(0), "Invalid USDC address");
        require(_wethToken != address(0), "Invalid WETH address");
        require(_swapRouter != address(0), "Invalid router address");

        eightBitToken = IERC20(_eightBitToken);
        usdcToken = IERC20(_usdcToken);
        wethToken = IERC20(_wethToken);
        swapRouter = ISwapRouter(_swapRouter);
    }

    /**
     * @notice Set Uniswap V3 pools for TWAP oracles
     * @param _eightBitUsdcPool 8BIT/USDC pool address
     * @param _wethUsdcPool WETH/USDC pool address
     */
    function setPools(address _eightBitUsdcPool, address _wethUsdcPool) external onlyOwner {
        require(_eightBitUsdcPool != address(0), "Invalid 8BIT/USDC pool");
        require(_wethUsdcPool != address(0), "Invalid WETH/USDC pool");

        eightBitUsdcPool = IUniswapV3Pool(_eightBitUsdcPool);
        wethUsdcPool = IUniswapV3Pool(_wethUsdcPool);

        emit PoolsUpdated(_eightBitUsdcPool, _wethUsdcPool);
    }

    /**
     * @notice Set tournament entry fee
     * @param tournamentId Tournament ID
     * @param feeInUsdc Fee in USDC (with 6 decimals, e.g. 5000000 = $5)
     */
    function setTournamentFee(uint256 tournamentId, uint256 feeInUsdc) external onlyOwner {
        require(feeInUsdc > 0, "Fee must be > 0");
        tournamentFees[tournamentId] = feeInUsdc;
        emit TournamentFeeSet(tournamentId, feeInUsdc);
    }

    /**
     * @notice Pay tournament entry fee with USDC
     * @param tournamentId Tournament ID to enter
     */
    function payWithUsdc(uint256 tournamentId) external nonReentrant {
        uint256 fee = tournamentFees[tournamentId];
        require(fee > 0, "Tournament fee not set");
        require(!hasPaid[tournamentId][msg.sender], "Already paid");

        // Transfer USDC from player
        require(
            usdcToken.transferFrom(msg.sender, address(this), fee),
            "USDC transfer failed"
        );

        // Mark as paid
        hasPaid[tournamentId][msg.sender] = true;
        totalUsdcCollected += fee;

        emit PaymentReceived(tournamentId, msg.sender, address(usdcToken), fee, fee);
    }

    /**
     * @notice Pay tournament entry fee with ETH
     * @dev ETH is auto-converted to USDC via Uniswap
     * @param tournamentId Tournament ID to enter
     */
    function payWithEth(uint256 tournamentId) external payable nonReentrant {
        uint256 fee = tournamentFees[tournamentId];
        require(fee > 0, "Tournament fee not set");
        require(!hasPaid[tournamentId][msg.sender], "Already paid");
        require(msg.value > 0, "Must send ETH");
        require(address(wethUsdcPool) != address(0), "WETH/USDC pool not set");

        // Get current ETH price in USDC
        uint256 ethPriceInUsdc = getEthPriceInUsdc();
        require(ethPriceInUsdc > 0, "Invalid ETH price");

        // Calculate required ETH amount (with buffer for slippage)
        uint256 requiredEth = (fee * 1e18 * (10000 + maxSlippage)) / (ethPriceInUsdc * 10000);
        require(msg.value >= requiredEth, "Insufficient ETH sent");

        // Wrap ETH to WETH (deposit)
        (bool success,) = address(wethToken).call{value: msg.value}("");
        require(success, "WETH wrap failed");

        // Approve router to spend WETH
        wethToken.approve(address(swapRouter), msg.value);

        // Swap WETH → USDC
        ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter.ExactOutputSingleParams({
            tokenIn: address(wethToken),
            tokenOut: address(usdcToken),
            fee: 500, // 0.05% fee tier (most liquid for WETH/USDC)
            recipient: address(this),
            deadline: block.timestamp + 300, // 5 minutes
            amountOut: fee, // Exact USDC needed
            amountInMaximum: msg.value,
            sqrtPriceLimitX96: 0
        });

        uint256 ethSpent = swapRouter.exactOutputSingle(params);

        // Refund excess ETH if any
        if (msg.value > ethSpent) {
            // Unwrap excess WETH back to ETH
            uint256 excessWeth = msg.value - ethSpent;
            (bool unwrapSuccess,) = address(wethToken).call(
                abi.encodeWithSignature("withdraw(uint256)", excessWeth)
            );
            require(unwrapSuccess, "WETH unwrap failed");

            // Return excess ETH to player
            (bool refundSuccess,) = msg.sender.call{value: excessWeth}("");
            require(refundSuccess, "ETH refund failed");
        }

        // Mark as paid
        hasPaid[tournamentId][msg.sender] = true;
        totalEthCollected += ethSpent;
        totalUsdcFromEth += fee;
        totalUsdcCollected += fee;

        emit PaymentReceived(tournamentId, msg.sender, address(0), ethSpent, fee);
        emit EthConverted(ethSpent, fee, ethPriceInUsdc);
    }

    /**
     * @notice Execute buyback and burn (50% of collected USDC)
     * @dev Can be called by anyone, permissionless
     */
    function executeBuyback() external nonReentrant {
        require(address(eightBitUsdcPool) != address(0), "8BIT/USDC pool not set");

        uint256 usdcBalance = usdcToken.balanceOf(address(this));
        require(usdcBalance > 0, "No USDC to buyback");

        // Calculate 50% for buyback
        uint256 buybackAmount = (usdcBalance * BURN_PERCENTAGE) / 100;
        require(buybackAmount > 0, "Buyback amount too small");

        // Approve router to spend USDC
        usdcToken.approve(address(swapRouter), buybackAmount);

        // Swap USDC → 8BIT with slippage protection
        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: address(usdcToken),
            tokenOut: address(eightBitToken),
            fee: 3000, // 0.3% fee tier
            recipient: address(this),
            deadline: block.timestamp + 300,
            amountIn: buybackAmount,
            amountOutMinimum: _getMin8BitOut(buybackAmount),
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
     * @notice Get current ETH price in USDC (6 decimals)
     * @dev Uses TWAP from WETH/USDC pool
     * @return ETH price in USDC (e.g. 3000000000 = $3000)
     */
    function getEthPriceInUsdc() public view returns (uint256) {
        require(address(wethUsdcPool) != address(0), "Pool not set");

        // Get TWAP tick
        (int24 arithmeticMeanTick,) = _getTwapTick(wethUsdcPool);

        // Calculate price from tick
        // WETH has 18 decimals, USDC has 6 decimals
        uint256 price = _getQuoteAtTick(arithmeticMeanTick, 1e18);

        return price;
    }

    /**
     * @notice Get minimum 8BIT output for buyback with slippage protection
     * @param usdcAmount Input USDC amount
     * @return Minimum 8BIT to receive
     */
    function _getMin8BitOut(uint256 usdcAmount) internal view returns (uint256) {
        (int24 arithmeticMeanTick,) = _getTwapTick(eightBitUsdcPool);
        uint256 expectedOutput = _getQuoteAtTick(arithmeticMeanTick, usdcAmount);
        return (expectedOutput * (10000 - maxSlippage)) / 10000;
    }

    /**
     * @notice Get TWAP tick from pool
     * @param pool The Uniswap V3 pool
     * @return arithmeticMeanTick The time-weighted average tick
     */
    function _getTwapTick(IUniswapV3Pool pool) internal view returns (int24 arithmeticMeanTick, uint128 harmonicMeanLiquidity) {
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = uint32(twapInterval);
        secondsAgos[1] = 0;

        (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) =
            pool.observe(secondsAgos);

        int56 tickCumulativesDelta = tickCumulatives[1] - tickCumulatives[0];

        arithmeticMeanTick = int24(tickCumulativesDelta / int56(uint56(twapInterval)));

        // Always round to negative infinity
        if (tickCumulativesDelta < 0 && (tickCumulativesDelta % int56(uint56(twapInterval)) != 0)) {
            arithmeticMeanTick--;
        }

        uint192 secondsAgoX160 = uint192(twapInterval) * type(uint160).max;
        uint160 secondsPerLiquidityCumulativesDelta =
            secondsPerLiquidityCumulativeX128s[1] - secondsPerLiquidityCumulativeX128s[0];
        harmonicMeanLiquidity = uint128(secondsAgoX160 / (uint192(secondsPerLiquidityCumulativesDelta) << 32));
    }

    /**
     * @notice Calculate output for given tick using Uniswap V3 TickMath
     * @param tick The tick
     * @param amountIn Input amount
     * @return Output amount
     */
    function _getQuoteAtTick(int24 tick, uint256 amountIn) internal pure returns (uint256) {
        // Get the sqrt price using inline TickMath logic
        uint160 sqrtPriceX96 = _getSqrtRatioAtTick(tick);

        // Calculate price from sqrtPriceX96
        // price = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
        // amountOut = amountIn * price
        uint256 sqrtPrice = uint256(sqrtPriceX96);
        return (amountIn * sqrtPrice * sqrtPrice) >> 192;
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
     * @notice Withdraw prize pool USDC (owner only)
     * @param recipient Address to receive USDC
     * @param amount Amount to withdraw
     */
    function withdrawPrizePool(address recipient, uint256 amount) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        require(usdcToken.transfer(recipient, amount), "Transfer failed");
    }

    /**
     * @notice Update max slippage
     * @param _slippage New slippage in basis points (200 = 2%)
     */
    function setMaxSlippage(uint256 _slippage) external onlyOwner {
        require(_slippage <= 1000, "Slippage too high");
        maxSlippage = _slippage;
        emit SlippageUpdated(_slippage);
    }

    /**
     * @notice Get tournament payment status
     * @param tournamentId Tournament ID
     * @param player Player address
     * @return paid Whether player has paid
     * @return fee Entry fee in USDC
     */
    function getPaymentStatus(uint256 tournamentId, address player) external view returns (bool paid, uint256 fee) {
        return (hasPaid[tournamentId][player], tournamentFees[tournamentId]);
    }

    /**
     * @notice Get contract stats
     */
    function getStats() external view returns (
        uint256 usdcCollected,
        uint256 ethCollected,
        uint256 usdcFromEth,
        uint256 usdcBuyback,
        uint256 eightBitBurned,
        uint256 prizePoolBalance
    ) {
        return (
            totalUsdcCollected,
            totalEthCollected,
            totalUsdcFromEth,
            totalUsdcBuyback,
            total8BitBurned,
            usdcToken.balanceOf(address(this))
        );
    }

    /**
     * @notice Emergency withdraw (owner only)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            (bool success,) = msg.sender.call{value: amount}("");
            require(success, "ETH transfer failed");
        } else {
            require(IERC20(token).transfer(msg.sender, amount), "Token transfer failed");
        }
    }

    /**
     * @notice Receive ETH
     */
    receive() external payable {}
}
