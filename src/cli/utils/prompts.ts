/**
 * Prompt utilities for the Escrow CLI
 *
 * Uses @inquirer/prompts for interactive user input.
 */

import { input, password, select, confirm, number } from '@inquirer/prompts';
import type { EscrowEntry } from '../types/index.js';

// Address validation regex (0x + 64 hex chars)
const ADDRESS_REGEX = /^0x[a-fA-F0-9]{64}$/;

/**
 * Validate an Aztec address.
 */
function validateAddress(value: string): boolean | string {
  if (!value) {
    return 'Address is required';
  }
  if (!ADDRESS_REGEX.test(value)) {
    return 'Invalid address format. Expected 0x followed by 64 hex characters.';
  }
  return true;
}

/**
 * Validate a non-empty string.
 */
function validateNonEmpty(value: string): boolean | string {
  if (!value || value.trim().length === 0) {
    return 'Value is required';
  }
  return true;
}

/**
 * Prompt for wallet passphrase.
 */
export async function promptPassphrase(): Promise<string> {
  return await password({
    message: 'Enter your wallet passphrase:',
    validate: validateNonEmpty,
  });
}

/**
 * Prompt for Logic contract address.
 */
export async function promptLogicAddress(): Promise<string> {
  return await input({
    message: 'Enter the Logic contract address:',
    validate: validateAddress,
  });
}

/**
 * Prompt for token contract address.
 */
export async function promptTokenAddress(): Promise<string> {
  return await input({
    message: 'Enter the token contract address:',
    validate: validateAddress,
  });
}

/**
 * Prompt for escrow contract address.
 */
export async function promptEscrowAddress(): Promise<string> {
  return await input({
    message: 'Enter the escrow contract address:',
    validate: validateAddress,
  });
}

/**
 * Prompt for recipient address.
 */
export async function promptRecipientAddress(): Promise<string> {
  return await input({
    message: 'Enter the recipient address:',
    validate: validateAddress,
  });
}

/**
 * Prompt for amount.
 */
export async function promptAmount(): Promise<bigint> {
  const result = await number({
    message: 'Enter the amount:',
    min: 1,
    required: true,
  });
  return BigInt(result!);
}

/**
 * Prompt for escrow label.
 */
export async function promptEscrowLabel(): Promise<string> {
  return await input({
    message: 'Enter a label for this escrow (optional):',
  });
}

/**
 * Prompt to select from configured escrows.
 */
export async function promptSelectEscrow(escrows: EscrowEntry[]): Promise<EscrowEntry> {
  const choices = escrows.map((e, i) => ({
    name: `${e.label || 'Escrow ' + (i + 1)} (${e.address.slice(0, 10)}...)`,
    value: e,
    description: `Logic: ${e.logicAddress.slice(0, 10)}...`,
  }));

  return await select({
    message: 'Select an escrow:',
    choices,
  });
}

/**
 * Prompt for secret key (hex string).
 */
export async function promptSecretKey(): Promise<string> {
  return await input({
    message: 'Enter the escrow secret key (hex):',
    validate: (value) => {
      if (!value) {
        return 'Secret key is required';
      }
      // Allow with or without 0x prefix
      const hex = value.startsWith('0x') ? value.slice(2) : value;
      if (!/^[a-fA-F0-9]{64}$/.test(hex)) {
        return 'Invalid secret key format. Expected 64 hex characters.';
      }
      return true;
    },
  });
}

/**
 * Prompt for setup action.
 */
export async function promptSetupAction(): Promise<'logic' | 'token'> {
  return await select({
    message: 'What would you like to configure?',
    choices: [
      {
        name: 'Logic Contract',
        value: 'logic' as const,
        description: 'Set the Logic contract address for escrow authorization',
      },
      {
        name: 'Token Contract',
        value: 'token' as const,
        description: 'Set the default token contract address',
      },
    ],
  });
}

/**
 * Prompt for network selection.
 */
export async function promptNetwork(): Promise<'sandbox' | 'devnet'> {
  return await select({
    message: 'Select network:',
    choices: [
      {
        name: 'Sandbox',
        value: 'sandbox' as const,
        description: 'Local development sandbox (localhost:8080)',
      },
      {
        name: 'Devnet',
        value: 'devnet' as const,
        description: 'Aztec public devnet',
      },
    ],
  });
}

/**
 * Prompt for confirmation.
 */
export async function promptConfirm(message: string): Promise<boolean> {
  return await confirm({
    message,
    default: false,
  });
}

/**
 * Prompt for deploy options.
 */
export async function promptDeployOptions(): Promise<{
  label?: string;
  useExistingLogic: boolean;
}> {
  const label = await promptEscrowLabel();
  const useExistingLogic = await confirm({
    message: 'Use Logic contract from config?',
    default: true,
  });

  return {
    label: label || undefined,
    useExistingLogic,
  };
}
