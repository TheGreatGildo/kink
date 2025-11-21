'use client';

import { useState } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { useAccount } from 'wagmi';
import { FAUCET_ADDRESS } from '../config/chains';
import { Button } from './ui/button';
import { useTokenBalance } from '../hooks/useTokenBalance';
import { CEFI_TOKEN_ADDRESS, DEFI_TOKEN_ADDRESS } from '../config/chains';
import { TokenLogo } from './TokenLogo';
import { FaucetIcon } from './Icons';

const FAUCET_ABI = [
  {
    inputs: [],
    name: 'requestTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getBalances',
    outputs: [
      { internalType: 'uint256', name: 'cefiBalance', type: 'uint256' },
      { internalType: 'uint256', name: 'defiBalance', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

export default function Faucet() {
  const { address, isConnected } = useAccount();
  const [isRequesting, setIsRequesting] = useState(false);
  const { writeContractAsync, data: hash } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  // Get faucet balances
  const { data: balances } = useReadContract({
    address: FAUCET_ADDRESS as `0x${string}`,
    abi: FAUCET_ABI,
    functionName: 'getBalances',
    query: {
      enabled: !!FAUCET_ADDRESS,
    },
  });

  // Get user balances
  const { formattedBalance: cefiBalance } = useTokenBalance(CEFI_TOKEN_ADDRESS);
  const { formattedBalance: defiBalance } = useTokenBalance(DEFI_TOKEN_ADDRESS);

  const handleRequestTokens = async () => {
    if (!FAUCET_ADDRESS || !isConnected) return;

    setIsRequesting(true);
    try {
      await writeContractAsync({
        address: FAUCET_ADDRESS as `0x${string}`,
        abi: FAUCET_ABI,
        functionName: 'requestTokens',
      });
    } catch (error) {
      console.error('Failed to request tokens:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  if (!FAUCET_ADDRESS) {
    return (
      <div className="glass-card p-6 md:p-12 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center">
          <div className="mb-6 flex justify-center"><FaucetIcon className="w-20 h-20 text-muted-foreground" /></div>
          <h2 className="text-3xl font-bold gradient-text mb-4">Faucet</h2>
          <p className="text-muted-foreground">
            Faucet contract address not configured. Please set NEXT_PUBLIC_FAUCET_ADDRESS in your environment variables.
          </p>
        </div>
      </div>
    );
  }

  const cefiBalanceFormatted = balances?.[0]
    ? (Number(balances[0]) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '0';
  const defiBalanceFormatted = balances?.[1]
    ? (Number(balances[1]) / 1e18).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '0';

  return (
    <div className="glass-card p-6 md:p-12 max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-center gap-4 mb-10">
        <FaucetIcon className="w-12 h-12 text-[#00ffff]" />
        <h2 className="text-4xl font-bold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent text-center">
        Token Faucet</h2>
      </div>

      <div className="space-y-6">
        {/* Info Section */}
        <div className="bg-muted/50 rounded-xl p-6 border border-border/40">
          <p className="text-center text-muted-foreground mb-4">
            Get 100 CEFI and 100 DEFI tokens to start trading on Kink DEX
          </p>
          <div className="flex items-center justify-center gap-6 mb-4">
            <div className="flex items-center gap-2">
              <TokenLogo address={CEFI_TOKEN_ADDRESS} size={24} />
              <span className="font-semibold">100 CEFI</span>
            </div>
            <span className="text-muted-foreground">+</span>
            <div className="flex items-center gap-2">
              <TokenLogo address={DEFI_TOKEN_ADDRESS} size={24} />
              <span className="font-semibold">100 DEFI</span>
            </div>
          </div>
        </div>

        {/* Faucet Balances */}
        <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
          <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Faucet Reserves</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TokenLogo address={CEFI_TOKEN_ADDRESS} size={20} />
              <span className="text-sm">CEFI:</span>
            </div>
            <span className="font-mono text-sm">{cefiBalanceFormatted}</span>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <TokenLogo address={DEFI_TOKEN_ADDRESS} size={20} />
              <span className="text-sm">DEFI:</span>
            </div>
            <span className="font-mono text-sm">{defiBalanceFormatted}</span>
          </div>
        </div>

        {/* User Balances */}
        {isConnected && (
          <div className="bg-muted/30 rounded-xl p-4 border border-border/30">
            <h3 className="text-sm font-semibold mb-3 text-muted-foreground">Your Balances</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TokenLogo address={CEFI_TOKEN_ADDRESS} size={20} />
                <span className="text-sm">CEFI:</span>
              </div>
              <span className="font-mono text-sm">{cefiBalance || '0'}</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <TokenLogo address={DEFI_TOKEN_ADDRESS} size={20} />
                <span className="text-sm">DEFI:</span>
              </div>
              <span className="font-mono text-sm">{defiBalance || '0'}</span>
            </div>
          </div>
        )}

        {/* Request Button */}
        {!isConnected ? (
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">Connect your wallet to request tokens</p>
          </div>
        ) : (
          <Button
            onClick={handleRequestTokens}
            disabled={isRequesting || isConfirming}
            className="w-full glow-button py-6 text-lg font-semibold"
          >
            {isRequesting || isConfirming ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                {isRequesting ? 'Requesting...' : 'Confirming...'}
              </>
            ) : isSuccess ? (
              '✅ Tokens Requested!'
            ) : (
              <span className="flex items-center gap-2 justify-center">
                <FaucetIcon className="w-6 h-6" />
                Request 100 CEFI + 100 DEFI
              </span>
            )}
          </Button>
        )}

        {isSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-center">
            <p className="text-green-600 dark:text-green-400 font-semibold">
              Success! Tokens have been sent to your wallet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

