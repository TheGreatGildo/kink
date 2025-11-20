// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/KinkFactory.sol";
import "../src/KinkPool.sol";
import "../src/KinkRouter.sol";
import "../src/mocks/MockERC20.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Mocks
        MockERC20 tokenA = new MockERC20("Stable A", "STB-A");
        MockERC20 tokenB = new MockERC20("Synth B", "SYN-B");

        // 2. Deploy Factory (implementation deployed internally)
        KinkFactory factory = new KinkFactory();

        // 3. Deploy Router
        KinkRouter router = new KinkRouter(address(factory));

        console.log("Factory:", address(factory));
        console.log("Router:", address(router));
        console.log("TokenA:", address(tokenA));
        console.log("TokenB:", address(tokenB));

        // Output JSON for frontend
        string memory json = "deployment";
        json = vm.serializeAddress(json, "factory", address(factory));
        json = vm.serializeAddress(json, "router", address(router));
        json = vm.serializeAddress(json, "tokenA", address(tokenA));
        json = vm.serializeAddress(json, "tokenB", address(tokenB));
        vm.writeJson(json, "./deployment.json");

        vm.stopBroadcast();
    }
}
