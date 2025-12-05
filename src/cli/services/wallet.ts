/**
 * Wallet Service - Creates deterministic accounts from passphrases
 *
 * Uses Poseidon hash to convert passphrase to a secret key,
 * then creates a Schnorr account that can be used to interact with contracts.
 */

import { Fr } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { getContractInstanceFromInstantiationParams } from '@aztec/aztec.js/contracts';
import { poseidon2Hash } from '@aztec/foundation/crypto';
import { TestWallet } from '@aztec/test-wallet/server';
import type { AccountManager } from '@aztec/aztec.js/wallet';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee';
import { SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';

/**
 * Get the SponsoredFPC contract instance.
 * This uses the canonical salt to derive the same address as devnet.
 */
async function getSponsoredFPCInstance() {
  return await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, {
    salt: new Fr(SPONSORED_FPC_SALT),
  });
}

/**
 * Register the SponsoredFPC contract with the wallet.
 * This must be done before using sponsored fee payments.
 */
export async function registerSponsoredFPC(testWallet: TestWallet): Promise<AztecAddress> {
  const instance = await getSponsoredFPCInstance();

  // Check if already registered
  try {
    const metadata = await testWallet.getContractMetadata(instance.address);
    if (metadata?.isContractInitialized) {
      return instance.address;
    }
  } catch {
    // Not registered yet
  }

  // Register the contract
  await testWallet.registerContract({
    instance,
    artifact: SponsoredFPCContractArtifact,
  });

  return instance.address;
}

/**
 * Get a sponsored fee payment method.
 * Call this once per session after registering the FPC.
 */
export async function getSponsoredPaymentMethod(testWallet: TestWallet): Promise<SponsoredFeePaymentMethod> {
  const fpcAddress = await registerSponsoredFPC(testWallet);
  return new SponsoredFeePaymentMethod(fpcAddress);
}

// Fixed salt for deterministic addresses
const ACCOUNT_SALT = Fr.ONE;

/**
 * Convert a passphrase string to an Fr secret key.
 * Pads the passphrase to 32 bytes for consistent key derivation.
 */
export function passphraseToSecretKey(passphrase: string): Fr {
  // Pad passphrase to 32 characters
  const paddedPassphrase = passphrase.padEnd(32, '#');
  const bytes = Buffer.from(paddedPassphrase, 'utf-8');

  // Use fromBufferReduce to safely convert to Fr
  return Fr.fromBufferReduce(bytes);
}

/**
 * Hash the secret key using Poseidon2 for additional security.
 * This ensures the final key is well-distributed even for weak passphrases.
 */
export async function hashSecretKey(secretKey: Fr): Promise<Fr> {
  return await poseidon2Hash([secretKey]);
}

/**
 * Create a deterministic account from a passphrase using TestWallet.
 * The same passphrase will always produce the same account address.
 */
export async function createAccountFromPassphrase(
  testWallet: TestWallet,
  passphrase: string,
): Promise<{
  account: AccountManager;
  secretKey: Fr;
}> {
  // Convert passphrase to secret key
  const rawKey = passphraseToSecretKey(passphrase);

  // Hash it with Poseidon for better key distribution
  const secretKey = await hashSecretKey(rawKey);

  // Create Schnorr account using TestWallet (derives signing key internally)
  const account = await testWallet.createSchnorrAccount(secretKey, ACCOUNT_SALT);

  return { account, secretKey };
}

/**
 * Get or deploy a wallet from a passphrase.
 * If the account doesn't exist on-chain, it will be deployed.
 *
 * Returns the TestWallet (which implements Wallet) and the account address.
 * Use the account address in the `from` field when sending transactions.
 */
export async function getOrDeployWallet(
  testWallet: TestWallet,
  passphrase: string,
  deploy: boolean = true,
): Promise<{
  wallet: TestWallet;
  accountAddress: AztecAddress;
  secretKey: Fr;
  isNewDeployment: boolean;
}> {
  const { account, secretKey } = await createAccountFromPassphrase(testWallet, passphrase);
  const accountAddress = account.address;

  // Register the SponsoredFPC contract for fee payments
  const fpcAddress = await registerSponsoredFPC(testWallet);

  // Check if the account is already deployed
  const metadata = await testWallet.getContractMetadata(accountAddress);

  if (metadata?.isContractInitialized) {
    // Account already deployed
    return { wallet: testWallet, accountAddress, secretKey, isNewDeployment: false };
  }

  if (!deploy) {
    throw new Error(`Account ${accountAddress.toString()} is not deployed. Use --deploy to deploy it.`);
  }

  // Deploy the account with sponsored fee payment
  const paymentMethod = new SponsoredFeePaymentMethod(fpcAddress);
  const deployMethod = await account.getDeployMethod();
  await deployMethod
    .send({
      from: AztecAddress.ZERO,
      fee: { paymentMethod },
    })
    .wait();

  return { wallet: testWallet, accountAddress, secretKey, isNewDeployment: true };
}
