'use client';

import { usePublicClient, useReadContract } from 'wagmi';
import { useMemo, useEffect } from 'react';

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
  {
    inputs: [],
    name: 'token0',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'A0',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'A1',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'baseFee',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'kinkingFee',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function usePoolData(poolAddress: string | undefined) {
  const { data: reserves, refetch: refetchReserves } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: KINK_POOL_ABI,
    functionName: 'getReserves',
    query: {
      enabled: !!poolAddress,
    },
  });

  const { data: token0, error: token0Error, refetch: refetchToken0 } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: KINK_POOL_ABI,
    functionName: 'token0',
    query: {
      enabled: !!poolAddress,
    },
  });

  const { data: token1, error: token1Error, refetch: refetchToken1 } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: KINK_POOL_ABI,
    functionName: 'token1',
    query: {
      enabled: !!poolAddress,
    },
  });

  // Debug logging for token address fetching
  useEffect(() => {
    if (poolAddress) {
      console.log('usePoolData - Fetching token addresses:', {
        poolAddress,
        token0,
        token1,
        token0Error,
        token1Error,
      });
    }
  }, [poolAddress, token0, token1, token0Error, token1Error]);

  const { data: A0, refetch: refetchA0 } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: KINK_POOL_ABI,
    functionName: 'A0',
    query: {
      enabled: !!poolAddress,
    },
  });

  const { data: A1, refetch: refetchA1 } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: KINK_POOL_ABI,
    functionName: 'A1',
    query: {
      enabled: !!poolAddress,
    },
  });

  const { data: baseFee, refetch: refetchBaseFee } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: KINK_POOL_ABI,
    functionName: 'baseFee',
    query: {
      enabled: !!poolAddress,
    },
  });

  const { data: kinkingFee, refetch: refetchKinkingFee } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: KINK_POOL_ABI,
    functionName: 'kinkingFee',
    query: {
      enabled: !!poolAddress,
    },
  });

  const { data: totalSupply, refetch: refetchTotalSupply } = useReadContract({
    address: poolAddress as `0x${string}`,
    abi: KINK_POOL_ABI,
    functionName: 'totalSupply',
    query: {
      enabled: !!poolAddress,
    },
  });

  const currentPrice = useMemo(() => {
    if (!reserves) return null;
    const [reserve0, reserve1] = reserves;
    if (reserve1 === 0n) return null;
    return Number(reserve0) / Number(reserve1);
  }, [reserves]);

  // Convert token addresses to lowercase strings for consistent handling
  const token0Address = token0 ? String(token0).toLowerCase() : undefined;
  const token1Address = token1 ? String(token1).toLowerCase() : undefined;

  const refetch = async () => {
    await Promise.all([
      refetchReserves(),
      refetchToken0(),
      refetchToken1(),
      refetchA0(),
      refetchA1(),
      refetchBaseFee(),
      refetchKinkingFee(),
      refetchTotalSupply(),
    ]);
  };

  return {
    reserves: reserves ? { reserve0: reserves[0], reserve1: reserves[1] } : null,
    token0: token0Address,
    token1: token1Address,
    A0,
    A1,
    baseFee,
    kinkingFee,
    totalSupply,
    currentPrice,
    refetch,
  };
}

