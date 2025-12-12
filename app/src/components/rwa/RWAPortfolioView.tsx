// ============================================================================
// KRYPTOS RWA - Portfolio Component
// Displays user's RWA holdings with yield estimates
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { RWAPortfolio, RWAHolding } from '@/lib/rwa/types';
import { buildRWAPortfolio, isRWAToken } from '@/lib/rwa';

// ============================================================================
// TYPES
// ============================================================================

interface RWAPortfolioViewProps {
  tokenBalances: Array<{ mint: string; balance: number }>;
  onDeposit?: (symbol: string) => void;
  onWithdraw?: (symbol: string) => void;
  className?: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function HoldingRow({ 
  holding, 
  onWithdraw 
}: { 
  holding: RWAHolding; 
  onWithdraw?: () => void;
}) {
  const { asset, balance, balanceUSD, estimatedYieldMonthly, estimatedYieldYearly } = holding;
  
  // Calculate effective APY
  const effectiveAPY = balanceUSD > 0 ? (estimatedYieldYearly / balanceUSD) * 100 : 0;
  
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 hover:border-emerald-500/30 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
            <span className="text-lg">💎</span>
          </div>
          <div>
            <div className="font-bold text-white">{asset.symbol}</div>
            <div className="text-xs text-gray-400">{asset.name}</div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-bold text-white">${balanceUSD.toFixed(2)}</div>
          <div className="text-xs text-gray-400">{balance.toFixed(4)} {asset.symbol}</div>
        </div>
      </div>
      
      {/* Yield Info */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-gray-900/50 rounded-lg p-2 text-center">
          <div className="text-emerald-400 font-bold">{effectiveAPY.toFixed(2)}%</div>
          <div className="text-xs text-gray-500">APY</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-2 text-center">
          <div className="text-emerald-400 font-bold">+${estimatedYieldMonthly.toFixed(2)}</div>
          <div className="text-xs text-gray-500">Monthly</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-2 text-center">
          <div className="text-emerald-400 font-bold">+${estimatedYieldYearly.toFixed(2)}</div>
          <div className="text-xs text-gray-500">Yearly</div>
        </div>
      </div>
      
      {/* Actions */}
      {onWithdraw && (
        <button
          onClick={onWithdraw}
          className="w-full py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
        >
          Withdraw
        </button>
      )}
    </div>
  );
}

function EmptyState({ onDeposit }: { onDeposit?: () => void }) {
  return (
    <div className="bg-gray-800/30 rounded-2xl p-8 border border-dashed border-gray-700 text-center">
      <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
        <span className="text-3xl">💎</span>
      </div>
      <h3 className="text-lg font-bold text-white mb-2">No RWA Holdings</h3>
      <p className="text-gray-400 mb-6 max-w-sm mx-auto">
        Start earning yield from US Treasury Bills by depositing USDC into USDY.
      </p>
      {onDeposit && (
        <button
          onClick={onDeposit}
          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white rounded-xl font-medium transition-all"
        >
          Deposit & Earn Yield
        </button>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-32 bg-gray-800/50 rounded-xl" />
      <div className="h-32 bg-gray-800/50 rounded-xl" />
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RWAPortfolioView({
  tokenBalances,
  onDeposit,
  onWithdraw,
  className = '',
}: RWAPortfolioViewProps) {
  const [portfolio, setPortfolio] = useState<RWAPortfolio | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    async function loadPortfolio() {
      setLoading(true);
      
      try {
        // Filter for RWA tokens only
        const rwaBalances = tokenBalances.filter(t => isRWAToken(t.mint) && t.balance > 0);
        
        if (rwaBalances.length === 0) {
          setPortfolio({
            holdings: [],
            totalValueUSD: 0,
            totalYieldDaily: 0,
            totalYieldMonthly: 0,
            totalYieldYearly: 0,
            blendedAPY: 0,
            lastUpdated: new Date(),
          });
        } else {
          const result = await buildRWAPortfolio(rwaBalances);
          setPortfolio(result);
        }
      } catch (error) {
        console.error('Failed to load RWA portfolio:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadPortfolio();
  }, [tokenBalances]);
  
  if (loading) {
    return (
      <div className={className}>
        <LoadingState />
      </div>
    );
  }
  
  if (!portfolio || portfolio.holdings.length === 0) {
    return (
      <div className={className}>
        <EmptyState onDeposit={onDeposit ? () => onDeposit('USDY') : undefined} />
      </div>
    );
  }
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Portfolio Summary */}
      <div className="bg-gradient-to-br from-emerald-900/30 to-blue-900/30 rounded-2xl p-6 border border-emerald-500/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">💼 RWA Portfolio</h2>
          <span className="text-xs text-gray-400">
            Updated {portfolio.lastUpdated.toLocaleTimeString()}
          </span>
        </div>
        
        {/* Total Value */}
        <div className="mb-6">
          <div className="text-3xl font-bold text-white mb-1">
            ${portfolio.totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-sm text-gray-400">Total RWA Value</div>
        </div>
        
        {/* Yield Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-emerald-400">{portfolio.blendedAPY.toFixed(2)}%</div>
            <div className="text-xs text-gray-500">Blended APY</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-emerald-400">+${portfolio.totalYieldDaily.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Daily Yield</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-emerald-400">+${portfolio.totalYieldMonthly.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Monthly Yield</div>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-emerald-400">+${portfolio.totalYieldYearly.toFixed(2)}</div>
            <div className="text-xs text-gray-500">Yearly Yield</div>
          </div>
        </div>
      </div>
      
      {/* Holdings List */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-3 px-1">HOLDINGS</h3>
        <div className="space-y-3">
          {portfolio.holdings.map((holding) => (
            <HoldingRow
              key={holding.asset.mint}
              holding={holding}
              onWithdraw={onWithdraw ? () => onWithdraw(holding.asset.symbol) : undefined}
            />
          ))}
        </div>
      </div>
      
      {/* Add More */}
      {onDeposit && (
        <button
          onClick={() => onDeposit('USDY')}
          className="w-full py-3 bg-gray-800/50 hover:bg-gray-800 border border-dashed border-gray-600 hover:border-emerald-500/50 text-gray-400 hover:text-emerald-400 rounded-xl font-medium transition-all"
        >
          + Add More RWA
        </button>
      )}
    </div>
  );
}
