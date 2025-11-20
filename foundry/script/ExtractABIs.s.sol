// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";

/**
 * @title ExtractABIs
 * @notice Extracts ABIs from compiled contracts and writes them to frontend directory
 * @dev Run this after compilation to update frontend ABIs
 */
contract ExtractABIs is Script {
    function run() external {
        // Read compiled contract ABIs
        string memory factoryAbi = vm.readFile("./out/KinkFactory.sol/KinkFactory.json");
        string memory routerAbi = vm.readFile("./out/KinkRouter.sol/KinkRouter.json");
        string memory poolAbi = vm.readFile("./out/KinkPool.sol/KinkPool.json");

        // Parse JSON and extract ABI arrays
        // Note: This is a simplified version - in production you might want to use a proper JSON parser
        // For now, we'll write the full JSON files and let the frontend extract ABIs

        // Write full contract JSONs to script directory (will be copied by shell script)
        vm.writeFile("./script/abis/KinkFactory.json", factoryAbi);
        vm.writeFile("./script/abis/KinkRouter.json", routerAbi);
        vm.writeFile("./script/abis/KinkPool.json", poolAbi);

        console.log("ABIs extracted to ./script/abis/");
        console.log("- KinkFactory.json");
        console.log("- KinkRouter.json");
        console.log("- KinkPool.json");
    }
}
