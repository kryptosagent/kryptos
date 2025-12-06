export interface LLMResponse {
  intent: 'swap' | 'transfer' | 'dca' | 'withdraw_dca' | 'close_dca' | 'list_dca' | 'limit_order' | 'list_limit_orders' | 'cancel_limit_order' | 'burn' | 'balance' | 'price' | 'token' | 'help' | 'cancel' | 'confirm' | 'conversation' | 'unclear';
  params: Record<string, any>;
  message: string;
}

export async function parseWithLLM(
  message: string,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<LLMResponse> {
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        conversationHistory,
      }),
    });

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();
    return data as LLMResponse;
  } catch (error) {
    console.error('LLM parse error:', error);
    // Fallback response
    return {
      intent: 'conversation',
      params: {},
      message: 'Sorry, an error occurred. Please try again.',
    };
  }
}