'use client';

import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { Shield, ArrowLeftRight, Send, TrendingUp, Activity } from 'lucide-react';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const pathname = usePathname();
  
  const isActive = (path: string) => pathname === path;
  
  return (
    <nav className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="w-8 h-8 text-cyan-500" />
              <span className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent">
                KRYPTOS
              </span>
            </Link>
            <div className="hidden md:flex items-center gap-1">
              <NavLink href="/swap" active={isActive('/swap')} icon={<ArrowLeftRight className="w-4 h-4" />}>
                Swap
              </NavLink>
              <NavLink href="/transfer" active={isActive('/transfer')} icon={<Send className="w-4 h-4" />}>
                Transfer
              </NavLink>
              <NavLink href="/dca" active={isActive('/dca')} icon={<TrendingUp className="w-4 h-4" />}>
                DCA
              </NavLink>
              <NavLink href="/monitor" active={isActive('/monitor')} icon={<Activity className="w-4 h-4" />}>
                Monitor
              </NavLink>
            </div>
          </div>
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link 
      href={href} 
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
        active 
          ? 'text-cyan-400 bg-cyan-500/10' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      {icon}
      {children}
    </Link>
  );
}
