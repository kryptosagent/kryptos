import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import axios from 'axios';

// ============================================================================
// CONSTANTS - Jupiter Ultra API (Official Documentation)
// ============================================================================

export const HELIUS_RPC = process.env.NEXT_PUBLIC_HELIUS_RPC || '';
export const PROGRAM_ID = new PublicKey('F7gyohBLEMJFkMtQDkhqtEZmpABNPE3t32aL8LTXYjy2');

// Jupiter Ultra API Base URL (lite-api for free tier)
export const JUPITER_ULTRA_API = 'https://lite-api.jup.ag/ultra/v1';
export const JUPITER_PRICE_API = 'https://lite-api.jup.ag/price/v3';
export const JUPITER_TOKEN_API = 'https://lite-api.jup.ag/tokens/v2';

// Common token shortcuts
export const TOKEN_SHORTCUTS: Record<string, string> = {
  'SOL': 'So11111111111111111111111111111111111111112',
  'WSOL': 'So11111111111111111111111111111111111111112',
  'USDC': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'USDT': 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  'JUP': 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  'BONK': 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
  'WIF': 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
  'JTO': 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL',
  'PYTH': 'HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3',
  'RAY': '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  'ORCA': 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
};

// ============================================================================
// TYPES - Based on Jupiter Ultra API Response Schema
// ============================================================================

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  isVerified?: boolean;
  // From Jupiter Search API
  usdPrice?: number;
  liquidity?: number;
  fdv?: number;
  mcap?: number;
  graduatedPool?: string;
  graduatedAt?: string;
  launchpad?: string;
  organicScore?: number;
  organicScoreLabel?: 'high' | 'medium' | 'low';
  audit?: {
    isSus?: boolean;
    mintAuthorityDisabled?: boolean;
    freezeAuthorityDisabled?: boolean;
    topHoldersPercentage?: number;
  };
}

// Jupiter Ultra Order Response (from /order endpoint)
export interface JupiterOrderResponse {
  mode: 'ultra';
  swapType: 'aggregator' | 'rfq';
  router?: string;
  requestId: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: 'ExactIn' | 'ExactOut';
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  feeBps: number;
  transaction: string | null; // base64, null if taker not provided
  // Fee payer info
  signatureFee?: number;
  prioritizationFee?: number;
  rentFee?: number;
  signatureFeePayer?: string;
  prioritizationFeePayer?: string;
  rentFeePayer?: string;
  // Error info (if transaction is empty)
  errorCode?: number; // 1, 2, or 3
  errorMessage?: string; // "Insufficient funds", "Top up SOL for gas", "Minimum for gasless"
}

// Jupiter Ultra Execute Response (from /execute endpoint)
export interface JupiterExecuteResponse {
  status: 'Success' | 'Failed';
  signature: string;
  slot: string;
  error?: string;
  code?: number;
  totalInputAmount?: string;
  totalOutputAmount?: string;
  inputAmountResult?: string;
  outputAmountResult?: string;
  swapEvents?: Array<{
    inputMint: string;
    inputAmount: string;
    outputMint: string;
    outputAmount: string;
  }>;
}

// Jupiter Shield Response (from /shield endpoint)
export interface JupiterShieldResponse {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  warnings?: string[];
}

// Jupiter Holdings Response (from /holdings endpoint)
export interface JupiterHoldingsResponse {
  nativeSol: {
    amount: string;
    usdValue?: number;
  };
  tokens: Array<{
    mint: string;
    amount: string;
    decimals: number;
    usdValue?: number;
    tokenInfo?: TokenInfo;
  }>;
}

// Command types
export type CommandType = 'swap' | 'transfer' | 'dca' | 'withdraw_dca' | 'close_dca' | 'list_dca' | 'limit_order' | 'list_limit_orders' | 'cancel_limit_order' | 'burn' | 'balance' | 'status' | 'price' | 'token' | 'help' | 'unknown';

export interface ParsedCommand {
  type: CommandType;
  params: Record<string, any>;
  raw: string;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Check if string is a valid Solana address (base58, 32-44 chars)
export function isValidAddress(str: string): boolean {
  if (str.length < 32 || str.length > 44) return false;
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
  return base58Regex.test(str);
}

// Resolve token: returns mint address from shortcut or validates address
export function resolveToken(input: string): string | null {
  const upper = input.toUpperCase();
  
  // Check shortcuts first
  if (TOKEN_SHORTCUTS[upper]) {
    return TOKEN_SHORTCUTS[upper];
  }
  
  // Check if it's a valid address
  if (isValidAddress(input)) {
    return input;
  }
  
  return null;
}

// Format address for display
export function formatAddress(address: string, chars: number = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// Helper function to find symbol from mint (safe iteration - no for...of)
function findSymbolForMint(mint: string): string | null {
  const keys = Object.keys(TOKEN_SHORTCUTS);
  for (let i = 0; i < keys.length; i++) {
    const symbol = keys[i];
    if (TOKEN_SHORTCUTS[symbol] === mint) {
      return symbol;
    }
  }
  return null;
}

// ============================================================================
// JUPITER ULTRA API - SEARCH (Token Discovery)
// Endpoint: GET /ultra/v1/search?query=...
// ============================================================================

export async function searchToken(query: string): Promise<TokenInfo[]> {
  try {
    const response = await axios.get(`${JUPITER_ULTRA_API}/search`, {
      params: { query },
      timeout: 10000,
    });
    
    if (Array.isArray(response.data)) {
      return response.data.map((token: any) => ({
        mint: token.id,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.icon,
        isVerified: token.isVerified,
        usdPrice: token.usdPrice,
        liquidity: token.liquidity,
        fdv: token.fdv,
        mcap: token.mcap,
        graduatedPool: token.graduatedPool,
        graduatedAt: token.graduatedAt,
        launchpad: token.launchpad,
        organicScore: token.organicScore,
        organicScoreLabel: token.organicScoreLabel,
        audit: token.audit,
      }));
    }
    
    return [];
  } catch (error: any) {
    console.error('Search token error:', error?.response?.data || error.message);
    return [];
  }
}

// ============================================================================
// JUPITER ULTRA API - SHIELD (Token Safety Check)
// Endpoint: GET /ultra/v1/shield?mints=...
// ============================================================================

export async function getTokenShield(mints: string[]): Promise<JupiterShieldResponse[]> {
  try {
    const response = await axios.get(`${JUPITER_ULTRA_API}/shield`, {
      params: { mints: mints.join(',') },
      timeout: 10000,
    });
    
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    console.error('Shield API error:', error?.response?.data || error.message);
    return [];
  }
}

// ============================================================================
// JUPITER ULTRA API - HOLDINGS (Wallet Balances)
// Endpoint: GET /ultra/v1/holdings/{wallet}
// ============================================================================

export async function getHoldings(walletAddress: string): Promise<JupiterHoldingsResponse | null> {
  try {
    const response = await axios.get(`${JUPITER_ULTRA_API}/holdings/${walletAddress}`, {
      timeout: 10000,
    });
    
    return response.data;
  } catch (error: any) {
    console.error('Holdings API error:', error?.response?.data || error.message);
    return null;
  }
}

// ============================================================================
// JUPITER ULTRA API - ROUTERS (Available Routers)
// Endpoint: GET /ultra/v1/routers
// ============================================================================

export async function getRouters(): Promise<Array<{ id: string; name: string; icon?: string }>> {
  try {
    const response = await axios.get(`${JUPITER_ULTRA_API}/routers`, {
      timeout: 5000,
    });
    
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: any) {
    console.error('Routers API error:', error?.response?.data || error.message);
    return [];
  }
}

// ============================================================================
// JUPITER ULTRA API - ORDER (Get Swap Quote/Transaction)
// Endpoint: GET /ultra/v1/order
// ============================================================================

export interface SwapQuoteResult {
  success: boolean;
  order?: JupiterOrderResponse;
  inAmount?: string;
  outAmount?: string;
  priceImpact?: string;
  slippageBps?: number;
  routeLabel?: string;
  errorCode?: number;
  errorMessage?: string;
}

export async function getSwapOrder(
  inputMint: string,
  outputMint: string,
  amount: number,
  inputDecimals: number,
  takerAddress?: string // If provided, will return transaction to sign
): Promise<SwapQuoteResult> {
  try {
    const amountInSmallestUnit = Math.floor(amount * Math.pow(10, inputDecimals));
    
    const params: Record<string, any> = {
      inputMint,
      outputMint,
      amount: amountInSmallestUnit,
    };
    
    // Add taker if provided (required for getting transaction)
    if (takerAddress) {
      params.taker = takerAddress;
    }
    
    const response = await axios.get<JupiterOrderResponse>(`${JUPITER_ULTRA_API}/order`, {
      params,
      timeout: 15000,
    });
    
    const order = response.data;
    
    // Check for error in response
    if (order.errorCode || order.errorMessage) {
      return {
        success: false,
        order,
        errorCode: order.errorCode,
        errorMessage: order.errorMessage,
      };
    }
    
    // Check if we got a valid quote
    if (!order.outAmount || order.outAmount === '0') {
      return {
        success: false,
        errorMessage: 'No route found for this token pair',
      };
    }
    
    return {
      success: true,
      order,
      inAmount: order.inAmount,
      outAmount: order.outAmount,
      priceImpact: order.priceImpactPct,
      slippageBps: order.slippageBps,
      routeLabel: order.routePlan?.[0]?.swapInfo?.label || order.router || 'Jupiter',
    };
  } catch (error: any) {
    const errorData = error?.response?.data;
    console.error('Order API error:', errorData || error.message);
    
    return {
      success: false,
      errorCode: errorData?.code,
      errorMessage: errorData?.message || errorData?.error || error.message,
    };
  }
}

// Legacy function for backward compatibility
export async function getSwapQuote(
  fromMint: string,
  toMint: string,
  amount: number,
  fromDecimals: number
): Promise<{
  inAmount: string;
  outAmount: string;
  priceImpact: string;
  useUltra: boolean;
  routeInfo?: string;
} | null> {
  const result = await getSwapOrder(fromMint, toMint, amount, fromDecimals);
  
  if (!result.success || !result.outAmount) {
    return null;
  }
  
  return {
    inAmount: result.inAmount!,
    outAmount: result.outAmount,
    priceImpact: result.priceImpact || '0',
    useUltra: true,
    routeInfo: result.routeLabel,
  };
}

// ============================================================================
// JUPITER ULTRA API - EXECUTE (Execute Signed Transaction)
// Endpoint: POST /ultra/v1/execute
// ============================================================================

export async function executeSwapTransaction(
  signedTransactionBase64: string,
  requestId: string
): Promise<JupiterExecuteResponse> {
  try {
    const response = await axios.post<JupiterExecuteResponse>(
      `${JUPITER_ULTRA_API}/execute`,
      {
        signedTransaction: signedTransactionBase64,
        requestId,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 60000,
      }
    );
    
    return response.data;
  } catch (error: any) {
    console.error('Execute API error:', error?.response?.data || error.message);
    return {
      status: 'Failed',
      signature: '',
      slot: '0',
      error: error?.response?.data?.message || error.message,
      code: error?.response?.data?.code,
    };
  }
}

// ============================================================================
// COMPLETE SWAP EXECUTION (Order → Sign → Execute)
// ============================================================================

export async function executeSwap(
  connection: Connection,
  wallet: any, // Wallet adapter with signTransaction
  fromMint: string,
  toMint: string,
  amount: number,
  fromDecimals: number,
  toDecimals: number
): Promise<{
  success: boolean;
  signature?: string;
  outAmount?: string;
  error?: string;
}> {
  try {
    // Step 1: Get order with transaction
    const orderResult = await getSwapOrder(
      fromMint,
      toMint,
      amount,
      fromDecimals,
      wallet.publicKey.toBase58()
    );
    
    if (!orderResult.success || !orderResult.order) {
      return {
        success: false,
        error: orderResult.errorMessage || 'Failed to get swap order',
      };
    }
    
    const order = orderResult.order;
    
    // Check if transaction is available
    if (!order.transaction) {
      return {
        success: false,
        error: order.errorMessage || 'No transaction returned. Check wallet balance.',
      };
    }
    
    // Step 2: Deserialize transaction
    const { VersionedTransaction } = await import('@solana/web3.js');
    const txBuffer = Buffer.from(order.transaction, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuffer);
    
    // Step 2.5: Simulate transaction BEFORE signing (Phantom recommended)
    // This prevents wallet warnings from failed simulations
    const simulation = await connection.simulateTransaction(transaction, {
      sigVerify: false, // Don't verify signatures during simulation
      replaceRecentBlockhash: true, // Use fresh blockhash
    });
    
    if (simulation.value.err) {
      console.error('Simulation failed:', simulation.value.err);
      const errStr = JSON.stringify(simulation.value.err);
      
      // User-friendly error messages
      if (errStr.includes('6001') || errStr.toLowerCase().includes('slippage')) {
        return {
          success: false,
          error: 'Price moved too fast. Please try again.',
        };
      }
      if (errStr.includes('InsufficientFunds') || errStr.includes('0x1')) {
        return {
          success: false,
          error: 'Insufficient balance for this swap.',
        };
      }
      return {
        success: false,
        error: `Transaction would fail: ${errStr}`,
      };
    }
    
    console.log('Simulation passed, requesting signature...');
    
    // Step 3: Sign transaction (only if simulation passed)
    const signedTx = await wallet.signTransaction(transaction);
    const signedTxBase64 = Buffer.from(signedTx.serialize()).toString('base64');
    
    // Step 4: Execute via Jupiter
    const executeResult = await executeSwapTransaction(signedTxBase64, order.requestId);
    
    if (executeResult.status === 'Success') {
      const outAmountFormatted = (
        parseInt(executeResult.outputAmountResult || order.outAmount) / 
        Math.pow(10, toDecimals)
      ).toFixed(Math.min(toDecimals, 6));
      
      return {
        success: true,
        signature: executeResult.signature,
        outAmount: outAmountFormatted,
      };
    } else {
      return {
        success: false,
        signature: executeResult.signature, // May have signature even on failure
        error: executeResult.error || 'Swap execution failed',
      };
    }
  } catch (error: any) {
    console.error('Swap error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// TOKEN INFO - Multiple Sources
// ============================================================================

export async function getTokenInfo(mint: string): Promise<TokenInfo | null> {
  try {
    // 1. Check shortcuts first (using safe iteration)
    const shortcutSymbol = findSymbolForMint(mint);
    if (shortcutSymbol) {
      const decimals = mint === 'So11111111111111111111111111111111111111112' ? 9 : 6;
      return {
        mint,
        symbol: shortcutSymbol,
        name: shortcutSymbol,
        decimals,
      };
    }

    // 2. Try Jupiter Search API (most comprehensive)
    const searchResults = await searchToken(mint);
    if (searchResults.length > 0) {
      return searchResults[0];
    }

    // 3. Try Jupiter Token API V2
    try {
      const response = await axios.get(`${JUPITER_TOKEN_API}/search`, {
        params: { query: mint },
        timeout: 5000,
      });
      
      if (Array.isArray(response.data) && response.data.length > 0) {
        const token = response.data[0];
        return {
          mint: token.id || mint,
          symbol: token.symbol || 'UNKNOWN',
          name: token.name || 'Unknown Token',
          decimals: token.decimals ?? 9,
          logoURI: token.icon,
          isVerified: token.isVerified,
          usdPrice: token.usdPrice,
        };
      }
    } catch {
      // Continue to fallback
    }

    // 4. Try on-chain data
    try {
      const connection = new Connection(HELIUS_RPC);
      const mintPubkey = new PublicKey(mint);
      const mintInfo = await connection.getParsedAccountInfo(mintPubkey);
      
      if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
        const parsed = mintInfo.value.data.parsed;
        if (parsed.type === 'mint') {
          return {
            mint,
            symbol: formatAddress(mint, 4).toUpperCase(),
            name: `Token ${formatAddress(mint, 4)}`,
            decimals: parsed.info.decimals,
          };
        }
      }
    } catch {
      // Final fallback
    }

    // 5. Return minimal info
    return {
      mint,
      symbol: formatAddress(mint, 4).toUpperCase(),
      name: 'Unknown Token',
      decimals: 9,
    };
  } catch (error) {
    console.error('getTokenInfo error:', error);
    return null;
  }
}

// ============================================================================
// PRICE API
// Endpoint: GET /price/v3?ids=...
// ============================================================================

export async function getTokenPrice(mint: string): Promise<number | null> {
  try {
    const response = await axios.get(`${JUPITER_PRICE_API}`, {
      params: { ids: mint },
      timeout: 5000,
    });
    
    return response.data?.data?.[mint]?.price || null;
  } catch (error) {
    console.error('Price API error:', error);
    return null;
  }
}

export async function getMultipleTokenPrices(mints: string[]): Promise<Record<string, number>> {
  try {
    const response = await axios.get(`${JUPITER_PRICE_API}`, {
      params: { ids: mints.join(',') },
      timeout: 10000,
    });
    
    const prices: Record<string, number> = {};
    const data = response.data?.data || {};
    
    // Safe iteration using Object.keys
    const mintKeys = Object.keys(data);
    for (let i = 0; i < mintKeys.length; i++) {
      const mint = mintKeys[i];
      if (data[mint]?.price) {
        prices[mint] = data[mint].price;
      }
    }
    
    return prices;
  } catch (error) {
    console.error('Multiple prices error:', error);
    return {};
  }
}

// ============================================================================
// WALLET BALANCES (Using Jupiter Holdings or on-chain) - FIXED VERSION
// ============================================================================

export async function getBalances(
  connection: Connection,
  publicKey: PublicKey
): Promise<{
  sol: number;
  tokens: Array<{
    mint: string;
    symbol: string;
    balance: number;
    decimals: number;
    usdValue?: number;
  }>;
}> {
  const result: {
    sol: number;
    tokens: Array<{
      mint: string;
      symbol: string;
      balance: number;
      decimals: number;
      usdValue?: number;
    }>;
  } = {
    sol: 0,
    tokens: [],
  };

  try {
    console.log('=== FETCHING BALANCES ===');
    console.log('Wallet:', publicKey.toBase58());

    // Store Jupiter Holdings data for USD values
    const jupiterUsdValues: Record<string, number> = {};
    
    // Try Jupiter Holdings API for USD values
    try {
      const holdings = await getHoldings(publicKey.toBase58());
      
      if (holdings && holdings.tokens && Array.isArray(holdings.tokens)) {
        console.log('Jupiter Holdings API: got USD values');
        
        for (let i = 0; i < holdings.tokens.length; i++) {
          const token = holdings.tokens[i];
          if (token && token.mint && token.usdValue) {
            jupiterUsdValues[token.mint] = token.usdValue;
          }
        }
        
        // Get SOL balance from Jupiter if available
        if (holdings.nativeSol) {
          result.sol = parseInt(holdings.nativeSol.amount) / LAMPORTS_PER_SOL;
        }
      }
    } catch (jupiterErr) {
      console.log('Jupiter Holdings API failed, continuing with on-chain only');
    }
    
    // Always fetch on-chain data (includes ALL tokens like pump.fun)
    console.log('Fetching on-chain token accounts...');
    
    // Get SOL balance if not already set
    if (result.sol === 0) {
      const solBalance = await connection.getBalance(publicKey);
      result.sol = solBalance / LAMPORTS_PER_SOL;
    }
    console.log('SOL Balance:', result.sol);

    // Import Token-2022 program ID
    const { TOKEN_2022_PROGRAM_ID } = await import('@solana/spl-token');

    // Fetch from BOTH Token Program and Token-2022 Program
    const [standardAccounts, token2022Accounts] = await Promise.all([
      connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_PROGRAM_ID,
      }),
      connection.getParsedTokenAccountsByOwner(publicKey, {
        programId: TOKEN_2022_PROGRAM_ID,
      }),
    ]);

    console.log('Standard Token accounts found:', standardAccounts.value?.length || 0);
    console.log('Token-2022 accounts found:', token2022Accounts.value?.length || 0);

    // Combine both arrays
    const allAccounts = [
      ...(standardAccounts.value || []),
      ...(token2022Accounts.value || []),
    ];

    console.log('Total token accounts:', allAccounts.length);

    // Process ALL token accounts from on-chain
    if (allAccounts.length > 0) {
      for (let i = 0; i < allAccounts.length; i++) {
        try {
          const accountData = allAccounts[i];
          if (!accountData || !accountData.account || !accountData.account.data) continue;
          
          const data = accountData.account.data;
          if (typeof data !== 'object' || !('parsed' in data)) continue;
          
          const parsed = data.parsed;
          if (!parsed || typeof parsed !== 'object' || !('info' in parsed)) continue;
          
          const info = parsed.info;
          if (!info || typeof info !== 'object') continue;
          
          const mint = info.mint;
          const tokenAmount = info.tokenAmount;
          if (!mint || !tokenAmount) continue;
          
          const balance = Number(tokenAmount.uiAmount) || 0;
          const decimals = Number(tokenAmount.decimals) || 0;

          if (balance > 0) {
            const mintStr = String(mint);
            const knownSymbol = findSymbolForMint(mintStr);
            
            result.tokens.push({
              mint: mintStr,
              symbol: knownSymbol || mintStr, // Temporarily use mint, will resolve below
              balance,
              decimals,
              usdValue: jupiterUsdValues[mintStr],
            });
          }
        } catch (tokenErr) {
          console.error('Error processing token account:', tokenErr);
        }
      }
    }

    // Resolve symbols for unknown tokens via Jupiter API
    const unknownMints = result.tokens
      .filter(t => !findSymbolForMint(t.mint))
      .map(t => t.mint);
    
    if (unknownMints.length > 0) {
      console.log('Resolving symbols for', unknownMints.length, 'unknown tokens...');
      
      // Fetch token info for unknown mints (batch via Promise.all, limit to 10)
      const mintsToFetch = unknownMints.slice(0, 10);
      const tokenInfoPromises = mintsToFetch.map(mint => getTokenInfo(mint));
      const tokenInfoResults = await Promise.all(tokenInfoPromises);
      
      // Create a map of mint -> symbol
      const symbolMap: Record<string, string> = {};
      for (let i = 0; i < mintsToFetch.length; i++) {
        const info = tokenInfoResults[i];
        if (info && info.symbol) {
          symbolMap[mintsToFetch[i]] = info.symbol;
        }
      }
      
      // Update token symbols in result
      for (let i = 0; i < result.tokens.length; i++) {
        const token = result.tokens[i];
        if (symbolMap[token.mint]) {
          token.symbol = symbolMap[token.mint];
          console.log(`Resolved: ${token.mint} -> ${token.symbol}`);
        } else if (!findSymbolForMint(token.mint)) {
          // Still unknown, use shortened address
          token.symbol = formatAddress(token.mint, 4);
        }
      }
    }

    // Sort tokens by USD value (highest first), then by balance
    result.tokens.sort((a, b) => {
      if (a.usdValue && b.usdValue) return b.usdValue - a.usdValue;
      if (a.usdValue) return -1;
      if (b.usdValue) return 1;
      return b.balance - a.balance;
    });

    console.log('=== BALANCES COMPLETE ===');
    console.log('Total tokens found:', result.tokens.length);
    return result;
  } catch (error) {
    console.error('getBalances error:', error);
    return result;
  }
}

// ============================================================================
// TRANSFER EXECUTION
// ============================================================================

export async function executeTransfer(
  connection: Connection,
  wallet: any,
  tokenMint: string | null,
  amount: number,
  destination: string,
  decimals: number = 9
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const destPubkey = new PublicKey(destination);
    const tx = new Transaction();

    const isNativeSol = !tokenMint || tokenMint === 'So11111111111111111111111111111111111111112';

    if (isNativeSol) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: destPubkey,
          lamports: Math.floor(amount * LAMPORTS_PER_SOL),
        })
      );
    } else {
      const { 
        createTransferInstruction, 
        getAccount,
        TOKEN_PROGRAM_ID,
        TOKEN_2022_PROGRAM_ID,
        getAssociatedTokenAddress: getAta,
        createAssociatedTokenAccountInstruction: createAtaIx,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      } = await import('@solana/spl-token');
      
      const mintPubkey = new PublicKey(tokenMint);
      
      // Detect which token program this mint uses
      let tokenProgramId = TOKEN_PROGRAM_ID;
      let fromAta: PublicKey | null = null;
      
      // Try standard Token Program first
      try {
        const ata = await getAta(mintPubkey, wallet.publicKey, false, TOKEN_PROGRAM_ID);
        await getAccount(connection, ata, undefined, TOKEN_PROGRAM_ID);
        fromAta = ata;
        tokenProgramId = TOKEN_PROGRAM_ID;
        console.log('Transfer: Using Standard Token Program');
      } catch (e) {
        // Try Token-2022 Program
        try {
          const ata2022 = await getAta(mintPubkey, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
          await getAccount(connection, ata2022, undefined, TOKEN_2022_PROGRAM_ID);
          fromAta = ata2022;
          tokenProgramId = TOKEN_2022_PROGRAM_ID;
          console.log('Transfer: Using Token-2022 Program');
        } catch (e2) {
          return { success: false, error: 'Token account not found in your wallet.' };
        }
      }
      
      // Get destination ATA with correct program
      const toAta = await getAta(mintPubkey, destPubkey, false, tokenProgramId);
      
      // Check if destination ATA exists
      const toAtaInfo = await connection.getAccountInfo(toAta);
      if (!toAtaInfo) {
        tx.add(
          createAtaIx(
            wallet.publicKey,    // payer
            toAta,               // ata
            destPubkey,          // owner
            mintPubkey,          // mint
            tokenProgramId,      // token program
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      tx.add(
        createTransferInstruction(
          fromAta,
          toAta,
          wallet.publicKey,
          BigInt(Math.floor(amount * Math.pow(10, decimals))),
          [],
          tokenProgramId  // Pass correct program
        )
      );
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;

    const signedTx = await wallet.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signedTx.serialize());
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    return { success: true, signature };
  } catch (error: any) {
    console.error('Transfer error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// BURN TOKEN EXECUTION
// ============================================================================

export async function executeBurn(
  connection: Connection,
  wallet: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> },
  tokenMint: string,
  amount: number,
  decimals: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const { 
      getAccount, 
      createBurnInstruction, 
      TOKEN_PROGRAM_ID, 
      TOKEN_2022_PROGRAM_ID,
      getAssociatedTokenAddress 
    } = await import('@solana/spl-token');
    
    const mintPubkey = new PublicKey(tokenMint);
    
    // Detect which token program this mint uses
    let tokenProgramId = TOKEN_PROGRAM_ID;
    let userAta: PublicKey | null = null;
    
    // Try standard Token Program first
    try {
      const ata = await getAssociatedTokenAddress(mintPubkey, wallet.publicKey, false, TOKEN_PROGRAM_ID);
      await getAccount(connection, ata, undefined, TOKEN_PROGRAM_ID);
      userAta = ata;
      tokenProgramId = TOKEN_PROGRAM_ID;
      console.log('Using Standard Token Program');
    } catch (e) {
      // Try Token-2022 Program
      try {
        const ata2022 = await getAssociatedTokenAddress(mintPubkey, wallet.publicKey, false, TOKEN_2022_PROGRAM_ID);
        await getAccount(connection, ata2022, undefined, TOKEN_2022_PROGRAM_ID);
        userAta = ata2022;
        tokenProgramId = TOKEN_2022_PROGRAM_ID;
        console.log('Using Token-2022 Program');
      } catch (e2) {
        // Last resort: scan for the token account
        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet.publicKey, {
          mint: mintPubkey,
        });
        
        if (tokenAccounts.value.length === 0) {
          return { success: false, error: 'You don\'t have this token in your wallet.' };
        }
        
        userAta = tokenAccounts.value[0].pubkey;
        // Determine program from account owner
        const accountInfo = await connection.getAccountInfo(userAta);
        if (accountInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)) {
          tokenProgramId = TOKEN_2022_PROGRAM_ID;
          console.log('Using Token-2022 Program (from scan)');
        } else {
          tokenProgramId = TOKEN_PROGRAM_ID;
          console.log('Using Standard Token Program (from scan)');
        }
      }
    }
    
    if (!userAta) {
      return { success: false, error: 'Could not find token account.' };
    }
    
    console.log('Token Account:', userAta.toBase58());
    console.log('Token Program:', tokenProgramId.toBase58());
    
    // Calculate amount in smallest units
    const burnAmountRaw = BigInt(Math.floor(amount * Math.pow(10, decimals)));
    
    // Create burn instruction with correct program
    const burnIx = createBurnInstruction(
      userAta,           // token account
      mintPubkey,        // mint
      wallet.publicKey,  // owner
      burnAmountRaw,     // amount
      [],                // multiSigners
      tokenProgramId     // programId - THIS IS THE KEY!
    );
    
    // Build transaction
    const transaction = new Transaction().add(burnIx);
    transaction.feePayer = wallet.publicKey;
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    
    // Simulate first (Phantom-friendly)
    try {
      const { VersionedTransaction, TransactionMessage } = await import('@solana/web3.js');
      
      const messageV0 = new TransactionMessage({
        payerKey: wallet.publicKey,
        recentBlockhash: blockhash,
        instructions: transaction.instructions,
      }).compileToV0Message();
      
      const versionedTx = new VersionedTransaction(messageV0);
      
      const simulation = await connection.simulateTransaction(versionedTx, {
        sigVerify: false,
        replaceRecentBlockhash: true,
      });
      
      if (simulation.value.err) {
        console.error('Simulation error:', simulation.value.err);
        return { 
          success: false, 
          error: `Simulation failed: ${JSON.stringify(simulation.value.err)}` 
        };
      }
      
      console.log('Simulation passed!');
    } catch (simError: any) {
      console.error('Simulation error:', simError);
      return { success: false, error: `Simulation failed: ${simError.message}` };
    }
    
    // Sign and send
    const signedTx = await wallet.signTransaction(transaction);
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: 'confirmed',
    });
    
    // Confirm
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
    
    console.log('Burn successful:', signature);
    return { success: true, signature };
    
  } catch (error: any) {
    console.error('Burn error:', error);
    return { success: false, error: error.message || 'Unknown error during burn' };
  }
}

// ============================================================================
// COMMAND PARSING
// ============================================================================

export function parseCommand(input: string): ParsedCommand {
  const lower = input.toLowerCase().trim();
  
  // SWAP with contract address support
  const swapMatch = input.match(/(?:swap|exchange|convert|buy|sell)\s+([\d.]+)\s+([a-zA-Z0-9]+)\s+(?:to|for|→|->)\s+([a-zA-Z0-9]+)/i);
  if (swapMatch) {
    const [, amount, fromTokenRaw, toTokenRaw] = swapMatch;
    const fromToken = resolveToken(fromTokenRaw);
    const toToken = resolveToken(toTokenRaw);
    
    return {
      type: 'swap',
      params: {
        amount: parseFloat(amount),
        fromTokenRaw,
        toTokenRaw,
        fromMint: fromToken,
        toMint: toToken,
      },
      raw: input,
    };
  }

  // TRANSFER
  const transferMatch = input.match(/(?:transfer|send)\s+([\d.]+)\s+([a-zA-Z0-9]+)\s+(?:to)\s+([a-zA-Z0-9]{32,44})/i);
  if (transferMatch) {
    const [, amount, tokenRaw, destination] = transferMatch;
    const tokenMint = resolveToken(tokenRaw);
    
    return {
      type: 'transfer',
      params: {
        amount: parseFloat(amount),
        tokenRaw,
        tokenMint,
        destination,
      },
      raw: input,
    };
  }

  // DCA
  const dcaMatch = lower.match(/(?:setup\s+)?dca[:\s]+([\d.]+)\s*([a-zA-Z0-9]+)\s+(?:to|into|→)\s*([a-zA-Z0-9]+)(?:.*?(daily|weekly|monthly))?(?:.*?(\d+)\s*(?:times|weeks|days))?/i);
  if (dcaMatch) {
    const fromMint = resolveToken(dcaMatch[2]);
    const toMint = resolveToken(dcaMatch[3]);
    
    return {
      type: 'dca',
      params: {
        totalAmount: parseFloat(dcaMatch[1]),
        fromTokenRaw: dcaMatch[2],
        toTokenRaw: dcaMatch[3],
        fromMint,
        toMint,
        frequency: dcaMatch[4] || 'daily',
        duration: parseInt(dcaMatch[5]) || 7,
      },
      raw: input,
    };
  }

  // WITHDRAW DCA - Cancel/withdraw from DCA vault
  // Examples: "withdraw dca", "cancel dca usdc to sol", "stop my dca"
  const withdrawDcaMatch = input.match(
    /(?:withdraw|cancel|stop|close)\s+(?:my\s+)?dca(?:\s+(?:vault|order|position))?(?:\s+([a-zA-Z0-9]+)\s+(?:to|→|->)\s+([a-zA-Z0-9]+))?/i
  );
  if (withdrawDcaMatch) {
    const fromTokenRaw = withdrawDcaMatch[1] || null;
    const toTokenRaw = withdrawDcaMatch[2] || null;
    
    return {
      type: 'withdraw_dca',
      params: {
        fromTokenRaw,
        toTokenRaw,
        fromMint: fromTokenRaw ? resolveToken(fromTokenRaw) : null,
        toMint: toTokenRaw ? resolveToken(toTokenRaw) : null,
      },
      raw: input,
    };
  }

  // LIST DCA - Show all user's DCA vaults
  // Examples: "my dcas", "list dcas", "show dca vaults", "dca status"
  const listDcaMatch = lower.match(/(?:list|show|my|view)\s+(?:all\s+)?dcas?(?:\s+vaults?)?|dca\s+(?:status|list|vaults?)/);
  if (listDcaMatch) {
    return {
      type: 'list_dca',
      params: {},
      raw: input,
    };
  }

  // CLOSE DCA - Close empty vault to reclaim rent
  // Examples: "close dca usdc to sol", "close dca vault", "reclaim dca rent"
  const closeDcaMatch = input.match(
    /(?:close|delete|remove)\s+(?:my\s+)?dca(?:\s+(?:vault|account))?(?:\s+([a-zA-Z0-9]+)\s+(?:to|→|->)\s+([a-zA-Z0-9]+))?|reclaim\s+(?:dca\s+)?rent/i
  );
  if (closeDcaMatch) {
    const fromTokenRaw = closeDcaMatch[1] || null;
    const toTokenRaw = closeDcaMatch[2] || null;
    
    return {
      type: 'close_dca',
      params: {
        fromTokenRaw,
        toTokenRaw,
        fromMint: fromTokenRaw ? resolveToken(fromTokenRaw) : null,
        toMint: toTokenRaw ? resolveToken(toTokenRaw) : null,
      },
      raw: input,
    };
  }

  // BURN - Support: "burn 100 KRYPTOS", "burn 50% USDC", "burn all KRYPTOS"
  const burnMatch = input.match(/burn\s+([\d.]+%?|all)\s+([a-zA-Z0-9]+)/i);
  if (burnMatch) {
    const [, amountStr, tokenRaw] = burnMatch;
    const tokenMint = resolveToken(tokenRaw);
    
    return {
      type: 'burn',
      params: {
        amountStr,  // "100", "50%", or "all"
        tokenRaw,
        tokenMint,
        isPercentage: amountStr.includes('%'),
        isAll: amountStr.toLowerCase() === 'all',
      },
      raw: input,
    };
  }

  // TOKEN INFO
  const tokenMatch = input.match(/(?:token|info|what is|lookup)\s+([a-zA-Z0-9]{32,44})/i);
  if (tokenMatch) {
    return {
      type: 'token',
      params: { mint: tokenMatch[1] },
      raw: input,
    };
  }

  // BALANCE
  if (lower.match(/(?:my\s+)?balance|portfolio|holdings|how much/)) {
    return { type: 'balance', params: {}, raw: input };
  }

  // STATUS
  if (lower.match(/status|active|(?:my\s+)?dcas?|strategies|monitor/)) {
    return { type: 'status', params: {}, raw: input };
  }

  // PRICE
  const priceMatch = input.match(/(?:price\s+(?:of\s+)?|how much is\s+|what'?s?\s+)([a-zA-Z0-9]+)(?:\s+price)?/i);
  if (priceMatch) {
    const tokenMint = resolveToken(priceMatch[1]);
    return {
      type: 'price',
      params: { 
        tokenRaw: priceMatch[1],
        mint: tokenMint,
      },
      raw: input,
    };
  }

  // HELP
  if (lower.match(/help|commands|what can you|how to/)) {
    return { type: 'help', params: {}, raw: input };
  }

  return { type: 'unknown', params: {}, raw: input };
}

// ============================================================================
// HELP TEXT
// ============================================================================

export function getSupportedTokensHelp(): string {
  const shortcuts: string[] = [];
  const keys = Object.keys(TOKEN_SHORTCUTS);
  for (let i = 0; i < keys.length; i++) {
    const symbol = keys[i];
    const mint = TOKEN_SHORTCUTS[symbol];
    shortcuts.push(`• **${symbol}**: \`${formatAddress(mint, 6)}\``);
  }
  
  return `**Token Shortcuts:**
${shortcuts.join('\n')}

**Or use any contract address directly!**
Example: \`Swap 1 SOL to EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v\``;
}

export function getHelpMessage(): string {
  return `🔒 **KRYPTOS Commands**

**Burn Tokens:** 🔥
\`Burn 100 BONK\` - Burn specific amount
\`Burn 50% USDC\` - Burn percentage of balance
\`Burn all WIF\` - Burn entire balance

**Swap Tokens:**
\`Swap 1 SOL to USDC\`
\`Swap 0.5 SOL to EPjFWdd5...\` (contract address)

**DCA (Dollar Cost Average):**
\`DCA 10 USDC to SOL daily for 7 days\`
\`Withdraw DCA USDC to SOL\` - Cancel & withdraw funds
\`Close DCA USDC to SOL\` - Close empty vault, reclaim rent
\`My DCAs\` - List active DCA vaults

**Limit Orders:**
\`Buy SOL when price drops to $200\` - Buy at target price
\`Sell 1 SOL when price hits $250\` - Sell at target price
\`My limit orders\` - List active limit orders
\`Cancel limit order\` - Shows list, reply with number (1, 2, 3...)

**Check Balance:**
\`Balance\` or \`My portfolio\`

**Get Price:**
\`Price of SOL\`
\`Price of JUPyiwrYJFskU...\`

**Token Info:**
\`Token EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v\`

**Transfer:**
\`Transfer 0.5 SOL to [wallet address]\`

All swaps are MEV-protected.
DCA & Limit Orders can be cancelled anytime with full fund recovery.`;
}