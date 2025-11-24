'use client';

import { useEffect, useMemo, useCallback } from 'react';
import { usePublicClient } from 'wagmi';
import type { Address } from 'viem';
import { useQuery } from '@tanstack/react-query';
import { DEPLOYED_POOL } from '../config/chains';

const KINK_POOL_ABI = [
  {
    inputs: [],
    name: 'getReserves',
    outputs: [
      { internalType: 'uint256', name: 'reserve0', type: 'uint256' },
      { internalType: 'uint256', name: 'reserve1', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  { inputs: [], name: 'token0', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'token1', outputs: [{ internalType: 'address', name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'A0', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'A1', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'baseFee', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'kinkingFee', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'softPeg0', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'softPeg1', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
] as const;

type MulticallResult = {
  reserves?: readonly [bigint, bigint];
  token0?: Address;
  token1?: Address;
  A0?: bigint;
  A1?: bigint;
  baseFee?: bigint;
  kinkingFee?: bigint;
  softPeg0?: bigint;
  softPeg1?: bigint;
  totalSupply?: bigint;
};

export function usePoolData(poolAddress: string | undefined) {
  const publicClient = usePublicClient();
  const normalizedAddress = poolAddress?.toLowerCase() as Address | undefined;

  const { data, refetch } = useQuery<MulticallResult | null>({
    queryKey: ['pool-data', normalizedAddress],
    enabled: Boolean(publicClient && normalizedAddress),
    staleTime: 15_000,
    gcTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!publicClient || !normalizedAddress) return null;

      const contracts = [
        { address: normalizedAddress, abi: KINK_POOL_ABI, functionName: 'getReserves' },
        { address: normalizedAddress, abi: KINK_POOL_ABI, functionName: 'token0' },
        { address: normalizedAddress, abi: KINK_POOL_ABI, functionName: 'token1' },
        { address: normalizedAddress, abi: KINK_POOL_ABI, functionName: 'A0' },
        { address: normalizedAddress, abi: KINK_POOL_ABI, functionName: 'A1' },
        { address: normalizedAddress, abi: KINK_POOL_ABI, functionName: 'baseFee' },
        { address: normalizedAddress, abi: KINK_POOL_ABI, functionName: 'kinkingFee' },
        { address: normalizedAddress, abi: KINK_POOL_ABI, functionName: 'softPeg0' },
        { address: normalizedAddress, abi: KINK_POOL_ABI, functionName: 'softPeg1' },
        { address: normalizedAddress, abi: KINK_POOL_ABI, functionName: 'totalSupply' },
      ] as const;

      const results = await publicClient.multicall({
        allowFailure: false,
        contracts,
      });

      const [reserves, token0, token1, A0, A1, baseFee, kinkingFee, softPeg0, softPeg1, totalSupply] = results;

      return {
        reserves,
        token0,
        token1,
        A0,
        A1,
        baseFee,
        kinkingFee,
        softPeg0,
        softPeg1,
        totalSupply,
      };
    },
  });

  const fallbackPool = useMemo(() => {
    if (!normalizedAddress || !DEPLOYED_POOL.address) return null;
    const matchesFallback = normalizedAddress === DEPLOYED_POOL.address.toLowerCase();
    if (!matchesFallback) return null;

    return {
      token0: DEPLOYED_POOL.token0?.toLowerCase(),
      token1: DEPLOYED_POOL.token1?.toLowerCase(),
      A0: DEPLOYED_POOL.A0 ? BigInt(DEPLOYED_POOL.A0) : undefined,
      A1: DEPLOYED_POOL.A1 ? BigInt(DEPLOYED_POOL.A1) : undefined,
      baseFee: DEPLOYED_POOL.baseFee ? BigInt(DEPLOYED_POOL.baseFee) : undefined,
      kinkingFee: DEPLOYED_POOL.kinkingFee ? BigInt(DEPLOYED_POOL.kinkingFee) : undefined,
      softPeg0: DEPLOYED_POOL.softPeg0 ? BigInt(DEPLOYED_POOL.softPeg0) : undefined,
      softPeg1: DEPLOYED_POOL.softPeg1 ? BigInt(DEPLOYED_POOL.softPeg1) : undefined,
    };
  }, [normalizedAddress]);

  const reserve0Value = data?.reserves?.[0];
  const reserve1Value = data?.reserves?.[1];

  const reserves = useMemo(() => {
    if (reserve0Value === undefined || reserve1Value === undefined) return null;
    return { reserve0: reserve0Value, reserve1: reserve1Value };
  }, [reserve0Value, reserve1Value]);

  const token0Address = useMemo(() => {
    const onChainToken = data?.token0?.toLowerCase();
    return onChainToken ?? fallbackPool?.token0;
  }, [data?.token0, fallbackPool?.token0]);

  const token1Address = useMemo(() => {
    const onChainToken = data?.token1?.toLowerCase();
    return onChainToken ?? fallbackPool?.token1;
  }, [data?.token1, fallbackPool?.token1]);

  const currentPrice = useMemo(() => {
    if (!reserves) return null;
    if (reserves.reserve1 === 0n) return null;
    return Number(reserves.reserve0) / Number(reserves.reserve1);
  }, [reserves]);

  const refetchAll = useCallback(async () => {
    await refetch();
  }, [refetch]);

  useEffect(() => {
    if (normalizedAddress) {
      console.log('usePoolData - fetched pool snapshot', {
        poolAddress: normalizedAddress,
        hasReserves: Boolean(reserves),
        token0: token0Address,
        token1: token1Address,
      });
    }
  }, [normalizedAddress, reserves, token0Address, token1Address]);

  return {
    reserves,
    token0: token0Address,
    token1: token1Address,
    A0: data?.A0 ?? fallbackPool?.A0,
    A1: data?.A1 ?? fallbackPool?.A1,
    baseFee: data?.baseFee ?? fallbackPool?.baseFee,
    kinkingFee: data?.kinkingFee ?? fallbackPool?.kinkingFee,
    softPeg0: data?.softPeg0 ?? fallbackPool?.softPeg0,
    softPeg1: data?.softPeg1 ?? fallbackPool?.softPeg1,
    totalSupply: data?.totalSupply,
    currentPrice,
    refetch: refetchAll,
  };
}
