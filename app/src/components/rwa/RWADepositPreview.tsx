// ============================================================================
// KRYPTOS RWA - Deposit Preview Component
// Shows yield projection before depositing to RWA
// ============================================================================

'use client';

import React, { useEffect, useState } from 'react';
import { getUSDYWithData, getUSDYAPY } from '@/lib/rwa/usdy';
import { estimateYield } from '@/lib/rwa';

// ============================================================================
// TYPES
// ============================================================================

interface RWADepositPreviewProps {
  fromToken: string;        // e.g., "USDC"
  toToken: string;          // e.g., "USDY"
  amount: number;           // Amount to deposit
  estimatedOutput?: number; // Estimated output amount (from swap quote)
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  className?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function RWADepositPreview({
  fromToken,
  toToken,
  amount,
  estimatedOutput,
  onConfirm,
  onCancel,
  loading = false,
  className = '',
}: RWADepositPreviewProps) {
  const [apy, setAPY] = useState<number>(4.5); // Default APY
  const [price, setPrice] = useState<number>(1.11); // Default price
  const [loadingData, setLoadingData] = useState(true);
  
  useEffect(() => {
    async function fetchData() {
      setLoadingData(true);
      try {
        const response = await getUSDYWithData();
        if (response.success && response.data) {
          setAPY(response.data.data.apy);
          setPrice(response.data.data.price);
        }
      } catch (error) {
        console.error('Failed to fetch RWA data:', error);
      } finally {
        setLoadingData(false);
      }
    }
    
    fetchData();
  }, []);
  
  // Calculate estimated output if not provided
  const outputAmount = estimatedOutput || (amount / price);
  
  // Calculate yield projections
  const outputValueUSD = outputAmount * price;
  const yields = estimateYield(outputValueUSD, apy, 12);
  
  return (
    <div className={`bg-gradient-to-br from-gray-800/90 to-gray-900/90 rounded-2xl border border-gray-700/50 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600/20 to-blue-600/20 px-6 py-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center">
            <span className="text-xl">💎</span>
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Deposit to RWA</h3>
            <p className="text-sm text-gray-400">Earn yield from US Treasury Bills</p>
          </div>
        </div>
      </div>
      
      {/* Swap Info */}
      <div className="p-6">
        {/* From/To */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1">
            <div className="text-sm text-gray-400 mb-1">You deposit</div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-full flex items-center justify-center">
                <span className="text-sm">💵</span>
              </div>
              <div>
                <span className="text-2xl font-bold text-white">{amount.toLocaleString()}</span>
                <span className="text-gray-400 ml-2">{fromToken}</span>
              </div>
            </div>
          </div>
          
          <div className="px-4">
            <div className="w-10 h-10 bg-gray-700/50 rounded-full flex items-center justify-center">
              <span className="text-xl">→</span>
            </div>
          </div>
          
          <div className="flex-1 text-right">
            <div className="text-sm text-gray-400 mb-1">You receive</div>
            <div className="flex items-center justify-end gap-2">
              <div>
                <span className="text-2xl font-bold text-emerald-400">
                  ~{outputAmount.toFixed(4)}
                </span>
                <span className="text-gray-400 ml-2">{toToken}</span>
              </div>
              <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <span className="text-sm">💎</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Yield Projection Card */}
        <div className="bg-emerald-500/10 rounded-xl p-5 border border-emerald-500/20 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-emerald-400">📈 Yield Projection</h4>
            <span className="px-3 py-1 bg-emerald-500/20 rounded-full text-sm font-bold text-emerald-400">
              {loadingData ? '...' : `${apy.toFixed(2)}% APY`}
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-white">
                +${yields.daily.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">Per Day</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-white">
                +${yields.monthly.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">Per Month</div>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-white">
                +${yields.yearly.toFixed(2)}
              </div>
              <div className="text-xs text-gray-500">Per Year</div>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-emerald-500/20">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">After 1 year:</span>
              <span className="text-white font-medium">
                ${(outputValueUSD + yields.yearly).toFixed(2)} 
                <span className="text-emerald-400 ml-1">(+{((yields.yearly / outputValueUSD) * 100).toFixed(1)}%)</span>
              </span>
            </div>
          </div>
        </div>
        
        {/* Info Box */}
        <div className="bg-gray-800/50 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-lg">ℹ️</span>
            <div className="text-sm text-gray-400">
              <p className="mb-2">
                <strong className="text-white">USDY</strong> is a yield-bearing stablecoin backed by 
                US Treasury Bills. Yield accrues automatically through price appreciation.
              </p>
              <p>
                No staking required — just hold USDY and watch your balance grow!
              </p>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-3 bg-gray-700/50 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-blue-500 hover:from-emerald-600 hover:to-blue-600 text-white rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Confirm Deposit</span>
                <span>✓</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
