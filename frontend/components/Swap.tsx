'use client';

import { useState, useEffect } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { usePoolData } from '../hooks/usePoolData';
import { ROUTER_ADDRESS, DEPLOYED_POOL } from '../config/chains';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useTokenMetadata } from '../hooks/useTokenMetadata';
import { useTokenApproval } from '../hooks/useTokenApproval';
import { TokenLogo } from './TokenLogo';
import { PoolStats } from './PoolStats';
import { Button } from './ui/button';

const ROUTER_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'pool', type: 'address' },
      { internalType: 'uint256', name: 'i', type: 'uint256' },
      { internalType: 'uint256', name: 'j', type: 'uint256' },
      { internalType: 'uint256', name: 'dx', type: 'uint256' },
    ],
    name: 'getAmountsOut',
    outputs: [{ internalType: 'uint256', name: 'dy', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'pool', type: 'address' },
      { internalType: 'uint256', name: 'i', type: 'uint256' },
      { internalType: 'uint256', name: 'j', type: 'uint256' },
      { internalType: 'uint256', name: 'dx', type: 'uint256' },
      { internalType: 'uint256', name: 'min_dy', type: 'uint256' },
    ],
    name: 'swap',
    outputs: [{ internalType: 'uint256', name: 'dy', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

interface SwapProps {
  poolAddress: string;
}

export default function Swap({ poolAddress }: SwapProps) {
  const [inputAmount, setInputAmount] = useState('');
  const [inputToken, setInputToken] = useState(0);
  const [outputToken, setOutputToken] = useState(1);
  const [slippage, setSlippage] = useState(0.5);
  const [expectedOutput, setExpectedOutput] = useState<bigint | null>(null);
  const [crossesKink, setCrossesKink] = useState(false);

  const poolData = usePoolData(poolAddress);

  // Fallback to DEPLOYED_POOL if pool data isn't loaded yet
  const fallbackToken0 = DEPLOYED_POOL.token0?.toLowerCase();
  const fallbackToken1 = DEPLOYED_POOL.token1?.toLowerCase();

  // Ensure token addresses are strings and normalized, with fallback
  const token0Address = poolData.token0
    ? String(poolData.token0).toLowerCase()
    : (poolAddress === DEPLOYED_POOL.address ? fallbackToken0 : undefined);
  const token1Address = poolData.token1
    ? String(poolData.token1).toLowerCase()
    : (poolAddress === DEPLOYED_POOL.address ? fallbackToken1 : undefined);

  // Debug logging
  useEffect(() => {
    console.log('Swap - Pool Data:', {
      poolAddress,
      poolDataToken0: poolData.token0,
      poolDataToken1: poolData.token1,
      token0Address,
      token1Address,
      fallbackToken0,
      fallbackToken1,
      usingFallback: !poolData.token0 || !poolData.token1,
    });
  }, [poolAddress, poolData.token0, poolData.token1, token0Address, token1Address, fallbackToken0, fallbackToken1]);

  // Get token metadata for both tokens
  const token0Meta = useTokenMetadata(token0Address);
  const token1Meta = useTokenMetadata(token1Address);

  // Get token addresses based on selection
  const inputTokenAddress = token0Address && token1Address
    ? (inputToken === 0 ? token0Address : token1Address)
    : undefined;
  const outputTokenAddress = token0Address && token1Address
    ? (outputToken === 0 ? token0Address : token1Address)
    : undefined;

  // Get balances for selected tokens
  const inputTokenBalance = useTokenBalance(inputTokenAddress);
  const outputTokenBalance = useTokenBalance(outputTokenAddress);

  // Check approval for swap (Router needs approval to transfer tokens)
  const inputTokenApproval = useTokenApproval(inputTokenAddress, ROUTER_ADDRESS, inputAmount);

  // Use actual token decimals instead of hardcoded 18
  const inputTokenDecimals = inputToken === 0 ? token0Meta.decimals : token1Meta.decimals;
  const outputTokenDecimals = outputToken === 0 ? token0Meta.decimals : token1Meta.decimals;
  const amountIn = inputAmount ? BigInt(Math.floor(parseFloat(inputAmount) * 10 ** inputTokenDecimals)) : BigInt(0);

  const { data: routerOutput } = useReadContract({
    address: ROUTER_ADDRESS as `0x${string}`,
    abi: ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: [
      poolAddress as `0x${string}`,
      BigInt(inputToken),
      BigInt(outputToken),
      amountIn,
    ],
    query: {
      enabled: !!inputAmount && !!poolAddress && !!ROUTER_ADDRESS && amountIn > 0,
    }
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Refetch approval after successful swap
  useEffect(() => {
    if (isSuccess) {
      inputTokenApproval.refetchAllowance();
    }
  }, [isSuccess, inputTokenApproval]);

  useEffect(() => {
    if (inputAmount && poolData.reserves && ROUTER_ADDRESS) {
      const amount = BigInt(Math.floor(parseFloat(inputAmount) * 10 ** inputTokenDecimals));

      // Update expected output when router data changes
      if (routerOutput !== undefined) {
        setExpectedOutput(routerOutput);

        // Log for debugging - show why output might be small
        if (routerOutput === null || routerOutput === BigInt(0)) {
          console.warn('Router returned zero or null output:', {
            inputAmount,
            amount: amount.toString(),
            amountFormatted: (Number(amount) / 10 ** inputTokenDecimals).toFixed(6),
            routerOutput: routerOutput?.toString(),
            inputToken,
            outputToken,
            poolAddress,
            reserves: poolData.reserves,
            reserve0Formatted: poolData.reserves ? (Number(poolData.reserves.reserve0) / 10 ** token0Meta.decimals).toFixed(6) : 'N/A',
            reserve1Formatted: poolData.reserves ? (Number(poolData.reserves.reserve1) / 10 ** token1Meta.decimals).toFixed(6) : 'N/A',
          });
        } else {
          // Log when output is very small
          const outputFormatted = Number(routerOutput) / 10 ** outputTokenDecimals;
          const inputFormatted = Number(amount) / 10 ** inputTokenDecimals;
          const ratio = outputFormatted / inputFormatted;

          if (routerOutput < BigInt(1000) || ratio < 0.01) {
            console.warn('Router returned very small output:', {
              inputAmount,
              inputFormatted: inputFormatted.toFixed(6),
              amount: amount.toString(),
              routerOutput: routerOutput.toString(),
              outputFormatted: outputFormatted.toFixed(6),
              ratio: ratio.toFixed(6),
              inputToken,
              outputToken,
              poolAddress,
              reserves: poolData.reserves,
              reserve0Formatted: poolData.reserves ? (Number(poolData.reserves.reserve0) / 10 ** token0Meta.decimals).toFixed(6) : 'N/A',
              reserve1Formatted: poolData.reserves ? (Number(poolData.reserves.reserve1) / 10 ** token1Meta.decimals).toFixed(6) : 'N/A',
              note: 'Very small output may be due to low pool liquidity or calculation rounding',
            });
          }
        }
      } else {
        // Clear expected output if router query is disabled or failed
        setExpectedOutput(null);
      }

      // Check if swap crosses kink
      if (poolData.reserves && poolData.currentPrice) {
        const reserve0 = Number(poolData.reserves.reserve0);
        const reserve1 = Number(poolData.reserves.reserve1);

        if (inputToken === 0 && outputToken === 1) {
          setCrossesKink(reserve0 < reserve1 && amount > BigInt(reserve1 - reserve0));
        } else if (inputToken === 1 && outputToken === 0) {
          setCrossesKink(reserve1 < reserve0 && amount > BigInt(reserve0 - reserve1));
        } else {
          setCrossesKink(false);
        }
      }
    }
  }, [inputAmount, inputToken, outputToken, poolData, routerOutput, inputTokenDecimals, outputTokenDecimals, poolAddress, token0Meta.decimals, token1Meta.decimals]);

  const handleSwap = () => {
    if (!inputAmount || !poolAddress || !ROUTER_ADDRESS) return;

    // Check if approval is needed first
    if (inputTokenApproval.needsApproval) {
      inputTokenApproval.approve();
      return;
    }

    // Validate expected output
    if (!expectedOutput || expectedOutput === BigInt(0)) {
      alert('Cannot calculate expected output. Please check your input amount and try again.');
      console.error('Swap failed: expectedOutput is 0 or null', {
        inputAmount,
        expectedOutput: expectedOutput?.toString(),
        routerOutput: routerOutput?.toString(),
        poolAddress,
      });
      return;
    }

    const amount = BigInt(Math.floor(parseFloat(inputAmount) * 10 ** inputTokenDecimals));

    // Calculate minOutput with slippage tolerance
    // slippage = 0.5 means we accept 99.5% of expectedOutput
    const slippageMultiplier = BigInt(Math.floor((100 - slippage) * 100)); // 9950 for 0.5% slippage

    // Use a more precise calculation to avoid rounding issues
    // Multiply first, then divide to preserve precision
    const minOutput = (expectedOutput * slippageMultiplier) / BigInt(10000);

    // Log the calculation for debugging
    console.log('MinOutput calculation:', {
      inputAmount,
      amount: amount.toString(),
      expectedOutput: expectedOutput.toString(),
      expectedOutputFormatted: (Number(expectedOutput) / 10 ** outputTokenDecimals).toFixed(6),
      slippage,
      slippageMultiplier: slippageMultiplier.toString(),
      minOutput: minOutput.toString(),
      minOutputFormatted: (Number(minOutput) / 10 ** outputTokenDecimals).toFixed(6),
      inputTokenDecimals,
      outputTokenDecimals,
    });

    // CRITICAL: Never allow minOutput to be 0
    // If expectedOutput is so small that minOutput rounds to 0, the swap is not viable
    if (minOutput === BigInt(0)) {
      if (expectedOutput === BigInt(0)) {
        alert('Expected output is zero. The router cannot calculate a valid output for this swap. This may be due to:\n- Pool liquidity too low\n- Swap amount too small\n- Calculation convergence issue\n\nPlease try a larger swap amount or check pool liquidity.');
        console.error('Swap failed: expectedOutput is 0', {
          inputAmount,
          amount: amount.toString(),
          routerOutput: routerOutput?.toString(),
          poolAddress,
          reserves: poolData.reserves,
        });
        return;
      } else {
        // Expected output exists but minOutput rounded to 0 due to slippage calculation
        // This happens when expectedOutput < 10000/slippageMultiplier wei
        // For 0.5% slippage (9950), that's about 1.005 wei
        const minExpectedForNonZero = BigInt(10000) / slippageMultiplier + BigInt(1);
        alert(
          `Swap amount is too small. Expected output is ${(Number(expectedOutput) / 10 ** outputTokenDecimals).toFixed(6)} tokens, ` +
          `but after applying ${slippage}% slippage tolerance, the minimum output would be zero.\n\n` +
          `Please increase your input amount to get at least ${(Number(minExpectedForNonZero) / 10 ** outputTokenDecimals).toFixed(6)} tokens output.`
        );
        console.error('Swap failed: minOutput is 0 but expectedOutput > 0', {
          inputAmount,
          amount: amount.toString(),
          expectedOutput: expectedOutput.toString(),
          expectedOutputFormatted: (Number(expectedOutput) / 10 ** outputTokenDecimals).toFixed(6),
          slippage,
          slippageMultiplier: slippageMultiplier.toString(),
          calculatedMinOutput: minOutput.toString(),
          minExpectedForNonZero: minExpectedForNonZero.toString(),
          poolAddress,
          reserves: poolData.reserves,
        });
        return;
      }
    }

    console.log('Executing swap:', {
      poolAddress,
      inputToken,
      outputToken,
      amount: amount.toString(),
      expectedOutput: expectedOutput.toString(),
      minOutput: minOutput.toString(),
      slippage,
    });

    // Use Router for swap - it handles token transfers
    writeContract({
      address: ROUTER_ADDRESS as `0x${string}`,
      abi: ROUTER_ABI,
      functionName: 'swap',
      args: [
        poolAddress as `0x${string}`,
        BigInt(inputToken),
        BigInt(outputToken),
        amount,
        minOutput,
      ],
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto rounded-2xl border border-border/60 bg-card p-6 layered-shadow-lg">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 mb-6 text-center">
        <div className="flex items-center gap-3">
          <span className="text-5xl">𓁔</span>
          <h2 className="text-4xl font-bold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent">Swap</h2>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/40 px-4 py-2">
          <span className="text-muted-foreground text-sm mr-2">Pool:</span>
          <code className="text-[#00ffff] text-sm font-mono">
            {poolAddress.slice(0, 6)}...{poolAddress.slice(-4)}
          </code>
        </div>
      </div>

      {/* Kink Warning */}
      {crossesKink && (
        <div className="mb-8 relative overflow-hidden rounded-xl bg-linear-to-r from-pink-500/20 to-purple-500/20 border border-pink-500/50 p-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/20 rounded-full blur-3xl"></div>
          <div className="relative z-10 flex items-start gap-4">
            <span className="text-4xl animate-bounce">🌀</span>
            <div>
              <div className="font-bold text-pink-300 mb-2 flex items-center gap-3 text-lg">
                <span>Kink Cross Detected!</span>
                <span className="text-xs bg-pink-500/30 px-3 py-1 rounded-full">SPLIT-SWAP</span>
              </div>
              <p className="text-sm text-foreground">
                This trade crosses the 1:1 equilibrium. Split-swap will be executed for optimal pricing.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 md:gap-6">
        {/* Sell Token */}
        <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
          <div className="flex justify-between mb-3">
            <label className="font-semibold text-foreground">You Pay</label>
            <span className="text-muted-foreground text-sm">
              Balance: {inputTokenBalance.formattedBalance} {inputToken === 0 ? token0Meta.symbol : token1Meta.symbol}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-8">
            <input
              type="number"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="w-full bg-transparent text-4xl font-bold outline-none text-foreground"
              placeholder="0.0"
              style={{ caretColor: '#06ffa5' }}
            />
            </div>
            <div className="sm:col-span-4">
              <div className="rounded-xl border border-border/50 bg-muted/40 px-4 py-2 flex items-center gap-2">
                <TokenLogo address={inputTokenAddress} size={24} />
              <select
                value={inputToken}
                onChange={(e) => setInputToken(Number(e.target.value))}
                  className="bg-transparent text-foreground border-0 flex-1 outline-none cursor-pointer"
              >
                  <option value={0}>{token0Meta.symbol || token0Address?.slice(0, 6) || 'Token 0'}</option>
                  <option value={1}>{token1Meta.symbol || token1Address?.slice(0, 6) || 'Token 1'}</option>
              </select>
              </div>
            </div>
          </div>
          {parseFloat(inputTokenBalance.formattedBalance) > 0 && (
            <button
                onClick={() => setInputAmount(inputTokenBalance.formattedBalance)}
                className="mt-2 text-xs text-[#00ffff] hover:text-[#00ffff]/80 transition-colors"
            >
              MAX
            </button>
          )}
          <div className="mt-3 flex items-center gap-2">
            <div className={`h-2 flex-1 rounded-full overflow-hidden bg-black/30 ${inputAmount ? 'animate-pulse' : ''}`}>
              <div
                className="h-full bg-linear-to-r from-[#00ffff] to-[#ff00ff] transition-all duration-500"
                style={{ width: inputAmount ? '100%' : '0%' }}
              />
            </div>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="relative flex items-center justify-center my-3">
          <div className="absolute w-full h-px bg-linear-to-r from-transparent via-[#ff00ff] to-transparent"></div>
          <button
            onClick={() => {
              const temp = inputToken;
              setInputToken(outputToken);
              setOutputToken(temp);
              setInputAmount(''); // Clear input when swapping
            }}
            className="relative z-10 rounded-xl border border-border/50 bg-muted/40 hover:border-[#00ffff] w-14 h-14 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:rotate-180"
          >
            <span className="text-3xl">⇅</span>
          </button>
        </div>

        {/* Buy Token */}
        <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
          <div className="flex justify-between mb-3">
            <label className="font-semibold text-foreground">You Receive</label>
            <span className="text-muted-foreground text-sm">
              Balance: {outputTokenBalance.formattedBalance} {outputToken === 0 ? token0Meta.symbol : token1Meta.symbol}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
            <div className="sm:col-span-8">
              <input
                type="text"
                value={expectedOutput ? (Number(expectedOutput) / 10 ** outputTokenDecimals).toFixed(6) : '0.0'}
                readOnly
                className="w-full bg-transparent text-4xl font-bold outline-none text-[#00ffff]"
                placeholder="0.0"
              />
            </div>
            <div className="sm:col-span-4">
              <div className="rounded-xl border border-border/50 bg-muted/40 px-4 py-2 flex items-center gap-2">
                <TokenLogo address={outputTokenAddress} size={24} />
              <select
                value={outputToken}
                onChange={(e) => setOutputToken(Number(e.target.value))}
                  className="bg-transparent text-foreground border-0 flex-1 outline-none cursor-pointer"
              >
                  <option value={0}>{token0Meta.symbol || token0Address?.slice(0, 6) || 'Token 0'}</option>
                  <option value={1}>{token1Meta.symbol || token1Address?.slice(0, 6) || 'Token 1'}</option>
              </select>
              </div>
            </div>
          </div>
          <div className="mt-3">
            {expectedOutput && expectedOutput > BigInt(0) ? (
              <>
                <div className="text-sm text-muted-foreground flex items-center gap-2">
                  <span>≈ ${(Number(expectedOutput) / 10 ** outputTokenDecimals).toFixed(2)}</span>
                  <span className="text-green-400">+0.00%</span>
                </div>
                {/* Warn if output is suspiciously small compared to input */}
                {inputAmount && parseFloat(inputAmount) > 0 && (() => {
                  const inputValue = parseFloat(inputAmount);
                  const outputValue = Number(expectedOutput) / 10 ** outputTokenDecimals;
                  const ratio = outputValue / inputValue;

                  // Warn if output is less than 0.1% of input (very poor rate)
                  if (ratio < 0.001 && outputValue < 0.000001) {
                    return (
                      <div className="text-xs text-yellow-400 mt-1">
                        ⚠️ Very small output detected. This may be due to low pool liquidity. Consider using a larger swap amount.
                      </div>
                    );
                  }
                  return null;
                })()}
              </>
            ) : expectedOutput === BigInt(0) && inputAmount ? (
              <div className="text-sm text-yellow-400 flex items-center gap-2">
                <span>⚠️ Expected output is zero. Swap will fail. This may be due to:</span>
                <ul className="text-xs list-disc list-inside mt-1 ml-2">
                  <li>Pool liquidity too low</li>
                  <li>Swap amount too small</li>
                  <li>Calculation convergence issue</li>
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        {/* Slippage Control */}
        <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
          <div className="flex justify-between mb-3 items-center">
            <label className="font-semibold text-foreground">Slippage Tolerance</label>
            <span className="text-xl font-bold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent">{slippage}%</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            value={slippage}
            onChange={(e) => setSlippage(Number(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-3">
            <span>0.1%</span>
            <span>5%</span>
          </div>
        </div>

        {/* Swap Stats */}
        <div className="rounded-xl border border-border/50 bg-muted/40 p-6 flex flex-col gap-3 text-base">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Fee</span>
            <span className="font-semibold text-[#00ffff] text-xl">
              {crossesKink ? '0.00% → 0.10%' : '0.04%'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Min Received</span>
            <span className="font-semibold text-xl">
              {expectedOutput
                ? ((Number(expectedOutput) / 10 ** outputTokenDecimals) * (1 - slippage / 100)).toFixed(6)
                : '0.0'}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Price Impact</span>
            <span className="font-semibold text-green-400 text-xl">{'<0.01%'}</span>
          </div>
        </div>

        {/* Approval Button or Swap Button */}
        {inputTokenApproval.needsApproval ? (
          <Button
            onClick={() => inputTokenApproval.approve()}
            disabled={inputTokenApproval.isApproving || isPending || isConfirming}
            className="w-full px-4 py-6 text-lg font-bold rounded-xl bg-linear-to-r from-[#00ffff] to-[#ff00ff] text-black hover:opacity-90 transition-opacity mt-2"
          >
            {inputTokenApproval.isApproving ? (
              <span className="flex items-center justify-center gap-4">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Approving {inputToken === 0 ? token0Meta.symbol : token1Meta.symbol}...
              </span>
            ) : (
              <span>Approve {inputToken === 0 ? token0Meta.symbol : token1Meta.symbol}</span>
            )}
          </Button>
        ) : (
          <Button
            onClick={handleSwap}
            disabled={isPending || isConfirming || !inputAmount || !expectedOutput || expectedOutput === BigInt(0)}
            className="w-full px-4 py-6 text-lg font-bold rounded-xl bg-linear-to-r from-[#00ffff] to-[#ff00ff] text-black hover:opacity-90 transition-opacity mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-4">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Swapping...
              </span>
            ) : isConfirming ? (
              <span className="flex items-center justify-center gap-4">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Confirming...
              </span>
            ) : isSuccess ? (
              <span className="flex items-center justify-center gap-4">
                ✓ Swapped Successfully!
              </span>
            ) : (
              <span>Swap Now</span>
            )}
          </Button>
        )}

        {/* Success Message */}
        {isSuccess && (
          <div className="rounded-xl border border-green-500/50 bg-green-500/10 p-6 mt-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">✨</span>
              <div className="flex-1">
                <div className="font-bold text-green-400 mb-1 text-xl">Swap Successful!</div>
                <a
                  href={`https://sepolia-optimism.etherscan.io/tx/${hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#00ffff] hover:underline font-mono inline-flex items-center gap-1"
                >
                  View on Etherscan →
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
      <PoolStats poolAddress={poolAddress} />
    </div>
  );
}

