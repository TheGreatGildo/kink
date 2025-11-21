export const FACTORY_ADDRESS = process.env.NEXT_PUBLIC_FACTORY_ADDRESS || '';
export const ROUTER_ADDRESS = process.env.NEXT_PUBLIC_ROUTER_ADDRESS || '';
export const POOL_ADDRESS = process.env.NEXT_PUBLIC_POOL_ADDRESS || '';
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
  address: POOL_ADDRESS || '0xe3A1Fba2B3487a567a538ccc515F1dbdDeBF60Bd',
  token0: TOKEN0_FALLBACK,
  token1: TOKEN1_FALLBACK,
  A0: 500, // When token0 > token1
  A1: 120, // When token1 > token0
  baseFee: 2, // 0.02%
  kinkingFee: 16, // 0.16%
};

