import { Program, AnchorProvider, Idl, BN, Wallet } from '@coral-xyz/anchor';
import { PublicKey, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import { config, connection } from './config';
import { logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';

// Load IDL
const idlPath = path.join(__dirname, '../../target/idl/kryptos.json');
const idl: Idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

// Create wallet adapter from keypair
class KeeperWallet implements Wallet {
  constructor(readonly payer: Keypair) {}

  get publicKey(): PublicKey {
    return this.payer.publicKey;
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof Transaction) {
      tx.partialSign(this.payer);
    } else {
      tx.sign([this.payer]);
    }
    return tx;
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    for (const tx of txs) {
      if (tx instanceof Transaction) {
        tx.partialSign(this.payer);
      } else {
        tx.sign([this.payer]);
      }
    }
    return txs;
  }
}

// Create wallet and provider
const wallet = new KeeperWallet(config.keeperKeypair);
const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });

// Create program instance
export const program = new Program(idl as any, provider);

// DCA Vault type
export interface DcaVault {
  authority: PublicKey;
  inputMint: PublicKey;
  outputMint: PublicKey;
  inputVault: PublicKey;
  outputVault: PublicKey;
  totalAmount: BN;
  amountPerTrade: BN;
  varianceBps: number;
  minExecutions: number;
  maxExecutions: number;
  windowStartHour: number;
  windowEndHour: number;
  totalSpent: BN;
  totalReceived: BN;
  executionCount: number;
  lastExecution: BN;
  nextExecution: BN;
  isActive: boolean;
  createdAt: BN;
  bump: number;
  inputVaultBump: number;
  outputVaultBump: number;
}

// Intent Vault type
export interface IntentVault {
  authority: PublicKey;
  nonce: BN;
  intentType: any;
  inputMint: PublicKey;
  outputMint: PublicKey;
  inputVault: PublicKey;
  amount: BN;
  triggerType: any;
  triggerPrice: BN;
  triggerPriceMax: BN;
  executionStyle: any;
  numChunks: number;
  chunksExecuted: number;
  expiresAt: BN;
  triggeredAt: BN;
  executedAt: BN;
  createdAt: BN;
  status: any;
  totalSpent: BN;
  totalReceived: BN;
  bump: number;
  vaultBump: number;
}

// Fetch all DCA vaults
export async function getAllDcaVaults(): Promise<{ publicKey: PublicKey; account: DcaVault }[]> {
  try {
    const accounts = await (program.account as any).dcaVault.all();
    return accounts.map((a: any) => ({
      publicKey: a.publicKey,
      account: a.account as DcaVault,
    }));
  } catch (error) {
    logger.error('Failed to fetch DCA vaults:', error);
    return [];
  }
}

// Fetch active DCA vaults (ready to execute)
export async function getActiveDcaVaults(): Promise<{ publicKey: PublicKey; account: DcaVault }[]> {
  const allVaults = await getAllDcaVaults();
  const now = Math.floor(Date.now() / 1000);

  return allVaults.filter((v) => {
    const vault = v.account;
    return (
      vault.isActive &&
      vault.totalSpent.lt(vault.totalAmount) &&
      vault.nextExecution.toNumber() <= now
    );
  });
}

// Fetch all Intent vaults
export async function getAllIntentVaults(): Promise<{ publicKey: PublicKey; account: IntentVault }[]> {
  try {
    const accounts = await (program.account as any).intentVault.all();
    return accounts.map((a: any) => ({
      publicKey: a.publicKey,
      account: a.account as IntentVault,
    }));
  } catch (error) {
    logger.error('Failed to fetch Intent vaults:', error);
    return [];
  }
}

// Fetch active Intent vaults (monitoring status)
export async function getActiveIntentVaults(): Promise<{ publicKey: PublicKey; account: IntentVault }[]> {
  const allVaults = await getAllIntentVaults();
  const now = Math.floor(Date.now() / 1000);

  return allVaults.filter((v) => {
    const vault = v.account;
    const isMonitoring = 'monitoring' in vault.status;
    const isTriggered = 'triggered' in vault.status;
    const isExecuting = 'executing' in vault.status;
    const notExpired = vault.expiresAt.toNumber() > now;

    return (isMonitoring || isTriggered || isExecuting) && notExpired;
  });
}

// Get PDA for DCA vault
export function getDcaVaultPDA(
  authority: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('dca_vault'), authority.toBuffer(), inputMint.toBuffer(), outputMint.toBuffer()],
    config.programId
  );
}

// Get PDA for input vault
export function getInputVaultPDA(dcaVault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('input_vault'), dcaVault.toBuffer()],
    config.programId
  );
}

// Get PDA for output vault
export function getOutputVaultPDA(dcaVault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('output_vault'), dcaVault.toBuffer()],
    config.programId
  );
}