# Kink DEX

A permissionless DEX on Optimism Mainnet with center-kinked Stableswap pools.

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

You can now install dependencies and run every frontend script from the repo root (Vercel will do the same):

```bash
npm install        # installs root scripts + frontend via postinstall
npm run dev        # proxies to frontend/dev
```

If you prefer jumping straight into the app directory, the previous workflow still works:

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Add/override contract addresses in .env.local as needed
npm run dev
```

## Frontend Deployment (Vercel)

Vercel can use its default install (`npm install`) and build (`npm run build`) commands from the repository root. The root `package.json` proxies those scripts to the Next.js app under `frontend/`, so no custom build settings are required.

1. Copy the sample env file and customize it locally:
   ```bash
   cp frontend/.env.local.example frontend/.env.local
   ```
2. In the Vercel dashboard, create a new project from this repo. Leave the default install/build commands; Vercel will detect Next.js automatically.
3. Add the following environment variables (Preview + Production):

   | Key | Suggested value | Purpose |
   | --- | --- | --- |
   | `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Your WalletConnect Cloud ID | Required for RainbowKit modal |
   | `NEXT_PUBLIC_FACTORY_ADDRESS` | `0x567e890879750538cf84CB38dd18d8dBed907565` | Optimism factory |
   | `NEXT_PUBLIC_ROUTER_ADDRESS` | `0x8878bD48fB5278520524a9cd05506bF28bE79601` | Optimism router |
   | `NEXT_PUBLIC_POOL_ADDRESS` | `0x721199250a4d16C713D4A6D8388Bc89000aCb7b9` | Default DEFI/CEFI pool |
   | `NEXT_PUBLIC_DEFI_TOKEN_ADDRESS` | `0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A` | Token override (optional) |
   | `NEXT_PUBLIC_CEFI_TOKEN_ADDRESS` | `0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34` | Token override (optional) |

4. Trigger a deployment. The build output remains `.next/`, so no extra configuration is necessary.

Whenever you redeploy contracts, update the `.env.local` file locally and mirror the changes inside Vercel’s Environment Variables page before re-deploying.

## Deployment

Contracts are live on Optimism Mainnet. The latest deployment artifact is stored in `foundry/deployment-optimism.json` and currently reports:

```
Factory: 0x567e890879750538cf84CB38dd18d8dBed907565
Router:  0x8878bD48fB5278520524a9cd05506bF28bE79601
Chain:   Optimism (chainId 10)
```

To redeploy:

1. Copy `.env.example` to `.env` inside `foundry/` and populate `PRIVATE_KEY`, `OPTIMISM_RPC_URL`, and any optional helper values.
2. Run the Optimism deployment helper:
   ```bash
   cd foundry
   forge script script/DeployOptimism.s.sol:DeployOptimism \
     --rpc-url $OPTIMISM_RPC_URL \
     --broadcast
   ```
3. Update `frontend/.env.local` (from `frontend/.env.local.example`) with the emitted addresses so the Next.js app points to the live mainnet contracts.

## License

MIT

