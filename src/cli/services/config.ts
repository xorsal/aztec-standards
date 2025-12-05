/**
 * Configuration Service - Manages CLI config persistence
 *
 * Config is stored in .escrow.json (local) or ~/.escrow.json (global).
 * Stores network settings, Logic contract address, and deployed escrows.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { EscrowCLIConfig, EscrowEntry } from '../types/index.js';

export const CONFIG_FILENAME = '.escrow.json';

export const NETWORK_URLS = {
  sandbox: 'http://localhost:8080',
  devnet: 'https://devnet.aztec-labs.com',
} as const;

// Global state for current session
let currentNetwork: 'sandbox' | 'devnet' = 'sandbox';
let currentNodeUrl: string = NETWORK_URLS.sandbox;

/**
 * Get the path to the config file.
 * Prefers local .escrow.json, falls back to ~/.escrow.json
 */
function getConfigPath(): string {
  const localPath = join(process.cwd(), CONFIG_FILENAME);
  if (existsSync(localPath)) {
    return localPath;
  }

  const globalPath = join(homedir(), CONFIG_FILENAME);
  return globalPath;
}

/**
 * Get the path for saving config (local by default).
 */
function getSaveConfigPath(useGlobal: boolean = false): string {
  if (useGlobal) {
    return join(homedir(), CONFIG_FILENAME);
  }
  return join(process.cwd(), CONFIG_FILENAME);
}

/**
 * Create a default config.
 */
function createDefaultConfig(): EscrowCLIConfig {
  return {
    network: 'sandbox',
    nodeUrl: NETWORK_URLS.sandbox,
    escrows: [],
  };
}

/**
 * Load config from file.
 */
export function loadConfig(): EscrowCLIConfig {
  const configPath = getConfigPath();

  if (!existsSync(configPath)) {
    return createDefaultConfig();
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as EscrowCLIConfig;

    // Update global state
    currentNetwork = config.network;
    currentNodeUrl = config.nodeUrl;

    return config;
  } catch (error) {
    console.error(`Error reading config from ${configPath}:`, error);
    return createDefaultConfig();
  }
}

/**
 * Save config to file.
 */
export function saveConfig(config: EscrowCLIConfig, useGlobal: boolean = false): void {
  const configPath = getSaveConfigPath(useGlobal);

  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error(`Error writing config to ${configPath}:`, error);
    throw error;
  }
}

/**
 * Update config with partial updates.
 */
export function updateConfig(updates: Partial<EscrowCLIConfig>): EscrowCLIConfig {
  const config = loadConfig();
  const updated = { ...config, ...updates };
  saveConfig(updated);
  return updated;
}

/**
 * Add an escrow entry to config.
 */
export function addEscrow(entry: EscrowEntry): void {
  const config = loadConfig();

  // Check if escrow already exists
  const existingIndex = config.escrows.findIndex((e) => e.address.toLowerCase() === entry.address.toLowerCase());

  if (existingIndex >= 0) {
    // Update existing
    config.escrows[existingIndex] = entry;
  } else {
    // Add new
    config.escrows.push(entry);
  }

  saveConfig(config);
}

/**
 * Find an escrow by address.
 */
export function findEscrow(address: string): EscrowEntry | undefined {
  const config = loadConfig();
  return config.escrows.find((e) => e.address.toLowerCase() === address.toLowerCase());
}

/**
 * Get the most recently deployed escrow.
 */
export function getLatestEscrow(): EscrowEntry | undefined {
  const config = loadConfig();
  if (config.escrows.length === 0) {
    return undefined;
  }
  // Sort by deployedAt descending
  const sorted = [...config.escrows].sort(
    (a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime(),
  );
  return sorted[0];
}

/**
 * Get all escrows.
 */
export function getEscrows(): EscrowEntry[] {
  const config = loadConfig();
  return config.escrows;
}

/**
 * Set the network (sandbox or devnet).
 */
export function setNetwork(network: 'sandbox' | 'devnet'): void {
  currentNetwork = network;
  currentNodeUrl = NETWORK_URLS[network];

  // Also update config file
  updateConfig({
    network,
    nodeUrl: currentNodeUrl,
  });
}

/**
 * Get the current network.
 */
export function getNetwork(): 'sandbox' | 'devnet' {
  return currentNetwork;
}

/**
 * Get the current node URL.
 */
export function getNodeUrl(): string {
  return currentNodeUrl;
}

/**
 * Set the Logic contract address.
 */
export function setLogicAddress(address: string): void {
  updateConfig({ logicContractAddress: address });
}

/**
 * Get the Logic contract address.
 */
export function getLogicAddress(): string | undefined {
  const config = loadConfig();
  return config.logicContractAddress;
}

/**
 * Set the default token address.
 */
export function setTokenAddress(address: string): void {
  updateConfig({ tokenAddress: address });
}

/**
 * Get the default token address.
 */
export function getTokenAddress(): string | undefined {
  const config = loadConfig();
  return config.tokenAddress;
}

/**
 * Initialize config with network settings (called on CLI startup).
 */
export function initializeConfig(network?: 'sandbox' | 'devnet'): void {
  const config = loadConfig();

  if (network) {
    currentNetwork = network;
    currentNodeUrl = NETWORK_URLS[network];
  } else {
    currentNetwork = config.network;
    currentNodeUrl = config.nodeUrl;
  }
}
