'use client';
import { PrivyProvider } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '60904415-63da-4fca-bdb7-4e2d4c6eade0';

export function KryptosDropPrivyProvider({ children }: { children: React.ReactNode }) {
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
              rpc: createSolanaRpc(
                `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
              ),
              rpcSubscriptions: createSolanaRpcSubscriptions(
                `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
              ),
            },
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
