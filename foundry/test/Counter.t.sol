// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {Counter} from "../src/Counter.sol";

contract CounterTest is Test {
    Counter public counter;
    address public owner = address(1);
    address public user = address(2);
    uint256 internal constant DEFAULT_MAX_VALUE = 1_000_000;

    function setUp() public {
        vm.prank(owner);
        counter = new Counter(0, DEFAULT_MAX_VALUE);
    }

    function test_Increment() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit Counter.NumberIncremented(0, 1);
        counter.increment();
        assertEq(counter.number(), 1);
    }

    function testFuzz_SetNumber(uint256 x) public {
        vm.assume(x <= DEFAULT_MAX_VALUE);
        uint256 oldValue = counter.number();
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit Counter.NumberSet(oldValue, x);
        counter.setNumber(x);
        assertEq(counter.number(), x);
    }

    function test_OnlyOwnerCanSetNumber() public {
        vm.prank(user);
        vm.expectRevert();
        counter.setNumber(100);
    }

    function test_OnlyOwnerCanIncrement() public {
        vm.prank(user);
        vm.expectRevert();
        counter.increment();
    }

    function test_InitialValue() public {
        vm.prank(owner);
        Counter counterWithValue = new Counter(42, DEFAULT_MAX_VALUE);
        assertEq(counterWithValue.number(), 42);
        assertEq(counterWithValue.maxValue(), DEFAULT_MAX_VALUE);
    }

    function test_EventsEmitted() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit Counter.NumberSet(0, 100);
        counter.setNumber(100);

        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit Counter.NumberIncremented(100, 101);
        counter.increment();
    }

    function test_MaxValue() public {
        uint256 maxValue = type(uint256).max;
        vm.prank(owner);
        Counter counterWithMax = new Counter(maxValue, maxValue);
        assertEq(counterWithMax.number(), maxValue);
        assertEq(counterWithMax.maxValue(), maxValue);
    }

    function test_RevertWhen_InitialValueAboveMax() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Counter.ValueExceedsMaximum.selector, 6, 5));
        new Counter(6, 5);
    }

    function test_RevertWhen_SetNumberAboveMax() public {
        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Counter.ValueExceedsMaximum.selector, DEFAULT_MAX_VALUE + 1, DEFAULT_MAX_VALUE)
        );
        counter.setNumber(DEFAULT_MAX_VALUE + 1);
    }

    function test_RevertWhen_IncrementAtMax() public {
        vm.prank(owner);
        counter.setNumber(DEFAULT_MAX_VALUE);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(Counter.ValueExceedsMaximum.selector, DEFAULT_MAX_VALUE, DEFAULT_MAX_VALUE)
        );
        counter.increment();
    }
}
