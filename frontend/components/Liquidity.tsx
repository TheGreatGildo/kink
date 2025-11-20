'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useSimulateContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { usePoolData } from '../hooks/usePoolData';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useTokenMetadata } from '../hooks/useTokenMetadata';
import { useTokenApproval } from '../hooks/useTokenApproval';
import { TokenLogo } from './TokenLogo';
import { PoolStats } from './PoolStats';
import { DEPLOYED_POOL } from '../config/chains';
import { Button } from './ui/button';
import { cn } from '@/lib/utils/cn';

const POOL_ABI = [
  {
    inputs: [
      { internalType: 'uint256[2]', name: 'amounts', type: 'uint256[2]' },
      { internalType: 'uint256', name: 'min_lp', type: 'uint256' },
    ],
    name: 'add_liquidity',
    outputs: [{ internalType: 'uint256', name: 'lpAmount', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: 'lpAmount', type: 'uint256' },
      { internalType: 'uint256[2]', name: 'min_amounts', type: 'uint256[2]' },
    ],
    name: 'remove_liquidity',
    outputs: [{ internalType: 'uint256[2]', name: 'amounts', type: 'uint256[2]' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256[2]', name: 'amounts', type: 'uint256[2]' },
      { internalType: 'bool', name: 'is_deposit', type: 'bool' },
    ],
    name: 'calc_token_amount',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

interface LiquidityProps {
  poolAddress: string;
}

type FlowStep = 'approve0' | 'approve1' | 'deposit';

export default function Liquidity({ poolAddress }: LiquidityProps) {
  const poolData = usePoolData(poolAddress);
  const [action, setAction] = useState<'add' | 'remove'>('add');
  const [amount0, setAmount0] = useState('');
  const [amount1, setAmount1] = useState('');
  const [lpAmount, setLpAmount] = useState('');
  const slippage = 0.5; // Default 0.5% slippage
  const [flowQueue, setFlowQueue] = useState<FlowStep[]>([]);
  const [currentFlowStep, setCurrentFlowStep] = useState<FlowStep | null>(null);
  const [pendingDepositParams, setPendingDepositParams] = useState<{ amounts: [bigint, bigint]; minLp: bigint } | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);

  // Fallback to DEPLOYED_POOL if pool data isn't loaded yet
  const fallbackToken0 = DEPLOYED_POOL.token0?.toLowerCase();
  const fallbackToken1 = DEPLOYED_POOL.token1?.toLowerCase();

  // Get token metadata and balances - ensure addresses are strings and normalized, with fallback
  const token0Address = poolData.token0
    ? String(poolData.token0).toLowerCase()
    : (poolAddress === DEPLOYED_POOL.address ? fallbackToken0 : undefined);
  const token1Address = poolData.token1
    ? String(poolData.token1).toLowerCase()
    : (poolAddress === DEPLOYED_POOL.address ? fallbackToken1 : undefined);

  const token0Meta = useTokenMetadata(token0Address);
  const token1Meta = useTokenMetadata(token1Address);
  const token0Balance = useTokenBalance(token0Address);
  const token1Balance = useTokenBalance(token1Address);
  const flowActive = currentFlowStep !== null || flowQueue.length > 0;
  const SpinnerIcon = () => (
    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
  );

  // Debug: Log token addresses when they change
  useEffect(() => {
    console.log('Liquidity - Pool Data:', {
      poolAddress,
      token0: poolData.token0,
      token1: poolData.token1,
      token0Address,
      token1Address,
      token0Meta,
      token1Meta,
      token0Balance,
      token1Balance,
    });
  }, [poolAddress, poolData.token0, poolData.token1, token0Address, token1Address, token0Meta, token1Meta, token0Balance, token1Balance]);

  // Get LP token balance (the pool itself is the LP token)
  const lpBalance = useTokenBalance(poolAddress);

  // Check approvals for adding liquidity
  const token0Approval = useTokenApproval(token0Address, poolAddress, amount0);
  const token1Approval = useTokenApproval(token1Address, poolAddress, amount1);

  const { writeContract, writeContractAsync, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, isError: isTxError, error: txError } = useWaitForTransactionReceipt({ hash });

  // Refetch approvals after successful transaction
  useEffect(() => {
    if (isSuccess) {
      token0Approval.refetchAllowance();
      token1Approval.refetchAllowance();
    }
  }, [isSuccess, token0Approval, token1Approval]);

  // Show error messages
  useEffect(() => {
    if (writeError) {
      console.error('Write contract error:', writeError);
      alert(`Transaction failed: ${writeError.message}`);
    }
  }, [writeError]);

  useEffect(() => {
    if (isTxError && txError) {
      console.error('Transaction error:', txError);
      alert(`Transaction failed: ${txError.message}`);
    }
  }, [isTxError, txError]);

  // Calculate expected LP output - use parseUnits for proper decimal handling
  const amount0Wei = amount0 && parseFloat(amount0) > 0
    ? parseUnits(amount0, token0Meta.decimals)
    : BigInt(0);
  const amount1Wei = amount1 && parseFloat(amount1) > 0
    ? parseUnits(amount1, token1Meta.decimals)
    : BigInt(0);

  const { data: expectedLP, error: expectedLPError } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'calc_token_amount',
    args: [
      [amount0Wei, amount1Wei],
      true, // is_deposit
    ],
    query: {
        enabled: !!poolAddress && action === 'add' && !!amount0 && !!amount1 && parseFloat(amount0) > 0 && parseFloat(amount1) > 0,
    }
  });

  // Debug expectedLP calculation
  useEffect(() => {
    if (action === 'add' && amount0 && amount1) {
      console.log('Expected LP calculation:', {
        amount0,
        amount1,
        amount0Wei: amount0Wei.toString(),
        amount1Wei: amount1Wei.toString(),
        expectedLP: expectedLP?.toString(),
        expectedLPError: expectedLPError ? {
          message: expectedLPError.message,
          name: expectedLPError.name,
          cause: expectedLPError.cause,
        } : null,
        enabled: !!poolAddress && action === 'add' && !!amount0 && !!amount1 && parseFloat(amount0) > 0 && parseFloat(amount1) > 0,
        poolData: {
          totalSupply: poolData.totalSupply?.toString(),
          reserves: poolData.reserves,
        },
      });
    }
  }, [action, amount0, amount1, amount0Wei, amount1Wei, expectedLP, expectedLPError, poolAddress, poolData]);

  // Prepare transaction parameters for simulation
  const depositAmounts = useMemo<[bigint, bigint] | undefined>(() => {
    if (amount0 && amount1 && parseFloat(amount0) > 0 && parseFloat(amount1) > 0) {
      return [
        parseUnits(amount0, token0Meta.decimals),
        parseUnits(amount1, token1Meta.decimals),
      ];
    }
    return undefined;
  }, [amount0, amount1, token0Meta.decimals, token1Meta.decimals]);

  // Calculate minLp with slippage tolerance
  let minLp: bigint | undefined = undefined;
  if (depositAmounts && expectedLP && expectedLP > BigInt(0)) {
    // Apply slippage tolerance: (100 - slippage)%
    // slippage = 0.5 means we accept 99.5% of expectedLP
    const slippageMultiplier = BigInt(Math.floor((100 - slippage) * 100)); // 9950 for 0.5% slippage
    minLp = (expectedLP * slippageMultiplier) / BigInt(10000);

    // Safety check: if expectedLP seems too high (higher than input amounts), use a more conservative approach
    // This can happen when calc_token_amount returns an incorrect value
    if (expectedLP > depositAmounts[0] && expectedLP > depositAmounts[1]) {
      console.warn('Expected LP is higher than input amounts - using conservative minLp', {
        expectedLP: expectedLP.toString(),
        amounts: depositAmounts.map(a => a.toString()),
        calculatedMinLp: minLp.toString(),
      });
      // Use the smaller amount with slippage as a cap
      const conservativeMinLp = (depositAmounts[0] < depositAmounts[1] ? depositAmounts[0] : depositAmounts[1]) * slippageMultiplier / BigInt(10000);
      if (minLp > conservativeMinLp) {
        console.warn('Capping minLp to conservative value', {
          original: minLp.toString(),
          conservative: conservativeMinLp.toString(),
        });
        minLp = conservativeMinLp;
      }
    }

    console.log('minLp calculation:', {
      expectedLP: expectedLP.toString(),
      slippage,
      slippageMultiplier: slippageMultiplier.toString(),
      minLp: minLp.toString(),
    });
  } else if (depositAmounts) {
    // Fallback: if expectedLP is not available, use 0 to allow transaction
    // This is safe because the contract will revert if slippage is too high
    // But we should warn the user
    minLp = BigInt(0);
    console.warn('expectedLP not available, using minLp = 0 (no slippage protection)', {
      expectedLPError: expectedLPError?.message,
      poolData: {
        totalSupply: poolData.totalSupply?.toString(),
        reserves: poolData.reserves,
      },
    });
  }

  // Simulate the transaction to catch errors before sending
  const { error: simulateError } = useSimulateContract({
    address: poolAddress as `0x${string}`,
    abi: POOL_ABI,
    functionName: 'add_liquidity',
    args: depositAmounts && minLp !== undefined ? [depositAmounts, minLp] : undefined,
    query: {
      enabled: !!poolAddress && !!depositAmounts && minLp !== undefined && poolData.totalSupply !== undefined,
    },
  });

  // Log simulation errors with more detail
  useEffect(() => {
    if (simulateError) {
      console.error('Transaction simulation error:', {
        error: simulateError,
        message: simulateError.message,
        cause: simulateError.cause,
        name: simulateError.name,
        stack: simulateError.stack,
        amounts: depositAmounts,
        minLp: minLp?.toString(),
        poolAddress,
        poolData: {
          totalSupply: poolData.totalSupply?.toString(),
          reserves: poolData.reserves,
        },
      });
    }
  }, [simulateError, depositAmounts, minLp, poolAddress, poolData]);

  const executeFlowStep = useCallback(
    async (step: FlowStep) => {
      setCurrentFlowStep(step);
      try {
        if (step === 'approve0') {
          await token0Approval.approveAsync();
        } else if (step === 'approve1') {
          await token1Approval.approveAsync();
        } else {
          if (!pendingDepositParams) {
            throw new Error('Missing deposit parameters');
          }
          await writeContractAsync({
            address: poolAddress as `0x${string}`,
            abi: POOL_ABI,
            functionName: 'add_liquidity',
            args: [pendingDepositParams.amounts, pendingDepositParams.minLp],
          });
        }
        setFlowQueue((prev) => prev.slice(1));
      } catch (error) {
        console.error('Liquidity flow step failed:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        setFlowError(message);
        alert(`Step failed: ${message}`);
        setFlowQueue([]);
      } finally {
        setCurrentFlowStep(null);
      }
    },
    [token0Approval, token1Approval, pendingDepositParams, poolAddress, writeContractAsync]
  );

  useEffect(() => {
    if (flowQueue.length === 0 || currentFlowStep) return;
    executeFlowStep(flowQueue[0]);
  }, [flowQueue, currentFlowStep, executeFlowStep]);

  useEffect(() => {
    if (flowQueue.length === 0 && !currentFlowStep) {
      setPendingDepositParams(null);
    }
  }, [flowQueue.length, currentFlowStep]);

  const renderAddLiquidityButtonContent = () => {
    if (currentFlowStep === 'approve0') {
      return (
        <span className="flex items-center justify-center gap-4">
          <SpinnerIcon />
          Approving {token0Meta.symbol}...
        </span>
      );
    }
    if (currentFlowStep === 'approve1') {
      return (
        <span className="flex items-center justify-center gap-4">
          <SpinnerIcon />
          Approving {token1Meta.symbol}...
        </span>
      );
    }
    if (currentFlowStep === 'deposit') {
      return (
        <span className="flex items-center justify-center gap-4">
          <SpinnerIcon />
          Depositing...
        </span>
      );
    }
    if (isPending) {
      return (
        <span className="flex items-center justify-center gap-4">
          <SpinnerIcon />
          Adding Liquidity...
        </span>
      );
    }
    if (isConfirming) {
      return (
        <span className="flex items-center justify-center gap-4">
          <SpinnerIcon />
          Confirming...
        </span>
      );
    }
    if (isSuccess) {
      return (
        <span className="flex items-center justify-center gap-4">
          ✓ Liquidity Added!
        </span>
      );
    }
    if (simulateError) {
      return <span>⚠️ Cannot Add Liquidity (See Error Above)</span>;
    }
    if (flowActive) {
      return (
        <span className="flex items-center justify-center gap-4">
          <SpinnerIcon />
          Preparing transaction...
        </span>
      );
    }
    return <span>Add Liquidity</span>;
  };

  const handleAddLiquidity = () => {
    if (flowActive) {
      alert('A liquidity action is already running. Please wait for it to finish.');
      return;
    }

    if (!amount0 || !amount1) {
      alert('Please enter amounts for both tokens');
      return;
    }

    if (!depositAmounts || minLp === undefined) {
      alert('Invalid amounts or minimum LP calculation. Please try again.');
      console.error('Invalid amounts or minLp:', { depositAmounts, minLp });
      return;
    }

    if (simulateError) {
      const errorMsg = simulateError.message || 'Transaction would fail';
      console.error('Transaction simulation failed:', simulateError);
      alert(`Transaction would fail: ${errorMsg}\n\nCheck console for details.`);
      return;
    }

    let adjustedMinLp = minLp;
    if (expectedLP && expectedLP > depositAmounts[0] && expectedLP > depositAmounts[1] && adjustedMinLp !== undefined) {
      console.warn('Expected LP is higher than input amounts - adjusting minLp to conservative value', {
        expectedLP: expectedLP.toString(),
        amounts: depositAmounts.map(a => a.toString()),
      });
      const conservativeMinLp = (depositAmounts[0] < depositAmounts[1] ? depositAmounts[0] : depositAmounts[1]) * BigInt(9950) / BigInt(10000);
      if (adjustedMinLp > conservativeMinLp) {
        adjustedMinLp = conservativeMinLp;
      }
    }

    if (adjustedMinLp === undefined) {
      alert('Unable to determine minimum LP tokens. Please try again.');
      return;
    }

    if (adjustedMinLp === BigInt(0) && !expectedLP) {
      const proceed = confirm(
        'Warning: Cannot calculate expected LP tokens. Proceeding with no slippage protection (minLp = 0).\n\n' +
        'This means the transaction may succeed even if you receive fewer LP tokens than expected.\n\n' +
        'Do you want to continue?'
      );
      if (!proceed) {
        return;
      }
    }

    const steps: FlowStep[] = [];
    if (token0Approval.needsApproval) steps.push('approve0');
    if (token1Approval.needsApproval) steps.push('approve1');
    steps.push('deposit');

    setPendingDepositParams({ amounts: depositAmounts, minLp: adjustedMinLp });
    setFlowQueue(steps);
    setFlowError(null);
  };

  const handleRemoveLiquidity = () => {
    if (!lpAmount || !poolData.reserves || !poolData.totalSupply) {
      alert('Please enter LP amount and ensure pool data is loaded');
      return;
    }

    // LP tokens also use 18 decimals
    const amount = parseUnits(lpAmount, 18);
    const totalSupply = poolData.totalSupply;

    // Calculate min amounts based on current share
    const minAmount0 = (poolData.reserves.reserve0 * amount * BigInt(Math.floor((100 - slippage) * 100))) / (totalSupply * BigInt(10000));
    const minAmount1 = (poolData.reserves.reserve1 * amount * BigInt(Math.floor((100 - slippage) * 100))) / (totalSupply * BigInt(10000));

    const minAmounts: [bigint, bigint] = [minAmount0, minAmount1];

    writeContract({
      address: poolAddress as `0x${string}`,
      abi: POOL_ABI,
      functionName: 'remove_liquidity',
      args: [amount, minAmounts],
    });
  };

  const estimatedLPValue = expectedLP ? Number(expectedLP) / 1e18 : 0;
  const withdrawalEstimates = useMemo(() => {
    if (!lpAmount || !poolData.reserves || !poolData.totalSupply) return null;
    const lpAmountFloat = parseFloat(lpAmount);
    if (Number.isNaN(lpAmountFloat) || lpAmountFloat <= 0) return null;
    const lpAmountWei = parseUnits(lpAmount, 18);
    if (lpAmountWei === BigInt(0) || poolData.totalSupply === BigInt(0)) return null;
    const amount0 = (poolData.reserves.reserve0 * lpAmountWei) / poolData.totalSupply;
    const amount1 = (poolData.reserves.reserve1 * lpAmountWei) / poolData.totalSupply;
    return {
      token0: Number(formatUnits(amount0, token0Meta.decimals)),
      token1: Number(formatUnits(amount1, token1Meta.decimals)),
    };
  }, [lpAmount, poolData.reserves, poolData.totalSupply, token0Meta.decimals, token1Meta.decimals]);

  return (
    <div className="w-full max-w-3xl mx-auto rounded-2xl border border-border/60 bg-card p-6 layered-shadow-lg">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 mb-6 text-center">
        <div className="flex items-center gap-3">
          <span className="text-5xl">𐦒</span>
          <h2 className="text-4xl font-bold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent">Liquidity</h2>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/40 px-4 py-2">
          <span className="text-muted-foreground text-sm mr-2">Pool:</span>
          <code className="text-[#00ffff] text-sm font-mono">
            {poolAddress.slice(0, 6)}...{poolAddress.slice(-4)}
          </code>
        </div>
      </div>

      {/* Action Toggle */}
      <div className="flex gap-3 mb-6 rounded-xl border border-border/50 bg-muted/40 p-2 flex-wrap justify-center">
        <button
          onClick={() => setAction('add')}
          className={cn(
            "px-4 py-2 rounded-xl font-semibold transition-all duration-300",
            action === 'add'
              ? 'bg-linear-to-r from-[#00ffff] to-[#ff00ff] text-black'
              : 'text-muted-foreground bg-transparent border border-border/50 hover:bg-muted/50'
          )}
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">➕</span>
            <span>Add</span>
          </span>
        </button>
        <button
          onClick={() => setAction('remove')}
          className={cn(
            "px-6 py-3 rounded-xl font-semibold transition-all duration-300",
            action === 'remove'
              ? 'bg-linear-to-r from-red-500 to-pink-500 shadow-lg shadow-red-500/50 text-white'
              : 'text-muted-foreground bg-transparent border border-border/50 hover:bg-muted/50'
          )}
        >
          <span className="flex items-center justify-center gap-2">
            <span className="text-xl">➖</span>
            <span>Remove</span>
          </span>
        </button>
      </div>

      {action === 'add' ? (
        <div className="flex flex-col gap-4">
          {/* LP Stats */}
          <div className="rounded-xl border border-border/50 bg-linear-to-r from-[#00ffff]/10 to-[#ff00ff]/10 p-6">
            <div className="flex justify-between">
              <span className="text-foreground">Your LP Balance:</span>
              <span className="font-bold text-[#06ffa5]">{lpBalance.formattedBalance} LP</span>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-foreground">Pool Share:</span>
              <span className="font-bold text-[#8338ec]">
                {poolData.totalSupply && lpBalance.balance
                  ? ((Number(lpBalance.balance) / Number(poolData.totalSupply)) * 100).toFixed(4)
                  : '0.00'}%
              </span>
            </div>
          </div>

          {/* Token 0 Input */}
          <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
            <div className="flex justify-between mb-3">
              <label className="font-semibold text-foreground">Token 0 Amount</label>
              <span className="text-muted-foreground text-sm">
                Balance: {token0Balance.formattedBalance} {token0Meta.symbol}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
              <input
                type="number"
                value={amount0}
                onChange={(e) => setAmount0(e.target.value)}
                className="w-full bg-transparent text-4xl font-bold outline-none text-foreground"
                placeholder="0.0"
                style={{ caretColor: '#06ffa5' }}
              />
              </div>
              <div className="sm:col-span-4">
                <div className="rounded-xl border border-border/50 bg-muted/40 px-4 py-2 flex items-center gap-2 justify-center">
                  <TokenLogo address={token0Address} size={24} />
                  <span className="font-semibold text-[#06ffa5]">{token0Meta.symbol}</span>
                </div>
              </div>
            </div>
            {parseFloat(token0Balance.formattedBalance) > 0 && (
              <button
                onClick={() => setAmount0(token0Balance.formattedBalance)}
                className="mt-2 text-xs text-[#06ffa5] hover:text-[#06ffa5]/80 transition-colors"
              >
                MAX
              </button>
            )}
          </div>

          {/* Plus Symbol */}
          <div className="flex justify-center my-3">
            <div className="rounded-xl border border-border/50 bg-muted/40 w-12 h-12 flex items-center justify-center text-2xl text-[#ff006e]">
              +
            </div>
          </div>

          {/* Token 1 Input */}
          <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
            <div className="flex justify-between mb-3">
              <label className="font-semibold text-foreground">Token 1 Amount</label>
              <span className="text-muted-foreground text-sm">
                Balance: {token1Balance.formattedBalance} {token1Meta.symbol}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
              <div className="sm:col-span-8">
              <input
                type="number"
                value={amount1}
                onChange={(e) => setAmount1(e.target.value)}
                className="w-full bg-transparent text-4xl font-bold outline-none text-foreground"
                placeholder="0.0"
                style={{ caretColor: '#06ffa5' }}
              />
              </div>
              <div className="sm:col-span-4">
                <div className="rounded-xl border border-border/50 bg-muted/40 px-4 py-2 flex items-center gap-2 justify-center">
                  <TokenLogo address={token1Address} size={24} />
                  <span className="font-semibold text-[#8338ec]">{token1Meta.symbol}</span>
                </div>
              </div>
            </div>
            {parseFloat(token1Balance.formattedBalance) > 0 && (
              <button
                onClick={() => setAmount1(token1Balance.formattedBalance)}
                className="mt-2 text-xs text-[#8338ec] hover:text-[#8338ec]/80 transition-colors"
              >
                MAX
              </button>
            )}
          </div>

          {/* Expected LP */}
          {estimatedLPValue > 0 && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-6">
              <div className="flex justify-between">
                <span className="text-foreground">Expected LP Tokens:</span>
                <span className="font-bold text-green-400">
                  ≈ {estimatedLPValue.toFixed(6)}
                </span>
              </div>
            </div>
          )}

          {simulateError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-3">
              <div className="text-red-400 font-semibold mb-1">⚠️ Transaction Error</div>
              <div className="text-sm text-red-300 mb-2">
                {simulateError.message || 'Transaction simulation failed. Check console for details.'}
              </div>
              <div className="text-xs text-red-400/70">
                <div>Pool Address: {poolAddress}</div>
                <div>Pool Total Supply: {poolData.totalSupply !== undefined ? poolData.totalSupply.toString() : '❌ Cannot read (contract may not exist or be initialized)'}</div>
                <div>Pool Reserves: {poolData.reserves ? `${poolData.reserves.reserve0.toString()}, ${poolData.reserves.reserve1.toString()}` : 'Cannot read'}</div>
                <div>Token0 Address: {token0Address || 'Not loaded'}</div>
                <div>Token1 Address: {token1Address || 'Not loaded'}</div>
                    <div>Amounts: {depositAmounts ? `${depositAmounts[0].toString()}, ${depositAmounts[1].toString()}` : 'N/A'}</div>
                <div>Min LP: {minLp ? minLp.toString() : 'N/A'}</div>
                <div>Expected LP: {expectedLP ? expectedLP.toString() : 'Cannot calculate'}</div>
                <div>Token0 Approval: {token0Approval.needsApproval ? '❌ Needed' : '✅ Approved'}</div>
                <div>Token1 Approval: {token1Approval.needsApproval ? '❌ Needed' : '✅ Approved'}</div>
                <div>Token0 Allowance: {token0Approval.allowance ? token0Approval.allowance.toString() : 'Loading...'}</div>
                <div>Token1 Allowance: {token1Approval.allowance ? token1Approval.allowance.toString() : 'Loading...'}</div>
                {poolData.totalSupply === BigInt(0) && (
                  <div className="mt-2 text-yellow-400">
                    ⚠️ Pool is empty. First deposit must create D &gt; 1000 wei after minimum liquidity burn.
                  </div>
                )}
                {poolData.totalSupply === undefined && (
                  <div className="mt-2 text-red-400">
                    ❌ CRITICAL: Cannot read pool state. The contract may not exist at this address or may not be initialized.
                    Please verify the pool address is correct: {poolAddress}
                  </div>
                )}
                <div className="mt-2 text-yellow-400">
                  💡 Common causes: Contract not initialized, insufficient token approval, amounts too small for first deposit, or slippage too strict.
                </div>
              </div>
            </div>
          )}
          {flowError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 mb-3">
              <div className="text-red-400 font-semibold mb-1">⚠️ Flow Error</div>
              <div className="text-sm text-red-300">{flowError}</div>
            </div>
          )}
          <Button
            onClick={handleAddLiquidity}
            disabled={
              flowActive ||
              isPending ||
              isConfirming ||
              !amount0 ||
              !amount1 ||
              parseFloat(amount0) === 0 ||
              parseFloat(amount1) === 0 ||
              !!simulateError
            }
            className="w-full px-4 py-6 text-lg font-bold rounded-xl bg-linear-to-r from-[#06ffa5] via-[#ff006e] to-[#8338ec] text-white hover:opacity-90 transition-opacity mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {renderAddLiquidityButtonContent()}
          </Button>
          {flowActive && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {currentFlowStep === 'approve0'
                ? `Awaiting ${token0Meta.symbol} approval...`
                : currentFlowStep === 'approve1'
                  ? `Awaiting ${token1Meta.symbol} approval...`
                  : currentFlowStep === 'deposit'
                    ? 'Submitting deposit transaction...'
                    : 'Preparing transaction...'}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* LP Stats */}
          <div className="rounded-xl border border-border/50 bg-linear-to-r from-red-500/10 to-pink-500/10 p-6">
            <div className="flex justify-between">
              <span className="text-foreground">Your LP Balance:</span>
              <span className="font-bold text-pink-400">{lpBalance.formattedBalance} LP</span>
            </div>
            <div className="flex justify-between mt-2">
              <span className="text-foreground">Pool Share:</span>
              <span className="font-bold text-red-400">
                {poolData.totalSupply && lpBalance.balance
                  ? ((Number(lpBalance.balance) / Number(poolData.totalSupply)) * 100).toFixed(4)
                  : '0.00'}%
              </span>
            </div>
          </div>

          {/* LP Amount Input */}
          <div className="rounded-xl border border-border/50 bg-muted/40 p-6">
            <div className="flex justify-between mb-3">
              <label className="font-semibold text-foreground">LP Token Amount</label>
              <button
                onClick={() => setLpAmount(lpBalance.formattedBalance)}
                className="text-[#06ffa5] hover:text-[#06ffa5]/80 transition-colors p-0 bg-transparent border-0"
                disabled={parseFloat(lpBalance.formattedBalance) === 0}
              >
                MAX
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              <div className="sm:col-span-8">
              <input
                type="number"
                value={lpAmount}
                onChange={(e) => setLpAmount(e.target.value)}
                className="w-full bg-transparent text-4xl font-bold outline-none text-foreground"
                placeholder="0.0"
                style={{ caretColor: '#ff006e' }}
              />
              </div>
              <div className="sm:col-span-4">
                <div className="rounded-xl border border-border/50 bg-muted/40 px-4 py-2 text-center font-semibold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent">LP</div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className={`h-2 flex-1 rounded-full overflow-hidden bg-black/30 ${lpAmount ? 'animate-pulse' : ''}`}>
                <div
                  className="h-full bg-linear-to-r from-red-500 to-pink-500 transition-all duration-500"
                  style={{ width: lpAmount ? '100%' : '0%' }}
                />
              </div>
            </div>
          </div>

          {/* Expected Return Arrow */}
          <div className="flex justify-center my-3">
            <div className="rounded-xl border border-border/50 bg-muted/40 w-12 h-12 flex items-center justify-center text-2xl">
              ↓
            </div>
          </div>

          {/* Expected Tokens */}
          {withdrawalEstimates && (
            <div className="rounded-xl border border-border/50 bg-muted/40 p-6 flex flex-col gap-3">
              <div className="text-muted-foreground">You will receive:</div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-card/60 border border-border/50">
                <div className="flex items-center gap-2">
                  <TokenLogo address={token0Address} size={20} />
                  <span className="font-semibold text-[#06ffa5]">{token0Meta.symbol}</span>
                </div>
                <span className="text-2xl font-bold">
                  ≈ {withdrawalEstimates.token0.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 rounded-xl bg-card/60 border border-border/50">
                <div className="flex items-center gap-2">
                  <TokenLogo address={token1Address} size={20} />
                  <span className="font-semibold text-[#8338ec]">{token1Meta.symbol}</span>
                </div>
                <span className="text-2xl font-bold">
                  ≈ {withdrawalEstimates.token1.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                </span>
              </div>
            </div>
          )}

          {/* Remove Button */}
          <Button
            onClick={handleRemoveLiquidity}
            disabled={isPending || isConfirming || !lpAmount}
            className="w-full px-4 py-6 text-lg font-bold rounded-xl text-white bg-linear-to-r from-red-500 to-pink-500 hover:opacity-90 transition-opacity shadow-lg hover:shadow-red-500/50 mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-4">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Removing Liquidity...
              </span>
            ) : isConfirming ? (
              <span className="flex items-center justify-center gap-4">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Confirming...
              </span>
            ) : isSuccess ? (
              <span className="flex items-center justify-center gap-4">
                ✓ Liquidity Removed!
              </span>
            ) : (
              <span>Remove Liquidity</span>
            )}
          </Button>
        </div>
      )}

      {/* Success Message */}
      {isSuccess && (
        <div className="rounded-xl border border-green-500/50 bg-green-500/10 p-6 mt-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎉</span>
            <div className="flex-1">
              <div className="font-bold text-green-400 mb-1 text-xl">Transaction Successful!</div>
              <a
                href={`https://optimistic.etherscan.io/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#06ffa5] hover:underline font-mono inline-flex items-center gap-1"
              >
                View on Etherscan →
              </a>
            </div>
          </div>
        </div>
      )}

      <PoolStats poolAddress={poolAddress} />
    </div>
  );
}


