// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title A simple, owner-gated counter with explicit trust assumptions
/// @notice Allows only the contract owner to mutate the counter within a bounded range
/// @dev Access is fully centralized under the owner – downstream systems must trust the owner to behave honestly
contract Counter is Ownable {
    /// @notice The current counter value
    uint256 public number;
    /// @notice The maximum value the counter is allowed to reach
    uint256 public immutable maxValue;

    /// @notice Thrown when attempting to initialize or set a value above the configured limit
    /// @param attempted The value that exceeded the allowed maximum
    /// @param limit The contract's configured maximum
    error ValueExceedsMaximum(uint256 attempted, uint256 limit);

    /// @notice Emitted when the counter value is set
    /// @param oldValue The previous counter value
    /// @param newValue The new counter value
    event NumberSet(uint256 indexed oldValue, uint256 indexed newValue);

    /// @notice Emitted when the counter is incremented
    /// @param oldValue The previous counter value
    /// @param newValue The new counter value
    event NumberIncremented(uint256 indexed oldValue, uint256 indexed newValue);

    /// @notice Constructor sets initial value, owner, and upper bound for the counter
    /// @param initialValue The initial counter value
    /// @param maximumValue The highest value `number` is ever allowed to reach
    constructor(uint256 initialValue, uint256 maximumValue) Ownable(msg.sender) {
        if (initialValue > maximumValue) {
            revert ValueExceedsMaximum(initialValue, maximumValue);
        }
        maxValue = maximumValue;
        number = initialValue;
        emit NumberSet(0, initialValue);
    }

    /// @notice Sets the counter to a new value
    /// @param newNumber The new value to set
    function setNumber(uint256 newNumber) public onlyOwner {
        if (newNumber > maxValue) {
            revert ValueExceedsMaximum(newNumber, maxValue);
        }
        uint256 oldValue = number;
        number = newNumber;
        emit NumberSet(oldValue, newNumber);
    }

    /// @notice Increments the counter by 1 without exceeding `maxValue`
    function increment() public onlyOwner {
        if (number >= maxValue) {
            revert ValueExceedsMaximum(number, maxValue);
        }
        uint256 oldValue = number;
        number = oldValue + 1;
        emit NumberIncremented(oldValue, number);
    }
}
