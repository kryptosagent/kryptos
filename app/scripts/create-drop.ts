import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction, TransactionInstruction } from '@solana/web3.js';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROGRAM_ID = new PublicKey('CrvSTnNtciVF2q2rRui19WwAdvxpWjK6faRub9xRcesK');
const RPC_URL = 'https://api.mainnet-beta.solana.com';

function loadWallet(): Keypair {
  const walletPath = process.env.WALLET_PATH || `${process.env.HOME}/.config/solana/mainnet.json`;
  const secretKey = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
  return Keypair.fromSecretKey(Uint8Array.from(secretKey));
}

function generateDropId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function getEscrowPDA(dropId: string, creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), Buffer.from(dropId), creator.toBuffer()],
    PROGRAM_ID
  );
}

// Encode string for Anchor (4 bytes length + string bytes)
function encodeString(str: string): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32LE(str.length, 0);
  return Buffer.concat([len, Buffer.from(str)]);
}

// Encode u64 
function encodeU64(num: bigint): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(num, 0);
  return buf;
}

// Encode Option<i64> - None = [0], Some(val) = [1, ...8 bytes]
function encodeOptionI64(val: bigint | null): Buffer {
  if (val === null) {
    return Buffer.from([0]);
  }
  const buf = Buffer.alloc(9);
  buf.writeUInt8(1, 0);
  buf.writeBigInt64LE(val, 1);
  return buf;
}

async function createSolDrop(amountSol: number, customDropId?: string) {
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = loadWallet();
  
  const dropId = customDropId || generateDropId();
  const [escrowPda, bump] = getEscrowPDA(dropId, wallet.publicKey);
  const amountLamports = BigInt(Math.floor(amountSol * LAMPORTS_PER_SOL));
  
  console.log('Creating SOL drop on MAINNET...');
  console.log('Drop ID:', dropId);
  console.log('Amount:', amountSol, 'SOL');
  console.log('Escrow PDA:', escrowPda.toBase58());
  console.log('Creator:', wallet.publicKey.toBase58());
  
  // Discriminator dari IDL: [161, 227, 56, 52, 15, 30, 227, 170]
  const discriminator = Buffer.from([161, 227, 56, 52, 15, 30, 227, 170]);
  const dropIdData = encodeString(dropId);
  const amountData = encodeU64(amountLamports);
  const expiresAtData = encodeOptionI64(null); // No expiry
  
  const data = Buffer.concat([discriminator, dropIdData, amountData, expiresAtData]);
  
  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: escrowPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: data,
  });
  
  const transaction = new Transaction().add(instruction);
  transaction.feePayer = wallet.publicKey;
  
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  
  transaction.sign(wallet);
  
  const signature = await connection.sendRawTransaction(transaction.serialize());
  await connection.confirmTransaction(signature, 'confirmed');
  
  console.log('\n✅ Drop created successfully!');
  console.log('Transaction:', signature);
  console.log('Solscan:', `https://solscan.io/tx/${signature}`);
  console.log('\n🔗 Claim URL: http://localhost:3000/drop/' + dropId + '_' + wallet.publicKey.toBase58());
}

async function checkDrop(dropId: string) {
  const connection = new Connection(RPC_URL, 'confirmed');
  const wallet = loadWallet();
  const [escrowPda] = getEscrowPDA(dropId, wallet.publicKey);
  
  try {
    const accountInfo = await connection.getAccountInfo(escrowPda);
    if (!accountInfo) {
      console.log('❌ Drop not found');
      return;
    }
    console.log('\n📦 Drop Account Found!');
    console.log('Address:', escrowPda.toBase58());
    console.log('Data length:', accountInfo.data.length, 'bytes');
    console.log('Lamports:', accountInfo.lamports / LAMPORTS_PER_SOL, 'SOL');
  } catch (e) {
    console.log('❌ Error:', e);
  }
}

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'sol':
    const solAmount = parseFloat(args[1]) || 0.001;
    const solDropId = args[2];
    createSolDrop(solAmount, solDropId);
    break;
  case 'check':
    const checkId = args[1];
    if (!checkId) {
      console.log('Usage: npx tsx scripts/create-drop.ts check <dropId>');
      process.exit(1);
    }
    checkDrop(checkId);
    break;
  default:
    console.log(`
KRYPTOS Drop Creator (Mainnet)

Usage:
  npx tsx scripts/create-drop.ts sol <amount> [dropId]
  npx tsx scripts/create-drop.ts check <dropId>

Examples:
  npx tsx scripts/create-drop.ts sol 0.001
  npx tsx scripts/create-drop.ts sol 0.01 my-drop-id
`);
}
