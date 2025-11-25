'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { usePoolData } from '../hooks/usePoolData';
import { ROUTER_ADDRESS, DEPLOYED_POOL } from '../config/chains';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { useTokenMetadata } from '../hooks/useTokenMetadata';
import { useTokenApproval } from '../hooks/useTokenApproval';
import { TokenLogo } from './TokenLogo';
import { PoolStats } from './PoolStats';
import { Button } from './ui/button';
import { SwapIcon } from './Icons';
import { AddressDisplay } from './AddressDisplay';

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
  const [debouncedInputAmount, setDebouncedInputAmount] = useState('');
  const [inputToken, setInputToken] = useState(0);
  const [outputToken, setOutputToken] = useState(1);
  const [slippage, setSlippage] = useState(0.5);
  const [expectedOutput, setExpectedOutput] = useState<bigint | null>(null);
  const [crossesKink, setCrossesKink] = useState(false);
  const [spotPriceQuote, setSpotPriceQuote] = useState<bigint | null>(null);
  const [swapType, setSwapType] = useState<'converging' | 'diverging' | 'split'>('converging');
  const [feeBreakdown, setFeeBreakdown] = useState({
    basePortionPct: 1,
    kinkPortionPct: 0,
    totalBps: 0,
    softPegTriggered: false,
  });
  const [showInverseRate, setShowInverseRate] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce input amount to reduce RPC calls while user is typing
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedInputAmount(inputAmount);
    }, 300); // 300ms debounce delay

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputAmount]);

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
  const baseFeeBps = poolData.baseFee ? Number(poolData.baseFee) : 0;
  const kinkFeeBps = poolData.kinkingFee ? Number(poolData.kinkingFee) : 0;
  const softPeg0Value = poolData.softPeg0;
  const softPeg1Value = poolData.softPeg1;


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
  // Use debounced amount for RPC calls to reduce requests while typing
  const amountIn = debouncedInputAmount ? BigInt(Math.floor(parseFloat(debouncedInputAmount) * 10 ** inputTokenDecimals)) : BigInt(0);

  const { data: routerOutput, refetch: refetchQuote } = useReadContract({
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
      enabled: !!debouncedInputAmount && !!poolAddress && !!ROUTER_ADDRESS && amountIn > 0,
      staleTime: 5_000, // 5 seconds - quotes can change frequently but we debounce input
      gcTime: 30_000, // 30 seconds cache
    }
  });

  // Fetch spot price quote (small amount) - only refetch when token selection changes, not on every render
  const spotPriceAmount = useMemo(() => BigInt(10 ** Math.max(0, inputTokenDecimals - 2)), [inputTokenDecimals]);
  const { data: spotQuote } = useReadContract({
    address: ROUTER_ADDRESS as `0x${string}`,
    abi: ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: [
      poolAddress as `0x${string}`,
      BigInt(inputToken),
      BigInt(outputToken),
      spotPriceAmount,
    ],
    query: {
      enabled: !!poolAddress && !!ROUTER_ADDRESS && inputTokenDecimals > 0,
      staleTime: 30_000, // 30 seconds - spot price doesn't need frequent updates
      gcTime: 120_000, // 2 minutes cache
    }
  });

  useEffect(() => {
      if(spotQuote) setSpotPriceQuote(spotQuote);
  }, [spotQuote]);

  // Get swap prices for display: 1 token 0 -> token 1
  const oneToken0Amount = useMemo(() => BigInt(10 ** token0Meta.decimals), [token0Meta.decimals]);
  const { data: price0to1 } = useReadContract({
    address: ROUTER_ADDRESS as `0x${string}`,
    abi: ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: [
      poolAddress as `0x${string}`,
      BigInt(0), // token 0
      BigInt(1), // token 1
      oneToken0Amount,
    ],
    query: {
      enabled: !!poolAddress && !!ROUTER_ADDRESS && token0Meta.decimals > 0 && token1Meta.decimals > 0,
      staleTime: 30_000, // 30 seconds
      gcTime: 120_000, // 2 minutes cache
    }
  });

  // Get swap prices for display: 1 token 1 -> token 0
  const oneToken1Amount = useMemo(() => BigInt(10 ** token1Meta.decimals), [token1Meta.decimals]);
  const { data: price1to0 } = useReadContract({
    address: ROUTER_ADDRESS as `0x${string}`,
    abi: ROUTER_ABI,
    functionName: 'getAmountsOut',
    args: [
      poolAddress as `0x${string}`,
      BigInt(1), // token 1
      BigInt(0), // token 0
      oneToken1Amount,
    ],
    query: {
      enabled: !!poolAddress && !!ROUTER_ADDRESS && token0Meta.decimals > 0 && token1Meta.decimals > 0,
      staleTime: 30_000, // 30 seconds
      gcTime: 120_000, // 2 minutes cache
    }
  });

  const { writeContract, data: hash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  // Refetch data after successful swap
  useEffect(() => {
    if (isSuccess) {
      inputTokenApproval.refetchAllowance();
      inputTokenBalance.refetchBalance();
      outputTokenBalance.refetchBalance();
      poolData.refetch();
      refetchQuote();
    }
  }, [isSuccess, inputTokenApproval, inputTokenBalance, outputTokenBalance, poolData, refetchQuote]);

  const reserve0 = poolData.reserves?.reserve0;
  const reserve1 = poolData.reserves?.reserve1;

  useEffect(() => {
    // Use debounced amount for calculations to reduce unnecessary recalculations
    if (
      !debouncedInputAmount ||
      reserve0 === undefined ||
      reserve1 === undefined ||
      !ROUTER_ADDRESS
    ) {
      setExpectedOutput(null);
      setCrossesKink(false);
      setSwapType('converging');
      return;
    }

    const parsedAmount = BigInt(Math.floor(parseFloat(debouncedInputAmount) * 10 ** inputTokenDecimals));

      if (routerOutput !== undefined) {
        setExpectedOutput(routerOutput);

        if (routerOutput === null || routerOutput === BigInt(0)) {
          console.warn('Router returned zero or null output:', {
            inputAmount,
          amount: parsedAmount.toString(),
          amountFormatted: (Number(parsedAmount) / 10 ** inputTokenDecimals).toFixed(6),
            routerOutput: routerOutput?.toString(),
            inputToken,
            outputToken,
            poolAddress,
          reserve0Formatted: (Number(reserve0) / 10 ** token0Meta.decimals).toFixed(6),
          reserve1Formatted: (Number(reserve1) / 10 ** token1Meta.decimals).toFixed(6),
          });
        } else {
          const outputFormatted = Number(routerOutput) / 10 ** outputTokenDecimals;
        const inputFormatted = Number(parsedAmount) / 10 ** inputTokenDecimals;
          const ratio = outputFormatted / inputFormatted;

          if (routerOutput < BigInt(1000) || ratio < 0.01) {
            console.warn('Router returned very small output:', {
              inputAmount,
              inputFormatted: inputFormatted.toFixed(6),
            amount: parsedAmount.toString(),
              routerOutput: routerOutput.toString(),
              outputFormatted: outputFormatted.toFixed(6),
              ratio: ratio.toFixed(6),
              inputToken,
              outputToken,
              poolAddress,
            reserve0Formatted: (Number(reserve0) / 10 ** token0Meta.decimals).toFixed(6),
            reserve1Formatted: (Number(reserve1) / 10 ** token1Meta.decimals).toFixed(6),
              note: 'Very small output may be due to low pool liquidity or calculation rounding',
            });
          }
        }
      } else {
        setExpectedOutput(null);
      }

        const d0 = token0Meta.decimals || 18;
        const d1 = token1Meta.decimals || 18;
        const m0 = 10n ** BigInt(18 - d0);
        const m1 = 10n ** BigInt(18 - d1);

    const xp0 = reserve0 * m0;
    const xp1 = reserve1 * m1;
    const amountNormalized = parsedAmount * (inputToken === 0 ? m0 : m1);

        let isConverging = false;
        let crosses = false;

    if (inputToken === 0) {
             if (xp0 < xp1) {
                 isConverging = true;
                 const sum = xp0 + xp1;
                 const threshold = sum / 2n;
                 const newXP0 = xp0 + amountNormalized;

                 if (newXP0 > threshold) {
                     crosses = true;
                 }
             }
    } else {
            if (xp1 < xp0) {
                isConverging = true;
                const sum = xp0 + xp1;
                const threshold = sum / 2n;
                const newXP1 = xp1 + amountNormalized;

                if (newXP1 > threshold) {
                    crosses = true;
                }
            }
        }

        setCrossesKink(crosses);
        if (crosses) {
            setSwapType('split');
        } else {
            setSwapType(isConverging ? 'converging' : 'diverging');
        }
  }, [
    debouncedInputAmount,
    inputToken,
    outputToken,
    routerOutput,
    inputTokenDecimals,
    outputTokenDecimals,
    poolAddress,
    reserve0,
    reserve1,
    token0Meta.decimals,
    token1Meta.decimals,
  ]);

  useEffect(() => {
    if (
      reserve0 === undefined ||
      reserve1 === undefined ||
      !debouncedInputAmount ||
      parseFloat(debouncedInputAmount) <= 0
    ) {
      setFeeBreakdown({
        basePortionPct: 1,
        kinkPortionPct: 0,
        totalBps: baseFeeBps,
        softPegTriggered: false,
      });
      return;
    }

    const d0 = token0Meta.decimals || 18;
    const d1 = token1Meta.decimals || 18;
    const m0 = 10n ** BigInt(18 - d0);
    const m1 = 10n ** BigInt(18 - d1);
    const xp0 = reserve0 * m0;
    const xp1 = reserve1 * m1;

    const amountIn = BigInt(Math.floor(parseFloat(debouncedInputAmount) * 10 ** inputTokenDecimals));
    if (amountIn <= 0n) {
      setFeeBreakdown({
        basePortionPct: 1,
        kinkPortionPct: 0,
        totalBps: baseFeeBps,
        softPegTriggered: false,
      });
      return;
    }

    const xpInBefore = inputToken === 0 ? xp0 : xp1;
    const xpOutBefore = inputToken === 0 ? xp1 : xp0;
    const inMultiplier = inputToken === 0 ? m0 : m1;
    const outMultiplier = inputToken === 0 ? m1 : m0;
    const amountNormalized = amountIn * inMultiplier;

      const sum = xp0 + xp1;
      const threshold = sum / 2n;
    const inIsConverging = xpInBefore < xpOutBefore;

    const dxNormalizedTotal = amountNormalized;
    const dyNormalizedTotal = expectedOutput ? expectedOutput * outMultiplier : 0n;
    const ONE_18 = 10n ** 18n;

    const softPeg = inputToken === 0 ? softPeg0Value : softPeg1Value;

    const decimalsForCalc = inputTokenDecimals ?? 18;
    const spotSamplePower = Math.max(0, decimalsForCalc - 2);
    const spotSampleAmount =
      decimalsForCalc >= 2
        ? BigInt(10) ** BigInt(spotSamplePower)
        : BigInt(1);
    const spotInputNormalized = spotSampleAmount * inMultiplier;
    const spotOutputNormalized = spotPriceQuote ? spotPriceQuote * outMultiplier : 0n;
    const reservePrice =
      xpInBefore > 0n && xpOutBefore > 0n ? (xpOutBefore * ONE_18) / xpInBefore : 0n;
    const spotPrice =
      spotPriceQuote && spotInputNormalized > 0n
        ? (spotOutputNormalized * ONE_18) / spotInputNormalized
        : reservePrice;

    // Check if softPeg is actually set (not disabled) - do this early to check current price
    // softPeg values >= 100 (normalized) indicate it's disabled
    const softPegNormalized = softPeg ? Number(softPeg) / Number(ONE_18) : 0;
    const isSoftPegSet = softPeg && softPeg > 0n && softPegNormalized < 100;

    // Current price before the swap
    const currentPrice = spotPrice;

    // If already below soft peg, entire trade uses kink fee
    const alreadyBelowSoftPeg = isSoftPegSet && currentPrice < softPeg;

    let basePortion = 0n;
    let divergingPortion = amountNormalized;
    let convergingDx = 0n;

    if (inIsConverging) {
      const toEquilibrium = threshold > xpInBefore ? threshold - xpInBefore : 0n;
      convergingDx = amountNormalized < toEquilibrium ? amountNormalized : toEquilibrium;
      // If already below soft peg, even converging portion uses kink fee
      if (alreadyBelowSoftPeg) {
        // Don't add to basePortion - it will all be kink fee
      } else {
        basePortion = convergingDx;
      }
      divergingPortion = amountNormalized > convergingDx ? amountNormalized - convergingDx : 0n;
    }

    let kinkPortion = 0n;
    let softPegTriggered = false;

    // If already below soft peg, entire trade is kink fee
    if (alreadyBelowSoftPeg) {
      kinkPortion = amountNormalized;
      softPegTriggered = true;
    } else if (divergingPortion > 0n && expectedOutput && dxNormalizedTotal > 0n) {
      const dxBase = convergingDx;
      const dxDiv = divergingPortion;
      const dyBase = (dyNormalizedTotal * dxBase) / dxNormalizedTotal;
      const dyDiv = dyNormalizedTotal > dyBase ? dyNormalizedTotal - dyBase : 0n;

      const dxDivNormalized = dxDiv;
      const priceStart =
        convergingDx > 0n
          ? ONE_18
          : spotPrice;
      const priceEnd =
        dxDivNormalized > 0n && dyDiv > 0n
          ? (dyDiv * ONE_18) / dxDivNormalized
          : spotPrice;

      if (isSoftPegSet) {
        // If we start above peg and end above peg, use base fee
        if (priceStart >= softPeg && priceEnd >= softPeg) {
          basePortion += dxDiv;
        }
        // If we start above peg but end below peg, we cross the soft peg
        else if (priceStart >= softPeg && priceEnd < softPeg) {
          softPegTriggered = true;
          const drop = priceStart > priceEnd ? priceStart - priceEnd : 0n;
          const distanceToPeg = priceStart - softPeg;
          if (drop > 0n && distanceToPeg > 0n) {
            let baseShare = (dxDiv * distanceToPeg) / drop;
            if (baseShare > dxDiv) baseShare = dxDiv;
            basePortion += baseShare;
            kinkPortion = dxDiv - baseShare;
          } else {
            kinkPortion = dxDiv;
          }
        }
        // If we start below peg (shouldn't happen if alreadyBelowSoftPeg check worked, but fallback)
        else {
          kinkPortion = dxDiv;
          softPegTriggered = true;
        }
      } else {
        // No softPeg set, entire diverging portion uses base fee
        basePortion += dxDiv;
      }
    } else {
      basePortion += divergingPortion;
    }

    if (basePortion > amountNormalized) {
      basePortion = amountNormalized;
    }

    // Only recalculate kinkPortion if we haven't already set it based on soft peg logic
    if (!alreadyBelowSoftPeg && kinkPortion === 0n) {
      kinkPortion = amountNormalized > basePortion ? amountNormalized - basePortion : 0n;
    }
    const total = amountNormalized === 0n ? 1n : amountNormalized;
    const basePct = Number(basePortion) / Number(total);
    const kinkPct = Number(kinkPortion) / Number(total);
    const totalBps = basePct * baseFeeBps + kinkPct * kinkFeeBps;

    setFeeBreakdown({
      basePortionPct: Math.min(1, Math.max(0, basePct)),
      kinkPortionPct: Math.min(1, Math.max(0, kinkPct)),
      totalBps,
      softPegTriggered,
    });
  }, [
    baseFeeBps,
    kinkFeeBps,
    debouncedInputAmount,
    inputToken,
    inputTokenDecimals,
    expectedOutput,
    reserve0,
    reserve1,
    spotPriceQuote,
    softPeg0Value,
    softPeg1Value,
    token0Meta.decimals,
    token1Meta.decimals,
  ]);

  // Format Fee Display
  // baseFee and kinkingFee are in basis points (0-10000) where 10000 = 100%.
  // 1 bps = 0.01%.
  // So divide by 100 to get percentage.
  const baseFeeFormatted = baseFeeBps ? (baseFeeBps / 100).toFixed(2) : '0.00';
  const kinkingFeeFormatted = kinkFeeBps ? (kinkFeeBps / 100).toFixed(2) : '0.00';

  const estimatedFeePercent = (feeBreakdown.totalBps / 100).toFixed(2);
  const estimatedFeeTokenValue =
    inputAmount && feeBreakdown.totalBps > 0
      ? (
          (parseFloat(inputAmount) * feeBreakdown.totalBps) /
          10_000
        ).toFixed(6)
      : '0.000000';

  // Determine current fee to display
  const currentFeeDisplay = useMemo(() => {
    if (feeBreakdown.kinkPortionPct > 0) {
      return `${(feeBreakdown.basePortionPct * 100).toFixed(0)}% @ ${baseFeeFormatted}% → ${(feeBreakdown.kinkPortionPct * 100).toFixed(0)}% @ ${kinkingFeeFormatted}%`;
    }
    return `${baseFeeFormatted}%`;
  }, [feeBreakdown, baseFeeFormatted, kinkingFeeFormatted]);

  // Debug fees
  useEffect(() => {
      console.log('Fee Debug:', {
          baseFee: poolData.baseFee?.toString(),
          kinkingFee: poolData.kinkingFee?.toString(),
          baseFeeFormatted,
          kinkingFeeFormatted,
          swapType,
          currentFeeDisplay
      });
  }, [poolData.baseFee, poolData.kinkingFee, baseFeeFormatted, kinkingFeeFormatted, swapType, currentFeeDisplay]);

  // Calculate Price Impact
  const priceImpact = useMemo(() => {
      if (!amountIn || !expectedOutput || !spotPriceQuote) return '<0.01';

      // Spot Price = output / input for small amount
      // Execution Price = expectedOutput / amountIn

      // Normalize to common decimals for ratio comparison
      // Spot Rate = spotOutput / spotInput
      // Real Rate = expectedOutput / amountIn

      const spotInput = BigInt(10 ** Math.max(0, inputTokenDecimals - 2));
      if (spotInput === BigInt(0)) return '<0.01';

      const spotRate = Number(spotPriceQuote) / Number(spotInput);
      const realRate = Number(expectedOutput) / Number(amountIn);

      if (spotRate === 0) return '<0.01';

      const impact = (1 - realRate / spotRate) * 100;
      return impact < 0.01 ? '<0.01' : impact.toFixed(2);
  }, [amountIn, expectedOutput, spotPriceQuote, inputTokenDecimals]);

  const inputSymbol = inputToken === 0 ? (token0Meta.symbol || 'Token 0') : (token1Meta.symbol || 'Token 1');
  const outputSymbol = outputToken === 0 ? (token0Meta.symbol || 'Token 0') : (token1Meta.symbol || 'Token 1');

  const exchangeRate = useMemo(() => {
    if (!amountIn || amountIn === BigInt(0) || !expectedOutput || expectedOutput === BigInt(0)) {
      return null;
    }
    const inputDecimals = inputTokenDecimals ?? 18;
    const outputDecimals = outputTokenDecimals ?? 18;
    const inputQty = Number(amountIn) / 10 ** inputDecimals;
    const outputQty = Number(expectedOutput) / 10 ** outputDecimals;
    if (!isFinite(inputQty) || !isFinite(outputQty) || inputQty === 0 || outputQty === 0) {
      return null;
    }

    const rate = showInverseRate ? inputQty / outputQty : outputQty / inputQty;
    const base = showInverseRate ? inputSymbol : outputSymbol;
    const quote = showInverseRate ? outputSymbol : inputSymbol;

    return {
      value: rate.toFixed(6),
      label: `${base} / ${quote}`,
    };
  }, [
    amountIn,
    expectedOutput,
    inputSymbol,
    outputSymbol,
    inputTokenDecimals,
    outputTokenDecimals,
    showInverseRate,
  ]);

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
          <SwapIcon className="w-12 h-12 text-[#00ffff]" />
          <h2 className="text-4xl font-bold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent">Swap</h2>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/40 px-4 py-2">
          <span className="text-muted-foreground text-sm mr-2">Pool:</span>
          <AddressDisplay
            address={poolAddress}
            className="text-[#00ffff] text-sm"
          />
        </div>
      </div>

      {/* Token Info Row */}
      {token0Address && token1Address && (
        <div className="mb-6 rounded-xl border border-border/50 bg-muted/40 p-4">
          <div className="flex items-center justify-center gap-4 md:gap-6 flex-wrap">
            {/* Token 0 Info Column */}
            <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
              <span className="text-sm font-semibold text-foreground">{token0Meta.symbol || 'Token 0'}</span>
              <div className="rounded-md bg-muted/50 px-2 py-1">
                <AddressDisplay
                  address={token0Address}
                  className="text-xs text-muted-foreground"
                  startChars={6}
                  endChars={4}
                />
              </div>
            </div>

            {/* Token 0 Logo */}
            <div className="flex items-center">
              <TokenLogo address={token0Address} size={40} />
            </div>

            {/* Swap Price: 1 Token 0 -> Token 1 */}
            <div className="flex flex-col items-center gap-1.5 min-w-[120px] rounded-xl border border-border/40 bg-card/40 px-3 py-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">1 {token0Meta.symbol || 'Token 0'}</span>
              <span className="text-base font-semibold text-[#00ffff]">
                {price0to1
                  ? (Number(price0to1) / 10 ** token1Meta.decimals).toFixed(6)
                  : '—'}
              </span>
              <span className="text-xs text-muted-foreground">{token1Meta.symbol || 'Token 1'}</span>
            </div>

            {/* Swap Price: 1 Token 1 -> Token 0 */}
            <div className="flex flex-col items-center gap-1.5 min-w-[120px] rounded-xl border border-border/40 bg-card/40 px-3 py-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">1 {token1Meta.symbol || 'Token 1'}</span>
              <span className="text-base font-semibold text-[#ff00ff]">
                {price1to0
                  ? (Number(price1to0) / 10 ** token0Meta.decimals).toFixed(6)
                  : '—'}
              </span>
              <span className="text-xs text-muted-foreground">{token0Meta.symbol || 'Token 0'}</span>
            </div>

            {/* Token 1 Logo */}
            <div className="flex items-center">
              <TokenLogo address={token1Address} size={40} />
            </div>

            {/* Token 1 Info Column */}
            <div className="flex flex-col items-center gap-1.5 min-w-[100px]">
              <span className="text-sm font-semibold text-foreground">{token1Meta.symbol || 'Token 1'}</span>
              <div className="rounded-md bg-muted/50 px-2 py-1">
                <AddressDisplay
                  address={token1Address}
                  className="text-xs text-muted-foreground"
                  startChars={6}
                  endChars={4}
                />
              </div>
            </div>
          </div>
        </div>
      )}

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
              const currentOutput = expectedOutput ? (Number(expectedOutput) / 10 ** outputTokenDecimals).toFixed(6) : '';
              setInputToken(outputToken);
              setOutputToken(temp);
              setInputAmount(currentOutput);
            }}
            className="relative z-10 rounded-xl border border-border/50 bg-muted/40 hover:border-[#00ffff] w-14 h-14 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:rotate-180"
          >
            <SwapIcon className="w-8 h-8 rotate-90 text-foreground" />
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
              {currentFeeDisplay}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Estimated Fee</span>
            <span className="font-semibold text-xl text-foreground">
              {estimatedFeePercent}% (~{estimatedFeeTokenValue}{' '}
              {inputToken === 0 ? token0Meta.symbol : token1Meta.symbol})
            </span>
          </div>
          {feeBreakdown.softPegTriggered && (
            <p className="text-xs text-yellow-400">
              Soft peg triggered: remaining portion will incur the kink fee.
            </p>
          )}
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
            <span className={`font-semibold text-xl ${Number(priceImpact) > 1 ? 'text-yellow-400' : 'text-green-400'}`}>
              {priceImpact}%
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Exchange Rate</span>
            {exchangeRate ? (
              <button
                type="button"
                onClick={() => setShowInverseRate((prev) => !prev)}
                className="flex flex-col items-end text-right"
              >
                <span className="font-semibold text-xl text-foreground">
                  {exchangeRate.value}
                </span>
                <span className="text-xs text-muted-foreground">
                  {exchangeRate.label}
                </span>
                <span className="text-[10px] text-[#00ffff] mt-1 uppercase tracking-wide">
                  tap to flip
                </span>
              </button>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
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
                  href={`https://optimistic.etherscan.io/tx/${hash}`}
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
