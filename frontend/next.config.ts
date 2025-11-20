import type { NextConfig } from 'next';

const walletConnectSafeAliases = {
  pino: 'pino/browser',
  'pino-pretty': 'pino/browser',
  'sonic-boom': 'pino/browser',
  'thread-stream': 'pino/browser',
  'pino-std-serializers': 'pino/browser',
};

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: walletConnectSafeAliases,
    root: __dirname,
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      ...walletConnectSafeAliases,
    };
    return config;
  },
};

export default nextConfig;
