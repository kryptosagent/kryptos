import axios from 'axios';
import { VersionedTransaction, Transaction, Keypair, PublicKey } from '@solana/web3.js';
import { config, connection } from './config';
import { logger } from './logger';

const JUPITER_ULTRA_API = 'https://lite-api.jup.ag/ultra/v1';

interface SwapResult {
  success: boolean;
  signature?: string;
  inputAmount?: number;
  outputAmount?: number;
  error?: string;
}

export class JupiterService {
  
  async getOrder(
    inputMint: string,
    outputMint: string,
    amount: number,
    taker: string
  ): Promise<any> {
    const url = `${JUPITER_ULTRA_API}/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&taker=${taker}`;
    
    logger.debug(`Fetching Jupiter order: ${amount} ${inputMint.slice(0, 8)}... → ${outputMint.slice(0, 8)}...`);
    
    const response = await axios.get(url, { timeout: 30000 });
    return response.data;
  }

  async executeOrder(signedTransaction: string, requestId: string): Promise<any> {
    const response = await axios.post(`${JUPITER_ULTRA_API}/execute`, {
      signedTransaction,
      requestId,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });
    
    return response.data;
  }

  async executeSwap(
    inputMint: string,
    outputMint: string,
    amount: number,
    keypair: Keypair
  ): Promise<SwapResult> {
    try {
      logger.info(`Executing swap: ${amount / 1e9} ${inputMint.slice(0, 8)}... → ${outputMint.slice(0, 8)}...`);

      // Step 1: Get order
      const order = await this.getOrder(
        inputMint,
        outputMint,
        amount,
        keypair.publicKey.toBase58()
      );

      logger.debug(`Order received: ${order.inAmount} → ${order.outAmount}`);

      // Step 2: Sign transaction
      const txBuffer = Buffer.from(order.transaction, 'base64');
      let signedTxBase64: string;

      try {
        const transaction = VersionedTransaction.deserialize(txBuffer);
        transaction.sign([keypair]);
        signedTxBase64 = Buffer.from(transaction.serialize()).toString('base64');
      } catch {
        const legacyTx = Transaction.from(txBuffer);
        legacyTx.sign(keypair);
        signedTxBase64 = legacyTx.serialize().toString('base64');
      }

      // Step 3: Execute
      const result = await this.executeOrder(signedTxBase64, order.requestId);

      if (result.status === 'Success') {
        logger.success(`Swap confirmed: ${result.signature}`);
        return {
          success: true,
          signature: result.signature,
          inputAmount: parseInt(order.inAmount),
          outputAmount: parseInt(order.outAmount),
        };
      } else {
        return {
          success: false,
          error: `Swap failed: ${result.error || 'Unknown error'}`,
        };
      }

    } catch (error: any) {
      logger.error(`Swap execution failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

export const jupiterService = new JupiterService();
