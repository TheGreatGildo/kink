// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/KinkFactory.sol";
import "../src/KinkPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CreatePoolIfNeeded
 * @notice Creates the alUSD/USDe pool and adds initial liquidity
 * @dev Requires PRIVATE_KEY, OPTIMISM_RPC_URL, and FACTORY_ADDRESS in .env
 */
contract CreatePoolIfNeeded is Script {
    // Token addresses
    address constant ALUSD = 0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A; // alUSD
    address constant USDE = 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34; // USDe

    // Expected pool address (if already exists)
    address constant EXPECTED_POOL = 0x721199250a4d16C713D4A6D8388Bc89000aCb7b9;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        // Factory address from deployment
        address factoryAddress = 0x567e890879750538cf84CB38dd18d8dBed907565;
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        KinkFactory factory = KinkFactory(factoryAddress);

        console.log("\n=== Pool Creation Script ===");
        console.log("Factory Address:", factoryAddress);
        console.log("Deployer Address:", deployer);
        console.log("Token A (alUSD):", ALUSD);
        console.log("Token B (USDe):", USDE);

        // Check if pool already exists
        address existingPool = factory.getPool(ALUSD, USDE);
        if (existingPool != address(0)) {
            console.log("\n[INFO] Pool already exists at:", existingPool);

            // Check if it's initialized
            KinkPool pool = KinkPool(existingPool);
            try pool.token0() returns (address token0) {
                console.log("[OK] Pool is initialized");
                console.log("Token0:", token0);
                console.log("Token1:", pool.token1());

                // Check if it has liquidity
                uint256 totalSupply = pool.totalSupply();
                (uint256 reserve0, uint256 reserve1) = pool.getReserves();

                console.log("\n=== Pool State ===");
                console.log("Total Supply:", totalSupply);
                console.log("Reserve0:", reserve0);
                console.log("Reserve1:", reserve1);

                if (totalSupply == 0) {
                    console.log("\n[INFO] Pool is empty - adding initial liquidity...");

                    // Check balances first
                    uint256 usdeBalance = IERC20(USDE).balanceOf(deployer);
                    uint256 alusdBalance = IERC20(ALUSD).balanceOf(deployer);

                    console.log("Deployer USDe balance:", usdeBalance);
                    console.log("Deployer alUSD balance:", alusdBalance);

                    // Use 90% of available balance to leave some for gas
                    uint256[2] memory amounts;
                    amounts[0] = (usdeBalance * 90) / 100;  // 90% of USDe
                    amounts[1] = (alusdBalance * 90) / 100;  // 90% of alUSD

                    console.log("Using USDe amount:", amounts[0]);
                    console.log("Using alUSD amount:", amounts[1]);

                    // Approve tokens
                    console.log("Approving tokens...");
                    IERC20(USDE).approve(existingPool, type(uint256).max);
                    IERC20(ALUSD).approve(existingPool, type(uint256).max);

                    // Add liquidity
                    console.log("Adding liquidity...");
                    uint256 lpAmount = pool.add_liquidity(amounts, 0);
                    console.log("[SUCCESS] Liquidity added!");
                    console.log("LP tokens minted:", lpAmount);

                    // Verify final state
                    uint256 finalSupply = pool.totalSupply();
                    (uint256 finalReserve0, uint256 finalReserve1) = pool.getReserves();
                    console.log("\n=== Final Pool State ===");
                    console.log("Total Supply:", finalSupply);
                    console.log("Reserve0:", finalReserve0);
                    console.log("Reserve1:", finalReserve1);
                } else {
                    console.log("[OK] Pool already has liquidity");
                }
            } catch {
                console.log("[ERROR] Pool exists but is NOT initialized!");
                console.log("This should not happen - pool should be initialized by factory");
            }
        } else {
            console.log("\n[INFO] Pool does not exist - creating new pool...");

            // Create pool with parameters from config
            uint256 A0 = 500;  // When USDe > alUSD
            uint256 A1 = 120;  // When alUSD > USDe
            uint256 baseFee = 2;  // 0.02% = 2 basis points
            uint256 kinkingFee = 16;  // 0.16% = 16 basis points

            console.log("Pool parameters:");
            console.log("  A0:", A0);
            console.log("  A1:", A1);
            console.log("  Base Fee:", baseFee, "bp");
            console.log("  Kinking Fee:", kinkingFee, "bp");

            address newPool = factory.createPool(ALUSD, USDE, A0, A1, baseFee, kinkingFee);
            console.log("[SUCCESS] Pool created at:", newPool);

            // Add initial liquidity
            console.log("\n[INFO] Adding initial liquidity...");
            KinkPool pool = KinkPool(newPool);

            uint256[2] memory amounts;
            amounts[0] = 1000e18;  // 1000 USDe (token0)
            amounts[1] = 1000e18;  // 1000 alUSD (token1)

            // Check balances
            uint256 usdeBalance = IERC20(USDE).balanceOf(deployer);
            uint256 alusdBalance = IERC20(ALUSD).balanceOf(deployer);

            console.log("Deployer USDe balance:", usdeBalance);
            console.log("Deployer alUSD balance:", alusdBalance);

            if (usdeBalance < amounts[0] || alusdBalance < amounts[1]) {
                console.log("[ERROR] Insufficient token balances");
                console.log("Need USDe:", amounts[0], "Have:", usdeBalance);
                console.log("Need alUSD:", amounts[1], "Have:", alusdBalance);
                vm.stopBroadcast();
                return;
            }

            // Approve tokens
            console.log("Approving tokens...");
            IERC20(USDE).approve(newPool, type(uint256).max);
            IERC20(ALUSD).approve(newPool, type(uint256).max);

            // Add liquidity
            console.log("Adding liquidity...");
            uint256 lpAmount = pool.add_liquidity(amounts, 0);
            console.log("[SUCCESS] Liquidity added!");
            console.log("LP tokens minted:", lpAmount);

            console.log("\n=== Final Pool State ===");
            console.log("Pool Address:", newPool);
            console.log("Total Supply:", pool.totalSupply());
            (uint256 r0, uint256 r1) = pool.getReserves();
            console.log("Reserve0:", r0);
            console.log("Reserve1:", r1);
        }

        vm.stopBroadcast();
    }
}

