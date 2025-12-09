'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

const HELIUS_API_KEY =
  process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';

export function KryptosDropPrivyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const rpcHttp =
    HELIUS_API_KEY
      ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
      : 'https://api.mainnet-beta.solana.com';

  const rpcWs =
    HELIUS_API_KEY
      ? `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
      : 'wss://api.mainnet-beta.solana.com';

  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ''}
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
            'solana:mainnet': {
              rpc: createSolanaRpc(rpcHttp),
              rpcSubscriptions: createSolanaRpcSubscriptions(rpcWs),
            },
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
