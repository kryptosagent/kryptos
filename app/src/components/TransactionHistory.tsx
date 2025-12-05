'use client';

import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { 
  History, 
  X, 
  ExternalLink, 
  ArrowRightLeft, 
  Send, 
  ChevronRight,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import { formatAddress } from '@/lib/agent';

// Types
export interface SessionTransaction {
  id: string;
  type: 'swap' | 'transfer' | 'dca';
  status: 'success' | 'failed' | 'pending';
  signature: string;
  timestamp: Date;
  details: {
    fromToken?: string;
    toToken?: string;
    fromAmount?: number;
    toAmount?: number;
    destination?: string;
  };
}

interface HeliusTransaction {
  signature: string;
  timestamp: number;
  type: string;
  description: string;
  fee: number;
  feePayer: string;
  source: string;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number;
  }>;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
    tokenName?: string;
    tokenSymbol?: string;
  }>;
}

interface TransactionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string | null;
  sessionTransactions: SessionTransaction[];
}

// Helius API untuk fetch transactions
const HELIUS_API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || '';

async function fetchRecentTransactions(walletAddress: string): Promise<HeliusTransaction[]> {
  try {
    const response = await fetch(
      `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&limit=20`
    );
    
    if (!response.ok) {
      throw new Error('Failed to fetch transactions');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
}

// Format timestamp
function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

// Transaction item component
function TransactionItem({ 
  type, 
  status, 
  signature, 
  timestamp, 
  description,
  isSession = false 
}: {
  type: string;
  status: 'success' | 'failed' | 'pending';
  signature: string;
  timestamp: Date;
  description: string;
  isSession?: boolean;
}) {
  const getIcon = () => {
    const typeLower = type.toLowerCase();
    if (typeLower.includes('swap')) {
      return <ArrowRightLeft className="w-3 h-3 sm:w-4 sm:h-4" />;
    }
    if (typeLower.includes('transfer') || typeLower.includes('send')) {
      return <Send className="w-3 h-3 sm:w-4 sm:h-4" />;
    }
    if (typeLower.includes('stake')) {
      return <Clock className="w-3 h-3 sm:w-4 sm:h-4" />;
    }
    if (typeLower.includes('nft') || typeLower.includes('mint')) {
      return <CheckCircle2 className="w-3 h-3 sm:w-4 sm:h-4" />;
    }
    if (typeLower.includes('burn') || typeLower.includes('close')) {
      return <XCircle className="w-3 h-3 sm:w-4 sm:h-4" />;
    }
    return <ArrowRightLeft className="w-3 h-3 sm:w-4 sm:h-4" />;
  };
  
  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-3 h-3 text-green-400" />;
      case 'failed':
        return <XCircle className="w-3 h-3 text-red-400" />;
      case 'pending':
        return <Clock className="w-3 h-3 text-yellow-400" />;
    }
  };
  
  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'border-green-500/20 bg-green-500/5';
      case 'failed':
        return 'border-red-500/20 bg-red-500/5';
      case 'pending':
        return 'border-yellow-500/20 bg-yellow-500/5';
    }
  };
  
  return (
    <a
      href={`https://solscan.io/tx/${signature}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`block p-2 sm:p-3 rounded-lg border transition-colors hover:bg-slate-700/50 ${getStatusColor()}`}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        {/* Icon */}
        <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          status === 'success' ? 'bg-green-500/20 text-green-400' :
          status === 'failed' ? 'bg-red-500/20 text-red-400' :
          'bg-yellow-500/20 text-yellow-400'
        }`}>
          {getIcon()}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <span className="font-medium text-white text-xs sm:text-sm capitalize">{type}</span>
            {isSession && (
              <span className="text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded">
                This session
              </span>
            )}
            {getStatusIcon()}
          </div>
          <p className="text-[10px] sm:text-xs text-gray-400 truncate mt-0.5">{description}</p>
          <div className="flex items-center gap-1.5 sm:gap-2 mt-1">
            <span className="text-[9px] sm:text-[10px] text-gray-500">{formatTime(timestamp)}</span>
            <span className="text-[9px] sm:text-[10px] text-gray-600">•</span>
            <span className="text-[9px] sm:text-[10px] text-gray-500 font-mono">{formatAddress(signature, 4)}</span>
          </div>
        </div>
        
        {/* Arrow */}
        <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" />
      </div>
    </a>
  );
}

// Main component
export default function TransactionHistory({ 
  isOpen, 
  onClose, 
  walletAddress,
  sessionTransactions 
}: TransactionHistoryProps) {
  const [heliusTransactions, setHeliusTransactions] = useState<HeliusTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Fetch transactions when wallet changes or sidebar opens
  useEffect(() => {
    if (isOpen && walletAddress) {
      loadTransactions();
    }
  }, [isOpen, walletAddress]);
  
  const loadTransactions = async () => {
    if (!walletAddress) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const txs = await fetchRecentTransactions(walletAddress);
      setHeliusTransactions(txs);
    } catch (err) {
      setError('Failed to load transactions');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Parse Helius transaction to display format
  const parseHeliusTx = (tx: HeliusTransaction) => {
    let type = tx.type || 'Transaction';
    let description = '';
    
    // Map Helius types to readable names
    const typeMap: Record<string, string> = {
      'SWAP': 'Swap',
      'TRANSFER': 'Transfer',
      'UNKNOWN': 'Transaction',
      'NFT_MINT': 'NFT Mint',
      'NFT_SALE': 'NFT Sale',
      'NFT_LISTING': 'NFT Listing',
      'NFT_CANCEL_LISTING': 'NFT Cancel',
      'NFT_BID': 'NFT Bid',
      'BURN': 'Burn',
      'BURN_NFT': 'Burn NFT',
      'STAKE_TOKEN': 'Stake',
      'UNSTAKE_TOKEN': 'Unstake',
      'STAKE_SOL': 'Stake SOL',
      'UNSTAKE_SOL': 'Unstake SOL',
      'COMPRESSED_NFT_MINT': 'cNFT Mint',
      'COMPRESSED_NFT_TRANSFER': 'cNFT Transfer',
      'TOKEN_MINT': 'Token Mint',
      'CREATE_ACCOUNT': 'Create Account',
      'CLOSE_ACCOUNT': 'Close Account',
    };
    
    // Apply type mapping
    if (type.includes('SWAP')) {
      type = 'Swap';
    } else if (typeMap[type]) {
      type = typeMap[type];
    } else {
      // Capitalize and clean up unknown types
      type = type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
    }
    
    // Build description from transfers (prioritize swap detection)
    if (tx.tokenTransfers && tx.tokenTransfers.length >= 2 && type === 'Swap') {
      // Swap: show from → to
      const sent = tx.tokenTransfers.find(t => t.fromUserAccount === tx.feePayer);
      const received = tx.tokenTransfers.find(t => t.toUserAccount === tx.feePayer);
      
      if (sent && received) {
        const sentSymbol = sent.tokenSymbol || 'Token';
        const receivedSymbol = received.tokenSymbol || 'Token';
        const sentAmount = sent.tokenAmount?.toFixed(4) || '?';
        const receivedAmount = received.tokenAmount?.toFixed(4) || '?';
        description = `${sentAmount} ${sentSymbol} → ${receivedAmount} ${receivedSymbol}`;
      }
    }
    
    // If no swap description, try single token transfer
    if (!description && tx.tokenTransfers && tx.tokenTransfers.length > 0) {
      const transfer = tx.tokenTransfers[0];
      const symbol = transfer.tokenSymbol || transfer.tokenName || 'Token';
      const amount = transfer.tokenAmount?.toFixed(4) || '?';
      description = `${amount} ${symbol}`;
    }
    
    // If still no description, try native SOL transfer
    if (!description && tx.nativeTransfers && tx.nativeTransfers.length > 0) {
      const transfer = tx.nativeTransfers[0];
      const solAmount = (transfer.amount / 1e9).toFixed(4);
      description = `${solAmount} SOL`;
    }
    
    // Fallback: use Helius description or generic message
    if (!description) {
      if (tx.description && tx.description !== 'Unknown') {
        // Clean up Helius description
        description = tx.description.length > 50 
          ? tx.description.substring(0, 47) + '...' 
          : tx.description;
      } else {
        description = `${type} transaction`;
      }
    }
    
    return { type, description };
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className={`
        fixed right-0 top-0 h-full w-full sm:w-80 bg-gray-900 border-l border-slate-800 z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
            <h2 className="font-semibold text-white text-sm sm:text-base">Transaction History</h2>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={loadTransactions}
              disabled={isLoading}
              className="p-1.5 sm:p-2 hover:bg-slate-800 rounded-lg transition-colors text-gray-400 hover:text-white disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 hover:bg-slate-800 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="h-[calc(100%-57px)] sm:h-[calc(100%-65px)] overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
          {!walletAddress ? (
            <div className="text-center text-gray-500 py-8 text-sm">
              Connect wallet to view history
            </div>
          ) : (
            <>
              {/* Session Transactions */}
              {sessionTransactions.length > 0 && (
                <div>
                  <h3 className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                    This Session
                  </h3>
                  <div className="space-y-2">
                    {sessionTransactions.map(tx => (
                      <TransactionItem
                        key={tx.id}
                        type={tx.type}
                        status={tx.status}
                        signature={tx.signature}
                        timestamp={tx.timestamp}
                        description={
                          tx.type === 'swap' 
                            ? `${tx.details.fromAmount} ${tx.details.fromToken} → ${tx.details.toAmount?.toFixed(4) || '?'} ${tx.details.toToken}`
                            : tx.type === 'transfer'
                              ? `${tx.details.fromAmount} ${tx.details.fromToken} → ${formatAddress(tx.details.destination || '', 4)}`
                              : `DCA ${tx.details.fromToken} → ${tx.details.toToken}`
                        }
                        isSession
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {/* Blockchain Transactions */}
              <div>
                <h3 className="text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Recent Activity
                </h3>
                
                {isLoading ? (
                  <div className="flex items-center justify-center py-6 sm:py-8">
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-cyan-400" />
                  </div>
                ) : error ? (
                  <div className="text-center text-red-400 py-6 sm:py-8 text-xs sm:text-sm">
                    {error}
                  </div>
                ) : heliusTransactions.length === 0 ? (
                  <div className="text-center text-gray-500 py-6 sm:py-8 text-xs sm:text-sm">
                    No recent transactions
                  </div>
                ) : (
                  <div className="space-y-2">
                    {heliusTransactions.map(tx => {
                      const { type, description } = parseHeliusTx(tx);
                      return (
                        <TransactionItem
                          key={tx.signature}
                          type={type}
                          status="success"
                          signature={tx.signature}
                          timestamp={new Date(tx.timestamp * 1000)}
                          description={description}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}