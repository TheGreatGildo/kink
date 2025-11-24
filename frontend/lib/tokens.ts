// Optimism Mainnet Stablecoins with 18 decimals
export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  logo?: string; // SVG content
}

const BASE_TOKENS: TokenInfo[] = [
  {
    address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', // DAI
    symbol: 'DAI',
    name: 'Dai Stablecoin',
    decimals: 18,
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000"><path fill="#F5AC37" d="M1000 0C447.7 0 0 447.7 0 1000s447.7 1000 1000 1000 1000-447.7 1000-1000S1552.3 0 1000 0z"/><path fill="#FDB44F" d="M1000 2000C447.7 2000 0 1552.3 0 1000S447.7 0 1000 0s1000 447.7 1000 1000-447.7 1000-1000 1000zm0-1800C555.8 200 200 555.8 200 1000s355.8 800 800 800 800-355.8 800-800S1444.2 200 1000 200z"/><path fill="#FFCE5C" d="M1000 400c-331.4 0-600 268.6-600 600s268.6 600 600 600 600-268.6 600-600-268.6-600-600-600zm0 1050c-248.6 0-450-201.4-450-450s201.4-450 450-450 450 201.4 450 450-201.4 450-450 450z"/><path fill="#FFFFFF" d="M650 1000h700v100H650z"/></svg>`,
  },
  {
    address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT (bridged, 18 decimals on Optimism)
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 18,
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000"><path fill="#26A17B" d="M1000 0C447.7 0 0 447.7 0 1000s447.7 1000 1000 1000 1000-447.7 1000-1000S1552.3 0 1000 0z"/><path fill="#FFFFFF" d="M1000 300c-386.5 0-700 313.5-700 700s313.5 700 700 700 700-313.5 700-700-313.5-700-700-700zm0 1200c-276.1 0-500-223.9-500-500s223.9-500 500-500 500 223.9 500 500-223.9 500-500 500z"/><path fill="#26A17B" d="M750 850h500v300H750z"/></svg>`,
  },
  {
    address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', // USDC (bridged, 6 decimals on Optimism, but some pools use 18)
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 18,
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000"><circle fill="#2775CA" cx="1000" cy="1000" r="1000"/><path fill="#FFFFFF" d="M1000 400c-331.4 0-600 268.6-600 600s268.6 600 600 600 600-268.6 600-600-268.6-600-600-600zm0 1050c-248.6 0-450-201.4-450-450s201.4-450 450-450 450 201.4 450 450-201.4 450-450 450z"/><path fill="#2775CA" d="M700 850h600v300H700z"/></svg>`,
  },
  {
    address: '0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9', // sUSD
    symbol: 'sUSD',
    name: 'Synth sUSD',
    decimals: 18,
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000"><circle fill="#00D1FF" cx="1000" cy="1000" r="1000"/><path fill="#FFFFFF" d="M1000 400c-331.4 0-600 268.6-600 600s268.6 600 600 600 600-268.6 600-600-268.6-600-600-600zm0 1050c-248.6 0-450-201.4-450-450s201.4-450 450-450 450 201.4 450 450-201.4 450-450 450z"/><path fill="#00D1FF" d="M650 1000h700v100H650z"/></svg>`,
  },
  {
    address: '0x17FC002b466eEc40DaE835Fc8DBe9cF19BfF633f', // FRAX
    symbol: 'FRAX',
    name: 'Frax',
    decimals: 18,
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000"><circle fill="#000000" cx="1000" cy="1000" r="1000"/><path fill="#FFFFFF" d="M1000 400c-331.4 0-600 268.6-600 600s268.6 600 600 600 600-268.6 600-600-268.6-600-600-600zm0 1050c-248.6 0-450-201.4-450-450s201.4-450 450-450 450 201.4 450 450-201.4 450-450 450z"/><path fill="#000000" d="M700 850h600v300H700z"/></svg>`,
  },
  {
    address: '0xc40F949F8a4e094D1b49a6eA62c701f1e3C5bE95', // LUSD
    symbol: 'LUSD',
    name: 'Liquity USD',
    decimals: 18,
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000"><circle fill="#2DEDFF" cx="1000" cy="1000" r="1000"/><path fill="#000000" d="M1000 400c-331.4 0-600 268.6-600 600s268.6 600 600 600 600-268.6 600-600-268.6-600-600-600zm0 1050c-248.6 0-450-201.4-450-450s201.4-450 450-450 450 201.4 450 450-201.4 450-450 450z"/><path fill="#2DEDFF" d="M650 1000h700v100H650z"/></svg>`,
  },
  {
    address: '0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A', // alUSD
    symbol: 'alUSD',
    name: 'Alchemix USD',
    decimals: 18,
    logo: `<?xml version="1.0" encoding="utf-8"?><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 320 320" style="enable-background:new 0 0 320 320;" xml:space="preserve"><style type="text/css">.st0{fill:none;stroke:#F5C09A;stroke-width:6;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;}.st1{fill:none;stroke:#F5C09A;stroke-width:6.7737;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:10;}.st2{clip-path:url(#SVGID_00000135671669321870853590000007741904708915276705_);}.st3{fill:#F5C09A;stroke:#F5C09A;stroke-width:4.8384;stroke-miterlimit:10;}</style><g><line class="st0" x1="160.4" y1="12.4" x2="160.4" y2="43.5"/><path class="st1" d="M59.8,193.6"/><circle class="st0" cx="160.4" cy="160" r="147.6"/><line class="st0" x1="160.4" y1="277.1" x2="160.4" y2="307.6"/><g><polyline class="st1" points="116.9,77.9 160.4,43.5 261,123.1"/><line class="st1" x1="59.8" y1="123.1" x2="116.9" y2="77.9"/><line class="st1" x1="261" y1="197.5" x2="261" y2="123.1"/><polyline class="st1" points="59.8,123.1 59.8,197.5 160.4,277.1 261,197.5"/></g><g><defs><polygon id="SVGID_1_" points="261,123.1 160.4,43.5 61.9,124 59.8,197.5 160.4,277.1 261,197.5"/></defs><clipPath id="SVGID_00000115497671309664063010000015781144460597308089_"><use xlink:href="#SVGID_1_" style="overflow:visible;"/></clipPath><g style="clip-path:url(#SVGID_00000115497671309664063010000015781144460597308089_);"><path class="st3" d="M169,102.8c-1.2,3.5,1,5.3,4.8,6.5c2.5,0.8,4.9,2,7.2,3.3c6.7,3.7,10.3,9.7,12.3,16.9c0.4,1.4,0.1,2.8-0.2,4.2c-0.3,1.4-1.3,1.9-2.5,2.1c-3.1,0.5-6.3,0.6-9.5,0.5c-1.5,0-2.7-0.7-3.7-1.9c-0.6-0.8-1.2-1.7-1.8-2.6c-5.4-8.5-13-11.6-22.9-9.6c-9.5,2-11.6,7.9-10.8,16.5c0.3,2.9,2.7,4.4,5,5.5c3.5,1.8,7.3,2.7,11.1,3.4c7.6,1.5,15.3,3,22.7,5.5c13.1,4.4,17.1,16.4,16.6,26.2c-0.3,6.5-2.2,12.7-6.6,17.6c-5.2,6-11.7,10.3-19.6,12.1c-1.3,0.3-1.8,1.1-2,2.3c-0.6,3.2-0.1,6.6-0.6,9.8c-0.7,4.2-1,4.7-5.2,5.5c-3.2,0.6-6.4,0.4-9.6-0.2c-2-0.4-3.1-1.6-3.5-3.6c-0.6-3.4-0.7-6.8-0.6-10.2c0-2.9,0-3-2.8-3.6c-5.8-1.4-11.3-3.5-16-7.5c-5.9-5.1-9.4-11.5-10.8-19.2c-0.4-2.4,0.2-3.8,2.5-4.8c4-1.6,8.1-1.7,12.2-0.6c0.9,0.2,1.5,0.9,2,1.6c1.6,1.9,2.6,4,3.6,6.2c2.8,6.4,7.8,9.5,14.7,9.8c4,0.2,7.9,0.2,11.8-0.6c6.1-1.3,10.3-5.9,11.2-12.1c0.2-1.7,0.3-3.3,0-5c-0.5-2.5-1.7-4.7-4.1-5.9c-5.9-3.1-12-5.1-18.6-5.9c-8.2-1-16-3.4-23-7.9c-5.9-3.7-8.8-9.7-9.7-16.5c-2-14.9,6.7-28,21.2-32.2c1.9-0.5,4.5-0.3,5.4-1.9c0.8-1.4,0.2-3.7,0.2-5.7c0-2.6,0.2-5.2,0.8-7.7c0.4-1.6,1.3-2.5,2.8-2.8c4-0.9,8-0.9,12,0c1.5,0.3,2.4,1.3,2.8,2.8C168.9,96.3,169.1,99.1,169,102.8z"/><path class="st3" d="M134.8,68.9c0.4,4.3-1.5,7.3-5.2,9.3c-4.4,2.4-9,4.5-13.2,7.2c-22.4,14.5-37.5,34.3-40.9,61.2c-4.2,32.6,7.3,59.3,33,79.8c5.2,4.1,10.9,7.3,16.7,10.3c1.8,0.9,3.4,2.1,5.1,3c2.7,1.5,4,3.7,4.2,6.7c0.2,2.2,0.1,4.3-0.3,6.5c-0.6,3.3-2.9,4.7-6.1,4c-5.2-1.2-10-3.2-14.6-5.7c-28.2-15.2-46.7-38.1-54.7-69.3c-2.6-10.2-2.4-20.6-1.9-31c0.4-8.9,1.7-17.6,5-26c7.2-18.5,17.8-34.7,33.5-47.1c9.3-7.3,19.8-12.6,30.7-17.2c0.6-0.3,1.3-0.5,1.9-0.6c2.7-0.7,4.6,0.2,5.7,2.8C134.6,64.8,134.7,66.9,134.8,68.9z"/><path class="st3" d="M263.2,161.2c0.2,45.4-30.2,78.3-58,91.5c-4.2,2-8.6,3.9-13.1,5.1c-3.7,1-5.7-0.4-6.6-4.2c-0.5-2.3-0.4-4.6-0.2-6.8c0.2-2.4,1.4-4.3,3.5-5.6c3-2,6.2-3.7,9.3-5.4c15.6-8.5,28.2-20.2,37-35.6c6.6-11.4,8.7-25,9.1-38.2c0.5-17-2.3-32.1-11.3-46.5c-8.8-14.2-20.9-25.1-35.8-32.6c-2.4-1.2-4.7-2.7-7.1-4c-4.8-2.8-5.4-6.3-4.7-12c0.1-0.9,0.5-1.8,0.9-2.6c1.5-3.3,3.3-4.1,6.7-2.9c4.6,1.6,8.9,3.8,13.1,6.1c10.2,5.5,20,11.4,27.9,20c13.6,14.8,23.4,31.7,27.6,51.5C263.1,146.1,263.3,153.5,263.2,161.2z"/></g><use xlink:href="#SVGID_1_" style="overflow:visible;fill:none;stroke:#F5C09A;stroke-width:11.6121;stroke-miterlimit:10;"/></g></g></svg>`,
  },
  {
    address: '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34', // USDe
    symbol: 'USDe',
    name: 'Ethena USD',
    decimals: 18,
    logo: `<?xml version="1.0" encoding="utf-8"?><svg version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 397.1 397.1" style="enable-background:new 0 0 397.1 397.1;" xml:space="preserve"><style type="text/css">.st0{fill:#111111;stroke:#111111;stroke-width:7.0536;}.st1{fill:url(#SVGID_1_);fill-opacity:0.7;}.st2{fill:none;stroke:url(#SVGID_2_);stroke-width:7.1429;}.st3{fill-rule:evenodd;clip-rule:evenodd;fill:#FFFFFF;}.st4{fill:#FFFFFF;}</style><path class="st0" d="M198.6,7.1L198.6,7.1c105.8,0,191.5,85.7,191.5,191.5v0c0,105.7-85.7,191.5-191.5,191.5h0C92.8,390.1,7.1,304.3,7.1,198.6v0C7.1,92.8,92.8,7.1,198.6,7.1z"/><radialGradient id="SVGID_1_" cx="-105.9487" cy="595.9377" r="1" gradientTransform="matrix(2.517574e-14 411.151 289.409 -1.772119e-14 -172270.75 43621.418)" gradientUnits="userSpaceOnUse"><stop offset="3.125000e-02" style="stop-color:#3A3A3A"/><stop offset="1" style="stop-color:#1C1C1C"/></radialGradient><path class="st1" d="M198.6,3.6L198.6,3.6c-107.7,0-195,87.3-195,195v0c0,107.7,87.3,195,195,195h0c107.7,0,195-87.3,195-195v0C393.6,90.9,306.3,3.6,198.6,3.6z"/><linearGradient id="SVGID_2_" gradientUnits="userSpaceOnUse" x1="198.5745" y1="399.1429" x2="198.5745" y2="1.994" gradientTransform="matrix(1 0 0 -1 0 399.1429)"><stop offset="0" style="stop-color:#FFFFFF"/><stop offset="1" style="stop-color:#111111"/></linearGradient><path class="st2" d="M198.6,3.6L198.6,3.6c-107.7,0-195,87.3-195,195v0c0,107.7,87.3,195,195,195h0c107.7,0,195-87.3,195-195v0C393.6,90.9,306.3,3.6,198.6,3.6z"/><path class="st3" d="M167.4,38.1C92.1,52.6,35.2,118.9,35.2,198.4s56.9,145.8,132.2,160.3v-15.3c-67-14.3-117.2-73.8-117.2-145s50.2-130.7,117.2-145V38.1z M229.8,53.5V38.2c75.2,14.6,131.9,80.8,131.9,160.2s-56.7,145.6-131.9,160.2v-15.3c66.8-14.4,116.9-73.8,116.9-144.9S296.6,67.9,229.8,53.5z"/><path class="st4" d="M221.7,193c12.5,2.4,22.1,7,29,13.7c6.9,6.6,10.3,15.1,10.3,25.4v16.3c0,12.4-4.5,22.4-13.4,30c-8.9,7.5-20.7,11.2-35.2,11.2h-5v25.9h-17.2v-25.9h-5.3c-9.6,0-18-2.1-25.4-6.4c-7.3-4.4-13.1-10.5-17.2-18.3c-4-8-6-17.1-6-27.5h17.2c0,10.5,2.9,19.1,8.6,25.7c5.9,6.4,13.7,9.7,23.2,9.7h26.6c9.4,0,17-2.2,22.8-6.6c5.7-4.6,8.6-10.5,8.6-17.8v-16.3c0-5.8-2.2-10.7-6.5-14.8c-4.2-4.1-9.9-6.7-17.2-7.9l-43.1-7.6c-12.1-2.2-21.6-6.8-28.3-13.7c-6.7-7-10.1-15.7-10.1-26.2v-13.7c0-12.4,4.3-22.2,12.9-29.5c8.8-7.5,20.4-11.2,34.7-11.2h4.3V81.6h17.2v25.9h5.5c13.6,0,24.5,4.4,32.8,13.2c8.3,8.6,12.5,20.1,12.5,34.3h-17.2c0-9.3-2.6-16.8-7.7-22.4c-5.1-5.6-11.9-8.4-20.4-8.4h-27.1c-9.1,0-16.4,2.2-21.8,6.6c-5.4,4.2-8.1,10-8.1,17.3v13.7c0,5.9,2,10.9,6,15c4.2,4.1,9.8,6.8,17,8.1L221.7,193z"/></svg>`,
  },
];

function normalizeAddress(address?: string | null): string | null {
  if (!address) return null;
  const trimmed = address.trim();
  if (!trimmed || trimmed === '0x' || trimmed === '0x0000000000000000000000000000000000000000') return null;
  const prefixed = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
  if (prefixed.length !== 42) return null;
  return prefixed.toLowerCase();
}

const ENV_TOKEN_CONFIGS = [
  {
    address: process.env.NEXT_PUBLIC_DEFI_TOKEN_ADDRESS,
    symbol: 'DEFI',
    name: 'DeFi Mock Dollar',
    referenceSymbol: 'alUSD',
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1A1A2E" stroke-width="1"/></pattern></defs><rect x="10" y="10" width="180" height="180" rx="30" fill="#050510" stroke="#00F0FF" stroke-width="4"/><rect width="200" height="200" fill="url(#grid)"/><text x="100" y="145" font-family="monospace" font-size="120" font-weight="bold" text-anchor="middle" fill="#00F0FF" style="text-shadow: 0 0 10px #00F0FF;">$</text></svg>`,
  },
  {
    address: process.env.NEXT_PUBLIC_CEFI_TOKEN_ADDRESS,
    symbol: 'CEFI',
    name: 'CeFi Mock Dollar',
    referenceSymbol: 'USDe',
    logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs><linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#FDD835;stop-opacity:1" /><stop offset="100%" style="stop-color:#F57F17;stop-opacity:1" /></linearGradient></defs><circle cx="100" cy="100" r="95" fill="url(#goldGrad)" stroke="#F9A825" stroke-width="5"/><circle cx="100" cy="100" r="85" fill="none" stroke="#FFFDE7" stroke-width="2" stroke-dasharray="5,5"/><text x="100" y="145" font-family="serif" font-size="120" font-weight="bold" text-anchor="middle" fill="#FFFDE7" stroke="#F57F17" stroke-width="2">$</text></svg>`,
  },
];

const ENV_TOKENS: TokenInfo[] = ENV_TOKEN_CONFIGS.flatMap((config) => {
  const normalizedAddress = normalizeAddress(config.address);
  if (!normalizedAddress) return [];

  // If this address already exists in our base registry, prefer the canonical metadata
  const existingToken = BASE_TOKENS.find(
    (token) => token.address.toLowerCase() === normalizedAddress
  );
  if (existingToken) {
    return [];
  }

  const referenceToken = BASE_TOKENS.find((token) => token.symbol === config.referenceSymbol);

  return [
    {
      address: normalizedAddress,
      symbol: config.symbol,
      name: config.name,
      decimals: referenceToken?.decimals ?? 18,
      logo: config.logo,
    },
  ];
});

// Optimism Mainnet stablecoins with 18 decimals
export const OPTIMISM_STABLECOINS: TokenInfo[] = [...BASE_TOKENS, ...ENV_TOKENS];

// Helper function to format address
function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Helper function to get token info by address
export function getTokenInfo(address: string | undefined): TokenInfo | undefined {
  const normalizedAddress = normalizeAddress(address);
  if (!normalizedAddress) return undefined;

  return OPTIMISM_STABLECOINS.find(
    (token) => token.address.toLowerCase().trim() === normalizedAddress
  );
}

// Helper function to get token symbol
export function getTokenSymbol(address: string | undefined): string {
  if (!address) return '???';
  const token = getTokenInfo(address);
  return token?.symbol || shortAddress(address);
}

// Helper function to get token name
export function getTokenName(address: string | undefined): string {
  if (!address) return 'Unknown Token';
  const token = getTokenInfo(address);
  return token?.name || `Token ${shortAddress(address)}`;
}
