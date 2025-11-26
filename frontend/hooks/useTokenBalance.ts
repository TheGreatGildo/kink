'use client';

import { useReadContract, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import { useTokenMetadata } from './useTokenMetadata';

const ERC20_ABI = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export function useTokenBalance(tokenAddress: string | undefined) {
  const { address } = useAccount();
  const { decimals } = useTokenMetadata(tokenAddress);

  // Normalize address to ensure it's valid
  const normalizedAddress = tokenAddress?.toLowerCase().trim();
  const isValidAddress = Boolean(
    normalizedAddress && normalizedAddress.startsWith('0x') && normalizedAddress.length === 42
  );

  const { data: balance, ...rest } = useReadContract({
    address: (isValidAddress ? normalizedAddress : undefined) as `0x${string}` | undefined,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: isValidAddress && Boolean(address),
      staleTime: 30_000, // 30 seconds - balances change on transactions, refetch manually after swap
      gcTime: 120_000, // 2 minutes cache
      refetchOnWindowFocus: false,
    },
  });

  // Use decimals from metadata, default to 18 if not available
  const tokenDecimals = decimals || 18;

  const formattedBalance = balance && balance > 0n
    ? parseFloat(formatUnits(balance, tokenDecimals)).toFixed(6)
    : '0.00';

  return {
    balance,
    formattedBalance,
    refetchBalance: rest.refetch,
    ...rest,
  };
}

