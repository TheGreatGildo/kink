import { describe, expect, it } from 'vitest';
import { formatPoolEntry, mergePools, type Pool } from '@/hooks/usePools';

const USDE = '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34';
const ALUSD = '0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A';
const EXISTING_POOL = '0xf85a02a9516fb11250588f26ebe8915ba9550a1b';
const NEW_POOL = '0xCa3FFe6b943977fdCB77Cba4aF8E1cAf0A08B593';

describe('usePools helpers', () => {
  it('formatPoolEntry normalizes addresses and attaches metadata', () => {
    const pool = formatPoolEntry({
      token0: USDE,
      token1: ALUSD,
      poolAddress: EXISTING_POOL,
      A0: 1000n,
      A1: 69n,
      baseFee: 5n,
      kinkingFee: 25n,
    });

    expect(pool.token0).toBe(USDE.toLowerCase());
    expect(pool.token1).toBe(ALUSD.toLowerCase());
    expect(pool.poolAddress).toBe(EXISTING_POOL);
    expect(pool.token0Info?.symbol).toBe('USDe');
    expect(pool.token1Info?.symbol).toBe('alUSD');
  });

  it('mergePools adds fallback pools exactly once', () => {
    const registryPools: Pool[] = [
      formatPoolEntry({
        token0: USDE,
        token1: ALUSD,
        poolAddress: EXISTING_POOL,
        A0: 1000n,
        A1: 69n,
        baseFee: 5n,
        kinkingFee: 25n,
      }),
    ];

    const fallbackPools: Pool[] = [
      formatPoolEntry({
        token0: USDE,
        token1: ALUSD,
        poolAddress: NEW_POOL,
        A0: 1000n,
        A1: 69n,
        baseFee: 5n,
        kinkingFee: 25n,
      }),
    ];

    const merged = mergePools(registryPools, fallbackPools);
    expect(merged).toHaveLength(2);
    const mergedAgain = mergePools(merged, fallbackPools);
    expect(mergedAgain).toHaveLength(2);
  });
});

