/**
 * Key Management Commands
 *
 * Commands: share-keys, register-keys, show-keys
 */

import type { Command } from 'commander';
import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';

import type { WalletContext, KeysOptions } from '../types/index.js';
import { deriveEscrowKeys, registerExternalEscrow } from '../services/escrow.js';
import { findEscrow, getLatestEscrow, addEscrow } from '../services/config.js';
import * as display from '../utils/display.js';
import * as prompts from '../utils/prompts.js';

/**
 * Show escrow master secret keys.
 */
async function showKeysCommand(options: KeysOptions): Promise<void> {
  display.header('Escrow Keys');

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

  display.info(`Keys for escrow: ${display.formatAddress(escrowEntry.address)}`);

  // Derive keys from secret
  const secretKey = Fr.fromString(escrowEntry.secretKey);
  const { masterSecretKeys } = await deriveEscrowKeys(secretKey);

  display.explainMasterSecretKeys();
  display.masterSecretKeysInfo(masterSecretKeys);

  display.warn('Keep these keys secure! Anyone with these keys can:');
  display.info('  - View all private notes owned by the escrow');
  display.info('  - Spend notes if they control the Logic contract');
}

/**
 * Register external escrow keys (received from someone else).
 */
async function registerKeysCommand(getWallet: () => Promise<WalletContext>, options: KeysOptions): Promise<void> {
  display.header('Register External Escrow Keys');

  display.info("Use this command when you've received escrow keys from someone else.");
  display.info("This allows your wallet to view the escrow's private balance.\n");

  // Get escrow address
  let escrowAddress = options.escrow;
  if (!escrowAddress) {
    escrowAddress = await prompts.promptEscrowAddress();
  }

  // Get secret key
  let secretKeyStr = options.secret;
  if (!secretKeyStr) {
    secretKeyStr = await prompts.promptSecretKey();
  }

  // Parse secret key (handle with or without 0x prefix)
  const secretKey = secretKeyStr.startsWith('0x') ? Fr.fromString(secretKeyStr) : Fr.fromString('0x' + secretKeyStr);

  // Get wallet
  const { wallet, node } = await getWallet();

  display.step('Registering escrow with wallet...');

  try {
    await registerExternalEscrow(wallet, AztecAddress.fromString(escrowAddress), secretKey, node);

    display.success('Escrow keys registered successfully!');
    display.info("You can now view the escrow's private balance.");

    // Ask if user wants to save to config
    const shouldSave = await prompts.promptConfirm('Save escrow to config?');
    if (shouldSave) {
      const label = await prompts.promptEscrowLabel();
      const logicAddress = await prompts.promptLogicAddress();

      addEscrow({
        address: escrowAddress,
        secretKey: secretKey.toString(),
        logicAddress,
        deployedAt: new Date().toISOString(),
        label: label || undefined,
      });

      display.success('Escrow saved to config.');
    }
  } catch (err: any) {
    display.error(`Failed to register escrow: ${err.message}`);
  }
}

/**
 * Share escrow keys with another participant.
 *
 * Note: This is a placeholder. In production, key sharing would go through
 * the Logic contract's _share_escrow() function which emits an encrypted log.
 */
async function shareKeysCommand(options: KeysOptions): Promise<void> {
  display.header('Share Escrow Keys');

  display.explainKeySharing();

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

  // Get recipient
  let recipient = options.recipient;
  if (!recipient) {
    recipient = await prompts.promptRecipientAddress();
  }

  display.info('Sharing keys for escrow:');
  display.keyValue('Escrow', escrowEntry.address);
  display.keyValue('Recipient', recipient);
  display.newline();

  display.warn("In production, this would call the Logic contract's share_escrow() function.");
  display.info('For now, here are the keys to share manually:\n');

  // Show keys
  const secretKey = Fr.fromString(escrowEntry.secretKey);
  const { masterSecretKeys } = await deriveEscrowKeys(secretKey);

  display.keyValue('Escrow Address', escrowEntry.address);
  display.keyValue('Secret Key', escrowEntry.secretKey);
  display.newline();

  display.info('Share these values securely with the recipient.');
  display.info("They can use 'yarn escrow register-keys' to register them.");
}

/**
 * Export escrow keys in a shareable format.
 */
async function exportKeysCommand(options: KeysOptions): Promise<void> {
  display.header('Export Escrow Keys');

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

  display.warn('The following data contains sensitive information.');
  display.warn('Only share with trusted parties!\n');

  // Output in JSON format for easy copying
  const exportData = {
    escrowAddress: escrowEntry.address,
    secretKey: escrowEntry.secretKey,
    logicAddress: escrowEntry.logicAddress,
    label: escrowEntry.label,
  };

  console.log(JSON.stringify(exportData, null, 2));

  display.newline();
  display.info('Copy the JSON above to share with the recipient.');
}

/**
 * Register key management commands with Commander.
 */
export function registerKeyCommands(program: Command, getWallet: () => Promise<WalletContext>): void {
  program
    .command('show-keys')
    .description('Display escrow master secret keys')
    .option('--escrow <address>', 'Escrow address (defaults to latest)')
    .action(async (options) => {
      await showKeysCommand(options);
    });

  program
    .command('register-keys')
    .description('Register external escrow keys (received from someone)')
    .option('--escrow <address>', 'Escrow contract address')
    .option('--secret <key>', 'Secret key (hex)')
    .action(async (options) => {
      await registerKeysCommand(getWallet, options);
    });

  program
    .command('share-keys')
    .description('Share escrow keys with another participant')
    .option('--escrow <address>', 'Escrow address (defaults to latest)')
    .option('--recipient <address>', 'Recipient address')
    .action(async (options) => {
      await shareKeysCommand(options);
    });

  program
    .command('export-keys')
    .description('Export escrow keys in JSON format')
    .option('--escrow <address>', 'Escrow address (defaults to latest)')
    .action(async (options) => {
      await exportKeysCommand(options);
    });
}
