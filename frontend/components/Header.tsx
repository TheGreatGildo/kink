'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { CustomConnectButton } from './CustomConnectButton';
import { ThemeToggle } from './ThemeToggle';
import { PoolsIcon, CreateIcon, SwapIcon, LiquidityIcon, FaucetIcon } from './Icons';

const tabs = [
  { id: 'pools', label: 'Pools', path: '/pools', icon: <PoolsIcon className="w-5 h-5" /> },
  { id: 'create', label: 'Create', path: '/create', icon: <CreateIcon className="w-5 h-5" /> },
  { id: 'swap', label: 'Swap', path: '/swap', icon: <SwapIcon className="w-5 h-5" /> },
  { id: 'liquidity', label: 'Liquidity', path: '/liquidity', icon: <LiquidityIcon className="w-5 h-5" /> },
  { id: 'faucet', label: 'Faucet', path: '/faucet', icon: <FaucetIcon className="w-5 h-5" /> },
];

export default function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const currentPool = searchParams.get('pool');

  const getPathWithParams = (path: string) => {
    if (currentPool && (path === '/swap' || path === '/liquidity')) {
      return `${path}?pool=${currentPool}`;
    }
    return path;
  };

  const isActive = (path: string) => {
    if (path === '/pools' && pathname === '/pools') return true;
    if (path !== '/pools' && pathname.startsWith(path)) return true;
    return false;
  };

  return (
    <nav className="sticky top-0 z-40 mb-4 border-b border-border/40 bg-card/90 backdrop-blur-xl dark:bg-background/80">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3">
            <svg width="42" height="42" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="kinkIcon" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f6a4c0" />
                  <stop offset="50%" stopColor="#c7a4ff" />
                  <stop offset="100%" stopColor="#7fded0" />
                </linearGradient>
              </defs>
              <path
                d="M15 85 Q40 50 55 55 T80 35"
                fill="none"
                stroke="url(#kinkIcon)"
                strokeWidth="8"
                strokeLinecap="round"
              />
              <circle cx="60" cy="55" r="7" fill="#ffffff" stroke="#c7a4ff" strokeWidth="4" />
            </svg>
            <span className="font-bold text-lg uppercase tracking-widest text-foreground">
              KINK DEX
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden flex-1 items-center justify-center md:flex">
            <div className="flex gap-2">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={getPathWithParams(tab.path)}
                  className={`flex items-center gap-2 rounded-full px-5 py-2 font-semibold transition-all ${
                    isActive(tab.path)
                      ? 'bg-primary/90 text-primary-foreground shadow-lg dark:bg-linear-to-r dark:from-[#00ffff] dark:to-[#ff00ff] dark:text-black dark:border-none'
                      : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            <CustomConnectButton />
            <button
              className="md:hidden p-2 text-foreground"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="text-2xl">☰</span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden pt-4 pb-2 animate-in slide-in-from-top-2">
            <div className="flex flex-col gap-3">
              {tabs.map((tab) => (
                <Link
                  key={tab.id}
                  href={getPathWithParams(tab.path)}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 font-semibold transition-all ${
                    isActive(tab.path)
                      ? 'bg-primary/90 text-primary-foreground shadow-lg dark:bg-linear-to-r dark:from-[#00ffff] dark:to-[#ff00ff] dark:text-black dark:border-none'
                      : 'bg-muted text-foreground/70 hover:bg-muted/70'
                  }`}
                >
                  <span className="text-xl">{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              ))}
              <div className="my-2 h-px bg-border/70"></div>
              <ThemeToggle className="w-full justify-between" />
              <div className="flex justify-center">
                <CustomConnectButton />
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
