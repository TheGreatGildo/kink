// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./KinkPool.sol";
import "./PoolRegistry.sol";
import "./libraries/CurveMath.sol";

/**
 * @title KinkRouter
 * @notice Router contract for simplified swap interactions
 */
contract KinkRouter {
    using SafeERC20 for IERC20;

    uint256 private constant N_COINS = 2;
    PoolRegistry public immutable registry;

    constructor(address _registry) {
        registry = PoolRegistry(_registry);
    }

    /**
     * @notice Get the expected output amount for a swap
     * @param pool Address of the pool
     * @param i Index of input token
     * @param j Index of output token
     * @param dx Input amount
     * @return dy Expected output amount
     */
    function getAmountsOut(address pool, uint256 i, uint256 j, uint256 dx) external view returns (uint256 dy) {
        // Use the pool's logic directly as the single source of truth
        return KinkPool(pool).get_dy(i, j, dx);
    }

    /**
     * @notice Execute a swap through a pool
     * @param pool Address of the pool
     * @param i Index of input token
     * @param j Index of output token
     * @param dx Input amount
     * @param min_dy Minimum output amount
     * @return dy Output amount
     */
    function swap(address pool, uint256 i, uint256 j, uint256 dx, uint256 min_dy) external returns (uint256 dy) {
        // Verify pool validity by checking the Factory registry directly
        require(registry.isPool(pool), "KinkRouter: Invalid pool");

        KinkPool poolContract = KinkPool(pool);
        address token0 = poolContract.token0();
        address token1 = poolContract.token1();

        IERC20 inputToken = i == 0 ? IERC20(token0) : IERC20(token1);
        IERC20 outputToken = j == 0 ? IERC20(token0) : IERC20(token1);

        // Transfer from user to router first, then approve pool
        inputToken.safeTransferFrom(msg.sender, address(this), dx);
        SafeERC20.forceApprove(inputToken, pool, dx);

        uint256 outputBalanceBefore = outputToken.balanceOf(address(this));

        // Pool's exchange will transfer from router (as msg.sender) to pool
        poolContract.exchange(i, j, dx, min_dy);

        uint256 outputBalanceAfter = outputToken.balanceOf(address(this));
        dy = outputBalanceAfter - outputBalanceBefore;
        require(dy >= min_dy, "KinkRouter: Insufficient output");

        outputToken.safeTransfer(msg.sender, dy);

        // Reset approval
        SafeERC20.forceApprove(inputToken, pool, 0);
    }
}
