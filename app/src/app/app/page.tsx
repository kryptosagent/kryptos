'use client';

import { useState, useRef, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { 
  createDcaVault, 
  withdrawDcaVault,
  closeDcaVault,
  getDcaVaultInfo,
  createLimitOrder,
  withdrawIntent,
  closeIntent,
  getUserIntentVaults,
  TriggerType,
  IntentStatus,
  IntentVaultInfo
} from '@/lib/kryptos-contract';
import { createDrop } from '@/lib/kryptos-drop';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { 
  Shield, 
  Send, 
  Bot, 
  User, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Sparkles,
  AlertTriangle,
  ExternalLink,
  Info,
  History
} from 'lucide-react';
import TransactionHistory, { SessionTransaction } from '@/components/TransactionHistory';
import { 
  parseCommand, 
  executeSwap, 
  executeTransfer,
  executeBurn,
  getBalances, 
  getTokenPrice, 
  getSwapOrder,
  getTokenInfo,
  searchToken,
  getTokenShield,
  formatAddress,
  getSupportedTokensHelp,
  getHelpMessage,
  TOKEN_SHORTCUTS,
  resolveToken,
  isValidAddress,  // ADD THIS
  ParsedCommand,
  TokenInfo
} from '@/lib/agent';
import { parseWithLLM } from '@/lib/llm';
import Link from 'next/link';

// RWA imports
import {
  getRWAWithData,
  buildRWAPortfolio,
  formatRWAInfo,
  formatRWAPortfolio,
  formatYieldProjection,
  estimateYield,
  USDY_MINT,
  getUSDYAPY,
} from '@/lib/rwa';

// Message types
type MessageStatus = 'thinking' | 'confirming' | 'executing' | 'done' | 'error';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  status?: MessageStatus;
  txSignature?: string;
  pendingAction?: {
    command: ParsedCommand;
    fromToken?: TokenInfo;
    toToken?: TokenInfo;
    quote?: {
      inAmount: string;
      outAmount: string;
      priceImpact: string;
      routeLabel?: string;
    };
  };
}

// Format message content with markdown-like syntax
function FormattedMessage({ content }: { content: string }) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const handleCopyLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatText = (text: string) => {
    // Split by markdown patterns AND drop link URLs
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\)|\n|https:\/\/www\.kryptosagent\.xyz\/drop\/[^\s]+)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="bg-zinc-800/50 px-1 md:px-1.5 py-0.5 rounded text-white text-xs md:text-sm font-mono break-all">{part.slice(1, -1)}</code>;
      }
      if (part.match(/\[.*?\]\(.*?\)/)) {
        const match = part.match(/\[(.*?)\]\((.*?)\)/);
        if (match) {
          return (
            <a 
              key={i} 
              href={match[2]} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-white hover:text-zinc-300 underline inline-flex items-center gap-1 text-xs md:text-sm"
            >
              {match[1]}
              <ExternalLink className="w-3 h-3" />
            </a>
          );
        }
      }
      // Drop link - make it clickable to copy
      if (part.startsWith('https://www.kryptosagent.xyz/drop/')) {
        const isCopied = copiedUrl === part;
        return (
          <button
            key={i}
            onClick={() => handleCopyLink(part)}
            className="group relative bg-zinc-800 hover:bg-zinc-700 px-3 py-2 rounded-lg text-left transition-all duration-200 border border-zinc-700 hover:border-zinc-500 block w-full my-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-white text-xs md:text-sm font-mono break-all">{part}</span>
              <span className={`flex-shrink-0 text-xs px-2 py-1 rounded ${isCopied ? 'bg-green-500/20 text-green-400' : 'bg-zinc-600 text-zinc-300 group-hover:bg-zinc-500'}`}>
                {isCopied ? '✓ Copied!' : 'Click to copy'}
              </span>
            </div>
          </button>
        );
      }
      if (part === '\n') {
        return <br key={i} />;
      }
      return part;
    });
  };

  return <div className="whitespace-pre-wrap text-sm md:text-base">{formatText(content)}</div>;
}

// Chat message component
function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex gap-2 md:gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-6 h-6 md:w-8 md:h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-white/10' : 'bg-zinc-800'
      }`}>
        {isUser ? (
          <User className="w-3 h-3 md:w-4 md:h-4 text-white" />
        ) : (
          <Bot className="w-3 h-3 md:w-4 md:h-4 text-zinc-300" />
        )}
      </div>
      
      {/* Message bubble */}
      <div className={`max-w-[85%] md:max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-3 py-2 md:px-4 md:py-3 ${
        isUser 
          ? 'bg-white/10 text-white' 
          : message.status === 'error'
            ? 'bg-red-500/10 border border-red-500/30'
            : 'bg-zinc-900/80 text-zinc-100'
      }`}>
          {/* Status indicator */}
          {message.status === 'thinking' && (
            <div className="flex items-center gap-2 text-zinc-300 mb-2">
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
              <span className="text-xs md:text-sm">Processing...</span>
            </div>
          )}
          {message.status === 'executing' && (
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <Loader2 className="w-3 h-3 md:w-4 md:h-4 animate-spin" />
              <span className="text-xs md:text-sm">Executing transaction...</span>
            </div>
          )}
          
          <FormattedMessage content={message.content} />
          
          {/* Transaction link */}
          {message.txSignature && (
            <a 
              href={`https://solscan.io/tx/${message.txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-white hover:text-zinc-300 text-xs md:text-sm"
            >
              View on Solscan
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          
          {/* Status icons */}
          {message.status === 'done' && (
            <div className="flex items-center gap-1 text-zinc-400 mt-2">
              <CheckCircle2 className="w-3 h-3 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm">Completed</span>
            </div>
          )}
          {message.status === 'error' && (
            <div className="flex items-center gap-1 text-red-400 mt-2">
              <XCircle className="w-3 h-3 md:w-4 md:h-4" />
              <span className="text-xs md:text-sm">Failed</span>
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : ''}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}

// Main page component
export default function Home() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, wallet, connected } = useWallet();
  
  // Get signAndSendTransaction from wallet adapter (Phantom supported)
  const signAndSendTransaction = (wallet?.adapter as any)?.signAndSendTransaction?.bind(wallet?.adapter);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `**Welcome to KRYPTOS**

I'm your private DeFi agent on Solana. All transactions are:
- Stealth-executed
- Timing obfuscated for privacy

**Swap Commands:**
\`Swap 1 SOL to USDC\` - Using token symbol
\`Swap 1 SOL to EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v\` - Using contract address

**Other Commands:**
\`Balance\` - Check holdings
\`Token [address]\` - Lookup token info
\`Help\` - All commands

Connect your wallet to start!`,
      timestamp: new Date(),
    }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [sessionTransactions, setSessionTransactions] = useState<SessionTransaction[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Add message helper - FIXED: correct spread order
  const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      ...message, // Spread AFTER id/timestamp to preserve content
    };
    setMessages(prev => [...prev, newMessage]);
    return newMessage.id;
  };

  // Update message helper
  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(msg => 
      msg.id === id ? { ...msg, ...updates } : msg
    ));
  };

  // Add session transaction
  const addSessionTransaction = (tx: Omit<SessionTransaction, 'id' | 'timestamp'>) => {
    const newTx: SessionTransaction = {
      ...tx,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setSessionTransactions(prev => [newTx, ...prev]);
  };

  // Process user command
  const processCommand = async (command: ParsedCommand, messageId: string) => {
    switch (command.type) {
      case 'swap': {
        const { amount, fromTokenRaw, toTokenRaw, fromMint, toMint } = command.params;
        
        // Validate tokens
        if (!fromMint) {
          updateMessage(messageId, {
            content: `❌ Unknown token: \`${fromTokenRaw}\`\n\n${getSupportedTokensHelp()}`,
            status: 'error',
          });
          return;
        }
        
        if (!toMint) {
          updateMessage(messageId, {
            content: `❌ Unknown token: \`${toTokenRaw}\`\n\n${getSupportedTokensHelp()}`,
            status: 'error',
          });
          return;
        }
        
        // Get token info
        updateMessage(messageId, { content: 'Looking up token info...', status: 'thinking' });
        
        const [fromTokenInfo, toTokenInfo] = await Promise.all([
          getTokenInfo(fromMint),
          getTokenInfo(toMint),
        ]);
        
        if (!fromTokenInfo || !toTokenInfo) {
          updateMessage(messageId, {
            content: `❌ Could not find token info.\n\n**From:** \`${formatAddress(fromMint)}\`\n**To:** \`${formatAddress(toMint)}\``,
            status: 'error',
          });
          return;
        }
        
        // Check token safety via Shield API
        const shieldInfo = await getTokenShield([fromMint, toMint]);
        const hasWarnings = shieldInfo.some(s => s.warnings && s.warnings.length > 0);
        
        // Get quote from Jupiter Ultra
        updateMessage(messageId, { content: 'Getting quote from Jupiter Ultra...', status: 'thinking' });
        
        const orderResult = await getSwapOrder(fromMint, toMint, amount, fromTokenInfo.decimals);
        
        if (!orderResult.success) {
          // Build detailed error message
          let errorMsg = `❌ **Swap not available**\n\n`;
          errorMsg += `**From:** ${fromTokenInfo.symbol} (\`${formatAddress(fromMint)}\`)\n`;
          errorMsg += `**To:** ${toTokenInfo.symbol} (\`${formatAddress(toMint)}\`)\n\n`;
          
          if (orderResult.errorCode) {
            errorMsg += `**Error Code:** ${orderResult.errorCode}\n`;
          }
          
          if (orderResult.errorMessage) {
            errorMsg += `**Reason:** ${orderResult.errorMessage}\n\n`;
          }
          
          // Check if it's a pump.fun token that hasn't graduated
          if (toTokenInfo.launchpad === 'pump.fun' && !toTokenInfo.graduatedPool) {
            errorMsg += `⚠️ **Token still on pump.fun bonding curve**\n`;
            errorMsg += `Jupiter doesn't support this token yet. Wait for token to graduate to Raydium or swap directly on pump.fun.\n`;
          } else if (toTokenInfo.liquidity && toTokenInfo.liquidity < 1000) {
            errorMsg += `⚠️ **Very low liquidity** ($${toTokenInfo.liquidity?.toLocaleString() || '0'})\n`;
            errorMsg += `Token may not have enough liquidity to swap.\n`;
          } else {
            errorMsg += `ℹ️ Jupiter Ultra may not support this pair yet.\n`;
            errorMsg += `Try swapping popular tokens like SOL, USDC, JUP, BONK.\n`;
          }
          
          updateMessage(messageId, { content: errorMsg, status: 'error' });
          return;
        }
        
        // Calculate output amount
        const outAmountNum = parseInt(orderResult.outAmount!) / Math.pow(10, toTokenInfo.decimals);
        
        // Build confirmation message
        let confirmMsg = `🔄 **Swap Preview**\n\n`;
        confirmMsg += `**From:** ${amount} ${fromTokenInfo.symbol}\n`;
        confirmMsg += `\`${formatAddress(fromMint)}\`\n\n`;
        confirmMsg += `**To:** ~${outAmountNum.toFixed(6)} ${toTokenInfo.symbol}\n`;
        confirmMsg += `\`${formatAddress(toMint)}\`\n\n`;
        confirmMsg += `**Route:** ${orderResult.routeLabel || 'Jupiter Ultra'}\n`;
        confirmMsg += `**Slippage:** ${(orderResult.slippageBps || 0) / 100}%\n`;
        confirmMsg += `**Price Impact:** ${orderResult.priceImpact || '0'}%\n`;
        
        if (hasWarnings) {
          confirmMsg += `\n⚠️ **Warning:** Token has safety alerts. Proceed with caution.\n`;
        }
        
        confirmMsg += `\nType **confirm** to execute or **cancel** to abort.`;
        
        updateMessage(messageId, {
          content: confirmMsg,
          status: 'confirming',
          pendingAction: {
            command,
            fromToken: fromTokenInfo,
            toToken: toTokenInfo,
            quote: {
              inAmount: orderResult.inAmount!,
              outAmount: orderResult.outAmount!,
              priceImpact: orderResult.priceImpact || '0',
              routeLabel: orderResult.routeLabel,
            },
          },
        });
        break;
      }
      
      case 'token': {
        const { mint } = command.params;
        
        updateMessage(messageId, { content: 'Looking up token...', status: 'thinking' });
        
        // Search for token info
        const searchResults = await searchToken(mint);
        const tokenInfo = searchResults[0] || await getTokenInfo(mint);
        
        if (!tokenInfo) {
          updateMessage(messageId, {
            content: `❌ Token not found: \`${formatAddress(mint)}\`\n\nPlease verify the contract address is correct.`,
            status: 'error',
          });
          return;
        }
        
        // Get shield info for warnings
        const shieldInfo = await getTokenShield([mint]);
        const warnings = shieldInfo[0]?.warnings || [];
        
        let infoMsg = `**Token Info**\n\n`;
        infoMsg += `**Name:** ${tokenInfo.name}\n`;
        infoMsg += `**Symbol:** ${tokenInfo.symbol}\n`;
        infoMsg += `**Decimals:** ${tokenInfo.decimals}\n`;
        infoMsg += `**Contract:** \`${mint}\`\n\n`;
        
        if (tokenInfo.usdPrice) {
          infoMsg += `**Price:** $${tokenInfo.usdPrice.toFixed(8)}\n`;
        }
        if (tokenInfo.mcap) {
          infoMsg += `**Market Cap:** $${tokenInfo.mcap.toLocaleString()}\n`;
        }
        if (tokenInfo.liquidity) {
          infoMsg += `**Liquidity:** $${tokenInfo.liquidity.toLocaleString()}\n`;
        }
        if (tokenInfo.isVerified !== undefined) {
          infoMsg += `**Verified:** ${tokenInfo.isVerified ? '✅ Yes' : '❌ No'}\n`;
        }
        if (tokenInfo.organicScoreLabel) {
          infoMsg += `**Organic Score:** ${tokenInfo.organicScoreLabel}\n`;
        }
        if (tokenInfo.graduatedPool) {
          infoMsg += `**Graduated:** ✅ (${tokenInfo.graduatedAt || 'Unknown date'})\n`;
        } else if (tokenInfo.launchpad === 'pump.fun') {
          infoMsg += `**Status:** ⏳ On pump.fun bonding curve\n`;
        }
        
        // Safety warnings
        if (tokenInfo.audit?.isSus) {
          infoMsg += `\n⚠️ **Warning:** Token flagged as suspicious!\n`;
        }
        if (!tokenInfo.audit?.mintAuthorityDisabled) {
          infoMsg += `⚠️ Mint authority NOT disabled\n`;
        }
        if (!tokenInfo.audit?.freezeAuthorityDisabled) {
          infoMsg += `⚠️ Freeze authority NOT disabled\n`;
        }
        if (warnings.length > 0) {
          infoMsg += `\n⚠️ **Warnings:** ${warnings.join(', ')}\n`;
        }
        
        infoMsg += `\n[View on Solscan](https://solscan.io/token/${mint})`;
        
        updateMessage(messageId, { content: infoMsg, status: 'done' });
        break;
      }
      
      case 'balance': {
        if (!connected || !publicKey) {
          updateMessage(messageId, {
            content: '❌ Please connect your wallet first.',
            status: 'error',
          });
          return;
        }
        
        updateMessage(messageId, { content: 'Fetching balances...', status: 'thinking' });
        
        const balances = await getBalances(connection, publicKey);
        
        // Get SOL price
        const solPrice = await getTokenPrice('So11111111111111111111111111111111111111112');
        const solValue = solPrice ? balances.sol * solPrice : null;
        
        let balanceMsg = `**Your Balance**\n\n`;
        balanceMsg += `**SOL:** ${balances.sol.toFixed(4)}`;
        if (solValue) {
          balanceMsg += ` (~$${solValue.toFixed(2)})`;
        }
        balanceMsg += `\n`;
        
        if (balances.tokens.length > 0) {
          balanceMsg += `\n**Tokens:**\n`;
          for (const token of balances.tokens.slice(0, 10)) {
            balanceMsg += `• ${token.symbol}: ${token.balance.toFixed(4)}`;
            if (token.usdValue) {
              balanceMsg += ` (~$${token.usdValue.toFixed(2)})`;
            }
            balanceMsg += `\n`;
          }
          if (balances.tokens.length > 10) {
            balanceMsg += `\n... and ${balances.tokens.length - 10} more tokens`;
          }
        } else {
          balanceMsg += `\nNo other tokens found.`;
        }
        
        updateMessage(messageId, { content: balanceMsg, status: 'done' });
        break;
      }
      
      case 'price': {
        const { tokenRaw, mint } = command.params;
        
        if (!mint) {
          updateMessage(messageId, {
            content: `❌ Unknown token: \`${tokenRaw}\`\n\n${getSupportedTokensHelp()}`,
            status: 'error',
          });
          return;
        }
        
        updateMessage(messageId, { content: 'Fetching price...', status: 'thinking' });
        
        const [tokenInfo, price] = await Promise.all([
          getTokenInfo(mint),
          getTokenPrice(mint),
        ]);
        
        if (price === null) {
          updateMessage(messageId, {
            content: `❌ Could not fetch price for \`${tokenRaw}\`.\n\nToken might not be traded recently or not indexed.`,
            status: 'error',
          });
          return;
        }
        
        let priceMsg = `**${tokenInfo?.symbol || tokenRaw} Price**\n\n`;
        priceMsg += `**$${price.toFixed(8)}**\n`;
        priceMsg += `\nContract: \`${formatAddress(mint)}\``;
        
        if (tokenInfo?.mcap) {
          priceMsg += `\nMarket Cap: $${tokenInfo.mcap.toLocaleString()}`;
        }
        
        updateMessage(messageId, { content: priceMsg, status: 'done' });
        break;
      }
      
      case 'transfer': {
        const { amount, tokenRaw, tokenMint, destination } = command.params;
        
        if (!connected || !publicKey) {
          updateMessage(messageId, {
            content: '❌ Please connect your wallet first.',
            status: 'error',
          });
          return;
        }
        
        const tokenInfo = tokenMint ? await getTokenInfo(tokenMint) : { symbol: 'SOL', decimals: 9, mint: '', name: 'SOL' };
        
        let confirmMsg = `**Transfer Preview**\n\n`;
        confirmMsg += `**Amount:** ${amount} ${tokenInfo?.symbol || tokenRaw}\n`;
        confirmMsg += `**To:** \`${formatAddress(destination)}\`\n\n`;
        confirmMsg += `Type **confirm** to execute or **cancel** to abort.`;
        
        updateMessage(messageId, {
          content: confirmMsg,
          status: 'confirming',
          pendingAction: {
            command,
            fromToken: tokenInfo as TokenInfo,
          },
        });
        break;
      }
      
      case 'help': {
        updateMessage(messageId, { content: getHelpMessage(), status: 'done' });
        break;
      }
      
      case 'dca': {
        const { totalAmount, fromTokenRaw, toTokenRaw, fromMint, toMint, frequency, duration } = command.params;
        
        // Validate tokens
        if (!fromMint) {
          updateMessage(messageId, {
            content: `❌ Unknown token: \`${fromTokenRaw}\`\n\n${getSupportedTokensHelp()}`,
            status: 'error',
          });
          return;
        }
        
        if (!toMint) {
          updateMessage(messageId, {
            content: `❌ Unknown token: \`${toTokenRaw}\`\n\n${getSupportedTokensHelp()}`,
            status: 'error',
          });
          return;
        }
        
        // Get token info
        updateMessage(messageId, { content: 'Looking up token info...', status: 'thinking' });
        
        const [fromTokenInfo, toTokenInfo] = await Promise.all([
          getTokenInfo(fromMint),
          getTokenInfo(toMint),
        ]);
        
        if (!fromTokenInfo || !toTokenInfo) {
          updateMessage(messageId, {
            content: `❌ Could not find token info for DCA setup.`,
            status: 'error',
          });
          return;
        }
        
        // Calculate executions and amount per trade
        const amountPerTrade = totalAmount / duration;
        
        let dcaMsg = `🔄 **DCA Preview**\n\n`;
        dcaMsg += `**Total:** ${totalAmount} ${fromTokenInfo.symbol}\n`;
        dcaMsg += `**To:** ${toTokenInfo.symbol}\n`;
        dcaMsg += `**Frequency:** ${frequency}\n`;
        dcaMsg += `**Duration:** ${duration} periods\n`;
        dcaMsg += `**Amount per trade:** ~${amountPerTrade.toFixed(4)} ${fromTokenInfo.symbol}\n\n`;
        dcaMsg += `**Privacy Features:**\n`;
        dcaMsg += `• 20% amount variance (randomized)\n`;
        dcaMsg += `• Randomized execution timing\n`;
        dcaMsg += `• MEV-protected via keeper service\n\n`;
        dcaMsg += `Type **confirm** to create DCA vault or **cancel** to abort.`;
        
        updateMessage(messageId, {
          content: dcaMsg,
          status: 'confirming',
          pendingAction: {
            command,
            fromToken: fromTokenInfo,
            toToken: toTokenInfo,
          },
        });
        break;
      }
      
      case 'withdraw_dca': {
        if (!connected || !publicKey) {
          updateMessage(messageId, {
            content: '❌ Please connect your wallet first.',
            status: 'error',
          });
          return;
        }

        const { fromTokenRaw, toTokenRaw, fromMint, toMint } = command.params;

        // If no token pair specified, prompt user
        if (!fromMint || !toMint) {
          updateMessage(messageId, {
            content: `🔍 **Withdraw DCA**\n\nPlease specify which DCA vault to withdraw from:\n\n\`Withdraw DCA USDC to SOL\`\n\`Cancel DCA SOL to USDC\`\n\nThis will return all remaining funds to your wallet.`,
            status: 'done',
          });
          return;
        }

        updateMessage(messageId, { content: 'Looking up DCA vault...', status: 'thinking' });

        // Get token info
        const [fromTokenInfo, toTokenInfo] = await Promise.all([
          getTokenInfo(fromMint),
          getTokenInfo(toMint),
        ]);

        if (!fromTokenInfo || !toTokenInfo) {
          updateMessage(messageId, {
            content: `❌ Could not find token info.\n\n**From:** \`${formatAddress(fromMint)}\`\n**To:** \`${formatAddress(toMint)}\``,
            status: 'error',
          });
          return;
        }

        // Check if vault exists
        const vaultInfo = await getDcaVaultInfo(
          connection,
          publicKey,
          new PublicKey(fromMint),
          new PublicKey(toMint)
        );

        if (!vaultInfo) {
          updateMessage(messageId, {
            content: `❌ **No DCA Vault Found**\n\nYou don't have an active DCA vault for:\n**${fromTokenInfo.symbol} → ${toTokenInfo.symbol}**\n\nMake sure you specify the correct token pair.`,
            status: 'error',
          });
          return;
        }

        // Build confirmation message
        let confirmMsg = `🔓 **Withdraw DCA Vault**\n\n`;
        confirmMsg += `**Vault:** \`${formatAddress(vaultInfo.address)}\`\n`;
        confirmMsg += `**Pair:** ${fromTokenInfo.symbol} → ${toTokenInfo.symbol}\n\n`;
        confirmMsg += `This will:\n`;
        confirmMsg += `• Return remaining ${fromTokenInfo.symbol} to your wallet\n`;
        confirmMsg += `• Return accumulated ${toTokenInfo.symbol} to your wallet\n`;
        confirmMsg += `• Deactivate the DCA vault\n\n`;
        confirmMsg += `Type **confirm** to withdraw or **cancel** to abort.`;

        updateMessage(messageId, {
          content: confirmMsg,
          status: 'confirming',
          pendingAction: {
            command,
            fromToken: fromTokenInfo,
            toToken: toTokenInfo,
          },
        });
        break;
      }

      case 'list_dca': {
        if (!connected || !publicKey) {
          updateMessage(messageId, {
            content: '❌ Please connect your wallet first.',
            status: 'error',
          });
          return;
        }

        updateMessage(messageId, { content: 'Checking your DCA vaults...', status: 'thinking' });

        // Check common token pairs for DCA vaults
        const commonPairs = [
          { from: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', to: 'So11111111111111111111111111111111111111112', label: 'USDC → SOL' },
          { from: 'So11111111111111111111111111111111111111112', to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', label: 'SOL → USDC' },
          { from: 'So11111111111111111111111111111111111111112', to: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', label: 'SOL → USDT' },
          { from: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', to: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', label: 'USDC → JUP' },
        ];

        const foundVaults: Array<{ address: string; label: string }> = [];

        for (let i = 0; i < commonPairs.length; i++) {
          const pair = commonPairs[i];
          try {
            const vaultInfo = await getDcaVaultInfo(
              connection,
              publicKey,
              new PublicKey(pair.from),
              new PublicKey(pair.to)
            );
            if (vaultInfo) {
              foundVaults.push({ address: vaultInfo.address, label: pair.label });
            }
          } catch (e) {
            // Vault doesn't exist for this pair
          }
        }

        if (foundVaults.length === 0) {
          updateMessage(messageId, {
            content: `📋 **Your DCA Vaults**\n\nNo active DCA vaults found.\n\n**Create one:**\n\`DCA 10 USDC to SOL daily for 7 days\``,
            status: 'done',
          });
          return;
        }

        let listMsg = `📋 **Your DCA Vaults**\n\n`;
        for (let i = 0; i < foundVaults.length; i++) {
          const vault = foundVaults[i];
          listMsg += `**${vault.label}**\n`;
          listMsg += `Vault: \`${formatAddress(vault.address)}\`\n\n`;
        }
        listMsg += `**Commands:**\n`;
        listMsg += `• \`Withdraw DCA USDC to SOL\` - Cancel & get funds back\n`;
        listMsg += `• \`Close DCA USDC to SOL\` - Close empty vault, reclaim rent\n`;

        updateMessage(messageId, { content: listMsg, status: 'done' });
        break;
      }

      case 'close_dca': {
        if (!connected || !publicKey) {
          updateMessage(messageId, {
            content: '❌ Please connect your wallet first.',
            status: 'error',
          });
          return;
        }

        const { fromTokenRaw, toTokenRaw, fromMint, toMint } = command.params;

        // If no token pair specified, prompt user
        if (!fromMint || !toMint) {
          updateMessage(messageId, {
            content: `🔒 **Close DCA Vault**\n\nPlease specify which DCA vault to close:\n\n\`Close DCA USDC to SOL\`\n\`Delete DCA SOL to USDC\`\n\n⚠️ **Note:** The vault must be empty. Use \`Withdraw DCA\` first to get your funds back, then \`Close DCA\` to reclaim ~0.002 SOL rent.`,
            status: 'done',
          });
          return;
        }

        updateMessage(messageId, { content: 'Looking up DCA vault...', status: 'thinking' });

        // Get token info
        const [fromTokenInfo, toTokenInfo] = await Promise.all([
          getTokenInfo(fromMint),
          getTokenInfo(toMint),
        ]);

        if (!fromTokenInfo || !toTokenInfo) {
          updateMessage(messageId, {
            content: `❌ Could not find token info.\n\n**From:** \`${formatAddress(fromMint)}\`\n**To:** \`${formatAddress(toMint)}\``,
            status: 'error',
          });
          return;
        }

        // Check if vault exists
        const vaultInfo = await getDcaVaultInfo(
          connection,
          publicKey,
          new PublicKey(fromMint),
          new PublicKey(toMint)
        );

        if (!vaultInfo) {
          updateMessage(messageId, {
            content: `❌ **No DCA Vault Found**\n\nYou don't have a DCA vault for:\n**${fromTokenInfo.symbol} → ${toTokenInfo.symbol}**\n\nMake sure you specify the correct token pair.`,
            status: 'error',
          });
          return;
        }

        // Build confirmation message
        let confirmMsg = `🗑️ **Close DCA Vault**\n\n`;
        confirmMsg += `**Vault:** \`${formatAddress(vaultInfo.address)}\`\n`;
        confirmMsg += `**Pair:** ${fromTokenInfo.symbol} → ${toTokenInfo.symbol}\n\n`;
        confirmMsg += `This will:\n`;
        confirmMsg += `• Permanently close the vault account\n`;
        confirmMsg += `• Return ~0.002 SOL rent to your wallet\n\n`;
        confirmMsg += `⚠️ **Warning:** Vault must be empty. If you still have funds, use \`Withdraw DCA\` first.\n\n`;
        confirmMsg += `Type **confirm** to close or **cancel** to abort.`;

        updateMessage(messageId, {
          content: confirmMsg,
          status: 'confirming',
          pendingAction: {
            command,
            fromToken: fromTokenInfo,
            toToken: toTokenInfo,
          },
        });
        break;
      }

      case 'limit_order': {
        const { amount, fromTokenRaw, toTokenRaw, fromMint, toMint, triggerPrice, triggerType, expiryHours } = command.params;
        
        if (!connected || !publicKey) {
          updateMessage(messageId, {
            content: '❌ Please connect your wallet first.',
            status: 'error',
          });
          return;
        }

        if (!fromMint) {
          updateMessage(messageId, {
            content: `❌ Unknown token: \`${fromTokenRaw}\`\n\n${getSupportedTokensHelp()}`,
            status: 'error',
          });
          return;
        }
        
        if (!toMint) {
          updateMessage(messageId, {
            content: `❌ Unknown token: \`${toTokenRaw}\`\n\n${getSupportedTokensHelp()}`,
            status: 'error',
          });
          return;
        }

        updateMessage(messageId, { content: 'Looking up token info...', status: 'thinking' });
        
        const [fromTokenInfo, toTokenInfo] = await Promise.all([
          getTokenInfo(fromMint),
          getTokenInfo(toMint),
        ]);

        if (!fromTokenInfo || !toTokenInfo) {
          updateMessage(messageId, {
            content: `❌ Could not find token info for limit order setup.`,
            status: 'error',
          });
          return;
        }

        const triggerTypeLabel = triggerType === 'above' ? 'rises above' : 'drops below';
        const expiry = expiryHours || 24;

        let limitMsg = `📊 **Limit Order Preview**\n\n`;
        limitMsg += `**Action:** Swap ${amount} ${fromTokenInfo.symbol} → ${toTokenInfo.symbol}\n`;
        limitMsg += `**Trigger:** When ${toTokenInfo.symbol} price ${triggerTypeLabel} $${triggerPrice}\n`;
        limitMsg += `**Expires:** ${expiry} hours\n\n`;
        limitMsg += `**How it works:**\n`;
        limitMsg += `• Funds locked in secure vault\n`;
        limitMsg += `• Keeper monitors price 24/7\n`;
        limitMsg += `• Auto-executes when condition met\n`;
        limitMsg += `• Cancel anytime to get funds back\n\n`;
        limitMsg += `Type **confirm** to create order or **cancel** to abort.`;

        updateMessage(messageId, {
          content: limitMsg,
          status: 'confirming',
          pendingAction: {
            command,
            fromToken: fromTokenInfo,
            toToken: toTokenInfo,
          },
        });
        break;
      }

      case 'list_limit_orders': {
        if (!connected || !publicKey) {
          updateMessage(messageId, {
            content: '❌ Please connect your wallet first.',
            status: 'error',
          });
          return;
        }

        updateMessage(messageId, { content: 'Checking your limit orders...', status: 'thinking' });

        try {
          const vaults = await getUserIntentVaults(connection, publicKey);
          
          if (vaults.length === 0) {
            updateMessage(messageId, {
              content: `📋 **Your Limit Orders**\n\nNo active limit orders found.\n\n**Create one:**\n\`Buy SOL when price drops to $200\`\n\`Sell 1 SOL when price hits $250\``,
              status: 'done',
            });
            return;
          }

          let listMsg = `📋 **Your Limit Orders**\n\n`;
          
          for (const vault of vaults) {
            const triggerTypeLabel = vault.triggerType === TriggerType.PriceAbove ? '>' : '<';
            const triggerPriceUsd = parseInt(vault.triggerPrice) / 1_000_000;
            const statusLabel = ['Monitoring', 'Triggered', 'Executing', 'Executed', 'Expired', 'Cancelled'][vault.status];
            const statusEmoji = vault.status === IntentStatus.Monitoring ? '👀' : 
                               vault.status === IntentStatus.Executed ? '✅' : 
                               vault.status === IntentStatus.Expired ? '⏰' : 
                               vault.status === IntentStatus.Cancelled ? '❌' : '🔄';
            
            listMsg += `${statusEmoji} **Order #${vault.nonce.slice(-6)}**\n`;
            listMsg += `Trigger: ${triggerTypeLabel} $${triggerPriceUsd.toFixed(2)}\n`;
            listMsg += `Status: ${statusLabel}\n`;
            listMsg += `Expires: ${vault.expiresAt.toLocaleString()}\n`;
            listMsg += `Vault: \`${formatAddress(vault.address)}\`\n\n`;
          }

          listMsg += `**Commands:**\n`;
          listMsg += `• \`Cancel limit order\` - Cancel & get funds back\n`;

          updateMessage(messageId, { content: listMsg, status: 'done' });
        } catch (error: any) {
          updateMessage(messageId, {
            content: `❌ Error fetching limit orders: ${error.message}`,
            status: 'error',
          });
        }
        break;
      }

      case 'cancel_limit_order': {
        if (!connected || !publicKey) {
          updateMessage(messageId, {
            content: '❌ Please connect your wallet first.',
            status: 'error',
          });
          return;
        }

        const { vaultAddress, orderIndex } = command.params;

        updateMessage(messageId, { content: 'Looking up your limit orders...', status: 'thinking' });

        try {
          const vaults = await getUserIntentVaults(connection, publicKey);
          const activeVaults = vaults.filter(v => v.status === IntentStatus.Monitoring);
          
          if (activeVaults.length === 0) {
            updateMessage(messageId, {
              content: `📋 **No Active Limit Orders**\n\nYou don't have any active limit orders to cancel.`,
              status: 'done',
            });
            return;
          }

          // If orderIndex provided (1, 2, 3...), use that
          if (orderIndex && orderIndex >= 1 && orderIndex <= activeVaults.length) {
            const vault = activeVaults[orderIndex - 1];
            const triggerPriceUsd = parseInt(vault.triggerPrice) / 1_000_000;
            
            let confirmMsg = `🗑️ **Cancel Order #${orderIndex}**\n\n`;
            confirmMsg += `**Trigger:** $${triggerPriceUsd.toFixed(2)}\n\n`;
            confirmMsg += `This will return your funds to wallet.\n\n`;
            confirmMsg += `Type **confirm** to cancel or **cancel** to abort.`;

            updateMessage(messageId, {
              content: confirmMsg,
              status: 'confirming',
              pendingAction: {
                command: { ...command, params: { ...command.params, vaultAddress: vault.address } },
              },
            });
            return;
          }

          // If vault address provided, find and confirm
          if (vaultAddress) {
            const vault = activeVaults.find(v => v.address === vaultAddress);
            if (!vault) {
              updateMessage(messageId, {
                content: `❌ Vault not found or already cancelled.`,
                status: 'error',
              });
              return;
            }
            
            const triggerPriceUsd = parseInt(vault.triggerPrice) / 1_000_000;
            
            let confirmMsg = `🗑️ **Cancel Limit Order**\n\n`;
            confirmMsg += `**Trigger:** $${triggerPriceUsd.toFixed(2)}\n\n`;
            confirmMsg += `This will return your funds to wallet.\n\n`;
            confirmMsg += `Type **confirm** to cancel or **cancel** to abort.`;

            updateMessage(messageId, {
              content: confirmMsg,
              status: 'confirming',
              pendingAction: {
                command,
              },
            });
            return;
          }

          // Only 1 order? Auto-select
          if (activeVaults.length === 1) {
            const vault = activeVaults[0];
            const triggerPriceUsd = parseInt(vault.triggerPrice) / 1_000_000;
            
            let confirmMsg = `🗑️ **Cancel Limit Order**\n\n`;
            confirmMsg += `**Trigger:** $${triggerPriceUsd.toFixed(2)}\n\n`;
            confirmMsg += `This will return your funds to wallet.\n\n`;
            confirmMsg += `Type **confirm** to cancel or **cancel** to abort.`;

            updateMessage(messageId, {
              content: confirmMsg,
              status: 'confirming',
              pendingAction: {
                command: { ...command, params: { ...command.params, vaultAddress: vault.address } },
              },
            });
            return;
          }

          // Multiple orders - show numbered list
          let listMsg = `📋 **Active Limit Orders**\n\n`;
          
          for (let i = 0; i < activeVaults.length; i++) {
            const vault = activeVaults[i];
            const triggerPriceUsd = parseInt(vault.triggerPrice) / 1_000_000;
            listMsg += `**${i + 1}.** Trigger: $${triggerPriceUsd.toFixed(2)}\n`;
          }

          listMsg += `\nReply with number to cancel (e.g., \`1\` or \`2\`)`;

          updateMessage(messageId, { content: listMsg, status: 'done' });
        } catch (error: any) {
          updateMessage(messageId, {
            content: `❌ Error: ${error.message}`,
            status: 'error',
          });
        }
        break;
      }
      
      case 'burn': {
        if (!connected || !publicKey) {
          updateMessage(messageId, {
            content: '❌ Please connect your wallet first.',
            status: 'error',
          });
          return;
        }

        const { amountStr, tokenRaw, tokenMint, isPercentage, isAll } = command.params;

        // Validate token
        if (!tokenMint) {
          updateMessage(messageId, {
            content: `❌ Unknown token: \`${tokenRaw}\`\n\n${getSupportedTokensHelp()}`,
            status: 'error',
          });
          return;
        }

        // Prevent burning SOL
        if (tokenMint === 'So11111111111111111111111111111111111111112') {
          updateMessage(messageId, {
            content: `❌ **Cannot burn SOL**\n\nSOL is the native token and cannot be burned.\nYou can only burn SPL tokens.`,
            status: 'error',
          });
          return;
        }

        updateMessage(messageId, { content: 'Looking up token info...', status: 'thinking' });

        // Import SPL token functions
        const { getAccount, getMint } = await import('@solana/spl-token');
        const mintPubkey = new PublicKey(tokenMint);

        // Try Jupiter API first, fallback to on-chain for pump.fun tokens
        let tokenInfo = await getTokenInfo(tokenMint);
        let decimals: number;

        if (!tokenInfo) {
          // Fallback: get decimals directly from on-chain mint account
          try {
            const mintAccount = await getMint(connection, mintPubkey);
            decimals = mintAccount.decimals;
            // Create minimal token info for pump.fun tokens
            tokenInfo = {
              mint: tokenMint,
              symbol: tokenRaw.toUpperCase(),
              name: tokenRaw.toUpperCase(),
              decimals: decimals,
            };
          } catch (e) {
            updateMessage(messageId, {
              content: `❌ Could not find token: \`${formatAddress(tokenMint)}\`\n\nMake sure the contract address is correct.`,
              status: 'error',
            });
            return;
          }
        } else {
          decimals = tokenInfo.decimals;
        }

        // Get user balance - try both Token Program and Token-2022
        const { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } = await import('@solana/spl-token');
        
        console.log('=== BURN DEBUG ===');
        console.log('Wallet:', publicKey.toBase58());
        console.log('Token Mint:', mintPubkey.toBase58());
        
        let tokenBalance: { balance: number; decimals: number } | null = null;
        let foundAta: PublicKey | null = null;
        
        // Try standard Token Program first
        try {
          const ata = await getAssociatedTokenAddress(mintPubkey, publicKey, false, TOKEN_PROGRAM_ID);
          console.log('Trying Standard ATA:', ata.toBase58());
          const tokenAccount = await getAccount(connection, ata, undefined, TOKEN_PROGRAM_ID);
          console.log('Found with Standard Token Program!');
          console.log('Raw Amount:', tokenAccount.amount.toString());
          const balance = Number(tokenAccount.amount) / Math.pow(10, decimals);
          tokenBalance = { balance, decimals };
          foundAta = ata;
        } catch (e1: any) {
          console.log('Standard Token Program failed:', e1.message);
          
          // Try Token-2022 Program
          try {
            const ata2022 = await getAssociatedTokenAddress(mintPubkey, publicKey, false, TOKEN_2022_PROGRAM_ID);
            console.log('Trying Token-2022 ATA:', ata2022.toBase58());
            const tokenAccount = await getAccount(connection, ata2022, undefined, TOKEN_2022_PROGRAM_ID);
            console.log('Found with Token-2022 Program!');
            console.log('Raw Amount:', tokenAccount.amount.toString());
            const balance = Number(tokenAccount.amount) / Math.pow(10, decimals);
            tokenBalance = { balance, decimals };
            foundAta = ata2022;
          } catch (e2: any) {
            console.log('Token-2022 Program also failed:', e2.message);
            
            // Last resort: scan all token accounts
            console.log('Scanning all token accounts...');
            try {
              const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                mint: mintPubkey,
              });
              console.log('Found accounts:', tokenAccounts.value.length);
              
              if (tokenAccounts.value.length > 0) {
                const acc = tokenAccounts.value[0];
                const parsed = acc.account.data.parsed.info;
                const balance = parsed.tokenAmount.uiAmount;
                const dec = parsed.tokenAmount.decimals;
                console.log('Found via scan! Balance:', balance, 'Decimals:', dec);
                tokenBalance = { balance, decimals: dec };
                foundAta = acc.pubkey;
              }
            } catch (e3: any) {
              console.error('Scan also failed:', e3.message);
            }
          }
        }
        
        console.log('Final tokenBalance:', tokenBalance);
        console.log('Found ATA:', foundAta?.toBase58() || 'none');

        if (!tokenBalance || tokenBalance.balance <= 0) {
          updateMessage(messageId, {
            content: `❌ **No Balance Found**\n\nYou don't have any ${tokenInfo.symbol} in your wallet.`,
            status: 'error',
          });
          return;
        }

        // Calculate burn amount
        let burnAmount: number;

        if (isAll) {
          burnAmount = tokenBalance.balance;
        } else if (isPercentage) {
          const percentage = parseFloat(amountStr.replace('%', ''));
          burnAmount = (percentage / 100) * tokenBalance.balance;
        } else {
          burnAmount = parseFloat(amountStr);
        }

        // Validate amount
        if (isNaN(burnAmount) || burnAmount <= 0) {
          updateMessage(messageId, {
            content: `❌ Invalid burn amount: \`${amountStr}\``,
            status: 'error',
          });
          return;
        }

        if (burnAmount > tokenBalance.balance) {
          updateMessage(messageId, {
            content: `❌ **Insufficient Balance**\n\nYou want to burn: ${burnAmount.toLocaleString()} ${tokenInfo.symbol}\nYou have: ${tokenBalance.balance.toLocaleString()} ${tokenInfo.symbol}`,
            status: 'error',
          });
          return;
        }

        // Get USD value if available
        const tokenPrice = await getTokenPrice(tokenMint);
        const usdValue = tokenPrice ? burnAmount * tokenPrice : null;

        // Build confirmation message with extra safety warnings
        let confirmMsg = `🔥 **Burn Preview**\n\n`;
        confirmMsg += `**Token:** ${tokenInfo.symbol}\n`;
        confirmMsg += `**Name:** ${tokenInfo.name}\n`;
        confirmMsg += `**Contract:** \`${tokenMint}\`\n\n`;
        confirmMsg += `**Your Balance:** ${tokenBalance.balance.toLocaleString()} ${tokenInfo.symbol}\n`;
        confirmMsg += `**Amount to Burn:** ${burnAmount.toLocaleString()} ${tokenInfo.symbol}`;
        if (usdValue) {
          confirmMsg += ` (~$${usdValue.toFixed(2)})`;
        }
        confirmMsg += `\n\n`;
        confirmMsg += `⚠️ **WARNING: THIS ACTION IS IRREVERSIBLE**\n`;
        confirmMsg += `Burned tokens are permanently destroyed and cannot be recovered.\n\n`;
        confirmMsg += `Type **confirm** to burn or **cancel** to abort.`;

        updateMessage(messageId, {
          content: confirmMsg,
          status: 'confirming',
          pendingAction: {
            command: {
              ...command,
              params: {
                ...command.params,
                burnAmount, // Store calculated amount
              },
            },
            fromToken: tokenInfo,
          },
        });
        break;
      }

      case 'create_drop': {
        if (!connected || !publicKey) {
          updateMessage(messageId, {
            content: '❌ Please connect your wallet first.',
            status: 'error',
          });
          return;
        }

        const { amount, token, recipient, expiryHours } = command.params;

        // Resolve token
        let tokenMint = resolveToken(token) || token;
        const isNativeSol = !tokenMint || token?.toUpperCase() === 'SOL';

        // If not SOL and not valid address, search for token
        if (!isNativeSol && !isValidAddress(tokenMint)) {
          const searchResults = await searchToken(token);
          if (searchResults.length > 0) {
            tokenMint = searchResults[0].mint;
          } else {
            updateMessage(messageId, {
              content: `❌ Unknown token: \`${token}\`\n\n${getSupportedTokensHelp()}`,
              status: 'error',
            });
            return;
          }
        }

        updateMessage(messageId, { content: 'Looking up token info...', status: 'thinking' });

        // Get token info and decimals
        let tokenInfo: TokenInfo | null = null;
        let decimals = 9;

        if (!isNativeSol) {
          tokenInfo = await getTokenInfo(tokenMint);
          if (tokenInfo) {
            decimals = tokenInfo.decimals;
          } else {
            // Fallback: get decimals from on-chain
            try {
              const { getMint } = await import('@solana/spl-token');
              const mintAccount = await getMint(connection, new PublicKey(tokenMint));
              decimals = mintAccount.decimals;
              tokenInfo = {
                mint: tokenMint,
                symbol: token.toUpperCase(),
                name: token.toUpperCase(),
                decimals,
              };
            } catch (e) {
              updateMessage(messageId, {
                content: `❌ Could not find token: \`${formatAddress(tokenMint)}\``,
                status: 'error',
              });
              return;
            }
          }
        } else {
          tokenInfo = {
            mint: 'So11111111111111111111111111111111111111112',
            symbol: 'SOL',
            name: 'Solana',
            decimals: 9,
          };
        }

        const expiry = expiryHours || 168; // Default 7 days

        // Build confirmation message
        let confirmMsg = `🎁 **Drop Preview**\n\n`;
        confirmMsg += `**Token:** ${tokenInfo.symbol}\n`;
        confirmMsg += `**Amount:** ${amount} ${tokenInfo.symbol}\n`;
        if (recipient) {
          confirmMsg += `**Recipient:** ${recipient}\n`;
        }
        confirmMsg += `**Expires:** ${expiry} hours (${(expiry / 24).toFixed(1)} days)\n\n`;
        confirmMsg += `**How it works:**\n`;
        confirmMsg += `• Funds locked in secure escrow\n`;
        confirmMsg += `• Anyone with link can claim\n`;
        confirmMsg += `• Auto-refund if unclaimed after expiry\n\n`;
        confirmMsg += `Type **confirm** to create drop link or **cancel** to abort.`;

        updateMessage(messageId, {
          content: confirmMsg,
          status: 'confirming',
          pendingAction: {
            command: {
              ...command,
              params: {
                ...command.params,
                tokenMint: isNativeSol ? null : tokenMint,
                decimals,
                isNativeSol,
              },
            },
            fromToken: tokenInfo,
          },
        });
        break;
      }
      
      case 'rwa_info': {
        const { symbol } = command.params;
        const targetSymbol = symbol || 'USDY';
        
        updateMessage(messageId, { content: `Fetching ${targetSymbol} info...`, status: 'thinking' });
        
        try {
          const response = await getRWAWithData(targetSymbol);
          
          if (!response.success || !response.data) {
            updateMessage(messageId, {
              content: `❌ Could not fetch ${targetSymbol} data: ${response.error || 'Unknown error'}`,
              status: 'error',
            });
            return;
          }
          
          const asset = response.data;
          const { data: rwaData } = asset;
          
          // Format the info message
          let infoMsg = `💎 **${asset.name} (${asset.symbol})**\n\n`;
          infoMsg += `┌─────────────────────────────────┐\n`;
          infoMsg += `│  **APY:**        ${rwaData.apy.toFixed(2)}%\n`;
          infoMsg += `│  **Price:**      $${rwaData.price.toFixed(4)}\n`;
          infoMsg += `│  **TVL:**        $${(rwaData.tvl / 1_000_000).toFixed(2)}M\n`;
          infoMsg += `│  **Risk:**       ⭐ ${asset.riskLabel}\n`;
          infoMsg += `│  **Liquidity:**  ${asset.liquidity}\n`;
          infoMsg += `│  **Backing:**    ${asset.backing}\n`;
          infoMsg += `└─────────────────────────────────┘\n\n`;
          
          // Yield preview per $1,000
          const yields = estimateYield(1000, rwaData.apy);
          infoMsg += `📈 **Yield Preview (per $1,000)**\n`;
          infoMsg += `• Daily:   +$${yields.daily.toFixed(2)}\n`;
          infoMsg += `• Monthly: +$${yields.monthly.toFixed(2)}\n`;
          infoMsg += `• Yearly:  +$${yields.yearly.toFixed(2)}\n\n`;
          
          infoMsg += `💡 ${asset.symbol} earns yield automatically — just hold it!\n\n`;
          infoMsg += `**Commands:**\n`;
          infoMsg += `• \`Deposit 100 USDC to USDY\` - Start earning\n`;
          infoMsg += `• \`Calculate yield on 1000 USDY\` - Project returns`;
          
          updateMessage(messageId, { content: infoMsg, status: 'done' });
        } catch (error: any) {
          updateMessage(messageId, {
            content: `❌ Error fetching RWA data: ${error.message}`,
            status: 'error',
          });
        }
        break;
      }

      case 'rwa_portfolio': {
        if (!connected || !publicKey) {
          updateMessage(messageId, {
            content: '❌ Please connect your wallet first.',
            status: 'error',
          });
          return;
        }
        
        updateMessage(messageId, { content: 'Checking your RWA holdings...', status: 'thinking' });
        
        try {
          // Get user's token balances
          const balances = await getBalances(connection, publicKey);
          
          // Find RWA tokens in balance
          const rwaBalances: Array<{ mint: string; balance: number }> = [];
          
          for (const token of balances.tokens) {
            if (token.mint === USDY_MINT) {
              rwaBalances.push({ mint: token.mint, balance: token.balance });
            }
          }
          
          if (rwaBalances.length === 0) {
            let emptyMsg = `💼 **Your RWA Portfolio**\n\n`;
            emptyMsg += `No RWA holdings found.\n\n`;
            emptyMsg += `**Start earning yield:**\n`;
            emptyMsg += `• \`Deposit 100 USDC to USDY\` - Earn ~4% APY\n`;
            emptyMsg += `• \`USDY info\` - Learn about USDY`;
            
            updateMessage(messageId, { content: emptyMsg, status: 'done' });
            return;
          }
          
          // Build portfolio
          const portfolio = await buildRWAPortfolio(rwaBalances);
          
          let portfolioMsg = `💼 **Your RWA Portfolio**\n\n`;
          portfolioMsg += `**Total Value:** $${portfolio.totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}\n`;
          portfolioMsg += `**Blended APY:** ${portfolio.blendedAPY.toFixed(2)}%\n\n`;
          
          portfolioMsg += `📊 **Holdings:**\n`;
          for (const holding of portfolio.holdings) {
            portfolioMsg += `• **${holding.asset.symbol}:** ${holding.balance.toFixed(4)} ($${holding.balanceUSD.toFixed(2)})\n`;
            portfolioMsg += `  Yield: +$${holding.estimatedYieldMonthly.toFixed(2)}/month\n`;
          }
          
          portfolioMsg += `\n📈 **Projected Yield:**\n`;
          portfolioMsg += `• Daily:   +$${portfolio.totalYieldDaily.toFixed(2)}\n`;
          portfolioMsg += `• Monthly: +$${portfolio.totalYieldMonthly.toFixed(2)}\n`;
          portfolioMsg += `• Yearly:  +$${portfolio.totalYieldYearly.toFixed(2)}\n`;
          
          updateMessage(messageId, { content: portfolioMsg, status: 'done' });
        } catch (error: any) {
          updateMessage(messageId, {
            content: `❌ Error fetching portfolio: ${error.message}`,
            status: 'error',
          });
        }
        break;
      }

      case 'rwa_calculate': {
        const { amount, months } = command.params;
        
        updateMessage(messageId, { content: 'Calculating yield projection...', status: 'thinking' });
        
        try {
          const apy = await getUSDYAPY();
          const projectionMonths = months || 12;
          
          // Calculate projection
          const monthlyRate = apy / 100 / 12;
          let currentValue = amount;
          const projections: Array<{ month: number; value: number; yield: number }> = [];
          
          for (let m = 1; m <= projectionMonths; m++) {
            const yieldAmount = currentValue * monthlyRate;
            currentValue += yieldAmount;
            projections.push({ month: m, value: currentValue, yield: yieldAmount });
          }
          
          const totalYield = currentValue - amount;
          
          let calcMsg = `🧮 **Yield Projection**\n\n`;
          calcMsg += `**Deposit:** $${amount.toLocaleString()}\n`;
          calcMsg += `**APY:** ${apy.toFixed(2)}%\n`;
          calcMsg += `**Period:** ${projectionMonths} months\n\n`;
          
          calcMsg += `📈 **Timeline:**\n`;
          const keyMonths = [1, 3, 6, 12].filter(m => m <= projectionMonths);
          for (const m of keyMonths) {
            const data = projections[m - 1];
            calcMsg += `• ${m} month${m > 1 ? 's' : ''}:  $${data.value.toFixed(2)} (+$${(data.value - amount).toFixed(2)})\n`;
          }
          
          calcMsg += `\n**Final Value:** $${currentValue.toFixed(2)}\n`;
          calcMsg += `**Total Yield:** +$${totalYield.toFixed(2)} (+${((totalYield / amount) * 100).toFixed(1)}%)\n\n`;
          calcMsg += `💡 *Based on current APY, actual returns may vary.*`;
          
          updateMessage(messageId, { content: calcMsg, status: 'done' });
        } catch (error: any) {
          updateMessage(messageId, {
            content: `❌ Error calculating yield: ${error.message}`,
            status: 'error',
          });
        }
        break;
      }

      case 'rwa_deposit': {
        // RWA deposit is essentially a swap with yield preview
        const { amount, fromTokenRaw, toTokenRaw, fromMint, toMint } = command.params;
        
        if (!fromMint) {
          updateMessage(messageId, {
            content: `❌ Unknown token: \`${fromTokenRaw}\`\n\n${getSupportedTokensHelp()}`,
            status: 'error',
          });
          return;
        }
        
        if (!toMint) {
          updateMessage(messageId, {
            content: `❌ Unknown RWA token: \`${toTokenRaw}\``,
            status: 'error',
          });
          return;
        }
        
        updateMessage(messageId, { content: 'Getting deposit quote...', status: 'thinking' });
        
        const [fromTokenInfo, toTokenInfo] = await Promise.all([
          getTokenInfo(fromMint),
          getTokenInfo(toMint),
        ]);
        
        if (!fromTokenInfo || !toTokenInfo) {
          updateMessage(messageId, {
            content: `❌ Could not find token info.`,
            status: 'error',
          });
          return;
        }
        
        // Get swap quote
        const orderResult = await getSwapOrder(fromMint, toMint, amount, fromTokenInfo.decimals);
        
        if (!orderResult.success) {
          updateMessage(messageId, {
            content: `❌ **Deposit not available**\n\n${orderResult.errorMessage || 'Could not get quote from Jupiter.'}`,
            status: 'error',
          });
          return;
        }
        
        const outAmountNum = parseInt(orderResult.outAmount!) / Math.pow(10, toTokenInfo.decimals);
        
        // Get APY for yield projection
        const apy = await getUSDYAPY();
        const outputValueUSD = outAmountNum * 1.11; // Approximate USDY price
        const yields = estimateYield(outputValueUSD, apy);
        
        let confirmMsg = `💎 **Deposit to RWA**\n\n`;
        confirmMsg += `**From:** ${amount} ${fromTokenInfo.symbol}\n`;
        confirmMsg += `**To:** ~${outAmountNum.toFixed(4)} ${toTokenInfo.symbol}\n\n`;
        
        confirmMsg += `📈 **Yield Projection (${apy.toFixed(2)}% APY)**\n`;
        confirmMsg += `• Monthly: +$${yields.monthly.toFixed(2)}\n`;
        confirmMsg += `• Yearly:  +$${yields.yearly.toFixed(2)}\n\n`;
        
        confirmMsg += `🏦 **Backing:** US Treasury Bills\n`;
        confirmMsg += `⭐ **Risk:** Very Low\n\n`;
        
        confirmMsg += `Type **confirm** to deposit or **cancel** to abort.`;
        
        updateMessage(messageId, {
          content: confirmMsg,
          status: 'confirming',
          pendingAction: {
            command: { ...command, type: 'swap' }, // Treat as swap for execution
            fromToken: fromTokenInfo,
            toToken: toTokenInfo,
            quote: {
              inAmount: orderResult.inAmount!,
              outAmount: orderResult.outAmount!,
              priceImpact: orderResult.priceImpact || '0',
              routeLabel: orderResult.routeLabel,
            },
          },
        });
        break;
      }

      case 'rwa_withdraw': {
        // RWA withdraw is essentially a swap from USDY to USDC/SOL
        const { amount, fromTokenRaw, toTokenRaw, fromMint, toMint } = command.params;
        
        if (!fromMint) {
          updateMessage(messageId, {
            content: `❌ Unknown RWA token: \`${fromTokenRaw}\``,
            status: 'error',
          });
          return;
        }
        
        if (!toMint) {
          updateMessage(messageId, {
            content: `❌ Unknown token: \`${toTokenRaw}\`\n\n${getSupportedTokensHelp()}`,
            status: 'error',
          });
          return;
        }
        
        updateMessage(messageId, { content: 'Getting withdrawal quote...', status: 'thinking' });
        
        const [fromTokenInfo, toTokenInfo] = await Promise.all([
          getTokenInfo(fromMint),
          getTokenInfo(toMint),
        ]);
        
        if (!fromTokenInfo || !toTokenInfo) {
          updateMessage(messageId, {
            content: `❌ Could not find token info.`,
            status: 'error',
          });
          return;
        }
        
        // Get swap quote
        const orderResult = await getSwapOrder(fromMint, toMint, amount, fromTokenInfo.decimals);
        
        if (!orderResult.success) {
          updateMessage(messageId, {
            content: `❌ **Withdrawal not available**\n\n${orderResult.errorMessage || 'Could not get quote from Jupiter.'}`,
            status: 'error',
          });
          return;
        }
        
        const outAmountNum = parseInt(orderResult.outAmount!) / Math.pow(10, toTokenInfo.decimals);
        
        let confirmMsg = `🔓 **Withdraw from RWA**\n\n`;
        confirmMsg += `**From:** ${amount} ${fromTokenInfo.symbol}\n`;
        confirmMsg += `**To:** ~${outAmountNum.toFixed(4)} ${toTokenInfo.symbol}\n\n`;
        confirmMsg += `Type **confirm** to withdraw or **cancel** to abort.`;
        
        updateMessage(messageId, {
          content: confirmMsg,
          status: 'confirming',
          pendingAction: {
            command: { ...command, type: 'swap' }, // Treat as swap for execution
            fromToken: fromTokenInfo,
            toToken: toTokenInfo,
            quote: {
              inAmount: orderResult.inAmount!,
              outAmount: orderResult.outAmount!,
              priceImpact: orderResult.priceImpact || '0',
              routeLabel: orderResult.routeLabel,
            },
          },
        });
        break;
      }
      
      default: {
        updateMessage(messageId, {
          content: `I didn't understand that command.\n\n${getHelpMessage()}`,
          status: 'done',
        });
      }
    }
  };

  // Handle confirmation
  const handleConfirm = async (pendingMessage: Message) => {
    if (!pendingMessage.pendingAction || !connected || !publicKey || !signTransaction) {
      addMessage({
        role: 'assistant',
        content: '❌ Cannot execute: Wallet not connected or invalid state.',
        status: 'error',
      });
      return;
    }
    
    const { command, fromToken, toToken, quote } = pendingMessage.pendingAction;
    const messageId = addMessage({ role: 'assistant', content: '🔄 Executing...', status: 'executing' });
    
    if (command.type === 'swap' && fromToken && toToken) {
      const { amount, fromMint, toMint } = command.params;
      
      const result = await executeSwap(
        connection,
        { publicKey, signTransaction, signAndSendTransaction },
        fromMint,
        toMint,
        amount,
        fromToken.decimals,
        toToken.decimals
      );
      
      if (result.success) {
        updateMessage(messageId, {
          content: `✅ **Swap Successful!**\n\n**Swapped:** ${amount} ${fromToken.symbol}\n**Received:** ${result.outAmount} ${toToken.symbol}\n\n🔄 Refreshing in 2s...`,
          status: 'done',
          txSignature: result.signature,
        });
        
        // Record to session history
        addSessionTransaction({
          type: 'swap',
          status: 'success',
          signature: result.signature!,
          details: {
            fromToken: fromToken.symbol,
            toToken: toToken.symbol,
            fromAmount: amount,
            toAmount: parseFloat(result.outAmount || '0'),
          },
        });
        
        // Auto refresh after 2 seconds
        setTimeout(() => window.location.reload(), 2000);
      } else {
        updateMessage(messageId, {
          content: `❌ **Swap Failed**\n\n${result.error || 'Unknown error'}\n\n🔄 Refreshing in 2s...`,
          status: 'error',
          txSignature: result.signature,
        });
        
        // Auto refresh after 2 seconds
        setTimeout(() => window.location.reload(), 2000);
      }
    } else if (command.type === 'transfer' && fromToken) {
      const { amount, tokenMint, destination } = command.params;
      
      const result = await executeTransfer(
        connection,
        { publicKey, signTransaction, signAndSendTransaction },
        tokenMint,
        amount,
        destination,
        fromToken.decimals
      );
      
      if (result.success) {
        updateMessage(messageId, {
          content: `✅ **Transfer Successful!**\n\n**Sent:** ${amount} ${fromToken.symbol}\n**To:** \`${formatAddress(destination)}\`\n\n🔄 Refreshing in 2s...`,
          status: 'done',
          txSignature: result.signature,
        });
        
        // Record to session history
        addSessionTransaction({
          type: 'transfer',
          status: 'success',
          signature: result.signature!,
          details: {
            fromToken: fromToken.symbol,
            fromAmount: amount,
            destination,
          },
        });
        
        // Auto refresh after 2 seconds
        setTimeout(() => window.location.reload(), 2000);
      } else {
        updateMessage(messageId, {
          content: `❌ **Transfer Failed**\n\n${result.error || 'Unknown error'}\n\n🔄 Refreshing in 2s...`,
          status: 'error',
        });
        
        // Auto refresh after 2 seconds
        setTimeout(() => window.location.reload(), 2000);
      }
    } else if (command.type === 'dca' && fromToken && toToken) {
      // DCA vault creation
      const { totalAmount, fromMint, toMint, frequency, duration } = command.params;
      
      try {
        const result = await createDcaVault(
          connection,
          { publicKey, signTransaction, signAndSendTransaction },
          new PublicKey(fromMint),
          new PublicKey(toMint),
          {
            totalAmount,
            tokenDecimals: fromToken.decimals,
            frequency,
            duration,
          }
        );
        
        if (result.success) {
          updateMessage(messageId, {
            content: `✅ **DCA Vault Created!**\n\n**Vault:** \`${result.vaultAddress}\`\n**Total:** ${totalAmount} ${fromToken.symbol}\n**To:** ${toToken.symbol}\n**Frequency:** ${frequency}\n**Duration:** ${duration} periods\n\nThe keeper service will automatically execute your DCA with privacy features.\n\n🔄 Refreshing in 2s...`,
            status: 'done',
            txSignature: result.signature,
          });
          
          // Record to session history
          addSessionTransaction({
            type: 'dca' as any,
            status: 'success',
            signature: result.signature!,
            details: {
              fromToken: fromToken.symbol,
              toToken: toToken.symbol,
              fromAmount: totalAmount,
            },
          });
          
          // Auto refresh after 2 seconds
          setTimeout(() => window.location.reload(), 2000);
        } else {
          updateMessage(messageId, {
            content: `❌ **DCA Creation Failed**\n\n${result.error}\n\n🔄 Refreshing in 2s...`,
            status: 'error',
          });
          
          // Auto refresh after 2 seconds
          setTimeout(() => window.location.reload(), 2000);
        }
      } catch (error: any) {
        updateMessage(messageId, {
          content: `❌ **DCA Creation Failed**\n\n${error.message}\n\n🔄 Refreshing in 2s...`,
          status: 'error',
        });
        
        // Auto refresh after 2 seconds
        setTimeout(() => window.location.reload(), 2000);
      }
    } else if (command.type === 'withdraw_dca' && fromToken && toToken) {
      // Withdraw from DCA vault
      const { fromMint, toMint } = command.params;
      
      try {
        const result = await withdrawDcaVault(
          connection,
          { publicKey, signTransaction, signAndSendTransaction },
          new PublicKey(fromMint),
          new PublicKey(toMint)
        );
        
        if (result.success) {
          updateMessage(messageId, {
            content: `✅ **DCA Vault Withdrawn!**\n\n**Pair:** ${fromToken.symbol} → ${toToken.symbol}\n\nYour remaining funds have been returned to your wallet.\n\nThe vault is now deactivated.\n\n🔄 Refreshing in 2s...`,
            status: 'done',
            txSignature: result.signature,
          });
          
          // Record to session history
          addSessionTransaction({
            type: 'dca' as any,
            status: 'success',
            signature: result.signature!,
            details: {
              fromToken: fromToken.symbol,
              toToken: toToken.symbol,
              fromAmount: 0,
            },
          });
          
          // Auto refresh after 2 seconds
          setTimeout(() => window.location.reload(), 2000);
        } else {
          updateMessage(messageId, {
            content: `❌ **Withdraw Failed**\n\n${result.error || 'Unknown error'}\n\nMake sure the vault exists and has funds to withdraw.\n\n🔄 Refreshing in 2s...`,
            status: 'error',
          });
          
          // Auto refresh after 2 seconds
          setTimeout(() => window.location.reload(), 2000);
        }
      } catch (error: any) {
        updateMessage(messageId, {
          content: `❌ **Withdraw Failed**\n\n${error.message}\n\n🔄 Refreshing in 2s...`,
          status: 'error',
        });
        
        // Auto refresh after 2 seconds
        setTimeout(() => window.location.reload(), 2000);
      }
    } else if (command.type === 'close_dca' && fromToken && toToken) {
      // Close empty DCA vault to reclaim rent
      const { fromMint, toMint } = command.params;
      
      try {
        const result = await closeDcaVault(
          connection,
          { publicKey, signTransaction, signAndSendTransaction },
          new PublicKey(fromMint),
          new PublicKey(toMint)
        );
        
        if (result.success) {
          updateMessage(messageId, {
            content: `✅ **DCA Vault Closed!**\n\n**Pair:** ${fromToken.symbol} → ${toToken.symbol}\n\nThe vault has been permanently closed and ~0.002 SOL rent has been returned to your wallet.\n\n🔄 Refreshing in 2s...`,
            status: 'done',
            txSignature: result.signature,
          });
          
          // Record to session history
          addSessionTransaction({
            type: 'dca' as any,
            status: 'success',
            signature: result.signature!,
            details: {
              fromToken: fromToken.symbol,
              toToken: toToken.symbol,
              fromAmount: 0,
            },
          });
          
          // Auto refresh after 2 seconds
          setTimeout(() => window.location.reload(), 2000);
        } else {
          updateMessage(messageId, {
            content: `❌ **Close Failed**\n\n${result.error || 'Unknown error'}\n\nMake sure the vault is empty. Use \`Withdraw DCA\` first to get your funds back.\n\n🔄 Refreshing in 2s...`,
            status: 'error',
          });
          
          // Auto refresh after 2 seconds
          setTimeout(() => window.location.reload(), 2000);
        }
      } catch (error: any) {
        updateMessage(messageId, {
          content: `❌ **Close Failed**\n\n${error.message}\n\n🔄 Refreshing in 2s...`,
          status: 'error',
        });
        
        // Auto refresh after 2 seconds
        setTimeout(() => window.location.reload(), 2000);
      }
    } else if (command.type === 'limit_order' && fromToken && toToken) {
      // Create limit order
      const { amount, fromMint, toMint, triggerPrice, triggerType, expiryHours } = command.params;
      
      try {
        const result = await createLimitOrder(
          connection,
          { publicKey, signTransaction, signAndSendTransaction },
          {
            inputMint: new PublicKey(fromMint),
            outputMint: new PublicKey(toMint),
            amount,
            tokenDecimals: fromToken.decimals,
            triggerPrice,
            triggerType: triggerType === 'above' ? TriggerType.PriceAbove : TriggerType.PriceBelow,
            expiryHours: expiryHours || 24,
          }
        );
        
        if (result.success) {
          updateMessage(messageId, {
            content: `✅ **Limit Order Created!**\n\n**Vault:** \`${result.vaultAddress}\`\n**Amount:** ${amount} ${fromToken.symbol}\n**Target:** ${toToken.symbol}\n**Trigger:** $${triggerPrice}\n**Expires:** ${expiryHours || 24} hours\n\nThe keeper will monitor and execute when price target is hit.\n\n🔄 Refreshing in 2s...`,
            status: 'done',
            txSignature: result.signature,
          });
          
          // Record to session history
          addSessionTransaction({
            type: 'limit_order' as any,
            status: 'success',
            signature: result.signature!,
            details: {
              fromToken: fromToken.symbol,
              toToken: toToken.symbol,
              fromAmount: amount,
            },
          });
          
          // Auto refresh after 2 seconds
          setTimeout(() => window.location.reload(), 2000);
        } else {
          updateMessage(messageId, {
            content: `❌ **Limit Order Failed**\n\n${result.error}\n\n🔄 Refreshing in 2s...`,
            status: 'error',
          });
          
          // Auto refresh after 2 seconds
          setTimeout(() => window.location.reload(), 2000);
        }
      } catch (error: any) {
        updateMessage(messageId, {
          content: `❌ **Limit Order Failed**\n\n${error.message}\n\n🔄 Refreshing in 2s...`,
          status: 'error',
        });
        
        // Auto refresh after 2 seconds
        setTimeout(() => window.location.reload(), 2000);
      }
    } else if (command.type === 'cancel_limit_order') {
      // Cancel limit order
      const { vaultAddress } = command.params;
      
      if (!vaultAddress) {
        updateMessage(messageId, {
          content: `❌ No vault address specified.`,
          status: 'error',
        });
        return;
      }
      
      try {
        // First withdraw funds
        const withdrawResult = await withdrawIntent(
          connection,
          { publicKey, signTransaction, signAndSendTransaction },
          new PublicKey(vaultAddress)
        );
        
        if (withdrawResult.success) {
          // Then close the vault
          const closeResult = await closeIntent(
            connection,
            { publicKey, signTransaction, signAndSendTransaction },
            new PublicKey(vaultAddress)
          );
          
          updateMessage(messageId, {
            content: `✅ **Limit Order Cancelled!**\n\nYour funds have been returned to your wallet.\n\n🔄 Refreshing in 2s...`,
            status: 'done',
            txSignature: withdrawResult.signature,
          });
          
          // Auto refresh after 2 seconds
          setTimeout(() => window.location.reload(), 2000);
        } else {
          updateMessage(messageId, {
            content: `❌ **Cancel Failed**\n\n${withdrawResult.error}\n\n🔄 Refreshing in 2s...`,
            status: 'error',
          });
          
          // Auto refresh after 2 seconds
          setTimeout(() => window.location.reload(), 2000);
        }
      } catch (error: any) {
        updateMessage(messageId, {
          content: `❌ **Cancel Failed**\n\n${error.message}\n\n🔄 Refreshing in 2s...`,
          status: 'error',
        });
        
        // Auto refresh after 2 seconds
        setTimeout(() => window.location.reload(), 2000);
      }
    } else if (command.type === 'burn' && fromToken) {
      // Burn tokens
      const { burnAmount, tokenMint } = command.params;
      
      try {
        const result = await executeBurn(
          connection,
          { publicKey, signTransaction, signAndSendTransaction },
          tokenMint,
          burnAmount,
          fromToken.decimals
        );
        
        if (result.success) {
          updateMessage(messageId, {
            content: `🔥 **Burn Successful!**\n\n**Burned:** ${burnAmount.toLocaleString()} ${fromToken.symbol}\n**Token:** \`${formatAddress(tokenMint)}\`\n\nTokens have been permanently destroyed.\n\n🔄 Refreshing in 2s...`,
            status: 'done',
            txSignature: result.signature,
          });
          
          // Record to session history
          addSessionTransaction({
            type: 'burn' as any,
            status: 'success',
            signature: result.signature!,
            details: {
              fromToken: fromToken.symbol,
              fromAmount: burnAmount,
            },
          });
          
          // Auto refresh after 2 seconds
          setTimeout(() => window.location.reload(), 2000);
        } else {
          updateMessage(messageId, {
            content: `❌ **Burn Failed**\n\n${result.error || 'Unknown error'}\n\n🔄 Refreshing in 2s...`,
            status: 'error',
          });
          
          // Auto refresh after 2 seconds
          setTimeout(() => window.location.reload(), 2000);
        }
      } catch (error: any) {
        updateMessage(messageId, {
          content: `❌ **Burn Failed**\n\n${error.message}\n\n🔄 Refreshing in 2s...`,
          status: 'error',
        });
        
        // Auto refresh after 2 seconds
        setTimeout(() => window.location.reload(), 2000);
      }
    } else if (command.type === 'create_drop' && fromToken) {
      // Create drop link
      const { amount, tokenMint, decimals, isNativeSol, recipient, expiryHours } = command.params;
      
      try {
        const result = await createDrop(
          connection,
          { publicKey, signTransaction, signAndSendTransaction },
          isNativeSol ? null : tokenMint,
          amount,
          decimals,
          expiryHours || 168
        );
        
        if (result.success) {
          // Auto-download drop link as txt file
          const dropContent = `KRYPTOS Drop Link
================

Drop Link: ${result.dropLink}

Details:
- Token: ${fromToken.symbol}
- Amount: ${amount} ${fromToken.symbol}
- Recipient: ${recipient || 'Anyone with link'}
- Expires: ${expiryHours || 168} hours
- Drop ID: ${result.dropId}
- Escrow: ${result.escrowAddress}
- Transaction: https://solscan.io/tx/${result.signature}

Created: ${new Date().toLocaleString()}

Share this link with anyone to let them claim the ${fromToken.symbol}!
`;
          
          const blob = new Blob([dropContent], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `kryptos-drop-${result.dropId}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          let successMsg = `✅ **Drop Link Created!**\n\n`;
          if (recipient) {
            successMsg += `**For:** ${recipient}\n`;
          }
          successMsg += `**Amount:** ${amount} ${fromToken.symbol}\n`;
          successMsg += `**Expires:** ${expiryHours || 168} hours\n\n`;
          successMsg += `🔗 **Share this link (click to copy):**\n${result.dropLink}\n\n`;
          successMsg += `Anyone with this link can claim the ${fromToken.symbol}!\n\n`;
          successMsg += `💾 **Link saved to:** \`kryptos-drop-${result.dropId}.txt\``;
          
          updateMessage(messageId, {
            content: successMsg,
            status: 'done',
            txSignature: result.signature,
          });
          
          // Record to session history
          addSessionTransaction({
            type: 'drop' as any,
            status: 'success',
            signature: result.signature!,
            details: {
              fromToken: fromToken.symbol,
              fromAmount: amount,
              destination: recipient || 'Drop Link',
            },
          });
          
          // NO auto refresh - keep the link visible
        } else {
          updateMessage(messageId, {
            content: `❌ **Drop Creation Failed**\n\n${result.error}`,
            status: 'error',
          });
        }
      } catch (error: any) {
        updateMessage(messageId, {
          content: `❌ **Drop Creation Failed**\n\n${error.message}`,
          status: 'error',
        });
      }
    }
  };

  // Handle send - Using LLM for natural language parsing
  const handleSend = async () => {
    if (!input.trim() || isProcessing) return;
    
    const userInput = input.trim();
    setInput('');
    
    // Find pending message BEFORE adding user message
    const pendingMsg = [...messages].reverse().find(m => m.role === 'assistant' && m.status === 'confirming');
    
    // Add user message
    addMessage({ role: 'user', content: userInput });

    // Clear old pending confirmations if user starts new command (not confirm/cancel)
    if (!['confirm', 'cancel', 'yes', 'no', 'ok'].includes(userInput.toLowerCase().trim())) {
      setMessages(prev => prev.map(m => 
        m.status === 'confirming' ? { ...m, status: 'done' as MessageStatus } : m
      ));
    }

    setIsProcessing(true);
    const messageId = addMessage({ role: 'assistant', content: 'Thinking...', status: 'thinking' });
    
    try {
      // Use LLM to parse intent
      const llmResult = await parseWithLLM(userInput);
      
      // Handle confirm/cancel for pending actions
      if (pendingMsg?.pendingAction) {
        if (llmResult.intent === 'confirm') {
          updateMessage(messageId, { content: 'Executing...', status: 'executing' });
          await handleConfirm(pendingMsg);
          // Remove the "Executing..." message since handleConfirm adds its own
          setMessages(prev => prev.filter(m => m.id !== messageId));
          setIsProcessing(false);
          return;
        }
        
        if (llmResult.intent === 'cancel') {
          updateMessage(messageId, {
            content: llmResult.message || 'Transaction cancelled.',
            status: 'done',
          });
          setIsProcessing(false);
          return;
        }
      }
      
      // Handle different intents
      switch (llmResult.intent) {
        case 'swap': {
          const { amount, fromToken, toToken } = llmResult.params;
          let fromMint = resolveToken(fromToken) || fromToken;
          let toMint = resolveToken(toToken) || toToken;
          
          // If toMint is not a valid Solana address, search for the token
          if (!isValidAddress(toMint)) {
            const searchResults = await searchToken(toToken);
            if (searchResults.length > 0) {
              toMint = searchResults[0].mint;
              console.log(`Resolved "${toToken}" to mint: ${toMint}`);
            }
          }
          
          // Same for fromMint
          if (!isValidAddress(fromMint)) {
            const searchResults = await searchToken(fromToken);
            if (searchResults.length > 0) {
              fromMint = searchResults[0].mint;
              console.log(`Resolved "${fromToken}" to mint: ${fromMint}`);
            }
          }
          
          const command: ParsedCommand = {
            type: 'swap',
            params: {
              amount,
              fromTokenRaw: fromToken,
              toTokenRaw: toToken,
              fromMint,
              toMint,
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }
        
        case 'transfer': {
          const { amount, token, destination } = llmResult.params;
          const tokenMint = resolveToken(token) || token;
          
          const command: ParsedCommand = {
            type: 'transfer',
            params: {
              amount,
              tokenRaw: token,
              tokenMint: token.toUpperCase() === 'SOL' ? null : tokenMint,
              destination,
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }
        
        case 'balance': {
          const command: ParsedCommand = { type: 'balance', params: {}, raw: userInput };
          await processCommand(command, messageId);
          break;
        }
        
        case 'price': {
          const { token } = llmResult.params;
          const mint = resolveToken(token) || token;
          
          const command: ParsedCommand = {
            type: 'price',
            params: { tokenRaw: token, mint },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }
        
        case 'token': {
          const { token } = llmResult.params;
          const mint = resolveToken(token) || token;
          
          const command: ParsedCommand = {
            type: 'token',
            params: { mint },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }
        
        case 'dca': {
          const { totalAmount, fromToken, toToken, frequency, duration } = llmResult.params;
          
          const command: ParsedCommand = {
            type: 'dca',
            params: {
              totalAmount,
              fromTokenRaw: fromToken,
              toTokenRaw: toToken,
              fromMint: resolveToken(fromToken) || fromToken,
              toMint: resolveToken(toToken) || toToken,
              frequency: frequency || 'daily',
              duration: duration || 7,
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }
        
        case 'withdraw_dca': {
          const { fromToken, toToken } = llmResult.params || {};
          
          const command: ParsedCommand = {
            type: 'withdraw_dca',
            params: {
              fromTokenRaw: fromToken || null,
              toTokenRaw: toToken || null,
              fromMint: fromToken ? (resolveToken(fromToken) || fromToken) : null,
              toMint: toToken ? (resolveToken(toToken) || toToken) : null,
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }
        
        case 'list_dca': {
          const command: ParsedCommand = {
            type: 'list_dca',
            params: {},
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }

        case 'close_dca': {
          const { fromToken, toToken } = llmResult.params || {};
          
          const command: ParsedCommand = {
            type: 'close_dca',
            params: {
              fromTokenRaw: fromToken || null,
              toTokenRaw: toToken || null,
              fromMint: fromToken ? (resolveToken(fromToken) || fromToken) : null,
              toMint: toToken ? (resolveToken(toToken) || toToken) : null,
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }

        case 'limit_order': {
          const { amount, fromToken, toToken, triggerPrice, triggerType, expiryHours } = llmResult.params;
          
          const command: ParsedCommand = {
            type: 'limit_order',
            params: {
              amount,
              fromTokenRaw: fromToken,
              toTokenRaw: toToken,
              fromMint: resolveToken(fromToken) || fromToken,
              toMint: resolveToken(toToken) || toToken,
              triggerPrice,
              triggerType: triggerType || 'below',
              expiryHours: expiryHours || 24,
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }

        case 'list_limit_orders': {
          const command: ParsedCommand = {
            type: 'list_limit_orders',
            params: {},
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }

        case 'cancel_limit_order': {
          const { vaultAddress, orderIndex } = llmResult.params || {};
          
          const command: ParsedCommand = {
            type: 'cancel_limit_order',
            params: {
              vaultAddress: vaultAddress || null,
              orderIndex: orderIndex || null,
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }

        case 'burn': {
          const { amount, token } = llmResult.params;
          const tokenMint = resolveToken(token) || token;
          
          // Determine if it's percentage or all
          const amountStr = String(amount);
          const isPercentage = amountStr.includes('%');
          const isAll = amountStr.toLowerCase() === 'all';
          
          const command: ParsedCommand = {
            type: 'burn',
            params: {
              amountStr,
              tokenRaw: token,
              tokenMint,
              isPercentage,
              isAll,
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }

         case 'create_drop': {
          const { amount, token, recipient, expiryHours } = llmResult.params;
          
          const command: ParsedCommand = {
            type: 'create_drop',
            params: {
              amount,
              token,
              recipient: recipient || null,
              expiryHours: expiryHours || 168,
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }

        case 'rwa_info': {
          const { symbol } = llmResult.params || {};
          
          const command: ParsedCommand = {
            type: 'rwa_info',
            params: {
              symbol: symbol || 'USDY',
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }

        case 'rwa_portfolio': {
          const command: ParsedCommand = {
            type: 'rwa_portfolio',
            params: {},
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }

        case 'rwa_calculate': {
          const { amount, months } = llmResult.params || {};
          
          const command: ParsedCommand = {
            type: 'rwa_calculate',
            params: {
              amount: amount || 1000,
              months: months || 12,
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }

        case 'rwa_deposit': {
          const { amount, fromToken, toToken } = llmResult.params;
          
          const command: ParsedCommand = {
            type: 'rwa_deposit',
            params: {
              amount,
              fromTokenRaw: fromToken,
              toTokenRaw: toToken || 'USDY',
              fromMint: resolveToken(fromToken) || fromToken,
              toMint: resolveToken(toToken || 'USDY') || USDY_MINT,
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }

        case 'rwa_withdraw': {
          const { amount, fromToken, toToken } = llmResult.params;
          
          const command: ParsedCommand = {
            type: 'rwa_withdraw',
            params: {
              amount,
              fromTokenRaw: fromToken || 'USDY',
              toTokenRaw: toToken,
              fromMint: resolveToken(fromToken || 'USDY') || USDY_MINT,
              toMint: resolveToken(toToken) || toToken,
            },
            raw: userInput,
          };
          await processCommand(command, messageId);
          break;
        }
        
        case 'help': {
          updateMessage(messageId, { content: getHelpMessage(), status: 'done' });
          break;
        }
        
        case 'conversation':
        case 'unclear':
        default: {
          // LLM response langsung ditampilkan
          updateMessage(messageId, {
            content: llmResult.message,
            status: 'done',
          });
        }
      }
    } catch (error: any) {
      updateMessage(messageId, {
        content: `❌ Error: ${error.message}`,
        status: 'error',
      });
    }
    
    setIsProcessing(false);
  };

  // Example commands
  const exampleCommands = [
    'Swap 0.01 SOL to USDC',
    'Swap 0.01 SOL to EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'Balance',
    'Price of SOL',
    'Token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  ];

  return (
    <main className="h-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Header - Fixed at top */}
      <header className="flex-shrink-0 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm z-50">
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-2 md:py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 md:gap-3 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="KRYPTOS" className="w-7 h-7 md:w-10 md:h-10" />
            <div>
              <h1 className="text-sm md:text-lg font-bold text-white">KRYPTOS</h1>
              <p className="text-[10px] md:text-xs text-zinc-500 hidden sm:block">Private DeFi Agent</p>
            </div>
          </Link>
          
          <div className="flex items-center gap-2 md:gap-4">
            <div className="hidden sm:flex items-center gap-2 text-xs md:text-sm text-gray-400">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-white rounded-full animate-pulse"></div>
              Mainnet
            </div>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-1.5 md:p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-white"
              title="Transaction History"
            >
              <History className="w-4 h-4 md:w-5 md:h-5" />
            </button>
            <div className="scale-75 md:scale-100 origin-right">
              <WalletMultiButton className="!bg-white hover:!bg-zinc-200 !text-zinc-900 !rounded-xl !py-2 !px-4 !text-sm !font-medium" />
            </div>
          </div>
        </div>
      </header>

      {/* Chat Area - Scrollable */}
      <div className="flex-1 overflow-y-auto relative">
        {/* Fixed Background Layer */}
        <div className="fixed inset-0 top-[65px] bottom-[85px] pointer-events-none z-0">
          <div className="absolute inset-0 bg-zinc-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(255,255,255,0.03),transparent),radial-gradient(ellipse_60%_40%_at_100%_100%,rgba(255,255,255,0.02),transparent),radial-gradient(ellipse_40%_30%_at_0%_100%,rgba(255,255,255,0.015),transparent)]" />
          <div 
            className="absolute inset-0 opacity-100"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
              maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black, transparent)',
              WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black, transparent)',
            }}
          />
        </div>
        
        {/* Scrollable Content */}
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6 space-y-3 md:space-y-4 relative z-10">
          {messages.map(message => (
            <ChatMessage key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-950 backdrop-blur-sm z-50">
        {/* Example Commands */}
        {messages.length <= 2 && (
          <div className="max-w-7xl mx-auto px-3 md:px-6 pt-3 md:pt-4">
            <div className="flex items-center gap-2 text-gray-400 text-xs md:text-sm mb-2">
              <Sparkles className="w-3 h-3 md:w-4 md:h-4" />
              Try these:
            </div>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {exampleCommands.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => setInput(cmd)}
                  className="px-2 md:px-3 py-1.5 md:py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-xs md:text-sm text-zinc-300 hover:bg-zinc-800/50 hover:border-white/50 transition-colors"
                >
                  {cmd.length > 30 ? cmd.slice(0, 27) + '...' : cmd}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="max-w-7xl mx-auto px-3 md:px-6 py-3 md:py-4">
          <div className="flex gap-2 md:gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={connected ? "Swap 0.01 SOL to USDC..." : "Connect wallet to start..."}
              disabled={!connected || isProcessing}
              className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-lg md:rounded-xl px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base text-white placeholder-zinc-500 focus:outline-none focus:border-white/50 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!connected || !input.trim() || isProcessing}
              className="px-3 md:px-4 py-2.5 md:py-3 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:opacity-50 rounded-lg md:rounded-xl text-zinc-900 transition-colors"
            >
              <Send className="w-4 h-4 md:w-5 md:h-5" />
            </button>
          </div>
          <div className="text-center text-[10px] md:text-xs text-gray-500 mt-2">
            Privacy and Private first • Supports any token via contract address
          </div>
        </div>
      </div>
      
      {/* Transaction History Sidebar */}
      <TransactionHistory
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        walletAddress={publicKey?.toBase58() || null}
        sessionTransactions={sessionTransactions}
      />
    </main>
  );
}