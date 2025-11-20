// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/mocks/MockERC20.sol";

/**
 * @title DeployMockTokens
 * @notice Convenience script to deploy two mock ERC20 tokens (DEFI & CEFI) for staging environments
 */
contract DeployMockTokens is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("\n=== Mock Token Deployment ===");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        MockERC20 defi = new MockERC20("DeFi Mock Dollar", "DEFI");
        MockERC20 cefi = new MockERC20("CeFi Mock Dollar", "CEFI");

        vm.stopBroadcast();

        console.log("\n=== Deployment Summary ===");
        console.log("DEFI token address:", address(defi));
        console.log("CEFI token address:", address(cefi));

        console.log("\nAdd these to your frontend .env.local file:");
        console.log("NEXT_PUBLIC_DEFI_TOKEN_ADDRESS=", vm.toString(address(defi)));
        console.log("NEXT_PUBLIC_CEFI_TOKEN_ADDRESS=", vm.toString(address(cefi)));
    }
}


