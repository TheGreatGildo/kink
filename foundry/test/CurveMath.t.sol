// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/libraries/CurveMath.sol";

contract CurveMathTest is Test {
    uint256 private constant N_COINS = 2;

    function testGet_D_Basic() public {
        uint256[N_COINS] memory xp;
        xp[0] = 1e18;
        xp[1] = 1e18;
        uint256 A = 100;

        uint256 D = CurveMath.get_D(xp, A);
        assertGt(D, 0, "D should be greater than 0");
        assertApproxEqAbs(D, 2e18, 1e15, "D should be approximately 2e18 for equal balances");
    }

    function testGet_D_UnequalBalances() public {
        uint256[N_COINS] memory xp;
        xp[0] = 2e18;
        xp[1] = 1e18;
        uint256 A = 100;

        uint256 D = CurveMath.get_D(xp, A);
        assertGt(D, 0, "D should be greater than 0");
        assertGt(D, 2e18, "D should be greater than sum for unequal balances");
    }

    function testGet_D_ZeroBalances() public {
        uint256[N_COINS] memory xp;
        xp[0] = 0;
        xp[1] = 0;
        uint256 A = 100;

        uint256 D = CurveMath.get_D(xp, A);
        assertEq(D, 0, "D should be 0 for zero balances");
    }

    function testGet_D_HighA() public {
        uint256[N_COINS] memory xp;
        xp[0] = 1e18;
        xp[1] = 1e18;
        uint256 A = 1000;

        uint256 D = CurveMath.get_D(xp, A);
        assertGt(D, 0, "D should be greater than 0");
    }

    function testGet_D_LowA() public {
        uint256[N_COINS] memory xp;
        xp[0] = 1e18;
        xp[1] = 1e18;
        uint256 A = 2;

        uint256 D = CurveMath.get_D(xp, A);
        assertGt(D, 0, "D should be greater than 0");
    }

    function testGet_y_Basic() public {
        uint256[N_COINS] memory xp;
        xp[0] = 1e18;
        xp[1] = 1e18;
        uint256 A = 100;
        uint256 x = 1.1e18; // Increase token0 by 10%

        uint256 y = CurveMath.get_y(0, 1, x, xp, A);
        assertGt(y, 0, "y should be greater than 0");
        assertLt(y, xp[1], "y should be less than original balance");
    }

    function testGet_y_Reverse() public {
        uint256[N_COINS] memory xp;
        xp[0] = 1e18;
        xp[1] = 1e18;
        uint256 A = 100;
        uint256 x = 1.1e18; // Increase token1 by 10%

        uint256 y = CurveMath.get_y(1, 0, x, xp, A);
        assertGt(y, 0, "y should be greater than 0");
        assertLt(y, xp[0], "y should be less than original balance");
    }

    function testGet_y_InvalidIndices() public {
        uint256[N_COINS] memory xp;
        xp[0] = 1e18;
        xp[1] = 1e18;
        uint256 A = 100;

        vm.expectRevert("CurveMath: Invalid indices");
        CurveMath.get_y(0, 0, 1.1e18, xp, A);

        vm.expectRevert("CurveMath: Invalid indices");
        CurveMath.get_y(2, 0, 1.1e18, xp, A);
    }

    function testGet_y_D_Basic() public {
        uint256[N_COINS] memory xp;
        xp[0] = 1e18;
        xp[1] = 1e18;
        uint256 A = 100;
        uint256 D = CurveMath.get_D(xp, A);

        uint256 y = CurveMath.get_y_D(A, 1, xp, D);
        assertGt(y, 0, "y should be greater than 0");
        assertApproxEqAbs(y, xp[1], 1e15, "y should be approximately equal to xp[1]");
    }

    function testGet_y_D_InvalidIndex() public {
        uint256[N_COINS] memory xp;
        xp[0] = 1e18;
        xp[1] = 1e18;
        uint256 A = 100;
        uint256 D = CurveMath.get_D(xp, A);

        vm.expectRevert("CurveMath: Invalid index");
        CurveMath.get_y_D(A, 2, xp, D);
    }

    function testGet_D_Reversible() public {
        uint256[N_COINS] memory xp;
        xp[0] = 1e18;
        xp[1] = 1.5e18;
        uint256 A = 100;

        uint256 D = CurveMath.get_D(xp, A);
        assertGt(D, 0, "D should be greater than 0");

        // Calculate y for token0 given D
        uint256 y0 = CurveMath.get_y_D(A, 0, xp, D);
        assertGt(y0, 0, "y0 should be greater than 0");

        // Calculate y for token1 given D
        uint256 y1 = CurveMath.get_y_D(A, 1, xp, D);
        assertGt(y1, 0, "y1 should be greater than 0");
    }
}
