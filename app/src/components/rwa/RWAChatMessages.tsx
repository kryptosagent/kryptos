// ============================================================================
// KRYPTOS RWA - Chat Message Components
// Renders RWA responses in chat interface
// ============================================================================

'use client';

import React from 'react';
import { RWAAssetWithData, RWAPortfolio, YieldProjection } from '@/lib/rwa/types';

// ============================================================================
// RWA INFO MESSAGE
// ============================================================================

interface RWAInfoMessageProps {
  data: RWAAssetWithData;
  onDeposit?: () => void;
}

export function RWAInfoMessage({ data, onDeposit }: RWAInfoMessageProps) {
  const { data: rwaData } = data;
  
  const formatTVL = (tvl: number) => {
    if (tvl >= 1_000_000_000) return `$${(tvl / 1_000_000_000).toFixed(2)}B`;
    if (tvl >= 1_000_000) return `$${(tvl / 1_000_000).toFixed(2)}M`;
    return `$${tvl.toFixed(2)}`;
  };
  
  const riskStars: Record<string, string> = {
    'Very Low': '⭐',
    'Low': '⭐⭐',
    'Medium': '⭐⭐⭐',
    'High': '⭐⭐⭐⭐',
    'Very High': '⭐⭐⭐⭐⭐',
  };
  
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-emerald-500/20 max-w-md">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
          <span className="text-xl">💎</span>
        </div>
        <div>
          <div className="font-bold text-white">{data.name}</div>
          <div className="text-xs text-gray-400">{data.symbol} • {data.issuer}</div>
        </div>
      </div>
      
      {/* Stats */}
      <div className="space-y-2 mb-4 font-mono text-sm">
        <div className="flex justify-between">
          <span className="text-gray-400">APY:</span>
          <span className="text-emerald-400 font-bold">{rwaData.apy.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Price:</span>
          <span className="text-white">${rwaData.price.toFixed(4)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">TVL:</span>
          <span className="text-white">{formatTVL(rwaData.tvl)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Risk:</span>
          <span className="text-white">{riskStars[data.riskLabel]} {data.riskLabel}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Backing:</span>
          <span className="text-white">{data.backing}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Liquidity:</span>
          <span className="text-white">{data.liquidity}</span>
        </div>
      </div>
      
      {/* Info */}
      <div className="bg-emerald-500/10 rounded-lg p-3 text-sm text-emerald-300 mb-4">
        💡 {data.symbol} earns yield automatically — just hold it!
      </div>
      
      {/* Action */}
      {onDeposit && (
        <button
          onClick={onDeposit}
          className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors"
        >
          Deposit to {data.symbol} →
        </button>
      )}
    </div>
  );
}

// ============================================================================
// RWA PORTFOLIO MESSAGE
// ============================================================================

interface RWAPortfolioMessageProps {
  portfolio: RWAPortfolio;
  onWithdraw?: (symbol: string) => void;
}

export function RWAPortfolioMessage({ portfolio, onWithdraw }: RWAPortfolioMessageProps) {
  if (portfolio.holdings.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50 max-w-md">
        <div className="text-center py-4">
          <span className="text-3xl mb-2 block">💎</span>
          <div className="text-white font-medium mb-1">No RWA Holdings</div>
          <div className="text-sm text-gray-400">
            Try: "deposit 100 USDC to USDY" to start earning yield!
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-emerald-500/20 max-w-md">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="font-bold text-white">💼 Your RWA Portfolio</div>
        <div className="text-xs text-gray-500">
          {portfolio.lastUpdated.toLocaleTimeString()}
        </div>
      </div>
      
      {/* Total Value */}
      <div className="bg-emerald-500/10 rounded-lg p-3 mb-4">
        <div className="text-sm text-gray-400 mb-1">Total Value</div>
        <div className="text-2xl font-bold text-white">
          ${portfolio.totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
        <div className="text-sm text-emerald-400">
          +${portfolio.totalYieldMonthly.toFixed(2)}/month ({portfolio.blendedAPY.toFixed(2)}% APY)
        </div>
      </div>
      
      {/* Holdings */}
      <div className="space-y-3 mb-4">
        {portfolio.holdings.map((holding) => (
          <div 
            key={holding.asset.mint}
            className="bg-gray-900/50 rounded-lg p-3"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-medium text-white">{holding.asset.symbol}</span>
                <span className="text-gray-500 text-sm ml-2">
                  {holding.balance.toFixed(4)}
                </span>
              </div>
              <div className="text-right">
                <div className="text-white font-medium">${holding.balanceUSD.toFixed(2)}</div>
                <div className="text-xs text-emerald-400">
                  +${holding.estimatedYieldMonthly.toFixed(2)}/mo
                </div>
              </div>
            </div>
            {onWithdraw && (
              <button
                onClick={() => onWithdraw(holding.asset.symbol)}
                className="w-full py-1.5 bg-gray-800/50 hover:bg-gray-800 text-gray-400 rounded text-xs transition-colors"
              >
                Withdraw
              </button>
            )}
          </div>
        ))}
      </div>
      
      {/* Yield Summary */}
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="bg-gray-900/50 rounded-lg p-2">
          <div className="text-emerald-400 font-medium">+${portfolio.totalYieldDaily.toFixed(2)}</div>
          <div className="text-xs text-gray-500">Daily</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-2">
          <div className="text-emerald-400 font-medium">+${portfolio.totalYieldMonthly.toFixed(2)}</div>
          <div className="text-xs text-gray-500">Monthly</div>
        </div>
        <div className="bg-gray-900/50 rounded-lg p-2">
          <div className="text-emerald-400 font-medium">+${portfolio.totalYieldYearly.toFixed(2)}</div>
          <div className="text-xs text-gray-500">Yearly</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RWA YIELD CALCULATION MESSAGE
// ============================================================================

interface RWAYieldMessageProps {
  amount: number;
  apy: number;
  months: number;
  projection: YieldProjection;
}

export function RWAYieldMessage({ amount, apy, months, projection }: RWAYieldMessageProps) {
  // Key milestones to show
  const milestones = [1, 3, 6, 12].filter(m => m <= months);
  
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-emerald-500/20 max-w-md">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🧮</span>
        <div className="font-bold text-white">Yield Projection</div>
      </div>
      
      {/* Input Summary */}
      <div className="bg-gray-900/50 rounded-lg p-3 mb-4 font-mono text-sm">
        <div className="flex justify-between mb-1">
          <span className="text-gray-400">Deposit:</span>
          <span className="text-white">${amount.toLocaleString()}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="text-gray-400">APY:</span>
          <span className="text-emerald-400">{apy.toFixed(2)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Period:</span>
          <span className="text-white">{months} months</span>
        </div>
      </div>
      
      {/* Results */}
      <div className="bg-emerald-500/10 rounded-lg p-4 mb-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">Final Value</div>
            <div className="text-xl font-bold text-white">
              ${projection.finalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Total Yield</div>
            <div className="text-xl font-bold text-emerald-400">
              +${projection.totalYield.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Timeline */}
      <div className="space-y-2 font-mono text-sm">
        <div className="text-xs text-gray-500 uppercase">Timeline</div>
        {milestones.map((m) => {
          const data = projection.monthly[m - 1];
          if (!data) return null;
          
          return (
            <div key={m} className="flex justify-between">
              <span className="text-gray-400">{m} month{m !== 1 ? 's' : ''}:</span>
              <span className="text-white">
                ${data.endValue.toFixed(2)}
                <span className="text-emerald-400 ml-2">+${data.yield.toFixed(2)}</span>
              </span>
            </div>
          );
        })}
      </div>
      
      {/* Note */}
      <div className="mt-4 text-xs text-gray-500 text-center">
        *Based on current APY, actual returns may vary
      </div>
    </div>
  );
}

// ============================================================================
// RWA DEPOSIT CONFIRMATION MESSAGE (simplified for chat)
// ============================================================================

interface RWADepositConfirmMessageProps {
  fromToken: string;
  toToken: string;
  amount: number;
  outputAmount: number;
  apy: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RWADepositConfirmMessage({
  fromToken,
  toToken,
  amount,
  outputAmount,
  apy,
  onConfirm,
  onCancel,
}: RWADepositConfirmMessageProps) {
  const monthlyYield = (outputAmount * apy / 100) / 12;
  const yearlyYield = outputAmount * apy / 100;
  
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-emerald-500/20 max-w-md">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🔄</span>
        <div className="font-bold text-white">Deposit to RWA</div>
      </div>
      
      {/* Swap Details */}
      <div className="bg-gray-900/50 rounded-lg p-3 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">You deposit</div>
            <div className="text-lg font-bold text-white">{amount} {fromToken}</div>
          </div>
          <span className="text-gray-500">→</span>
          <div className="text-right">
            <div className="text-sm text-gray-400">You receive</div>
            <div className="text-lg font-bold text-emerald-400">~{outputAmount.toFixed(4)} {toToken}</div>
          </div>
        </div>
      </div>
      
      {/* Yield Preview */}
      <div className="bg-emerald-500/10 rounded-lg p-3 mb-4">
        <div className="text-sm text-emerald-400 font-medium mb-2">📈 Projected Yield ({apy.toFixed(2)}% APY)</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-400">Monthly:</span>
            <span className="text-white ml-2">+${monthlyYield.toFixed(2)}</span>
          </div>
          <div>
            <span className="text-gray-400">Yearly:</span>
            <span className="text-white ml-2">+${yearlyYield.toFixed(2)}</span>
          </div>
        </div>
      </div>
      
      {/* Info */}
      <div className="text-xs text-gray-500 mb-4">
        Backing: US Treasury Bills • Risk: ⭐ Very Low
      </div>
      
      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm font-medium transition-colors"
        >
          Confirm ✓
        </button>
      </div>
    </div>
  );
}
