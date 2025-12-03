import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  getAssociatedTokenAddress,
  getAccount
} from '@solana/spl-token';
import { Program, AnchorProvider, BN, Wallet } from '@coral-xyz/anchor';
import { config, connection } from './config';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// Token addresses (Mainnet)
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// DCA Vault from previous test
const DCA_VAULT = new PublicKey('2Re6BojuXA7CaX4fYcpDyJJcbHmg964P7siFyGob8r8c');

// Jupiter Ultra Lite API
const JUPITER_ULTRA_API = 'https://lite-api.jup.ag/ultra/v1';

// Load IDL
const idlPath = path.join(__dirname, '../../target/idl/kryptos.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

// Wallet class
class TestWallet implements Wallet {
  constructor(readonly payer: Keypair) {}
  get publicKey(): PublicKey { return this.payer.publicKey; }
  async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
    if (tx instanceof Transaction) {
      tx.partialSign(this.payer);
    } else {
      tx.sign([this.payer]);
    }
    return tx;
  }
  async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
    for (const tx of txs) {
      if (tx instanceof Transaction) {
        tx.partialSign(this.payer);
      } else {
        tx.sign([this.payer]);
      }
    }
    return txs;
  }
}

// Get Jupiter Ultra Order
async function getJupiterOrder(inputMint: string, outputMint: string, amount: number, taker: string) {
  const url = `${JUPITER_ULTRA_API}/order?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&taker=${taker}`;
  console.log(`   Fetching order from Jupiter Ultra...`);
  
  const response = await axios.get(url, { timeout: 30000 });
  return response.data;
}

// Execute Jupiter Ultra Order
async function executeJupiterOrder(signedTransaction: string, requestId: string) {
  console.log(`   Executing order via Jupiter Ultra...`);
  
  const response = await axios.post(`${JUPITER_ULTRA_API}/execute`, {
    signedTransaction,
    requestId,
  }, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000,
  });
  
  return response.data;
}

async function main() {
  console.log('\n🚀 FORCE EXECUTE DCA - SOL → USDC (Jupiter Ultra Lite)\n');
  console.log('======================================================\n');

  const wallet = new TestWallet(config.keeperKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const program = new Program(idl as any, provider);

  const keeper = config.keeperKeypair.publicKey;
  console.log(`Keeper: ${keeper.toBase58()}`);

  // Check SOL balance
  const solBalance = await connection.getBalance(keeper);
  console.log(`SOL Balance: ${solBalance / 1e9} SOL`);

  // Fetch vault state
  console.log(`\n📊 Fetching DCA Vault state...`);
  const vaultState = await (program.account as any).dcaVault.fetch(DCA_VAULT);
  
  const totalAmount = vaultState.totalAmount.toNumber();
  const totalSpent = vaultState.totalSpent.toNumber();
  const remaining = totalAmount - totalSpent;
  const amountPerTrade = vaultState.amountPerTrade.toNumber();
  const nextExecution = vaultState.nextExecution.toNumber();
  const now = Math.floor(Date.now() / 1000);

  console.log(`   Total Amount: ${totalAmount / 1e9} SOL`);
  console.log(`   Total Spent: ${totalSpent / 1e9} SOL`);
  console.log(`   Remaining: ${remaining / 1e9} SOL`);
  console.log(`   Amount Per Trade: ${amountPerTrade / 1e9} SOL`);
  console.log(`   Is Active: ${vaultState.isActive}`);
  console.log(`   Next Execution: ${new Date(nextExecution * 1000).toISOString()}`);
  console.log(`   Current Time: ${new Date(now * 1000).toISOString()}`);
  console.log(`   Can Execute: ${nextExecution <= now ? '✅ YES' : '❌ NO'}`);

  // Calculate swap amount with variance
  const varianceBps = vaultState.varianceBps;
  const randomFactor = Math.random();
  const varianceAmount = Math.floor((amountPerTrade * varianceBps * randomFactor) / 10000);
  let swapAmount = Math.random() > 0.5 
    ? amountPerTrade + varianceAmount 
    : amountPerTrade - varianceAmount;
  swapAmount = Math.min(swapAmount, remaining);

  console.log(`\n💱 Swap Parameters:`);
  console.log(`   Swap Amount: ${swapAmount / 1e9} SOL`);

  // Step 1: Get Jupiter Ultra order
  console.log(`\n📈 Step 1: Getting Jupiter Ultra order...`);
  
  let order;
  try {
    order = await getJupiterOrder(
      WSOL_MINT.toBase58(),
      USDC_MINT.toBase58(),
      swapAmount,
      keeper.toBase58()
    );
    
    console.log(`   ✅ Order received`);
    console.log(`   Request ID: ${order.requestId}`);
    console.log(`   In Amount: ${order.inAmount} lamports (${parseInt(order.inAmount) / 1e9} SOL)`);
    console.log(`   Out Amount: ${order.outAmount} (${parseInt(order.outAmount) / 1e6} USDC)`);
    console.log(`   Swap Type: ${order.swapType}`);
    console.log(`   Gasless: ${order.gasless}`);
    
  } catch (error: any) {
    console.error(`   ❌ Failed to get order: ${error.message}`);
    if (error.response?.data) {
      console.error(`   Response:`, error.response.data);
    }
    process.exit(1);
  }

  const expectedUsdc = parseInt(order.outAmount);

  // Step 2: Sign the transaction
  console.log(`\n🔐 Step 2: Signing transaction...`);
  
  let signedTxBase64: string;
  try {
    const txBuffer = Buffer.from(order.transaction, 'base64');
    
    // Try VersionedTransaction first
    let transaction: VersionedTransaction;
    try {
      transaction = VersionedTransaction.deserialize(txBuffer);
      transaction.sign([config.keeperKeypair]);
      signedTxBase64 = Buffer.from(transaction.serialize()).toString('base64');
      console.log(`   ✅ Signed as VersionedTransaction`);
    } catch {
      // Fallback to legacy
      const legacyTx = Transaction.from(txBuffer);
      legacyTx.sign(config.keeperKeypair);
      signedTxBase64 = legacyTx.serialize().toString('base64');
      console.log(`   ✅ Signed as Legacy Transaction`);
    }
  } catch (error: any) {
    console.error(`   ❌ Failed to sign: ${error.message}`);
    process.exit(1);
  }

  // Step 3: Execute via Jupiter Ultra
  console.log(`\n🔄 Step 3: Executing swap via Jupiter Ultra...`);
  
  try {
    const result = await executeJupiterOrder(signedTxBase64, order.requestId);
    
    console.log(`\n✅ SWAP SUCCESSFUL!`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Signature: ${result.signature}`);
    console.log(`   Explorer: https://solscan.io/tx/${result.signature}`);
    
    // Wait for confirmation
    console.log(`\n⏳ Waiting for confirmation...`);
    await new Promise(r => setTimeout(r, 5000));
    
  } catch (error: any) {
    console.error(`   ❌ Execution failed: ${error.message}`);
    if (error.response?.data) {
      console.error(`   Response:`, JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }

  // Step 4: Check keeper USDC balance
  console.log(`\n💰 Checking balances...`);
  const keeperUsdcAta = await getAssociatedTokenAddress(USDC_MINT, keeper);
  const keeperWsolAta = await getAssociatedTokenAddress(WSOL_MINT, keeper);
  
  try {
    const usdcAccount = await getAccount(connection, keeperUsdcAta);
    console.log(`   Keeper USDC: ${Number(usdcAccount.amount) / 1e6} USDC`);
  } catch {
    console.log(`   Keeper USDC: 0 (no ATA)`);
  }

  const newSolBalance = await connection.getBalance(keeper);
  console.log(`   Keeper SOL: ${newSolBalance / 1e9} SOL`);

  // Step 5: Execute DCA on-chain (if time allows)
  if (nextExecution <= now) {
    console.log(`\n🔐 Step 5: Executing DCA on-chain...`);

    const [inputVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('input_vault'), DCA_VAULT.toBuffer()],
      config.programId
    );
    const [outputVaultPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from('output_vault'), DCA_VAULT.toBuffer()],
      config.programId
    );

    try {
      const tx = await (program.methods as any)
        .executeDca({
          swapAmount: new BN(swapAmount),
          receivedAmount: new BN(expectedUsdc),
        })
        .accounts({
          keeper: keeper,
          dcaVault: DCA_VAULT,
          vaultInputToken: inputVaultPDA,
          vaultOutputToken: outputVaultPDA,
          keeperInputToken: keeperWsolAta,
          keeperOutputToken: keeperUsdcAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([config.keeperKeypair])
        .rpc();

      console.log(`\n✅ DCA Executed on-chain!`);
      console.log(`   Transaction: ${tx}`);
      console.log(`   Explorer: https://solscan.io/tx/${tx}`);

      // Fetch updated vault state
      const updatedVault = await (program.account as any).dcaVault.fetch(DCA_VAULT);
      console.log(`\n📊 Updated Vault State:`);
      console.log(`   Total Spent: ${updatedVault.totalSpent.toNumber() / 1e9} SOL`);
      console.log(`   Total Received: ${updatedVault.totalReceived.toNumber() / 1e6} USDC`);
      console.log(`   Executions: ${updatedVault.executionCount}`);

    } catch (error: any) {
      console.error(`\n❌ DCA execution failed: ${error.message}`);
      if (error.logs) {
        error.logs.forEach((log: string) => console.error(`   ${log}`));
      }
    }
  } else {
    const waitMinutes = Math.ceil((nextExecution - now) / 60);
    console.log(`\n⏰ DCA on-chain execution time not reached yet.`);
    console.log(`   Wait ${waitMinutes} more minutes.`);
    console.log(`\n✅ But Jupiter swap was successful!`);
    console.log(`   Keeper now has USDC ready for when execution time arrives.`);
  }

  console.log(`\n🎉 Done!`);
}

main().catch(console.error);
