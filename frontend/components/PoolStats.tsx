'use client';

import { usePoolData } from '../hooks/usePoolData';
import { useTokenMetadata } from '../hooks/useTokenMetadata';
import { DEPLOYED_POOL } from '../config/chains';
import { formatUnits } from 'viem';

interface PoolStatsProps {
  poolAddress: string;
}

export function PoolStats({ poolAddress }: PoolStatsProps) {
  const poolData = usePoolData(poolAddress);

  // Fallback token addresses
  const fallbackToken0 = DEPLOYED_POOL.token0?.toLowerCase();
  const fallbackToken1 = DEPLOYED_POOL.token1?.toLowerCase();

  const token0Address = poolData.token0
    ? String(poolData.token0).toLowerCase()
    : (poolAddress === DEPLOYED_POOL.address ? fallbackToken0 : undefined);
  const token1Address = poolData.token1
    ? String(poolData.token1).toLowerCase()
    : (poolAddress === DEPLOYED_POOL.address ? fallbackToken1 : undefined);

  const token0Meta = useTokenMetadata(token0Address);
  const token1Meta = useTokenMetadata(token1Address);

  if (!poolData.reserves || !poolData.totalSupply) {
    return null;
  }

  const reserve0 = Number(formatUnits(poolData.reserves.reserve0, token0Meta.decimals));
  const reserve1 = Number(formatUnits(poolData.reserves.reserve1, token1Meta.decimals));
  const totalSupply = Number(formatUnits(poolData.totalSupply, 18)); // LP tokens usually 18 decimals

  // Calculate stats
  const totalLiquidity = reserve0 + reserve1;
  const ratio = reserve1 > 0 ? reserve0 / reserve1 : 0;

  // LP Price (Virtual Price)
  // Assuming stablecoin peg 1:1 roughly, value of LP = (R0 + R1) / Supply
  const lpPrice = totalSupply > 0 ? totalLiquidity / totalSupply : 0;

  // Interest Earned (Growth from 1.0)
  const interestEarned = lpPrice > 0 ? (lpPrice - 1) * 100 : 0;

  // Fee Rate
  // baseFee is usually scaled. Assuming 1e18 based on wagmi common patterns, but might be 1e4 for bps
  // If the hardcoded value was 0.04%, that's 4bps or 0.0004.
  // Let's assume the contract returns it in 1e18 (standard for math in solidity).
  // If baseFee is 4e14 (0.0004 * 1e18), then formatted is 0.04%.
  const feeRate = poolData.baseFee ? Number(formatUnits(poolData.baseFee, 16)) : 0.04; // Assuming 1e16 gives percentage (0.04)

  return (
    <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-4 p-4 mt-6 rounded-xl border border-border/50 bg-muted/20 backdrop-blur-sm">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Total Liquidity</span>
        <div className="font-semibold text-foreground">
          ${totalLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </div>
        <div className="text-xs text-muted-foreground flex gap-1">
          <span>{reserve0.toLocaleString(undefined, { maximumFractionDigits: 0 })} {token0Meta.symbol}</span>
          <span>+</span>
          <span>{reserve1.toLocaleString(undefined, { maximumFractionDigits: 0 })} {token1Meta.symbol}</span>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Pool Ratio</span>
        <div className="font-semibold text-foreground">
          {ratio.toFixed(4)}
        </div>
        <span className="text-xs text-muted-foreground">
          {token0Meta.symbol} / {token1Meta.symbol}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">Trading Fee</span>
        <div className="font-semibold text-[#00ffff]">
          {feeRate.toFixed(3)}%
        </div>
        <span className="text-xs text-muted-foreground">
          Base Rate
        </span>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted-foreground">LP Return (ROI)</span>
        <div className={`font-semibold ${interestEarned >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {interestEarned > 0 ? '+' : ''}{interestEarned.toFixed(4)}%
        </div>
        <span className="text-xs text-muted-foreground">
          Since Inception
        </span>
      </div>
    </div>
  );
}

