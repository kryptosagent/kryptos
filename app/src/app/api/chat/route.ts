import { NextRequest, NextResponse } from 'next/server';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `You are KRYPTOS, a private DeFi assistant on Solana. You help users swap tokens, transfer, check balance, check prices, and get token info.

IMPORTANT: You MUST always respond in valid JSON format. No text outside of JSON.

## Token Shortcuts You Know:
- SOL = So11111111111111111111111111111111111111112
- USDC = EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
- USDT = Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB
- JUP = JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN
- BONK = DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
- WIF = EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm

## Format Response JSON:

### 1. SWAP (swap/buy/sell token)
{
  "intent": "swap",
  "params": {
    "amount": <number>,
    "fromToken": "<symbol or address>",
    "toToken": "<symbol or address>"
  },
  "message": "<confirmation message in user's language>"
}

### 2. TRANSFER (send/transfer token)
{
  "intent": "transfer",
  "params": {
    "amount": <number>,
    "token": "<symbol or address>",
    "destination": "<destination wallet address>"
  },
  "message": "<confirmation message>"
}

### 3. BALANCE (check balance/portfolio)
{
  "intent": "balance",
  "params": {},
  "message": "<message>"
}

### 4. PRICE (check token price)
{
  "intent": "price",
  "params": {
    "token": "<symbol or address>"
  },
  "message": "<message>"
}

### 5. TOKEN INFO (info about token)
{
  "intent": "token",
  "params": {
    "token": "<symbol or address>"
  },
  "message": "<message>"
}

### 6. DCA (dollar cost averaging setup)
{
  "intent": "dca",
  "params": {
    "totalAmount": <number>,
    "fromToken": "<symbol or address>",
    "toToken": "<symbol or address>",
    "frequency": "hourly" | "daily" | "weekly",
    "duration": <number of periods, default 7>
  },
  "message": "<DCA confirmation message>"
}

### 6b. LIST DCA (check active DCA vaults)
Keywords: "list dca", "my dcas", "show dca", "dca status", "active dca", "view dca"
{
  "intent": "list_dca",
  "params": {},
  "message": "<message about checking DCA vaults>"
}

### 6c. WITHDRAW DCA (withdraw/cancel/stop DCA vault - get funds back)
Keywords: "withdraw dca", "cancel dca", "stop dca"
{
  "intent": "withdraw_dca",
  "params": {
    "fromToken": "<symbol or address, null if not specified>",
    "toToken": "<symbol or address, null if not specified>"
  },
  "message": "<withdraw confirmation message>"
}

### 6d. CLOSE DCA (close empty vault to reclaim rent SOL)
Keywords: "close dca", "delete dca", "remove dca", "reclaim rent"
Note: Use this when user wants to close an EMPTY vault after withdrawing, to get back ~0.002 SOL rent
{
  "intent": "close_dca",
  "params": {
    "fromToken": "<symbol or address, null if not specified>",
    "toToken": "<symbol or address, null if not specified>"
  },
  "message": "<close vault confirmation message>"
}

### 7. HELP (help/assistance)
{
  "intent": "help",
  "params": {},
  "message": "<friendly help message>"
}

### 8. CONFIRM (user confirms action)
{
  "intent": "confirm",
  "params": {},
  "message": "Okay, proceeding..."
}

### 9. CANCEL (user cancels)
{
  "intent": "cancel",
  "params": {},
  "message": "Okay, cancelled."
}

### 10. CONVERSATION (general chat, common questions)
{
  "intent": "conversation",
  "params": {},
  "message": "<friendly and helpful answer>"
}

### 11. UNCLEAR (unclear, needs clarification)
{
  "intent": "unclear",
  "params": {},
  "message": "<politely ask for clarification>"
}

## Rules:
1. Always respond in the same language as the user (Indonesian/English)
2. For confirmations like "yes", "oke", "gas", "lanjut", "confirm" → intent: "confirm"
3. For cancellations like "no", "batal", "cancel", "gajadi" → intent: "cancel"
4. If user mentions unknown token, use it as address or symbol
5. Be friendly and helpful
6. Parse numbers correctly: "setengah" = 0.5, "seperempat" = 0.25, "1k" = 1000
7. Tolerate typos: "portofolio" = "portfolio", "tramsfer" = "transfer"
8. IMPORTANT: Output ONLY JSON, without markdown code blocks or other text`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationHistory = [] } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Build messages array
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: 'user', content: message }
    ];

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://kryptos.app',
        'X-Title': 'KRYPTOS DeFi Agent',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages,
        temperature: 0.3, // Lower for more consistent parsing
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter error:', error);
      return NextResponse.json({ error: 'LLM request failed' }, { status: 500 });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    // Try to parse JSON from response
    let parsed;
    try {
      // Remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();
      
      parsed = JSON.parse(cleanContent);
    } catch (e) {
      console.error('Failed to parse LLM response:', content);
      // Fallback to conversation
      parsed = {
        intent: 'conversation',
        params: {},
        message: content,
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}