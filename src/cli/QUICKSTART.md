# Escrow CLI - Quick Start Commands

Copy and paste these commands line by line to experience the complete escrow lifecycle.

## Prerequisites

```bash
# 1. Start Aztec Sandbox (in a separate terminal)
aztec start --sandbox

# 2. Compile contracts and generate artifacts
yarn ccc
```

## Complete Lifecycle - Copy & Paste Line by Line

```bash
# Step 1: Check initial configuration
yarn escrow info

# Step 2: Deploy the Logic contract (required first)
yarn escrow deploy-logic -p hola

# Step 3: Deploy a Token contract for testing
yarn escrow deploy-token -p hola

# Step 4: Deploy an Escrow
yarn escrow deploy --label "Demo Escrow" -p hola

# Step 5: List deployed escrows
yarn escrow list

# Step 6: Fund the escrow with 1000 tokens
yarn escrow fund --amount 1000 -p hola

# Step 7: Check escrow balance
yarn escrow balance -p hola

# Step 8: View escrow secret keys
yarn escrow show-keys

# Step 9: Withdraw 500 tokens from escrow
yarn escrow withdraw --amount 500 -p hola

# Step 10: Check balance after withdrawal (should be 500)
yarn escrow balance -p hola

# Step 11: Withdraw remaining 500 tokens
yarn escrow withdraw --amount 500 -p hola

# Step 12: Final balance check (should be 0)
yarn escrow balance -p hola

# Step 13: Export keys in JSON format
yarn escrow export-keys

# Step 14: View final configuration
yarn escrow info
```

## What Each Command Does

| Step | Command | Description |
|------|---------|-------------|
| 1 | `info` | Shows current config (network, Logic contract, Token, escrows) |
| 2 | `deploy-logic` | Deploys the Logic contract that authorizes withdrawals |
| 3 | `deploy-token` | Deploys a test token (you become the minter) |
| 4 | `deploy` | Deploys an escrow controlled by the Logic contract |
| 5 | `list` | Lists all deployed escrows |
| 6 | `fund` | Mints private tokens to the escrow |
| 7 | `balance` | Checks escrow's private token balance |
| 8 | `show-keys` | Displays the 4 master secret keys |
| 9-11 | `withdraw` | Withdraws tokens via Logic contract |
| 13 | `export-keys` | Exports keys as JSON for sharing |

## Expected Output Summary

After running all commands, you should see:
- Logic contract deployed and saved to config
- Token contract deployed and saved to config
- Escrow deployed with auto-generated keys
- Balance going: 0 → 1000 → 500 → 0
- Keys displayed and exportable

## Alternative: Specify Custom Options

```bash
# Deploy token with custom name
yarn escrow deploy-token --name "MyToken" --symbol "MTK" -p hola

# Deploy escrow with custom label
yarn escrow deploy --label "Production Escrow" -p hola

# Fund specific escrow with specific token
yarn escrow fund --token 0x... --escrow 0x... --amount 500 -p hola

# Withdraw to different recipient
yarn escrow withdraw --amount 100 --recipient 0x... -p hola
```

## Network Options

```bash
# Use sandbox (default)
yarn escrow --sandbox deploy-logic -p hola

# Use devnet
yarn escrow --devnet deploy-logic -p hola
```

## Troubleshooting

```bash
# Sandbox not running?
aztec start --sandbox

# Contracts not compiled?
yarn ccc

# Reset everything?
rm .escrow.json

# Check what's configured?
yarn escrow info
```

## Full Command Reference

```
yarn escrow info              # Show configuration
yarn escrow deploy-logic      # Deploy Logic contract
yarn escrow deploy-token      # Deploy Token contract
yarn escrow deploy            # Deploy Escrow
yarn escrow fund              # Fund escrow with tokens
yarn escrow balance           # Check escrow balance
yarn escrow withdraw          # Withdraw from escrow
yarn escrow list              # List all escrows
yarn escrow show-keys         # Display secret keys
yarn escrow export-keys       # Export keys as JSON
yarn escrow share-keys        # Share keys with recipient
yarn escrow register-keys     # Register external keys
yarn escrow setup             # Configure addresses manually
```
