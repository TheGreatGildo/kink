// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/KinkFactory.sol";
import "../src/KinkPool.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CreatePoolAndAddLiquidity
 * @notice Creates a pool and adds initial liquidity
 * @dev Requires FACTORY_ADDRESS, ALUSD_ADDRESS, USDC_ADDRESS in .env
 *      Also requires PRIVATE_KEY and OPTIMISM_RPC_URL
 */
contract CreatePoolAndAddLiquidity is Script {
    // Optimism mainnet addresses
    address constant ALUSD = 0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A; // alUSD on Optimism
    address constant USDE = 0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34; // USDe on Optimism

    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        string memory rpcUrl = vm.envString("OPTIMISM_RPC_URL");
        address factoryAddress = vm.envAddress("FACTORY_ADDRESS");

        // Set up Optimism fork
        vm.createSelectFork(rpcUrl);

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        KinkFactory factory = KinkFactory(factoryAddress);

        console.log("Creating pool with:");
        console.log("  alUSD (tokenA):", ALUSD);
        console.log("  USDe (tokenB):", USDE);
        console.log("  A0 (alUSD > USDe): 120");
        console.log("  A1 (USDe > alUSD): 500");

        // Create pool: alUSD at A0=120, USDe at A1=500
        // Base fee: 0.02% = 2 basis points, Kink fee: 0.16% = 16 basis points
        uint256 baseFee = 2; // 0.02% = 2 basis points
        uint256 kinkingFee = 16; // 0.16% = 16 basis points
        uint256 softPeg = 0.98e18; // 0.98

        address pool = factory.createPool(ALUSD, USDE, 120, 500, baseFee, kinkingFee, softPeg, softPeg);
        console.log("Pool created at:", pool);

        // Add initial liquidity: alUSD 120, USDe 500
        // Note: tokens are sorted by address, so USDe (lower) is token0, alUSD (higher) is token1
        // amounts array is [token0, token1] = [USDe, alUSD]
        uint256[2] memory amounts;
        amounts[0] = 500e18;  // 500 USDe (token0)
        amounts[1] = 120e18;   // 120 alUSD (token1)

        console.log("\nAdding initial liquidity:");
        console.log("  USDe (token0) amount:", amounts[0]);
        console.log("  alUSD (token1) amount:", amounts[1]);

        // Approve tokens (in pool order: token0=USDe, token1=alUSD)
        IERC20(USDE).approve(pool, amounts[0]);
        IERC20(ALUSD).approve(pool, amounts[1]);

        // Add liquidity
        uint256 lpAmount = KinkPool(pool).add_liquidity(amounts, 0);
        console.log("LP tokens minted:", lpAmount);

        vm.stopBroadcast();

        console.log("\n=== Pool Creation Summary ===");
        console.log("POOL_ADDRESS=", vm.toString(pool));
        console.log("Token 0 (alUSD):", ALUSD);
        console.log("Token 1 (USDe):", USDE);
        console.log("A0: 120");
        console.log("A1: 500");
        console.log("Base Fee: 0.02% (2 bp)");
        console.log("Kink Fee: 0.16% (16 bp)");
        console.log("Initial liquidity added successfully!");
    }
}

