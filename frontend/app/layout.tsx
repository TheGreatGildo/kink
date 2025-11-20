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
import './globals.css';

const queryClient = new QueryClient();

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeProvider>
          <AppProviders>{children}</AppProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}

function AppProviders({ children }: { children: React.ReactNode }) {
  const { isDarkMode } = useTheme();

  const rainbowTheme = isDarkMode
    ? rainbowDarkTheme({ borderRadius: 'medium', accentColor: '#F5C09A' })
    : rainbowLightTheme({ borderRadius: 'medium', accentColor: '#0A3F65' });

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
