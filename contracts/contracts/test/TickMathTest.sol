// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TickMathTest
 * @notice Test contract to expose and verify TickMath implementation
 * @dev This contract exposes internal TickMath functions for testing
 *      Compare results against Uniswap V3's official TickMath library
 */
contract TickMathTest {
    /// @dev The minimum tick that can be used
    int24 public constant MIN_TICK = -887272;
    /// @dev The maximum tick that can be used
    int24 public constant MAX_TICK = 887272;

    /// @dev The minimum sqrt ratio (at MIN_TICK)
    uint160 public constant MIN_SQRT_RATIO = 4295128739;
    /// @dev The maximum sqrt ratio (at MAX_TICK)
    uint160 public constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    /**
     * @notice Get the sqrt ratio at a given tick (exposed for testing)
     * @dev This is the exact same implementation as in TournamentPayments/TournamentBuyback
     * @param tick The tick to get the sqrt ratio for
     * @return sqrtPriceX96 The sqrt ratio as a Q64.96 fixed point number
     */
    function getSqrtRatioAtTick(int24 tick) external pure returns (uint160 sqrtPriceX96) {
        return _getSqrtRatioAtTick(tick);
    }

    /**
     * @notice Get a quote for converting amountIn at a given tick
     * @param tick The tick representing the price
     * @param amountIn The input amount (in base token units)
     * @param baseDecimals Decimals of the base token
     * @param quoteDecimals Decimals of the quote token
     * @return amountOut The output amount
     */
    function getQuoteAtTick(
        int24 tick,
        uint256 amountIn,
        uint8 baseDecimals,
        uint8 quoteDecimals
    ) external pure returns (uint256 amountOut) {
        uint160 sqrtPriceX96 = _getSqrtRatioAtTick(tick);
        uint256 sqrtPrice = uint256(sqrtPriceX96);

        // Calculate price from sqrtPriceX96
        // price = (sqrtPriceX96 / 2^96)^2 = sqrtPriceX96^2 / 2^192
        // amountOut = amountIn * price * 10^(quoteDecimals - baseDecimals)

        // For USDC (6 decimals) to 8BIT (18 decimals): multiply by 10^12
        int8 decimalDiff = int8(quoteDecimals) - int8(baseDecimals);

        if (decimalDiff >= 0) {
            amountOut = (amountIn * sqrtPrice * sqrtPrice * (10 ** uint8(decimalDiff))) >> 192;
        } else {
            amountOut = (amountIn * sqrtPrice * sqrtPrice) / (10 ** uint8(-decimalDiff)) >> 192;
        }
    }

    /**
     * @notice Verify the implementation against known Uniswap V3 values
     * @return allPassed True if all verification checks pass
     */
    function verifyImplementation() external pure returns (bool allPassed) {
        // Test tick 0: should return exactly 2^96
        uint160 tick0 = _getSqrtRatioAtTick(0);
        if (tick0 != 79228162514264337593543950336) return false;

        // Test tick 1
        uint160 tick1 = _getSqrtRatioAtTick(1);
        if (tick1 != 79232123823359799118286999568) return false;

        // Test tick -1
        uint160 tickNeg1 = _getSqrtRatioAtTick(-1);
        if (tickNeg1 != 79224201403219477170569942574) return false;

        // Test MIN_TICK
        uint160 minTick = _getSqrtRatioAtTick(MIN_TICK);
        if (minTick != MIN_SQRT_RATIO) return false;

        // Test MAX_TICK
        uint160 maxTick = _getSqrtRatioAtTick(MAX_TICK);
        if (maxTick != MAX_SQRT_RATIO) return false;

        // Test some intermediate values
        // tick 100
        uint160 tick100 = _getSqrtRatioAtTick(100);
        if (tick100 != 79625275426524748796330556128) return false;

        // tick -100
        uint160 tickNeg100 = _getSqrtRatioAtTick(-100);
        if (tickNeg100 != 78833030112140176575862854579) return false;

        // tick 1000
        uint160 tick1000 = _getSqrtRatioAtTick(1000);
        if (tick1000 != 83290069058676223003182343270) return false;

        // tick -1000
        uint160 tickNeg1000 = _getSqrtRatioAtTick(-1000);
        if (tickNeg1000 != 75364347830767020784054125655) return false;

        // tick 50000
        uint160 tick50000 = _getSqrtRatioAtTick(50000);
        if (tick50000 != 965075977353221155028623082916) return false;

        // tick -50000
        uint160 tickNeg50000 = _getSqrtRatioAtTick(-50000);
        if (tickNeg50000 != 6504256538020985011912221507) return false;

        return true;
    }

    /**
     * @notice Get individual test results for debugging
     * @return actual Array of actual values from implementation
     * @return expected Array of expected values from Uniswap V3
     * @return passed Array of boolean pass/fail results
     */
    function getTestResults() external pure returns (
        uint160[12] memory actual,
        uint160[12] memory expected,
        bool[12] memory passed
    ) {
        // Tick 0
        actual[0] = _getSqrtRatioAtTick(0);
        expected[0] = 79228162514264337593543950336;
        passed[0] = actual[0] == expected[0];

        // Tick 1
        actual[1] = _getSqrtRatioAtTick(1);
        expected[1] = 79232123823359799118286999568;
        passed[1] = actual[1] == expected[1];

        // Tick -1
        actual[2] = _getSqrtRatioAtTick(-1);
        expected[2] = 79224201403219477170569942574;
        passed[2] = actual[2] == expected[2];

        // MIN_TICK
        actual[3] = _getSqrtRatioAtTick(MIN_TICK);
        expected[3] = MIN_SQRT_RATIO;
        passed[3] = actual[3] == expected[3];

        // MAX_TICK
        actual[4] = _getSqrtRatioAtTick(MAX_TICK);
        expected[4] = MAX_SQRT_RATIO;
        passed[4] = actual[4] == expected[4];

        // Tick 100
        actual[5] = _getSqrtRatioAtTick(100);
        expected[5] = 79625275426524748796330556128;
        passed[5] = actual[5] == expected[5];

        // Tick -100
        actual[6] = _getSqrtRatioAtTick(-100);
        expected[6] = 78833030112140176575862854579;
        passed[6] = actual[6] == expected[6];

        // Tick 1000
        actual[7] = _getSqrtRatioAtTick(1000);
        expected[7] = 83290069058676223003182343270;
        passed[7] = actual[7] == expected[7];

        // Tick -1000
        actual[8] = _getSqrtRatioAtTick(-1000);
        expected[8] = 75364347830767020784054125655;
        passed[8] = actual[8] == expected[8];

        // Tick 50000
        actual[9] = _getSqrtRatioAtTick(50000);
        expected[9] = 965075977353221155028623082916;
        passed[9] = actual[9] == expected[9];

        // Tick -50000
        actual[10] = _getSqrtRatioAtTick(-50000);
        expected[10] = 6504256538020985011912221507;
        passed[10] = actual[10] == expected[10];

        // Tick 10000 (additional check)
        actual[11] = _getSqrtRatioAtTick(10000);
        expected[11] = 130621891405341611593710811006;
        passed[11] = actual[11] == expected[11];
    }

    /**
     * @dev Internal TickMath implementation - MUST match TournamentPayments/TournamentBuyback exactly
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

            sqrtPriceX96 = uint160((ratio >> 32) + (ratio % (1 << 32) == 0 ? 0 : 1));
        }
    }
}
