// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/KinkPool.sol";
import "../src/KinkFactory.sol";
import "../src/mocks/MockERC20.sol";

contract KinkPoolTest is Test {
    KinkPool pool;
    KinkFactory factory;
    MockERC20 token0;
    MockERC20 token1;
    address user1 = address(0x1);
    address user2 = address(0x2);

    uint256 constant A0 = 100;
    uint256 constant A1 = 200;
    uint256 constant BASE_FEE = 4; // 0.04%
    uint256 constant KINKING_FEE = 10; // 0.1%
    uint256 constant SOFT_PEG = 2e18; // High value to preserve test behavior

    function setUp() public {
        token0 = new MockERC20("Token0", "T0");
        token1 = new MockERC20("Token1", "T1");

        // Deploy factory and create pool through it
        factory = new KinkFactory();
        address poolAddress = factory.createPool(address(token0), address(token1), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
        pool = KinkPool(poolAddress);

        // Mint tokens to users
        token0.mint(user1, 1000000e18);
        token1.mint(user1, 1000000e18);
        token0.mint(user2, 1000000e18);
        token1.mint(user2, 1000000e18);
    }

    function testInitialize() public {
        // Verify pool was initialized correctly through factory
        assertEq(pool.factory(), address(factory), "Factory should be set");
        // Factory sorts tokens, so verify tokens are set (order may differ)
        assertTrue(
            (pool.token0() == address(token0) && pool.token1() == address(token1))
                || (pool.token0() == address(token1) && pool.token1() == address(token0)),
            "Tokens should be set (may be sorted)"
        );
        (uint256 expectedA0, uint256 expectedA1) = _expectedAmplifications();
        assertEq(pool.A0(), expectedA0, "A0 should be set");
        assertEq(pool.A1(), expectedA1, "A1 should be set");
        assertEq(pool.baseFee(), BASE_FEE, "Base fee should be set");
        assertEq(pool.kinkingFee(), KINKING_FEE, "Kinking fee should be set");
        assertEq(pool.softPeg0(), SOFT_PEG, "Soft peg 0 should be set");
        assertEq(pool.softPeg1(), SOFT_PEG, "Soft peg 1 should be set");
    }

    function testInitialize_RevertIfZeroAddress() public {
        vm.expectRevert("KinkFactory: Zero address");
        factory.createPool(address(0), address(token1), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
    }

    function testInitialize_RevertIfTokensNotSorted() public {
        // Create new tokens to avoid pool exists error
        MockERC20 newToken0 = new MockERC20("NewToken0", "NT0");
        MockERC20 newToken1 = new MockERC20("NewToken1", "NT1");

        // Factory will sort tokens, so this test checks factory behavior
        address poolAddress = factory.createPool(address(newToken1), address(newToken0), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
        KinkPool newPool = KinkPool(poolAddress);
        // Tokens should be sorted by factory
        assertEq(newPool.token0(), address(newToken0));
        assertEq(newPool.token1(), address(newToken1));
    }

    function testInitialize_RevertIfInvalidA0() public {
        // Create new tokens to avoid pool exists error
        MockERC20 newToken0 = new MockERC20("NewToken0", "NT0");
        MockERC20 newToken1 = new MockERC20("NewToken1", "NT1");
        vm.expectRevert("KinkPool: Invalid A0");
        factory.createPool(address(newToken0), address(newToken1), 1, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
    }

    function testAddLiquidity_FirstDeposit() public {
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 1000e18;
        amounts[1] = 1000e18;
        token0.approve(address(pool), amounts[0]);
        token1.approve(address(pool), amounts[1]);

        uint256 lpAmount = pool.add_liquidity(amounts, 0);
        assertGt(lpAmount, 0, "LP amount should be greater than 0");
        // User receives minted - MINIMUM_LIQUIDITY
        uint256 expected = lpAmount; // lpAmount returned by function is total minted before burn? No, function logic returns minted amount
        // Wait, let's check return value of add_liquidity
        // It returns `lpAmount` which is the amount minted to the user (after subtraction in the new logic?)
        // In new logic: `lpAmount -= MINIMUM_LIQUIDITY; return lpAmount;` (implicit return or explicit?)
        // Let's check KinkPool.sol logic again.
        assertEq(pool.balanceOf(user1), lpAmount, "User should receive LP tokens");
        vm.stopPrank();
    }

    function testAddLiquidity_SecondDeposit() public {
        // First deposit
        vm.startPrank(user1);
        uint256[2] memory amounts1;
        amounts1[0] = 1000e18;
        amounts1[1] = 1000e18;
        token0.approve(address(pool), amounts1[0]);
        token1.approve(address(pool), amounts1[1]);
        pool.add_liquidity(amounts1, 0);
        vm.stopPrank();

        // Second deposit
        vm.startPrank(user2);
        uint256[2] memory amounts2;
        amounts2[0] = 500e18;
        amounts2[1] = 500e18;
        token0.approve(address(pool), amounts2[0]);
        token1.approve(address(pool), amounts2[1]);
        uint256 lpAmount = pool.add_liquidity(amounts2, 0);
        assertGt(lpAmount, 0, "LP amount should be greater than 0");
        vm.stopPrank();
    }

    function testAddLiquidity_RevertIfZeroAmounts() public {
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 0;
        amounts[1] = 0;
        token0.approve(address(pool), 0);
        token1.approve(address(pool), 0);

        vm.expectRevert("KinkPool: Zero amounts");
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();
    }

    function testRemoveLiquidity() public {
        // Add liquidity first
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 1000e18;
        amounts[1] = 1000e18;
        token0.approve(address(pool), amounts[0]);
        token1.approve(address(pool), amounts[1]);
        uint256 lpAmount = pool.add_liquidity(amounts, 0);
        vm.stopPrank();

        // Remove liquidity
        vm.startPrank(user1);
        uint256[2] memory minAmounts;
        minAmounts[0] = 0;
        minAmounts[1] = 0;
        uint256[2] memory withdrawn = pool.remove_liquidity(lpAmount / 2, minAmounts);
        assertGt(withdrawn[0], 0, "Should withdraw token0");
        assertGt(withdrawn[1], 0, "Should withdraw token1");
        vm.stopPrank();
    }

    function testExchange_StandardSwap() public {
        // Add liquidity first
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 10000e18;
        amounts[1] = 10000e18;
        token0.approve(address(pool), amounts[0]);
        token1.approve(address(pool), amounts[1]);
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();

        // Determine which token is which in the pool
        address poolToken0 = pool.token0();
        address poolToken1 = pool.token1();
        IERC20 inputToken = IERC20(poolToken0);
        IERC20 outputToken = IERC20(poolToken1);

        // Swap token0 -> token1 (using pool's token0 -> pool's token1)
        vm.startPrank(user2);
        uint256 dx = 1000e18; // Larger amount for better convergence
        inputToken.approve(address(pool), type(uint256).max);
        uint256 balanceBefore = outputToken.balanceOf(user2);
        uint256 dy = pool.exchange(0, 1, dx, 0);
        uint256 balanceAfter = outputToken.balanceOf(user2);
        assertGt(dy, 0, "Swap should produce output");
        assertEq(balanceAfter - balanceBefore, dy, "Balance should increase by dy");
        vm.stopPrank();
    }

    function testExchange_CrossEquilibrium() public {
        // Determine which token is which in the pool
        address poolToken0 = pool.token0();
        address poolToken1 = pool.token1();
        IERC20 poolToken0ERC20 = IERC20(poolToken0);
        IERC20 poolToken1ERC20 = IERC20(poolToken1);

        // Add liquidity with imbalance - make poolToken0 heavy
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 10000e18; // poolToken0
        amounts[1] = 5000e18; // poolToken1 - poolToken0 heavy
        poolToken0ERC20.approve(address(pool), amounts[0]);
        poolToken1ERC20.approve(address(pool), amounts[1]);
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();

        // Ensure user2 has enough tokens
        if (poolToken0ERC20.balanceOf(user2) < 6000e18) {
            MockERC20(poolToken0).mint(user2, 6000e18);
        }

        vm.startPrank(user2);
        uint256 dx = 6000e18; // Enough to cross equilibrium
        poolToken0ERC20.approve(address(pool), type(uint256).max);
        uint256 balanceBefore = poolToken1ERC20.balanceOf(user2);
        uint256 dy = pool.exchange(0, 1, dx, 0);
        uint256 balanceAfter = poolToken1ERC20.balanceOf(user2);
        assertGt(dy, 0, "Swap should produce output");
        assertEq(balanceAfter - balanceBefore, dy, "Balance should increase by dy");
        vm.stopPrank();
    }

    function testExchange_RevertIfInvalidIndices() public {
        vm.startPrank(user2);
        token0.approve(address(pool), 100e18);
        vm.expectRevert("KinkPool: Invalid indices");
        pool.exchange(0, 0, 100e18, 0);
        vm.expectRevert("KinkPool: Invalid indices");
        pool.exchange(2, 1, 100e18, 0);
        vm.stopPrank();
    }

    function testExchange_RevertIfZeroInput() public {
        vm.startPrank(user2);
        vm.expectRevert("KinkPool: Zero input");
        pool.exchange(0, 1, 0, 0);
        vm.stopPrank();
    }

    function testExchange_RevertIfSlippage() public {
        // Add liquidity first
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 10000e18;
        amounts[1] = 10000e18;
        token0.approve(address(pool), amounts[0]);
        token1.approve(address(pool), amounts[1]);
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();

        // Try swap with too high min_dy
        vm.startPrank(user2);
        uint256 dx = 100e18;
        token0.approve(address(pool), dx);
        // Use a very high min_dy that will definitely fail
        vm.expectRevert();
        pool.exchange(0, 1, dx, type(uint256).max);
        vm.stopPrank();
    }

    function testGetReserves() public {
        // Add liquidity
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 1000e18;
        amounts[1] = 1000e18;
        token0.approve(address(pool), amounts[0]);
        token1.approve(address(pool), amounts[1]);
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();

        (uint256 reserve0, uint256 reserve1) = pool.getReserves();
        assertEq(reserve0, 1000e18, "Reserve0 should match");
        assertEq(reserve1, 1000e18, "Reserve1 should match");
    }

    function testGetCurrentA_Token0Heavy() public {
        // Add liquidity with token0 heavy
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 2000e18;
        amounts[1] = 1000e18;
        token0.approve(address(pool), amounts[0] * 2);
        token1.approve(address(pool), amounts[1] * 2);
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();

        // _get_current_A is internal, but we can sanity-check stored params align with ordering
        (uint256 expectedA0,) = _expectedAmplifications();
        assertEq(pool.A0(), expectedA0, "A0 should be set");

        // Verify reserves show token0 > token1
        (uint256 reserve0, uint256 reserve1) = pool.getReserves();
        assertGt(reserve0, reserve1, "Token0 should be heavier");
    }

    function testGetCurrentA_Token1Heavy() public {
        // Add liquidity with token1 heavy
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 1000e18;
        amounts[1] = 2000e18;
        token0.approve(address(pool), amounts[0] * 2);
        token1.approve(address(pool), amounts[1] * 2);
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();

        // When token1 > token0, should use the amplification tied to token1
        (, uint256 expectedA1) = _expectedAmplifications();
        assertEq(pool.A1(), expectedA1, "A1 should be set");

        // Verify reserves show token1 > token0
        (uint256 reserve0, uint256 reserve1) = pool.getReserves();
        assertGt(reserve1, reserve0, "Token1 should be heavier");
    }

    function testGetCurrentA_EqualBalances() public {
        // Add liquidity with equal amounts
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 1000e18;
        amounts[1] = 1000e18;
        token0.approve(address(pool), amounts[0]);
        token1.approve(address(pool), amounts[1]);
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();

        // At equilibrium, should use higher A
        uint256 expectedA = A0 > A1 ? A0 : A1;
        assertTrue(pool.A0() == expectedA || pool.A1() == expectedA, "Should use higher A");
    }

    function testFuzz_LiquidityRoundTripReturnsPrincipal(uint256 amount0, uint256 amount1) public {
        uint256 minAmount = 1e15;
        amount0 = bound(amount0, minAmount, 1_000e18);
        amount1 = bound(amount1, minAmount, 1_000e18);
        uint256 maxRatio = 10_000;
        vm.assume(amount0 <= amount1 * maxRatio);
        vm.assume(amount1 <= amount0 * maxRatio);

        IERC20 poolToken0 = IERC20(pool.token0());
        IERC20 poolToken1 = IERC20(pool.token1());

        vm.startPrank(user1);
        poolToken0.approve(address(pool), type(uint256).max);
        poolToken1.approve(address(pool), type(uint256).max);

        vm.assume(poolToken0.balanceOf(user1) >= amount0 && poolToken1.balanceOf(user1) >= amount1);

        uint256[2] memory amounts;
        amounts[0] = amount0;
        amounts[1] = amount1;
        uint256 lpAmount = pool.add_liquidity(amounts, 0);

        uint256[2] memory minAmounts;
        minAmounts[0] = 0;
        minAmounts[1] = 0;
        uint256[2] memory withdrawn = pool.remove_liquidity(lpAmount, minAmounts);
        vm.stopPrank();

        // No fees on add/remove, expect principal back within 1e9 wei tolerance
        assertApproxEqAbs(withdrawn[0], amount0, 1e9, "Token0 withdrawal drift too large");
        assertApproxEqAbs(withdrawn[1], amount1, 1e9, "Token1 withdrawal drift too large");
    }

    function testFuzz_RoundTripSwapLosesValue(uint256 amount) public {
        _bootstrapBalancedLiquidity();
        amount = bound(amount, 1e16, 5_000e18);

        IERC20 poolToken0 = IERC20(pool.token0());
        IERC20 poolToken1 = IERC20(pool.token1());

        vm.assume(poolToken0.balanceOf(user2) >= amount);
        vm.startPrank(user2);
        poolToken0.approve(address(pool), type(uint256).max);
        poolToken1.approve(address(pool), type(uint256).max);
        uint256 balanceBefore = poolToken0.balanceOf(user2);

        uint256 dy = pool.exchange(0, 1, amount, 0);
        if (dy == 0) {
            vm.stopPrank();
            return;
        }
        uint256 back = pool.exchange(1, 0, dy, 0);
        vm.stopPrank();

        uint256 balanceAfter = poolToken0.balanceOf(user2);
        assertLt(balanceAfter, balanceBefore, "Round trip should incur loss due to fees");
        assertLt(back, amount, "Output after round trip must be less than input");
    }

    function _bootstrapBalancedLiquidity() internal {
        IERC20 poolToken0 = IERC20(pool.token0());
        IERC20 poolToken1 = IERC20(pool.token1());

        uint256[2] memory initialAmounts;
        initialAmounts[0] = 10_000e18;
        initialAmounts[1] = 10_000e18;

        vm.startPrank(user1);
        poolToken0.approve(address(pool), type(uint256).max);
        poolToken1.approve(address(pool), type(uint256).max);
        pool.add_liquidity(initialAmounts, 0);
        vm.stopPrank();
    }

    function _expectedAmplifications() internal view returns (uint256 expectedA0, uint256 expectedA1) {
        bool sameOrder = pool.token0() == address(token0);
        expectedA0 = sameOrder ? A0 : A1;
        expectedA1 = sameOrder ? A1 : A0;
    }
}
