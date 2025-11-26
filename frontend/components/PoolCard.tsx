import NextLink from 'next/link';
import { Pool } from '@/hooks/usePools';
import { Button } from './ui/button';
import { cn } from '@/lib/utils/cn';
import { useTokenMetadata } from '@/hooks/useTokenMetadata';
import { TokenLogo } from './TokenLogo';
import { usePoolData } from '@/hooks/usePoolData';
import { formatUnits } from 'viem';
import { AddressDisplay } from './AddressDisplay';

interface PoolCardProps {
  pool: Pool;
  isActive?: boolean;
  onSelect: (poolAddress: string) => void;
}

export function PoolCard({ pool, isActive, onSelect }: PoolCardProps) {
  const handleSelect = () => onSelect(pool.poolAddress);
  const poolData = usePoolData(pool.poolAddress);
  const token0Address = poolData.token0 ?? pool.token0;
  const token1Address = poolData.token1 ?? pool.token1;
  const token0Meta = useTokenMetadata(token0Address);
  const token1Meta = useTokenMetadata(token1Address);

  const reserve0 = poolData.reserves
    ? Number(formatUnits(poolData.reserves.reserve0, token0Meta.decimals))
    : 0;
  const reserve1 = poolData.reserves
    ? Number(formatUnits(poolData.reserves.reserve1, token1Meta.decimals))
    : 0;
  const totalLiquidity = reserve0 + reserve1;
  const ratio = reserve1 > 0 ? reserve0 / reserve1 : 0;

  const amplificationA0 = poolData.A0 ?? pool.A0;
  const amplificationA1 = poolData.A1 ?? pool.A1;
  const softPeg0 = poolData.softPeg0 ?? pool.softPeg0 ?? 0n;
  const softPeg1 = poolData.softPeg1 ?? pool.softPeg1 ?? 0n;

  const formatAmplification = (value?: bigint) =>
    typeof value === 'bigint' ? Number(value).toLocaleString() : '—';

  const formatSoftPeg = (value: bigint) => {
    if (value === 0n) return '—';
    const normalized = Number(value) / 1e18;
    // Values >= 100 indicate softPeg is not set (disabled)
    return normalized >= 100 ? '—' : normalized.toFixed(4);
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={handleSelect}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleSelect();
        }
      }}
      className={cn(
        'group relative w-full rounded-2xl border border-border/50 bg-card p-6 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        'layered-shadow-lg data-[animate-shadow=true] hover:-translate-y-0.5',
        isActive && 'ring-2 ring-primary/70',
      )}
      data-animate-shadow="true"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#00ffff] to-[#ff00ff]" />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.3em] text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-muted px-3 py-1 text-[0.65rem]">Pool</span>
              <div className="rounded-md bg-muted/50 px-2 py-1 text-[0.65rem]">
                <AddressDisplay
                  address={pool.poolAddress}
                  className="text-foreground"
                  startChars={6}
                  endChars={4}
                />
              </div>
            </div>
            <span className="rounded-full border border-border/60 px-3 py-1 text-[0.65rem]">
              AMP CURVE
            </span>
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <TokenPairDisplay
              token0={token0Address}
              token1={token1Address}
              token0Symbol={token0Meta.symbol}
              token1Symbol={token1Meta.symbol}
            />

          </div>
          <p className="text-xs text-muted-foreground">
              Dynamic depeg fees with configurable soft pegs.
            </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <TokenTile
              tokenAddress={token0Address}
              label="Token 0"
              tokenSymbol={token0Meta.symbol}
              tokenName={token0Meta.name}
            />
            <TokenTile
              tokenAddress={token1Address}
              label="Token 1"
              tokenSymbol={token1Meta.symbol}
              tokenName={token1Meta.name}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <ActionButton
              href={`/swap?pool=${pool.poolAddress}`}
              label="Swap"
              gradient="from-[#00ffff] to-[#ff00ff]"
            />
            <ActionButton
              href={`/liquidity?pool=${pool.poolAddress}`}
              label="Provide Liquidity"
              gradient="from-[#ff00ff] to-[#00ffff]"
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-secondary/60 p-6 pt-5 text-sm text-foreground dark:bg-white/5">
          <div className="grid grid-cols-2 gap-3">
            <StatMini label="Total Liquidity" value={`$${totalLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} />
            <StatMini label="Pool Ratio" value={ratio.toFixed(4)} align="end" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <MetricPill label="Base Fee" value={`${Number(pool.baseFee) / 100}%`} />
            <MetricPill label="Depeg Fee" value={`${Number(pool.kinkingFee) / 100}%`} />
            <MetricPill label={`${token0Meta.symbol} LQ.`} value={formatAmplification(amplificationA0)} />
            <MetricPill label={`${token1Meta.symbol} LQ.`} value={formatAmplification(amplificationA1)} />
            <MetricPill label={`${token0Meta.symbol} Soft Peg`} value={formatSoftPeg(softPeg0)} />
            <MetricPill label={`${token1Meta.symbol} Soft Peg`} value={formatSoftPeg(softPeg1)} />
          </div>
        </div>
      </div>
    </article>
  );
}

const TokenTile = ({
  label,
  tokenAddress,
  tokenSymbol,
  tokenName,
}: {
  label: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
}) => {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <TokenLogo address={tokenAddress} size={24} />
        <div>
          <p className="font-semibold text-foreground">{tokenSymbol}</p>
          <p className="text-xs text-muted-foreground">{tokenName}</p>
        </div>
      </div>
    </div>
  );
};

const TokenPairDisplay = ({
  token0,
  token1,
  token0Symbol,
  token1Symbol,
}: {
  token0: string;
  token1: string;
  token0Symbol: string;
  token1Symbol: string;
}) => {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <TokenLogo address={token0} size={32} />
        <TokenLogo address={token1} size={32} className="-ml-2" />
      </div>
      <p className="text-2xl font-semibold text-foreground">
        {token0Symbol} / {token1Symbol}
      </p>
    </div>
  );
};

const MetricPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border/60 bg-card/60 px-3 py-2">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="text-lg font-semibold text-foreground">{value}</p>
  </div>
);

const StatMini = ({
  label,
  value,
  align = 'start',
}: {
  label: string;
  value: string;
  align?: 'start' | 'end';
}) => (
  <div className="rounded-xl border border-border/40 bg-card/40 px-4 py-3 flex flex-col">
    <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    <span
      className={cn(
        'text-lg font-semibold text-foreground',
        align === 'end' ? 'text-right' : 'text-left',
      )}
    >
      {value}
    </span>
  </div>
);

const ActionButton = ({
  href,
  label,
  gradient,
}: {
  href: string;
  label: string;
  gradient: string;
}) => (
  <NextLink href={href} className="flex-1">
    <Button
      variant="outline"
      className={cn(
        'w-full border-none text-black shadow-sm transition hover:opacity-90 dark:text-black',
        `bg-linear-to-r ${gradient}`,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {label}
    </Button>
  </NextLink>
);

