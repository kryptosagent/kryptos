// ============================================================================
// KRYPTOS RWA - Info Card Component
// Displays RWA asset information (APY, TVL, price, risk, backing)
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { RWAAssetWithData } from '@/lib/rwa/types';
import { getUSDYWithData } from '@/lib/rwa/usdy';

// ============================================================================
// TYPES
// ============================================================================

interface RWAInfoCardProps {
  symbol?: string;  // Default: 'USDY'
  compact?: boolean; // Compact mode for sidebar/widget
  onDeposit?: () => void; // Callback when user clicks deposit
  className?: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function RiskBadge({ score, label }: { score: number; label: string }) {
  const colors: Record<string, string> = {
    'Very Low': 'bg-green-500/20 text-green-400 border-green-500/30',
    'Low': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'Medium': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    'High': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'Very High': 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  
  const stars = '⭐'.repeat(Math.max(1, 6 - score));
  
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${colors[label] || colors['Medium']}`}>
      {stars} {label}
    </span>
  );
}

function StatItem({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs text-gray-400 uppercase tracking-wider">{label}</span>
      <span className="text-lg font-bold text-white">{value}</span>
      {subtext && <span className="text-xs text-gray-500">{subtext}</span>}
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-gray-700 rounded-full" />
        <div className="flex-1">
          <div className="h-5 bg-gray-700 rounded w-24 mb-1" />
          <div className="h-3 bg-gray-700 rounded w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-12 bg-gray-700 rounded" />
        <div className="h-12 bg-gray-700 rounded" />
        <div className="h-12 bg-gray-700 rounded" />
        <div className="h-12 bg-gray-700 rounded" />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RWAInfoCard({ 
  symbol = 'USDY', 
  compact = false,
  onDeposit,
  className = '',
}: RWAInfoCardProps) {
  const [data, setData] = useState<RWAAssetWithData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);
      
      try {
        // Currently only USDY is supported
        if (symbol.toUpperCase() === 'USDY') {
          const response = await getUSDYWithData();
          if (response.success && response.data) {
            setData(response.data);
          } else {
            setError(response.error || 'Failed to fetch data');
          }
        } else {
          setError(`${symbol} is not supported yet`);
        }
      } catch (err: any) {
        setError(err.message || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [symbol]);
  
  if (loading) {
    return <LoadingCard />;
  }
  
  if (error || !data) {
    return (
      <div className={`bg-red-900/20 rounded-xl p-6 border border-red-500/30 ${className}`}>
        <div className="flex items-center gap-2 text-red-400">
          <span className="text-xl">⚠️</span>
          <span>Failed to load RWA data: {error}</span>
        </div>
      </div>
    );
  }
  
  const { data: rwaData } = data;
  
  // Format numbers
  const formatTVL = (tvl: number) => {
    if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(2)}B`;
    if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`;
    if (tvl >= 1_000) return `$${(tvl / 1_000).toFixed(2)}K`;
    return `$${tvl.toFixed(2)}`;
  };
  
  // Compact mode
  if (compact) {
    return (
      <div className={`bg-gradient-to-br from-emerald-900/30 to-gray-900/50 rounded-xl p-4 border border-emerald-500/20 ${className}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <span className="text-emerald-400 text-sm">💎</span>
            </div>
            <span className="font-bold text-white">{data.symbol}</span>
          </div>
          <span className="text-emerald-400 font-bold">{rwaData.apy.toFixed(2)}% APY</span>
        </div>
        <div className="text-xs text-gray-400">
          Treasury-backed • {formatTVL(rwaData.tvl)} TVL
        </div>
        {onDeposit && (
          <button
            onClick={onDeposit}
            className="mt-3 w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors"
          >
            Earn Yield →
          </button>
        )}
      </div>
    );
  }
  
  // Full mode
  return (
    <div className={`bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl border border-gray-700/50 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600/20 to-blue-600/20 px-6 py-4 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500/30">
              <span className="text-2xl">💎</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">{data.name}</h3>
              <p className="text-sm text-gray-400">{data.symbol} • {data.issuer}</p>
            </div>
          </div>
          <RiskBadge score={data.riskScore} label={data.riskLabel} />
        </div>
      </div>
      
      {/* Stats Grid */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
          <StatItem 
            label="Current APY" 
            value={`${rwaData.apy.toFixed(2)}%`}
            subtext="Treasury yield"
          />
          <StatItem 
            label="Price" 
            value={`$${rwaData.price.toFixed(4)}`}
            subtext="Accruing yield"
          />
          <StatItem 
            label="TVL (Solana)" 
            value={formatTVL(rwaData.tvl)}
          />
          <StatItem 
            label="Liquidity" 
            value={data.liquidity}
            subtext="Via Jupiter"
          />
        </div>
        
        {/* Backing Info */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🏦</span>
            <div>
              <h4 className="font-medium text-white mb-1">Backed by {data.backing}</h4>
              <p className="text-sm text-gray-400">
                USDY is a tokenized note secured by short-term US Treasuries and bank deposits. 
                Yield accrues daily through price appreciation.
              </p>
            </div>
          </div>
        </div>
        
        {/* Yield Preview */}
        <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20 mb-6">
          <h4 className="text-sm font-medium text-emerald-400 mb-3">💰 Yield Preview (per $1,000)</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-white">
                +${((1000 * rwaData.apy / 100) / 365).toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">Daily</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">
                +${((1000 * rwaData.apy / 100) / 12).toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">Monthly</div>
            </div>
            <div>
              <div className="text-lg font-bold text-white">
                +${(1000 * rwaData.apy / 100).toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">Yearly</div>
            </div>
          </div>
        </div>
        
        {/* Action Button */}
        {onDeposit && (
          <button
            onClick={onDeposit}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white rounded-xl font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Deposit & Earn Yield
          </button>
        )}
        
        {/* Footer */}
        <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
          <span>Last updated: {rwaData.lastUpdated.toLocaleTimeString()}</span>
          <a 
            href={data.website} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            Learn more →
          </a>
        </div>
      </div>
    </div>
  );
}
