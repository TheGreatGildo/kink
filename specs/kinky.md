Project Specification: Center-Kinked Stableswap (KINK-DEX)
1. System Architecture
Objective: Build a permissionless DEX on Optimism Sepolia where pools use a piecewise Stableswap invariant. The curve "kinks" at a 1:1 equilibrium, allowing different amplification (
A
A
) and fee parameters depending on which side of the peg the pool is on.
Core Logic (The "Kink")
The pool has two states:
State A (Token 0 Heavy): Balance0 > Balance1. Uses A_0 and Fee_0.
State B (Token 1 Heavy): Balance1 > Balance0. Uses A_1 and Fee_1.
Transition: Occurs strictly at Balance0 == Balance1.
Repository Structure
code
Text
kink-dex/
├── foundry/                 # Smart Contracts
│   ├── src/
│   │   ├── KinkPool.sol     # Core logic
│   │   ├── KinkFactory.sol  # Clones & Registry
│   │   └── libraries/       # Math & Fee logic
│   ├── script/              # Deploy scripts
│   └── test/                # Invariant tests
├── frontend/                # Next.js App
│   ├── components/          # UI Modules
│   ├── hooks/               # Wagmi hooks
│   └── config/              # Chain setup
└── specs/                   # This document
2. Smart Contract Implementation Steps
Phase 1: Math & Libraries
Goal: Implement Stableswap math that accepts dynamic
A
A
.
Instruction 1: Create foundry/src/libraries/CurveMath.sol.
Input: xp (balances), A (amplification).
Function get_D(xp, A): Implement Newton-Raphson iterative solver.
Constraint: Loop max 255 times. Return 0 on non-convergence.
Function get_y(i, j, x, xp, A): Calculate value of token j if token i changes to x.
Ref: Port strictly from Curve Fi's StableSwap.vy (Vyper) to Solidity.
Function get_y_D(A, index, xp, D): Calculate y given D.
Phase 2: The KinkPool Contract
Goal: Handle storage and the "Split-Swap" execution.
Instruction 2: Create foundry/src/KinkPool.sol.
Inheritance: ReentrancyGuard, ERC20 (LP Token), Initializable.
Storage:
address public factory
address public token0, address public token1
uint256 public A0, uint256 public A1 (The kinks)
uint256 public baseFee, uint256 public kinkingFee
View _get_current_A():
code
Solidity
uint256 b0 = token0.balanceOf(address(this));
uint256 b1 = token1.balanceOf(address(this));
if (b0 == b1) return A0 > A1 ? A0 : A1; // Use higher A at exact peg
return b0 > b1 ? A0 : A1;
Instruction 3: Implement exchange(i, j, dx, min_dy).
Step A: Check if swap crosses equilibrium.
Current Balance b_i, b_j.
Equilibrium Gap: gap = b_j - b_i.
If b_i < b_j AND dx > gap: CROSSING DETECTED.
Step B (Crossing Logic):
Swap 1 (To Peg): Input dx_1 = gap. Fee = 0 (Converging). Calculate dy_1 using Current A.
Swap 2 (From Peg): Input dx_2 = dx - dx_1. Fee = kinkingFee (Diverging). Calculate dy_2 using Target A.
Total: dy = dy_1 + dy_2.
Step C (Standard Logic):
If not crossing: Determine direction (Converging vs Diverging).
Apply baseFee if converging/neutral, kinkingFee if diverging.
Execute single curve calculation.
Instruction 4: Implement add_liquidity / remove_liquidity.
Critical: When calculating D for minting LPs, strictly use _get_current_A().
Protection: If add_liquidity changes the state (e.g. flips from b0 > b1 to b1 > b0), verify D increases monotonically.
Phase 3: The Factory
Goal: Permissionless deployment via Clones.
Instruction 5: Create foundry/src/KinkFactory.sol.
Registry: Pool[] public allPools, mapping(tokenA => mapping(tokenB => address)) getPool.
Method createPool:
Args: tokenA, tokenB, _A0, _A1, _baseFee, _kinkingFee.
Sort tokens (Address A < Address B).
Clones.clone(implementation).
IPool(clone).initialize(...).
Emit PoolCreated event (Index these in frontend).
Phase 4: Router & Helpers
Goal: UX abstraction.
Instruction 6: Create foundry/src/KinkRouter.sol.
Wrapper for transferFrom -> approve -> pool.exchange.
View getAmountsOut: Must replicate the Python/Solidity math of the pool to predict the Split-Swap output for the UI.
Phase 5: Deployment Script
Instruction 7: foundry/script/Deploy.s.sol.
Deploy 2 MockERC20 tokens (Mint 1M to deployer).
Deploy KinkPool (Master Copy).
Deploy KinkFactory (Point to Master).
Deploy KinkRouter.
Console Log: JSON formatted addresses for frontend ingestion.
3. Frontend Implementation Steps
Phase 1: Setup
Instruction 8: Initialize.
code
Bash
npx create-next-app@latest frontend --typescript --tailwind --eslint
npm install wagmi viem @tanstack/react-query lucide-react
Create config/wagmi.ts: Configure Optimism Sepolia + Foundry (Localhost) chains.
Phase 2: Data Layer (Hooks)
Instruction 9: Pool Discovery.
Create hooks/usePools.ts.
Use usePublicClient to call getLogs on the Factory address.
Topic: PoolCreated.
Parse logs to build a list of { token0, token1, poolAddress, params }.
Instruction 10: Pool Data.
Create hooks/usePoolData.ts.
Multicall to fetch: getReserves, A0, A1, fee.
Calculate Current Price based on the ratio.
Phase 3: UI Components
Instruction 11: CreatePool.tsx.
Form Inputs: Token Addresses, A0 (Slider 10-500), A1 (Slider 10-500), Fee (0-1%).
Visualizer: A simple SVG graph showing the two lines meeting at 1:1.
Line 1: Slope based on A0.
Line 2: Slope based on A1.
Instruction 12: Swap.tsx (Uniswap Clone).
Logic: Detect if User Input crosses the 1:1 ratio.
Warning: If yes, show "Kink Cross" warning badge: "Splitting trade for optimal execution".
Simulation: Use Router.getAmountsOut to show expected output.
Slippage: Default 0.5% (higher for volatile kinks).
Instruction 13: Liquidity.tsx.
Simple "Add Liquidity" box.
Constraint: For MVP, force 50/50 deposit if the pool is empty. If not empty, allow single-sided but show "Bonus/Penalty" estimation.
4. Agentic Workflow Instructions
If you are an AI agent reading this, execute the following sequence:
Scaffold: Run Forge init. Create the file structure defined in Section 1.
Math: Port CurveMath strictly. Write a fuzz test test/CurveMath.t.sol ensuring get_D is reversible.
Core: Write KinkPool.sol.
Check: Does _get_current_A handle the equality case correctly?
Check: Does exchange handle the fee logic (0% converging, X% diverging)?
Deploy: Run script on Optimism Sepolia.
Verify: Verify contracts on Etherscan/Blockscout.
Frontend: Scaffold Next.js. Paste the ABI from foundry/out.
Integrate: Build the Create Pool flow first. Create a test pool with the deployed Mocks. Then build Swap.
5. Specific Constraints & Constants
Decimals: Assume all tokens are normalized to 18 decimals in the Pool logic (Multipliers needed if supporting USDC 6 decimals). For MVP, assume 18 decimals only.
Gas Limit: The "Split Swap" is gas-heavy (~250k gas). Ensure the UI sets a high gas limit override.
Factory Address: Hardcode or Environment Variable in frontend.
Max A: Cap at 1,000 (prevent overflow).
Min A: Floor at 2 (prevent invariant break).
6. Deployment Script (Optimism Sepolia)
code
Solidity
// script/Deploy.s.sol
import "forge-std/Script.sol";
import "../src/KinkFactory.sol";
import "../src/KinkPool.sol";
import "../src/KinkRouter.sol";
import "../src/mocks/MockERC20.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Mocks
        MockERC20 tokenA = new MockERC20("Stable A", "STB-A");
        MockERC20 tokenB = new MockERC20("Synth B", "SYN-B");

        // 2. Deploy Logic
        KinkPool implementation = new KinkPool();

        // 3. Deploy Factory
        KinkFactory factory = new KinkFactory(address(implementation));

        // 4. Deploy Router
        KinkRouter router = new KinkRouter(address(factory));

        console.log("Factory:", address(factory));
        console.log("Router:", address(router));
        console.log("TokenA:", address(tokenA));
        console.log("TokenB:", address(tokenB));

        vm.stopBroadcast();
    }
}
7. UI Mockup (Concept)
Swap Card:
code
Text
+---------------------------------------+
| [Sell] 1000 STB-A                     |
| Balance: 5000                         |
+---------------------------------------+
|  ( v )  Split-Swap Active (A: 10->500)|
+---------------------------------------+
| [Buy]  998.5 SYN-B                    |
| Fee: 0.00% (Converging)               |
+---------------------------------------+
|           [ Swap Button ]             |
+---------------------------------------+