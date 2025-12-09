'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useCreateWallet } from '@privy-io/react-auth/solana';
import { Connection, PublicKey } from '@solana/web3.js';
import { fetchDropInfo, buildClaimDropTransaction, buildClaimDropSolTransaction, formatAmount, isDropExpired, getTimeUntilExpiry, formatTimeRemaining, DropInfo } from '@/lib/kryptos-drop-sdk';

// SVG Icons
const Icons = {
  drop: (
    <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 2L6 8h3v6h6V8h3L12 2z" />
      <path d="M6 14v4a2 2 0 002 2h8a2 2 0 002-2v-4" />
      <circle cx="8" cy="20" r="1" fill="currentColor" />
      <circle cx="12" cy="22" r="1" fill="currentColor" />
      <circle cx="16" cy="20" r="1" fill="currentColor" />
    </svg>
  ),
  search: (
    <svg className="w-12 h-12 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  ),
  clock: (
    <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  ),
  check: (
    <svg className="w-6 h-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  x: (
    <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  ),
  lock: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  ),
  gift: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="8" width="18" height="14" rx="2" />
      <path d="M12 8v14M3 12h18" />
      <path d="M12 8c-2-2-4-3-4-3s2-3 4-1c2-2 4 1 4 1s-2 1-4 3z" />
    </svg>
  ),
  solana: (
    <svg className="w-10 h-10" viewBox="0 0 128 128" fill="none">
      <defs>
        <linearGradient id="sol-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9945FF" />
          <stop offset="50%" stopColor="#14F195" />
          <stop offset="100%" stopColor="#00D1FF" />
        </linearGradient>
      </defs>
      <path d="M25 98l15-15h63l-15 15H25z" fill="url(#sol-grad)" />
      <path d="M25 30l15 15h63l-15-15H25z" fill="url(#sol-grad)" />
      <path d="M25 64l15-15h63l-15 15H25z" fill="url(#sol-grad)" />
    </svg>
  ),
  token: (
    <svg className="w-10 h-10 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M8 10h8M8 14h8" />
    </svg>
  ),
  spinner: (
    <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
      <path d="M12 2a10 10 0 0110 10" strokeLinecap="round" />
    </svg>
  ),
  external: (
    <svg className="w-4 h-4 inline ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
    </svg>
  ),
};

const TOKEN_METADATA: Record<string, { symbol: string; decimals: number }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', decimals: 9 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', decimals: 6 },
};

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com';

// helpers
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function uint8ToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Type guard untuk linkedAccounts (Solana wallet)
type SolanaLinkedWalletAccount = {
  type: 'wallet';
  chainType: 'solana';
  address: string;
  id: string;
  walletClientType?: string;
};

function isSolanaLinkedWalletAccount(
  account: unknown
): account is SolanaLinkedWalletAccount {
  const a = account as any;
  return (
    a &&
    a.type === 'wallet' &&
    a.chainType === 'solana' &&
    typeof a.address === 'string' &&
    typeof a.id === 'string'
  );
}

type ClaimStatus = 'loading' | 'ready' | 'claiming' | 'success' | 'error' | 'expired' | 'already_claimed' | 'not_found';

export default function DropClaimPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = params.id as string;
  
  // Support both formats: /drop/dropId?c=creator and /drop/dropId_creator
  let dropId: string;
  let creatorParam: string | null;
  
  if (rawId.includes('_')) {
    const parts = rawId.split('_');
    dropId = parts[0];
    creatorParam = parts[1];
  } else {
    dropId = rawId;
    creatorParam = searchParams.get('c');
  }

  const { login, authenticated, user, getAccessToken } = usePrivy();
  const { wallets: solanaWallets } = useWallets();
  const { createWallet } = useCreateWallet();

  const [dropInfo, setDropInfo] = useState<DropInfo | null>(null);
  const [status, setStatus] = useState<ClaimStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  const connection = new Connection(RPC_URL, 'confirmed');

  const fetchDrop = useCallback(async () => {
    if (!dropId || !creatorParam) {
      setStatus('not_found');
      setError('Invalid drop link');
      return;
    }
    setStatus('loading');
    try {
      const creatorPubkey = new PublicKey(creatorParam);
      const info = await fetchDropInfo(connection, dropId, creatorPubkey);
      if (!info) { setStatus('not_found'); return; }
      setDropInfo(info);
      if (info.isClaimed) setStatus('already_claimed');
      else if (isDropExpired(info)) setStatus('expired');
      else setStatus('ready');
    } catch (err) {
      setStatus('error');
      setError('Failed to load drop');
    }
  }, [dropId, creatorParam]);

  useEffect(() => { fetchDrop(); }, [fetchDrop]);

  useEffect(() => {
    if (!dropInfo?.expiresAt) return;
    const updateTime = () => {
      const remaining = getTimeUntilExpiry(dropInfo);
      if (remaining !== null) {
        setTimeRemaining(formatTimeRemaining(remaining));
        if (remaining <= 0 && status === 'ready') setStatus('expired');
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [dropInfo, status]);

  const getTokenInfo = () => {
    if (!dropInfo) return { symbol: 'TOKEN', decimals: 9 };
    if (dropInfo.isNativeSol) return TOKEN_METADATA['So11111111111111111111111111111111111111112'];
    return TOKEN_METADATA[dropInfo.tokenMint.toBase58()] || { symbol: 'TOKEN', decimals: 9 };
  };

  const handleClaim = async () => {
    if (!dropInfo) return;

    if (!authenticated) {
      setError('Please sign in to claim.');
      setStatus('ready');
      return;
    }

    setStatus('claiming');
    setError(null);

    try {
    // 1) Prefer embedded wallet for gas sponsorship
        const pickEmbedded = (ws: any[]) =>
          ws.find(w => {
            const clientType = String(w?.walletClientType ?? '').toLowerCase();
            return (
              clientType.includes('privy') ||          // ✅ lebih fleksibel
              w?.connectorType === 'embedded' ||
              w?.isEmbedded === true
            );
          });

        let solanaWallet: any =
      pickEmbedded(solanaWallets as any);

    // 2) If none, create embedded wallet
    if (!solanaWallet) {
      try {
        await createWallet();
      } catch (e: any) {
        const msg = String(e?.message ?? '').toLowerCase();
        if (!msg.includes('already has an embedded wallet')) {
          throw e;
        }
      }

      await sleep(800);
      solanaWallet = pickEmbedded(solanaWallets as any);
    }

    // 3) Fallback from linkedAccounts if hook still empty (type-safe)
      const solanaWalletAccount =
        (user?.linkedAccounts ?? []).find(isSolanaLinkedWalletAccount) as
          | SolanaLinkedWalletAccount
          | undefined;

      if (!solanaWallet && solanaWalletAccount?.address) {
        solanaWallet = {
          address: solanaWalletAccount.address,
          id: solanaWalletAccount.id,
          walletClientType: solanaWalletAccount.walletClientType,
        };
      }


      if (!solanaWallet) {
        throw new Error(
          'Embedded wallet not found. Please try again or re-login.'
        );
      }


      if (!solanaWallet?.address) {
        throw new Error('No Solana wallet available. Please try again.');
      }

      // 4) Enforce embedded wallet for sponsorship
      const clientType = String(solanaWallet?.walletClientType ?? '').toLowerCase();

      const isEmbedded =
        clientType.includes('privy') ||
        solanaWallet?.connectorType === 'embedded' ||
        solanaWallet?.isEmbedded === true;

      if (!isEmbedded) {
        throw new Error(
          'Gas sponsorship only works with embedded wallets. Please use the embedded wallet to claim.'
        );
      }

      // 5) Get walletId (source of truth: wallet object)
      const walletId =
        solanaWallet?.id ||
        solanaWalletAccount?.id;

      if (!walletId) {
        throw new Error(
          'Wallet ID not found. Please re-login or re-create embedded wallet.'
        );
      }

      const claimerPubkey = new PublicKey(solanaWallet.address);

      // 6) Build transaction
      const transaction = dropInfo.isNativeSol
        ? await buildClaimDropSolTransaction(dropInfo, claimerPubkey)
        : await buildClaimDropTransaction(connection, dropInfo, claimerPubkey);

      // 7) Set blockhash + fee payer (Privy may override fee payer for sponsorship)
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = claimerPubkey;

      // 8) Serialize
      const serializedTx = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      // 9) Safe base64 for browser
      const transactionBase64 = uint8ToBase64(serializedTx);

      // 10) Get Privy access token
      const accessToken = await getAccessToken();

      if (!accessToken || accessToken.split('.').length !== 3) {
        throw new Error('Invalid access token. Please re-login.');
      }

      const response = await fetch('/api/sponsor-transaction', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          walletId,
          transactionBase64,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send transaction');
      }

      setTxSignature(result.signature);
      setStatus('success');
    } catch (err: any) {
      console.error('Claim error:', err);
      setStatus('error');
      setError(err.message || 'Failed to claim');
    }
  };


  const tokenInfo = getTokenInfo();
  const formattedAmount = dropInfo ? formatAmount(dropInfo.amount, tokenInfo.decimals) : '0';

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-2 border-zinc-700 border-t-white rounded-full"></div>
      </div>
    );
  }

  if (status === 'not_found') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-2xl p-8 max-w-md w-full text-center border border-zinc-800">
          <div className="flex justify-center mb-4">{Icons.search}</div>
          <h1 className="text-xl font-semibold text-white mb-2">Drop Not Found</h1>
          <p className="text-zinc-500 text-sm">{error || 'This link is invalid or has expired'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-2xl p-8 max-w-md w-full border border-zinc-800">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">{Icons.drop}</div>
          <h1 className="text-xl font-semibold text-white mb-1">KRYPTOS Drop</h1>
          <p className="text-zinc-500 text-sm">Someone sent you crypto</p>
        </div>

        <div className="bg-zinc-950 rounded-xl p-6 mb-6 text-center border border-zinc-800">
          <div className="flex justify-center mb-3">
            {dropInfo?.isNativeSol ? Icons.solana : Icons.token}
          </div>
          <div className="text-3xl font-bold text-white">{formattedAmount} {tokenInfo.symbol}</div>
        </div>
        {timeRemaining && status === 'ready' && (
          <div className="flex items-center justify-center gap-2 text-zinc-400 text-sm mb-6">
            {Icons.clock}
            <span>{timeRemaining}</span>
          </div>
        )}

        {status === 'expired' && (
          <div className="flex items-center justify-center gap-2 p-4 mb-6 bg-zinc-950 rounded-lg border border-zinc-800">
            {Icons.x}
            <span className="text-zinc-400">This drop has expired</span>
          </div>
        )}

        {status === 'already_claimed' && (
          <div className="flex items-center justify-center gap-2 p-4 mb-6 bg-zinc-950 rounded-lg border border-zinc-800">
            {Icons.check}
            <span className="text-zinc-400">Already claimed</span>
          </div>
        )}

        {status === 'success' && (
          <div className="p-4 mb-6 bg-zinc-950 rounded-lg border border-emerald-900 text-center">
            <div className="flex justify-center mb-2">{Icons.check}</div>
            <p className="text-white font-medium mb-1">Claimed successfully</p>
            <p className="text-zinc-500 text-sm mb-3">{formattedAmount} {tokenInfo.symbol} received</p>
            {txSignature && (
              <a 
                href={`https://solscan.io/tx/${txSignature}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-white text-sm transition-colors"
              >
                View on Solscan {Icons.external}
              </a>
            )}
          </div>
        )}

        {status === 'error' && error && (
          <div className="flex items-center justify-center gap-2 p-4 mb-6 bg-zinc-950 rounded-lg border border-red-900/50">
            {Icons.x}
            <span className="text-zinc-400 text-sm">{error}</span>
          </div>
        )}

        {status === 'ready' && !authenticated && (
          <button 
            onClick={login} 
            className="w-full bg-white hover:bg-zinc-100 text-black font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {Icons.lock}
            Sign in to Claim
          </button>
        )}

        {status === 'ready' && authenticated && (
          <button 
            onClick={handleClaim} 
            className="w-full bg-white hover:bg-zinc-100 text-black font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {Icons.gift}
            Claim {formattedAmount} {tokenInfo.symbol}
          </button>
        )}

        {status === 'claiming' && (
          <button 
            disabled 
            className="w-full bg-zinc-800 text-zinc-400 font-medium py-3 px-6 rounded-lg flex items-center justify-center gap-2 cursor-not-allowed"
          >
            {Icons.spinner}
            Claiming...
          </button>
        )}

        {authenticated && user && (
          <div className="mt-6 pt-6 border-t border-zinc-800 text-center">
            <p className="text-zinc-500 text-sm">
              Signed in as <span className="text-zinc-300">{user.email?.address || user.google?.email || 'User'}</span>
            </p>
          </div>
        )}

        <div className="mt-8 text-center">
          <a 
            href="https://kryptosagent.xyz" 
            className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
          >
            Powered by KRYPTOS
          </a>
        </div>
      </div>
    </div>
  );
}
