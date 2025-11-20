// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/KinkPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TestAddLiquidity
 * @notice Tests adding liquidity to see what the actual LP output would be
 */
contract TestAddLiquidity is Script {
    address constant POOL_ADDRESS = 0x721199250a4d16C713D4A6D8388Bc89000aCb7b9;
    address constant USDE = 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34;
    address constant ALUSD = 0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A;

    function run() external view {
        KinkPool pool = KinkPool(POOL_ADDRESS);

        console.log("\n=== Pool Current State ===");
        uint256 totalSupply = pool.totalSupply();
        (uint256 reserve0, uint256 reserve1) = pool.getReserves();
        console.log("Total Supply:", totalSupply);
        console.log("Reserve0 (USDe):", reserve0);
        console.log("Reserve1 (alUSD):", reserve1);

        // Test adding 1 token of each
        uint256[2] memory amounts;
        amounts[0] = 1e18;  // 1 USDe
        amounts[1] = 1e18;  // 1 alUSD

        console.log("\n=== Testing calc_token_amount ===");
        console.log("Adding amounts:");
        console.log("  USDe:", amounts[0]);
        console.log("  alUSD:", amounts[1]);

        uint256 expectedLP = pool.calc_token_amount(amounts, true);
        console.log("Expected LP tokens:", expectedLP);

        // Calculate what minLp should be with 0.5% slippage
        uint256 minLp = (expectedLP * 9950) / 10000;
        console.log("Min LP (0.5% slippage):", minLp);

        console.log("\n=== Analysis ===");
        if (expectedLP == 0) {
            console.log("[ERROR] calc_token_amount returned 0!");
        } else if (expectedLP > amounts[0] || expectedLP > amounts[1]) {
            console.log("[WARNING] Expected LP is higher than input amounts - this seems wrong");
        } else {
            console.log("[OK] Expected LP seems reasonable");
        }
    }
}

