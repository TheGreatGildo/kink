// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/KinkFactory.sol";
import "../src/KinkRouter.sol";

/**
 * @title DeployOptimism
 * @notice Deploys Kink DEX contracts to Optimism mainnet
 * @dev Requires PRIVATE_KEY and OPTIMISM_RPC_URL in .env
 */
contract DeployOptimism is Script {
    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory rpcUrl = vm.envString("OPTIMISM_RPC_URL");

        // Set up Optimism fork for verification
        vm.createSelectFork(rpcUrl);

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy Factory (implementation deployed internally)
        console.log("Deploying KinkFactory...");
        KinkFactory factory = new KinkFactory();
        console.log("KinkFactory deployed at:", address(factory));

        // Deploy Router
        console.log("Deploying KinkRouter...");
        KinkRouter router = new KinkRouter(address(factory));
        console.log("KinkRouter deployed at:", address(router));

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary ===");
        console.log("FACTORY_ADDRESS=", vm.toString(address(factory)));
        console.log("ROUTER_ADDRESS=", vm.toString(address(router)));
        console.log("Chain: Optimism Mainnet (10)");
    }
}

