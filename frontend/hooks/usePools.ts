'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePublicClient } from 'wagmi';
import type { Address } from 'viem';

import { DEPLOYED_POOL, REGISTRY_ADDRESS } from '../config/chains';
import { getTokenInfo, type TokenInfo } from '../lib/tokens';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const REFRESH_INTERVAL_MS = 60_000; // Increased from 15s to 60s to reduce RPC calls

const POOL_REGISTRY_ABI = [
  {
    type: 'function',
    name: 'allPoolsLength',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allPools',
    stateMutability: 'view',
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
  },
] as const;

const KINK_POOL_METADATA_ABI = [
  { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'A0', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'A1', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'baseFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'kinkingFee', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'softPeg0', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'softPeg1', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const;

type PublicClientInstance = NonNullable<ReturnType<typeof usePublicClient>>;

export interface Pool {
  token0: string;
  token1: string;
  poolAddress: string;
  A0: bigint;
  A1: bigint;
  baseFee: bigint;
  kinkingFee: bigint;
  softPeg0: bigint;
  softPeg1: bigint;
  token0Info?: TokenInfo;
  token1Info?: TokenInfo;
}

export function formatPoolEntry(params: {
  token0: string;
  token1: string;
  poolAddress: string;
  A0: bigint;
  A1: bigint;
  baseFee: bigint;
  kinkingFee: bigint;
  softPeg0?: bigint;
  softPeg1?: bigint;
}): Pool {
  const token0Lower = params.token0.toLowerCase();
  const token1Lower = params.token1.toLowerCase();

  return {
    token0: token0Lower,
    token1: token1Lower,
    poolAddress: params.poolAddress,
    A0: params.A0,
    A1: params.A1,
    baseFee: params.baseFee,
    kinkingFee: params.kinkingFee,
    softPeg0: params.softPeg0 ?? 0n,
    softPeg1: params.softPeg1 ?? 0n,
    token0Info: getTokenInfo(token0Lower),
    token1Info: getTokenInfo(token1Lower),
  };
}

export function mergePools(primary: Pool[], fallback: Pool[]) {
  if (fallback.length === 0) return primary;
  const seen = new Set(primary.map((pool) => pool.poolAddress.toLowerCase()));
  const merged = [...primary];

  fallback.forEach((pool) => {
    const addr = pool.poolAddress.toLowerCase();
    if (seen.has(addr)) return;
    merged.push(pool);
    seen.add(addr);
  });

  return merged;
}

export function usePools(registryAddressOverride?: string) {
  const publicClient = usePublicClient();
  const registryAddress = (registryAddressOverride ?? REGISTRY_ADDRESS)?.toLowerCase();
  const fallbackPools = useMemo(() => buildFallbackPools(), []);
  const [pools, setPools] = useState<Pool[]>(fallbackPools);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let isInitialLoad = true;

    async function loadPoolsFromRegistry() {
      if (!publicClient || !isValidAddress(registryAddress)) {
        if (!cancelled) {
          setPools(fallbackPools);
          setLoading(false);
        }
        return;
      }

      // Only show loading spinner on initial load, not on refresh
      if (isInitialLoad && !cancelled) {
        setLoading(true);
      }

      try {
        const poolAddresses = await fetchRegisteredPools(publicClient, registryAddress as Address);

        if (poolAddresses.length === 0) {
          if (!cancelled) {
            setPools(fallbackPools);
            if (isInitialLoad) setLoading(false);
          }
          return;
        }

        const metadata = await Promise.all(poolAddresses.map((addr) => fetchPoolMetadata(publicClient, addr)));
        const resolved = metadata.filter((pool): pool is Pool => pool !== null);
        if (!cancelled) {
          setPools(mergePools(resolved, fallbackPools));
          if (isInitialLoad) setLoading(false);
        }
      } catch (error) {
        console.warn('usePools: failed to load registry pools', error);
        if (!cancelled) {
          setPools(fallbackPools);
          if (isInitialLoad) setLoading(false);
        }
      } finally {
        isInitialLoad = false;
      }
    }

    loadPoolsFromRegistry();
    const interval = setInterval(loadPoolsFromRegistry, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publicClient, registryAddress, fallbackPools]);

  return { pools, loading };
}

function buildFallbackPools(): Pool[] {
  if (!DEPLOYED_POOL.address) return [];
  return [
    formatPoolEntry({
      token0: DEPLOYED_POOL.token0,
      token1: DEPLOYED_POOL.token1,
      poolAddress: DEPLOYED_POOL.address,
      A0: BigInt(DEPLOYED_POOL.A0),
      A1: BigInt(DEPLOYED_POOL.A1),
      baseFee: BigInt(DEPLOYED_POOL.baseFee),
      kinkingFee: BigInt(DEPLOYED_POOL.kinkingFee),
      softPeg0: DEPLOYED_POOL.softPeg0 ? BigInt(DEPLOYED_POOL.softPeg0) : undefined,
      softPeg1: DEPLOYED_POOL.softPeg1 ? BigInt(DEPLOYED_POOL.softPeg1) : undefined,
    }),
  ];
}

function isValidAddress(value?: string) {
  if (!value) return false;
  return value.length === 42 && value !== ZERO_ADDRESS;
}

async function fetchRegisteredPools(client: PublicClientInstance, registryAddress: Address) {
  const length = (await client.readContract({
    address: registryAddress,
    abi: POOL_REGISTRY_ABI,
    functionName: 'allPoolsLength',
  })) as bigint;

  if (length === 0n) return [];

  const calls = Array.from({ length: Number(length) }, (_, index) =>
    client.readContract({
      address: registryAddress,
      abi: POOL_REGISTRY_ABI,
      functionName: 'allPools',
      args: [BigInt(index)],
    }) as Promise<Address>,
  );

  const addresses = await Promise.all(calls);
  return addresses.map((addr) => addr.toLowerCase() as Address);
}

async function fetchPoolMetadata(client: PublicClientInstance, poolAddress: Address) {
  try {
    // Use multicall to batch all RPC calls into a single request
    const contracts = [
      { address: poolAddress, abi: KINK_POOL_METADATA_ABI, functionName: 'token0' },
      { address: poolAddress, abi: KINK_POOL_METADATA_ABI, functionName: 'token1' },
      { address: poolAddress, abi: KINK_POOL_METADATA_ABI, functionName: 'A0' },
      { address: poolAddress, abi: KINK_POOL_METADATA_ABI, functionName: 'A1' },
      { address: poolAddress, abi: KINK_POOL_METADATA_ABI, functionName: 'baseFee' },
      { address: poolAddress, abi: KINK_POOL_METADATA_ABI, functionName: 'kinkingFee' },
      { address: poolAddress, abi: KINK_POOL_METADATA_ABI, functionName: 'softPeg0' },
      { address: poolAddress, abi: KINK_POOL_METADATA_ABI, functionName: 'softPeg1' },
    ] as const;

    const results = await client.multicall({
      allowFailure: false,
      contracts,
    });

    const [token0, token1, A0, A1, baseFee, kinkingFee, softPeg0, softPeg1] = results;

    return formatPoolEntry({
      token0,
      token1,
      poolAddress,
      A0,
      A1,
      baseFee,
      kinkingFee,
      softPeg0,
      softPeg1,
    });
  } catch (error) {
    console.warn('usePools: failed to fetch metadata for pool', poolAddress, error);
    return null;
  }
}

