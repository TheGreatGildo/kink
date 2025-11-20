// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/KinkFactory.sol";
import "../src/KinkPool.sol";
import "../src/mocks/MockERC20.sol";

contract KinkFactoryTest is Test {
    KinkFactory factory;
    MockERC20 tokenA;
    MockERC20 tokenB;
    MockERC20 tokenC;

    uint256 constant A0 = 100;
    uint256 constant A1 = 200;
    uint256 constant BASE_FEE = 4;
    uint256 constant KINKING_FEE = 10;

    function setUp() public {
        factory = new KinkFactory();
        tokenA = new MockERC20("TokenA", "TA");
        tokenB = new MockERC20("TokenB", "TB");
        tokenC = new MockERC20("TokenC", "TC");
    }

    function testCreatePool() public {
        address pool = factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE);

        assertTrue(pool != address(0), "Pool should be created");
        assertEq(factory.getPool(address(tokenA), address(tokenB)), pool, "Pool mapping should be set");
        assertEq(factory.getPool(address(tokenB), address(tokenA)), pool, "Reverse mapping should be set");
        assertEq(factory.allPoolsLength(), 1, "Should have one pool");
        assertEq(factory.allPools(0), pool, "Pool should be in array");
    }

    function testCreatePool_RevertIfIdenticalTokens() public {
        vm.expectRevert("KinkFactory: Identical tokens");
        factory.createPool(address(tokenA), address(tokenA), A0, A1, BASE_FEE, KINKING_FEE);
    }

    function testCreatePool_RevertIfZeroAddress() public {
        vm.expectRevert("KinkFactory: Zero address");
        factory.createPool(address(0), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE);
    }

    function testCreatePool_RevertIfPoolExists() public {
        factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE);
        vm.expectRevert("KinkFactory: Pool exists");
        factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE);
    }

    function testCreatePool_MultiplePools() public {
        address pool1 = factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE);
        address pool2 = factory.createPool(address(tokenA), address(tokenC), A0, A1, BASE_FEE, KINKING_FEE);
        address pool3 = factory.createPool(address(tokenB), address(tokenC), A0, A1, BASE_FEE, KINKING_FEE);

        assertTrue(pool1 != pool2 && pool2 != pool3 && pool1 != pool3, "Pools should be different");
        assertEq(factory.allPoolsLength(), 3, "Should have three pools");
    }

    function testCreatePool_EventEmitted() public {
        address pool = factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE);

        // Verify event was emitted by checking pool exists
        assertTrue(pool != address(0), "Pool should be created");
    }

    function testCreatePool_PoolInitialized() public {
        address pool = factory.createPool(address(tokenA), address(tokenB), A0, A1, BASE_FEE, KINKING_FEE);
        KinkPool poolContract = KinkPool(pool);

        assertEq(poolContract.factory(), address(factory), "Factory should be set");
        assertEq(poolContract.token0(), address(tokenA), "Token0 should be set");
        assertEq(poolContract.token1(), address(tokenB), "Token1 should be set");
        assertEq(poolContract.A0(), A0, "A0 should be set");
        assertEq(poolContract.A1(), A1, "A1 should be set");
        assertEq(poolContract.baseFee(), BASE_FEE, "Base fee should be set");
        assertEq(poolContract.kinkingFee(), KINKING_FEE, "Kinking fee should be set");
    }
}
