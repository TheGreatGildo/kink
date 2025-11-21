import { Pool } from '@/hooks/usePools';
import { Button } from './ui/button';
import { cn } from '@/lib/utils/cn';
import { useTokenMetadata } from '@/hooks/useTokenMetadata';
import { TokenLogo } from './TokenLogo';
import type { TokenInfo } from '@/lib/tokens';
import { usePoolData } from '@/hooks/usePoolData';
import { formatUnits } from 'viem';

const shortAddress = (address: string) =>
  `${address.slice(0, 6)}...${address.slice(-4)}`;

interface PoolCardProps {
  pool: Pool;
  isActive?: boolean;
  onSelect: (poolAddress: string) => void;
}

export function PoolCard({ pool, isActive, onSelect }: PoolCardProps) {
  const handleSelect = () => onSelect(pool.poolAddress);
  const poolData = usePoolData(pool.poolAddress);

  const reserve0 = poolData.reserves ? Number(formatUnits(poolData.reserves.reserve0, pool.token0Info?.decimals ?? 18)) : 0;
  const reserve1 = poolData.reserves ? Number(formatUnits(poolData.reserves.reserve1, pool.token1Info?.decimals ?? 18)) : 0;
  const totalLiquidity = reserve0 + reserve1;
  const ratio = reserve1 > 0 ? reserve0 / reserve1 : 0;

  return (
    <div
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
        'group relative w-full rounded-2xl border border-border/60 bg-card p-6 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
        'layered-shadow-lg data-[animate-shadow=true]',
        isActive && 'ring-2 ring-primary',
      )}
      data-animate-shadow="true"
    >
      <div className="absolute inset-x-0 top-0 h-1 bg-primary" />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">
            <span className="rounded-full bg-muted px-3 py-1 text-[0.65rem]">
              Pool
            </span>
            <code className="rounded-md bg-muted/50 px-2 py-1 text-[0.65rem] font-mono">
              {shortAddress(pool.poolAddress)}
            </code>
          </div>
          <div>
            <TokenPairDisplay token0={pool.token0} token1={pool.token1} token0Info={pool.token0Info} token1Info={pool.token1Info} />
            <p className="text-sm text-muted-foreground mt-2">
              Amplified swap curve with kinked fees
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TokenTile tokenAddress={pool.token0} label="Token 0" tokenInfo={pool.token0Info} />
            <TokenTile tokenAddress={pool.token1} label="Token 1" tokenInfo={pool.token1Info} />
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl bg-secondary/60 p-6 text-sm text-foreground dark:bg-white/5 lg:w-5/12">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Total Liquidity</span>
            <span className="text-lg font-semibold">${totalLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pool Ratio</span>
            <span className="text-lg font-semibold">{ratio.toFixed(4)}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricPill
              label="Base Fee"
              value={`${Number(pool.baseFee) / 100}%`}
            />
            <MetricPill
              label="Kink Fee"
              value={`${Number(pool.kinkingFee) / 100}%`}
            />
          </div>
          <Button
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              handleSelect();
            }}
            className="w-full dark:bg-linear-to-r dark:from-[#00ffff] dark:to-[#ff00ff] dark:text-black dark:border-none dark:hover:opacity-90"
          >
            {isActive ? 'Selected' : 'Trade this Pool'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const TokenTile = ({ label, tokenAddress, tokenInfo }: { label: string; tokenAddress: string; tokenInfo?: TokenInfo }) => {
  const metadata = useTokenMetadata(tokenAddress);
  const symbol = tokenInfo?.symbol || metadata.symbol;
  const name = tokenInfo?.name || metadata.name;
  return (
    <div className="rounded-xl border border-border/50 bg-muted/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <TokenLogo address={tokenAddress} size={24} />
        <div>
          <p className="font-semibold text-foreground">{symbol}</p>
          <p className="text-xs text-muted-foreground">{name}</p>
        </div>
      </div>
    </div>
  );
};

const TokenPairDisplay = ({
  token0,
  token1,
  token0Info,
  token1Info,
}: {
  token0: string;
  token1: string;
  token0Info?: TokenInfo;
  token1Info?: TokenInfo;
}) => {
  const token0Meta = useTokenMetadata(token0);
  const token1Meta = useTokenMetadata(token1);
  const symbol0 = token0Info?.symbol || token0Meta.symbol;
  const symbol1 = token1Info?.symbol || token1Meta.symbol;
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <TokenLogo address={token0} size={32} />
        <TokenLogo address={token1} size={32} className="-ml-2" />
      </div>
      <p className="text-2xl font-semibold text-foreground">
        {symbol0} / {symbol1}
      </p>
    </div>
  );
};

const MetricPill = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-border/60 bg-card/60 px-4 py-3">
    <p className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </p>
    <p className="text-lg font-semibold text-foreground">{value}</p>
  </div>
);

