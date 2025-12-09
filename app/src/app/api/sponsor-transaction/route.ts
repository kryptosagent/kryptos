import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/node';

export const runtime = 'nodejs';

const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID!,
  appSecret: process.env.PRIVY_APP_SECRET!,
});

type SignAndSendSolanaRpcBody = {
  method: 'signAndSendTransaction';
  caip2: typeof SOLANA_MAINNET_CAIP2;
  params: {
    transaction: string;
    encoding: 'base64';
    sponsor?: boolean;
  };
  authorization_context?: {
    user_jwts: string[];
  };
};

type SignAndSendSolanaRpcResponse = {
  method: 'signAndSendTransaction';
  data: {
    hash: string;
    caip2: string;
    transaction_id?: string;
  };
};

function getBearer(req: NextRequest) {
  const h = req.headers.get('authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1];
}

export async function POST(req: NextRequest) {
  try {
    const userJwt = getBearer(req);
    if (!userJwt) {
      return NextResponse.json(
        { error: 'Missing Authorization Bearer token' },
        { status: 401 }
      );
    }

    const { walletId, transactionBase64 } = await req.json();

    if (!walletId || !transactionBase64) {
      return NextResponse.json(
        { error: 'Missing walletId/transactionBase64' },
        { status: 400 }
      );
    }

    const body: SignAndSendSolanaRpcBody = {
      method: 'signAndSendTransaction',
      caip2: SOLANA_MAINNET_CAIP2,
      params: {
        transaction: transactionBase64,
        encoding: 'base64',
        sponsor: true,
      },
      authorization_context: {
        user_jwts: [userJwt],
      },
    };

    const res = (await (privy as any).wallets().rpc(
      walletId,
      body
    )) as unknown as SignAndSendSolanaRpcResponse;

    return NextResponse.json({ signature: res.data.hash });
  } catch (err: any) {
    console.error('Sponsor transaction error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to sponsor transaction' },
      { status: 500 }
    );
  }
}