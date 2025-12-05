/**
 * Escrow Commands - Core escrow operations
 *
 * Commands: deploy, fund, balance, withdraw, info
 */

import type { Command } from 'commander';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';

import type {
  WalletContext,
  DeployEscrowOptions,
  FundEscrowOptions,
  BalanceOptions,
  WithdrawOptions,
} from '../types/index.js';
import {
  generateEscrowSecretKey,
  deriveEscrowKeys,
  deployEscrowWithSponsoredFees,
  registerEscrowWithWallet,
  connectToEscrow,
  getEscrowClassId,
  deployLogicContractWithSponsoredFees,
} from '../services/escrow.js';
import {
  registerToken,
  getBalances,
  mintPrivateTokens,
  withdrawFromEscrow,
  deployToken,
} from '../services/contract.js';
import {
  loadConfig,
  addEscrow,
  findEscrow,
  getLatestEscrow,
  getLogicAddress,
  getTokenAddress,
  getEscrows,
  setLogicAddress,
  setTokenAddress,
} from '../services/config.js';
import { getSponsoredPaymentMethod } from '../services/wallet.js';
import * as display from '../utils/display.js';
import * as prompts from '../utils/prompts.js';

/**
 * Deploy a new escrow contract.
 */
async function deployCommand(getWallet: () => Promise<WalletContext>, options: DeployEscrowOptions): Promise<void> {
  display.header('Deploy Escrow');

  // Step 1: Get Logic contract address
  let logicAddress = options.logicAddress || getLogicAddress();
  if (!logicAddress) {
    display.warn('No Logic contract address configured.');
    display.info('The Logic contract controls who can withdraw from the escrow.');
    logicAddress = await prompts.promptLogicAddress();
  }

  display.stepStart(1, 4, 'Generating escrow keys...');
  const secretKey = generateEscrowSecretKey();
  display.stepValue('Secret key', secretKey.toString());

  display.explainEscrowDeployment();

  // Step 2: Derive public keys
  display.stepStart(2, 4, 'Deriving public keys from secret...');
  const { publicKeys, masterSecretKeys } = await deriveEscrowKeys(secretKey);
  display.stepComplete('Public keys derived');

  // Step 3: Get wallet and deploy
  display.stepStart(3, 4, 'Deploying escrow contract...');
  display.stepValue('Salt (Logic address)', logicAddress);

  const { wallet, accountAddress } = await getWallet();
  const paymentMethod = await getSponsoredPaymentMethod(wallet);

  const escrow = await deployEscrowWithSponsoredFees(
    publicKeys,
    wallet,
    accountAddress,
    AztecAddress.fromString(logicAddress),
    paymentMethod,
  );

  display.stepComplete(`Deployed at ${escrow.address.toString()}`);

  // Step 4: Register keys with wallet
  display.stepStart(4, 4, 'Registering keys with wallet...');
  await registerEscrowWithWallet(wallet, escrow.instance, secretKey);
  display.stepComplete('Keys registered');

  display.explainKeyRegistration();

  // Save to config
  const label = options.label || undefined;
  addEscrow({
    address: escrow.address.toString(),
    secretKey: secretKey.toString(),
    logicAddress,
    deployedAt: new Date().toISOString(),
    label,
  });

  display.success('Escrow deployed successfully!');
  display.escrowInfo({
    address: escrow.address.toString(),
    secretKey: secretKey.toString(),
    logicAddress,
    deployedAt: new Date().toISOString(),
    label,
  });

  display.info('Secret key saved to .escrow.json');
}

/**
 * Fund an escrow with tokens.
 */
async function fundCommand(getWallet: () => Promise<WalletContext>, options: FundEscrowOptions): Promise<void> {
  display.header('Fund Escrow');

  // Get escrow
  let escrowEntry = options.escrow ? findEscrow(options.escrow) : getLatestEscrow();

  if (!escrowEntry) {
    if (options.escrow) {
      display.error(`Escrow not found: ${options.escrow}`);
    } else {
      display.error("No escrows deployed. Run 'yarn escrow deploy' first.");
    }
    return;
  }

  // Get token address
  const tokenAddress = options.token || getTokenAddress();
  if (!tokenAddress) {
    display.error('Token address required. Use --token <address>');
    return;
  }

  // Parse amount
  const amount = BigInt(options.amount);

  display.info(`Funding escrow ${display.formatAddress(escrowEntry.address)}`);
  display.keyValue('Token', tokenAddress);
  display.keyValue('Amount', amount.toString());

  // Get wallet
  const { wallet, accountAddress, node } = await getWallet();
  const paymentMethod = await getSponsoredPaymentMethod(wallet);

  // Register token
  display.step('Connecting to token contract...');
  const token = await registerToken(wallet, AztecAddress.fromString(tokenAddress), node);

  // Check current balance
  const escrowAddress = AztecAddress.fromString(escrowEntry.address);
  const beforeBalance = await getBalances(token, escrowAddress, accountAddress);
  display.keyValue('Current private balance', beforeBalance.privateBalance.toString());

  // Mint tokens to escrow
  display.step('Minting tokens to escrow...');
  await mintPrivateTokens(token, wallet, accountAddress, escrowAddress, amount, paymentMethod);

  // Check new balance
  const afterBalance = await getBalances(token, escrowAddress, accountAddress);
  display.success('Tokens minted successfully!');
  display.escrowBalance(escrowEntry.address, tokenAddress, afterBalance.publicBalance, afterBalance.privateBalance);
}

/**
 * Check escrow balance.
 */
async function balanceCommand(getWallet: () => Promise<WalletContext>, options: BalanceOptions): Promise<void> {
  display.header('Escrow Balance');

  // Get escrow
  let escrowEntry = options.escrow ? findEscrow(options.escrow) : getLatestEscrow();

  if (!escrowEntry) {
    if (options.escrow) {
      display.error(`Escrow not found: ${options.escrow}`);
    } else {
      display.error("No escrows deployed. Run 'yarn escrow deploy' first.");
    }
    return;
  }

  // Get token address
  const tokenAddress = options.token || getTokenAddress();
  if (!tokenAddress) {
    display.error('Token address required. Use --token <address>');
    return;
  }

  // Get wallet
  const { wallet, accountAddress, node } = await getWallet();

  // Register escrow with keys for note decryption
  const secretKey = Fr.fromString(escrowEntry.secretKey);
  const escrowAddress = AztecAddress.fromString(escrowEntry.address);

  display.step('Registering escrow keys for note decryption...');
  const escrow = await connectToEscrow(wallet, escrowAddress);
  await registerEscrowWithWallet(wallet, escrow.instance, secretKey);

  // Register token
  display.step('Connecting to token contract...');
  const token = await registerToken(wallet, AztecAddress.fromString(tokenAddress), node);

  // Get balances
  display.step('Querying balances...');
  const { publicBalance, privateBalance } = await getBalances(token, escrowAddress, accountAddress);

  display.escrowBalance(escrowEntry.address, tokenAddress, publicBalance, privateBalance);

  if (privateBalance === 0n) {
    display.warn('Private balance is 0. This could mean:');
    display.info('  - The escrow has no private tokens');
    display.info('  - The escrow keys are not properly registered');
  }
}

/**
 * Withdraw from escrow via Logic contract.
 */
async function withdrawCommand(getWallet: () => Promise<WalletContext>, options: WithdrawOptions): Promise<void> {
  display.header('Withdraw from Escrow');

  display.explainWithdraw();

  // Get escrow
  let escrowEntry = options.escrow ? findEscrow(options.escrow) : getLatestEscrow();

  if (!escrowEntry) {
    if (options.escrow) {
      display.error(`Escrow not found: ${options.escrow}`);
    } else {
      display.error("No escrows deployed. Run 'yarn escrow deploy' first.");
    }
    return;
  }

  // Get token address
  const tokenAddress = options.token || getTokenAddress();
  if (!tokenAddress) {
    display.error('Token address required. Use --token <address>');
    return;
  }

  // Parse amount
  const amount = BigInt(options.amount);

  // Get wallet
  const { wallet, accountAddress, node } = await getWallet();
  const paymentMethod = await getSponsoredPaymentMethod(wallet);

  // Recipient defaults to caller
  const recipient = options.recipient ? AztecAddress.fromString(options.recipient) : accountAddress;

  display.info(`Withdrawing from escrow ${display.formatAddress(escrowEntry.address)}`);
  display.keyValue('Token', tokenAddress);
  display.keyValue('Amount', amount.toString());
  display.keyValue('Recipient', recipient.toString());
  display.keyValue('Logic Contract', escrowEntry.logicAddress);

  // Register escrow keys for note access
  display.step('Registering escrow keys...');
  const escrowAddress = AztecAddress.fromString(escrowEntry.address);
  const escrow = await connectToEscrow(wallet, escrowAddress);
  const secretKey = Fr.fromString(escrowEntry.secretKey);
  await registerEscrowWithWallet(wallet, escrow.instance, secretKey);

  // Execute withdraw via Logic contract
  display.step('Executing withdrawal via Logic contract...');

  try {
    await withdrawFromEscrow(
      wallet,
      accountAddress, // The user's account calls the Logic contract
      AztecAddress.fromString(escrowEntry.logicAddress),
      escrowAddress,
      AztecAddress.fromString(tokenAddress),
      amount,
      recipient,
      node,
      paymentMethod,
    );

    display.success('Withdrawal successful!');

    // Show new balances
    const token = await registerToken(wallet, AztecAddress.fromString(tokenAddress), node);
    const escrowBalance = await getBalances(token, escrowAddress, accountAddress);
    const recipientBalance = await getBalances(token, recipient, accountAddress);

    display.newline();
    display.info('Escrow balance after withdrawal:');
    display.keyValue('Private', escrowBalance.privateBalance.toString());

    display.info('Recipient balance after withdrawal:');
    display.keyValue('Private', recipientBalance.privateBalance.toString());
  } catch (err: any) {
    display.error(`Withdrawal failed: ${err.message}`);
    if (err.message.includes('Not Authorized')) {
      display.warn('The withdrawal was rejected because the caller is not the Logic contract.');
      display.info("Ensure the Logic contract address matches the escrow's salt.");
    }
  }
}

/**
 * Show escrow info.
 */
async function infoCommand(options: { escrow?: string; showSecret?: boolean }): Promise<void> {
  display.header('Escrow Info');

  const escrows = getEscrows();

  if (escrows.length === 0) {
    display.emptyEscrowList();
    return;
  }

  if (options.escrow) {
    // Show specific escrow
    const escrowEntry = findEscrow(options.escrow);
    if (!escrowEntry) {
      display.error(`Escrow not found: ${options.escrow}`);
      return;
    }

    display.escrowInfo(escrowEntry);

    if (options.showSecret) {
      display.warn('Secret key (keep this safe!):');
      display.keyValue('Secret', escrowEntry.secretKey);
    }
  } else {
    // List all escrows
    display.escrowListHeader();
    escrows.forEach((escrow, index) => {
      display.escrowListItem(escrow, index);
    });
    display.newline();
    display.info(`Total: ${escrows.length} escrow(s)`);
    display.info("Use 'yarn escrow info --escrow <address>' for details");
  }
}

/**
 * Deploy a Token contract for testing.
 */
async function deployTokenCommand(
  getWallet: () => Promise<WalletContext>,
  options: { name?: string; symbol?: string },
): Promise<void> {
  display.header('Deploy Token Contract');

  const name = options.name || 'TestToken';
  const symbol = options.symbol || 'TST';

  display.info(`Deploying token: ${name} (${symbol})`);

  // Get wallet
  display.step('Connecting to wallet...');
  const { wallet, accountAddress } = await getWallet();
  const paymentMethod = await getSponsoredPaymentMethod(wallet);

  // Deploy token
  display.step('Deploying token contract...');
  const token = await deployToken(wallet, accountAddress, name, symbol, 18, paymentMethod);

  // Save to config
  setTokenAddress(token.address.toString());

  display.success('Token deployed successfully!');
  display.newline();
  display.keyValue('Token Address', token.address.toString());
  display.keyValue('Name', name);
  display.keyValue('Symbol', symbol);
  display.keyValue('Decimals', '18');
  display.keyValue('Minter', accountAddress.toString());
  display.newline();

  display.info('Token address saved to config.');
  display.info('You can now fund escrows with: yarn escrow fund --amount <n>');
}

/**
 * Deploy the Logic contract.
 *
 * The Logic contract is required before deploying escrows.
 * It authorizes withdrawals from escrows that use its address as salt.
 */
async function deployLogicCommand(getWallet: () => Promise<WalletContext>): Promise<void> {
  display.header('Deploy Logic Contract');

  console.log(`
[Educational Note]
  The Logic contract controls which escrows can be withdrawn from.
  When you deploy an escrow, you set its salt = Logic contract address.
  Only the Logic contract can then call withdraw() on that escrow.

  The Logic contract also validates that escrows are legitimate by
  checking their class ID matches the expected Escrow contract class.
`);

  // Step 1: Get escrow class ID
  display.stepStart(1, 3, 'Getting Escrow contract class ID...');
  const escrowClassId = await getEscrowClassId();
  display.stepValue('Escrow Class ID', escrowClassId.toString());

  // Step 2: Get wallet
  display.stepStart(2, 3, 'Connecting to wallet...');
  const { wallet, accountAddress } = await getWallet();
  const paymentMethod = await getSponsoredPaymentMethod(wallet);
  display.stepComplete('Wallet connected');

  // Step 3: Deploy Logic contract
  display.stepStart(3, 3, 'Deploying Logic contract...');

  const logicContract = await deployLogicContractWithSponsoredFees(
    wallet,
    accountAddress,
    escrowClassId,
    paymentMethod,
  );

  display.stepComplete(`Deployed at ${logicContract.address.toString()}`);

  // Save to config
  setLogicAddress(logicContract.address.toString());

  display.success('Logic contract deployed successfully!');
  display.newline();
  display.keyValue('Logic Contract Address', logicContract.address.toString());
  display.keyValue('Escrow Class ID', escrowClassId.toString());
  display.newline();

  display.info('Logic contract address saved to config.');
  display.info('You can now deploy escrows with: yarn escrow deploy');
}

/**
 * Register escrow commands with Commander.
 */
export function registerEscrowCommands(program: Command, getWallet: () => Promise<WalletContext>): void {
  program
    .command('deploy-logic')
    .description('Deploy the Logic contract (required before deploying escrows)')
    .action(async () => {
      await deployLogicCommand(getWallet);
    });

  program
    .command('deploy-token')
    .description('Deploy a Token contract for testing')
    .option('--name <name>', 'Token name', 'TestToken')
    .option('--symbol <symbol>', 'Token symbol', 'TST')
    .action(async (options) => {
      await deployTokenCommand(getWallet, options);
    });

  program
    .command('deploy')
    .description('Deploy a new escrow contract')
    .option('--label <label>', 'Label for the escrow')
    .option('--logic <address>', 'Logic contract address (overrides config)')
    .action(async (options) => {
      await deployCommand(getWallet, options);
    });

  program
    .command('fund')
    .description('Fund an escrow with tokens')
    .option('--token <address>', 'Token contract address (uses config default)')
    .requiredOption('--amount <amount>', 'Amount to fund')
    .option('--escrow <address>', 'Escrow address (defaults to latest)')
    .action(async (options) => {
      await fundCommand(getWallet, options);
    });

  program
    .command('balance')
    .description('Check escrow token balance')
    .option('--token <address>', 'Token contract address (uses config default)')
    .option('--escrow <address>', 'Escrow address (defaults to latest)')
    .action(async (options) => {
      await balanceCommand(getWallet, options);
    });

  program
    .command('withdraw')
    .description('Withdraw from escrow via Logic contract')
    .option('--token <address>', 'Token contract address (uses config default)')
    .requiredOption('--amount <amount>', 'Amount to withdraw')
    .option('--escrow <address>', 'Escrow address (defaults to latest)')
    .option('--recipient <address>', 'Recipient address (defaults to caller)')
    .action(async (options) => {
      await withdrawCommand(getWallet, options);
    });

  program
    .command('list')
    .description('List all deployed escrows')
    .option('--show-secret', 'Show secret keys (dangerous!)')
    .action(async (options) => {
      await infoCommand({ showSecret: options.showSecret });
    });
}
