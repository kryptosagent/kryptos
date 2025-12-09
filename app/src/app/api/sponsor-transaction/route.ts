import { NextRequest, NextResponse } from 'next/server';
import { PrivyClient } from '@privy-io/node';

export const runtime = 'nodejs';

const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

const privy = new PrivyClient({
  appId: process.env.PRIVY_APP_ID ?? '',
  appSecret: process.env.PRIVY_APP_SECRET ?? '',
});

const SERVER_WALLET_ID = process.env.PRIVY_SERVER_WALLET_ID;

type SignAndSendSolanaRpcBody = {
  method: 'signAndSendTransaction';
  caip2: typeof SOLANA_MAINNET_CAIP2;
  params: {
    transaction: string;
    encoding: 'base64';
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
    if (!process.env.PRIVY_APP_ID || !process.env.PRIVY_APP_SECRET) {
      return NextResponse.json(
        { error: 'Missing PRIVY_APP_ID/PRIVY_APP_SECRET env vars' },
        { status: 500 }
      );
    }

    if (!SERVER_WALLET_ID) {
      return NextResponse.json(
        { error: 'Missing PRIVY_SERVER_WALLET_ID env var' },
        { status: 500 }
      );
    }

    const userJwt = getBearer(req);
    if (!userJwt) {
      return NextResponse.json(
        { error: 'Missing Authorization Bearer token' },
        { status: 401 }
      );
    }

    try {
      await privy.utils().auth().verifyAuthToken(userJwt);
    } catch {
      return NextResponse.json(
        { error: 'Invalid Privy access token' },
        { status: 401 }
      );
    }

    const { transactionBase64 } = await req.json();

    if (!transactionBase64) {
      return NextResponse.json(
        { error: 'Missing transactionBase64' },
        { status: 400 }
      );
    }

    const body: SignAndSendSolanaRpcBody = {
      method: 'signAndSendTransaction',
      caip2: SOLANA_MAINNET_CAIP2,
      params: {
        transaction: transactionBase64,
        encoding: 'base64',
      },
    };

    const res = (await (privy as any).wallets().rpc(
      SERVER_WALLET_ID,
      body
    )) as SignAndSendSolanaRpcResponse;

    const hash = res?.data?.hash;
    if (!hash) {
      return NextResponse.json(
        { error: 'No transaction hash returned from Privy' },
        { status: 500 }
      );
    }

    return NextResponse.json({ signature: hash });
  } catch (err: any) {
    console.error('App-managed sponsor error:', err);
    return NextResponse.json(
      { error: err?.message ?? 'Failed to sponsor transaction' },
      { status: 500 }
    );
  }
}
