# Escrow CLI - Complete Flow Guide

This guide demonstrates the complete workflow for using the Aztec Escrow CLI.

## Prerequisites

1. **Aztec Sandbox Running**
   ```bash
   aztec start --sandbox
   ```

2. **Contracts Compiled**
   ```bash
   yarn ccc
   ```

## Complete Workflow

### Step 1: Check Initial Configuration

```bash
yarn escrow info
```

Output:
```
=== Current Configuration ===

  Network: sandbox
  Node URL: http://localhost:8080
  Logic Contract: (not set)

  No escrows deployed yet.
  Use 'yarn escrow deploy' to create one.
```

### Step 2: Deploy the Logic Contract

The Logic contract is **required** before deploying any escrows. It authorizes withdrawals from escrows that use its address as salt.

```bash
yarn escrow deploy-logic -p mypassphrase
```

Output:
```
=== Deploy Logic Contract ===

[Educational Note]
  The Logic contract controls which escrows can be withdrawn from.
  When you deploy an escrow, you set its salt = Logic contract address.
  Only the Logic contract can then call withdraw() on that escrow.

  The Logic contract also validates that escrows are legitimate by
  checking their class ID matches the expected Escrow contract class.

[Step 1/3] Getting Escrow contract class ID...
  Escrow Class ID: 0x...

[Step 2/3] Connecting to wallet...
  ✓ Wallet connected

[Step 3/3] Deploying Logic contract...
  ✓ Deployed at 0x1234...

✓ Logic contract deployed successfully!

  Logic Contract Address: 0x1234...
  Escrow Class ID: 0x...

ℹ Logic contract address saved to config.
ℹ You can now deploy escrows with: yarn escrow deploy
```

### Step 3: Deploy an Escrow

```bash
yarn escrow deploy --label "My First Escrow" -p mypassphrase
```

Output:
```
=== Deploy Escrow ===

[Step 1/4] Generating escrow keys...
  Secret key: 0x...

[Educational Note]
  The escrow contract is stateless - there is no storage.
  The 'owner' (Logic contract) is encoded in the deployment salt.
  Only the Logic contract at the salt address can call withdraw().

[Step 2/4] Deriving public keys from secret...
  ✓ Public keys derived

[Step 3/4] Deploying escrow contract...
  Salt (Logic address): 0x1234...
  ✓ Deployed at 0xabcd...

[Step 4/4] Registering keys with wallet...
  ✓ Keys registered

[Educational Note]
  Registering escrow keys allows your wallet to decrypt private notes.
  Without this step, you cannot see the escrow's private balance.

✓ Escrow deployed successfully!

Escrow Details:
  Address: 0xabcd...
  Logic Contract: 0x1234...
  Label: My First Escrow
  Deployed: 2025-01-15T10:30:00.000Z

ℹ Secret key saved to .escrow.json
```

### Step 4: Deploy a Token (if needed)

If you don't have a token contract, deploy one first using the sandbox accounts or a separate script.

### Step 5: Fund the Escrow

Mint private tokens to the escrow:

```bash
yarn escrow fund \
  --token 0x<token_address> \
  --amount 1000 \
  -p mypassphrase
```

Output:
```
=== Fund Escrow ===

ℹ Funding escrow 0xabcd...
  Token: 0x<token_address>
  Amount: 1000
→ Connecting to token contract...
  Current private balance: 0
→ Minting tokens to escrow...
✓ Tokens minted successfully!

Escrow Balance:
  Escrow: 0xabcd...
  Token: 0x<token_address>
  Public Balance: 0
  Private Balance: 1000
```

### Step 6: Check Escrow Balance

```bash
yarn escrow balance --token 0x<token_address> -p mypassphrase
```

Output:
```
=== Escrow Balance ===

→ Registering escrow keys for note decryption...
→ Connecting to token contract...
→ Querying balances...

Escrow Balance:
  Escrow: 0xabcd...
  Token: 0x<token_address>
  Public Balance: 0
  Private Balance: 1000
```

### Step 7: Withdraw from Escrow

Withdraw tokens via the Logic contract:

```bash
yarn escrow withdraw \
  --token 0x<token_address> \
  --amount 500 \
  --recipient 0x<recipient_address> \
  -p mypassphrase
```

Output:
```
=== Withdraw from Escrow ===

[Educational Note]
  Withdrawals must go through the Logic contract.
  The escrow checks that msg_sender == salt (Logic address).
  This ensures only authorized withdrawals succeed.

ℹ Withdrawing from escrow 0xabcd...
  Token: 0x<token_address>
  Amount: 500
  Recipient: 0x<recipient_address>
  Logic Contract: 0x1234...
→ Connecting to escrow...
→ Executing withdrawal via Logic contract...
✓ Withdrawal successful!

ℹ Escrow balance after withdrawal:
  Private: 500

ℹ Recipient balance after withdrawal:
  Private: 500
```

### Step 8: List All Escrows

```bash
yarn escrow list
```

Output:
```
=== Escrow Info ===

Deployed Escrows:
  1. 0xabcd... (My First Escrow)
     Logic: 0x1234...

ℹ Total: 1 escrow(s)
ℹ Use 'yarn escrow info --escrow <address>' for details
```

### Step 9: View Escrow Keys

```bash
yarn escrow show-keys
```

Output:
```
=== Escrow Keys ===

ℹ Keys for escrow: 0xabcd...

[Educational Note - Master Secret Keys]
  nsk_m  - Nullifier Secret Key: Used for spending notes
  ivsk_m - Incoming Viewing Key: Decrypt incoming notes
  ovsk_m - Outgoing Viewing Key: View outgoing transactions
  tsk_m  - Tagging Secret Key: Used for note tagging

Master Secret Keys:
  nsk_m (Nullifier): 0x...
  ivsk_m (Incoming Viewing): 0x...
  ovsk_m (Outgoing Viewing): 0x...
  tsk_m (Tagging): 0x...

⚠ Keep these keys secure! Anyone with these keys can:
ℹ   - View all private notes owned by the escrow
ℹ   - Spend notes if they control the Logic contract
```

### Step 10: Share Keys with Another Party

```bash
yarn escrow share-keys --recipient 0x<recipient_address>
```

Or export keys in JSON format:

```bash
yarn escrow export-keys
```

Output:
```json
{
  "escrowAddress": "0xabcd...",
  "secretKey": "0x...",
  "logicAddress": "0x1234...",
  "label": "My First Escrow"
}
```

### Step 11: Register External Escrow Keys

If you received escrow keys from someone else:

```bash
yarn escrow register-keys \
  --escrow 0x<escrow_address> \
  --secret 0x<secret_key> \
  -p mypassphrase
```

## Network Options

### Using Sandbox (Default)

```bash
yarn escrow --sandbox deploy --label "Sandbox Escrow"
```

### Using Devnet

```bash
yarn escrow --devnet deploy --label "Devnet Escrow"
```

## Command Reference

| Command | Description |
|---------|-------------|
| `setup` | Configure Logic contract and token addresses |
| `info` | Show current configuration |
| `deploy-logic` | Deploy the Logic contract (required first!) |
| `deploy` | Deploy a new escrow contract |
| `fund` | Fund an escrow with tokens |
| `balance` | Check escrow token balance |
| `withdraw` | Withdraw from escrow via Logic contract |
| `list` | List all deployed escrows |
| `show-keys` | Display escrow master secret keys |
| `share-keys` | Share escrow keys with another participant |
| `register-keys` | Register external escrow keys |
| `export-keys` | Export escrow keys in JSON format |

## Global Options

| Option | Description |
|--------|-------------|
| `--sandbox` | Connect to local sandbox (localhost:8080) |
| `--devnet` | Connect to Aztec devnet |
| `-p, --passphrase` | Wallet passphrase (non-interactive) |
| `-V, --version` | Output version number |
| `-h, --help` | Display help |

## Configuration File

The CLI stores configuration in `.escrow.json`:

```json
{
  "network": "sandbox",
  "nodeUrl": "http://localhost:8080",
  "logicContractAddress": "0x1234...",
  "tokenAddress": "0x5678...",
  "escrows": [
    {
      "address": "0xabcd...",
      "secretKey": "0x...",
      "logicAddress": "0x1234...",
      "deployedAt": "2025-01-15T10:30:00.000Z",
      "label": "My First Escrow"
    }
  ]
}
```

## Understanding the Escrow Pattern

### Stateless Design

The escrow contract has **no storage**. The "owner" (Logic contract) is encoded in the contract's deployment salt:

```
Escrow Salt = Logic Contract Address
```

This means only the Logic contract can call `withdraw()` on the escrow.

### Key Management

Each escrow has 4 master secret keys derived from a single secret:

1. **nsk_m** (Nullifier Secret Key) - For spending notes
2. **ivsk_m** (Incoming Viewing Secret Key) - For decrypting incoming notes
3. **ovsk_m** (Outgoing Viewing Secret Key) - For viewing outgoing transactions
4. **tsk_m** (Tagging Secret Key) - For note tagging

### Note Decryption

To see the escrow's private balance, you must register the escrow keys with your wallet:

```typescript
await wallet.registerContract(escrow.instance, EscrowContractArtifact, secretKey);
```

Without this registration, `balance_of_private()` will return 0.

### Authorization Flow

1. User deploys escrow with `salt = logicContractAddress`
2. Logic contract calls `escrow.withdraw(token, amount, recipient)`
3. Escrow checks: `msg_sender == salt` (i.e., caller is the Logic contract)
4. If authorized, escrow transfers tokens to recipient

## Troubleshooting

### "Failed to connect to Aztec node"

Make sure the sandbox is running:
```bash
aztec start --sandbox
```

### "Not Authorized" on withdraw

The caller must be the Logic contract. Ensure:
- The escrow was deployed with the correct Logic contract address as salt
- You're calling withdraw from the Logic contract, not directly

### "Private balance is 0"

This could mean:
- The escrow has no private tokens
- The escrow keys are not registered with your wallet
- Run `yarn escrow balance` which will auto-register keys

### "Escrow not found"

Specify the escrow address explicitly:
```bash
yarn escrow balance --escrow 0x<address> --token 0x<token>
```
