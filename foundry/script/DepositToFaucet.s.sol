// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/Faucet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DepositToFaucet
 * @notice Approves and deposits 100k CEFI and DEFI tokens to the faucet
 * @dev Requires PRIVATE_KEY, FAUCET_ADDRESS, CEFI_TOKEN_ADDRESS, and DEFI_TOKEN_ADDRESS in .env
 */
contract DepositToFaucet is Script {
    uint256 constant DEPOSIT_AMOUNT = 100_000 * 10**18; // 100k tokens with 18 decimals

    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address faucetAddress = vm.envAddress("FAUCET_ADDRESS");
        address cefiToken = vm.envAddress("CEFI_TOKEN_ADDRESS");
        address defiToken = vm.envAddress("DEFI_TOKEN_ADDRESS");

        console.log("\n=== Deposit Tokens to Faucet ===");
        console.log("Deployer:", deployer);
        console.log("Faucet:", faucetAddress);
        console.log("CEFI token:", cefiToken);
        console.log("DEFI token:", defiToken);
        console.log("Deposit amount per token:", DEPOSIT_AMOUNT / 10**18, "tokens");

        IERC20 cefi = IERC20(cefiToken);
        IERC20 defi = IERC20(defiToken);
        Faucet faucet = Faucet(faucetAddress);

        // Check balances before
        uint256 cefiBalanceBefore = cefi.balanceOf(deployer);
        uint256 defiBalanceBefore = defi.balanceOf(deployer);
        console.log("\nDeployer balances before:");
        console.log("  CEFI:", cefiBalanceBefore / 10**18);
        console.log("  DEFI:", defiBalanceBefore / 10**18);

        // Check faucet balances before
        (uint256 faucetCefiBefore, uint256 faucetDefiBefore) = faucet.getBalances();
        console.log("\nFaucet balances before:");
        console.log("  CEFI:", faucetCefiBefore / 10**18);
        console.log("  DEFI:", faucetDefiBefore / 10**18);

        require(cefiBalanceBefore >= DEPOSIT_AMOUNT, "Insufficient CEFI balance");
        require(defiBalanceBefore >= DEPOSIT_AMOUNT, "Insufficient DEFI balance");

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Approve CEFI token
        console.log("\n[1/4] Approving CEFI token...");
        cefi.approve(faucetAddress, DEPOSIT_AMOUNT);
        console.log("  [OK] CEFI approved");

        // Approve DEFI token
        console.log("[2/4] Approving DEFI token...");
        defi.approve(faucetAddress, DEPOSIT_AMOUNT);
        console.log("  [OK] DEFI approved");

        // Deposit CEFI
        console.log("[3/4] Depositing CEFI tokens...");
        faucet.depositTokens(cefiToken, DEPOSIT_AMOUNT);
        console.log("  [OK] CEFI deposited");

        // Deposit DEFI
        console.log("[4/4] Depositing DEFI tokens...");
        faucet.depositTokens(defiToken, DEPOSIT_AMOUNT);
        console.log("  [OK] DEFI deposited");

        vm.stopBroadcast();

        // Check balances after
        uint256 cefiBalanceAfter = cefi.balanceOf(deployer);
        uint256 defiBalanceAfter = defi.balanceOf(deployer);
        (uint256 faucetCefiAfter, uint256 faucetDefiAfter) = faucet.getBalances();

        uint256 cefiSpent = (cefiBalanceBefore - cefiBalanceAfter) / 10**18;
        uint256 defiSpent = (defiBalanceBefore - defiBalanceAfter) / 10**18;
        uint256 cefiAdded = (faucetCefiAfter - faucetCefiBefore) / 10**18;
        uint256 defiAdded = (faucetDefiAfter - faucetDefiBefore) / 10**18;

        console.log("\n=== Deposit Summary ===");
        console.log("Deployer balances after:");
        console.log("  CEFI:", cefiBalanceAfter / 10**18);
        console.log("    Spent:", cefiSpent);
        console.log("  DEFI:", defiBalanceAfter / 10**18);
        console.log("    Spent:", defiSpent);
        console.log("\nFaucet balances after:");
        console.log("  CEFI:", faucetCefiAfter / 10**18);
        console.log("    Added:", cefiAdded);
        console.log("  DEFI:", faucetDefiAfter / 10**18);
        console.log("    Added:", defiAdded);
        console.log("\n[SUCCESS] Successfully deposited 100k CEFI and 100k DEFI to faucet!");
    }
}

