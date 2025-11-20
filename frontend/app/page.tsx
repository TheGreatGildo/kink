'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { FACTORY_ADDRESS } from '../config/chains';
import { usePools } from '../hooks/usePools';
import CreatePool from '../components/CreatePool';
import Swap from '../components/Swap';
import Liquidity from '../components/Liquidity';
import { ThemeToggle } from '../components/ThemeToggle';
import { PoolCard } from '../components/PoolCard';

const PARTICLE_POSITIONS = Array.from({ length: 20 }, () => ({
  left: Math.random() * 100,
  top: Math.random() * 100,
  duration: 5 + Math.random() * 10,
  delay: Math.random() * 5,
}));

export default function Home() {
  const { isConnected } = useAccount();
  const { pools, loading } = usePools(FACTORY_ADDRESS);
  const [selectedPool, setSelectedPool] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pools' | 'create' | 'swap' | 'liquidity'>('pools');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const tabs = useMemo(
    () => [
      { id: 'pools' as const, label: 'Pools', icon: '𓂺' },
      { id: 'create' as const, label: 'Create', icon: '☞︎☜︎' },
      { id: 'swap' as const, label: 'Swap', icon: '𓁔' },
      { id: 'liquidity' as const, label: 'Liquidity', icon: '𐦒' },
    ],
    []
  );
  const particles = PARTICLE_POSITIONS;

  return (
    <div className="min-vh-100 text-foreground position-relative overflow-hidden">
      {/* Floating particles effect */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {particles.map((particle, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400 rounded-full opacity-30"
            style={{
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              animation: `float ${particle.duration}s ease-in-out infinite`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 mb-4 border-b border-border/40 bg-card/90 backdrop-blur-xl dark:bg-background/80">
        <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Logo */}
              <div className="flex items-center gap-3">
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
              </div>

              {/* Desktop Menu */}
              <div className="hidden flex-1 items-center justify-center md:flex">
                <div className="flex gap-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 rounded-full px-5 py-2 font-semibold transition-all ${
                        activeTab === tab.id
                          ? 'bg-primary/90 text-primary-foreground shadow-lg'
                          : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span>{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <div className="hidden md:block">
                  <ThemeToggle />
                </div>
                <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
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
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        setIsMenuOpen(false);
                      }}
                      className={`flex items-center gap-3 rounded-xl px-4 py-3 font-semibold transition-all ${
                        activeTab === tab.id
                          ? 'bg-primary/90 text-primary-foreground shadow-lg'
                          : 'bg-muted text-foreground/70 hover:bg-muted/70'
                      }`}
                    >
                      <span className="text-xl">{tab.icon}</span>
                      <span>{tab.label}</span>
                    </button>
                  ))}
                  <div className="my-2 h-px bg-border/70"></div>
                  <ThemeToggle className="w-full justify-between" />
                  <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
                </div>
              </div>
            )}
          </div>
      </nav>

      <div className="container mx-auto px-4 md:px-6 relative z-10">
        {/* Header */}
        {!isConnected && (
          <header className="py-20 text-center">
            <h1 className="mb-6 inline-block text-5xl font-semibold text-foreground md:text-6xl">
              KINK DEX
            </h1>
            <p className="mx-auto mb-6 max-w-2xl text-base text-muted-foreground md:text-lg">
              Experimental kinked stableswap protocol with amplified liquidity curves.
            </p>
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border/60 bg-secondary/60 px-4 py-2 text-sm font-medium text-foreground dark:bg-white/5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Live on Optimism Sepolia</span>
            </div>
          </header>
        )}

        {!isConnected ? (
          <section className="flex min-h-[50vh] items-center justify-center py-10">
            <div className="glass-card w-full max-w-md border border-border/40 shadow-2xl">
              <div className="flex flex-col gap-6 p-8">
                <div>
                  <h2 className="mb-3 text-center text-3xl font-bold text-foreground">
                    Connect Wallet
                  </h2>
                  <p className="text-center text-muted-foreground">
                    Connect your wallet to start trading on the kinky side
                  </p>
                </div>
                <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false} />
              </div>
            </div>
          </section>
        ) : (
          <div className="flex flex-col items-center w-full py-10">
            <div className="w-full flex flex-col gap-10 items-center">
              {(activeTab === 'pools' || (!selectedPool && (activeTab === 'swap' || activeTab === 'liquidity'))) && (
                <div className="w-full glass-card p-6 md:p-12 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="flex items-center justify-center gap-4 mb-10">
                    <span className="text-5xl">𓂺</span>
                    <h2 className="text-4xl font-bold gradient-text text-center">
                      {activeTab === 'pools' ? 'Liquidity Pools' : 'Select a Pool'}
                    </h2>
                  </div>
                  {loading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <div className="mb-6 h-20 w-20 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
                      <p className="text-lg text-muted-foreground">Loading pools...</p>
                    </div>
                  ) : pools.length === 0 ? (
                    <div className="py-16 text-center">
                      <div className="mb-6 text-7xl">🏊‍♂️</div>
                      <p className="mb-4 text-2xl text-foreground">No pools found</p>
                      <p className="mb-8 text-lg text-muted-foreground">
                        Create the first kinky pool to get started!
                      </p>
                      <button
                        onClick={() => setActiveTab('create')}
                        className="glow-button rounded-xl px-10 py-4 text-lg font-semibold"
                      >
                        Create Pool
                      </button>
                    </div>
                  ) : (
                    <div className="grid gap-6">
                      {pools.map((pool) => (
                        <PoolCard
                          key={pool.poolAddress}
                          pool={pool}
                          isActive={selectedPool === pool.poolAddress}
                          onSelect={(poolAddress) => {
                            setSelectedPool(poolAddress);
                            if (activeTab === 'pools') setActiveTab('swap');
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'create' && <div className="w-full flex justify-center"><CreatePool /></div>}

              {activeTab === 'swap' && selectedPool && <div className="w-full flex justify-center"><Swap poolAddress={selectedPool} /></div>}

              {activeTab === 'liquidity' && selectedPool && <div className="w-full flex justify-center"><Liquidity poolAddress={selectedPool} /></div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
