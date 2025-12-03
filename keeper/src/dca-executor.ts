import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, getAccount, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { Transaction } from '@solana/web3.js';
import { program, getActiveDcaVaults, DcaVault } from './program';
import { jupiterService } from './jupiter';
import { config, connection, getExplorerUrl } from './config';
import { logger } from './logger';

export class DcaExecutor {
  private isRunning = false;

  async start() {
    if (this.isRunning) {
      logger.warn('DCA Executor already running');
      return;
    }

    this.isRunning = true;
    logger.info('🚀 DCA Executor started');

    await this.runLoop();
  }

  stop() {
    this.isRunning = false;
    logger.info('DCA Executor stopped');
  }

  private async runLoop() {
    while (this.isRunning) {
      try {
        await this.checkAndExecute();
      } catch (error) {
        logger.error('DCA execution loop error:', error);
      }

      await this.sleep(config.dcaCheckInterval * 1000);
    }
  }

  private async checkAndExecute() {
    logger.debug('Checking for executable DCA vaults...');

    const activeVaults = await getActiveDcaVaults();

    if (activeVaults.length === 0) {
      logger.debug('No DCA vaults ready for execution');
      return;
    }

    logger.info(`Found ${activeVaults.length} DCA vault(s) ready for execution`);

    for (const { publicKey, account } of activeVaults) {
      try {
        await this.executeDca(publicKey, account);
      } catch (error: any) {
        logger.error(`Failed to execute DCA ${publicKey.toBase58().slice(0, 8)}...: ${error.message}`);
      }
    }
  }

  private async executeDca(vaultPubkey: PublicKey, vault: DcaVault) {
    logger.info(`\n${'='.repeat(50)}`);
    logger.info(`Executing DCA for vault: ${vaultPubkey.toBase58().slice(0, 8)}...`);

    const keeper = config.keeperKeypair.publicKey;

    // Calculate execution amount with variance
    const baseAmount = vault.amountPerTrade.toNumber();
    const varianceBps = vault.varianceBps;
    const randomFactor = Math.random();
    const varianceAmount = Math.floor((baseAmount * varianceBps * randomFactor) / 10000);
    
    let swapAmount = Math.random() > 0.5 
      ? baseAmount + varianceAmount 
      : baseAmount - varianceAmount;

    // Don't exceed remaining amount
    const remaining = vault.totalAmount.sub(vault.totalSpent).toNumber();
    swapAmount = Math.min(swapAmount, remaining);

    logger.info(`Swap amount: ${swapAmount / 1e9} (base: ${baseAmount / 1e9}, variance: ±${varianceBps / 100}%)`);

    // Get keeper token accounts
    const keeperInputAta = await getAssociatedTokenAddress(vault.inputMint, keeper);
    const keeperOutputAta = await getAssociatedTokenAddress(vault.outputMint, keeper);

    // Ensure keeper has output ATA
    try {
      await getAccount(connection, keeperOutputAta);
    } catch {
      logger.info('Creating keeper output token account...');
      const tx = new Transaction().add(
        createAssociatedTokenAccountInstruction(
          keeper,
          keeperOutputAta,
          keeper,
          vault.outputMint
        )
      );
      const latestBlockhash = await connection.getLatestBlockhash();
      tx.recentBlockhash = latestBlockhash.blockhash;
      tx.feePayer = keeper;
      tx.sign(config.keeperKeypair);
      await connection.sendRawTransaction(tx.serialize());
      await this.sleep(2000);
    }

    // Step 1: Execute swap via Jupiter
    logger.info('Step 1: Swapping via Jupiter Ultra...');
    const swapResult = await jupiterService.executeSwap(
      vault.inputMint.toBase58(),
      vault.outputMint.toBase58(),
      swapAmount,
      config.keeperKeypair
    );

    if (!swapResult.success) {
      logger.error(`Jupiter swap failed: ${swapResult.error}`);
      return;
    }

    logger.success(`Jupiter swap success: ${swapResult.signature}`);
    logger.info(`   In: ${swapResult.inputAmount! / 1e9} | Out: ${swapResult.outputAmount! / 1e6}`);

    // Wait for swap confirmation
    await this.sleep(3000);

    // Step 2: Execute DCA on-chain
    logger.info('Step 2: Executing DCA on-chain...');

    try {
      const tx = await (program.methods as any)
        .executeDca({
          swapAmount: new BN(swapResult.inputAmount!),
          receivedAmount: new BN(swapResult.outputAmount!),
        })
        .accounts({
          keeper: keeper,
          dcaVault: vaultPubkey,
          vaultInputToken: vault.inputVault,
          vaultOutputToken: vault.outputVault,
          keeperInputToken: keeperInputAta,
          keeperOutputToken: keeperOutputAta,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([config.keeperKeypair])
        .rpc();

      logger.success(`DCA executed on-chain!`);
      logger.info(`   TX: ${tx}`);
      logger.info(`   Explorer: ${getExplorerUrl(tx)}`);

      // Fetch updated state
      const updatedVault = await (program.account as any).dcaVault.fetch(vaultPubkey);
      logger.info(`\n📊 Updated Vault:`);
      logger.info(`   Spent: ${updatedVault.totalSpent.toNumber() / 1e9} / ${updatedVault.totalAmount.toNumber() / 1e9}`);
      logger.info(`   Received: ${updatedVault.totalReceived.toNumber() / 1e6} USDC`);
      logger.info(`   Executions: ${updatedVault.executionCount}`);
      logger.info(`   Next: ${new Date(updatedVault.nextExecution.toNumber() * 1000).toISOString()}`);

      if (!updatedVault.isActive) {
        logger.success(`🎉 DCA Completed!`);
      }

    } catch (error: any) {
      if (error.message?.includes('DcaExecutionNotAllowed')) {
        logger.warn(`DCA not yet ready (time check failed)`);
      } else {
        throw error;
      }
    }

    logger.info(`${'='.repeat(50)}\n`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const dcaExecutor = new DcaExecutor();
