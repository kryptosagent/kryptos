import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction } from '@solana/spl-token';

const PROGRAM_ID = new PublicKey('CrvSTnNtciVF2q2rRui19WwAdvxpWjK6faRub9xRcesK');

// Instruction discriminators
const CLAIM_DROP_SOL_DISCRIMINATOR = Buffer.from([128, 164, 41, 23, 50, 110, 114, 150]);
const CLAIM_DROP_DISCRIMINATOR = Buffer.from([157, 29, 89, 14, 81, 203, 107, 58]);

export interface DropInfo {
  dropId: string;
  creator: PublicKey;
  tokenMint: PublicKey;
  amount: bigint;
  isNativeSol: boolean;
  isClaimed: boolean;
  claimer: PublicKey | null;
  createdAt: bigint;
  expiresAt: bigint | null;
  claimedAt: bigint | null;
  bump: number;
}

function getEscrowPDA(dropId: string, creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), Buffer.from(dropId), creator.toBuffer()],
    PROGRAM_ID
  );
}

export async function fetchDropInfo(connection: Connection, dropId: string, creator: PublicKey): Promise<DropInfo | null> {
  const [escrowPda] = getEscrowPDA(dropId, creator);

  try {
    const accountInfo = await connection.getAccountInfo(escrowPda);
    if (!accountInfo) return null;

    // Parse account data - skip 8 byte discriminator
    const data = accountInfo.data;
    let offset = 8;

    // drop_id: String (4 byte length + content)
    const dropIdLen = data.readUInt32LE(offset);
    offset += 4;
    const parsedDropId = data.slice(offset, offset + dropIdLen).toString('utf8');
    offset += dropIdLen;

    // creator: Pubkey (32 bytes)
    const creatorPk = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // token_mint: Pubkey (32 bytes)
    const tokenMint = new PublicKey(data.slice(offset, offset + 32));
    offset += 32;

    // amount: u64 (8 bytes)
    const amount = data.readBigUInt64LE(offset);
    offset += 8;

    // is_native_sol: bool (1 byte)
    const isNativeSol = data[offset] === 1;
    offset += 1;

    // is_claimed: bool (1 byte)
    const isClaimed = data[offset] === 1;
    offset += 1;

    // claimer: Option<Pubkey> (1 + 32 bytes)
    const hasClaimer = data[offset] === 1;
    offset += 1;
    let claimer: PublicKey | null = null;
    if (hasClaimer) {
      claimer = new PublicKey(data.slice(offset, offset + 32));
    }
    offset += 32;

    // created_at: i64 (8 bytes)
    const createdAt = data.readBigInt64LE(offset);
    offset += 8;

    // expires_at: Option<i64> (1 + 8 bytes)
    const hasExpiresAt = data[offset] === 1;
    offset += 1;
    let expiresAt: bigint | null = null;
    if (hasExpiresAt) {
      expiresAt = data.readBigInt64LE(offset);
    }
    offset += 8;

    // claimed_at: Option<i64> (1 + 8 bytes)
    const hasClaimedAt = data[offset] === 1;
    offset += 1;
    let claimedAt: bigint | null = null;
    if (hasClaimedAt) {
      claimedAt = data.readBigInt64LE(offset);
    }
    offset += 8;

    // bump: u8 (1 byte)
    const bump = data[offset];

    return {
      dropId: parsedDropId,
      creator: creatorPk,
      tokenMint,
      amount,
      isNativeSol,
      isClaimed,
      claimer,
      createdAt,
      expiresAt,
      claimedAt,
      bump,
    };
  } catch (e) {
    console.error('Error fetching drop:', e);
    return null;
  }
}

export function formatAmount(amount: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  if (fraction === BigInt(0)) return whole.toString();
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fractionStr}`;
}

export function isDropExpired(dropInfo: DropInfo): boolean {
  if (!dropInfo.expiresAt) return false;
  const now = BigInt(Math.floor(Date.now() / 1000));
  return now > dropInfo.expiresAt;
}

export function getTimeUntilExpiry(dropInfo: DropInfo): number | null {
  if (!dropInfo.expiresAt) return null;
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now > dropInfo.expiresAt) return 0;
  return Number(dropInfo.expiresAt - now);
}

export function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export async function buildClaimDropSolTransaction(dropInfo: DropInfo, claimer: PublicKey): Promise<Transaction> {
  const [escrowPda] = getEscrowPDA(dropInfo.dropId, dropInfo.creator);

  const keys = [
    { pubkey: claimer, isSigner: true, isWritable: true },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const instruction = new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data: CLAIM_DROP_SOL_DISCRIMINATOR,
  });

  const transaction = new Transaction();
  transaction.add(instruction);
  return transaction;
}

export async function buildClaimDropTransaction(connection: Connection, dropInfo: DropInfo, claimer: PublicKey): Promise<Transaction> {
  const [escrowPda] = getEscrowPDA(dropInfo.dropId, dropInfo.creator);
  
  // Determine token program
  const mintInfo = await connection.getAccountInfo(dropInfo.tokenMint);
  const tokenProgram = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

  const escrowVault = getAssociatedTokenAddressSync(dropInfo.tokenMint, escrowPda, true, tokenProgram);
  const claimerAta = getAssociatedTokenAddressSync(dropInfo.tokenMint, claimer, false, tokenProgram);

  const transaction = new Transaction();

  // Create claimer ATA if needed
  const claimerAtaInfo = await connection.getAccountInfo(claimerAta);
  if (!claimerAtaInfo) {
    transaction.add(createAssociatedTokenAccountInstruction(claimer, claimerAta, claimer, dropInfo.tokenMint, tokenProgram));
  }

  const keys = [
    { pubkey: claimer, isSigner: true, isWritable: true },
    { pubkey: escrowPda, isSigner: false, isWritable: true },
    { pubkey: dropInfo.tokenMint, isSigner: false, isWritable: false },
    { pubkey: escrowVault, isSigner: false, isWritable: true },
    { pubkey: claimerAta, isSigner: false, isWritable: true },
    { pubkey: tokenProgram, isSigner: false, isWritable: false },
    { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ];

  const instruction = new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data: CLAIM_DROP_DISCRIMINATOR,
  });

  transaction.add(instruction);
  return transaction;
}
