// ============================================================================
// KRYPTOS RWA - USDY Provider (Ondo Finance)
// Fetches realtime data from multiple sources with fallbacks
// ============================================================================

import { 
  RWAAsset, 
  RWAData, 
  RWAAssetWithData, 
  RWAApiResponse,
} from './types';

// ============================================================================
// USDY CONFIGURATION (Static)
// ============================================================================

export const USDY_MINT = 'A1KLoBrKBde8Ty9qtNQUtq3C2ortoC3u7twggz7sEto6';

export const USDY_ASSET: RWAAsset = {
  // Identity
  id: 'usdy',
  mint: USDY_MINT,
  symbol: 'USDY',
  name: 'Ondo US Dollar Yield',
  decimals: 6,
  logoURI: 'https://assets.ondo.finance/usdy-logo.png',
  
  // Issuer
  issuer: 'Ondo Finance',
  website: 'https://ondo.finance',
  
  // Backing
  backing: 'US Treasury Bills & Bank Deposits',
  jurisdiction: 'USA',
  auditor: 'NAV Consulting',
  
  // Risk
  riskScore: 1,
  riskLabel: 'Very Low',
  
  // Liquidity
  liquidity: 'Instant', // Via Jupiter
  
  // Yield type - USDY price increases over time (NOT rebasing, NOT LP)
  yieldType: 'accumulating',
};

// ============================================================================
// API ENDPOINTS
// ============================================================================

const JUPITER_PRICE_API = 'https://lite-api.jup.ag/price/v3';
const JUPITER_SEARCH_API = 'https://lite-api.jup.ag/ultra/v1/search';
const DEFILLAMA_TVL_API = 'https://api.llama.fi/protocol/ondo-finance';

// ============================================================================
// CACHE
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const cache: Map<string, CacheEntry<any>> = new Map();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > entry.ttl) {
    cache.delete(key);
    return null;
  }
  
  return entry.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl: ttlMs,
  });
}

// ============================================================================
// DATA FETCHING FUNCTIONS
// ============================================================================

/**
 * Fetch USDY price from Jupiter Price API
 */
async function fetchPriceFromJupiter(): Promise<number | null> {
  try {
    const response = await fetch(`${JUPITER_PRICE_API}?ids=${USDY_MINT}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      console.warn('Jupiter price API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    // Handle nested object structure: { "MINT": { price: X } }
    const tokenData = data?.[USDY_MINT];
    if (tokenData && typeof tokenData === 'object') {
      const price = tokenData.price;
      if (typeof price === 'number' && price > 0) {
        console.log('✓ Jupiter Price API:', price);
        return price;
      }
      // Sometimes price is in string format
      if (typeof price === 'string') {
        const parsed = parseFloat(price);
        if (!isNaN(parsed) && parsed > 0) {
          console.log('✓ Jupiter Price API (parsed):', parsed);
          return parsed;
        }
      }
    }
    
    // Try data.data structure
    const altPrice = data?.data?.[USDY_MINT]?.price;
    if (typeof altPrice === 'number' && altPrice > 0) {
      console.log('✓ Jupiter Price API (alt):', altPrice);
      return altPrice;
    }
    
    console.log('Jupiter Price API: No valid price found');
    return null;
  } catch (error) {
    console.error('Jupiter price fetch error:', error);
    return null;
  }
}

/**
 * Fetch USDY price from Jupiter Search API (RELIABLE BACKUP)
 */
async function fetchPriceFromJupiterSearch(): Promise<number | null> {
  try {
    const response = await fetch(`${JUPITER_SEARCH_API}?query=USDY`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) {
      console.warn('Jupiter Search API error:', response.status);
      return null;
    }
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      // Find exact USDY match by mint address
      const exactMatch = data.find((token: any) => token.id === USDY_MINT);
      
      if (exactMatch && exactMatch.usdPrice) {
        const price = Number(exactMatch.usdPrice);
        if (!isNaN(price) && price > 0) {
          console.log('✓ Jupiter Search API price:', price);
          return price;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Jupiter Search fetch error:', error);
    return null;
  }
}

/**
 * Fetch Ondo Finance TVL from DeFiLlama
 */
async function fetchTVLFromDeFiLlama(): Promise<{ total: number; solana: number } | null> {
  try {
    const response = await fetch(DEFILLAMA_TVL_API, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    
    // Get Solana TVL (this is what we care about)
    const solanaTVL = Number(data?.currentChainTvls?.Solana || 0);
    
    // Get total TVL (handle potential NaN)
    let totalTVL = Number(data?.tvl);
    
    // If tvl is NaN or 0, calculate from chain TVLs
    if (!totalTVL || isNaN(totalTVL)) {
      const chainTvls = data?.currentChainTvls || {};
      totalTVL = Object.values(chainTvls).reduce((sum: number, val: any) => {
        const num = Number(val);
        return sum + (isNaN(num) ? 0 : num);
      }, 0);
    }
    
    console.log('✓ DeFiLlama TVL - Solana:', solanaTVL, 'Total:', totalTVL);
    
    return {
      total: totalTVL || 0,
      solana: solanaTVL || 0,
    };
  } catch (error) {
    console.error('DeFiLlama TVL fetch error:', error);
    return null;
  }
}

/**
 * Calculate APY from USDY price appreciation
 * 
 * IMPORTANT: For yield-bearing/accumulating tokens like USDY,
 * this is the PRIMARY and most accurate method to get APY!
 * 
 * USDY started at $1.00 and price increases as yield accrues.
 * This is different from LP pool APY (which is just trading fees).
 */
function calculateAPYFromPrice(currentPrice: number): number {
  // USDY launched around March 2023
  // Base price was $1.00
  const basePrice = 1.00;
  const launchDate = new Date('2023-03-01');
  const now = new Date();
  
  // Years since launch
  const yearsSinceLaunch = (now.getTime() - launchDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  
  if (yearsSinceLaunch <= 0) return 4.5; // Fallback to typical Treasury yield
  
  // Total appreciation
  const totalAppreciation = (currentPrice - basePrice) / basePrice;
  
  // Annualized APY (simple interest approximation)
  const annualizedAPY = (totalAppreciation / yearsSinceLaunch) * 100;
  
  // Sanity check - USDY APY should be between 3-8% (Treasury rates)
  if (annualizedAPY < 2 || annualizedAPY > 10) {
    console.warn('Calculated APY out of expected range:', annualizedAPY, '- using fallback');
    return 4.5; // Typical Treasury yield fallback
  }
  
  return Math.round(annualizedAPY * 100) / 100; // Round to 2 decimals
}

// ============================================================================
// MAIN DATA FETCHING FUNCTION
// ============================================================================

/**
 * Get USDY realtime data with multi-source fetching and fallbacks
 */
export async function getUSDYData(): Promise<RWAApiResponse<RWAData>> {
  // Check cache first (5 minute TTL)
  const cacheKey = 'usdy-data';
  const cached = getCached<RWAData>(cacheKey);
  
  if (cached) {
    return {
      success: true,
      data: cached,
      cached: true,
      cachedAt: new Date(cache.get(cacheKey)!.timestamp),
    };
  }
  
  console.log('=== Fetching USDY Realtime Data ===');
  
  // Fetch data from multiple sources in parallel
  const [
    jupiterPrice,
    jupiterSearchPrice,
    defillamaTVL,
  ] = await Promise.all([
    fetchPriceFromJupiter(),
    fetchPriceFromJupiterSearch(),
    fetchTVLFromDeFiLlama(),
  ]);
  
  // Determine best price
  // Priority: Jupiter Price API > Jupiter Search API > Fallback
  let price = jupiterPrice || jupiterSearchPrice;
  let priceSource = jupiterPrice ? 'Jupiter Price API' : jupiterSearchPrice ? 'Jupiter Search API' : 'Fallback';
  
  // Final fallback for price
  if (!price) {
    console.warn('All price sources failed, using fallback');
    price = 1.11; // Approximate current USDY price
    priceSource = 'Fallback';
  }
  
  // ==========================================================================
  // APY CALCULATION - IMPORTANT!
  // ==========================================================================
  // For USDY (yield-bearing/accumulating token), we calculate APY from price
  // appreciation. This is MORE ACCURATE than DeFiLlama Yields which shows
  // LP pool APY (trading fees), NOT the native Treasury yield.
  //
  // USDY price goes up as Treasury yield accrues. So:
  // - Started at $1.00
  // - Now ~$1.11
  // - That's ~11% total appreciation over ~2.78 years
  // - Annualized = ~4% APY (matches real Treasury rates)
  // ==========================================================================
  
  const apy = calculateAPYFromPrice(price);
  console.log('✓ Calculated APY from price:', apy, '%');
  
  // Determine TVL (prioritize Solana TVL)
  let tvl = defillamaTVL?.solana || defillamaTVL?.total || 0;
  
  // Fallback TVL based on known data
  if (tvl === 0) {
    tvl = 250_000_000; // ~$250M Solana TVL based on test
  }
  
  const rwaData: RWAData = {
    price,
    apy,
    tvl,
    lastUpdated: new Date(),
  };
  
  // Cache the data (5 minutes)
  setCache(cacheKey, rwaData, 5 * 60 * 1000);
  
  console.log('=== USDY Data Complete ===');
  console.log('Price:', '$' + price.toFixed(4), '(' + priceSource + ')');
  console.log('APY:', apy.toFixed(2) + '%', '(calculated from price appreciation)');
  console.log('TVL:', '$' + (tvl / 1_000_000).toFixed(2) + 'M', '(Solana)');
  
  return {
    success: true,
    data: rwaData,
    cached: false,
  };
}

/**
 * Get complete USDY asset with realtime data
 */
export async function getUSDYWithData(): Promise<RWAApiResponse<RWAAssetWithData>> {
  const dataResponse = await getUSDYData();
  
  if (!dataResponse.success || !dataResponse.data) {
    return {
      success: false,
      error: dataResponse.error || 'Failed to fetch USDY data',
    };
  }
  
  return {
    success: true,
    data: {
      ...USDY_ASSET,
      data: dataResponse.data,
    },
    cached: dataResponse.cached,
    cachedAt: dataResponse.cachedAt,
  };
}

/**
 * Get USDY price only (faster, separate cache)
 */
export async function getUSDYPrice(): Promise<number> {
  const cacheKey = 'usdy-price';
  const cached = getCached<number>(cacheKey);
  
  if (cached !== null) {
    return cached;
  }
  
  // Try Jupiter Price first, then Search API, then fallback
  let price = await fetchPriceFromJupiter();
  
  if (!price) {
    price = await fetchPriceFromJupiterSearch();
  }
  
  if (!price) {
    price = 1.11; // Fallback
  }
  
  // Cache price for 1 minute
  setCache(cacheKey, price, 60 * 1000);
  
  return price;
}

/**
 * Get USDY APY only
 */
export async function getUSDYAPY(): Promise<number> {
  const cacheKey = 'usdy-apy';
  const cached = getCached<number>(cacheKey);
  
  if (cached !== null) {
    return cached;
  }
  
  // Get current price and calculate APY
  const price = await getUSDYPrice();
  const apy = calculateAPYFromPrice(price);
  
  // Cache APY for 1 hour (doesn't change frequently)
  setCache(cacheKey, apy, 60 * 60 * 1000);
  
  return apy;
}

/**
 * Force refresh all USDY data (bypass cache)
 */
export async function refreshUSDYData(): Promise<RWAApiResponse<RWAData>> {
  // Clear cache
  cache.delete('usdy-data');
  cache.delete('usdy-price');
  cache.delete('usdy-apy');
  
  // Fetch fresh data
  return getUSDYData();
}

// ============================================================================
// FALLBACK VALUES (if all APIs fail)
// ============================================================================

export const USDY_FALLBACK_DATA: RWAData = {
  price: 1.11,
  apy: 4.5, // Typical Treasury yield
  tvl: 250_000_000, // ~$250M Solana
  lastUpdated: new Date(),
};

/**
 * Get USDY data with guaranteed response (uses fallback if needed)
 */
export async function getUSDYDataSafe(): Promise<RWAData> {
  try {
    const response = await getUSDYData();
    return response.data || USDY_FALLBACK_DATA;
  } catch (error) {
    console.error('USDY data fetch failed completely:', error);
    return USDY_FALLBACK_DATA;
  }
}