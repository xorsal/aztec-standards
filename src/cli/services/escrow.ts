/**
 * Escrow Service - Core escrow deployment and key management
 *
 * Handles escrow key derivation, deployment, and wallet registration.
 * Based on patterns from aztec-standards/src/ts/test/escrow.test.ts
 */

import { Fr, type GrumpkinScalar } from '@aztec/aztec.js/fields';
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { PublicKeys } from '@aztec/aztec.js/keys';
import { Contract, type ContractInstance } from '@aztec/aztec.js/contracts';
import { deriveKeys } from '@aztec/stdlib/keys';
import { TestWallet } from '@aztec/test-wallet/server';

import { EscrowContractArtifact, EscrowContract } from '../../../artifacts/Escrow.js';
import { TestLogicContractArtifact, TestLogicContract } from '../../../artifacts/TestLogic.js';
import type { MasterSecretKeys, DerivedEscrowKeys, EscrowEntry } from '../types/index.js';
import { getEscrows } from './config.js';

/**
 * Convert a GrumpkinScalar to an Fr.
 */
export function grumpkinScalarToFr(scalar: GrumpkinScalar): Fr {
  return new Fr(scalar.toBigInt());
}

/**
 * Generate a random secret key for a new escrow.
 */
export function generateEscrowSecretKey(): Fr {
  return Fr.random();
}

/**
 * Derive all escrow keys from a single secret key.
 *
 * Uses deriveKeys from stdlib which handles Grumpkin curve operations.
 * Returns both the public keys (for deployment) and master secret keys (for display/sharing).
 */
export async function deriveEscrowKeys(secretKey: Fr): Promise<DerivedEscrowKeys> {
  const keys = await deriveKeys(secretKey);

  return {
    publicKeys: keys.publicKeys,
    masterSecretKeys: {
      nsk_m: grumpkinScalarToFr(keys.masterNullifierSecretKey),
      ivsk_m: grumpkinScalarToFr(keys.masterIncomingViewingSecretKey),
      ovsk_m: grumpkinScalarToFr(keys.masterOutgoingViewingSecretKey),
      tsk_m: grumpkinScalarToFr(keys.masterTaggingSecretKey),
    },
    masterNullifierSecretKey: keys.masterNullifierSecretKey,
    masterIncomingViewingSecretKey: keys.masterIncomingViewingSecretKey,
    masterOutgoingViewingSecretKey: keys.masterOutgoingViewingSecretKey,
    masterTaggingSecretKey: keys.masterTaggingSecretKey,
  };
}

/**
 * Deploy an escrow contract with the given keys.
 *
 * The salt MUST be the Logic contract address - this is how the escrow
 * enforces that only the Logic contract can call withdraw().
 *
 * @param publicKeys - Public keys derived from the escrow secret key
 * @param wallet - Wallet to deploy with
 * @param deployer - Address to deploy from
 * @param logicContractAddress - Logic contract address (used as salt)
 * @returns Deployed escrow contract instance
 */
export async function deployEscrow(
  publicKeys: PublicKeys,
  wallet: TestWallet,
  deployer: AztecAddress,
  logicContractAddress: AztecAddress,
): Promise<EscrowContract> {
  // Salt = Logic contract address (this is enforced by the escrow contract)
  const salt = new Fr(logicContractAddress.toBigInt());

  const contract = await Contract.deployWithPublicKeys(
    publicKeys,
    wallet,
    EscrowContractArtifact,
    [], // No constructor args
    undefined, // No constructor name
  )
    .send({
      contractAddressSalt: salt,
      universalDeploy: true,
      from: deployer,
    })
    .deployed();

  return contract as EscrowContract;
}

/**
 * Deploy an escrow contract with sponsored fees.
 *
 * Same as deployEscrow but uses sponsored fee payment.
 */
export async function deployEscrowWithSponsoredFees(
  publicKeys: PublicKeys,
  wallet: TestWallet,
  deployer: AztecAddress,
  logicContractAddress: AztecAddress,
  paymentMethod: any, // SponsoredFeePaymentMethod
): Promise<EscrowContract> {
  const salt = new Fr(logicContractAddress.toBigInt());

  const contract = await Contract.deployWithPublicKeys(publicKeys, wallet, EscrowContractArtifact, [], undefined)
    .send({
      contractAddressSalt: salt,
      universalDeploy: true,
      from: deployer,
      fee: { paymentMethod },
    })
    .deployed();

  return contract as EscrowContract;
}

/**
 * Register escrow keys with the wallet for note decryption.
 *
 * This is required for the wallet to see the escrow's private balance.
 * Without registration, balance_of_private() will return 0.
 *
 * @param wallet - TestWallet instance
 * @param escrowInstance - Contract instance of the escrow
 * @param secretKey - The secret key used to derive escrow keys
 */
export async function registerEscrowWithWallet(
  wallet: TestWallet,
  escrowInstance: ContractInstance,
  secretKey: Fr,
): Promise<void> {
  await wallet.registerContract(escrowInstance, EscrowContractArtifact, secretKey);
}

/**
 * Connect to an existing escrow contract.
 *
 * @param wallet - Wallet to connect with
 * @param escrowAddress - Address of the escrow contract
 * @returns Escrow contract instance
 */
export async function connectToEscrow(wallet: TestWallet, escrowAddress: AztecAddress): Promise<EscrowContract> {
  return EscrowContract.at(escrowAddress, wallet);
}

/**
 * Register an existing escrow with wallet (for viewing balance).
 *
 * Use this when you have received escrow keys from someone else.
 *
 * @param wallet - TestWallet instance
 * @param escrowAddress - Address of the escrow contract
 * @param secretKey - The secret key for the escrow
 * @param node - Aztec node to get contract instance
 */
export async function registerExternalEscrow(
  wallet: TestWallet,
  escrowAddress: AztecAddress,
  secretKey: Fr,
  node: any, // AztecNode
): Promise<void> {
  // Get the contract instance from the node
  const instance = await node.getContract(escrowAddress);
  if (!instance) {
    throw new Error(`Escrow contract not found at ${escrowAddress.toString()}`);
  }

  // Register with wallet
  await wallet.registerContract(
    {
      instance,
      artifact: EscrowContractArtifact,
    },
    secretKey,
  );
}

/**
 * Predict the escrow address before deployment.
 *
 * Useful for showing users what address will be created.
 * Note: This requires computing the contract address from instance params.
 */
export async function predictEscrowAddress(
  publicKeys: PublicKeys,
  logicContractAddress: AztecAddress,
): Promise<AztecAddress> {
  // Import required functions for address computation
  const { computeContractAddressFromInstance, computeSaltedInitializationHash } = await import(
    '@aztec/stdlib/contract'
  );
  const { getContractClassFromArtifact } = await import('@aztec/aztec.js/contracts');

  const salt = new Fr(logicContractAddress.toBigInt());
  const contractClass = await getContractClassFromArtifact(EscrowContractArtifact);

  // Escrow has no constructor, so initialization hash is null
  const initializationHash = Fr.ZERO;
  const saltedInitializationHash = await computeSaltedInitializationHash({
    initializationHash,
    salt,
    deployer: AztecAddress.ZERO, // Universal deploy
  });

  const address = await computeContractAddressFromInstance({
    originalContractClassId: contractClass.id,
    saltedInitializationHash,
    publicKeys,
  });

  return address;
}

/**
 * Get the escrow class ID.
 *
 * This is needed when deploying a Logic contract that validates escrow class.
 */
export async function getEscrowClassId(): Promise<Fr> {
  const { getContractClassFromArtifact } = await import('@aztec/aztec.js/contracts');
  const contractClass = await getContractClassFromArtifact(EscrowContractArtifact);
  return contractClass.id;
}

/**
 * Verify that an escrow is properly configured.
 *
 * Checks that the salt matches the expected Logic contract address.
 */
export function verifyEscrowSalt(escrowInstance: ContractInstance, expectedLogicAddress: AztecAddress): boolean {
  const saltAsAddress = AztecAddress.fromField(escrowInstance.salt);
  return saltAsAddress.equals(expectedLogicAddress);
}

/**
 * Deploy the TestLogic contract.
 *
 * The Logic contract is what authorizes withdrawals from escrows.
 * It takes the escrow class ID as a constructor argument to validate
 * that it's interacting with legitimate escrow contracts.
 *
 * @param wallet - Wallet to deploy with
 * @param deployer - Address to deploy from
 * @param escrowClassId - The class ID of the Escrow contract
 * @returns Deployed TestLogic contract instance
 */
export async function deployLogicContract(
  wallet: TestWallet,
  deployer: AztecAddress,
  escrowClassId: Fr,
): Promise<TestLogicContract> {
  const contract = await Contract.deploy(wallet, TestLogicContractArtifact, [escrowClassId], 'constructor')
    .send({ from: deployer })
    .deployed();

  return contract as TestLogicContract;
}

/**
 * Deploy the TestLogic contract with sponsored fees.
 */
export async function deployLogicContractWithSponsoredFees(
  wallet: TestWallet,
  deployer: AztecAddress,
  escrowClassId: Fr,
  paymentMethod: any,
): Promise<TestLogicContract> {
  const contract = await Contract.deploy(wallet, TestLogicContractArtifact, [escrowClassId], 'constructor')
    .send({
      from: deployer,
      fee: { paymentMethod },
    })
    .deployed();

  return contract as TestLogicContract;
}

/**
 * Connect to an existing Logic contract.
 */
export async function connectToLogicContract(
  wallet: TestWallet,
  logicAddress: AztecAddress,
): Promise<TestLogicContract> {
  return TestLogicContract.at(logicAddress, wallet);
}

/**
 * Register all escrows from config with the wallet.
 *
 * This should be called during wallet initialization to ensure
 * all known escrow notes can be decrypted. Without this, the PXE
 * has the encrypted notes but can't decrypt them.
 *
 * @param wallet - TestWallet instance
 * @param node - AztecNode to fetch contract instances
 * @param onProgress - Optional callback for progress updates
 * @returns Number of escrows successfully registered
 */
export async function registerAllEscrows(
  wallet: TestWallet,
  node: any,
  onProgress?: (message: string) => void,
): Promise<{ registered: number; failed: number; errors: string[] }> {
  const escrows = getEscrows();
  let registered = 0;
  let failed = 0;
  const errors: string[] = [];

  if (escrows.length === 0) {
    return { registered: 0, failed: 0, errors: [] };
  }

  onProgress?.(`Registering ${escrows.length} escrow(s) for note decryption...`);

  for (const escrowEntry of escrows) {
    try {
      const escrowAddress = AztecAddress.fromString(escrowEntry.address);
      const secretKey = Fr.fromString(escrowEntry.secretKey);

      // Get the contract instance from the node
      const instance = await node.getContract(escrowAddress);

      if (!instance) {
        errors.push(`Escrow ${escrowEntry.address} not found on-chain`);
        failed++;
        continue;
      }

      // Register with wallet for note decryption
      await wallet.registerContract(
        {
          instance,
          artifact: EscrowContractArtifact,
        },
        secretKey,
      );

      registered++;
      onProgress?.(`  ✓ Registered ${escrowEntry.label || escrowEntry.address.slice(0, 10)}...`);
    } catch (err: any) {
      errors.push(`${escrowEntry.address}: ${err.message}`);
      failed++;
    }
  }

  return { registered, failed, errors };
}

/**
 * Sync notes for all registered escrows.
 *
 * This triggers the PXE to scan for new notes for all registered contracts.
 * Useful after registering escrows or when notes seem out of sync.
 *
 * @param wallet - TestWallet instance
 */
export async function syncEscrowNotes(wallet: TestWallet): Promise<void> {
  // The TestWallet's internal PXE should auto-sync, but we can trigger
  // a manual sync by accessing the sync functionality if available
  // For now, the registration itself triggers a sync
  // If TestWallet exposes a sync method in the future, call it here
  // await wallet.syncNotes();
}
