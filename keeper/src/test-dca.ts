import { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID, 
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  NATIVE_MINT,
  createSyncNativeInstruction,
  getAccount
} from '@solana/spl-token';
import { Program, AnchorProvider, BN, Wallet } from '@coral-xyz/anchor';
import { config, connection } from './config';
import * as fs from 'fs';
import * as path from 'path';

// Token addresses (Mainnet)
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

// Load IDL
const idlPath = path.join(__dirname, '../../target/idl/kryptos.json');
const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

// Wallet class
class TestWallet implements Wallet {
  constructor(readonly payer: Keypair) {}
  get publicKey(): PublicKey { return this.payer.publicKey; }
  async signTransaction<T>(tx: T): Promise<T> {
    (tx as any).partialSign(this.payer);
    return tx;
  }
  async signAllTransactions<T>(txs: T[]): Promise<T[]> {
    txs.forEach((tx: any) => tx.partialSign(this.payer));
    return txs;
  }
}

async function main() {
  console.log('\n🧪 KRYPTOS DCA TEST - SOL → USDC\n');
  console.log('================================\n');

  // Setup
  const wallet = new TestWallet(config.keeperKeypair);
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const program = new Program(idl as any, provider);

  const authority = config.keeperKeypair.publicKey;
  console.log(`Authority: ${authority.toBase58()}`);

  // Check SOL balance
  const solBalance = await connection.getBalance(authority);
  console.log(`SOL Balance: ${solBalance / LAMPORTS_PER_SOL} SOL`);

  if (solBalance < 0.1 * LAMPORTS_PER_SOL) {
    console.error('❌ Insufficient SOL balance. Need at least 0.1 SOL');
    process.exit(1);
  }

  // DCA Parameters
  const dcaAmountSol = 0.05; // 0.05 SOL total
  const dcaAmountLamports = dcaAmountSol * LAMPORTS_PER_SOL;
  const amountPerTrade = dcaAmountLamports / 5; // 5 trades
  
  console.log(`\n📋 DCA Parameters:`);
  console.log(`   Total Amount: ${dcaAmountSol} SOL`);
  console.log(`   Per Trade: ${amountPerTrade / LAMPORTS_PER_SOL} SOL`);
  console.log(`   Number of Trades: 5`);
  console.log(`   Input: SOL (Wrapped)`);
  console.log(`   Output: USDC`);

  // Derive PDAs
  const [dcaVaultPDA, dcaVaultBump] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('dca_vault'),
      authority.toBuffer(),
      WSOL_MINT.toBuffer(),
      USDC_MINT.toBuffer(),
    ],
    config.programId
  );

  const [inputVaultPDA, inputVaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('input_vault'), dcaVaultPDA.toBuffer()],
    config.programId
  );

  const [outputVaultPDA, outputVaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from('output_vault'), dcaVaultPDA.toBuffer()],
    config.programId
  );

  console.log(`\n📍 PDAs:`);
  console.log(`   DCA Vault: ${dcaVaultPDA.toBase58()}`);
  console.log(`   Input Vault (WSOL): ${inputVaultPDA.toBase58()}`);
  console.log(`   Output Vault (USDC): ${outputVaultPDA.toBase58()}`);

  // Get user's WSOL ATA (need to create and wrap SOL)
  const userWsolAta = await getAssociatedTokenAddress(WSOL_MINT, authority);
  console.log(`   User WSOL ATA: ${userWsolAta.toBase58()}`);

  // Check if user WSOL ATA exists
  let userWsolAtaExists = false;
  try {
    await getAccount(connection, userWsolAta);
    userWsolAtaExists = true;
    console.log(`   ✅ User WSOL ATA exists`);
  } catch {
    console.log(`   ⚠️ User WSOL ATA doesn't exist, will be created`);
  }

  // Create WSOL ATA if needed and wrap SOL
  if (!userWsolAtaExists) {
    console.log(`\n📦 Creating WSOL ATA and wrapping SOL...`);
    
    const { Transaction } = await import('@solana/web3.js');
    const tx = new Transaction();
    
    // Create ATA
    tx.add(
      createAssociatedTokenAccountInstruction(
        authority,
        userWsolAta,
        authority,
        WSOL_MINT
      )
    );
    
    // Transfer SOL to WSOL ATA (this wraps it)
    tx.add(
      SystemProgram.transfer({
        fromPubkey: authority,
        toPubkey: userWsolAta,
        lamports: dcaAmountLamports + 10000000, // Extra for rent
      })
    );
    
    // Sync native (update WSOL balance)
    tx.add(createSyncNativeInstruction(userWsolAta));
    
    const latestBlockhash = await connection.getLatestBlockhash();
    tx.recentBlockhash = latestBlockhash.blockhash;
    tx.feePayer = authority;
    tx.sign(config.keeperKeypair);
    
    const sig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction({
      signature: sig,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    });
    
    console.log(`   ✅ WSOL wrapped: ${sig}`);
  } else {
    // Check WSOL balance
    const wsolAccount = await getAccount(connection, userWsolAta);
    const wsolBalance = Number(wsolAccount.amount);
    console.log(`   Current WSOL balance: ${wsolBalance / LAMPORTS_PER_SOL} WSOL`);
    
    if (wsolBalance < dcaAmountLamports) {
      console.log(`   ⚠️ Insufficient WSOL, wrapping more SOL...`);
      
      const { Transaction } = await import('@solana/web3.js');
      const tx = new Transaction();
      
      const amountToWrap = dcaAmountLamports - wsolBalance + 10000000;
      tx.add(
        SystemProgram.transfer({
          fromPubkey: authority,
          toPubkey: userWsolAta,
          lamports: amountToWrap,
        })
      );
      tx.add(createSyncNativeInstruction(userWsolAta));
      
      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = authority;
      tx.sign(config.keeperKeypair);
      
      const sig = await connection.sendRawTransaction(tx.serialize());
      await connection.confirmTransaction({
        signature: sig,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      });
      
      console.log(`   ✅ Additional SOL wrapped: ${sig}`);
    }
  }

  // Initialize DCA
  console.log(`\n🚀 Initializing DCA Vault...`);

  try {
    const tx = await (program.methods as any)
      .initializeDca({
        totalAmount: new BN(dcaAmountLamports),
        amountPerTrade: new BN(amountPerTrade),
        varianceBps: 1000, // 10% variance
        minExecutions: 3,
        maxExecutions: 7,
        windowStartHour: 0,
        windowEndHour: 23,
      })
      .accounts({
        authority: authority,
        dcaVault: dcaVaultPDA,
        inputMint: WSOL_MINT,
        outputMint: USDC_MINT,
        userInputToken: userWsolAta,
        vaultInputToken: inputVaultPDA,
        vaultOutputToken: outputVaultPDA,
        systemProgram: SystemProgram.programId,
        tokenProgram: TOKEN_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        rent: new PublicKey('SysvarRent111111111111111111111111111111111'),
      })
      .signers([config.keeperKeypair])
      .rpc();

    console.log(`\n✅ DCA Vault Created!`);
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://solscan.io/tx/${tx}`);
    
    // Fetch vault state
    const vaultState = await (program.account as any).dcaVault.fetch(dcaVaultPDA);
    console.log(`\n📊 Vault State:`);
    console.log(`   Total Amount: ${vaultState.totalAmount.toString()} lamports`);
    console.log(`   Amount Per Trade: ${vaultState.amountPerTrade.toString()} lamports`);
    console.log(`   Is Active: ${vaultState.isActive}`);
    console.log(`   Next Execution: ${new Date(vaultState.nextExecution.toNumber() * 1000).toISOString()}`);

    console.log(`\n🎉 SUCCESS! DCA vault is now active.`);
    console.log(`   The keeper service will execute trades automatically.`);
    console.log(`   Check keeper logs for execution updates.`);

  } catch (error: any) {
    console.error(`\n❌ Error creating DCA vault:`, error.message);
    if (error.logs) {
      console.error(`\nProgram logs:`);
      error.logs.forEach((log: string) => console.error(`   ${log}`));
    }
    process.exit(1);
  }
}

main().catch(console.error);
