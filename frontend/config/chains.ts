const DEFAULT_FACTORY_ADDRESS = '0x4db2882b6c293d834e42af21333fe0a6b0b5646e';
const DEFAULT_ROUTER_ADDRESS = '0x54bc2b04492a61e2621788f7b65c3edf0afb0c9b';
const DEFAULT_POOL_ADDRESS = '0x2d66a2ed5aeaf4f6103a4f1fc41212bb56b0901f';
const DEFAULT_REGISTRY_ADDRESS = '0x1961750ab3a9ce9a1f4c7b9620e28f843e2cd7f7';

export const FACTORY_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_FACTORY_ADDRESS,
  DEFAULT_FACTORY_ADDRESS
);

export const ROUTER_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_ROUTER_ADDRESS,
  DEFAULT_ROUTER_ADDRESS
);

export const POOL_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_POOL_ADDRESS,
  DEFAULT_POOL_ADDRESS
);
export const REGISTRY_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_REGISTRY_ADDRESS,
  DEFAULT_REGISTRY_ADDRESS
);
export const FAUCET_ADDRESS = process.env.NEXT_PUBLIC_FAUCET_ADDRESS || '';

const DEFAULT_DEFI_ADDRESS = '0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A'; // alUSD
const DEFAULT_CEFI_ADDRESS = '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34'; // USDe

function normalizeAddress(address: string | undefined, fallback: string) {
  if (!address) return fallback.toLowerCase();
  const trimmed = address.trim();
  if (!trimmed) return fallback.toLowerCase();
  const prefixed = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  if (prefixed.length !== 42) return fallback.toLowerCase();
  return prefixed.toLowerCase();
}

export const DEFI_TOKEN_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_DEFI_TOKEN_ADDRESS,
  DEFAULT_DEFI_ADDRESS
);

export const CEFI_TOKEN_ADDRESS = normalizeAddress(
  process.env.NEXT_PUBLIC_CEFI_TOKEN_ADDRESS,
  DEFAULT_CEFI_ADDRESS
);

const [TOKEN0_FALLBACK, TOKEN1_FALLBACK] =
  DEFI_TOKEN_ADDRESS < CEFI_TOKEN_ADDRESS
    ? [DEFI_TOKEN_ADDRESS, CEFI_TOKEN_ADDRESS]
    : [CEFI_TOKEN_ADDRESS, DEFI_TOKEN_ADDRESS];

// Optimism mainnet chain ID
export const OPTIMISM_CHAIN_ID = 10;

// Localhost chain ID (Foundry)
export const LOCALHOST_CHAIN_ID = 31337;

// Deployed pool configuration (DEFI/CEFI pool)
export const DEPLOYED_POOL = {
  address: POOL_ADDRESS,
  token0: TOKEN0_FALLBACK,
  token1: TOKEN1_FALLBACK,
  A0: 1000,
  A1: 69,
  baseFee: 5,
  kinkingFee: 25,
  softPeg0: '1000000000000000000',
  softPeg1: '1000000000000000000',
};

