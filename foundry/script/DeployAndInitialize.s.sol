// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/KinkFactory.sol";
import "../src/KinkRouter.sol";
import "../src/KinkPool.sol";
import "../src/mocks/MockERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployAndInitialize
 * @notice Deploys Kink DEX contracts and creates the alUSD/USDe pool with specified parameters
 * @dev Requires PRIVATE_KEY and OPTIMISM_RPC_URL in .env
 *
 * Pool Parameters:
 * - A0: 120 (when alUSD > USDe, i.e., token1 > token0)
 * - A1: 500 (when USDe > alUSD, i.e., token0 > token1)
 * - Base Fee: 0.02% (2 basis points)
 * - Kinking Fee: 0.16% (16 basis points)
 */
contract DeployAndInitialize is Script {

    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("\n=== Kink DEX Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Network: Optimism Mainnet");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Factory
        console.log("\n[1/3] Deploying KinkFactory...");
        KinkFactory factory = new KinkFactory();
        console.log("[OK] KinkFactory deployed at:", address(factory));

        // 2. Deploy Router
        console.log("\n[2/3] Deploying KinkRouter...");
        KinkRouter router = new KinkRouter(address(factory));
        console.log("[OK] KinkRouter deployed at:", address(router));

        // 3. Deploy mock tokens (DEFI & CEFI) for this environment
        console.log("\n[3/4] Deploying mock tokens...");
        MockERC20 defi = new MockERC20("DeFi Mock Dollar", "DEFI");
        MockERC20 cefi = new MockERC20("CeFi Mock Dollar", "CEFI");
        address DEFI = address(defi);
        address CEFI = address(cefi);
        console.log("[OK] DEFI deployed at:", DEFI);
        console.log("[OK] CEFI deployed at:", CEFI);

        // 4. Create DEFI/CEFI pool
        console.log("\n[4/4] Creating DEFI/CEFI pool...");
        console.log("Token A (DEFI):", DEFI);
        console.log("Token B (CEFI):", CEFI);

        // Note: Factory sorts tokens; keep same amplification logic as original
        uint256 A0 = 120;  // Will become A1Param (for when alUSD > USDe, i.e., token1 > token0)
        uint256 A1 = 500;  // Will become A0Param (for when USDe > alUSD, i.e., token0 > token1)
        uint256 baseFee = 2;      // 0.02% = 2 basis points
        uint256 kinkingFee = 16;  // 0.16% = 16 basis points

        console.log("Pool Parameters:");
        console.log("  A0 (DEFI > CEFI):", A0);
        console.log("  A1 (CEFI > DEFI):", A1);
        console.log("  Base Fee:", baseFee, "bp (0.02%)");
        console.log("  Kinking Fee:", kinkingFee, "bp (0.16%)");

        address pool = factory.createPool(DEFI, CEFI, A0, A1, baseFee, kinkingFee);
        console.log("[OK] Pool created at:", pool);

        // Verify pool initialization
        KinkPool poolContract = KinkPool(pool);
        address token0 = poolContract.token0();
        address token1 = poolContract.token1();
        uint256 poolA0 = poolContract.A0();
        uint256 poolA1 = poolContract.A1();
        uint256 poolBaseFee = poolContract.baseFee();
        uint256 poolKinkingFee = poolContract.kinkingFee();

        console.log("\n=== Pool Verification ===");
        bool token0IsDEFI = token0 == DEFI;
        bool token0IsCEFI = token0 == CEFI;
        console.log("Token0:", token0, token0IsDEFI ? "(DEFI)" : token0IsCEFI ? "(CEFI)" : "(UNKNOWN)");
        console.log("Token1:", token1, token1 == DEFI ? "(DEFI)" : token1 == CEFI ? "(CEFI)" : "(UNKNOWN)");
        console.log("A0 (token0 > token1):", poolA0);
        console.log("A1 (token1 > token0):", poolA1);
        console.log("Base Fee:", poolBaseFee);
        console.log("Kinking Fee:", poolKinkingFee);

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("FACTORY_ADDRESS=", vm.toString(address(factory)));
        console.log("ROUTER_ADDRESS=", vm.toString(address(router)));
        console.log("POOL_ADDRESS=", vm.toString(pool));
        console.log("\n=== Frontend Configuration ===");
        console.log("Add these to your .env.local or environment variables:");
        console.log("NEXT_PUBLIC_FACTORY_ADDRESS=", vm.toString(address(factory)));
        console.log("NEXT_PUBLIC_ROUTER_ADDRESS=", vm.toString(address(router)));
        console.log("NEXT_PUBLIC_POOL_ADDRESS=", vm.toString(pool));
        console.log("NEXT_PUBLIC_DEFI_TOKEN_ADDRESS=", vm.toString(DEFI));
        console.log("NEXT_PUBLIC_CEFI_TOKEN_ADDRESS=", vm.toString(CEFI));
    }
}

