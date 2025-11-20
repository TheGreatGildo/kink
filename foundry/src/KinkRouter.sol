// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./KinkFactory.sol";
import "./KinkPool.sol";
import "./libraries/CurveMath.sol";

/**
 * @title KinkRouter
 * @notice Router contract for simplified swap interactions
 */
contract KinkRouter {
    using SafeERC20 for IERC20;

    uint256 private constant N_COINS = 2;
    address public immutable factory;

    constructor(address _factory) {
        factory = _factory;
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
        require(i != j && i < 2 && j < 2, "KinkRouter: Invalid indices");
        require(dx > 0, "KinkRouter: Zero input");

        KinkPool poolContract = KinkPool(pool);
        address token0 = poolContract.token0();
        address token1 = poolContract.token1();
        uint8 d0 = IERC20Metadata(token0).decimals();
        uint8 d1 = IERC20Metadata(token1).decimals();
        uint256[N_COINS] memory multipliers;
        multipliers[0] = 10**(18 - d0);
        multipliers[1] = 10**(18 - d1);

        uint256[N_COINS] memory balances;
        balances[0] = IERC20(token0).balanceOf(pool);
        balances[1] = IERC20(token1).balanceOf(pool);

        uint256 inputBalance = balances[i];
        uint256 outputBalance = balances[j];

        // Check if swap crosses equilibrium
        bool crossesEquilibrium = false;
        uint256 gap = 0;
        uint256 dx1 = 0;
        uint256 dx2 = 0;

        if (i == 0 && j == 1) {
            if (inputBalance < outputBalance) {
                gap = outputBalance - inputBalance;
                if (dx > gap) {
                    crossesEquilibrium = true;
                    dx1 = gap;
                    dx2 = dx - gap;
                }
            }
        } else if (i == 1 && j == 0) {
            if (outputBalance < inputBalance) {
                gap = inputBalance - outputBalance;
                if (dx > gap) {
                    crossesEquilibrium = true;
                    dx1 = gap;
                    dx2 = dx - gap;
                }
            }
        }

        uint256 A0 = poolContract.A0();
        uint256 A1 = poolContract.A1();
        uint256 baseFee = poolContract.baseFee();
        uint256 kinkingFee = poolContract.kinkingFee();
        uint256 FEE_DENOMINATOR = 10000;

        // Normalize balances
        uint256[N_COINS] memory xp = balances;
        xp[0] *= multipliers[0];
        xp[1] *= multipliers[1];

        if (crossesEquilibrium) {
            // Split swap calculation
            uint256 currentA = balances[0] > balances[1] ? A0 : A1;
            uint256[N_COINS] memory xp1 = xp;
            uint256 dx1Normalized = dx1 * multipliers[i];
            uint256 x1 = xp1[i] + dx1Normalized;

            uint256 y1 = CurveMath.get_y(i, j, x1, xp1, currentA);
            uint256 dy1Normalized = xp1[j] - y1;

            xp1[i] = x1;
            xp1[j] = y1;

            uint256 targetA = i == 0 ? A1 : A0;
            uint256[N_COINS] memory xp2 = xp1;
            uint256 dx2Normalized = dx2 * multipliers[i];
            uint256 x2 = xp2[i] + dx2Normalized;
            uint256 y2 = CurveMath.get_y(i, j, x2, xp2, targetA);
            uint256 dy2Normalized = xp2[j] - y2;

            xp2[i] = x2;
            xp2[j] = y2;

            // Apply fee on normalized
            uint256 dy2Fee = (dy2Normalized * kinkingFee) / FEE_DENOMINATOR;
            dy2Normalized -= dy2Fee;

            dy = (dy1Normalized / multipliers[j]) + (dy2Normalized / multipliers[j]);
        } else {
            // Standard swap calculation
            uint256 currentA = balances[0] > balances[1] ? A0 : A1;
            bool converging = (i == 0 && j == 1) ? (balances[0] > balances[1]) : (balances[1] > balances[0]);
            uint256 fee = converging ? baseFee : kinkingFee;

            uint256 dxNormalized = dx * multipliers[i];
            uint256 x = xp[i] + dxNormalized;
            uint256 y = CurveMath.get_y(i, j, x, xp, currentA);
            uint256 dyNormalized = xp[j] - y;

            // Apply fee on normalized
            uint256 dyFee = (dyNormalized * fee) / FEE_DENOMINATOR;
            dyNormalized -= dyFee;

            dy = dyNormalized / multipliers[j];
        }
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
        KinkPool poolContract = KinkPool(pool);
        address token0 = poolContract.token0();
        address token1 = poolContract.token1();

        require(KinkFactory(factory).getPool(token0, token1) == pool, "KinkRouter: Unknown pool");

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
