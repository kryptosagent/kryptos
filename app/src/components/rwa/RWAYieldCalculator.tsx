// ============================================================================
// KRYPTOS RWA - Yield Calculator Component
// Interactive yield projection calculator
// ============================================================================

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { getUSDYAPY } from '@/lib/rwa/usdy';
import { calculateDetailedProjection } from '@/lib/rwa/calculator';

// ============================================================================
// TYPES
// ============================================================================

interface RWAYieldCalculatorProps {
  defaultAmount?: number;
  defaultMonths?: number;
  onDeposit?: (amount: number) => void;
  className?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RWAYieldCalculator({
  defaultAmount = 1000,
  defaultMonths = 12,
  onDeposit,
  className = '',
}: RWAYieldCalculatorProps) {
  const [amount, setAmount] = useState<number>(defaultAmount);
  const [months, setMonths] = useState<number>(defaultMonths);
  const [apy, setAPY] = useState<number>(4.5);
  const [loadingAPY, setLoadingAPY] = useState(true);
  
  // Fetch current APY
  useEffect(() => {
    async function fetchAPY() {
      setLoadingAPY(true);
      try {
        const currentAPY = await getUSDYAPY();
        setAPY(currentAPY);
      } catch (error) {
        console.error('Failed to fetch APY:', error);
      } finally {
        setLoadingAPY(false);
      }
    }
    
    fetchAPY();
  }, []);
  
  // Calculate projection
  const projection = useMemo(() => {
    return calculateDetailedProjection(amount, apy, months, 'none');
  }, [amount, apy, months]);
  
  // Quick amount buttons
  const quickAmounts = [100, 500, 1000, 5000, 10000];
  
  // Time period buttons
  const timePeriods = [
    { label: '3M', months: 3 },
    { label: '6M', months: 6 },
    { label: '1Y', months: 12 },
    { label: '2Y', months: 24 },
    { label: '5Y', months: 60 },
  ];
  
  return (
    <div className={`bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-2xl border border-gray-700/50 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600/20 to-blue-600/20 px-6 py-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
            <span className="text-xl">🧮</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Yield Calculator</h3>
            <p className="text-sm text-gray-400">Project your USDY earnings</p>
          </div>
        </div>
      </div>
      
      <div className="p-6">
        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Deposit Amount (USD)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-lg">$</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-xl py-3 pl-10 pr-4 text-xl font-bold text-white focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
              placeholder="1000"
            />
          </div>
          
          {/* Quick Amount Buttons */}
          <div className="flex gap-2 mt-3">
            {quickAmounts.map((amt) => (
              <button
                key={amt}
                onClick={() => setAmount(amt)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                  amount === amt
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:border-gray-600'
                }`}
              >
                ${amt >= 1000 ? `${amt/1000}K` : amt}
              </button>
            ))}
          </div>
        </div>
        
        {/* Time Period */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Time Period
          </label>
          <div className="flex gap-2">
            {timePeriods.map((period) => (
              <button
                key={period.months}
                onClick={() => setMonths(period.months)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-colors ${
                  months === period.months
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-gray-800/50 text-gray-400 border border-gray-700/50 hover:border-gray-600'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Current APY */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Current USDY APY</span>
            <span className="text-xl font-bold text-emerald-400">
              {loadingAPY ? '...' : `${apy.toFixed(2)}%`}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Based on US Treasury yields
          </div>
        </div>
        
        {/* Results */}
        <div className="bg-gradient-to-br from-emerald-900/30 to-blue-900/30 rounded-xl p-5 border border-emerald-500/20 mb-6">
          <h4 className="text-sm font-medium text-gray-400 mb-4">
            After {months} month{months !== 1 ? 's' : ''}
          </h4>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="text-sm text-gray-500 mb-1">Final Value</div>
              <div className="text-3xl font-bold text-white">
                ${projection.finalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-1">Total Yield</div>
              <div className="text-3xl font-bold text-emerald-400">
                +${projection.totalYield.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
          
          {/* Monthly Breakdown */}
          <div className="border-t border-gray-700/50 pt-4">
            <div className="text-xs text-gray-500 mb-2">Monthly Yield</div>
            <div className="flex items-center gap-2">
              <div className="text-lg font-bold text-white">
                +${(projection.totalYield / months).toFixed(2)}
              </div>
              <span className="text-gray-500">/month average</span>
            </div>
          </div>
        </div>
        
        {/* Progress Bar Visualization */}
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Growth</span>
            <span className="text-emerald-400">
              +{((projection.totalYield / amount) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 transition-all duration-500"
              style={{ 
                width: `${Math.min(100, (projection.finalValue / amount) * 100 - 100 + 100)}%` 
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>${amount.toLocaleString()}</span>
            <span>${projection.finalValue.toLocaleString()}</span>
          </div>
        </div>
        
        {/* Milestone Preview */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[1, 3, 6, 12].filter(m => m <= months).map((m) => {
            const milestoneData = projection.monthly[m - 1];
            return (
              <div 
                key={m} 
                className="bg-gray-800/50 rounded-lg p-3 text-center"
              >
                <div className="text-xs text-gray-500 mb-1">{m}M</div>
                <div className="text-sm font-bold text-white">
                  ${milestoneData?.endValue.toFixed(0)}
                </div>
                <div className="text-xs text-emerald-400">
                  +${milestoneData?.yield.toFixed(0)}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Disclaimer */}
        <div className="text-xs text-gray-500 mb-6 text-center">
          * Projections based on current APY. Actual returns may vary based on Treasury rates.
        </div>
        
        {/* Action Button */}
        {onDeposit && (
          <button
            onClick={() => onDeposit(amount)}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white rounded-xl font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Deposit ${amount.toLocaleString()} & Start Earning
          </button>
        )}
      </div>
    </div>
  );
}
