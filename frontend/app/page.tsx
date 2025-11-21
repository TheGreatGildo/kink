'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen text-foreground relative overflow-hidden flex flex-col items-center justify-center">
      <div className="container mx-auto px-4 md:px-6 relative z-10 text-center">
        <header className="py-20 text-center flex flex-col items-center">
          <h1 className="mb-6 text-6xl md:text-8xl font-bold bg-linear-to-r from-[#00ffff] to-[#ff00ff] bg-clip-text text-transparent text-center animate-in fade-in zoom-in duration-1000">
            KINK DEX
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl text-muted-foreground md:text-2xl">
            Experimental kinked stableswap protocol with amplified liquidity curves.
          </p>

          <div className="flex flex-col items-center gap-6">
            <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border/60 bg-secondary/60 px-4 py-2 text-sm font-medium text-foreground dark:bg-white/5">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span>Live on Optimism Mainnet</span>
            </div>

            <div className="flex gap-4 mt-4">
              <Link
                href="/pools"
                className="glow-button rounded-xl px-10 py-4 text-xl font-bold dark:bg-linear-to-r dark:from-[#00ffff] dark:to-[#ff00ff] dark:text-black dark:border-none hover:scale-105 transition-transform"
              >
                Launch App
              </Link>
            </div>
          </div>
        </header>
      </div>
    </div>
  );
}
