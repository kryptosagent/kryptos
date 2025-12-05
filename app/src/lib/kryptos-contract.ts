// KRYPTOS Smart Contract Integration
// Handles DCA vault creation and management

import { Connection, PublicKey, Transaction, SystemProgram, SYSVAR_RENT_PUBKEY, SendOptions } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount
} from '@solana/spl-token';
import BN from 'bn.js';

// Program ID
export const KRYPTOS_PROGRAM_ID = new PublicKey('F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2');

// Seeds for PDAs
const DCA_VAULT_SEED = Buffer.from('dca_vault');
const INPUT_VAULT_SEED = Buffer.from('input_vault');
const OUTPUT_VAULT_SEED = Buffer.from('output_vault');

// Instruction discriminators
const INITIALIZE_DCA_DISCRIMINATOR = Buffer.from([50, 254, 84, 15, 178, 10, 160, 191]);
const WITHDRAW_DCA_DISCRIMINATOR = Buffer.from([48, 57, 69, 149, 154, 125, 2, 124]);
const CLOSE_DCA_DISCRIMINATOR = Buffer.from([22, 7, 33, 98, 168, 183, 34, 243]);

// Frequency to executions mapping (per week)
export const FREQUENCY_MAP: Record<string, { min: number; max: number }> = {
  'hourly': { min: 100, max: 168 },    // ~100-168 per week
  'daily': { min: 7, max: 7 },         // 7 per week
  'weekly': { min: 1, max: 1 },        // 1 per week
  'twice-daily': { min: 14, max: 14 }, // 14 per week
};

export interface DcaParams {
  totalAmount: number;        // Total amount in token units
  tokenDecimals: number;      // Decimals of input token
  frequency: string;          // 'hourly' | 'daily' | 'weekly'
  duration: number;           // Number of periods
  varianceBps?: number;       // Variance in bps (default 2000 = 20%)
  windowStartHour?: number;   // UTC hour (default 0)
  windowEndHour?: number;     // UTC hour (default 23)
}

export interface CreateDcaResult {
  success: boolean;
  signature?: string;
  vaultAddress?: string;
  error?: string;
}

export interface DcaVaultInfo {
  address: string;
  authority: string;
  inputMint: string;
  outputMint: string;
  totalAmount: string;
  totalSpent: string;
  totalReceived: string;
  amountPerTrade: string;
  executionCount: number;
  isActive: boolean;
  nextExecution: Date | null;
  exists: boolean;
}

// ===========================================
// PHANTOM-FRIENDLY WALLET INTERFACE
// ===========================================

// Extended wallet interface supporting both methods
export interface PhantomWallet {
  publicKey: PublicKey;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAndSendTransaction?: (tx: Transaction, options?: SendOptions) => Promise<{ signature: string }>;
}

// Helper: Send transaction with Phantom-friendly approach
async function sendTransaction(
  connection: Connection,
  wallet: PhantomWallet,
  transaction: Transaction,
  options?: { skipPreflight?: boolean }
): Promise<string> {
  // Get latest blockhash
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  // Simulate transaction first to catch errors early
  const simulation = await connection.simulateTransaction(transaction);
  if (simulation.value.err) {
    console.error('Transaction simulation failed:', simulation.value.err);
    throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
  }

  let signature: string;

  // Prefer signAndSendTransaction if available (Phantom recommended)
  if (wallet.signAndSendTransaction) {
    const result = await wallet.signAndSendTransaction(transaction, {
      skipPreflight: options?.skipPreflight ?? false,
      preflightCommitment: 'confirmed',
    });
    signature = result.signature;
  } else {
    // Fallback to signTransaction + sendRawTransaction
    const signedTx = await wallet.signTransaction(transaction);
    signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: options?.skipPreflight ?? false,
      preflightCommitment: 'confirmed',
    });
  }

  // Confirm transaction
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  }, 'confirmed');

  return signature;
}

// Derive DCA vault PDA
export function deriveDcaVaultPDA(
  authority: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [DCA_VAULT_SEED, authority.toBuffer(), inputMint.toBuffer(), outputMint.toBuffer()],
    KRYPTOS_PROGRAM_ID
  );
}

// Derive input vault PDA
export function deriveInputVaultPDA(dcaVault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [INPUT_VAULT_SEED, dcaVault.toBuffer()],
    KRYPTOS_PROGRAM_ID
  );
}

// Derive output vault PDA
export function deriveOutputVaultPDA(dcaVault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [OUTPUT_VAULT_SEED, dcaVault.toBuffer()],
    KRYPTOS_PROGRAM_ID
  );
}

// Helper: Write u64 as little-endian bytes (browser compatible)
function writeU64LE(value: BN): Uint8Array {
  const bytes = new Uint8Array(8);
  const arr = value.toArray('le', 8);
  bytes.set(arr);
  return bytes;
}

// Helper: Write u16 as little-endian bytes
function writeU16LE(value: number): Uint8Array {
  const bytes = new Uint8Array(2);
  bytes[0] = value & 0xff;
  bytes[1] = (value >> 8) & 0xff;
  return bytes;
}

// Helper: Read u64 from little-endian bytes
function readU64LE(data: Uint8Array, offset: number): BN {
  const bytes = data.slice(offset, offset + 8);
  return new BN(bytes, 'le');
}

// Helper: Read u32 from little-endian bytes
function readU32LE(data: Uint8Array, offset: number): number {
  return data[offset] | (data[offset + 1] << 8) | (data[offset + 2] << 16) | (data[offset + 3] << 24);
}

// Helper: Read i64 from little-endian bytes
function readI64LE(data: Uint8Array, offset: number): number {
  const bn = readU64LE(data, offset);
  return bn.toNumber();
}

// Serialize InitializeDcaParams (browser compatible)
function serializeInitializeDcaParams(params: {
  totalAmount: BN;
  amountPerTrade: BN;
  varianceBps: number;
  minExecutions: number;
  maxExecutions: number;
  windowStartHour: number;
  windowEndHour: number;
}): Buffer {
  // Total: 8 + 8 + 2 + 1 + 1 + 1 + 1 = 22 bytes
  const totalAmountBytes = writeU64LE(params.totalAmount);
  const amountPerTradeBytes = writeU64LE(params.amountPerTrade);
  const varianceBpsBytes = writeU16LE(params.varianceBps);
  
  const result = new Uint8Array(22);
  let offset = 0;
  
  // total_amount: u64
  result.set(totalAmountBytes, offset);
  offset += 8;
  
  // amount_per_trade: u64
  result.set(amountPerTradeBytes, offset);
  offset += 8;
  
  // variance_bps: u16
  result.set(varianceBpsBytes, offset);
  offset += 2;
  
  // min_executions: u8
  result[offset] = params.minExecutions;
  offset += 1;
  
  // max_executions: u8
  result[offset] = params.maxExecutions;
  offset += 1;
  
  // window_start_hour: u8
  result[offset] = params.windowStartHour;
  offset += 1;
  
  // window_end_hour: u8
  result[offset] = params.windowEndHour;
  
  return Buffer.from(result);
}

// Calculate amount per trade based on frequency and duration
function calculateAmountPerTrade(
  totalAmount: BN,
  frequency: string,
  duration: number
): BN {
  let totalExecutions: number;
  
  switch (frequency) {
    case 'hourly':
      totalExecutions = duration; // duration = number of hours
      break;
    case 'daily':
      totalExecutions = duration; // duration = number of days
      break;
    case 'weekly':
      totalExecutions = duration; // duration = number of weeks
      break;
    case 'twice-daily':
      totalExecutions = duration * 2;
      break;
    default:
      totalExecutions = duration;
  }
  
  // Prevent division by zero
  if (totalExecutions === 0) totalExecutions = 1;
  
  return totalAmount.div(new BN(totalExecutions));
}

// Create DCA vault
export async function createDcaVault(
  connection: Connection,
  wallet: PhantomWallet,
  inputMint: PublicKey,
  outputMint: PublicKey,
  params: DcaParams
): Promise<CreateDcaResult> {
  try {
    const authority = wallet.publicKey;
    
    // Convert amount to smallest unit
    const totalAmountBN = new BN(params.totalAmount * Math.pow(10, params.tokenDecimals));
    
    // Calculate amount per trade
    const amountPerTrade = calculateAmountPerTrade(totalAmountBN, params.frequency, params.duration);
    
    // Get frequency config
    const freqConfig = FREQUENCY_MAP[params.frequency] || FREQUENCY_MAP['daily'];
    
    // Derive PDAs
    const [dcaVault, dcaVaultBump] = deriveDcaVaultPDA(authority, inputMint, outputMint);
    const [inputVault, inputVaultBump] = deriveInputVaultPDA(dcaVault);
    const [outputVault, outputVaultBump] = deriveOutputVaultPDA(dcaVault);
    
    // Get user's input token ATA
    const userInputToken = await getAssociatedTokenAddress(inputMint, authority);
    
    // Check if user has the ATA
    try {
      await getAccount(connection, userInputToken);
    } catch {
      return {
        success: false,
        error: `You don't have a token account for the input token. Please ensure you have the token in your wallet.`,
      };
    }
    
    // Build instruction data
    const instructionData = Buffer.concat([
      INITIALIZE_DCA_DISCRIMINATOR,
      serializeInitializeDcaParams({
        totalAmount: totalAmountBN,
        amountPerTrade,
        varianceBps: params.varianceBps ?? 2000, // Default 20% variance
        minExecutions: freqConfig.min,
        maxExecutions: freqConfig.max,
        windowStartHour: params.windowStartHour ?? 0,
        windowEndHour: params.windowEndHour ?? 23,
      }),
    ]);
    
    // Build transaction
    const transaction = new Transaction();
    
    // Add initialize_dca instruction
    transaction.add({
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: dcaVault, isSigner: false, isWritable: true },
        { pubkey: inputMint, isSigner: false, isWritable: false },
        { pubkey: outputMint, isSigner: false, isWritable: false },
        { pubkey: userInputToken, isSigner: false, isWritable: true },
        { pubkey: inputVault, isSigner: false, isWritable: true },
        { pubkey: outputVault, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: KRYPTOS_PROGRAM_ID,
      data: instructionData,
    });
    
    // Send transaction using Phantom-friendly helper
    const signature = await sendTransaction(connection, wallet, transaction);
    
    return {
      success: true,
      signature,
      vaultAddress: dcaVault.toBase58(),
    };
  } catch (error: any) {
    console.error('Create DCA error:', error);
    
    // Parse error message
    let errorMsg = error.message || 'Unknown error';
    
    if (errorMsg.includes('insufficient funds')) {
      errorMsg = 'Insufficient funds to create DCA vault. Make sure you have enough tokens and SOL for fees.';
    } else if (errorMsg.includes('already in use')) {
      errorMsg = 'A DCA vault already exists for this token pair. Withdraw or close the existing vault first.';
    } else if (errorMsg.includes('User rejected')) {
      errorMsg = 'Transaction was rejected by user.';
    }
    
    return {
      success: false,
      error: errorMsg,
    };
  }
}

// Withdraw from DCA vault
export async function withdrawDcaVault(
  connection: Connection,
  wallet: PhantomWallet,
  inputMint: PublicKey,
  outputMint: PublicKey
): Promise<CreateDcaResult> {
  try {
    const authority = wallet.publicKey;
    
    // Derive PDAs
    const [dcaVault] = deriveDcaVaultPDA(authority, inputMint, outputMint);
    const [inputVault] = deriveInputVaultPDA(dcaVault);
    const [outputVault] = deriveOutputVaultPDA(dcaVault);
    
    // Get user's token ATAs
    const userInputToken = await getAssociatedTokenAddress(inputMint, authority);
    const userOutputToken = await getAssociatedTokenAddress(outputMint, authority);
    
    // Build transaction
    const transaction = new Transaction();
    
    // Check if user has input token ATA, if not create it
    try {
      await getAccount(connection, userInputToken);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          authority,
          userInputToken,
          authority,
          inputMint
        )
      );
    }
    
    // Check if user has output token ATA, if not create it
    try {
      await getAccount(connection, userOutputToken);
    } catch {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          authority,
          userOutputToken,
          authority,
          outputMint
        )
      );
    }
    
    // Add withdraw_dca instruction
    transaction.add({
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: dcaVault, isSigner: false, isWritable: true },
        { pubkey: inputVault, isSigner: false, isWritable: true },
        { pubkey: outputVault, isSigner: false, isWritable: true },
        { pubkey: userInputToken, isSigner: false, isWritable: true },
        { pubkey: userOutputToken, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: KRYPTOS_PROGRAM_ID,
      data: WITHDRAW_DCA_DISCRIMINATOR,
    });
    
    // Send transaction using Phantom-friendly helper
    const signature = await sendTransaction(connection, wallet, transaction);
    
    return { success: true, signature };
  } catch (error: any) {
    console.error('Withdraw DCA error:', error);
    
    let errorMsg = error.message || 'Unknown error';
    
    if (errorMsg.includes('AccountNotInitialized')) {
      errorMsg = 'DCA vault not found for this token pair.';
    } else if (errorMsg.includes('NoFundsToWithdraw')) {
      errorMsg = 'No funds to withdraw. The vault may already be empty.';
    } else if (errorMsg.includes('User rejected')) {
      errorMsg = 'Transaction was rejected by user.';
    }
    
    return { success: false, error: errorMsg };
  }
}

// Get DCA vault info (with detailed parsing)
export async function getDcaVaultInfo(
  connection: Connection,
  authority: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey
): Promise<DcaVaultInfo | null> {
  try {
    const [dcaVault] = deriveDcaVaultPDA(authority, inputMint, outputMint);
    const accountInfo = await connection.getAccountInfo(dcaVault);
    
    if (!accountInfo) return null;
    
    const data = new Uint8Array(accountInfo.data);
    
    // Skip 8-byte discriminator
    let offset = 8;
    
    // Parse DcaVault struct
    // authority: Pubkey (32 bytes)
    const vaultAuthority = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    // input_mint: Pubkey (32 bytes)
    const vaultInputMint = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    // output_mint: Pubkey (32 bytes)
    const vaultOutputMint = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    // input_vault: Pubkey (32 bytes)
    offset += 32;
    
    // output_vault: Pubkey (32 bytes)
    offset += 32;
    
    // total_amount: u64 (8 bytes)
    const totalAmount = readU64LE(data, offset);
    offset += 8;
    
    // amount_per_trade: u64 (8 bytes)
    const amountPerTrade = readU64LE(data, offset);
    offset += 8;
    
    // variance_bps: u16 (2 bytes)
    offset += 2;
    
    // min_executions: u8 (1 byte)
    offset += 1;
    
    // max_executions: u8 (1 byte)
    offset += 1;
    
    // window_start_hour: u8 (1 byte)
    offset += 1;
    
    // window_end_hour: u8 (1 byte)
    offset += 1;
    
    // total_spent: u64 (8 bytes)
    const totalSpent = readU64LE(data, offset);
    offset += 8;
    
    // total_received: u64 (8 bytes)
    const totalReceived = readU64LE(data, offset);
    offset += 8;
    
    // execution_count: u32 (4 bytes)
    const executionCount = readU32LE(data, offset);
    offset += 4;
    
    // last_execution: i64 (8 bytes)
    offset += 8;
    
    // next_execution: i64 (8 bytes)
    const nextExecutionTs = readI64LE(data, offset);
    offset += 8;
    
    // is_active: bool (1 byte)
    const isActive = data[offset] === 1;
    
    return {
      address: dcaVault.toBase58(),
      authority: vaultAuthority.toBase58(),
      inputMint: vaultInputMint.toBase58(),
      outputMint: vaultOutputMint.toBase58(),
      totalAmount: totalAmount.toString(),
      totalSpent: totalSpent.toString(),
      totalReceived: totalReceived.toString(),
      amountPerTrade: amountPerTrade.toString(),
      executionCount,
      isActive,
      nextExecution: nextExecutionTs > 0 ? new Date(nextExecutionTs * 1000) : null,
      exists: true,
    };
  } catch (error) {
    console.error('Get DCA vault info error:', error);
    return null;
  }
}

export async function closeDcaVault(
  connection: Connection,
  wallet: PhantomWallet,
  inputMint: PublicKey,
  outputMint: PublicKey
): Promise<CreateDcaResult> {
  try {
    const authority = wallet.publicKey;
    
    // Derive PDAs
    const [dcaVault] = deriveDcaVaultPDA(authority, inputMint, outputMint);
    const [inputVault] = deriveInputVaultPDA(dcaVault);
    const [outputVault] = deriveOutputVaultPDA(dcaVault);
    
    // Check if vault exists
    const vaultInfo = await getDcaVaultInfo(connection, authority, inputMint, outputMint);
    if (!vaultInfo) {
      return {
        success: false,
        error: 'DCA vault not found for this token pair.',
      };
    }
    
    // Build transaction
    const transaction = new Transaction();
    
    // Add close_dca instruction
    transaction.add({
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: dcaVault, isSigner: false, isWritable: true },
        { pubkey: inputVault, isSigner: false, isWritable: true },
        { pubkey: outputVault, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: KRYPTOS_PROGRAM_ID,
      data: CLOSE_DCA_DISCRIMINATOR,
    });
    
    // Send transaction using Phantom-friendly helper
    const signature = await sendTransaction(connection, wallet, transaction);
    
    return { success: true, signature };
  } catch (error: any) {
    console.error('Close DCA error:', error);
    
    let errorMsg = error.message || 'Unknown error';
    
    if (errorMsg.includes('DcaHasRemainingFunds')) {
      errorMsg = 'Cannot close vault: it still has remaining funds. Use "Withdraw DCA" first to get your funds back.';
    } else if (errorMsg.includes('AccountNotInitialized')) {
      errorMsg = 'DCA vault not found for this token pair.';
    } else if (errorMsg.includes('User rejected')) {
      errorMsg = 'Transaction was rejected by user.';
    }
    
    return { success: false, error: errorMsg };
  }
}

// ============================================
// INTENT / LIMIT ORDER FUNCTIONS
// ============================================

// Intent Seeds
const INTENT_VAULT_SEED = Buffer.from('intent_vault');
const INTENT_INPUT_VAULT_SEED = Buffer.from('intent_input_vault');

// Intent Instruction discriminators
const CREATE_INTENT_DISCRIMINATOR = Buffer.from([216, 214, 79, 121, 23, 194, 96, 104]);
const WITHDRAW_INTENT_DISCRIMINATOR = Buffer.from([155, 234, 133, 148, 93, 182, 48, 51]);
const CLOSE_INTENT_DISCRIMINATOR = Buffer.from([112, 245, 154, 249, 57, 126, 54, 122]);

// Intent Vault discriminator (for account filtering)
const INTENT_VAULT_DISCRIMINATOR = Buffer.from([57, 85, 33, 184, 254, 191, 96, 45]);

// Intent types
export enum IntentType {
  Buy = 0,
  Sell = 1,
  Swap = 2,
}

export enum TriggerType {
  PriceAbove = 0,
  PriceBelow = 1,
  PriceRange = 2,
}

export enum ExecutionStyle {
  Immediate = 0,
  Stealth = 1,
  Twap = 2,
}

export enum IntentStatus {
  Monitoring = 0,
  Triggered = 1,
  Executing = 2,
  Executed = 3,
  Expired = 4,
  Cancelled = 5,
}

export interface LimitOrderParams {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amount: number;              // Amount in token units
  tokenDecimals: number;       // Decimals of input token
  triggerPrice: number;        // Price in USD (e.g., 150 for $150)
  triggerType: TriggerType;    // PriceAbove, PriceBelow, PriceRange
  triggerPriceMax?: number;    // For PriceRange only
  executionStyle?: ExecutionStyle;  // Default: Immediate
  numChunks?: number;          // For Stealth/TWAP (default 1)
  expiryHours?: number;        // Expiry in hours (default 24)
}

export interface IntentVaultInfo {
  address: string;
  authority: string;
  nonce: string;
  intentType: IntentType;
  inputMint: string;
  outputMint: string;
  amount: string;
  triggerType: TriggerType;
  triggerPrice: string;
  triggerPriceMax: string;
  executionStyle: ExecutionStyle;
  numChunks: number;
  chunksExecuted: number;
  expiresAt: Date;
  triggeredAt: Date | null;
  executedAt: Date | null;
  createdAt: Date;
  status: IntentStatus;
  totalSpent: string;
  totalReceived: string;
}

// Derive Intent vault PDA
export function deriveIntentVaultPDA(
  authority: PublicKey,
  inputMint: PublicKey,
  nonce: BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      INTENT_VAULT_SEED,
      authority.toBuffer(),
      inputMint.toBuffer(),
      nonce.toArrayLike(Buffer, 'le', 8),
    ],
    KRYPTOS_PROGRAM_ID
  );
}

// Derive Intent input vault PDA
export function deriveIntentInputVaultPDA(intentVault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [INTENT_INPUT_VAULT_SEED, intentVault.toBuffer()],
    KRYPTOS_PROGRAM_ID
  );
}

// Helper: Write i64 as little-endian bytes
function writeI64LE(value: number): Uint8Array {
  const bn = new BN(value);
  return writeU64LE(bn);
}

// Serialize CreateIntentParams
function serializeCreateIntentParams(params: {
  nonce: BN;
  intentType: number;
  amount: BN;
  triggerType: number;
  triggerPrice: BN;
  triggerPriceMax: BN;
  executionStyle: number;
  numChunks: number;
  expirySeconds: number;
}): Buffer {
  // Total: 8 + 1 + 8 + 1 + 8 + 8 + 1 + 1 + 8 = 44 bytes
  const result = new Uint8Array(44);
  let offset = 0;
  
  // nonce: u64
  result.set(writeU64LE(params.nonce), offset);
  offset += 8;
  
  // intent_type: u8
  result[offset] = params.intentType;
  offset += 1;
  
  // amount: u64
  result.set(writeU64LE(params.amount), offset);
  offset += 8;
  
  // trigger_type: u8
  result[offset] = params.triggerType;
  offset += 1;
  
  // trigger_price: u64
  result.set(writeU64LE(params.triggerPrice), offset);
  offset += 8;
  
  // trigger_price_max: u64
  result.set(writeU64LE(params.triggerPriceMax), offset);
  offset += 8;
  
  // execution_style: u8
  result[offset] = params.executionStyle;
  offset += 1;
  
  // num_chunks: u8
  result[offset] = params.numChunks;
  offset += 1;
  
  // expiry_seconds: i64
  result.set(writeI64LE(params.expirySeconds), offset);
  
  return Buffer.from(result);
}

// Generate unique nonce based on timestamp
function generateNonce(): BN {
  return new BN(Date.now());
}

// Create Limit Order (Intent)
export async function createLimitOrder(
  connection: Connection,
  wallet: PhantomWallet,
  params: LimitOrderParams
): Promise<CreateDcaResult> {
  try {
    const authority = wallet.publicKey;
    
    // Generate unique nonce
    const nonce = generateNonce();
    
    // Convert amount to smallest unit
    const amountBN = new BN(Math.floor(params.amount * Math.pow(10, params.tokenDecimals)));
    
    // Convert trigger price to 6 decimals (USD)
    const triggerPriceBN = new BN(Math.floor(params.triggerPrice * 1_000_000));
    const triggerPriceMaxBN = params.triggerPriceMax 
      ? new BN(Math.floor(params.triggerPriceMax * 1_000_000))
      : new BN(0);
    
    // Determine intent type based on trigger
    // Buy = spend USDC to buy token when price drops (PriceBelow)
    // Sell = sell token for USDC when price rises (PriceAbove)
    let intentType = IntentType.Swap; // Default
    
    // Derive PDAs
    const [intentVault] = deriveIntentVaultPDA(authority, params.inputMint, nonce);
    const [vaultInputToken] = deriveIntentInputVaultPDA(intentVault);
    
    // Get user's input token ATA
    const userInputToken = await getAssociatedTokenAddress(params.inputMint, authority);
    
    // Check if user has the ATA
    try {
      await getAccount(connection, userInputToken);
    } catch {
      return {
        success: false,
        error: `You don't have a token account for the input token. Please ensure you have the token in your wallet.`,
      };
    }
    
    // Calculate expiry in seconds
    const expirySeconds = (params.expiryHours ?? 24) * 60 * 60;
    
    // Build instruction data
    const instructionData = Buffer.concat([
      CREATE_INTENT_DISCRIMINATOR,
      serializeCreateIntentParams({
        nonce,
        intentType,
        amount: amountBN,
        triggerType: params.triggerType,
        triggerPrice: triggerPriceBN,
        triggerPriceMax: triggerPriceMaxBN,
        executionStyle: params.executionStyle ?? ExecutionStyle.Immediate,
        numChunks: params.numChunks ?? 1,
        expirySeconds,
      }),
    ]);
    
    // Build transaction
    const transaction = new Transaction();
    
    // Add create_intent instruction
    transaction.add({
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: intentVault, isSigner: false, isWritable: true },
        { pubkey: params.inputMint, isSigner: false, isWritable: false },
        { pubkey: params.outputMint, isSigner: false, isWritable: false },
        { pubkey: userInputToken, isSigner: false, isWritable: true },
        { pubkey: vaultInputToken, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      ],
      programId: KRYPTOS_PROGRAM_ID,
      data: instructionData,
    });
    
    // Send transaction using Phantom-friendly helper
    const signature = await sendTransaction(connection, wallet, transaction);
    
    return {
      success: true,
      signature,
      vaultAddress: intentVault.toBase58(),
    };
  } catch (error: any) {
    console.error('Create Limit Order error:', error);
    
    let errorMsg = error.message || 'Unknown error';
    
    if (errorMsg.includes('insufficient funds')) {
      errorMsg = 'Insufficient funds to create limit order. Make sure you have enough tokens and SOL for fees.';
    } else if (errorMsg.includes('User rejected')) {
      errorMsg = 'Transaction was rejected by user.';
    }
    
    return {
      success: false,
      error: errorMsg,
    };
  }
}

// Withdraw from Intent vault
export async function withdrawIntent(
  connection: Connection,
  wallet: PhantomWallet,
  intentVaultAddress: PublicKey
): Promise<CreateDcaResult> {
  try {
    const authority = wallet.publicKey;
    
    // Get intent vault account to find input mint and input vault
    const accountInfo = await connection.getAccountInfo(intentVaultAddress);
    if (!accountInfo) {
      return { success: false, error: 'Intent vault not found.' };
    }
    
    // Parse account data using same logic as parseIntentVault
    const data = new Uint8Array(accountInfo.data);
    
    // Log raw data for debugging
    console.log('IntentVault data size:', data.length);
    console.log('Discriminator:', Array.from(data.slice(0, 8)));
    
    // Offset calculations:
    // 0-8: discriminator (8 bytes)
    // 8-40: authority (32 bytes)
    // 40-48: nonce (8 bytes)
    // 48: intent_type (1 byte)
    // 49-81: input_mint (32 bytes)
    // 81-113: output_mint (32 bytes)
    // 113-145: input_vault (32 bytes)
    
    const inputMint = new PublicKey(data.slice(49, 81));
    const vaultInputToken = new PublicKey(data.slice(113, 145));
    
    console.log('Input Mint:', inputMint.toBase58());
    console.log('Vault Input Token:', vaultInputToken.toBase58());
    
    // Get user's input token ATA
    const userInputToken = await getAssociatedTokenAddress(inputMint, authority);
    console.log('User Input Token:', userInputToken.toBase58());
    
    // Verify vault input token exists
    const vaultTokenInfo = await connection.getAccountInfo(vaultInputToken);
    if (!vaultTokenInfo) {
      return { success: false, error: 'Vault input token account not found.' };
    }
    console.log('Vault Input Token exists, owner:', new PublicKey(vaultTokenInfo.owner).toBase58());
    
    // Build transaction
    const transaction = new Transaction();
    
    // Check if user has input token ATA, if not create it
    try {
      await getAccount(connection, userInputToken);
    } catch {
      console.log('Creating user ATA...');
      transaction.add(
        createAssociatedTokenAccountInstruction(
          authority,
          userInputToken,
          authority,
          inputMint
        )
      );
    }
    
    // Add withdraw_intent instruction
    transaction.add({
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: intentVaultAddress, isSigner: false, isWritable: true },
        { pubkey: vaultInputToken, isSigner: false, isWritable: true },
        { pubkey: userInputToken, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: KRYPTOS_PROGRAM_ID,
      data: WITHDRAW_INTENT_DISCRIMINATOR,
    });
    
    // Send transaction using Phantom-friendly helper (NO skipPreflight)
    const signature = await sendTransaction(connection, wallet, transaction);
    
    return { success: true, signature };
  } catch (error: any) {
    console.error('Withdraw Intent error:', error);
    
    let errorMsg = error.message || 'Unknown error';
    
    if (errorMsg.includes('Unauthorized')) {
      errorMsg = 'You are not the owner of this intent vault.';
    } else if (errorMsg.includes('User rejected')) {
      errorMsg = 'Transaction was rejected by user.';
    }
    
    return { success: false, error: errorMsg };
  }
}

// Close Intent vault (reclaim rent after withdraw)
export async function closeIntent(
  connection: Connection,
  wallet: PhantomWallet,
  intentVaultAddress: PublicKey
): Promise<CreateDcaResult> {
  try {
    const authority = wallet.publicKey;
    
    // Get intent vault account to find input vault address
    const accountInfo = await connection.getAccountInfo(intentVaultAddress);
    if (!accountInfo) {
      return { success: false, error: 'Intent vault not found.' };
    }
    
    // Parse input_vault from account data (offset 113-145)
    const data = new Uint8Array(accountInfo.data);
    const vaultInputToken = new PublicKey(data.slice(113, 145));
    
    // Build transaction
    const transaction = new Transaction();
    
    // Add close_intent instruction
    transaction.add({
      keys: [
        { pubkey: authority, isSigner: true, isWritable: true },
        { pubkey: intentVaultAddress, isSigner: false, isWritable: true },
        { pubkey: vaultInputToken, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      programId: KRYPTOS_PROGRAM_ID,
      data: CLOSE_INTENT_DISCRIMINATOR,
    });
    
    // Send transaction using Phantom-friendly helper
    const signature = await sendTransaction(connection, wallet, transaction);
    
    return { success: true, signature };
  } catch (error: any) {
    console.error('Close Intent error:', error);
    
    let errorMsg = error.message || 'Unknown error';
    
    if (errorMsg.includes('IntentHasRemainingFunds')) {
      errorMsg = 'Cannot close: vault still has funds. Withdraw first.';
    } else if (errorMsg.includes('User rejected')) {
      errorMsg = 'Transaction was rejected by user.';
    }
    
    return { success: false, error: errorMsg };
  }
}

// Parse Intent vault data
function parseIntentVault(address: PublicKey, data: Uint8Array): IntentVaultInfo {
  let offset = 8; // Skip discriminator
  
  // authority: Pubkey (32 bytes)
  const authority = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  // nonce: u64 (8 bytes)
  const nonce = readU64LE(data, offset);
  offset += 8;
  
  // intent_type: u8 (1 byte)
  const intentType = data[offset] as IntentType;
  offset += 1;
  
  // input_mint: Pubkey (32 bytes)
  const inputMint = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  // output_mint: Pubkey (32 bytes)
  const outputMint = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;
  
  // input_vault: Pubkey (32 bytes) - skip
  offset += 32;
  
  // amount: u64 (8 bytes)
  const amount = readU64LE(data, offset);
  offset += 8;
  
  // trigger_type: u8 (1 byte)
  const triggerType = data[offset] as TriggerType;
  offset += 1;
  
  // trigger_price: u64 (8 bytes)
  const triggerPrice = readU64LE(data, offset);
  offset += 8;
  
  // trigger_price_max: u64 (8 bytes)
  const triggerPriceMax = readU64LE(data, offset);
  offset += 8;
  
  // execution_style: u8 (1 byte)
  const executionStyle = data[offset] as ExecutionStyle;
  offset += 1;
  
  // num_chunks: u8 (1 byte)
  const numChunks = data[offset];
  offset += 1;
  
  // chunks_executed: u8 (1 byte)
  const chunksExecuted = data[offset];
  offset += 1;
  
  // expires_at: i64 (8 bytes)
  const expiresAt = readI64LE(data, offset);
  offset += 8;
  
  // triggered_at: i64 (8 bytes)
  const triggeredAt = readI64LE(data, offset);
  offset += 8;
  
  // executed_at: i64 (8 bytes)
  const executedAt = readI64LE(data, offset);
  offset += 8;
  
  // created_at: i64 (8 bytes)
  const createdAt = readI64LE(data, offset);
  offset += 8;
  
  // status: u8 (1 byte)
  const status = data[offset] as IntentStatus;
  offset += 1;
  
  // total_spent: u64 (8 bytes)
  const totalSpent = readU64LE(data, offset);
  offset += 8;
  
  // total_received: u64 (8 bytes)
  const totalReceived = readU64LE(data, offset);
  
  return {
    address: address.toBase58(),
    authority: authority.toBase58(),
    nonce: nonce.toString(),
    intentType,
    inputMint: inputMint.toBase58(),
    outputMint: outputMint.toBase58(),
    amount: amount.toString(),
    triggerType,
    triggerPrice: triggerPrice.toString(),
    triggerPriceMax: triggerPriceMax.toString(),
    executionStyle,
    numChunks,
    chunksExecuted,
    expiresAt: new Date(expiresAt * 1000),
    triggeredAt: triggeredAt > 0 ? new Date(triggeredAt * 1000) : null,
    executedAt: executedAt > 0 ? new Date(executedAt * 1000) : null,
    createdAt: new Date(createdAt * 1000),
    status,
    totalSpent: totalSpent.toString(),
    totalReceived: totalReceived.toString(),
  };
}

// Get all Intent vaults for a user
export async function getUserIntentVaults(
  connection: Connection,
  authority: PublicKey
): Promise<IntentVaultInfo[]> {
  try {
    // Get all program accounts filtered by data size and authority
    const accounts = await connection.getProgramAccounts(KRYPTOS_PROGRAM_ID, {
      filters: [
        { dataSize: 288 }, // IntentVault account size
        { memcmp: { offset: 8, bytes: authority.toBase58() } },
      ],
    });
    
    const vaults: IntentVaultInfo[] = [];
    const expectedDiscriminator = [57, 85, 33, 184, 254, 191, 96, 45];
    
    for (const account of accounts) {
      try {
        const data = new Uint8Array(account.account.data);
        
        // Verify discriminator client-side
        let isIntentVault = true;
        for (let i = 0; i < 8; i++) {
          if (data[i] !== expectedDiscriminator[i]) {
            isIntentVault = false;
            break;
          }
        }
        
        if (!isIntentVault) continue;
        
        const vault = parseIntentVault(account.pubkey, data);
        vaults.push(vault);
      } catch (e) {
        console.error('Error parsing intent vault:', e);
      }
    }
    
    // Sort by created_at descending (newest first)
    vaults.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return vaults;
  } catch (error) {
    console.error('Get user intent vaults error:', error);
    return [];
  }
}

// Get single Intent vault info by address
export async function getIntentVaultInfo(
  connection: Connection,
  intentVaultAddress: PublicKey
): Promise<IntentVaultInfo | null> {
  try {
    const accountInfo = await connection.getAccountInfo(intentVaultAddress);
    if (!accountInfo) return null;
    
    const data = new Uint8Array(accountInfo.data);
    return parseIntentVault(intentVaultAddress, data);
  } catch (error) {
    console.error('Get intent vault info error:', error);
    return null;
  }
}