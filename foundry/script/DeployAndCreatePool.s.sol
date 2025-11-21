// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/KinkFactory.sol";
import "../src/KinkRouter.sol";
import "../src/KinkPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployAndCreatePool is Script {
    // Token addresses on Optimism
    address constant CEFI = 0xd09dEAaa17528748A781024213249D5c89bb6B11;
    address constant DEFI = 0xf00198F73Ea88e844E40cE6C131aF077879643a6;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Factory
        console.log("Deploying KinkFactory...");
        KinkFactory factory = new KinkFactory();
        console.log("KinkFactory deployed at:", address(factory));

        // 2. Deploy Router
        console.log("Deploying KinkRouter...");
        KinkRouter router = new KinkRouter(address(factory));
        console.log("KinkRouter deployed at:", address(router));

        // 3. Create Pool
        // Parameters
        // Determine which is token0 and token1
        address token0 = CEFI < DEFI ? CEFI : DEFI;
        address token1 = CEFI < DEFI ? DEFI : CEFI;

        // A0 applies when token0 > token1
        // A1 applies when token1 > token0

        uint256 A0;
        uint256 A1;

        if (token0 == CEFI) {
            // token0 is CEFI
            A0 = 500; // CEFI heavy
            A1 = 120; // DEFI heavy
        } else {
            // token0 is DEFI
            A0 = 120; // DEFI heavy
            A1 = 500; // CEFI heavy
        }

        uint256 baseFee = 2;        // 0.02% = 2 bps
        uint256 kinkingFee = 16;    // 0.16% = 16 bps

        console.log("Creating pool with parameters:");
        console.log("Token0:", token0);
        console.log("Token1:", token1);
        console.log("A0:", A0);
        console.log("A1:", A1);
        console.log("Base Fee:", baseFee);
        console.log("Kinking Fee:", kinkingFee);

        address poolAddress = factory.createPool(token0, token1, A0, A1, baseFee, kinkingFee);
        console.log("Pool deployed at:", poolAddress);

        // 4. Add Initial Liquidity (Optional but good for verification)
        // We need to check if deployer has balance.
        uint256 cefiBal = IERC20(CEFI).balanceOf(deployer);
        uint256 defiBal = IERC20(DEFI).balanceOf(deployer);

        console.log("Deployer CEFI balance:", cefiBal);
        console.log("Deployer DEFI balance:", defiBal);

        if (cefiBal > 0 && defiBal > 0) {
             // Add what we can, up to some limit, or just small amount to init
             uint256 amountCefi = 100e18;
             uint256 amountDefi = 100e18;

             if (cefiBal >= amountCefi && defiBal >= amountDefi) {
                 IERC20(CEFI).approve(poolAddress, type(uint256).max);
                 IERC20(DEFI).approve(poolAddress, type(uint256).max);

                 uint256[2] memory amounts;
                 // Assign amounts to correct index based on sorting
                 if (token0 == CEFI) {
                     amounts[0] = amountCefi;
                     amounts[1] = amountDefi;
                 } else {
                     amounts[0] = amountDefi;
                     amounts[1] = amountCefi;
                 }

                 KinkPool(poolAddress).add_liquidity(amounts, 0);
                 console.log("Initial liquidity added");
             } else {
                 console.log("Skipping liquidity addition - insufficient balance for 100 tokens");
             }
        }

        vm.stopBroadcast();

        // Output for processing
        console.log("JSON_OUTPUT_START");
        console.log("{");
        console.log(string.concat('"FACTORY_ADDRESS": "', vm.toString(address(factory)), '",'));
        console.log(string.concat('"ROUTER_ADDRESS": "', vm.toString(address(router)), '",'));
        console.log(string.concat('"POOL_ADDRESS": "', vm.toString(poolAddress), '"'));
        console.log("}");
        console.log("JSON_OUTPUT_END");
    }
}

