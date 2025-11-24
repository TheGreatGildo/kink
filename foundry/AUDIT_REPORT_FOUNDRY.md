# Security Audit Report: Kink DEX (Foundry)

## Executive Summary
A security audit was performed on the Kink DEX contracts in `kink-dex/foundry`. Two significant issues were identified, one of which is Critical. The "Soft Peg" feature introduces calculation complexities that result in inaccurate fee charges, while the "Fee Split" implementation introduces a vulnerability allowing users to misappropriate accumulated admin fees.

## Findings

### 1. Critical: Admin Fee Theft via Input Calculation
**Severity:** Critical
**Location:** `KinkPool.sol`, function `exchange`

**Description:**
The `exchange` function calculates the user's input amount (`actualDx`) by comparing the contract's balance before and after the transfer.
```solidity
uint256[N_COINS] memory reservesBefore = _balances();
uint256 inputBalanceBefore = reservesBefore[i];
// ... transfer ...
uint256 inputBalanceAfter = IERC20(address(inputToken)).balanceOf(address(this));
uint256 actualDx = inputBalanceAfter - inputBalanceBefore;
```
The `_balances()` function returns the contract balance *minus* accumulated admin fees.
However, `inputBalanceAfter` uses the raw contract balance (which includes admin fees + new input).
As a result, `actualDx` is calculated as:
`actualDx = (OldBalance + AdminFees + UserInput) - (OldBalance)`
`actualDx = UserInput + AdminFees`

This allows a user to effectively "spend" the accumulated admin fees as their own input, receiving output tokens for them. The admin fees remain in the `adminFee` variables but the physical tokens are paid out to the user, leaving the contract insolvent backing the admin fees.

**Recommendation:**
Calculate `actualDx` using raw balances for both before and after snapshots, or explicitly handle the fee accounting.

```solidity
// Suggested Fix
uint256 inputBalanceBefore = IERC20(address(inputToken)).balanceOf(address(this));
inputToken.safeTransferFrom(msg.sender, address(this), dx);
uint256 inputBalanceAfter = IERC20(address(inputToken)).balanceOf(address(this));
uint256 actualDx = inputBalanceAfter - inputBalanceBefore;
```

### 2. Medium: Inaccurate Soft Peg Interpolation (User Overcharge)
**Severity:** Medium
**Location:** `KinkPool.sol`, function `exchange`

**Description:**
The soft peg feature uses linear interpolation to determine the point at which the marginal price crosses the `softPeg`.
```solidity
uint256 dxSplitNormalized = (dxNormalized * priceDropToPeg) / priceRange;
```
The price curve in StableSwap variants is convex/curved, not linear. Tests show that linear interpolation significantly underestimates the "Good Zone" (where Price > Peg) because the actual price stays above the peg longer than the linear approximation suggests (for the tested parameters).
This causes the contract to switch to the `kinkingFee` (usually higher) earlier than it should, resulting in users being overcharged fees.

**Recommendation:**
For higher accuracy, an iterative approach (binary search) to find the crossing point would be required. Alternatively, accept the inaccuracy but document it. If gas costs for iteration are too high, consider using a conservative approximation that favors the user (e.g. assume the curve is below the line if convex, or adjust the interpolation). Given the complexity, a binary search for `price(x) ~= peg` with a few iterations might be the robust solution.

### 3. Low: Governance Handover Risks
**Severity:** Low
**Location:** `KinkPool.sol`, `setAdmin`

**Description:**
The `setAdmin` function transfers admin rights immediately in a single step. If the address is incorrect or the key is lost, admin control (including fee setting and collection) is permanently lost.

**Recommendation:**
Implement a two-step ownership transfer pattern (pending admin -> claim admin) to prevent accidental loss of control.

### 4. Informational: Reentrancy Safety
**Location:** `KinkPool.sol`
The use of `nonReentrant` guard on all state-changing external functions (`exchange`, `add_liquidity`, `remove_liquidity`, `collectFees`) provides good protection against reentrancy attacks.

## Audit Tests
A test suite reproducing these issues has been added in `test/AuditSecurity.t.sol`.
- `testAdminFeeTheft`: Demonstrates a user gaining credit for admin fees.
- `testSoftPegCurvatureError`: Demonstrates the discrepancy between linear interpolation and actual price curve.

