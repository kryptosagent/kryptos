import { NextRequest, NextResponse } from 'next/server';
import { Keypair, VersionedTransaction, Transaction, Connection } from '@solana/web3.js';

export const runtime = 'nodejs';

// Use Helius RPC with API key
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';
const RPC_URL = HELIUS_API_KEY 
  ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
  : 'https://api.mainnet-beta.solana.com';

const FEE_PAYER_PRIVATE_KEY = process.env.FEE_PAYER_PRIVATE_KEY!;
const FEE_PAYER_ADDRESS = process.env.FEE_PAYER_ADDRESS!;

const connection = new Connection(RPC_URL, 'confirmed');

// Decode base58 without bs58 library
function decodeBase58(str: string): Uint8Array {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes: number[] = [0];
  for (const char of str) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) throw new Error('Invalid base58 character');
    for (let i = 0; i < bytes.length; i++) bytes[i] *= 58;
    bytes[0] += value;
    let carry = 0;
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] += carry;
      carry = Math.floor(bytes[i] / 256);
      bytes[i] %= 256;
    }
    while (carry > 0) {
      bytes.push(carry % 256);
      carry = Math.floor(carry / 256);
    }
  }
  for (const char of str) {
    if (char !== '1') break;
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

export async function POST(req: NextRequest) {
  try {
    const { transactionBase64 } = await req.json();

    if (!transactionBase64) {
      return NextResponse.json({ error: 'Missing transaction data' }, { status: 400 });
    }

    // Initialize fee payer keypair
    const feePayerWallet = Keypair.fromSecretKey(decodeBase58(FEE_PAYER_PRIVATE_KEY));

    // Deserialize the transaction
    const transactionBuffer = Buffer.from(transactionBase64, 'base64');
    
    let transaction: VersionedTransaction | Transaction;
    let isVersioned = false;
    
    try {
      transaction = VersionedTransaction.deserialize(transactionBuffer);
      isVersioned = true;
    } catch {
      transaction = Transaction.from(transactionBuffer);
    }

    // Verify fee payer
    if (isVersioned) {
      const vTx = transaction as VersionedTransaction;
      const accountKeys = vTx.message.getAccountKeys();
      const feePayer = accountKeys.get(0);
      
      if (!feePayer || feePayer.toBase58() !== FEE_PAYER_ADDRESS) {
        console.error('Fee payer mismatch:', feePayer?.toBase58(), 'expected:', FEE_PAYER_ADDRESS);
        return NextResponse.json({ error: 'Invalid fee payer in transaction' }, { status: 403 });
      }
      
      // Sign with fee payer
      vTx.sign([feePayerWallet]);
      
      // Send transaction
      const signature = await connection.sendRawTransaction(vTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      
      await connection.confirmTransaction(signature, 'confirmed');
      return NextResponse.json({ signature });
    } else {
      const legacyTx = transaction as Transaction;
      
      if (legacyTx.feePayer?.toBase58() !== FEE_PAYER_ADDRESS) {
        return NextResponse.json({ error: 'Invalid fee payer in transaction' }, { status: 403 });
      }
      
      // Sign with fee payer
      legacyTx.partialSign(feePayerWallet);
      
      // Send transaction
      const signature = await connection.sendRawTransaction(legacyTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });
      
      await connection.confirmTransaction(signature, 'confirmed');
      return NextResponse.json({ signature });
    }
  } catch (error: any) {
    console.error('Sponsor transaction error:', error);
    return NextResponse.json(
      { error: error?.message ?? 'Failed to sponsor transaction' },
      { status: 500 }
    );
  }
}
