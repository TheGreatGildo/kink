# Security Audit Report: Kink-DEX Foundry Contracts

**Date:** November 24, 2025
**Target:** `kink-dex/foundry/src`
**Auditor:** AI Assistant

## Executive Summary

A security audit was performed on the core smart contracts of the Kink-DEX protocol. The protocol implements a two-asset StableSwap pool with asymmetric amplification ("kink") behavior, allowing for different bonding curves depending on which token is dominant.

**Scope:**
- `src/KinkPool.sol`: Core pool logic.
- `src/KinkFactory.sol`: Deployment factory.
- `src/KinkRouter.sol`: Interaction router.
- `src/libraries/CurveMath.sol`: Mathematical library.

**Summary of Findings:**
- **Critical:** 0
- **High:** 0
- **Medium:** 1 (Acknowledged as acceptable behavior)
- **Low:** 2
- **Informational:** 2

## Detailed Findings

### [M-01] Insufficient Precision in Binary Search for Fee Splitting

**Severity:** Medium
**Location:** `KinkPool.sol`, `_find_crossing_dx` function (lines 279-309)

**Description:**
The `_find_crossing_dx` function uses a binary search to find the exact swap amount `dx` where the marginal price crosses the `softPeg`. This is used to split a swap into a "low fee" portion (above peg) and a "high fee" portion (below peg).

The current implementation uses a hardcoded limit of **10 iterations**. With 10 iterations, the search space is reduced by a factor of 1024, leaving a potential error margin of ~1000 wei for 18-decimal tokens.

**Update:**
The developer has acknowledged this behavior. A comment was added to the code noting that minor precision loss is acceptable.

### [L-01] Potential `forceApprove` Incompatibility

**Severity:** Low
**Location:** `KinkRouter.sol`, line 59 and 73

**Description:**
The `KinkRouter` uses `SafeERC20.forceApprove`. Depending on the version of OpenZeppelin used (implied recent due to `forceApprove` availability), this function approves `0` then approves the `amount`.
Some older or non-standard ERC20 tokens (e.g., USDT on mainnet) revert if approving a non-zero amount when the current allowance is non-zero. `forceApprove` handles this correctly.
However, some tokens might behave unexpectedly if `approve` is called aggressively.
Additionally, `forceApprove` was added in OpenZeppelin Contracts v4.9.0. Ensure the project dependencies match this version.

**Recommendation:**
Verify the `package.json` to ensure `@openzeppelin/contracts` is at least v4.9.0. The usage itself is generally correct for modern compatibility, but rigorous testing with USDT and other non-standard tokens is recommended.

### [L-02] Lack of Events for Critical Initialization

**Severity:** Low
**Location:** `KinkPool.sol`, `initialize` function

**Description:**
The `initialize` function sets critical parameters like `admin`, fees, and multipliers but does not emit an event. While `KinkFactory` emits `PoolCreated` with most parameters, the `admin` address set in the pool is not explicitly logged in the pool's event history until a transfer occurs.

**Recommendation:**
Emit an `Initialized` event in `KinkPool.sol` containing the setup parameters, or rely on the Factory's event but ensure off-chain indexers know to look there.

### [I-01] Gas Optimization in `_calculate_exchange`

**Severity:** Informational
**Location:** `KinkPool.sol`

**Description:**
The `_calculate_exchange` function performs multiple calls to `CurveMath.get_y`, which is an iterative Newton-Raphson solver (up to 255 iterations).
In the "split swap" scenario (crossing equilibrium), it calls `get_y` at least twice.
If the swap also crosses the `softPeg`, it calls `_find_crossing_dx`, which calls `_get_marginal_price` 10 times. `_get_marginal_price` calls `get_y` twice per call.
Total `get_y` calls could exceed 20+ in a complex swap.
This could lead to high gas costs for specific trades that cross multiple boundaries.

**Recommendation:**
Benchmark the gas cost of "worst-case" swaps (crossing equilibrium AND soft peg). If too high, consider optimizing the mathematical approximations or the search algorithm.

### [I-02] A-Switch Logic Complexity

**Severity:** Informational
**Location:** `KinkPool.sol`, `add_liquidity`

**Description:**
The pool uses a `max(A_old, A_new)` logic to calculate `D` changes during liquidity addition. This is a safety mechanism to prevent manipulation of the amplification parameter to gain unfair LP shares.
The logic appears sound (penalizing regime shifts by using the "flatter" curve which yields smaller `dD`), but it is complex and specific to this protocol.

**Recommendation:**
Ensure comprehensive fuzz testing covers "liquidity addition during regime shift" scenarios to verify no edge cases exist where an attacker can extract value.

## Conclusion

The codebase is well-structured and leverages standard libraries (`OpenZeppelin`) and established math (`Curve`). The primary issue identified is the low precision in the binary search algorithm (`[M-01]`), which should be addressed before mainnet deployment. The rest of the findings are minor or informational.

