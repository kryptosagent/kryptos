'use client';

import { useState, useRef, useEffect } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { 
  createDcaVault, 
  withdrawDcaVault,
  closeDcaVault,
  getDcaVaultInfo 
} from '@/lib/kryptos-contract';
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
  ParsedCommand,
  TokenInfo
} from '@/lib/agent';
import { parseWithLLM } from '@/lib/llm';
import Link from 'next/link';

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
  const formatText = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\)|\n)/g);
    
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="bg-zinc-800/50 px-1.5 py-0.5 rounded text-white text-sm font-mono">{part.slice(1, -1)}</code>;
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
              className="text-white hover:text-zinc-300 underline inline-flex items-center gap-1"
            >
              {match[1]}
              <ExternalLink className="w-3 h-3" />
            </a>
          );
        }
      }
      if (part === '\n') {
        return <br key={i} />;
      }
      return part;
    });
  };

  return <div className="whitespace-pre-wrap">{formatText(content)}</div>;
}

// Chat message component
function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isUser ? 'bg-white/10' : 'bg-zinc-800'
      }`}>
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-zinc-300" />
        )}
      </div>
      
      {/* Message bubble */}
      <div className={`max-w-[80%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`rounded-2xl px-4 py-3 ${
        isUser 
          ? 'bg-white/10 text-white' 
          : message.status === 'error'
            ? 'bg-red-500/10 border border-red-500/30'
            : 'bg-zinc-900/80 text-zinc-100'
      }`}>
          {/* Status indicator */}
          {message.status === 'thinking' && (
            <div className="flex items-center gap-2 text-zinc-300 mb-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Processing...</span>
            </div>
          )}
          {message.status === 'executing' && (
            <div className="flex items-center gap-2 text-yellow-400 mb-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Executing transaction...</span>
            </div>
          )}
          
          <FormattedMessage content={message.content} />
          
          {/* Transaction link */}
          {message.txSignature && (
            <a 
              href={`https://solscan.io/tx/${message.txSignature}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-white hover:text-zinc-300 text-sm"
            >
              View on Solscan
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          
          {/* Status icons */}
          {message.status === 'done' && (
            <div className="flex items-center gap-1 text-zinc-400 mt-2">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">Completed</span>
            </div>
          )}
          {message.status === 'error' && (
            <div className="flex items-center gap-1 text-red-400 mt-2">
              <XCircle className="w-4 h-4" />
              <span className="text-sm">Failed</span>
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
  const { publicKey, signTransaction, connected } = useWallet();
  
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
          let errorMsg = `❌ **Swap tidak tersedia**\n\n`;
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
            errorMsg += `⚠️ **Token masih di bonding curve pump.fun**\n`;
            errorMsg += `Jupiter belum support token ini. Tunggu token graduated ke Raydium atau swap langsung di pump.fun.\n`;
          } else if (toTokenInfo.liquidity && toTokenInfo.liquidity < 1000) {
            errorMsg += `⚠️ **Liquidity sangat rendah** ($${toTokenInfo.liquidity?.toLocaleString() || '0'})\n`;
            errorMsg += `Token mungkin tidak memiliki cukup liquidity untuk di-swap.\n`;
          } else {
            errorMsg += `ℹ️ Jupiter Ultra mungkin belum support pair ini.\n`;
            errorMsg += `Coba swap token populer seperti SOL, USDC, JUP, BONK.\n`;
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
        { publicKey, signTransaction },
        fromMint,
        toMint,
        amount,
        fromToken.decimals,
        toToken.decimals
      );
      
      if (result.success) {
        updateMessage(messageId, {
          content: `✅ **Swap Successful!**\n\n**Swapped:** ${amount} ${fromToken.symbol}\n**Received:** ${result.outAmount} ${toToken.symbol}`,
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
      } else {
        updateMessage(messageId, {
          content: `❌ **Swap Failed**\n\n${result.error || 'Unknown error'}`,
          status: 'error',
          txSignature: result.signature,
        });
      }
    } else if (command.type === 'transfer' && fromToken) {
      const { amount, tokenMint, destination } = command.params;
      
      const result = await executeTransfer(
        connection,
        { publicKey, signTransaction },
        tokenMint,
        amount,
        destination,
        fromToken.decimals
      );
      
      if (result.success) {
        updateMessage(messageId, {
          content: `✅ **Transfer Successful!**\n\n**Sent:** ${amount} ${fromToken.symbol}\n**To:** \`${formatAddress(destination)}\``,
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
      } else {
        updateMessage(messageId, {
          content: `❌ **Transfer Failed**\n\n${result.error || 'Unknown error'}`,
          status: 'error',
        });
      }
    } else if (command.type === 'dca' && fromToken && toToken) {
      // DCA vault creation
      const { totalAmount, fromMint, toMint, frequency, duration } = command.params;
      
      try {
        const result = await createDcaVault(
          connection,
          { publicKey, signTransaction },
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
            content: `✅ **DCA Vault Created!**\n\n**Vault:** \`${result.vaultAddress}\`\n**Total:** ${totalAmount} ${fromToken.symbol}\n**To:** ${toToken.symbol}\n**Frequency:** ${frequency}\n**Duration:** ${duration} periods\n\nThe keeper service will automatically execute your DCA with privacy features.`,
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
        } else {
          updateMessage(messageId, {
            content: `❌ **DCA Creation Failed**\n\n${result.error}`,
            status: 'error',
          });
        }
      } catch (error: any) {
        updateMessage(messageId, {
          content: `❌ **DCA Creation Failed**\n\n${error.message}`,
          status: 'error',
        });
      }
    } else if (command.type === 'withdraw_dca' && fromToken && toToken) {
      // Withdraw from DCA vault
      const { fromMint, toMint } = command.params;
      
      try {
        const result = await withdrawDcaVault(
          connection,
          { publicKey, signTransaction },
          new PublicKey(fromMint),
          new PublicKey(toMint)
        );
        
        if (result.success) {
          updateMessage(messageId, {
            content: `✅ **DCA Vault Withdrawn!**\n\n**Pair:** ${fromToken.symbol} → ${toToken.symbol}\n\nYour remaining funds have been returned to your wallet.\n\nThe vault is now deactivated.`,
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
        } else {
          updateMessage(messageId, {
            content: `❌ **Withdraw Failed**\n\n${result.error || 'Unknown error'}\n\nMake sure the vault exists and has funds to withdraw.`,
            status: 'error',
          });
        }
      } catch (error: any) {
        updateMessage(messageId, {
          content: `❌ **Withdraw Failed**\n\n${error.message}`,
          status: 'error',
        });
      }
    } else if (command.type === 'close_dca' && fromToken && toToken) {
      // Close empty DCA vault to reclaim rent
      const { fromMint, toMint } = command.params;
      
      try {
        const result = await closeDcaVault(
          connection,
          { publicKey, signTransaction },
          new PublicKey(fromMint),
          new PublicKey(toMint)
        );
        
        if (result.success) {
          updateMessage(messageId, {
            content: `✅ **DCA Vault Closed!**\n\n**Pair:** ${fromToken.symbol} → ${toToken.symbol}\n\nThe vault has been permanently closed and ~0.002 SOL rent has been returned to your wallet.`,
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
        } else {
          updateMessage(messageId, {
            content: `❌ **Close Failed**\n\n${result.error || 'Unknown error'}\n\nMake sure the vault is empty. Use \`Withdraw DCA\` first to get your funds back.`,
            status: 'error',
          });
        }
      } catch (error: any) {
        updateMessage(messageId, {
          content: `❌ **Close Failed**\n\n${error.message}`,
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
    const pendingMsg = messages.find(m => m.role === 'assistant' && m.status === 'confirming');
    
    // Add user message
    addMessage({ role: 'user', content: userInput });
    
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
          const fromMint = resolveToken(fromToken) || fromToken;
          const toMint = resolveToken(toToken) || toToken;
          
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
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <img src="/logo.png" alt="KRYPTOS" className="w-10 h-10" />
            <div>
              <h1 className="text-lg font-bold text-white">KRYPTOS</h1>
              <p className="text-xs text-zinc-500">Private DeFi Agent</p>
            </div>
          </Link>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              Mainnet
            </div>
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-500 hover:text-white"
              title="Transaction History"
            >
              <History className="w-5 h-5" />
            </button>
            <WalletMultiButton className="!bg-white hover:!bg-zinc-200 !text-zinc-900 !rounded-xl !py-2 !px-4 !text-sm !font-medium" />
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
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-4 relative z-10">
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
          <div className="max-w-7xl mx-auto px-6 pt-4">
            <div className="flex items-center gap-2 text-gray-400 text-sm mb-2">
              <Sparkles className="w-4 h-4" />
              Try these:
            </div>
            <div className="flex flex-wrap gap-2">
              {exampleCommands.map((cmd, i) => (
                <button
                  key={i}
                  onClick={() => setInput(cmd)}
                  className="px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800/50 hover:border-white/50 transition-colors"
                >
                  {cmd.length > 40 ? cmd.slice(0, 37) + '...' : cmd}
                </button>
              ))}
            </div>
          </div>
        )}
        
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={connected ? "Swap 0.01 SOL to USDC (or paste contract address)" : "Connect wallet to start..."}
              disabled={!connected || isProcessing}
              className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-white/50 disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!connected || !input.trim() || isProcessing}
              className="px-4 py-3 bg-white hover:bg-zinc-200 disabled:bg-zinc-800 disabled:opacity-50 rounded-xl text-zinc-900 transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center text-xs text-gray-500 mt-2">
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