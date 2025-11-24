import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  coinbaseWallet,
  injectedWallet,
  metaMaskWallet,
  rabbyWallet,
  rainbowWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { localhost, optimism } from 'wagmi/chains';
import type { Chain } from 'viem/chains';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';
const appName = 'Kink DEX';

const devChain: Chain = {
  ...localhost,
  id: 31337,
};

const chains: readonly [Chain, ...Chain[]] = [optimism, devChain];

const optimismRpcUrl =
  process.env.NEXT_PUBLIC_OPTIMISM_RPC_URL ||
  (process.env.NEXT_PUBLIC_INFURA_API_KEY
    ? `https://optimism-mainnet.infura.io/v3/${process.env.NEXT_PUBLIC_INFURA_API_KEY}`
    : process.env.VITE_INFURA_API_KEY
      ? `https://optimism-mainnet.infura.io/v3/${process.env.VITE_INFURA_API_KEY}`
      : undefined);

const localhostRpcUrl = process.env.NEXT_PUBLIC_LOCAL_RPC_URL || 'http://127.0.0.1:8545';

if (!projectId) {
  throw new Error('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is required');
}

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        rabbyWallet,
        injectedWallet,
        metaMaskWallet,
        rainbowWallet,
        walletConnectWallet,
        coinbaseWallet,
      ],
    },
  ],
  {
    appName,
    projectId,
  },
);

export const config = createConfig({
  chains,
  connectors,
  transports: {
    [optimism.id]: http(optimismRpcUrl),
    [31337]: http(localhostRpcUrl),
  },
  ssr: true,
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}

