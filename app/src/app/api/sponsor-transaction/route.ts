import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';
import { Transaction, VersionedTransaction } from '@solana/web3.js';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

function decodeTx(base64: string) {
  const bytes = Buffer.from(base64, 'base64');
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { walletId, transactionBase64 } = await req.json();

    if (!walletId || !transactionBase64) {
      return NextResponse.json({ error: 'Missing walletId/transaction' }, { status: 400 });
    }

    const tx = decodeTx(transactionBase64);

    const result = await privy.walletApi.solana.signAndSendTransaction({
      walletId,
      caip2: SOLANA_MAINNET_CAIP2,
      transaction: tx,
      sponsor: true,
    } as any);

    return NextResponse.json({ signature: (result as any).hash });
  } catch (error: any) {
    console.error('Sponsor transaction error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sponsor transaction' },
      { status: 500 }
    );
  }
}