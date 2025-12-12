// ============================================================================
// KRYPTOS RWA - Yield Calculator
// Advanced yield calculations and projections
// ============================================================================

import { YieldProjection, YieldProjectionInput } from './types';

// ============================================================================
// COMPOUND INTEREST CALCULATIONS
// ============================================================================

/**
 * Calculate future value with compound interest
 * 
 * @param principal - Initial investment amount
 * @param rate - Annual interest rate (as decimal, e.g., 0.05 for 5%)
 * @param periods - Number of compounding periods
 * @param periodsPerYear - How many periods in a year (12 for monthly, 365 for daily)
 */
export function compoundInterest(
  principal: number,
  rate: number,
  periods: number,
  periodsPerYear: number
): number {
  const ratePerPeriod = rate / periodsPerYear;
  return principal * Math.pow(1 + ratePerPeriod, periods);
}

/**
 * Calculate simple interest future value
 */
export function simpleInterest(
  principal: number,
  rate: number,
  years: number
): number {
  return principal * (1 + rate * years);
}

// ============================================================================
// YIELD PROJECTIONS
// ============================================================================

/**
 * Calculate detailed yield projection over time
 */
export function calculateDetailedProjection(
  principal: number,
  apyPercent: number,
  months: number,
  compounding: 'none' | 'daily' | 'monthly' = 'none'
): YieldProjection {
  const apy = apyPercent / 100;
  const monthly: YieldProjection['monthly'] = [];
  
  let currentValue = principal;
  
  for (let month = 1; month <= months; month++) {
    const startValue = currentValue;
    let endValue: number;
    
    switch (compounding) {
      case 'daily':
        // Compound daily for this month
        endValue = compoundInterest(principal, apy, month * 30, 365);
        break;
        
      case 'monthly':
        // Compound monthly
        endValue = compoundInterest(principal, apy, month, 12);
        break;
        
      case 'none':
      default:
        // Simple interest
        endValue = simpleInterest(principal, apy, month / 12);
        break;
    }
    
    currentValue = endValue;
    
    monthly.push({
      month,
      startValue: round2(startValue),
      yield: round2(endValue - startValue),
      endValue: round2(endValue),
    });
  }
  
  const finalValue = monthly[monthly.length - 1]?.endValue || principal;
  
  return {
    input: {
      amount: principal,
      apy: apyPercent,
      months,
      compounding,
    },
    finalValue: round2(finalValue),
    totalYield: round2(finalValue - principal),
    monthly,
  };
}

/**
 * Quick yield estimates at different time horizons
 */
export function quickYieldEstimate(principal: number, apyPercent: number) {
  const apy = apyPercent / 100;
  
  return {
    daily: round2(principal * apy / 365),
    weekly: round2(principal * apy / 52),
    monthly: round2(principal * apy / 12),
    quarterly: round2(principal * apy / 4),
    yearly: round2(principal * apy),
    
    // With time horizons
    after1Month: round2(principal * (1 + apy / 12)),
    after3Months: round2(principal * (1 + apy / 4)),
    after6Months: round2(principal * (1 + apy / 2)),
    after1Year: round2(principal * (1 + apy)),
    after2Years: round2(principal * (1 + apy * 2)),
  };
}

// ============================================================================
// DCA (Dollar Cost Average) INTO RWA
// ============================================================================

export interface DCAProjection {
  totalInvested: number;
  finalValue: number;
  totalYield: number;
  averageCost: number;
  effectiveAPY: number;
  schedule: Array<{
    period: number;
    investment: number;
    totalInvested: number;
    yield: number;
    value: number;
  }>;
}

/**
 * Calculate DCA into yield-bearing asset
 * 
 * @param amountPerPeriod - Amount to invest each period
 * @param periods - Number of periods
 * @param apyPercent - Annual yield %
 * @param frequency - 'weekly' | 'monthly'
 */
export function calculateDCAIntoRWA(
  amountPerPeriod: number,
  periods: number,
  apyPercent: number,
  frequency: 'weekly' | 'monthly' = 'monthly'
): DCAProjection {
  const apy = apyPercent / 100;
  const periodsPerYear = frequency === 'weekly' ? 52 : 12;
  const ratePerPeriod = apy / periodsPerYear;
  
  const schedule: DCAProjection['schedule'] = [];
  let totalValue = 0;
  let totalInvested = 0;
  
  for (let period = 1; period <= periods; period++) {
    // Existing value earns yield
    totalValue = totalValue * (1 + ratePerPeriod);
    
    // Add new investment
    totalInvested += amountPerPeriod;
    totalValue += amountPerPeriod;
    
    const yieldThisPeriod = totalValue - totalInvested;
    
    schedule.push({
      period,
      investment: amountPerPeriod,
      totalInvested,
      yield: round2(yieldThisPeriod),
      value: round2(totalValue),
    });
  }
  
  const totalYield = totalValue - totalInvested;
  const effectiveAPY = (totalYield / totalInvested) * (periodsPerYear / periods) * 100;
  
  return {
    totalInvested,
    finalValue: round2(totalValue),
    totalYield: round2(totalYield),
    averageCost: round2(totalInvested / periods),
    effectiveAPY: round2(effectiveAPY),
    schedule,
  };
}

// ============================================================================
// COMPARISON UTILITIES
// ============================================================================

export interface YieldComparison {
  asset: string;
  apy: number;
  riskScore: number;
  yield1Month: number;
  yield1Year: number;
  score: number; // Risk-adjusted score
}

/**
 * Compare different RWA yields
 */
export function compareRWAYields(
  principal: number,
  assets: Array<{ name: string; apy: number; riskScore: number }>
): YieldComparison[] {
  return assets.map(asset => {
    const yield1Month = principal * (asset.apy / 100) / 12;
    const yield1Year = principal * (asset.apy / 100);
    
    // Risk-adjusted score: APY * (10 - riskScore) / 10
    // Higher score = better risk-adjusted return
    const score = asset.apy * (10 - asset.riskScore) / 10;
    
    return {
      asset: asset.name,
      apy: asset.apy,
      riskScore: asset.riskScore,
      yield1Month: round2(yield1Month),
      yield1Year: round2(yield1Year),
      score: round2(score),
    };
  }).sort((a, b) => b.score - a.score); // Sort by risk-adjusted score
}

// ============================================================================
// BREAKEVEN CALCULATIONS
// ============================================================================

/**
 * Calculate how long until yield covers a specific cost
 * (e.g., swap fees, gas costs)
 */
export function calculateBreakeven(
  principal: number,
  apyPercent: number,
  cost: number
): {
  days: number;
  hours: number;
  breakeven: Date;
} {
  const apy = apyPercent / 100;
  const dailyYield = principal * apy / 365;
  
  const daysToBreakeven = cost / dailyYield;
  const hoursToBreakeven = daysToBreakeven * 24;
  
  const breakevenDate = new Date();
  breakevenDate.setTime(breakevenDate.getTime() + daysToBreakeven * 24 * 60 * 60 * 1000);
  
  return {
    days: round2(daysToBreakeven),
    hours: round2(hoursToBreakeven),
    breakeven: breakevenDate,
  };
}

// ============================================================================
// APY CALCULATIONS FROM PRICE
// ============================================================================

/**
 * Calculate APY from historical price data
 * Useful for yield-bearing tokens that appreciate in price
 */
export function calculateAPYFromPriceHistory(
  prices: Array<{ timestamp: Date; price: number }>
): number {
  if (prices.length < 2) return 0;
  
  // Sort by timestamp
  const sorted = [...prices].sort((a, b) => 
    a.timestamp.getTime() - b.timestamp.getTime()
  );
  
  const firstPrice = sorted[0].price;
  const lastPrice = sorted[sorted.length - 1].price;
  const firstTime = sorted[0].timestamp.getTime();
  const lastTime = sorted[sorted.length - 1].timestamp.getTime();
  
  // Time in years
  const years = (lastTime - firstTime) / (365.25 * 24 * 60 * 60 * 1000);
  
  if (years <= 0) return 0;
  
  // Total return
  const totalReturn = (lastPrice - firstPrice) / firstPrice;
  
  // Annualized return
  const annualizedReturn = totalReturn / years;
  
  return round2(annualizedReturn * 100);
}

/**
 * Calculate APY from two price points
 */
export function calculateAPYFromTwoPrices(
  startPrice: number,
  endPrice: number,
  daysBetween: number
): number {
  if (daysBetween <= 0 || startPrice <= 0) return 0;
  
  const years = daysBetween / 365.25;
  const totalReturn = (endPrice - startPrice) / startPrice;
  const annualizedReturn = totalReturn / years;
  
  return round2(annualizedReturn * 100);
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

/**
 * Format yield projection as text table
 */
export function formatProjectionTable(projection: YieldProjection): string {
  const { input, monthly, finalValue, totalYield } = projection;
  
  let output = `📈 Yield Projection: $${input.amount} at ${input.apy}% APY\n\n`;
  output += `Month   Start Value    Yield      End Value\n`;
  output += `─────────────────────────────────────────────\n`;
  
  // Show key months
  const keyMonths = [1, 3, 6, 12].filter(m => m <= monthly.length);
  
  for (const m of keyMonths) {
    const data = monthly[m - 1];
    if (data) {
      output += `${String(m).padStart(5)}   `;
      output += `$${data.startValue.toFixed(2).padStart(10)}   `;
      output += `+$${data.yield.toFixed(2).padStart(7)}   `;
      output += `$${data.endValue.toFixed(2).padStart(10)}\n`;
    }
  }
  
  output += `─────────────────────────────────────────────\n`;
  output += `Total Yield: +$${totalYield.toFixed(2)}\n`;
  output += `Final Value: $${finalValue.toFixed(2)}\n`;
  
  return output;
}

/**
 * Format quick estimate as text
 */
export function formatQuickEstimate(
  principal: number,
  apyPercent: number
): string {
  const est = quickYieldEstimate(principal, apyPercent);
  
  return `💰 Yield Estimate for $${principal} at ${apyPercent}% APY

Daily:     +$${est.daily}
Weekly:    +$${est.weekly}
Monthly:   +$${est.monthly}
Yearly:    +$${est.yearly}

After 1 month:  $${est.after1Month}
After 6 months: $${est.after6Months}
After 1 year:   $${est.after1Year}`;
}

// ============================================================================
// UTILITY
// ============================================================================

function round2(num: number): number {
  return Math.round(num * 100) / 100;
}

// ============================================================================
// EXPORTS
// ============================================================================

// Re-export types from types.ts
export type { YieldProjection, YieldProjectionInput } from './types';