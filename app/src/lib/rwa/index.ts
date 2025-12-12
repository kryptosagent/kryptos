  // ============================================================================
  // KRYPTOS RWA Aggregator
  // Main entry point for all RWA operations
  // ============================================================================

  import {
    RWAAsset,
    RWAData,
    RWAAssetWithData,
    RWAHolding,
    RWAPortfolio,
    RWAApiResponse,
    YieldProjection,
    YieldProjectionInput,
    RWASwapQuote,
  } from './types';

  import {
    USDY_ASSET,
    USDY_MINT,
    getUSDYData,
    getUSDYWithData,
    getUSDYPrice,
    getUSDYAPY,
    getUSDYDataSafe,
    refreshUSDYData,
  } from './usdy';

  // ============================================================================
  // RWA REGISTRY
  // All supported RWA assets
  // ============================================================================

  export const RWA_ASSETS: Record<string, RWAAsset> = {
    usdy: USDY_ASSET,
    // Future: Add more RWA assets here
    // usdm: USDM_ASSET,
    // maple: MAPLE_ASSET,
  };

  export const RWA_MINTS: Record<string, string> = {
    USDY: USDY_MINT,
    // Future mints
  };

  /**
   * Check if a mint address is a supported RWA token
   */
  export function isRWAToken(mint: string): boolean {
    return Object.values(RWA_MINTS).includes(mint);
  }

  /**
   * Get RWA asset by mint address
   */
  export function getRWAByMint(mint: string): RWAAsset | null {
    const symbol = Object.keys(RWA_MINTS).find(s => RWA_MINTS[s] === mint);
    if (!symbol) return null;
    return RWA_ASSETS[symbol.toLowerCase()] || null;
  }

  /**
   * Get RWA asset by symbol
   */
  export function getRWABySymbol(symbol: string): RWAAsset | null {
    return RWA_ASSETS[symbol.toLowerCase()] || null;
  }

  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  /**
   * Get all RWA assets with realtime data
   */
  export async function getAllRWAAssets(): Promise<RWAAssetWithData[]> {
    const results: RWAAssetWithData[] = [];
    
    // Fetch USDY
    const usdyResponse = await getUSDYWithData();
    if (usdyResponse.success && usdyResponse.data) {
      results.push(usdyResponse.data);
    }
    
    // Future: Fetch other RWA assets
    // const usdmResponse = await getUSDMWithData();
    // if (usdmResponse.success && usdmResponse.data) {
    //   results.push(usdmResponse.data);
    // }
    
    return results;
  }

  /**
   * Get single RWA asset with data by symbol
   */
  export async function getRWAWithData(symbol: string): Promise<RWAApiResponse<RWAAssetWithData>> {
    const normalizedSymbol = symbol.toLowerCase();
    
    switch (normalizedSymbol) {
      case 'usdy':
        return getUSDYWithData();
      // Future cases
      // case 'usdm':
      //   return getUSDMWithData();
      default:
        return {
          success: false,
          error: `Unknown RWA asset: ${symbol}`,
        };
    }
  }

  /**
   * Get RWA data by mint address
   */
  export async function getRWADataByMint(mint: string): Promise<RWAApiResponse<RWAData>> {
    switch (mint) {
      case USDY_MINT:
        return getUSDYData();
      // Future cases
      default:
        return {
          success: false,
          error: `Unknown RWA mint: ${mint}`,
        };
    }
  }

  // ============================================================================
  // PORTFOLIO TRACKING
  // ============================================================================

  /**
   * Calculate RWA holdings for a user
   */
  export async function calculateRWAHolding(
    asset: RWAAsset,
    balance: number
  ): Promise<RWAHolding> {
    // Get current data for this asset
    let data: RWAData;
    
    switch (asset.id) {
      case 'usdy':
        data = await getUSDYDataSafe();
        break;
      default:
        // Fallback
        data = {
          price: 1.0,
          apy: 0,
          tvl: 0,
          lastUpdated: new Date(),
        };
    }
    
    const balanceUSD = balance * data.price;
    
    // Calculate yield projections
    const yearlyYield = balanceUSD * (data.apy / 100);
    const monthlyYield = yearlyYield / 12;
    const dailyYield = yearlyYield / 365;
    
    return {
      asset,
      balance,
      balanceUSD,
      estimatedYieldDaily: Math.round(dailyYield * 100) / 100,
      estimatedYieldMonthly: Math.round(monthlyYield * 100) / 100,
      estimatedYieldYearly: Math.round(yearlyYield * 100) / 100,
    };
  }

  /**
   * Build RWA portfolio from user's token balances
   */
  export async function buildRWAPortfolio(
    tokenBalances: Array<{ mint: string; balance: number }>
  ): Promise<RWAPortfolio> {
    const holdings: RWAHolding[] = [];
    
    for (const { mint, balance } of tokenBalances) {
      if (balance <= 0) continue;
      
      const asset = getRWAByMint(mint);
      if (!asset) continue;
      
      const holding = await calculateRWAHolding(asset, balance);
      holdings.push(holding);
    }
    
    // Calculate totals
    const totalValueUSD = holdings.reduce((sum, h) => sum + h.balanceUSD, 0);
    const totalYieldDaily = holdings.reduce((sum, h) => sum + h.estimatedYieldDaily, 0);
    const totalYieldMonthly = holdings.reduce((sum, h) => sum + h.estimatedYieldMonthly, 0);
    const totalYieldYearly = holdings.reduce((sum, h) => sum + h.estimatedYieldYearly, 0);
    
    // Calculate blended APY
    const blendedAPY = totalValueUSD > 0 
      ? (totalYieldYearly / totalValueUSD) * 100 
      : 0;
    
    return {
      holdings,
      totalValueUSD: Math.round(totalValueUSD * 100) / 100,
      totalYieldDaily: Math.round(totalYieldDaily * 100) / 100,
      totalYieldMonthly: Math.round(totalYieldMonthly * 100) / 100,
      totalYieldYearly: Math.round(totalYieldYearly * 100) / 100,
      blendedAPY: Math.round(blendedAPY * 100) / 100,
      lastUpdated: new Date(),
    };
  }

  // ============================================================================
  // YIELD CALCULATIONS
  // ============================================================================

  /**
   * Calculate yield projection for an investment
   */
  export function calculateYieldProjection(input: YieldProjectionInput): YieldProjection {
    const { amount, apy, months, compounding = 'none' } = input;
    
    const monthlyRate = apy / 100 / 12;
    const monthly: YieldProjection['monthly'] = [];
    
    let currentValue = amount;
    
    for (let month = 1; month <= months; month++) {
      const startValue = currentValue;
      let yieldAmount: number;
      
      switch (compounding) {
        case 'monthly':
          yieldAmount = currentValue * monthlyRate;
          currentValue += yieldAmount;
          break;
        case 'daily':
          // Approximate daily compounding
          const dailyRate = apy / 100 / 365;
          const daysInMonth = 30;
          for (let d = 0; d < daysInMonth; d++) {
            currentValue *= (1 + dailyRate);
          }
          yieldAmount = currentValue - startValue;
          break;
        case 'none':
        default:
          yieldAmount = amount * monthlyRate; // Simple interest
          currentValue = amount + (yieldAmount * month);
          break;
      }
      
      monthly.push({
        month,
        startValue: Math.round(startValue * 100) / 100,
        yield: Math.round(yieldAmount * 100) / 100,
        endValue: Math.round(currentValue * 100) / 100,
      });
    }
    
    const finalValue = monthly[monthly.length - 1]?.endValue || amount;
    const totalYield = finalValue - amount;
    
    return {
      input,
      finalValue: Math.round(finalValue * 100) / 100,
      totalYield: Math.round(totalYield * 100) / 100,
      monthly,
    };
  }

  /**
   * Quick yield estimate (simple interest)
   */
  export function estimateYield(amount: number, apy: number, months: number = 12): {
    daily: number;
    monthly: number;
    yearly: number;
    total: number;
  } {
    const yearlyYield = amount * (apy / 100);
    const periodYield = yearlyYield * (months / 12);
    
    return {
      daily: Math.round((yearlyYield / 365) * 100) / 100,
      monthly: Math.round((yearlyYield / 12) * 100) / 100,
      yearly: Math.round(yearlyYield * 100) / 100,
      total: Math.round(periodYield * 100) / 100,
    };
  }

  // ============================================================================
  // SWAP ENHANCEMENT
  // ============================================================================

  /**
   * Enhance a swap quote with RWA info if applicable
   */
  export async function enhanceSwapWithRWA(
    inputMint: string,
    outputMint: string,
    inputAmount: number,
    outputAmount: number,
    priceImpact: number
  ): Promise<RWASwapQuote> {
    const quote: RWASwapQuote = {
      inputToken: inputMint,
      outputToken: outputMint,
      inputAmount,
      outputAmount,
      priceImpact,
    };
    
    // Check if output is RWA token
    const rwaAsset = getRWAByMint(outputMint);
    
    if (rwaAsset) {
      // Get current APY
      let apy = 5.0; // Default
      
      if (outputMint === USDY_MINT) {
        apy = await getUSDYAPY();
      }
      
      // Calculate yield projections based on output amount
      const outputValueUSD = outputAmount; // For stablecoins, amount ≈ USD value
      const yields = estimateYield(outputValueUSD, apy);
      
      quote.rwaAsset = rwaAsset;
      quote.currentAPY = apy;
      quote.projectedYieldDaily = yields.daily;
      quote.projectedYieldMonthly = yields.monthly;
      quote.projectedYieldYearly = yields.yearly;
    }
    
    return quote;
  }

  // ============================================================================
  // FORMATTED OUTPUT HELPERS
  // ============================================================================

  /**
   * Format RWA info for display
   */
  export function formatRWAInfo(asset: RWAAssetWithData): string {
    const { data } = asset;
    
    const riskEmoji = {
      'Very Low': '⭐',
      'Low': '⭐⭐',
      'Medium': '⭐⭐⭐',
      'High': '⭐⭐⭐⭐',
      'Very High': '⭐⭐⭐⭐⭐',
    }[asset.riskLabel] || '⭐';
    
    return `📊 **${asset.name} (${asset.symbol})**

  ┌─────────────────────────────────┐
  │  Current APY:    ${data.apy.toFixed(2)}%          │
  │  Price:          $${data.price.toFixed(4)}        │
  │  TVL:            $${formatNumber(data.tvl)}      │
  │  Risk:           ${riskEmoji} ${asset.riskLabel}  │
  │  Liquidity:      ${asset.liquidity}             │
  │  Backing:        ${asset.backing}               │
  │  Issuer:         ${asset.issuer}                │
  └─────────────────────────────────┘

  💡 ${asset.symbol} earns yield automatically - just hold it!`;
  }

  /**
   * Format RWA portfolio for display
   */
  export function formatRWAPortfolio(portfolio: RWAPortfolio): string {
    if (portfolio.holdings.length === 0) {
      return `💼 **Your RWA Portfolio**

  No RWA holdings found. 

  Try: "swap 100 USDC to USDY" to start earning yield!`;
    }
    
    let output = `💼 **Your RWA Portfolio**

  `;
    
    // Holdings table
    output += `Asset     Balance      Value       APY      Yield/mo\n`;
    output += `──────────────────────────────────────────────────\n`;
    
    for (const holding of portfolio.holdings) {
      output += `${holding.asset.symbol.padEnd(9)} `;
      output += `${holding.balance.toFixed(2).padStart(10)} `;
      output += `$${holding.balanceUSD.toFixed(2).padStart(9)} `;
      output += `${(holding.estimatedYieldYearly / holding.balanceUSD * 100).toFixed(1)}%`.padStart(7);
      output += ` +$${holding.estimatedYieldMonthly.toFixed(2)}\n`;
    }
    
    output += `\n`;
    output += `📈 **Totals**\n`;
    output += `Total Value:     $${portfolio.totalValueUSD.toFixed(2)}\n`;
    output += `Blended APY:     ${portfolio.blendedAPY.toFixed(2)}%\n`;
    output += `Monthly Yield:   +$${portfolio.totalYieldMonthly.toFixed(2)}\n`;
    output += `Yearly Yield:    +$${portfolio.totalYieldYearly.toFixed(2)}\n`;
    
    return output;
  }

  /**
   * Format yield projection for display
   */
  export function formatYieldProjection(amount: number, apy: number, months: number = 12): string {
    const projection = calculateYieldProjection({
      amount,
      apy,
      months,
      compounding: 'none',
    });
    
    return `🧮 **Yield Projection**

  Deposit: $${amount.toFixed(2)} at ${apy.toFixed(2)}% APY

  Timeline        Value         Yield
  ────────────────────────────────────
  1 month        $${(amount + projection.monthly[0]?.yield || 0).toFixed(2).padStart(9)}    +$${projection.monthly[0]?.yield.toFixed(2) || '0.00'}
  3 months       $${(amount + (projection.monthly[2]?.yield || 0) * 3).toFixed(2).padStart(9)}    +$${((projection.monthly[2]?.yield || 0) * 3).toFixed(2)}
  6 months       $${(amount + (projection.monthly[5]?.yield || 0) * 6).toFixed(2).padStart(9)}    +$${((projection.monthly[5]?.yield || 0) * 6).toFixed(2)}
  1 year         $${projection.finalValue.toFixed(2).padStart(9)}    +$${projection.totalYield.toFixed(2)}

  *Based on current APY, actual returns may vary`;
  }

  /**
   * Format RWA swap confirmation
   */
  export function formatRWASwapConfirmation(quote: RWASwapQuote): string {
    if (!quote.rwaAsset) {
      return ''; // Not an RWA swap
    }
    
    return `🔄 **Swap to RWA**

  You're swapping:
    ${quote.inputAmount} → ~${quote.outputAmount.toFixed(4)} ${quote.rwaAsset.symbol}

  📈 **RWA Benefits:**
    ├─ APY: ${quote.currentAPY?.toFixed(2)}%
    ├─ Monthly Yield: +$${quote.projectedYieldMonthly?.toFixed(2)}
    ├─ Yearly Yield: +$${quote.projectedYieldYearly?.toFixed(2)}
    ├─ Backing: ${quote.rwaAsset.backing}
    └─ Risk: ${quote.rwaAsset.riskLabel}

  Your ${quote.rwaAsset.symbol} earns yield automatically!`;
  }

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================

  function formatNumber(num: number): string {
    if (num >= 1_000_000_000) {
      return (num / 1_000_000_000).toFixed(2) + 'B';
    }
    if (num >= 1_000_000) {
      return (num / 1_000_000).toFixed(2) + 'M';
    }
    if (num >= 1_000) {
      return (num / 1_000).toFixed(2) + 'K';
    }
    return num.toFixed(2);
  }

  // ============================================================================
// EXPORTS
// ============================================================================

// Re-export types from types.ts
export type {
  RWAAsset,
  RWAData,
  RWAAssetWithData,
  RWAHolding,
  RWAPortfolio,
  RWAApiResponse,
  YieldProjection,
  YieldProjectionInput,
  RWASwapQuote,
} from './types';

// Re-export from usdy.ts
export {
  USDY_ASSET,
  USDY_MINT,
  getUSDYData,
  getUSDYWithData,
  getUSDYPrice,
  getUSDYAPY,
  getUSDYDataSafe,
  refreshUSDYData,
} from './usdy';

