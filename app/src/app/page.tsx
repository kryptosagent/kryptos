'use client';

import Link from 'next/link';
import { 
  Shield, 
  Lock, 
  Zap, 
  Eye, 
  EyeOff,
  Copy,
  ArrowRight, 
  ChevronRight,
  Clock,
  Layers,
  Terminal,
  Mail,
  FileText,
  Bot,
  Github
} from 'lucide-react';

// Feature card component
function FeatureCard({ icon: Icon, title, description }: { 
  icon: React.ElementType; 
  title: string; 
  description: string;
}) {
  return (
    <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl hover:border-white/20 transition-colors group">
      <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-4 group-hover:bg-white/20 transition-colors">
        <Icon className="w-6 h-6 text-white" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// Stats component
function StatItem({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-white mb-1">{value}</div>
      <div className="text-zinc-500 text-sm">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3">
              <img src="/logo.png" alt="KRYPTOS" className="w-10 h-10" />
              <span className="text-xl font-bold">KRYPTOS</span>
            </Link>
            
            {/* Nav Links */}
            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-zinc-400 hover:text-white transition-colors text-sm">
                Features
              </Link>
              <Link href="#how-it-works" className="text-zinc-400 hover:text-white transition-colors text-sm">
                How it Works
              </Link>
              <Link href="/docs" className="text-zinc-400 hover:text-white transition-colors text-sm">
                Docs
              </Link>
            </div>
            
            {/* CTA Button */}
            <Link 
              href="/app" 
              className="px-5 py-2.5 bg-white text-zinc-900 rounded-xl font-medium text-sm hover:bg-zinc-200 transition-colors"
            >
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-3xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-full text-sm text-zinc-400 mb-8">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              Live on Solana Mainnet
            </div>
            
            {/* Headline */}
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Private DeFi Agent
              <br />
              <span className="text-zinc-500">on Solana</span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-lg md:text-xl text-zinc-400 mb-10 leading-relaxed">
              Execute stealth transactions with MEV protection. 
              Your trades are timing-obfuscated and front-run proof.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link 
                href="/app" 
                className="w-full sm:w-auto px-8 py-4 bg-white text-zinc-900 rounded-xl font-semibold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
              >
                Launch App
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link 
                href="/docs" 
                className="w-full sm:w-auto px-8 py-4 bg-zinc-900 border border-zinc-800 text-white rounded-xl font-semibold hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
              >
                Read Docs
                <FileText className="w-5 h-5" />
              </Link>
            </div>
          </div>
          
          {/* Hero Image / Preview */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent z-10 pointer-events-none"></div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 md:p-8 max-w-4xl mx-auto">
              {/* Mock Chat Interface */}
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="bg-zinc-800 rounded-2xl px-4 py-3 max-w-md">
                    <p className="text-zinc-300 text-sm">How can I help you today?</p>
                  </div>
                </div>
                <div className="flex gap-3 flex-row-reverse">
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                    <span className="text-white text-xs font-medium">U</span>
                  </div>
                  <div className="bg-white/10 rounded-2xl px-4 py-3">
                    <p className="text-white text-sm">Swap 1 SOL to USDC</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-zinc-400" />
                  </div>
                  <div className="bg-zinc-800 rounded-2xl px-4 py-3 max-w-md">
                    <p className="text-zinc-300 text-sm"><strong>Swap Preview</strong></p>
                    <p className="text-zinc-400 text-sm mt-1">1 SOL → ~234.50 USDC</p>
                    <p className="text-zinc-500 text-xs mt-2">Route: Jupiter Ultra • MEV Protected</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 border-y border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StatItem value="100%" label="MEV Protected" />
            <StatItem value="0%" label="Front-run Risk" />
            <StatItem value="<1s" label="Execution Time" />
            <StatItem value="∞" label="Tokens Supported" />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Why KRYPTOS?</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Built for traders who value privacy and protection from MEV attacks.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard 
              icon={EyeOff}
              title="Stealth Execution"
              description="All transactions are executed through private channels, making your trading patterns invisible to front-runners."
            />
            <FeatureCard 
              icon={Shield}
              title="MEV Protection"
              description="Built-in MEV protection shields every transaction. Your swaps are sandwich-attack proof."
            />
            <FeatureCard 
              icon={Clock}
              title="Timing Obfuscation"
              description="DCA orders are executed with randomized timing and amounts, preventing pattern detection."
            />
            <FeatureCard 
              icon={Zap}
              title="Instant Swaps"
              description="Execute swaps in seconds with optimal routing across all Solana DEXes via smart aggregation."
            />
            <FeatureCard 
              icon={Terminal}
              title="Natural Language"
              description="Speak naturally, trade effortlessly. Our AI translates your words into actions."
            />
            <FeatureCard 
              icon={Layers}
              title="DCA Vaults"
              description="Set up private DCA strategies with on-chain vaults. Automated, trustless, and MEV-immune."
            />
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 px-6 bg-zinc-900/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How it Works</h2>
            <p className="text-zinc-400 max-w-2xl mx-auto">
              Three simple steps to private DeFi trading.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="relative">
              <div className="text-6xl font-bold text-zinc-800 mb-4">01</div>
              <h3 className="text-xl font-semibold text-white mb-2">Connect Wallet</h3>
              <p className="text-zinc-400">
                Connect your Phantom, Solflare, or any Solana wallet to get started.
              </p>
            </div>
            
            {/* Step 2 */}
            <div className="relative">
              <div className="text-6xl font-bold text-zinc-800 mb-4">02</div>
              <h3 className="text-xl font-semibold text-white mb-2">Tell KRYPTOS</h3>
              <p className="text-zinc-400">
                Type your command naturally: "Swap 1 SOL to USDC" or "DCA 100 USDC into SOL daily"
              </p>
            </div>
            
            {/* Step 3 */}
            <div className="relative">
              <div className="text-6xl font-bold text-zinc-800 mb-4">03</div>
              <h3 className="text-xl font-semibold text-white mb-2">Execute Privately</h3>
              <p className="text-zinc-400">
                Confirm and your transaction is stealth-executed with full MEV protection.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-zinc-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="KRYPTOS" className="w-8 h-8" />
              <span className="font-semibold">KRYPTOS</span>
            </div>
            
            {/* Links */}
            <div className="flex items-center gap-6">
              <a href="mailto:hello@kryptosagent.xyz" className="text-zinc-400 hover:text-white transition-colors">
                <Mail className="w-5 h-5" />
              </a>
              <a href="https://github.com/kryptosagent/kryptos" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">
                <Github className="w-5 h-5" />
              </a>
              <a href="https://x.com/@kryptos_fi" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
            
            {/* Contract Address */}
            <div className="flex items-center gap-2">
              <span className="text-zinc-500 text-sm">$KRYPTOS:</span>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText('9Uoz8X9wt4oC5sDJUxE4xaHarA9pctQm91Npctdspump');
                  // Optional: Add toast notification
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg hover:border-zinc-700 transition-colors group"
              >
                <code className="text-zinc-300 text-xs font-mono">9Uoz8...pump</code>
                <Copy className="w-3.5 h-3.5 text-zinc-500 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>
          
          {/* Copyright - Centered at bottom */}
          <div className="mt-6 pt-4 mb-0 pb-1 border-t border-zinc-800/100 text-center">
            <p className="text-zinc-500 text-sm">© 2025 KRYPTOS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}