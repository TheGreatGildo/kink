'use client';

import { useReadContract, useWriteContract, usePublicClient } from 'wagmi';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { useState, useCallback } from 'react';
import { useTokenMetadata } from './useTokenMetadata';

const ERC20_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'owner', type: 'address' },
      { internalType: 'address', name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'spender', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;

export function useTokenApproval(
  tokenAddress: string | undefined,
  spenderAddress: string | undefined,
  amount: string
) {
  const { address } = useAccount();
  const { decimals } = useTokenMetadata(tokenAddress);
  // Use actual token decimals, default to 18 if not available
  const tokenDecimals = decimals || 18;
  const amountBigInt = amount ? parseUnits(amount, tokenDecimals) : BigInt(0);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address && spenderAddress ? [address, spenderAddress as `0x${string}`] : undefined,
    query: {
      enabled: !!tokenAddress && !!spenderAddress && !!address,
      staleTime: 30_000, // 30 seconds - allowance only changes on approval tx
      gcTime: 120_000, // 2 minutes cache
      refetchOnWindowFocus: false,
    },
  });

  const { writeContractAsync: writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [isApproving, setIsApproving] = useState(false);

  const needsApproval = allowance !== undefined && amountBigInt > 0 && allowance < amountBigInt;

  const runApproval = useCallback(async () => {
    if (!tokenAddress || !spenderAddress) {
      throw new Error('Token or spender address missing for approval');
    }

    setIsApproving(true);
    try {
      const hash = await writeContractAsync({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress as `0x${string}`, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
      });

      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }

      await refetchAllowance();
      return hash;
    } finally {
      setIsApproving(false);
    }
  }, [tokenAddress, spenderAddress, writeContractAsync, publicClient, refetchAllowance]);

  const approveAsync = () => runApproval();

  const approve = () => {
    runApproval().catch((error) => {
      console.error('Token approval failed:', error);
    });
  };

  return {
    allowance,
    needsApproval,
    approve,
    approveAsync,
    isApproving,
    refetchAllowance,
  };
}

