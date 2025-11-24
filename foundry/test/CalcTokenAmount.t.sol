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

contract CalcTokenAmountTest is Test {
    KinkFactory factory;
    PoolRegistry registry;
    address poolAddress;
    KinkPool pool;
    MockToken t0;
    MockToken t1;

    function setUp() public {
        registry = new PoolRegistry(address(this), address(0));
        factory = new KinkFactory(address(registry));
        registry.setFactory(address(factory));
        t0 = new MockToken("T0", "T0", 18);
        t1 = new MockToken("T1", "T1", 18);

        if (address(t0) > address(t1)) {
            (t0, t1) = (t1, t0);
        }

        poolAddress = factory.createPool(
            address(t0),
            address(t1),
            100, // A0
            10,  // A1
            100, // baseFee
            500, // kinkingFee
            1e18, // softPeg
            1e18
        );
        pool = KinkPool(poolAddress);

        t0.mint(address(this), 10000 ether);
        t1.mint(address(this), 10000 ether);
        t0.approve(poolAddress, 10000 ether);
        t1.approve(poolAddress, 10000 ether);

        uint256[2] memory amounts;
        amounts[0] = 1000 ether;
        amounts[1] = 1000 ether;
        pool.add_liquidity(amounts, 0);
    }

    function test_calcTokenAmount_withdrawal_reverts() public {
        uint256[2] memory amounts;
        amounts[0] = 100 ether;
        amounts[1] = 100 ether;

        // Should return a deterministic value (no revert) for withdrawal path
        uint256 lpAmount = pool.calc_token_amount(amounts, false);
        assertGt(lpAmount, 0, "calc_token_amount should return withdrawal amount");
    }
}

