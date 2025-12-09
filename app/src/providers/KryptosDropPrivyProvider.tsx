'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

const SOLANA_MAINNET_CAIP2 = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY;

export function KryptosDropPrivyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!PRIVY_APP_ID) {
    throw new Error('Missing NEXT_PUBLIC_PRIVY_APP_ID');
  }

  const heliusHttp = HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : 'https://api.mainnet-beta.solana.com';

  const heliusWs = HELIUS_API_KEY
    ? `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
    : 'wss://api.mainnet-beta.solana.com';

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#00FF88',
        },
        loginMethods: ['google', 'twitter', 'email'],
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        solana: {
          rpcs: {
            [SOLANA_MAINNET_CAIP2]: {
              rpc: createSolanaRpc(heliusHttp),
              rpcSubscriptions: createSolanaRpcSubscriptions(heliusWs),
            },
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
