'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePools } from '../hooks/usePools';
import { PoolCard } from './PoolCard';
import { PoolsIcon } from './Icons';

// Pool addresses to hide from UI (erroneously created)
const HIDDEN_POOL_ADDRESSES = [
  '0x2d66a2ed5aeaf4f6103a4f1fc41212bb56b0901f',
  '0x00466e3b79c7f8c8d77fc3b44203f0dc0adcb4c2',
];

export default function Pools() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pools, loading } = usePools();
  const [selectedPool, setSelectedPool] = useState<string | null>(null);

  const returnTo = searchParams.get('returnTo');

  // Filter out hidden pools
  const visiblePools = pools.filter(
    (pool) => !HIDDEN_POOL_ADDRESSES.some(
      (hidden) => pool.poolAddress.toLowerCase() === hidden.toLowerCase()
    )
  );

  return (
    <div className="w-full glass-card p-6 md:p-12 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-center gap-4 mb-10">
        <PoolsIcon className="w-12 h-12 text-[#00ffff]" />
        <h2 className="text-4xl font-bold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent text-center">
          Liquidity Pools
        </h2>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="mb-6 h-20 w-20 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-lg text-muted-foreground">Loading pools...</p>
        </div>
      ) : visiblePools.length === 0 ? (
        <div className="py-16 text-center">
          <div className="mb-6 flex justify-center">
            <PoolsIcon className="w-20 h-20 text-muted-foreground/50" />
          </div>
          <p className="mb-4 text-2xl text-foreground">No pools found</p>
          <p className="mb-8 text-lg text-muted-foreground">
            Create the first kinky pool to get started!
          </p>
          <button
            onClick={() => router.push('/create')}
            className="glow-button rounded-xl px-10 py-4 text-lg font-semibold dark:bg-linear-to-r dark:from-[#00ffff] dark:to-[#ff00ff] dark:text-black dark:border-none"
          >
            Create Pool
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {visiblePools.map((pool) => (
            <PoolCard
              key={pool.poolAddress}
              pool={pool}
              isActive={selectedPool === pool.poolAddress}
              onSelect={(poolAddress) => {
                setSelectedPool(poolAddress);
                if (returnTo === 'liquidity') {
                  router.push(`/liquidity?pool=${poolAddress}`);
                } else {
                  router.push(`/swap?pool=${poolAddress}`);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
