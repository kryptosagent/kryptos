import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/server-auth';

const privy = new PrivyClient(
  process.env.NEXT_PUBLIC_PRIVY_APP_ID!,
  process.env.PRIVY_APP_SECRET!
);

export async function POST(req: NextRequest) {
  try {
    const { transaction, address } = await req.json();
    
    const result = await privy.walletApi.solana.signAndSendTransaction({
      address,
      transaction,
      chainType: 'solana',
      caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      sponsor: true,
    } as any);
    
    return NextResponse.json({ signature: (result as any).hash || (result as any).signature });
  } catch (error: any) {
    console.error('Sponsor transaction error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sponsor transaction' },
      { status: 500 }
    );
  }
}