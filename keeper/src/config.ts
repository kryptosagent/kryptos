import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Load keeper keypair
function loadKeypair(): Keypair {
  const keypairPath = process.env.KEEPER_KEYPAIR_PATH;
  const privateKey = process.env.KEEPER_PRIVATE_KEY;

  if (keypairPath) {
    const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
    return Keypair.fromSecretKey(Uint8Array.from(keypairData));
  } else if (privateKey) {
    const decoded = Buffer.from(privateKey, 'base64');
    return Keypair.fromSecretKey(decoded);
  } else {
    throw new Error('No keeper keypair configured. Set KEEPER_KEYPAIR_PATH or KEEPER_PRIVATE_KEY');
  }
}

export const config = {
  // Network
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://mainnet.helius-rpc.com',
  network: process.env.SOLANA_NETWORK || 'mainnet-beta',
  
  // Program
  programId: new PublicKey(process.env.PROGRAM_ID || 'F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2'),
  
  // Keeper
  keeperKeypair: loadKeypair(),
  
  // Jupiter
  jupiterApiUrl: process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6',
  
  // Intervals (seconds)
  dcaCheckInterval: parseInt(process.env.DCA_CHECK_INTERVAL || '60'),
  intentCheckInterval: parseInt(process.env.INTENT_CHECK_INTERVAL || '30'),
  
  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

export const connection = new Connection(config.rpcUrl, {
  commitment: 'confirmed',
  confirmTransactionInitialTimeout: 60000,
});

export function getExplorerUrl(signature: string): string {
  const cluster = config.network === 'mainnet-beta' ? '' : `?cluster=${config.network}`;
  return `https://solscan.io/tx/${signature}${cluster}`;
}

console.log('🔧 Config loaded:');
console.log(`   Network: ${config.network}`);
console.log(`   RPC: ${config.rpcUrl}`);
console.log(`   Program: ${config.programId.toBase58()}`);
console.log(`   Keeper: ${config.keeperKeypair.publicKey.toBase58()}`);