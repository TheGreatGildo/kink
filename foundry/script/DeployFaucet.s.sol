// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Faucet.sol";
import "../src/mocks/MockERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployFaucet
 * @notice Deploys the Faucet contract for CEFI and DEFI tokens
 * @dev Requires PRIVATE_KEY and OPTIMISM_RPC_URL in .env
 *      Also requires CEFI_TOKEN_ADDRESS and DEFI_TOKEN_ADDRESS in .env (or will deploy mocks)
 */
contract DeployFaucet is Script {
    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("\n=== Faucet Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Network: Optimism Mainnet");

        // Note: We don't use vm.createSelectFork here to avoid requiring --fork-url
        // The deployment will go directly to Optimism via --rpc-url and --broadcast

        // Get token addresses from env (required)
        // Add these to your .env file:
        // CEFI_TOKEN_ADDRESS=0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34  (USDe on Optimism)
        // DEFI_TOKEN_ADDRESS=0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A  (alUSD on Optimism)
        // Or use your mock token addresses if you deployed them separately
        address cefiToken = vm.envAddress("CEFI_TOKEN_ADDRESS");
        address defiToken = vm.envAddress("DEFI_TOKEN_ADDRESS");

        console.log("CEFI token:", cefiToken);
        console.log("DEFI token:", defiToken);

        // Deploy Faucet
        vm.startBroadcast(deployerPrivateKey);
        console.log("\nDeploying Faucet...");
        Faucet faucet = new Faucet(cefiToken, defiToken);
        console.log("Faucet deployed at:", address(faucet));

        // Note: By default, tokens are set as non-mintable
        // If your tokens are mintable (like MockERC20), you can:
        // 1. Call faucet.setMintability(true, true) to enable minting
        // 2. Then mint tokens directly to the faucet address
        //
        // If tokens are NOT mintable, you can:
        // 1. Transfer tokens to the faucet address
        // 2. Or call faucet.depositTokens(tokenAddress, amount)

        console.log("\n=== Next Steps ===");
        console.log("1. If tokens are mintable, set mintability:");
        console.log("   faucet.setMintability(true, true)");
        console.log("2. Mint tokens to faucet (if mintable):");
        console.log("   cefiToken.mint(address(faucet), 10000 * 10^18)");
        console.log("   defiToken.mint(address(faucet), 10000 * 10^18)");
        console.log("3. Or deposit tokens to faucet (if not mintable):");
        console.log("   faucet.depositTokens(cefiToken, amount)");
        console.log("   faucet.depositTokens(defiToken, amount)");

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n=== Deployment Summary ===");
        console.log("FAUCET_ADDRESS=", vm.toString(address(faucet)));
        console.log("CEFI_TOKEN_ADDRESS=", vm.toString(cefiToken));
        console.log("DEFI_TOKEN_ADDRESS=", vm.toString(defiToken));
        console.log("\n=== Frontend Configuration ===");
        console.log("Add this to your .env.local or environment variables:");
        console.log("NEXT_PUBLIC_FAUCET_ADDRESS=", vm.toString(address(faucet)));
    }
}

