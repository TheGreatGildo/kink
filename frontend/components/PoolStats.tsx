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

  const formatAmplification = (value?: bigint) =>
    typeof value === 'bigint' ? Number(value).toLocaleString() : '—';
  const formatSoftPeg = (value?: bigint) =>
    value && value > 0n ? (Number(value) / 1e18).toFixed(4) : '—';
  const formatFee = (value?: bigint) =>
    typeof value === 'bigint' ? `${(Number(value) / 100).toFixed(2)}%` : '—';

  const parameterTiles = [
    {
      label: 'Amplification (Token 0)',
      value: formatAmplification(poolData.A0),
      hint: token0Meta.symbol ? `${token0Meta.symbol} heavy regime` : undefined,
    },
    {
      label: 'Amplification (Token 1)',
      value: formatAmplification(poolData.A1),
      hint: token1Meta.symbol ? `${token1Meta.symbol} heavy regime` : undefined,
    },
    {
      label: 'Soft Peg (Token 0)',
      value: formatSoftPeg(poolData.softPeg0),
      hint: token0Meta.symbol,
    },
    {
      label: 'Soft Peg (Token 1)',
      value: formatSoftPeg(poolData.softPeg1),
      hint: token1Meta.symbol,
    },
    {
      label: 'Base Fee',
      value: formatFee(poolData.baseFee),
      hint: 'applies above soft peg',
    },
    {
      label: 'Kink Fee',
      value: formatFee(poolData.kinkingFee),
      hint: 'applies below soft peg',
    },
  ];

  return (
    <div className="w-full flex flex-col gap-4 mt-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl border border-border/50 bg-muted/20 backdrop-blur-sm">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted-foreground">Total Liquidity</span>
          <div className="font-semibold text-foreground">
            ${totalLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <div className="text-xs text-muted-foreground flex gap-1 flex-wrap">
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
          <span className="text-xs text-muted-foreground">LP Return (ROI)</span>
          <div className={`font-semibold ${interestEarned >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {interestEarned > 0 ? '+' : ''}{interestEarned.toFixed(4)}%
          </div>
          <span className="text-xs text-muted-foreground">
            Since Inception
          </span>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {parameterTiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-border/40 bg-muted/30 px-4 py-3 text-sm"
          >
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{tile.label}</p>
            <p className="text-lg font-semibold text-foreground">{tile.value}</p>
            {tile.hint && (
              <p className="text-xs text-muted-foreground mt-1">{tile.hint}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

