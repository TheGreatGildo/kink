'use client';

import '@rainbow-me/rainbowkit/styles.css';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RainbowKitProvider,
  darkTheme as rainbowDarkTheme,
  lightTheme as rainbowLightTheme,
} from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { config } from '../config/wagmi';
import { ThemeProvider, useTheme } from '../components/providers/ThemeProvider';
import Header from '../components/Header';
import BackgroundParticles from '../components/BackgroundParticles';
import './globals.css';
import './milady.css';
import { Suspense } from 'react';

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" data-theme="dark">
      <body className="antialiased">
        <ThemeProvider>
          <AppProviders>
            <BackgroundParticles />
            <Suspense fallback={<div className="h-20" />}>
              <Header />
            </Suspense>
            {children}
          </AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}

function AppProviders({ children }: { children: React.ReactNode }) {
  const { isDarkMode } = useTheme();

  const rainbowTheme = isDarkMode
    ? rainbowDarkTheme({
        borderRadius: 'medium',
        accentColor: '#00ffff', // Cyan accent to match Kink Dex theme
        accentColorForeground: 'black', // Black text on cyan button
        fontStack: 'system',
        overlayBlur: 'small',
      })
    : rainbowLightTheme({
        borderRadius: 'medium',
        accentColor: '#0A3F65'
      });

  // Customize modal colors for dark mode manually if supported by theme object properties
  // RainbowKit themes are objects, we can override specific colors.
  if (isDarkMode) {
     // Deep merge or override colors to match dark theme background
     // Standard dark theme background is #1A1B1E.
     // We want something closer to our oklch(0.24 0.005 240) -> approx #2b2d31 or just darker.
     // Let's try to make it fit seamlessly.
     if (rainbowTheme.colors) {
         rainbowTheme.colors.modalBackground = '#1a1b1f'; // Dark grey/blue
         rainbowTheme.colors.modalText = '#ffffff';
         rainbowTheme.colors.modalBorder = 'rgba(255, 255, 255, 0.1)';
     }
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={rainbowTheme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
