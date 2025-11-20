// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/KinkPool.sol";
import "../src/KinkFactory.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CheckAndInitializePool
 * @notice Checks pool state and adds initial liquidity if needed
 * @dev Requires PRIVATE_KEY, OPTIMISM_RPC_URL, and POOL_ADDRESS in .env
 */
contract CheckAndInitializePool is Script {
    // Pool address from deployment
    address constant POOL_ADDRESS = 0x721199250a4d16C713D4A6D8388Bc89000aCb7b9;

    // Token addresses (from config)
    address constant USDE = 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34; // USDe (token0)
    address constant ALUSD = 0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A; // alUSD (token1)

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory rpcUrl = vm.envString("OPTIMISM_RPC_URL");
        address deployer = vm.addr(deployerPrivateKey);

        // Use --fork-url instead of createSelectFork for broadcast
        vm.startBroadcast(deployerPrivateKey);

        KinkPool pool = KinkPool(POOL_ADDRESS);

        console.log("\n=== Pool State Check ===");
        console.log("Pool Address:", POOL_ADDRESS);
        console.log("Deployer Address:", deployer);

        // Check if pool is initialized
        try pool.token0() returns (address token0) {
            console.log("[OK] Pool is initialized");
            console.log("Token0:", token0);
            console.log("Token1:", pool.token1());
            console.log("A0:", pool.A0());
            console.log("A1:", pool.A1());
            console.log("Base Fee:", pool.baseFee());
            console.log("Kinking Fee:", pool.kinkingFee());
        } catch {
            console.log("[ERROR] Pool is NOT initialized!");
            console.log("Cannot proceed - pool must be initialized via factory");
            vm.stopBroadcast();
            return;
        }

        // Check pool state
        uint256 totalSupply = pool.totalSupply();
        (uint256 reserve0, uint256 reserve1) = pool.getReserves();

        console.log("\n=== Current Pool State ===");
        console.log("Total Supply:", totalSupply);
        console.log("Reserve0 (USDe):", reserve0);
        console.log("Reserve1 (alUSD):", reserve1);

        // Check deployer's token balances
        uint256 usdeBalance = IERC20(USDE).balanceOf(deployer);
        uint256 alusdBalance = IERC20(ALUSD).balanceOf(deployer);

        console.log("\n=== Deployer Balances ===");
        console.log("USDe Balance:", usdeBalance);
        console.log("alUSD Balance:", alusdBalance);

        // Check approvals
        uint256 usdeAllowance = IERC20(USDE).allowance(deployer, POOL_ADDRESS);
        uint256 alusdAllowance = IERC20(ALUSD).allowance(deployer, POOL_ADDRESS);

        console.log("\n=== Current Approvals ===");
        console.log("USDe Allowance:", usdeAllowance);
        console.log("alUSD Allowance:", alusdAllowance);

        // If pool is empty, add initial liquidity
        if (totalSupply == 0) {
            console.log("\n=== Pool is empty - adding initial liquidity ===");

            // Use reasonable amounts for initial liquidity
            // For a stablecoin pool, we want balanced amounts
            uint256[2] memory amounts;
            amounts[0] = 1000e18;  // 1000 USDe
            amounts[1] = 1000e18;  // 1000 alUSD

            console.log("Adding liquidity:");
            console.log("  USDe (token0):", amounts[0]);
            console.log("  alUSD (token1):", amounts[1]);

            // Check if we have enough balance
            if (usdeBalance < amounts[0]) {
                console.log("[ERROR] Insufficient USDe balance. Need:", amounts[0], "Have:", usdeBalance);
                vm.stopBroadcast();
                return;
            }
            if (alusdBalance < amounts[1]) {
                console.log("[ERROR] Insufficient alUSD balance. Need:", amounts[1], "Have:", alusdBalance);
                vm.stopBroadcast();
                return;
            }

            // Approve if needed
            if (usdeAllowance < amounts[0]) {
                console.log("Approving USDe...");
                IERC20(USDE).approve(POOL_ADDRESS, type(uint256).max);
            }
            if (alusdAllowance < amounts[1]) {
                console.log("Approving alUSD...");
                IERC20(ALUSD).approve(POOL_ADDRESS, type(uint256).max);
            }

            // Add liquidity with 0 min_lp for first deposit
            console.log("Calling add_liquidity...");
            try pool.add_liquidity(amounts, 0) returns (uint256 lpAmount) {
                console.log("[SUCCESS] Liquidity added successfully!");
                console.log("LP tokens minted:", lpAmount);

                // Verify final state
                uint256 finalSupply = pool.totalSupply();
                (uint256 finalReserve0, uint256 finalReserve1) = pool.getReserves();

                console.log("\n=== Final Pool State ===");
                console.log("Total Supply:", finalSupply);
                console.log("Reserve0 (USDe):", finalReserve0);
                console.log("Reserve1 (alUSD):", finalReserve1);
            } catch Error(string memory reason) {
                console.log("[ERROR] Error adding liquidity:", reason);
            } catch (bytes memory lowLevelData) {
                console.log("[ERROR] Low-level error adding liquidity");
                console.logBytes(lowLevelData);
            }
        } else {
            console.log("\n[OK] Pool already has liquidity");
            console.log("No action needed");
        }

        vm.stopBroadcast();
    }
}

