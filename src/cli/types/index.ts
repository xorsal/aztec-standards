/**
 * TypeScript interfaces for the Escrow CLI
 */

import { Fr } from '@aztec/aztec.js/fields';
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { PublicKeys } from '@aztec/aztec.js/keys';
import type { GrumpkinScalar } from '@aztec/aztec.js/fields';

/**
 * Master secret keys for an escrow contract.
 * These are derived from a single secret key using deriveKeys().
 */
export interface MasterSecretKeys {
  nsk_m: Fr; // Master Nullifier Secret Key - used for spending notes
  ivsk_m: Fr; // Incoming Viewing Secret Key - used for decrypting incoming notes
  ovsk_m: Fr; // Outgoing Viewing Secret Key - used for viewing outgoing txs
  tsk_m: Fr; // Tagging Secret Key - used for note tagging
}

/**
 * Result of deriving escrow keys from a secret key.
 */
export interface DerivedEscrowKeys {
  publicKeys: PublicKeys;
  masterSecretKeys: MasterSecretKeys;
  masterNullifierSecretKey: GrumpkinScalar;
  masterIncomingViewingSecretKey: GrumpkinScalar;
  masterOutgoingViewingSecretKey: GrumpkinScalar;
  masterTaggingSecretKey: GrumpkinScalar;
}

/**
 * Configuration stored in .escrow.json
 */
export interface EscrowCLIConfig {
  network: 'sandbox' | 'devnet';
  nodeUrl: string;
  logicContractAddress?: string;
  tokenAddress?: string;
  escrows: EscrowEntry[];
}

/**
 * A single escrow entry stored in config.
 */
export interface EscrowEntry {
  address: string; // Escrow contract address
  secretKey: string; // Fr secret used to derive keys (hex string)
  logicAddress: string; // Logic contract address (must match salt)
  deployedAt: string; // ISO timestamp
  label?: string; // Optional user-friendly label
}

/**
 * Wallet context returned by getWallet()
 */
export interface WalletContext {
  wallet: any; // TestWallet
  node: any; // AztecNode
  accountAddress: AztecAddress;
  secretKey: Fr;
}

/**
 * Options for escrow deployment
 */
export interface DeployEscrowOptions {
  label?: string;
  logicAddress?: string;
}

/**
 * Options for funding escrow
 */
export interface FundEscrowOptions {
  escrow?: string;
  token: string;
  amount: string;
}

/**
 * Options for checking balance
 */
export interface BalanceOptions {
  escrow?: string;
  token: string;
}

/**
 * Options for withdrawing from escrow
 */
export interface WithdrawOptions {
  escrow?: string;
  token: string;
  amount: string;
  recipient?: string;
}

/**
 * Options for key commands
 */
export interface KeysOptions {
  escrow?: string;
  recipient?: string;
  secret?: string;
}
