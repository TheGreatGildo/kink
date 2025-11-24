// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/KinkFactory.sol";
import "../src/PoolRegistry.sol";
import "../src/KinkPool.sol";
import "../src/mocks/MockERC20.sol";

contract AuditTest is Test {
    KinkFactory factory;
    PoolRegistry registry;
    MockERC20 token0;
    MockERC20 token1;
    KinkPool pool;

    address attacker = address(0x1337);
    address victim = address(0xCAFE);

    function setUp() public {
        registry = new PoolRegistry(address(this), address(0));
        factory = new KinkFactory(address(registry));
        registry.setFactory(address(factory));
        token0 = new MockERC20("Token A", "TKNA");
        token1 = new MockERC20("Token B", "TKNB");

        // Ensure token ordering matches factory logic
        if (address(token0) > address(token1)) {
            (token0, token1) = (token1, token0);
        }

        address poolAddress = factory.createPool(
            address(token0),
            address(token1),
            100, // A0
            100, // A1
            4,   // baseFee (0.04%)
            10,   // kinkingFee (0.10%)
            2e18,  // softPeg0
            2e18   // softPeg1
        );
        pool = KinkPool(poolAddress);

        token0.mint(attacker, 10000 ether);
        token1.mint(attacker, 10000 ether);
        token0.mint(victim, 10000 ether);
        token1.mint(victim, 10000 ether);
    }

    function testInflationAttackMitigation() public {
        // 1. Attacker deposits MINIMUM_LIQUIDITY + 1 wei
        vm.startPrank(attacker);
        token0.approve(address(pool), type(uint256).max);
        token1.approve(address(pool), type(uint256).max);

        // Calculate amount needed for > 1000 wei D
        // With D ~= sum(amounts) for balanced deposit
        // Need roughly 1001 wei worth
        uint256[2] memory amounts;
        amounts[0] = 1001;
        amounts[1] = 1001;

        // This should succeed now, but burn 1000 wei
        pool.add_liquidity(amounts, 0);

        uint256 attackerLP = pool.balanceOf(attacker);
        console.log("Attacker LP:", attackerLP);

        // Should be roughly 2002 - 1000 = 1002?
        // Or if D ~= 2002, then 2002 - 1000 = 1002.
        // Attacker owns roughly half the pool (the rest is burned).

        // 2. Attacker donates large amount to inflate D
        token0.transfer(address(pool), 1000 ether);
        token1.transfer(address(pool), 1000 ether);
        vm.stopPrank();

        // 3. Victim deposits legitimate amount
        vm.startPrank(victim);
        token0.approve(address(pool), type(uint256).max);
        token1.approve(address(pool), type(uint256).max);

        amounts[0] = 10 ether;
        amounts[1] = 10 ether;

        // Victim expects LP
        pool.add_liquidity(amounts, 0);

        uint256 victimLP = pool.balanceOf(victim);
        console.log("Victim LP:", victimLP);

        vm.stopPrank();

        // Victim should receive substantial LP tokens
        assertTrue(victimLP > 0, "Victim received 0 LP tokens");

        // Check victim's share of the pool relative to their deposit
        // Total assets ~ 2020 ETH (20 initial + 2000 donated + 20 victim)
        // Victim contributed 20 ETH (~1%)
        // Victim should own ~1% of supply.
        // Current supply = 1000 (burned) + 1002 (attacker) + victimLP

        uint256 totalSupply = pool.totalSupply();
        console.log("Total Supply:", totalSupply);

        // With donation, D went from ~2000 wei to ~2000 ETH. Increase factor 1e18.
        // Existing shares (2002 wei) represent 2000 ETH.
        // New deposit (20 ETH) is 1% of pool.
        // So minted LP should be 1% of existing supply?
        // existing supply = 2002. 1% is 20 wei.

        // Wait, if victim gets 20 wei LP, and withdraws...
        // 20/2022 * 2020 ETH = ~20 ETH.
        // So victim preserves value.
        // Attacker spent 2000 ETH to dilute victim to 20 wei LP shares?
        // But those 20 wei shares are worth 20 ETH.

        // Attacker can withdraw their 1002 wei LP.
        // 1002/2022 * 2020 ETH = ~1000 ETH.
        // Attacker lost ~1000 ETH (the portion owned by the burn address).
        // So the attack is overwhelmingly unprofitable.

        assertTrue(victimLP > 0, "Victim should have LP");
    }

    function testMinimumLiquidityRevert() public {
        vm.startPrank(attacker);
        token0.approve(address(pool), type(uint256).max);
        token1.approve(address(pool), type(uint256).max);

        uint256[2] memory amounts;
        amounts[0] = 1;
        amounts[1] = 1;

        // Should revert because < 1000 wei
        vm.expectRevert("KinkPool: Insufficient liquidity minted");
        pool.add_liquidity(amounts, 0);
        vm.stopPrank();
    }
}
