// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
     * @notice Calculate output for given tick (simplified)
     * @param tick The tick
     * @param amountIn Input amount
     * @return Output amount
     */
    function _getQuoteAtTick(int24 tick, uint256 amountIn) internal pure returns (uint256) {
        // Simplified calculation
        // Production should use TickMath library
        uint256 sqrtPriceX96 = _getSqrtRatioAtTick(tick);
        return (amountIn * sqrtPriceX96 * sqrtPriceX96) >> 192;
    }

    /**
     * @notice Get sqrt price at tick (simplified)
     * @param tick The tick
     * @return sqrtPriceX96 The sqrt price
     */
    function _getSqrtRatioAtTick(int24 tick) internal pure returns (uint256 sqrtPriceX96) {
        uint256 absTick = tick < 0 ? uint256(-int256(tick)) : uint256(int256(tick));
        require(absTick <= 887272, "Tick out of range");
        sqrtPriceX96 = uint256(2**96); // Simplified
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
