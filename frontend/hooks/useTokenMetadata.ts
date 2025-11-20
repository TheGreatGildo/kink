'use client';

import { useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { getTokenInfo, getTokenSymbol, getTokenName } from '../lib/tokens';

const ERC20_ABI = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function useTokenMetadata(tokenAddress: string | undefined) {
  // Normalize address for consistent lookup
  const normalizedAddress = tokenAddress?.toLowerCase().trim();

  // Debug logging
  useEffect(() => {
    if (normalizedAddress) {
      console.log('useTokenMetadata:', {
        tokenAddress,
        normalizedAddress,
        foundInLibrary: !!getTokenInfo(normalizedAddress),
      });
    }
  }, [tokenAddress, normalizedAddress]);

  // Try to get from our library first
  const libraryToken = normalizedAddress ? getTokenInfo(normalizedAddress) : undefined;

  // Read from chain as fallback
  const isValidAddress = Boolean(
    normalizedAddress && normalizedAddress.startsWith('0x') && normalizedAddress.length === 42
  );

  const { data: onChainName } = useReadContract({
    address: (isValidAddress ? normalizedAddress : undefined) as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'name',
    query: {
      enabled: isValidAddress && !libraryToken,
    },
  });

  const { data: onChainSymbol } = useReadContract({
    address: (isValidAddress ? normalizedAddress : undefined) as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: {
      enabled: isValidAddress && !libraryToken,
    },
  });

  const { data: onChainDecimals } = useReadContract({
    address: (isValidAddress ? normalizedAddress : undefined) as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: {
      enabled: isValidAddress && !libraryToken,
    },
  });

  return {
    name: libraryToken?.name || onChainName || getTokenName(normalizedAddress || ''),
    symbol: libraryToken?.symbol || onChainSymbol || getTokenSymbol(normalizedAddress || ''),
    decimals: libraryToken?.decimals || onChainDecimals || 18,
    logo: libraryToken?.logo,
  };
}

