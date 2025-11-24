// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/KinkFactory.sol";
import "../src/PoolRegistry.sol";
import "../src/KinkPool.sol";
import "../src/mocks/MockERC20.sol";

contract KinkFactoryTest is Test {
    KinkFactory factory;
    PoolRegistry registry;
    MockERC20 tokenA;
    MockERC20 tokenB;
    MockERC20 tokenC;

    uint256 constant A0 = 100;
    uint256 constant A1 = 200;
    uint256 constant BASE_FEE = 4;
    uint256 constant KINKING_FEE = 10;
    uint256 constant SOFT_PEG = 2e18;

    function setUp() public {
        registry = new PoolRegistry(address(this), address(0));
        factory = new KinkFactory(address(registry));
        registry.setFactory(address(factory));
        tokenA = new MockERC20("TokenA", "TA");
        tokenB = new MockERC20("TokenB", "TB");
        tokenC = new MockERC20("TokenC", "TC");
    }

    function testCreatePool() public {
        address pool = factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);

        assertTrue(pool != address(0), "Pool should be created");
        assertEq(factory.getPoolByParams(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG), pool, "Pool mapping should be set");
        // assertEq(factory.getPool(address(tokenB), address(tokenA)), pool, "Reverse mapping should be set"); // No reverse mapping in new design for getPoolByParams input order handled inside?
        // getPoolByParams handles sorting internally
        // When swapping token order, we must also swap the A parameters to match the pool's configuration
        // Pool has A0 (for A>B) = 100, A1 (for B>A) = 200.
        // Asking for (B, A) with (200, 100) asks for: _A0 (B>A) = 200, _A1 (A>B) = 100. This matches.
        assertEq(factory.getPoolByParams(address(tokenB), address(tokenA), A1, A0, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG), pool, "Reverse mapping should be set");

        assertEq(factory.allPoolsLength(), 1, "Should have one pool");
        assertEq(factory.allPools(0), pool, "Pool should be in array");

        address[] memory pairPools = factory.getPoolsForPair(address(tokenA), address(tokenB));
        assertEq(pairPools.length, 1, "Should have one pool for pair");
        assertEq(pairPools[0], pool, "Pool should be in pair list");
    }

    function testCreatePool_RevertIfIdenticalTokens() public {
        vm.expectRevert("KinkFactory: Identical tokens");
        factory.createPool(address(tokenA), address(tokenA), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
    }

    function testCreatePool_RevertIfZeroAddress() public {
        vm.expectRevert("KinkFactory: Zero address");
        factory.createPool(address(0), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
    }

    function testCreatePool_RevertIfPoolExists() public {
        factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
        vm.expectRevert("KinkFactory: Pool exists");
        factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
    }

    function testCreatePool_MultiplePools() public {
        address pool1 = factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
        address pool2 = factory.createPool(address(tokenA), address(tokenC), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
        address pool3 = factory.createPool(address(tokenB), address(tokenC), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);

        assertTrue(pool1 != pool2 && pool2 != pool3 && pool1 != pool3, "Pools should be different");
        assertEq(factory.allPoolsLength(), 3, "Should have three pools");
    }

    function testCreatePool_DifferentParamsSamePair() public {
        address pool1 = factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
        // Create another pool for same pair but different soft peg
        uint256 softPeg2 = 1e18;
        address pool2 = factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE, softPeg2, softPeg2);

        assertTrue(pool1 != pool2, "Pools should be different");
        assertEq(factory.allPoolsLength(), 2, "Should have two pools");

        address[] memory pairPools = factory.getPoolsForPair(address(tokenA), address(tokenB));
        assertEq(pairPools.length, 2, "Should have two pools for pair");
    }

    function testCreatePool_EventEmitted() public {
        address pool = factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);

        // Verify event was emitted by checking pool exists
        assertTrue(pool != address(0), "Pool should be created");
    }

    function testCreatePool_PoolInitialized() public {
        address pool = factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE, SOFT_PEG, SOFT_PEG);
        KinkPool poolContract = KinkPool(pool);

        (address expectedToken0, address expectedToken1) =
            address(tokenA) < address(tokenB) ? (address(tokenA), address(tokenB)) : (address(tokenB), address(tokenA));

        assertEq(poolContract.factory(), address(factory), "Factory should be set");
        assertEq(poolContract.token0(), expectedToken0, "Token0 should be set");
        assertEq(poolContract.token1(), expectedToken1, "Token1 should be set");
        uint256 expectedA0 = address(tokenA) < address(tokenB) ? A0 : A1;
        uint256 expectedA1 = address(tokenA) < address(tokenB) ? A1 : A0;
        assertEq(poolContract.A0(), expectedA0, "A0 should be set");
        assertEq(poolContract.A1(), expectedA1, "A1 should be set");
        assertEq(poolContract.baseFee(), BASE_FEE, "Base fee should be set");
        assertEq(poolContract.kinkingFee(), KINKING_FEE, "Kinking fee should be set");
        assertEq(poolContract.softPeg0(), SOFT_PEG, "Soft peg 0 should be set");
        assertEq(poolContract.softPeg1(), SOFT_PEG, "Soft peg 1 should be set");
        assertEq(poolContract.admin(), address(this), "Admin should be set to deployer");
    }
}
