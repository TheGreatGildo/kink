// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/proxy/Clones.sol";
import "./KinkPool.sol";

/**
 * @title KinkFactory
 * @notice Factory for creating KinkPool instances using minimal proxy pattern
 */
contract KinkFactory {
    using Clones for address;

    /// @notice Implementation contract address
    address public immutable implementation;

    /// @notice Array of all created pools
    address[] public allPools;

    /// @notice Mapping from token pair to pool address
    mapping(address => mapping(address => address)) public getPool;

    event PoolCreated(
        address indexed token0,
        address indexed token1,
        address indexed pool,
        uint256 A0,
        uint256 A1,
        uint256 baseFee,
        uint256 kinkingFee
    );

    constructor() {
        // Deploy standalone implementation that clones can initialize
        implementation = address(new KinkPool());
    }

    /**
     * @notice Get the number of pools created
     * @return Number of pools
     */
    function allPoolsLength() external view returns (uint256) {
        return allPools.length;
    }

    /**
     * @notice Create a new pool
     * @param tokenA Address of first token
     * @param tokenB Address of second token
     * @param _A0 Amplification when tokenA > tokenB
     * @param _A1 Amplification when tokenB > tokenA
     * @param _baseFee Base fee in basis points
     * @param _kinkingFee Kinking fee in basis points
     * @return pool Address of the created pool
     */
    function createPool(address tokenA, address tokenB, uint256 _A0, uint256 _A1, uint256 _baseFee, uint256 _kinkingFee)
        external
        returns (address pool)
    {
        require(tokenA != tokenB, "KinkFactory: Identical tokens");
        require(tokenA != address(0) && tokenB != address(0), "KinkFactory: Zero address");

        // Sort tokens and align amplification parameters to the deployed ordering
        (address token0, address token1, uint256 A0Param, uint256 A1Param) =
            tokenA < tokenB ? (tokenA, tokenB, _A0, _A1) : (tokenB, tokenA, _A1, _A0);
        require(getPool[token0][token1] == address(0), "KinkFactory: Pool exists");

        // Register pool first to follow CEI
        // Note: we predict deterministic address using CREATE2 or just rely on CREATE
        // Here we use clone() which uses CREATE.
        // To strictly follow CEI with CREATE, we can't know the address before creation.
        // But we can update state after creation but BEFORE external calls.

        // Clone implementation
        pool = implementation.clone();

        // Update state variables BEFORE initializing (external call to pool)
        getPool[token0][token1] = pool;
        getPool[token1][token0] = pool; // Populate mapping in the reverse direction
        allPools.push(pool);

        // Initialize pool
        // KinkPool.initialize calls decimals() on tokens, which is an external call.
        // If tokens are malicious, they could reenter here.
        // But since getPool is already set, the check at the start of createPool will fail.
        KinkPool(pool).initialize(token0, token1, A0Param, A1Param, _baseFee, _kinkingFee);

        emit PoolCreated(token0, token1, pool, A0Param, A1Param, _baseFee, _kinkingFee);
    }
}
