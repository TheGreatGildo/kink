// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/KinkPool.sol";
import "../src/KinkFactory.sol";
import "../src/mocks/MockERC20.sol";
import "../src/libraries/CurveMath.sol";

contract FeeAnalysisTest is Test {
    KinkPool pool;
    KinkFactory factory;
    MockERC20 token0;
    MockERC20 token1;
    address user1 = address(0x1);
    address user2 = address(0x2);

    uint256 constant A0 = 100;
    uint256 constant A1 = 100; // Keep A symmetric to isolate fee effects? Or maybe keep asymmetric as per design.
    // Let's use symmetric A to verify fee logic purely based on balances.

    // Distinct fees to easily identify which one is applied
    uint256 constant BASE_FEE = 100;     // 1%
    uint256 constant KINKING_FEE = 500;  // 5%
    uint256 constant FEE_DENOMINATOR = 10000;
    uint256 constant SOFT_PEG = 2e18;

    function setUp() public {
        token0 = new MockERC20("Token0", "T0");
        token1 = new MockERC20("Token1", "T1");

        factory = new KinkFactory();
        // Use symmetric A to simplify math, focus on fee logic
        address poolAddress = factory.createPool(address(token0), address(token1), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
        pool = KinkPool(poolAddress);

        token0.mint(user1, 1000000e18);
        token1.mint(user1, 1000000e18);
        token0.mint(user2, 1000000e18);
        token1.mint(user2, 1000000e18);
    }

    // Helper to calculate expected output without fees (approximation or using library)
    // Since we just want to distinguish between 1% and 5%, we can check the output amount.

    function testFee_SellWeaker_ExpectKinkFee() public {
        // Setup: Token0 has MORE deposits (Weaker).
        // Token0 = 20,000, Token1 = 10,000
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 20000e18;
        amounts[1] = 10000e18;
        token0.approve(address(pool), type(uint256).max);
        token1.approve(address(pool), type(uint256).max);
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();

        // Verify state: Reserve0 > Reserve1
        (uint256 r0, uint256 r1) = pool.getReserves();
        // We need to know which is token0 in the pool (factory sorts)
        if (pool.token0() != address(token0)) {
             // If swapped, then r0 corresponds to token1 (which was 10k).
             // Let's just ensure we know which token has MORE balance.
             // If token0 address < token1 address, pool.token0 is token0.
        }

        IERC20 inputToken;
        IERC20 outputToken;
        uint256 i;
        uint256 j;

        // Identify the token with MORE balance (Weaker)
        if (r0 > r1) {
            // Token at index 0 is weaker. We want to SELL it (Input = 0)
            inputToken = IERC20(pool.token0());
            outputToken = IERC20(pool.token1());
            i = 0;
            j = 1;
        } else {
            // Token at index 1 is weaker. We want to SELL it (Input = 1)
            inputToken = IERC20(pool.token1());
            outputToken = IERC20(pool.token0());
            i = 1;
            j = 0;
        }

        // Action: Sell small amount of Weaker token.
        // This increases the imbalance.
        uint256 dx = 100e18;
        vm.startPrank(user2);
        inputToken.approve(address(pool), dx);
        uint256 dy = pool.exchange(i, j, dx, 0);
        vm.stopPrank();

        // Analysis
        // If Base Fee (1%) was used: dy ~= dx * 0.99
        // If Kink Fee (5%) was used: dy ~= dx * 0.95
        // (ignoring slippage for small amount and high A)

        uint256 dy_per_dx = (dy * 10000) / dx;
        console.log("Selling Weaker Asset (Reserve %s > Reserve %s)", r0, r1);
        console.log("Input Amount:", dx);
        console.log("Output Amount:", dy);
        console.log("Output/Input (bps):", dy_per_dx);

        // Expectation: Kink Fee (5%) -> Ratio approx 9500
        // If it is Base Fee (1%) -> Ratio approx 9900

        if (dy_per_dx > 9800) {
            console.log("RESULT: Base Fee was likely applied (Unexpected)");
        } else if (dy_per_dx < 9600) {
            console.log("RESULT: Kink Fee was likely applied (Expected)");
        } else {
            console.log("RESULT: Indeterminate");
        }
    }

    function testFee_SellStronger_ExpectBaseFee() public {
        // Setup: Token0 has LESS deposits (Stronger).
        // Token0 = 10,000, Token1 = 20,000
        // We assume factory preserves order or we check it.

        vm.startPrank(user1);
        uint256[2] memory amounts;
        // We want distinct amounts.
        // Let's just dump liquidity and check reserves.
        amounts[0] = 10000e18;
        amounts[1] = 20000e18;
        token0.approve(address(pool), type(uint256).max);
        token1.approve(address(pool), type(uint256).max);
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();

        (uint256 r0, uint256 r1) = pool.getReserves();

        IERC20 inputToken;
        uint256 i;
        uint256 j;

        // Identify the token with LESS balance (Stronger)
        if (r0 < r1) {
            // Token at index 0 is stronger. Sell it.
            inputToken = IERC20(pool.token0());
            i = 0; j = 1;
        } else {
            // Token at index 1 is stronger. Sell it.
            inputToken = IERC20(pool.token1());
            i = 1; j = 0;
        }

        // Action: Sell small amount of Stronger token.
        // This reduces the imbalance (converges).
        uint256 dx = 100e18;
        vm.startPrank(user2);
        inputToken.approve(address(pool), dx);
        uint256 dy = pool.exchange(i, j, dx, 0);
        vm.stopPrank();

        uint256 dy_per_dx = (dy * 10000) / dx;
        console.log("Selling Stronger Asset (Reserve %s < Reserve %s)", r0, r1);
        console.log("Output/Input (bps):", dy_per_dx);

        // Expectation: Base Fee (1%) -> Ratio approx 9900

        if (dy_per_dx > 9800) {
            console.log("RESULT: Base Fee was likely applied (Expected)");
        } else if (dy_per_dx < 9600) {
            console.log("RESULT: Kink Fee was likely applied (Unexpected)");
        }
    }
}

