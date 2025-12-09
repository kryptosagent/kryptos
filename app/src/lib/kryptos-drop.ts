// KRYPTOS Drop Smart Contract Integration
// Handles creating drop links for sending crypto to anyone

import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  SendOptions,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from '@solana/spl-token';
import BN from 'bn.js';

// ===========================================
// CONSTANTS
// ===========================================

// KRYPTOS Drop Program ID (mainnet)
export const KRYPTOS_DROP_PROGRAM_ID = new PublicKey(
  'CrvSTnNtciVF2q2rRui19WwAdvxpWjK6faRub9xRcesK'
);

// Instruction discriminators (from IDL)
const CREATE_DROP_DISCRIMINATOR = Buffer.from([157, 142, 145, 247, 92, 73, 59, 48]);
const CREATE_DROP_SOL_DISCRIMINATOR = Buffer.from([161, 227, 56, 52, 15, 30, 227, 170]);

// Drop link base URL
export const DROP_BASE_URL = 'https://www.kryptosagent.xyz/drop';

// ===========================================
// TYPES
// ===========================================

export interface CreateDropParams {
  amount: number;           // Amount in token units (e.g., 0.01 for 0.01 SOL)
  tokenDecimals: number;    // Decimals of the token
  expiryHours?: number;     // Expiry in hours (default: 168 = 7 days)
}

export interface CreateDropResult {
  success: boolean;
  signature?: string;
  dropId?: string;
  dropLink?: string;
  escrowAddress?: string;
  error?: string;
}

export interface PhantomWallet {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAndSendTransaction?: (tx: Transaction, options?: SendOptions) => Promise<{ signature: string }>;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

// Detect token program for a mint
async function detectTokenProgram(
  connection: Connection,
  mint: PublicKey
): Promise<PublicKey> {
  try {
    const mintInfo = await connection.getAccountInfo(mint);
    if (mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      return TOKEN_2022_PROGRAM_ID;
    }
    return TOKEN_PROGRAM_ID;
  } catch {
    return TOKEN_PROGRAM_ID;
  }
}

// Generate unique drop ID
function generateDropId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}${random}`;
}

// Derive escrow PDA
function deriveEscrowPDA(
  dropId: string,
  creator: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), Buffer.from(dropId), creator.toBuffer()],
    KRYPTOS_DROP_PROGRAM_ID
  );
}

// Write u64 as little-endian bytes
function writeU64LE(value: BN): Uint8Array {
  const bytes = new Uint8Array(8);
  const arr = value.toArray('le', 8);
  bytes.set(arr);
  return bytes;
}

// Write i64 as little-endian bytes
function writeI64LE(value: number): Uint8Array {
  const bn = new BN(value);
  return writeU64LE(bn);
}

// Serialize string with length prefix (Borsh format)
function serializeString(str: string): Buffer {
  const strBuffer = Buffer.from(str, 'utf8');
  const lenBuffer = Buffer.alloc(4);
  lenBuffer.writeUInt32LE(strBuffer.length, 0);
  return Buffer.concat([lenBuffer, strBuffer]);
}

// Send transaction with Phantom-friendly approach
async function sendTransaction(
  connection: Connection,
  wallet: PhantomWallet,
  transaction: Transaction,
  options?: { skipPreflight?: boolean }
): Promise<string> {
  const { VersionedTransaction, TransactionMessage } = await import('@solana/web3.js');
  
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  // Simulate first (Phantom recommended)
  const messageV0 = new TransactionMessage({
    payerKey: wallet.publicKey,
    recentBlockhash: blockhash,
    instructions: transaction.instructions,
  }).compileToV0Message();
  
  const versionedTx = new VersionedTransaction(messageV0);
  
  const simulation = await connection.simulateTransaction(versionedTx, {
    sigVerify: false,
  });
  
  if (simulation.value.err) {
    console.error('Transaction simulation failed:', simulation.value.err);
    throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }

  let signature: string;

  if (wallet.signAndSendTransaction) {
    const result = await wallet.signAndSendTransaction(transaction, {
      skipPreflight: options?.skipPreflight ?? false,
      preflightCommitment: 'confirmed',
    });
    signature = result.signature;
  } else {
    const signedTx = await wallet.signTransaction(transaction);
    signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: options?.skipPreflight ?? false,
      preflightCommitment: 'confirmed',
    });
  }

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  }, 'confirmed');

  return signature;
}

// ===========================================
// CREATE DROP - Native SOL
// ===========================================

export async function createDropSol(
  connection: Connection,
  wallet: PhantomWallet,
  params: CreateDropParams
): Promise<CreateDropResult> {
  try {
    const creator = wallet.publicKey;
    const dropId = generateDropId();
    
    // Convert amount to lamports
    const amountLamports = new BN(Math.floor(params.amount * LAMPORTS_PER_SOL));
    
    // Calculate expiry timestamp (default 7 days)
    const expiryHours = params.expiryHours ?? 168;
    const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryHours * 60 * 60);
    
    // Derive escrow PDA
    const [escrowPda, escrowBump] = deriveEscrowPDA(dropId, creator);
    
    // Serialize instruction data
    // Format: discriminator (8) + drop_id (4 + len) + amount (8) + expires_at (Option<i64> = 1 + 8)
    const dropIdSerialized = serializeString(dropId);
    const amountBytes = writeU64LE(amountLamports);
    
    // expires_at: Option<i64> - Some(timestamp)
    const expiresAtBytes = new Uint8Array(9);
    expiresAtBytes[0] = 1; // Some
    expiresAtBytes.set(writeI64LE(expiryTimestamp), 1);
    
    const instructionData = Buffer.concat([
      CREATE_DROP_SOL_DISCRIMINATOR,
      dropIdSerialized,
      amountBytes,
      Buffer.from(expiresAtBytes),
    ]);
    
    // Build transaction
    const transaction = new Transaction();
    
    transaction.add({
      keys: [
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: KRYPTOS_DROP_PROGRAM_ID,
      data: instructionData,
    });
    
    // Send transaction
    const signature = await sendTransaction(connection, wallet, transaction);
    
    // Generate drop link
    const dropLink = `${DROP_BASE_URL}/${dropId}?c=${creator.toBase58()}`;
    
    return {
      success: true,
      signature,
      dropId,
      dropLink,
      escrowAddress: escrowPda.toBase58(),
    };
  } catch (error: any) {
    console.error('Create Drop SOL error:', error);
    
    let errorMsg = error.message || 'Unknown error';
    
    if (errorMsg.includes('insufficient funds') || errorMsg.includes('0x1')) {
      errorMsg = 'Insufficient SOL balance to create this drop.';
    } else if (errorMsg.includes('User rejected')) {
      errorMsg = 'Transaction was rejected by user.';
    }
    
    return {
      success: false,
      error: errorMsg,
    };
  }
}

// ===========================================
// CREATE DROP - SPL Token
// ===========================================

export async function createDropToken(
  connection: Connection,
  wallet: PhantomWallet,
  tokenMint: PublicKey,
  params: CreateDropParams
): Promise<CreateDropResult> {
  try {
    const creator = wallet.publicKey;
    const dropId = generateDropId();
    
    // Detect token program (supports Token-2022)
    const tokenProgram = await detectTokenProgram(connection, tokenMint);
    console.log('Drop: Token program:', tokenProgram.equals(TOKEN_2022_PROGRAM_ID) ? 'Token-2022' : 'Standard');
    
    // Convert amount to smallest unit
    const amountRaw = new BN(Math.floor(params.amount * Math.pow(10, params.tokenDecimals)));
    
    // Calculate expiry timestamp (default 7 days)
    const expiryHours = params.expiryHours ?? 168;
    const expiryTimestamp = Math.floor(Date.now() / 1000) + (expiryHours * 60 * 60);
    
    // Derive escrow PDA
    const [escrowPda, escrowBump] = deriveEscrowPDA(dropId, creator);
    
    // Get creator's token ATA
    const creatorAta = await getAssociatedTokenAddress(tokenMint, creator, false, tokenProgram);
    
    // Check if creator has the token account
    try {
      await getAccount(connection, creatorAta, undefined, tokenProgram);
    } catch {
      return {
        success: false,
        error: "You don't have this token in your wallet.",
      };
    }
    
    // Derive escrow vault ATA (owned by escrow PDA)
    const escrowVault = await getAssociatedTokenAddress(
      tokenMint,
      escrowPda,
      true, // allowOwnerOffCurve - PDA owned
      tokenProgram
    );
    
    // Serialize instruction data
    const dropIdSerialized = serializeString(dropId);
    const amountBytes = writeU64LE(amountRaw);
    
    // expires_at: Option<i64> - Some(timestamp)
    const expiresAtBytes = new Uint8Array(9);
    expiresAtBytes[0] = 1; // Some
    expiresAtBytes.set(writeI64LE(expiryTimestamp), 1);
    
    const instructionData = Buffer.concat([
      CREATE_DROP_DISCRIMINATOR,
      dropIdSerialized,
      amountBytes,
      Buffer.from(expiresAtBytes),
    ]);
    
    // Build transaction
    const transaction = new Transaction();
    
    transaction.add({
      keys: [
        { pubkey: creator, isSigner: true, isWritable: true },
        { pubkey: escrowPda, isSigner: false, isWritable: true },
        { pubkey: tokenMint, isSigner: false, isWritable: false },
        { pubkey: creatorAta, isSigner: false, isWritable: true },
        { pubkey: escrowVault, isSigner: false, isWritable: true },
        { pubkey: tokenProgram, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: KRYPTOS_DROP_PROGRAM_ID,
      data: instructionData,
    });
    
    // Send transaction
    const signature = await sendTransaction(connection, wallet, transaction);
    
    // Generate drop link
    const dropLink = `${DROP_BASE_URL}/${dropId}?c=${creator.toBase58()}`;
    
    return {
      success: true,
      signature,
      dropId,
      dropLink,
      escrowAddress: escrowPda.toBase58(),
    };
  } catch (error: any) {
    console.error('Create Drop Token error:', error);
    
    let errorMsg = error.message || 'Unknown error';
    
    if (errorMsg.includes('insufficient funds') || errorMsg.includes('0x1')) {
      errorMsg = 'Insufficient token balance to create this drop.';
    } else if (errorMsg.includes('User rejected')) {
      errorMsg = 'Transaction was rejected by user.';
    }
    
    return {
      success: false,
      error: errorMsg,
    };
  }
}

// ===========================================
// MAIN CREATE DROP FUNCTION
// ===========================================

export async function createDrop(
  connection: Connection,
  wallet: PhantomWallet,
  tokenMint: string | null, // null or SOL address for native SOL
  amount: number,
  decimals: number,
  expiryHours?: number
): Promise<CreateDropResult> {
  const SOL_MINT = 'So11111111111111111111111111111111111111112';
  
  const isNativeSol = !tokenMint || tokenMint === SOL_MINT;
  
  if (isNativeSol) {
    return createDropSol(connection, wallet, {
      amount,
      tokenDecimals: 9,
      expiryHours,
    });
  } else {
    return createDropToken(connection, wallet, new PublicKey(tokenMint), {
      amount,
      tokenDecimals: decimals,
      expiryHours,
    });
  }
}