#!/usr/bin/env node
/**
 * Aztec Escrow CLI - Educational demo for stateless escrow contracts
 *
 * This CLI demonstrates how escrow contracts work on Aztec:
 * - Stateless design (owner encoded in salt)
 * - Key management with MasterSecretKeys
 * - Private balance viewing via wallet registration
 * - Authorization via Logic contract
 */

import { Command } from 'commander';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { createAztecNodeClient, waitForNode } from '@aztec/aztec.js/node';
import type { AztecNode } from '@aztec/aztec.js/node';
import { TestWallet } from '@aztec/test-wallet/server';

import type { WalletContext } from './types/index.js';
import {
  loadConfig,
  initializeConfig,
  setNetwork,
  setLogicAddress,
  setTokenAddress,
  getNodeUrl,
  getNetwork,
  getLogicAddress,
  getTokenAddress,
  getEscrows,
  NETWORK_URLS,
} from './services/config.js';
import { getOrDeployWallet, getSponsoredPaymentMethod } from './services/wallet.js';
import { registerEscrowCommands } from './commands/escrow.js';
import { registerKeyCommands } from './commands/keys.js';
import { registerAllEscrows } from './services/escrow.js';
import * as display from './utils/display.js';
import * as prompts from './utils/prompts.js';

const VERSION = '1.0.0';

// PXE data directories for persistent note storage
const PXE_DATA_DIRECTORIES: Record<string, string> = {
  sandbox: 'pxe-data-sandbox',
  devnet: 'pxe-data-devnet',
};

// Global state
let testWallet: TestWallet | null = null;
let aztecNode: AztecNode | null = null;
let cachedAccountAddress: AztecAddress | null = null;
let cachedSecretKey: Fr | null = null;
let globalPassphrase: string | null = null;
let escrowsRegistered: boolean = false;

/**
 * Initialize the TestWallet and Aztec node connection.
 */
async function initTestWallet(): Promise<{ wallet: TestWallet; node: AztecNode }> {
  const nodeUrl = getNodeUrl();
  const network = getNetwork();

  display.step(`Connecting to ${network} (${nodeUrl})...`);

  // Create node client
  const node = createAztecNodeClient(nodeUrl);

  // Wait for node to be ready
  try {
    await waitForNode(node);
    display.stepComplete('Connected to Aztec node');
  } catch (err) {
    display.error('Failed to connect to Aztec node');
    display.info('Make sure the Aztec sandbox is running:');
    display.info('  aztec start --sandbox');
    process.exit(1);
  }

  // Create TestWallet with persistent PXE data directory
  const pxeDataDirectory = PXE_DATA_DIRECTORIES[network];
  const wallet = await TestWallet.create(
    node,
    {
      dataDirectory: pxeDataDirectory,
      proverEnabled: false,
    },
    {},
  );

  return { wallet, node };
}

/**
 * Get wallet from passphrase (with caching).
 */
async function getWallet(): Promise<WalletContext> {
  // Get passphrase
  let passphrase = globalPassphrase;
  if (!passphrase) {
    passphrase = await prompts.promptPassphrase();
  }

  // Initialize wallet if not cached
  if (!testWallet || !aztecNode) {
    const { wallet, node } = await initTestWallet();
    testWallet = wallet;
    aztecNode = node;
  }

  // Check if we already have this account cached
  if (cachedAccountAddress && cachedSecretKey && globalPassphrase === passphrase) {
    return {
      wallet: testWallet,
      node: aztecNode,
      accountAddress: cachedAccountAddress,
      secretKey: cachedSecretKey,
    };
  }

  // Get or deploy wallet
  display.step('Getting wallet...');
  const { wallet, accountAddress, secretKey, isNewDeployment } = await getOrDeployWallet(testWallet, passphrase, true);

  display.walletInfo(accountAddress.toString(), isNewDeployment);

  // Auto-register all escrows from config for note decryption (once per session)
  if (!escrowsRegistered) {
    const { registered, failed, errors } = await registerAllEscrows(testWallet, aztecNode, (msg) => display.info(msg));

    if (registered > 0) {
      display.stepComplete(`Registered ${registered} escrow(s) for note decryption`);
    }
    if (failed > 0) {
      display.warn(`Failed to register ${failed} escrow(s)`);
      errors.forEach((err) => display.info(`  - ${err}`));
    }

    escrowsRegistered = true;
  }

  // Cache for future use
  cachedAccountAddress = accountAddress;
  cachedSecretKey = secretKey;
  globalPassphrase = passphrase;

  return {
    wallet: testWallet,
    node: aztecNode,
    accountAddress,
    secretKey,
  };
}

/**
 * Setup command - configure Logic contract and token addresses.
 */
async function setupCommand(options: { logic?: string; token?: string }): Promise<void> {
  display.header('Setup');

  if (options.logic) {
    setLogicAddress(options.logic);
    display.success('Logic contract address saved');
    display.keyValue('Logic', options.logic);
  }

  if (options.token) {
    setTokenAddress(options.token);
    display.success('Token address saved');
    display.keyValue('Token', options.token);
  }

  if (!options.logic && !options.token) {
    const action = await prompts.promptSetupAction();

    if (action === 'logic') {
      const address = await prompts.promptLogicAddress();
      setLogicAddress(address);
      display.success('Logic contract address saved');
    } else {
      const address = await prompts.promptTokenAddress();
      setTokenAddress(address);
      display.success('Token address saved');
    }
  }

  display.newline();
  display.info("Run 'yarn escrow info' to see current configuration");
}

/**
 * Info command - show current configuration.
 */
async function infoCommand(): Promise<void> {
  const config = loadConfig();
  const escrows = getEscrows();

  display.configInfo(config.network, config.nodeUrl, config.logicContractAddress, config.tokenAddress);

  if (escrows.length === 0) {
    display.emptyEscrowList();
  } else {
    display.escrowListHeader();
    escrows.forEach((escrow, index) => {
      display.escrowListItem(escrow, index);
    });
    display.newline();
  }
}

// Create the main program
const program = new Command();

program
  .name('escrow')
  .description('Aztec Escrow CLI - Educational demo for stateless escrow contracts')
  .version(VERSION)
  .option('--sandbox', 'Connect to local sandbox (localhost:8080)')
  .option('--devnet', 'Connect to Aztec devnet')
  .option('-p, --passphrase <passphrase>', 'Passphrase for wallet (non-interactive)')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts();

    // Set network from flags
    if (opts.sandbox) {
      setNetwork('sandbox');
    } else if (opts.devnet) {
      setNetwork('devnet');
    } else {
      // Use config default
      initializeConfig();
    }

    // Set passphrase if provided
    if (opts.passphrase) {
      globalPassphrase = opts.passphrase;
    }
  });

// Setup command
program
  .command('setup')
  .description('Configure Logic contract and token addresses')
  .option('--logic <address>', 'Logic contract address')
  .option('--token <address>', 'Token contract address')
  .action(async (options) => {
    await setupCommand(options);
  });

// Info command
program
  .command('info')
  .description('Show current configuration and list escrows')
  .action(async () => {
    await infoCommand();
  });

// Sync command - manually re-register all escrows and sync notes
program
  .command('sync')
  .description('Re-register all escrows and sync notes from the network')
  .action(async () => {
    display.header('Sync Notes');

    // Force re-registration by resetting the flag
    escrowsRegistered = false;

    display.step('Connecting to network and syncing...');
    await getWallet();

    display.success('Note sync complete!');
    display.info('All escrow keys have been re-registered for note decryption.');
  });

// Register command groups
registerEscrowCommands(program, getWallet);
registerKeyCommands(program, getWallet);

// Help text with examples
program.addHelpText(
  'after',
  `

Examples:
  $ yarn escrow setup --logic 0x...      Configure Logic contract
  $ yarn escrow deploy --label "My Escrow"  Deploy new escrow
  $ yarn escrow fund --token 0x... --amount 1000  Fund escrow
  $ yarn escrow balance --token 0x...    Check balance
  $ yarn escrow withdraw --token 0x... --amount 500  Withdraw
  $ yarn escrow show-keys               Display secret keys

For more information, see the README.md
`,
);

// Parse and run
program.parse();
