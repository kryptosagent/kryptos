import axios from 'axios';
import { config } from './config';
import { logger } from './logger';

// Token addresses (mainnet - for price fetching)
export const TOKENS: Record<string, string> = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
};

// Price cache to avoid too many API calls
const priceCache: Map<string, { price: number; timestamp: number }> = new Map();
const CACHE_TTL = 10000; // 10 seconds

export async function getTokenPrice(tokenMint: string): Promise<number> {
  try {
    // Check cache
    const cached = priceCache.get(tokenMint);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.price;
    }

    // Fetch from Jupiter Price API
    const response = await axios.get(`${config.jupiterApiUrl}/price`, {
      params: {
        ids: tokenMint,
      },
    });

    const price = response.data?.data?.[tokenMint]?.price || 0;
    
    // Cache it
    priceCache.set(tokenMint, { price, timestamp: Date.now() });
    
    logger.debug(`Price for ${tokenMint.slice(0, 8)}...: $${price}`);
    return price;
  } catch (error) {
    logger.error(`Failed to fetch price for ${tokenMint}:`, error);
    return 0;
  }
}

export async function getTokenPrices(tokenMints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  
  try {
    const ids = tokenMints.join(',');
    const response = await axios.get(`${config.jupiterApiUrl}/price`, {
      params: { ids },
    });

    for (const mint of tokenMints) {
      const price = response.data?.data?.[mint]?.price || 0;
      prices.set(mint, price);
      priceCache.set(mint, { price, timestamp: Date.now() });
    }
  } catch (error) {
    logger.error('Failed to fetch token prices:', error);
  }

  return prices;
}

// Convert price to 6 decimal format used in contract
export function priceToContractFormat(price: number): number {
  return Math.floor(price * 1_000_000);
}

// Convert from contract format to regular price
export function priceFromContractFormat(contractPrice: number): number {
  return contractPrice / 1_000_000;
}
