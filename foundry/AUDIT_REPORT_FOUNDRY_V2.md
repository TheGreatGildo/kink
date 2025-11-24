# Security Audit Report: Kink DEX (Foundry) - V2

## Executive Summary
A fresh security audit was performed on the `kink-dex/foundry` codebase, following up on previous remediation efforts. While previous issues regarding Admin Fee Theft and Soft Peg Interpolation appear to be addressed, **three new significant issues** were identified, including a **Critical** vulnerability in the Router that allows for fund theft via phishing.

## Findings

### 1. Critical: Router Pool Verification Bypass (Phishing Vector)
**Severity:** Critical
**Location:** `KinkRouter.sol`, function `swap`

**Description:**
The `swap` function attempts to verify that the target pool is legitimate by checking its factory address:
```solidity
require(poolContract.factory() == factory, "KinkRouter: Invalid pool factory");
```
This check is insufficient because it relies on the untrusted `poolContract` to report its own factory. A malicious contract can easily return the legitimate factory address in its `factory()` view function.

An attacker can deploy a malicious pool and trick a user (via a phishing frontend or misleading link) into calling `router.swap` with the malicious pool's address. Since the Router approves the pool to spend tokens, the malicious pool can steal the user's funds (transferred to the Router) during the `exchange` call.

**Proof of Concept:**
See `test/ExploitRouter.t.sol`.

**Recommendation:**
Do not trust the pool's reported factory. Instead, query the trusted Factory to verify if the pool exists.
```solidity
require(KinkFactory(factory).isPool(pool), "KinkRouter: Invalid pool");
```
*Note: You will need to add an `isPool` mapping or function to `KinkFactory`, or check `getPool[hash]` if you can reconstruct the parameters, or iterate/check `allPools` (gas intensive).*
Better yet, `KinkFactory` already maps pools. If `KinkFactory` does not have a reverse lookup `isPool(address)`, it should be added. Currently `KinkFactory` has `allPools` array and `getPool` by params. Adding `mapping(address => bool) public isPool` to `KinkFactory` is the best solution.

### 2. High: Broken Withdrawal Calculations
**Severity:** High
**Location:** `KinkPool.sol`, function `calc_token_amount`

**Description:**
The `calc_token_amount` function logic for withdrawals (`is_deposit = false`) is mathematically incorrect and will always revert due to underflow.
```solidity
// For withdrawal
if (amounts[i] > new_balances[i]) return 0;
new_balances[i] -= amounts[i];
// ...
// D1 (new) < D0 (old) because balances decreased
return (totalSupply * (D1 - D0)) / D0; // Reverts: D1 - D0 underflows
```
This renders the function unusable for estimating withdrawal amounts (LP to burn) or single-sided withdrawals if that was the intent.

**Proof of Concept:**
See `test/CalcTokenAmount.t.sol`.

**Recommendation:**
Correct the formula for withdrawals:
```solidity
return (totalSupply * (D0 - D1)) / D0;
```

### 3. High: Incorrect Quote Logic in Router
**Severity:** High
**Location:** `KinkRouter.sol`, function `getAmountsOut`

**Description:**
The `getAmountsOut` function attempts to replicate `KinkPool`'s complex fee logic but uses an incorrect formula for determining the "equilibrium crossing" point.
`KinkRouter` calculates the gap as `outputBalance - inputBalance`.
`KinkPool` calculates the gap based on `D / N_COINS` (approximately half the invariant).

These two values differ significantly (factor of ~2x), causing the Router to misidentify when the swap switches from the low "Base Fee" to the high "Kinking Fee".
- Result: `getAmountsOut` returns a quoted amount that is often higher than the actual execution amount.
- Consequence: Users submitting swaps with standard slippage settings (e.g., 0.5%) will experience reverts because the actual output falls below the `min_dy` derived from the incorrect quote.

**Proof of Concept:**
See `test/GetAmountsOut.t.sol`. Tests show a ~0.9% discrepancy in a standard converging trade scenario.

**Recommendation:**
The `getAmountsOut` function should call `KinkPool(pool).get_dy(...)` view function if available, or use the exact same logic as `KinkPool.exchange`. Since `KinkPool` does not expose a view function for `get_dy`, one should be added to `KinkPool` to ensure the logic (including binary search) is perfectly consistent and maintainable.

### 4. Medium: Factory Griefing / Spam
**Severity:** Medium
**Location:** `KinkFactory.sol`

**Description:**
The `getPools[token0][token1]` array allows pushing unlimited pools for the same pair. An attacker can create thousands of pools with slightly different fee parameters, cluttering the list and potentially breaking frontends that try to "find all pools" for a pair.

**Recommendation:**
Consider limiting the number of pools per pair or implementing a "canonical" pool registry.

### 5. Low: Binary Search Precision
**Severity:** Low
**Location:** `KinkPool.sol`, function `_find_crossing_dx`

**Description:**
The binary search uses a hardcoded limit of 10 iterations. For a `uint256` search space, this provides relatively low precision (`~1e-3` relative error). While sufficient for fee switch detection in many cases, edge cases might result in slightly suboptimal fee charging.

**Recommendation:**
Increase iterations to 20-30 for better precision with negligible gas cost impact.

## Conclusion
The codebase contains critical vulnerabilities in the Router and broken functionality in helper methods. Immediate remediation is required for `KinkRouter.swap` verification and `calc_token_amount`. The Router's quoting logic should be refactored to query the Pool directly to avoid logic divergence.

