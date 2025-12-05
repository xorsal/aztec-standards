/**
 * Display utilities for the Escrow CLI
 *
 * Provides colored console output and educational messages
 * to help users understand escrow operations.
 */

import chalk from 'chalk';
import type { EscrowEntry, MasterSecretKeys } from '../types/index.js';

// Basic output functions

export function success(message: string): void {
  console.log(chalk.green(`✓ ${message}`));
}

export function error(message: string): void {
  console.log(chalk.red(`✗ ${message}`));
}

export function warn(message: string): void {
  console.log(chalk.yellow(`⚠ ${message}`));
}

export function info(message: string): void {
  console.log(chalk.blue(`ℹ ${message}`));
}

export function step(message: string): void {
  console.log(chalk.cyan(`→ ${message}`));
}

export function header(title: string): void {
  console.log(chalk.cyan(`\n=== ${title} ===\n`));
}

export function keyValue(key: string, value: string | number | boolean): void {
  console.log(`  ${chalk.gray(key + ':')} ${value}`);
}

export function divider(): void {
  console.log(chalk.gray('─'.repeat(50)));
}

export function newline(): void {
  console.log();
}

// Educational messages explaining escrow concepts

export function explainEscrowDeployment(): void {
  console.log(chalk.cyan('\n[Educational Note]'));
  console.log('  The escrow contract is stateless - there is no storage.');
  console.log("  The 'owner' (Logic contract) is encoded in the deployment salt.");
  console.log('  Only the Logic contract at the salt address can call withdraw().\n');
}

export function explainKeyRegistration(): void {
  console.log(chalk.cyan('\n[Educational Note]'));
  console.log('  Registering escrow keys allows your wallet to decrypt private notes.');
  console.log("  Without this step, you cannot see the escrow's private balance.\n");
}

export function explainWithdraw(): void {
  console.log(chalk.cyan('\n[Educational Note]'));
  console.log('  Withdrawals must go through the Logic contract.');
  console.log('  The escrow checks that msg_sender == salt (Logic address).');
  console.log('  This ensures only authorized withdrawals succeed.\n');
}

export function explainKeySharing(): void {
  console.log(chalk.cyan('\n[Educational Note]'));
  console.log('  Escrow keys can be shared privately with participants.');
  console.log('  The Logic contract emits an encrypted log containing:');
  console.log('  - Escrow address');
  console.log('  - All 4 MasterSecretKeys');
  console.log('  Only the recipient can decrypt this information.\n');
}

export function explainMasterSecretKeys(): void {
  console.log(chalk.cyan('\n[Educational Note - Master Secret Keys]'));
  console.log('  nsk_m  - Nullifier Secret Key: Used for spending notes');
  console.log('  ivsk_m - Incoming Viewing Key: Decrypt incoming notes');
  console.log('  ovsk_m - Outgoing Viewing Key: View outgoing transactions');
  console.log('  tsk_m  - Tagging Secret Key: Used for note tagging\n');
}

// Escrow-specific displays

export function escrowInfo(escrow: EscrowEntry): void {
  console.log(chalk.cyan('\nEscrow Details:'));
  keyValue('Address', escrow.address);
  keyValue('Logic Contract', escrow.logicAddress);
  if (escrow.label) {
    keyValue('Label', escrow.label);
  }
  keyValue('Deployed', escrow.deployedAt);
  newline();
}

export function escrowBalance(
  escrowAddress: string,
  tokenAddress: string,
  publicBalance: bigint,
  privateBalance: bigint,
): void {
  console.log(chalk.cyan('\nEscrow Balance:'));
  keyValue('Escrow', formatAddress(escrowAddress));
  keyValue('Token', formatAddress(tokenAddress));
  keyValue('Public Balance', publicBalance.toString());
  keyValue('Private Balance', privateBalance.toString());
  newline();
}

export function masterSecretKeysInfo(keys: MasterSecretKeys): void {
  console.log(chalk.cyan('\nMaster Secret Keys:'));
  keyValue('nsk_m (Nullifier)', keys.nsk_m.toString());
  keyValue('ivsk_m (Incoming Viewing)', keys.ivsk_m.toString());
  keyValue('ovsk_m (Outgoing Viewing)', keys.ovsk_m.toString());
  keyValue('tsk_m (Tagging)', keys.tsk_m.toString());
  newline();
}

export function walletInfo(address: string, isNew: boolean): void {
  if (isNew) {
    success('Account deployed successfully!');
  } else {
    info('Using existing account');
  }
  keyValue('Address', address);
  newline();
}

export function contractInfo(address: string, isNew: boolean, label?: string): void {
  if (isNew) {
    success('Contract deployed successfully!');
  } else {
    info('Connected to existing contract');
  }
  keyValue('Address', address);
  if (label) {
    keyValue('Label', label);
  }
  newline();
}

export function configInfo(network: string, nodeUrl: string, logicAddress?: string, tokenAddress?: string): void {
  header('Current Configuration');
  keyValue('Network', network);
  keyValue('Node URL', nodeUrl);
  if (logicAddress) {
    keyValue('Logic Contract', logicAddress);
  } else {
    keyValue('Logic Contract', chalk.gray('(not set)'));
  }
  if (tokenAddress) {
    keyValue('Token', tokenAddress);
  }
  newline();
}

export function escrowListHeader(): void {
  console.log(chalk.cyan('\nDeployed Escrows:'));
}

export function escrowListItem(escrow: EscrowEntry, index: number): void {
  const label = escrow.label ? ` (${escrow.label})` : '';
  console.log(`  ${index + 1}. ${formatAddress(escrow.address)}${label}`);
  console.log(chalk.gray(`     Logic: ${formatAddress(escrow.logicAddress)}`));
}

export function emptyEscrowList(): void {
  console.log(chalk.gray('  No escrows deployed yet.'));
  console.log(chalk.gray("  Use 'yarn escrow deploy' to create one.\n"));
}

// Formatting helpers

export function formatAddress(address: string): string {
  if (address.length <= 16) {
    return address;
  }
  return `${address.slice(0, 10)}...${address.slice(-6)}`;
}

export function formatAmount(amount: bigint, decimals: number = 18): string {
  const str = amount.toString().padStart(decimals + 1, '0');
  const intPart = str.slice(0, -decimals) || '0';
  const decPart = str.slice(-decimals).replace(/0+$/, '');
  return decPart ? `${intPart}.${decPart}` : intPart;
}

// Step-by-step progress display

export function stepStart(stepNum: number, totalSteps: number, message: string): void {
  console.log(chalk.cyan(`\n[Step ${stepNum}/${totalSteps}] ${message}`));
}

export function stepComplete(message: string): void {
  console.log(chalk.green(`  ✓ ${message}`));
}

export function stepValue(key: string, value: string): void {
  console.log(`  ${chalk.gray(key + ':')} ${value}`);
}

// Transaction status

export function txPending(message: string = 'Sending transaction...'): void {
  console.log(chalk.yellow(`⏳ ${message}`));
}

export function txSuccess(txHash?: string): void {
  if (txHash) {
    success(`Transaction confirmed: ${formatAddress(txHash)}`);
  } else {
    success('Transaction confirmed!');
  }
}

export function txFailed(error: string): void {
  error(`Transaction failed: ${error}`);
}
