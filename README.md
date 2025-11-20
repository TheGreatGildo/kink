# Kink DEX

A permissionless DEX on Optimism Sepolia with center-kinked Stableswap pools.

## Project Structure

```
kink-dex/
├── foundry/                 # Smart Contracts
│   ├── src/
│   │   ├── KinkPool.sol     # Core pool logic
│   │   ├── KinkFactory.sol  # Factory for creating pools
│   │   ├── KinkRouter.sol   # Router for swaps
│   │   ├── libraries/       # Math libraries
│   │   └── mocks/           # Mock tokens
│   ├── script/              # Deployment scripts
│   └── test/                # Tests
├── frontend/                # Next.js Frontend
│   ├── app/                 # Next.js app directory
│   ├── components/         # React components
│   ├── hooks/               # Custom hooks
│   └── config/              # Configuration
└── specs/                   # Documentation
```

## Smart Contracts

### KinkPool
The core pool contract implementing the kinked Stableswap invariant. Pools use different amplification parameters (A0, A1) and fees depending on which side of the 1:1 peg they're on.

### KinkFactory
Factory contract that creates new pools using the minimal proxy pattern (EIP-1167).

### KinkRouter
Router contract for simplified swap interactions with slippage protection.

## Development

### Foundry Setup

```bash
cd foundry
forge install
forge build
forge test
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Add your contract addresses to .env.local
npm run dev
```

## Deployment

1. Set your `PRIVATE_KEY` environment variable
2. Run the deployment script:
```bash
cd foundry
forge script script/Deploy.s.sol:DeployScript --rpc-url <RPC_URL> --broadcast
```

## License

MIT

