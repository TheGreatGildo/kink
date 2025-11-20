#!/bin/bash
# Deploy Kink DEX to Optimism and set up frontend configuration

set -e

echo "🚀 Deploying Kink DEX to Optimism..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "📝 Please copy .env.example to .env and fill in your values:"
    echo "   cp .env.example .env"
    exit 1
fi

# Load environment variables
source .env

# Check required variables
if [ -z "$PRIVATE_KEY" ]; then
    echo "❌ Error: PRIVATE_KEY not set in .env"
    exit 1
fi

if [ -z "$OPTIMISM_RPC_URL" ]; then
    echo "❌ Error: OPTIMISM_RPC_URL not set in .env"
    exit 1
fi

# Build contracts
echo "📦 Building contracts..."
forge build

# Extract ABIs to frontend
echo "📄 Extracting ABIs..."
mkdir -p ../frontend/contracts
cp out/KinkFactory.sol/KinkFactory.json ../frontend/contracts/ 2>/dev/null || true
cp out/KinkRouter.sol/KinkRouter.json ../frontend/contracts/ 2>/dev/null || true
cp out/KinkPool.sol/KinkPool.json ../frontend/contracts/ 2>/dev/null || true
echo "✅ ABIs copied to frontend/contracts/"

# Deploy to Optimism
echo "🌉 Deploying to Optimism..."
DEPLOY_OUTPUT=$(forge script script/DeployOptimism.s.sol:DeployOptimism \
    --rpc-url $OPTIMISM_RPC_URL \
    --broadcast 2>&1)

# Extract addresses from output
FACTORY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "FACTORY_ADDRESS=" | sed 's/.*FACTORY_ADDRESS= //' | tr -d ' ')
ROUTER_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "ROUTER_ADDRESS=" | sed 's/.*ROUTER_ADDRESS= //' | tr -d ' ')

# Also try to extract from logs if the above didn't work
if [ -z "$FACTORY_ADDRESS" ]; then
    FACTORY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "KinkFactory deployed at:" | sed 's/.*KinkFactory deployed at: //' | sed 's/ .*//')
fi
if [ -z "$ROUTER_ADDRESS" ]; then
    ROUTER_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "KinkRouter deployed at:" | sed 's/.*KinkRouter deployed at: //' | sed 's/ .*//')
fi

# Read deployment addresses
if [ -n "$FACTORY_ADDRESS" ] && [ -n "$ROUTER_ADDRESS" ]; then

    echo ""
    echo "✅ Deployment complete!"
    echo ""
    echo "📋 Add these to your frontend/.env.local:"
    echo "NEXT_PUBLIC_FACTORY_ADDRESS=$FACTORY_ADDRESS"
    echo "NEXT_PUBLIC_ROUTER_ADDRESS=$ROUTER_ADDRESS"
    echo ""

    # Create frontend .env.local if it doesn't exist
    if [ ! -f ../frontend/.env.local ]; then
        echo "📝 Creating frontend/.env.local..."
        {
            echo "# Kink DEX Contract Addresses (Optimism Mainnet)"
            echo "NEXT_PUBLIC_FACTORY_ADDRESS=$FACTORY_ADDRESS"
            echo "NEXT_PUBLIC_ROUTER_ADDRESS=$ROUTER_ADDRESS"
            if [ -n "$WALLETCONNECT_PROJECT_ID" ]; then
                echo "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=$WALLETCONNECT_PROJECT_ID"
            else
                echo ""
                echo "# Optional: WalletConnect Project ID"
                echo "# NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here"
            fi
        } > ../frontend/.env.local
        echo "✅ Created frontend/.env.local"
    else
        echo "⚠️  frontend/.env.local already exists - please update it manually"
    fi
    # Save to JSON for reference
    cat > deployment-optimism.json << EOF
{
  "factory": "$FACTORY_ADDRESS",
  "router": "$ROUTER_ADDRESS",
  "chainId": "10",
  "chainName": "optimism"
}
EOF
else
    echo "⚠️  Could not extract deployment addresses - deployment may have failed"
    echo "$DEPLOY_OUTPUT"
    exit 1
fi

# Create pool and add initial liquidity
echo ""
echo "🏊 Creating pool and adding initial liquidity..."
export FACTORY_ADDRESS=$FACTORY_ADDRESS
forge script script/CreatePoolAndAddLiquidity.s.sol:CreatePoolAndAddLiquidity \
    --rpc-url $OPTIMISM_RPC_URL \
    --broadcast

if [ -f pool-info.json ]; then
    POOL_ADDRESS=$(jq -r '.pool' pool-info.json)
    echo ""
    echo "✅ Pool created at: $POOL_ADDRESS"
    echo "📋 Pool info saved to pool-info.json"
else
    echo "⚠️  pool-info.json not found - pool creation may have failed"
fi

echo ""
echo "🎉 Setup complete! Next steps:"
echo "1. Review frontend/.env.local"
echo "2. Review pool-info.json for pool details"
echo "3. Run 'cd frontend && npm run dev' to start the frontend"
echo "4. Connect your wallet and start trading!"

