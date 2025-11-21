import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { TokenLogo } from './TokenLogo';
import { CEFI_TOKEN_ADDRESS, DEFI_TOKEN_ADDRESS } from '../config/chains';

interface TokenOption {
  symbol: string;
  name: string;
  address: string;
  type: 'cefi' | 'defi';
}

// Popular 18-decimal stablecoins on Optimism
const BASE_TOKENS: TokenOption[] = [
  { symbol: 'USDe', name: 'Ethena USD', address: '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34', type: 'cefi' },
  { symbol: 'alUSD', name: 'Alchemix USD', address: '0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A', type: 'defi' },
  { symbol: 'DAI', name: 'Dai Stablecoin', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', type: 'defi' },
  { symbol: 'LUSD', name: 'Liquity USD', address: '0xc40F949F8a4e094D1b49a23ea9241D289B7b2819', type: 'defi' },
  { symbol: 'sUSD', name: 'Synthetix USD', address: '0x8c6f28f2F1A3C87F0f938b96d27520d9751ec8d9', type: 'defi' },
  { symbol: 'FRAX', name: 'Frax', address: '0x2E3D870790dC77A83DD1d18184Acc7439A53f475', type: 'defi' },
  { symbol: 'wUSDM', name: 'Wrapped USDM', address: '0x57F5E098CaD7A3D1Eaaa8C8E51c60F7259b974b7', type: 'cefi' },
];

// Deduplicate and ensure configured tokens are present
const POPULAR_TOKENS: TokenOption[] = [...BASE_TOKENS];

// Ensure Configured CeFi Token is in list
if (!POPULAR_TOKENS.some(t => t.address.toLowerCase() === CEFI_TOKEN_ADDRESS.toLowerCase())) {
  POPULAR_TOKENS.unshift({
    symbol: 'CEFI',
    name: 'Configured CeFi Token',
    address: CEFI_TOKEN_ADDRESS,
    type: 'cefi'
  });
}

// Ensure Configured DeFi Token is in list
if (!POPULAR_TOKENS.some(t => t.address.toLowerCase() === DEFI_TOKEN_ADDRESS.toLowerCase())) {
  POPULAR_TOKENS.unshift({
    symbol: 'DEFI',
    name: 'Configured DeFi Token',
    address: DEFI_TOKEN_ADDRESS,
    type: 'defi'
  });
}

interface TokenSelectorProps {
  value: string;
  onChange: (address: string) => void;
  label: string;
}

export function TokenSelector({ value, onChange, label }: TokenSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Find selected token info if it matches one of our popular tokens
  const selectedToken = POPULAR_TOKENS.find(t => t.address.toLowerCase() === value.toLowerCase());

  const filteredTokens = POPULAR_TOKENS.filter(token =>
    token.symbol.toLowerCase().includes(search.toLowerCase()) ||
    token.name.toLowerCase().includes(search.toLowerCase()) ||
    token.address.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (address: string) => {
    onChange(address);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <label className="block text-base font-semibold text-foreground mb-3">
        {label}
      </label>

      <div className="relative">
        <div
          className="w-full text-lg bg-input border border-border rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-3 flex-1 overflow-hidden">
            {value ? (
              <>
                <TokenLogo address={value} size={28} />
                <div className="flex flex-col items-start truncate">
                  <span className="font-bold text-foreground">
                    {selectedToken ? selectedToken.symbol : 'Custom Token'}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono truncate max-w-[200px]">
                    {value}
                  </span>
                </div>
              </>
            ) : (
              <span className="text-muted-foreground">Select Token</span>
            )}
          </div>
          <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>

        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search symbol or paste address..."
                  className="w-full bg-input/50 border border-border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/70"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    // If input looks like an address, update parent immediately
                    if (e.target.value.startsWith('0x') && e.target.value.length === 42) {
                      onChange(e.target.value);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto scrollbar-thin">
              {search && !search.startsWith('0x') && filteredTokens.length === 0 && (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  No popular tokens found
                </div>
              )}

              {filteredTokens.map((token) => (
                <button
                  key={token.address}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors group text-left"
                  onClick={() => handleSelect(token.address)}
                >
                  <div className="flex items-center gap-3">
                    <TokenLogo address={token.address} size={32} />
                    <div>
                      <div className="font-bold text-foreground group-hover:text-primary transition-colors">
                        {token.symbol}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {token.name}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-bold ${
                      token.type === 'cefi'
                        ? 'bg-[#00ffff]/10 text-[#00ffff]'
                        : 'bg-[#ff00ff]/10 text-[#ff00ff]'
                    }`}>
                      {token.type}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
