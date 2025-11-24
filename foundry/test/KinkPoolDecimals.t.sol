// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/KinkPool.sol";
import "../src/KinkFactory.sol";
import "../src/PoolRegistry.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken6D is ERC20 {
    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract KinkPoolDecimalsTest is Test {
    KinkPool pool;
    KinkFactory factory;
    PoolRegistry registry;
    MockToken6D usdc;
    MockToken6D usdt;
    address user1 = address(0x1);
    address user2 = address(0x2);

    uint256 constant A0 = 100;
    uint256 constant A1 = 200;
    uint256 constant BASE_FEE = 4; // 0.04%
    uint256 constant KINKING_FEE = 10; // 0.1%
    uint256 constant SOFT_PEG = 1e18; // 1.0 in 18 decimals

    function setUp() public {
        usdc = new MockToken6D("USDC", "USDC");
        usdt = new MockToken6D("USDT", "USDT");

        registry = new PoolRegistry(address(this), address(0));
        factory = new KinkFactory(address(registry));
        registry.setFactory(address(factory));
        address poolAddress = factory.createPool(
            address(usdc),
            address(usdt),
            A0,
            A1,
            BASE_FEE,
            KINKING_FEE,
            SOFT_PEG,
            SOFT_PEG
        );
        pool = KinkPool(poolAddress);

        // Mint tokens (using 6 decimals)
        // 100,000 USDC/USDT
        usdc.mint(user1, 100_000 * 1e6);
        usdt.mint(user1, 100_000 * 1e6);
        usdc.mint(user2, 100_000 * 1e6);
        usdt.mint(user2, 100_000 * 1e6);
    }

    function testDecimalsConfiguration() public {
        assertEq(pool.token0Decimals(), 6);
        assertEq(pool.token1Decimals(), 6);
    }

    function testAddLiquidityAndNormalization() public {
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 1000 * 1e6; // 1000 USDC
        amounts[1] = 1000 * 1e6; // 1000 USDT

        usdc.approve(address(pool), amounts[0]);
        usdt.approve(address(pool), amounts[1]); // Using approve on MockToken6D which inherits ERC20

        // Note: Factory sorts tokens. We need to know which is which to approve correct one if they differed.
        // Since both are 6 decimals and we approve both, it's fine.
        // Check actual tokens
        if (pool.token0() == address(usdc)) {
             usdc.approve(address(pool), amounts[0]);
             usdt.approve(address(pool), amounts[1]);
        } else {
             usdt.approve(address(pool), amounts[0]);
             usdc.approve(address(pool), amounts[1]);
        }

        pool.add_liquidity(amounts, 0);
        vm.stopPrank();

        // Verify normalized reserves are in 18 decimals (approx 1000 * 1e18)
        uint256[2] memory xp = pool.getNormalizedReserves();

        assertApproxEqAbs(xp[0], 1000 * 1e18, 1e6); // Tolerance for potential dust
        assertApproxEqAbs(xp[1], 1000 * 1e18, 1e6);
    }

    function testSwapWith6Decimals() public {
        // Seed liquidity
        vm.startPrank(user1);
        uint256[2] memory amounts;
        amounts[0] = 10_000 * 1e6;
        amounts[1] = 10_000 * 1e6;
        IERC20(pool.token0()).approve(address(pool), amounts[0]);
        IERC20(pool.token1()).approve(address(pool), amounts[1]);
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();

        vm.startPrank(user2);
        // Swap 100 USDC (6 decimals)
        uint256 dx = 100 * 1e6;
        IERC20(pool.token0()).approve(address(pool), dx);

        uint256 dy = pool.exchange(0, 1, dx, 0);
        vm.stopPrank();

        // Output should be close to 100 * 1e6 (minus fees)
        // 0.04% fee = 0.04 USDC
        // Expected ~ 99.96 * 1e6
        uint256 expected = 99_960_000; // rough estimate

        // Check it is within 1% of expected (very loose, just checking order of magnitude)
        assertApproxEqRel(dy, expected, 0.01e18); // 1% tolerance

        // Explicit check for 6 decimal range
        assertTrue(dy > 90 * 1e6 && dy < 100 * 1e6, "Output should be in 6 decimal range");
    }
}

