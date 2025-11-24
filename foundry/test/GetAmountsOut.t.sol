// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/KinkRouter.sol";
import "../src/KinkPool.sol";
import "../src/KinkFactory.sol";
import "../src/PoolRegistry.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockToken is ERC20 {
    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }
}

contract GetAmountsOutTest is Test {
    KinkFactory factory;
    PoolRegistry registry;
    KinkRouter router;
    address poolAddress;
    KinkPool pool;
    MockToken t0;
    MockToken t1;

    function setUp() public {
        registry = new PoolRegistry(address(this), address(0));
        factory = new KinkFactory(address(registry));
        registry.setFactory(address(factory));
        router = new KinkRouter(address(factory));
        t0 = new MockToken("T0", "T0", 18);
        t1 = new MockToken("T1", "T1", 18);

        // Ensure strict ordering
        if (address(t0) > address(t1)) {
            (t0, t1) = (t1, t0);
        }

        poolAddress = factory.createPool(
            address(t0),
            address(t1),
            100, // A0
            10,  // A1
            100, // baseFee (1%)
            500, // kinkingFee (5%)
            1e18, // softPeg
            1e18
        );
        pool = KinkPool(poolAddress);

        t0.mint(address(this), 100000 ether);
        t1.mint(address(this), 100000 ether);
        t0.approve(poolAddress, 100000 ether);
        t1.approve(poolAddress, 100000 ether);
        t0.approve(address(router), 100000 ether);
        t1.approve(address(router), 100000 ether);

        // Add imbalanced liquidity to create a converging scenario
        // xp0 < xp1
        uint256[2] memory amounts;
        amounts[0] = 10000 ether;
        amounts[1] = 20000 ether;
        pool.add_liquidity(amounts, 0);
    }

    function test_getAmountsOut_discrepancy() public {
        // We are in a state where t0 (10k) < t1 (20k).
        // Swapping t0 -> t1 should be "converging".
        // Gap to equilibrium (approx 15k) is ~5k.
        // If we swap 10k t0, we should cross equilibrium.

        uint256 dx = 8000 ether; // Enough to cross 15k midpoint from 10k? (10+8 = 18 > 15)

        // Get quote
        uint256 quotedDy = router.getAmountsOut(poolAddress, 0, 1, dx);

        // Do swap
        uint256 actualDy = router.swap(poolAddress, 0, 1, dx, 0);

        console.log("Quoted Dy:", quotedDy);
        console.log("Actual Dy:", actualDy);

        // If quote is significantly different from actual, we have a bug
        assertApproxEqRel(quotedDy, actualDy, 0.0001e18); // 0.01% tolerance
    }
}

