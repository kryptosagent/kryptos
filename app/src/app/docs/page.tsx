'use client';

import Link from 'next/link';
import { useState } from 'react';
import { 
  ChevronRight,
  Book,
  Zap,
  ExternalLink,
  Menu,
  X,
  Code,
  Lock,
  HelpCircle,
  Mail,
  Github
} from 'lucide-react';

// Sidebar navigation items
const sidebarItems = [
  {
    title: 'Getting Started',
    icon: Book,
    items: [
      { id: 'introduction', label: 'Introduction' },
      { id: 'quick-start', label: 'Quick Start' },
      { id: 'connect-wallet', label: 'Connect Wallet' },
    ]
  },
  {
    title: 'Features',
    icon: Zap,
    items: [
      { id: 'swap', label: 'Swap Tokens' },
      { id: 'transfer', label: 'Transfer' },
      { id: 'drop-links', label: 'Drop Links' },
      { id: 'balance', label: 'Check Balance' },
      { id: 'dca', label: 'DCA Vaults' },
      { id: 'manage-dca', label: 'Manage DCA' }, 
      { id: 'token-info', label: 'Token Info' },
    ]
  },
  {
    title: 'Privacy',
    icon: Lock,
    items: [
      { id: 'mev-protection', label: 'MEV Protection' },
      { id: 'stealth-execution', label: 'Stealth Execution' },
      { id: 'timing-obfuscation', label: 'Timing Obfuscation' },
    ]
  },
  {
    title: 'Smart Contract',
    icon: Code,
    items: [
      { id: 'program-id', label: 'Program IDs' },
    ]
  },
  {
    title: 'FAQ',
    icon: HelpCircle,
    items: [
      { id: 'faq', label: 'Common Questions' },
    ]
  },
  {
    title: 'Resources',
    icon: ExternalLink,
    items: [
      { id: 'links', label: 'Links' },
    ]
  },
];

// Documentation content
const docsContent: Record<string, { title: string; content: React.ReactNode }> = {
  'introduction': {
    title: 'Introduction',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          KRYPTOS is a private DeFi agent on Solana that enables stealth-executed transactions with MEV protection. 
          All your trades are timing-obfuscated and front-run proof.
        </p>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-3">Key Features</h3>
          <ul className="space-y-2 text-zinc-400">
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-white mt-1 flex-shrink-0" />
              <span>MEV-protected swaps via private execution</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-white mt-1 flex-shrink-0" />
              <span>Natural language interface - just type what you want</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-white mt-1 flex-shrink-0" />
              <span>Drop Links - send crypto to anyone via shareable links</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-white mt-1 flex-shrink-0" />
              <span>Private DCA vaults with randomized execution</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-white mt-1 flex-shrink-0" />
              <span>Full DCA lifecycle management (create, list, withdraw, close)</span>
            </li>
            <li className="flex items-start gap-2">
              <ChevronRight className="w-4 h-4 text-white mt-1 flex-shrink-0" />
              <span>Support for any Solana token via contract address</span>
            </li>
          </ul>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-2">Program ID</h3>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block overflow-x-auto">
            F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2
          </code>
        </div>
      </div>
    ),
  },
  'quick-start': {
    title: 'Quick Start',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          Get started with KRYPTOS in under a minute.
        </p>
        
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold">1</div>
              <h3 className="text-white font-semibold">Connect Your Wallet</h3>
            </div>
            <p className="text-zinc-400 ml-11">Click "Select Wallet" and connect your Phantom, Solflare, or any Solana wallet.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold">2</div>
              <h3 className="text-white font-semibold">Type Your Command</h3>
            </div>
            <p className="text-zinc-400 ml-11">Enter a command in natural language:</p>
            <div className="ml-11 mt-3 space-y-2">
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Swap 1 SOL to USDC</code>
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Drop 0.1 SOL to friend@email.com</code>
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Check my balance</code>
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">DCA 100 USDC to SOL daily</code>
            </div>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center text-white font-bold">3</div>
              <h3 className="text-white font-semibold">Confirm & Execute</h3>
            </div>
            <p className="text-zinc-400 ml-11">Review the preview and type "confirm" to execute. Your transaction will be stealth-executed with MEV protection.</p>
          </div>
        </div>
      </div>
    ),
  },
  'connect-wallet': {
    title: 'Connect Wallet',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          KRYPTOS supports all major Solana wallets through the Wallet Adapter standard.
        </p>
        
        <h3 className="text-white font-semibold">Supported Wallets</h3>
        <ul className="space-y-2 text-zinc-400">
          <li className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-white" />
            <span>Phantom</span>
          </li>
          <li className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-white" />
            <span>Solflare</span>
          </li>
          <li className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-white" />
            <span>Backpack</span>
          </li>
          <li className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-white" />
            <span>Ledger (via Phantom/Solflare)</span>
          </li>
        </ul>
        
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
          <p className="text-yellow-200 text-sm">
            <strong>Note:</strong> Make sure you're connected to Solana Mainnet. KRYPTOS operates on mainnet only.
          </p>
        </div>
      </div>
    ),
  },
  'swap': {
    title: 'Swap Tokens',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          Swap any Solana token with MEV protection via private execution.
        </p>
        
        <h3 className="text-white font-semibold">Command Formats</h3>
        <div className="space-y-2">
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Swap [amount] [from_token] to [to_token]</code>
        </div>
        
        <h3 className="text-white font-semibold mt-6">Examples</h3>
        <div className="space-y-2">
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Swap 1 SOL to USDC</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Swap 100 USDC to JUP</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Swap 0.5 SOL to EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v</code>
        </div>
        
        <h3 className="text-white font-semibold mt-6">Supported Token Shortcuts</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500">
                <th className="text-left pb-2">Symbol</th>
                <th className="text-left pb-2">Address</th>
              </tr>
            </thead>
          </table>
        </div>
      </div>
    ),
  },
  'transfer': {
    title: 'Transfer Tokens',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          Send tokens to any Solana wallet address.
        </p>
        
        <h3 className="text-white font-semibold">Command Format</h3>
        <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Transfer [amount] [token] to [wallet_address]</code>
        
        <h3 className="text-white font-semibold mt-6">Examples</h3>
        <div className="space-y-2">
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Transfer 1 SOL to 5jhb...3Ami</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Send 100 USDC to 9xYz...4Bcd</code>
        </div>
      </div>
    ),
  },
  'drop-links': {
    title: 'Drop Links',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          Send crypto to anyone using shareable links. Recipients don't need a wallet to claim - they can create one on the spot.
        </p>
        
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4">
          <p className="text-emerald-200 text-sm">
            <strong>Perfect for:</strong> Gifting crypto, paying friends, onboarding newcomers to Solana, airdrops, and rewards.
          </p>
        </div>
        
        <h3 className="text-white font-semibold">Command Formats</h3>
        <div className="space-y-2">
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Drop [amount] [token] to [recipient]</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Send [amount] [token] via link</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Gift [amount] [token] to [recipient]</code>
        </div>
        
        <h3 className="text-white font-semibold mt-6">Examples</h3>
        <div className="space-y-2">
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Drop 0.1 SOL to john@gmail.com</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Send 100 USDC via link</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Gift 1 SOL to my friend</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Drop 50 BONK to alice@example.com</code>
        </div>
        
        <h3 className="text-white font-semibold mt-6">How It Works</h3>
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs font-bold">1</div>
              <h4 className="text-white font-medium">Create Drop</h4>
            </div>
            <p className="text-zinc-400 text-sm ml-9">Your tokens are locked in a secure escrow smart contract.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs font-bold">2</div>
              <h4 className="text-white font-medium">Share Link</h4>
            </div>
            <p className="text-zinc-400 text-sm ml-9">Copy the generated link and share it via email, chat, or social media.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs font-bold">3</div>
              <h4 className="text-white font-medium">Recipient Claims</h4>
            </div>
            <p className="text-zinc-400 text-sm ml-9">Anyone with the link can claim. They sign in with email/Google to create a wallet automatically.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-6 h-6 bg-white/10 rounded-full flex items-center justify-center text-white text-xs font-bold">4</div>
              <h4 className="text-white font-medium">Auto-Refund</h4>
            </div>
            <p className="text-zinc-400 text-sm ml-9">If unclaimed after 7 days, tokens are automatically returned to your wallet.</p>
          </div>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-6">
          <h4 className="text-white font-semibold mb-2">Drop Features</h4>
          <ul className="space-y-1 text-zinc-400 text-sm">
            <li>• Supports SOL (now) and any SPL token (soon)</li>
            <li>• Click-to-copy link for easy sharing</li>
            <li>• Auto-download drop details as .txt file</li>
            <li>• Gas-free claiming for recipients (sponsored transactions)</li>
            <li>• Recipients can export private key to Phantom/Solflare</li>
          </ul>
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mt-6">
          <h4 className="text-white font-semibold mb-2">Drop Program ID</h4>
          <code className="text-sm text-white bg-zinc-800 px-3 py-2 rounded-lg block break-all">
            CrvSTnNtciVF2q2rRui19WwAdvxpWjK6faRub9xRcesK
          </code>
        </div>
      </div>
    ),
  },
  'balance': {
    title: 'Check Balance',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          View your current token holdings and their USD values.
        </p>
        
        <h3 className="text-white font-semibold">Commands</h3>
        <div className="space-y-2">
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Balance</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Check my balance</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Portfolio</code>
        </div>
      </div>
    ),
  },
  'dca': {
    title: 'DCA Vaults',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          Set up Dollar Cost Averaging (DCA) strategies with on-chain vaults. Your DCA is executed with randomized timing for maximum privacy.
        </p>
        
        <h3 className="text-white font-semibold">Command Format</h3>
        <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">DCA [total_amount] [from_token] to [to_token] [frequency]</code>
        
        <h3 className="text-white font-semibold mt-6">Examples</h3>
        <div className="space-y-2">
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">DCA 100 USDC to SOL daily</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">DCA 500 USDC to SOL weekly for 4 weeks</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">DCA 50 USDC to SOL hourly</code>
        </div>
        
        <h3 className="text-white font-semibold mt-6">Frequencies</h3>
        <ul className="space-y-2 text-zinc-400">
          <li className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-white" />
            <span><strong>hourly</strong> - Execute multiple times per day</span>
          </li>
          <li className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-white" />
            <span><strong>daily</strong> - Execute once per day (default)</span>
          </li>
          <li className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-white" />
            <span><strong>weekly</strong> - Execute once per week</span>
          </li>
        </ul>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h4 className="text-white font-semibold mb-2">Privacy Features</h4>
          <ul className="space-y-1 text-zinc-400 text-sm">
            <li>• Randomized execution timing within your window</li>
            <li>• Amount variance (±20%) to prevent pattern detection</li>
            <li>• On-chain vault - fully trustless</li>
          </ul>
        </div>
      </div>
    ),
  },
  'manage-dca': {
    title: 'Manage DCA',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          View, withdraw from, and close your DCA vaults. KRYPTOS provides full lifecycle management for your DCA strategies.
        </p>
        
        <div className="space-y-4">
          {/* List DCA */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3">List DCA Vaults</h3>
            <p className="text-zinc-400 mb-3">View all your active DCA vaults with their current status.</p>
            <div className="space-y-2">
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">List DCA</code>
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Show my DCA vaults</code>
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">My DCAs</code>
            </div>
          </div>
          
          {/* Withdraw DCA */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3">Withdraw from DCA</h3>
            <p className="text-zinc-400 mb-3">Withdraw remaining funds from a DCA vault. You can withdraw all funds or a specific amount.</p>
            <div className="space-y-2">
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Withdraw DCA USDC to SOL</code>
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Withdraw 50 USDC from DCA</code>
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Cancel DCA USDC to SOL</code>
            </div>
            <div className="mt-3 text-zinc-500 text-sm">
              Note: Withdrawing all funds leaves the vault empty but still open. Use "Close DCA" to reclaim rent.
            </div>
          </div>
          
          {/* Close DCA */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3">Close DCA Vault</h3>
            <p className="text-zinc-400 mb-3">Close an empty DCA vault and reclaim the ~0.002 SOL rent deposit.</p>
            <div className="space-y-2">
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Close DCA USDC to SOL</code>
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Delete DCA vault</code>
              <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Reclaim DCA rent</code>
            </div>
            <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-yellow-200 text-sm">
                <strong>Important:</strong> Vault must be empty before closing. Withdraw all funds first.
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-white/5 border border-white/10 rounded-xl p-4">
          <h4 className="text-white font-semibold mb-2">DCA Lifecycle</h4>
          <div className="flex items-center gap-2 text-zinc-400 text-sm">
            <span className="bg-zinc-800 px-2 py-1 rounded">Create DCA</span>
            <ChevronRight className="w-4 h-4" />
            <span className="bg-zinc-800 px-2 py-1 rounded">Auto Execute</span>
            <ChevronRight className="w-4 h-4" />
            <span className="bg-zinc-800 px-2 py-1 rounded">Withdraw</span>
            <ChevronRight className="w-4 h-4" />
            <span className="bg-zinc-800 px-2 py-1 rounded">Close</span>
          </div>
        </div>
      </div>
    ),
  },
  'token-info': {
    title: 'Token Info',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          Look up detailed information about any Solana token including price, market cap, liquidity, and safety warnings.
        </p>
        
        <h3 className="text-white font-semibold">Command Format</h3>
        <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Token [address]</code>
        
        <h3 className="text-white font-semibold mt-6">Examples</h3>
        <div className="space-y-2">
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v</code>
          <code className="text-sm text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg block">Token info JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN</code>
        </div>
        
        <h3 className="text-white font-semibold mt-6">Information Provided</h3>
        <ul className="space-y-2 text-zinc-400">
          <li className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-white" />
            <span>Token name, symbol, decimals</span>
          </li>
          <li className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-white" />
            <span>Current price and market cap</span>
          </li>
          <li className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-white" />
            <span>Liquidity depth</span>
          </li>
          <li className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-white" />
            <span>Safety audit (mint/freeze authority)</span>
          </li>
          <li className="flex items-center gap-2">
            <ChevronRight className="w-4 h-4 text-white" />
            <span>Pump.fun graduation status</span>
          </li>
        </ul>
      </div>
    ),
  },
  'mev-protection': {
    title: 'MEV Protection',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          All swaps in KRYPTOS are executed through Jupiter which provides built-in MEV protection.
        </p>
        
        <h3 className="text-white font-semibold">How It Works</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div>
            <h4 className="text-white font-medium">1. Private Transaction Submission</h4>
            <p className="text-zinc-400 text-sm mt-1">Your swap is submitted through private channels, not the public mempool.</p>
          </div>
          <div>
            <h4 className="text-white font-medium">2. Sandwich Attack Prevention</h4>
            <p className="text-zinc-400 text-sm mt-1">MEV bots cannot front-run or back-run your transactions.</p>
          </div>
          <div>
            <h4 className="text-white font-medium">3. Optimal Execution</h4>
            <p className="text-zinc-400 text-sm mt-1">Jupiter finds the best route across all DEXes while protecting your trade.</p>
          </div>
        </div>
      </div>
    ),
  },
  'stealth-execution': {
    title: 'Stealth Execution',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          KRYPTOS executes all transactions in stealth mode, making your trading patterns invisible to observers.
        </p>
        
        <h3 className="text-white font-semibold">Stealth Features</h3>
        <ul className="space-y-3 text-zinc-400">
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 text-white mt-1" />
            <span>Transactions are routed through private execution channels</span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 text-white mt-1" />
            <span>No pre-transaction signatures visible in mempool</span>
          </li>
          <li className="flex items-start gap-2">
            <ChevronRight className="w-4 h-4 text-white mt-1" />
            <span>Trade intent is hidden until execution</span>
          </li>
        </ul>
      </div>
    ),
  },
  'timing-obfuscation': {
    title: 'Timing Obfuscation',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          DCA vaults use randomized timing to prevent pattern detection and front-running based on predictable schedules.
        </p>
        
        <h3 className="text-white font-semibold">How It Works</h3>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <div>
            <h4 className="text-white font-medium">Randomized Execution Window</h4>
            <p className="text-zinc-400 text-sm mt-1">Instead of executing at fixed times, DCA orders execute within a random window.</p>
          </div>
          <div>
            <h4 className="text-white font-medium">Amount Variance</h4>
            <p className="text-zinc-400 text-sm mt-1">Each execution varies by ±20% to prevent amount-based pattern detection.</p>
          </div>
          <div>
            <h4 className="text-white font-medium">Variable Frequency</h4>
            <p className="text-zinc-400 text-sm mt-1">Number of executions per period varies between your min/max settings.</p>
          </div>
        </div>
      </div>
    ),
  },
  'program-id': {
    title: 'Program IDs',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          KRYPTOS smart contracts are deployed on Solana Mainnet.
        </p>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-3">KRYPTOS DCA Program</h3>
          <p className="text-zinc-400 text-sm mb-3">Handles DCA vault creation, execution, and management.</p>
          <code className="text-sm text-white bg-zinc-800 px-4 py-3 rounded-lg block break-all">
            F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2
          </code>
          <a 
            href="https://solscan.io/account/F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-white text-sm mt-3 transition-colors"
          >
            View on Solscan <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-white font-semibold mb-3">KRYPTOS DROP Program</h3>
          <p className="text-zinc-400 text-sm mb-3">Handles drop link creation, claiming, and auto-refund escrow.</p>
          <code className="text-sm text-white bg-zinc-800 px-4 py-3 rounded-lg block break-all">
            CrvSTnNtciVF2q2rRui19WwAdvxpWjK6faRub9xRcesK
          </code>
          <a 
            href="https://solscan.io/account/CrvSTnNtciVF2q2rRui19WwAdvxpWjK6faRub9xRcesK" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-zinc-400 hover:text-white text-sm mt-3 transition-colors"
          >
            View on Solscan <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    ),
  },
  'faq': {
    title: 'Frequently Asked Questions',
    content: (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h4 className="text-white font-semibold mb-2">Is KRYPTOS safe to use?</h4>
            <p className="text-zinc-400">Yes. KRYPTOS uses battle-tested DEX aggregation for swaps with MEV protection. DCA vaults are non-custodial - only you can withdraw your funds.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h4 className="text-white font-semibold mb-2">Are there any fees?</h4>
            <p className="text-zinc-400">KRYPTOS itself charges no fees. You only pay standard Solana transaction fees and minimal DEX routing fees.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h4 className="text-white font-semibold mb-2">Can I cancel a DCA?</h4>
            <p className="text-zinc-400">Yes. You can withdraw your remaining funds from a DCA vault at any time. Type "withdraw DCA USDC to SOL" in the app.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h4 className="text-white font-semibold mb-2">How do I close a DCA vault and get my rent back?</h4>
            <p className="text-zinc-400">First withdraw all funds with "withdraw DCA", then type "close DCA USDC to SOL" to close the vault and reclaim ~0.002 SOL rent deposit.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h4 className="text-white font-semibold mb-2">Why can't I close my DCA vault?</h4>
            <p className="text-zinc-400">The vault must be completely empty (0 balance in both input and output tokens) before it can be closed. Make sure to withdraw all funds first.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h4 className="text-white font-semibold mb-2">Which tokens are supported?</h4>
            <p className="text-zinc-400">Any SPL token on Solana! Use the token's contract address if it's not in our shortcuts list.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h4 className="text-white font-semibold mb-2">Is my data private?</h4>
            <p className="text-zinc-400">Yes. KRYPTOS doesn't store any personal data. All interactions happen directly between your wallet and the Solana blockchain.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h4 className="text-white font-semibold mb-2">How do Drop Links work?</h4>
            <p className="text-zinc-400">Drop Links lock your tokens in an escrow smart contract. Anyone with the link can claim by signing in with email/Google - a wallet is created automatically. Unclaimed drops auto-refund after 7 days.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h4 className="text-white font-semibold mb-2">Do drop recipients need SOL for gas?</h4>
            <p className="text-zinc-400">No! KRYPTOS sponsors the gas fees for claiming drops, so recipients can claim for free even with an empty wallet.</p>
          </div>
          
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h4 className="text-white font-semibold mb-2">How does timing obfuscation work?</h4>
            <p className="text-zinc-400">DCA executions are randomized within your chosen frequency window, and amounts vary by ±20%. This makes it impossible for observers to predict your trades.</p>
          </div>
        </div>
      </div>
    ),
  },
  'links': {
    title: 'Links',
    content: (
      <div className="space-y-6">
        <p className="text-zinc-300 leading-relaxed">
          Official KRYPTOS resources and social links.
        </p>
        
        <div className="grid gap-4">
          {/* X / Twitter */}
          <a 
            href="https://x.com/kryptos_fi" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-semibold">X</h4>
                  <p className="text-zinc-500 text-sm">@kryptos_fi</p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
            </div>
          </a>

          {/* Email */}
          <a 
            href="mailto:hello@kryptosagent.xyz" 
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                  <Mail className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Email</h4>
                  <p className="text-zinc-500 text-sm">hello@kryptosagent.xyz</p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
            </div>
          </a>

          {/* GitHub */}
          <a 
            href="https://github.com/kryptosagent/kryptos" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                  <Github className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">GitHub</h4>
                  <p className="text-zinc-500 text-sm">kryptosagent/kryptos</p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
            </div>
          </a>
          
          {/* Solscan - Program */}
          <a 
            href="https://solscan.io/account/F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                  <Code className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Program on Solscan</h4>
                  <p className="text-zinc-500 text-sm font-mono">F7gyo...TXYjy2</p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
            </div>
          </a>
          
          {/* Solscan - Token */}
          <a 
            href="https://solscan.io/token/9Uoz8X9wt4oC5sDJUxE4xaHarA9pctQm91Npctdspump" 
            target="_blank" 
            rel="noopener noreferrer"
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center group-hover:bg-zinc-700 transition-colors">
                  <Code className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-white font-semibold">Token on Solscan</h4>
                  <p className="text-zinc-500 text-sm font-mono">$KRYPTOS: 9Uoz8X9wt4oC5sDJUxE4xaHarA9pctQm91Npctdspump</p>
                </div>
              </div>
              <ExternalLink className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
            </div>
          </a>
        </div>
      </div>
    ),
  },
};

export default function DocsPage() {
  const [activeSection, setActiveSection] = useState('introduction');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const currentContent = docsContent[activeSection] || docsContent['introduction'];
  
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="KRYPTOS" className="w-10 h-10" />
              <span className="text-xl font-bold">KRYPTOS</span>
              <span className="text-zinc-500 text-sm hidden md:inline">/ Docs</span>
            </Link>
            
            {/* Nav Links */}
            <div className="flex items-center gap-4">
              <Link 
                href="/app" 
                className="px-4 py-2 bg-white text-zinc-900 rounded-lg text-sm font-medium hover:bg-zinc-200 transition-colors"
              >
                Launch App
              </Link>
              
              {/* Mobile menu button */}
              <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="md:hidden p-2 hover:bg-zinc-800 rounded-lg transition-colors"
              >
                {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex pt-16">
        {/* Sidebar */}
        <aside className={`
          fixed md:sticky top-16 left-0 h-[calc(100vh-4rem)] w-72 bg-zinc-950 border-r border-zinc-800 overflow-y-auto z-40
          transform transition-transform duration-300 md:translate-x-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="p-4 space-y-6">
            {sidebarItems.map((section) => (
              <div key={section.title}>
                <div className="flex items-center gap-2 text-zinc-500 text-xs font-medium uppercase tracking-wider mb-2">
                  <section.icon className="w-4 h-4" />
                  {section.title}
                </div>
                <ul className="space-y-1">
                  {section.items.map((item) => (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          setActiveSection(item.id);
                          setIsSidebarOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                          activeSection === item.id
                            ? 'bg-white/10 text-white'
                            : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
                        }`}
                      >
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </aside>

        {/* Backdrop for mobile */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 min-h-[calc(100vh-4rem)]">
          <div className="max-w-3xl mx-auto px-6 py-12">
            <h1 className="text-3xl font-bold mb-8">{currentContent.title}</h1>
            {currentContent.content}
          </div>
        </main>
      </div>
    </div>
  );
}