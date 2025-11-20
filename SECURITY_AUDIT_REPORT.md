# Security Audit Report: Kink DEX

## 1. Executive Summary

A comprehensive security audit was performed on the `kink-dex` repository, focusing on the smart contracts in `foundry/` and the frontend application in `frontend/`.

**Critical vulnerabilities** were identified in both the smart contracts and the frontend application that put user funds at significant risk. Immediate action is required before mainnet deployment.

## 2. Scope

- **Smart Contracts**: `KinkPool.sol`, `KinkFactory.sol`, `KinkRouter.sol`, `CurveMath.sol`.
- **Frontend**: `Swap.tsx`, `Liquidity.tsx`.
- **Tests**: `Audit.t.sol` (Created for verification).

## 3. Findings

### [H-01] Inflation Attack / First Depositor Attack
**Severity:** High
**Component:** `KinkPool.sol`

**Description:**
The `add_liquidity` function is vulnerable to the well-known "inflation attack" (or donation attack). When the pool is empty (`totalSupply == 0`), the first depositor can mint a minimal amount of LP tokens (e.g., 1 wei). They can then "donate" a large amount of underlying tokens to the pool directly, massively inflating the value of a single LP share.

Subsequent depositors will calculate their LP receipt as `(totalSupply * (D1 - D0)) / D0`. Since `totalSupply` is tiny and `D0` is artificially huge, this calculation rounds down to zero for even significant deposits, causing users to lose their funds completely.

**Proof of Concept:**
A test case `testInflationAttack` in `foundry/test/Audit.t.sol` successfully reproduced this. An attacker deposited 2 wei, donated 2000 ETH, and a victim depositing 20 ETH received 0 LP tokens.

**Recommendation:**
Burn the first `MINIMUM_LIQUIDITY` (e.g., 1000) LP tokens to the zero address during the first mint to make the inflation attack prohibitively expensive.
```solidity
if (totalSupply == 0) {
    // ...
    lpAmount = D1;
    _mint(address(0), MINIMUM_LIQUIDITY);
    _mint(msg.sender, lpAmount - MINIMUM_LIQUIDITY);
}
```

### [H-02] Frontend: Zero Slippage Vulnerability
**Severity:** High
**Component:** `frontend/components/Liquidity.tsx`, `frontend/components/Swap.tsx`

**Description:**
The frontend application hardcodes slippage parameters to zero when interacting with the smart contracts.
- In `Liquidity.tsx`, `add_liquidity` is called with `min_lp = 0`.
- In `Liquidity.tsx`, `remove_liquidity` is called with `min_amounts = [0, 0]`.
- In `Swap.tsx`, if the price simulation fails (which appears to be mocked/missing), `minOutput` defaults to 0.

This exposes all users to sandwich attacks, where MEV bots can front-run the user's transaction to manipulate the price/reserves and back-run it to profit, effectively stealing the user's funds up to the slippage limit (which is 100% in this case).

**Recommendation:**
1. Implement a proper `getAmountsOut` / `get_D` simulation in the frontend (using `KinkRouter` or `viem` reads).
2. Calculate the minimum expected output based on user-selected slippage (e.g., 0.5%).
3. Pass these calculated minimums to the contract calls.

### [M-01] Missing Price Simulation Logic in Frontend
**Severity:** Medium
**Component:** `frontend/components/Swap.tsx`

**Description:**
The `Swap.tsx` component contains comments indicating that the `getAmountsOut` simulation is mocked:
```typescript
// Simulate getAmountsOut call
// In a real implementation, you'd call the router contract
setExpectedOutput(null);
```
Because `expectedOutput` is always null, the user cannot see the expected return, and the slippage calculation relies on this missing value (defaulting to 0).

**Recommendation:**
Implement the `useReadContract` hook to call `KinkRouter.getAmountsOut` dynamically as the user types input.

### [L-01] Gas Usage in CurveMath
**Severity:** Low
**Component:** `CurveMath.sol`

**Description:**
The math library uses a loop of 255 iterations for Newton-Raphson convergence. While this is standard for Curve-based invariants, it is gas-heavy.

**Recommendation:**
Ensure the convergence criteria (`<= 1`) is met efficiently. No immediate change needed if copying verified Curve implementations, but be aware of the gas cost limit on Optimism/Mainnet.

## 4. Conclusion

The `kink-dex` protocol contains critical security flaws. The **Inflation Attack** in the smart contract and the **Zero Slippage** configuration in the frontend render the DEX unsafe for user funds. These issues must be addressed before any public release.

