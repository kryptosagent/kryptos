// ============================================================================
// KRYPTOS RWA (Real World Assets) - Type Definitions
// ============================================================================

/**
 * Core RWA Asset Information
 */
export interface RWAAsset {
  // Identity
  id: string;                    // Unique identifier (e.g., "usdy")
  mint: string;                  // Solana mint address
  symbol: string;                // Token symbol (e.g., "USDY")
  name: string;                  // Full name (e.g., "Ondo US Dollar Yield")
  decimals: number;              // Token decimals
  logoURI?: string;              // Logo URL
  
  // Issuer Info
  issuer: string;                // Issuer name (e.g., "Ondo Finance")
  website: string;               // Official website
  
  // Backing Info (RWA specific)
  backing: string;               // What backs this asset (e.g., "US Treasury Bills")
  jurisdiction: string;          // Legal jurisdiction (e.g., "USA")
  auditor?: string;              // Auditor name if applicable
  
  // Risk Assessment
  riskScore: number;             // 1-10 (1 = safest, 10 = riskiest)
  riskLabel: 'Very Low' | 'Low' | 'Medium' | 'High' | 'Very High';
  
  // Liquidity
  liquidity: 'Instant' | 'T+1' | '7 days' | '30 days' | 'Variable';
  
  // Yield Type
  yieldType: 'rebasing' | 'accumulating' | 'distributing';
  // rebasing = supply changes
  // accumulating = price increases (like USDY)
  // distributing = separate reward token
}

/**
 * Real-time RWA Data (fetched from APIs)
 */
export interface RWAData {
  // Price & Value
  price: number;                 // Current price in USD
  priceChange24h?: number;       // 24h price change %
  
  // Yield Information
  apy: number;                   // Current APY %
  apy7d?: number;                // 7-day average APY
  apy30d?: number;               // 30-day average APY
  
  // TVL & Supply
  tvl: number;                   // Total Value Locked in USD
  totalSupply?: number;          // Total token supply
  
  // Timestamps
  lastUpdated: Date;             // When data was last fetched
}

/**
 * Combined Asset + Data
 */
export interface RWAAssetWithData extends RWAAsset {
  data: RWAData;
}

/**
 * User's RWA Holdings
 */
export interface RWAHolding {
  asset: RWAAsset;
  balance: number;               // Token balance
  balanceUSD: number;            // Current USD value
  
  // Yield tracking
  estimatedYieldDaily: number;   // Estimated daily yield in USD
  estimatedYieldMonthly: number; // Estimated monthly yield in USD
  estimatedYieldYearly: number;  // Estimated yearly yield in USD
  
  // Cost basis (if tracked)
  costBasis?: number;            // Original investment
  unrealizedGain?: number;       // Current gain/loss
}

/**
 * User's RWA Portfolio Summary
 */
export interface RWAPortfolio {
  holdings: RWAHolding[];
  
  // Totals
  totalValueUSD: number;
  totalYieldDaily: number;
  totalYieldMonthly: number;
  totalYieldYearly: number;
  
  // Blended metrics
  blendedAPY: number;            // Weighted average APY
  
  // Last updated
  lastUpdated: Date;
}

/**
 * Yield Projection Input
 */
export interface YieldProjectionInput {
  amount: number;                // Amount to invest
  apy: number;                   // APY %
  months: number;                // Duration in months
  compounding?: 'none' | 'daily' | 'monthly'; // Compounding frequency
}

/**
 * Yield Projection Result
 */
export interface YieldProjection {
  input: YieldProjectionInput;
  
  // Results
  finalValue: number;
  totalYield: number;
  
  // Breakdowns
  monthly: Array<{
    month: number;
    startValue: number;
    yield: number;
    endValue: number;
  }>;
}

/**
 * RWA Swap Quote (extends normal swap with RWA info)
 */
export interface RWASwapQuote {
  // Standard swap info
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  priceImpact: number;
  
  // RWA specific info
  rwaAsset?: RWAAsset;
  currentAPY?: number;
  projectedYieldDaily?: number;
  projectedYieldMonthly?: number;
  projectedYieldYearly?: number;
}

/**
 * API Response wrapper
 */
export interface RWAApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  cached?: boolean;
  cachedAt?: Date;
}

/**
 * Data source configuration
 */
export interface RWADataSource {
  name: string;
  priority: number;              // Lower = higher priority
  enabled: boolean;
  
  // Endpoints
  priceEndpoint?: string;
  apyEndpoint?: string;
  tvlEndpoint?: string;
  
  // Rate limiting
  rateLimit?: number;            // Requests per minute
  cacheTTL?: number;             // Cache duration in seconds
}

/**
 * Supported RWA protocols enum
 */
export enum RWAProtocol {
  ONDO = 'ondo',
  // Future protocols
  MOUNTAIN = 'mountain',
  MAPLE = 'maple',
  CREDIX = 'credix',
}

/**
 * Error types
 */
export enum RWAErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_TOKEN = 'INVALID_TOKEN',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  API_ERROR = 'API_ERROR',
  CACHE_MISS = 'CACHE_MISS',
}

export class RWAError extends Error {
  constructor(
    public type: RWAErrorType,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'RWAError';
  }
}
