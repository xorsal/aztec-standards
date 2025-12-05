/**
 * Contract Service - Token and Logic contract interactions
 *
 * Handles token registration, balance checking, and Logic contract operations.
 */

import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Contract } from '@aztec/aztec.js/contracts';
import { TestWallet } from '@aztec/test-wallet/server';
import type { AztecNode } from '@aztec/aztec.js/node';

import { TokenContract, TokenContractArtifact } from '../../../artifacts/Token.js';
import { EscrowContract, EscrowContractArtifact } from '../../../artifacts/Escrow.js';
import { TestLogicContract, TestLogicContractArtifact } from '../../../artifacts/TestLogic.js';

/**
 * Deploy a new Token contract with the deployer as minter.
 */
export async function deployToken(
  wallet: TestWallet,
  deployer: AztecAddress,
  name: string = 'TestToken',
  symbol: string = 'TST',
  decimals: number = 18,
  paymentMethod?: any,
): Promise<TokenContract> {
  const sendOpts: any = { from: deployer };
  if (paymentMethod) {
    sendOpts.fee = { paymentMethod };
  }

  const contract = await Contract.deploy(
    wallet,
    TokenContractArtifact,
    [name, symbol, decimals, deployer, AztecAddress.ZERO],
    'constructor_with_minter',
  )
    .send(sendOpts)
    .deployed();

  return contract as TokenContract;
}

/**
 * Register a token contract with the wallet.
 */
export async function registerToken(
  wallet: TestWallet,
  tokenAddress: AztecAddress,
  node: AztecNode,
): Promise<TokenContract> {
  // Get contract instance from node
  const instance = await node.getContract(tokenAddress);
  if (!instance) {
    throw new Error(`Token contract not found at ${tokenAddress.toString()}`);
  }

  // Register with wallet
  await wallet.registerContract({
    instance,
    artifact: TokenContractArtifact,
  });

  return TokenContract.at(tokenAddress, wallet);
}

/**
 * Connect to an existing token contract.
 */
export async function connectToToken(wallet: TestWallet, tokenAddress: AztecAddress): Promise<TokenContract> {
  return TokenContract.at(tokenAddress, wallet);
}

/**
 * Get private balance of an address.
 */
export async function getPrivateBalance(
  token: TokenContract,
  owner: AztecAddress,
  caller: AztecAddress,
): Promise<bigint> {
  return await token.methods.balance_of_private(owner).simulate({ from: caller });
}

/**
 * Get public balance of an address.
 */
export async function getPublicBalance(
  token: TokenContract,
  owner: AztecAddress,
  caller: AztecAddress,
): Promise<bigint> {
  return await token.methods.balance_of_public(owner).simulate({ from: caller });
}

/**
 * Get both public and private balances.
 */
export async function getBalances(
  token: TokenContract,
  owner: AztecAddress,
  caller: AztecAddress,
): Promise<{ publicBalance: bigint; privateBalance: bigint }> {
  const [publicBalance, privateBalance] = await Promise.all([
    getPublicBalance(token, owner, caller),
    getPrivateBalance(token, owner, caller),
  ]);
  return { publicBalance, privateBalance };
}

/**
 * Mint private tokens to an address.
 *
 * Requires caller to be the token minter.
 */
export async function mintPrivateTokens(
  token: TokenContract,
  wallet: TestWallet,
  minter: AztecAddress,
  recipient: AztecAddress,
  amount: bigint,
  paymentMethod?: any,
): Promise<void> {
  const sendOpts: any = { from: minter };
  if (paymentMethod) {
    sendOpts.fee = { paymentMethod };
  }

  await token.withWallet(wallet).methods.mint_to_private(recipient, amount).send(sendOpts).wait();
}

/**
 * Transfer private tokens from one address to another.
 *
 * Requires authwit for the transfer.
 */
export async function transferPrivateTokens(
  token: TokenContract,
  wallet: TestWallet,
  from: AztecAddress,
  to: AztecAddress,
  amount: bigint,
  paymentMethod?: any,
): Promise<void> {
  const sendOpts: any = { from };
  if (paymentMethod) {
    sendOpts.fee = { paymentMethod };
  }

  await token.withWallet(wallet).methods.transfer_private(to, amount).send(sendOpts).wait();
}

/**
 * Register an escrow contract with the wallet.
 */
export async function registerEscrow(
  wallet: TestWallet,
  escrowAddress: AztecAddress,
  node: AztecNode,
  secretKey?: any, // Fr
): Promise<EscrowContract> {
  // Get contract instance from node
  const instance = await node.getContract(escrowAddress);
  if (!instance) {
    throw new Error(`Escrow contract not found at ${escrowAddress.toString()}`);
  }

  // Register with wallet (with optional secret key for note decryption)
  if (secretKey) {
    await wallet.registerContract(instance, EscrowContractArtifact, secretKey);
  } else {
    await wallet.registerContract({
      instance,
      artifact: EscrowContractArtifact,
    });
  }

  return EscrowContract.at(escrowAddress, wallet);
}

/**
 * Connect to an existing escrow contract.
 */
export async function connectToEscrow(wallet: TestWallet, escrowAddress: AztecAddress): Promise<EscrowContract> {
  return EscrowContract.at(escrowAddress, wallet);
}

/**
 * Register the Logic contract with the wallet.
 */
export async function registerLogicContract(
  wallet: TestWallet,
  logicAddress: AztecAddress,
  node: AztecNode,
): Promise<TestLogicContract> {
  // Get contract instance from node
  const instance = await node.getContract(logicAddress);
  if (!instance) {
    throw new Error(`Logic contract not found at ${logicAddress.toString()}`);
  }

  // Register with wallet
  await wallet.registerContract({
    instance,
    artifact: TestLogicContractArtifact,
  });

  return TestLogicContract.at(logicAddress, wallet);
}

/**
 * Withdraw from escrow via the Logic contract.
 *
 * The Logic contract's withdraw method internally calls the Escrow's withdraw.
 * This is the correct flow - the Escrow checks that msg_sender == its salt (the Logic address).
 *
 * @param wallet - TestWallet instance
 * @param caller - The user's account address (who is calling the Logic contract)
 * @param logicAddress - Address of the Logic contract
 * @param escrowAddress - Address of the Escrow contract
 * @param tokenAddress - Address of the token contract
 * @param amount - Amount to withdraw
 * @param recipient - Address to receive the withdrawn tokens
 * @param node - AztecNode for contract registration
 * @param paymentMethod - Optional payment method for fees
 */
export async function withdrawFromEscrow(
  wallet: TestWallet,
  caller: AztecAddress,
  logicAddress: AztecAddress,
  escrowAddress: AztecAddress,
  tokenAddress: AztecAddress,
  amount: bigint,
  recipient: AztecAddress,
  node: AztecNode,
  paymentMethod?: any,
): Promise<void> {
  // Register and connect to Logic contract
  const logic = await registerLogicContract(wallet, logicAddress, node);

  const sendOpts: any = { from: caller };
  if (paymentMethod) {
    sendOpts.fee = { paymentMethod };
  }

  // Call Logic.withdraw which internally calls Escrow.withdraw
  await logic.withWallet(wallet).methods.withdraw(escrowAddress, recipient, tokenAddress, amount).send(sendOpts).wait();
}

/**
 * Get token metadata (name, symbol, decimals).
 */
export async function getTokenMetadata(
  token: TokenContract,
  caller: AztecAddress,
): Promise<{
  name: string;
  symbol: string;
  decimals: number;
}> {
  // Note: These methods may not exist on all token contracts
  // This is a basic implementation - adjust based on actual token contract
  try {
    const [name, symbol, decimals] = await Promise.all([
      token.methods.public_get_name().simulate({ from: caller }),
      token.methods.public_get_symbol().simulate({ from: caller }),
      token.methods.public_get_decimals().simulate({ from: caller }),
    ]);
    return {
      name: name.toString(),
      symbol: symbol.toString(),
      decimals: Number(decimals),
    };
  } catch {
    // Fallback if methods don't exist
    return {
      name: 'Unknown',
      symbol: '???',
      decimals: 18,
    };
  }
}

/**
 * Check if an address is the token minter.
 */
export async function isMinter(token: TokenContract, address: AztecAddress, caller: AztecAddress): Promise<boolean> {
  try {
    const minter = await token.methods.get_minter().simulate({ from: caller });
    return minter.equals(address);
  } catch {
    return false;
  }
}
