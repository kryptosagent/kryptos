import { 
  Connection, 
  PublicKey, 
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { BN } from 'bn.js';

// ============================================================================
// CONSTANTS
// ============================================================================

export const KRYPTOS_PROGRAM_ID = new PublicKey('F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2');

// Instruction discriminators from IDL
const DISCRIMINATORS = {
  initializeDca: Buffer.from([50, 254, 84, 15, 178, 10, 160, 191]),
  executeDca: Buffer.from([129, 25, 89, 105, 132, 188, 156, 3]),
  withdrawDca: Buffer.from([48, 57, 69, 149, 154, 125, 2, 124]),
  closeDca: Buffer.from([22, 7, 33, 98, 168, 183, 34, 243]),
};

// PDA Seeds
const SEEDS = {
  dcaVault: Buffer.from('dca_vault'),
  inputVault: Buffer.from('input_vault'),
  outputVault: Buffer.from('output_vault'),
};

// ============================================================================
// TYPES
// ============================================================================

export interface DcaParams {
  totalAmount: number;       // Total amount to DCA (in token units, e.g., 10 USDC)
  amountPerTrade: number;    // Amount per execution
  varianceBps: number;       // Variance in basis points (e.g., 2000 = 20%)
  minExecutions: number;     // Min executions per week
  maxExecutions: number;     // Max executions per week
  windowStartHour: number;   // UTC hour (0-23)
  windowEndHour: number;     // UTC hour (0-23)
}

export interface DcaVaultInfo {
  address: PublicKey;
  authority: PublicKey;
  inputMint: PublicKey;
  outputMint: PublicKey;
  totalAmount: number;
  amountPerTrade: number;
  varianceBps: number;
  minExecutions: number;
  maxExecutions: number;
  windowStartHour: number;
  windowEndHour: number;
  totalSpent: number;
  totalReceived: number;
  executionCount: number;
  lastExecution: Date | null;
  nextExecution: Date | null;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateDcaResult {
  success: boolean;
  signature?: string;
  vaultAddress?: string;
  error?: string;
}

// ============================================================================
// PDA DERIVATION
// ============================================================================

export function getDcaVaultPda(
  authority: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.dcaVault, authority.toBuffer(), inputMint.toBuffer(), outputMint.toBuffer()],
    KRYPTOS_PROGRAM_ID
  );
}

export function getInputVaultPda(dcaVault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.inputVault, dcaVault.toBuffer()],
    KRYPTOS_PROGRAM_ID
  );
}

export function getOutputVaultPda(dcaVault: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [SEEDS.outputVault, dcaVault.toBuffer()],
    KRYPTOS_PROGRAM_ID
  );
}

// ============================================================================
// INSTRUCTION BUILDERS
// ============================================================================

function buildInitializeDcaInstruction(
  authority: PublicKey,
  dcaVault: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  userInputToken: PublicKey,
  vaultInputToken: PublicKey,
  vaultOutputToken: PublicKey,
  params: DcaParams,
  inputDecimals: number
): TransactionInstruction {
  // Convert amounts to smallest unit
  const totalAmountBN = new BN(Math.floor(params.totalAmount * Math.pow(10, inputDecimals)));
  const amountPerTradeBN = new BN(Math.floor(params.amountPerTrade * Math.pow(10, inputDecimals)));
  
  // Build instruction data
  // Layout: discriminator (8) + total_amount (8) + amount_per_trade (8) + variance_bps (2) + min_exec (1) + max_exec (1) + window_start (1) + window_end (1)
  const data = Buffer.alloc(8 + 8 + 8 + 2 + 1 + 1 + 1 + 1);
  let offset = 0;
  
  // Discriminator
  DISCRIMINATORS.initializeDca.copy(data, offset);
  offset += 8;
  
  // total_amount (u64 LE)
  data.writeBigUInt64LE(BigInt(totalAmountBN.toString()), offset);
  offset += 8;
  
  // amount_per_trade (u64 LE)
  data.writeBigUInt64LE(BigInt(amountPerTradeBN.toString()), offset);
  offset += 8;
  
  // variance_bps (u16 LE)
  data.writeUInt16LE(params.varianceBps, offset);
  offset += 2;
  
  // min_executions (u8)
  data.writeUInt8(params.minExecutions, offset);
  offset += 1;
  
  // max_executions (u8)
  data.writeUInt8(params.maxExecutions, offset);
  offset += 1;
  
  // window_start_hour (u8)
  data.writeUInt8(params.windowStartHour, offset);
  offset += 1;
  
  // window_end_hour (u8)
  data.writeUInt8(params.windowEndHour, offset);
  
  return new TransactionInstruction({
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: dcaVault, isSigner: false, isWritable: true },
      { pubkey: inputMint, isSigner: false, isWritable: false },
      { pubkey: outputMint, isSigner: false, isWritable: false },
      { pubkey: userInputToken, isSigner: false, isWritable: true },
      { pubkey: vaultInputToken, isSigner: false, isWritable: true },
      { pubkey: vaultOutputToken, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    programId: KRYPTOS_PROGRAM_ID,
    data,
  });
}

function buildWithdrawDcaInstruction(
  authority: PublicKey,
  dcaVault: PublicKey,
  vaultInputToken: PublicKey,
  vaultOutputToken: PublicKey,
  userInputToken: PublicKey,
  userOutputToken: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: dcaVault, isSigner: false, isWritable: true },
      { pubkey: vaultInputToken, isSigner: false, isWritable: true },
      { pubkey: vaultOutputToken, isSigner: false, isWritable: true },
      { pubkey: userInputToken, isSigner: false, isWritable: true },
      { pubkey: userOutputToken, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: KRYPTOS_PROGRAM_ID,
    data: DISCRIMINATORS.withdrawDca,
  });
}

function buildCloseDcaInstruction(
  authority: PublicKey,
  dcaVault: PublicKey,
  vaultInputToken: PublicKey,
  vaultOutputToken: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: dcaVault, isSigner: false, isWritable: true },
      { pubkey: vaultInputToken, isSigner: false, isWritable: true },
      { pubkey: vaultOutputToken, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: KRYPTOS_PROGRAM_ID,
    data: DISCRIMINATORS.closeDca,
  });
}

// ============================================================================
// HIGH-LEVEL FUNCTIONS
// ============================================================================

/**
 * Create a new DCA vault
 */
export async function createDcaVault(
  connection: Connection,
  wallet: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
  inputMint: PublicKey,
  outputMint: PublicKey,
  params: DcaParams,
  inputDecimals: number
): Promise<CreateDcaResult> {
  try {
    const authority = wallet.publicKey;
    
    // Derive PDAs
    const [dcaVault] = getDcaVaultPda(authority, inputMint, outputMint);
    const [vaultInputToken] = getInputVaultPda(dcaVault);
    const [vaultOutputToken] = getOutputVaultPda(dcaVault);
    
    // Get user's input token account
    const userInputToken = await getAssociatedTokenAddress(inputMint, authority);
    
    // Build instruction
    const instruction = buildInitializeDcaInstruction(
      authority,
      dcaVault,
      inputMint,
      outputMint,
      userInputToken,
      vaultInputToken,
      vaultOutputToken,
      params,
      inputDecimals
    );
    
    // Build transaction
    const tx = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = authority;
    
    // Sign and send
    const signedTx = await wallet.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(signature, 'confirmed');
    
    return {
      success: true,
      signature,
      vaultAddress: dcaVault.toBase58(),
    };
  } catch (error: any) {
    console.error('Create DCA error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Withdraw funds from DCA vault
 */
export async function withdrawDca(
  connection: Connection,
  wallet: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
  inputMint: PublicKey,
  outputMint: PublicKey
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const authority = wallet.publicKey;
    
    // Derive PDAs
    const [dcaVault] = getDcaVaultPda(authority, inputMint, outputMint);
    const [vaultInputToken] = getInputVaultPda(dcaVault);
    const [vaultOutputToken] = getOutputVaultPda(dcaVault);
    
    // Get user's token accounts
    const userInputToken = await getAssociatedTokenAddress(inputMint, authority);
    const userOutputToken = await getAssociatedTokenAddress(outputMint, authority);
    
    // Build instruction
    const instruction = buildWithdrawDcaInstruction(
      authority,
      dcaVault,
      vaultInputToken,
      vaultOutputToken,
      userInputToken,
      userOutputToken
    );
    
    // Build transaction
    const tx = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = authority;
    
    // Sign and send
    const signedTx = await wallet.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(signature, 'confirmed');
    
    return { success: true, signature };
  } catch (error: any) {
    console.error('Withdraw DCA error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Close DCA vault (must withdraw first)
 */
export async function closeDca(
  connection: Connection,
  wallet: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
  inputMint: PublicKey,
  outputMint: PublicKey
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const authority = wallet.publicKey;
    
    // Derive PDAs
    const [dcaVault] = getDcaVaultPda(authority, inputMint, outputMint);
    const [vaultInputToken] = getInputVaultPda(dcaVault);
    const [vaultOutputToken] = getOutputVaultPda(dcaVault);
    
    // Build instruction
    const instruction = buildCloseDcaInstruction(
      authority,
      dcaVault,
      vaultInputToken,
      vaultOutputToken
    );
    
    // Build transaction
    const tx = new Transaction().add(instruction);
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = authority;
    
    // Sign and send
    const signedTx = await wallet.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction(signature, 'confirmed');
    
    return { success: true, signature };
  } catch (error: any) {
    console.error('Close DCA error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Fetch DCA vault info
 */
export async function getDcaVaultInfo(
  connection: Connection,
  authority: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  inputDecimals: number = 6,
  outputDecimals: number = 9
): Promise<DcaVaultInfo | null> {
  try {
    const [dcaVault] = getDcaVaultPda(authority, inputMint, outputMint);
    
    const accountInfo = await connection.getAccountInfo(dcaVault);
    if (!accountInfo) return null;
    
    const data = accountInfo.data;
    
    // Skip discriminator (8 bytes)
    let offset = 8;
    
    // Parse fields according to DcaVault struct
    const authorityPk = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    const inputMintPk = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    const outputMintPk = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    const inputVaultPk = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    const outputVaultPk = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;
    
    const totalAmount = Number(data.readBigUInt64LE(offset)) / Math.pow(10, inputDecimals);
    offset += 8;
    
    const amountPerTrade = Number(data.readBigUInt64LE(offset)) / Math.pow(10, inputDecimals);
    offset += 8;
    
    const varianceBps = data.readUInt16LE(offset);
    offset += 2;
    
    const minExecutions = data.readUInt8(offset);
    offset += 1;
    
    const maxExecutions = data.readUInt8(offset);
    offset += 1;
    
    const windowStartHour = data.readUInt8(offset);
    offset += 1;
    
    const windowEndHour = data.readUInt8(offset);
    offset += 1;
    
    const totalSpent = Number(data.readBigUInt64LE(offset)) / Math.pow(10, inputDecimals);
    offset += 8;
    
    const totalReceived = Number(data.readBigUInt64LE(offset)) / Math.pow(10, outputDecimals);
    offset += 8;
    
    const executionCount = data.readUInt32LE(offset);
    offset += 4;
    
    const lastExecutionTs = Number(data.readBigInt64LE(offset));
    offset += 8;
    
    const nextExecutionTs = Number(data.readBigInt64LE(offset));
    offset += 8;
    
    const isActive = data.readUInt8(offset) === 1;
    offset += 1;
    
    const createdAtTs = Number(data.readBigInt64LE(offset));
    
    return {
      address: dcaVault,
      authority: authorityPk,
      inputMint: inputMintPk,
      outputMint: outputMintPk,
      totalAmount,
      amountPerTrade,
      varianceBps,
      minExecutions,
      maxExecutions,
      windowStartHour,
      windowEndHour,
      totalSpent,
      totalReceived,
      executionCount,
      lastExecution: lastExecutionTs > 0 ? new Date(lastExecutionTs * 1000) : null,
      nextExecution: nextExecutionTs > 0 ? new Date(nextExecutionTs * 1000) : null,
      isActive,
      createdAt: new Date(createdAtTs * 1000),
    };
  } catch (error) {
    console.error('Get DCA vault info error:', error);
    return null;
  }
}

/**
 * Get all DCA vaults for a user
 * Note: This requires fetching all program accounts which can be slow
 */
export async function getUserDcaVaults(
  connection: Connection,
  authority: PublicKey
): Promise<DcaVaultInfo[]> {
  try {
    const accounts = await connection.getProgramAccounts(KRYPTOS_PROGRAM_ID, {
      filters: [
        // Filter by discriminator for DcaVault
        {
          memcmp: {
            offset: 0,
            bytes: Buffer.from([78, 168, 169, 28, 73, 18, 143, 249]).toString('base64'),
          },
        },
        // Filter by authority
        {
          memcmp: {
            offset: 8, // After discriminator
            bytes: authority.toBase58(),
          },
        },
      ],
    });
    
    const vaults: DcaVaultInfo[] = [];
    
    for (const { pubkey, account } of accounts) {
      const data = account.data;
      let offset = 8; // Skip discriminator
      
      // Parse minimal info
      const authorityPk = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      const inputMintPk = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      const outputMintPk = new PublicKey(data.slice(offset, offset + 32));
      offset += 32;
      
      offset += 32; // input_vault
      offset += 32; // output_vault
      
      const totalAmount = Number(data.readBigUInt64LE(offset));
      offset += 8;
      
      const amountPerTrade = Number(data.readBigUInt64LE(offset));
      offset += 8;
      
      const varianceBps = data.readUInt16LE(offset);
      offset += 2;
      
      const minExecutions = data.readUInt8(offset);
      offset += 1;
      
      const maxExecutions = data.readUInt8(offset);
      offset += 1;
      
      const windowStartHour = data.readUInt8(offset);
      offset += 1;
      
      const windowEndHour = data.readUInt8(offset);
      offset += 1;
      
      const totalSpent = Number(data.readBigUInt64LE(offset));
      offset += 8;
      
      const totalReceived = Number(data.readBigUInt64LE(offset));
      offset += 8;
      
      const executionCount = data.readUInt32LE(offset);
      offset += 4;
      
      const lastExecutionTs = Number(data.readBigInt64LE(offset));
      offset += 8;
      
      const nextExecutionTs = Number(data.readBigInt64LE(offset));
      offset += 8;
      
      const isActive = data.readUInt8(offset) === 1;
      offset += 1;
      
      const createdAtTs = Number(data.readBigInt64LE(offset));
      
      vaults.push({
        address: pubkey,
        authority: authorityPk,
        inputMint: inputMintPk,
        outputMint: outputMintPk,
        totalAmount: totalAmount / 1e6, // Assume 6 decimals, adjust as needed
        amountPerTrade: amountPerTrade / 1e6,
        varianceBps,
        minExecutions,
        maxExecutions,
        windowStartHour,
        windowEndHour,
        totalSpent: totalSpent / 1e6,
        totalReceived: totalReceived / 1e9, // Assume 9 decimals for output
        executionCount,
        lastExecution: lastExecutionTs > 0 ? new Date(lastExecutionTs * 1000) : null,
        nextExecution: nextExecutionTs > 0 ? new Date(nextExecutionTs * 1000) : null,
        isActive,
        createdAt: new Date(createdAtTs * 1000),
      });
    }
    
    return vaults;
  } catch (error) {
    console.error('Get user DCA vaults error:', error);
    return [];
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate recommended DCA params based on user input
 */
export function calculateDcaParams(
  totalAmount: number,
  frequency: 'daily' | 'weekly' | 'hourly',
  durationWeeks: number = 4
): DcaParams {
  // Calculate executions per week based on frequency
  let minExec: number;
  let maxExec: number;
  let amountPerTrade: number;
  
  switch (frequency) {
    case 'hourly':
      minExec = 100;
      maxExec = 168; // 24 * 7
      amountPerTrade = totalAmount / (durationWeeks * 100);
      break;
    case 'daily':
      minExec = 5;
      maxExec = 10;
      amountPerTrade = totalAmount / (durationWeeks * 7);
      break;
    case 'weekly':
      minExec = 1;
      maxExec = 2;
      amountPerTrade = totalAmount / durationWeeks;
      break;
    default:
      minExec = 5;
      maxExec = 10;
      amountPerTrade = totalAmount / (durationWeeks * 7);
  }
  
  return {
    totalAmount,
    amountPerTrade,
    varianceBps: 2000, // 20% variance for privacy
    minExecutions: minExec,
    maxExecutions: maxExec,
    windowStartHour: 0,  // Execute any time
    windowEndHour: 23,
  };
}

/**
 * Format vault info for display
 */
export function formatDcaVaultInfo(vault: DcaVaultInfo, inputSymbol: string, outputSymbol: string): string {
  const progress = vault.totalAmount > 0 
    ? ((vault.totalSpent / vault.totalAmount) * 100).toFixed(1) 
    : '0';
  
  let status = vault.isActive ? '🟢 Active' : '⚪ Inactive';
  
  let info = `📊 **DCA Vault**\n\n`;
  info += `**Status:** ${status}\n`;
  info += `**Progress:** ${progress}% (${vault.executionCount} executions)\n\n`;
  info += `**Total:** ${vault.totalAmount} ${inputSymbol}\n`;
  info += `**Per Trade:** ~${vault.amountPerTrade} ${inputSymbol} (±${vault.varianceBps / 100}%)\n`;
  info += `**Spent:** ${vault.totalSpent.toFixed(4)} ${inputSymbol}\n`;
  info += `**Received:** ${vault.totalReceived.toFixed(4)} ${outputSymbol}\n\n`;
  info += `**Execution Window:** ${vault.windowStartHour}:00 - ${vault.windowEndHour}:00 UTC\n`;
  info += `**Executions/Week:** ${vault.minExecutions}-${vault.maxExecutions}\n`;
  
  if (vault.nextExecution) {
    info += `\n**Next Execution:** ~${vault.nextExecution.toLocaleString()}\n`;
  }
  
  return info;
}