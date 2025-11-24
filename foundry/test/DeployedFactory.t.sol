// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/KinkFactory.sol";

contract DeployedFactoryTest is Test {
    bool internal forkReady;
    string internal forkRpc;
    address constant FACTORY = 0x967BC6b850396A391Ab4A43eE6B4CBcf6B2dc1C8;
    address constant POOL = 0xCa3FFe6b943977fdCB77Cba4aF8E1cAf0A08B593;

    function setUp() public {
        try vm.envString("OPTIMISM_RPC_URL") returns (string memory value) {
            forkRpc = value;
        } catch {
            forkReady = false;
            return;
        }
        try vm.createSelectFork(forkRpc) returns (uint256) {
            forkReady = true;
        } catch {
            forkReady = false;
        }
    }

    function testPoolRegisteredInFactory() public {
        if (!forkReady) {
            emit log("Skipping deployed factory test (no RPC available)");
            return;
        }
        KinkFactory factory = KinkFactory(FACTORY);
        bool registered = factory.isPool(POOL);
        assertTrue(registered, "Factory does not recognize the newly created pool");
    }
}

