// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/KinkFactory.sol";
import "../src/KinkPool.sol";
import "../src/KinkRouter.sol";
import "../src/PoolRegistry.sol";
import "../src/mocks/MockERC20.sol";

contract DeployScript is Script {
    struct PoolConfig {
        address tokenA;
        address tokenB;
        uint256 A0;
        uint256 A1;
        uint256 baseFee;
        uint256 kinkingFee;
        uint256 softPeg0;
        uint256 softPeg1;
        string label;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        vm.startBroadcast(deployerPrivateKey);

        // 1. Setup Tokens (fallback to mocks if not deployed on current chain)
        address cefiAddress = 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34;
        address defiAddress = 0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A;

        address tokenA = _resolveToken("CEFI (USDe)", cefiAddress, "USDe", "USDe");
        address tokenB = _resolveToken("DEFI (alUSD)", defiAddress, "alUSD", "alUSD");

        // 2. Deploy Registry, Factory, Router
        PoolRegistry registry = new PoolRegistry(deployer, address(0));
        KinkFactory factory = new KinkFactory(address(registry));
        registry.setFactory(address(factory));
        KinkRouter router = new KinkRouter(address(registry));

        console.log("Registry:", address(registry));
        console.log("Factory:", address(factory));
        console.log("Router:", address(router));

        // 3. Create Pools
        PoolConfig[] memory configs = new PoolConfig[](2);
        configs[0] = PoolConfig({
            tokenA: tokenA,
            tokenB: tokenB,
            A0: 1000,
            A1: 69,
            baseFee: 5,
            kinkingFee: 25,
            softPeg0: 1e18,
            softPeg1: 1e18,
            label: "CEFI/DEFI (USDe/alUSD)"
        });
        configs[1] = PoolConfig({
            tokenA: tokenB,
            tokenB: tokenA,
            A0: 150,
            A1: 500,
            baseFee: 5,
            kinkingFee: 15,
            softPeg0: 1e18,
            softPeg1: 1e18,
            label: "alUSD/USDe (alt params)"
        });

        address[] memory createdPools = new address[](configs.length);
        for (uint256 i = 0; i < configs.length; i++) {
            PoolConfig memory cfg = configs[i];
            address pool = factory.createPool(
                cfg.tokenA,
                cfg.tokenB,
                cfg.A0,
                cfg.A1,
                cfg.baseFee,
                cfg.kinkingFee,
                cfg.softPeg0,
                cfg.softPeg1
            );
            createdPools[i] = pool;
            console.log(cfg.label, pool);
        }

        // 4. Output JSON for frontend (optional)
        bool shouldWriteJson = vm.envOr("WRITE_DEPLOYMENT_JSON", false);
        if (shouldWriteJson) {
            string memory json = "deployment";
            json = vm.serializeAddress(json, "registry", address(registry));
            json = vm.serializeAddress(json, "factory", address(factory));
            json = vm.serializeAddress(json, "router", address(router));
            json = vm.serializeAddress(json, "tokenA", tokenA);
            json = vm.serializeAddress(json, "tokenB", tokenB);
            json = vm.serializeAddress(json, "cefiDefiPool", createdPools[0]);
            json = vm.serializeAddress(json, "alusdUsdePool", createdPools[1]);

            string memory defaultPath = string.concat(vm.projectRoot(), "/script-output/deployment.json");
            string memory outputPath = vm.envOr("DEPLOYMENT_JSON_PATH", defaultPath);
            vm.writeJson(json, outputPath);
            console.log("Deployment JSON written to", outputPath);
        } else {
            console.log("Skipping deployment.json write (set WRITE_DEPLOYMENT_JSON=1 to enable).");
        }

        vm.stopBroadcast();
    }

    function _resolveToken(
        string memory label,
        address existingAddress,
        string memory name,
        string memory symbol
    ) private returns (address) {
        if (existingAddress.code.length > 0) {
            console.log("Using existing", label, "at", existingAddress);
            return existingAddress;
        }
        console.log("Deploying mock for", label);
        return address(new MockERC20(name, symbol));
    }
}
