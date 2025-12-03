import { PublicKey } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { program, getActiveIntentVaults, IntentVault } from './program';
import { getTokenPrice, priceToContractFormat } from './price-oracle';
import { config, getExplorerUrl } from './config';
import { logger } from './logger';

export class IntentMonitor {
  private isRunning = false;

  async start() {
    if (this.isRunning) {
      logger.warn('Intent Monitor already running');
      return;
    }

    this.isRunning = true;
    logger.info('🔍 Intent Monitor started');

    await this.runLoop();
  }

  stop() {
    this.isRunning = false;
    logger.info('Intent Monitor stopped');
  }

  private async runLoop() {
    while (this.isRunning) {
      try {
        await this.checkAndTrigger();
      } catch (error) {
        logger.error('Intent monitor loop error:', error);
      }

      // Wait for next check interval
      await this.sleep(config.intentCheckInterval * 1000);
    }
  }

  private async checkAndTrigger() {
    logger.debug('Checking for triggerable intents...');

    const activeIntents = await getActiveIntentVaults();

    if (activeIntents.length === 0) {
      logger.debug('No active intents to monitor');
      return;
    }

    logger.debug(`Monitoring ${activeIntents.length} active intent(s)`);

    for (const { publicKey, account } of activeIntents) {
      try {
        await this.checkIntent(publicKey, account);
      } catch (error) {
        logger.error(`Failed to check intent ${publicKey.toBase58()}:`, error);
      }
    }
  }

  private async checkIntent(vaultPubkey: PublicKey, vault: IntentVault) {
    // Get current price of the output token (what user wants to buy/sell)
    const currentPrice = await getTokenPrice(vault.outputMint.toBase58());
    if (currentPrice === 0) {
      logger.warn(`Could not fetch price for ${vault.outputMint.toBase58()}`);
      return;
    }

    const currentPriceContract = priceToContractFormat(currentPrice);
    const triggerPrice = vault.triggerPrice.toNumber();
    const triggerPriceMax = vault.triggerPriceMax.toNumber();

    // Check trigger condition
    let shouldTrigger = false;
    const triggerType = Object.keys(vault.triggerType)[0];

    switch (triggerType) {
      case 'priceAbove':
        shouldTrigger = currentPriceContract > triggerPrice;
        break;
      case 'priceBelow':
        shouldTrigger = currentPriceContract < triggerPrice;
        break;
      case 'priceRange':
        shouldTrigger = currentPriceContract >= triggerPrice && currentPriceContract <= triggerPriceMax;
        break;
    }

    if (!shouldTrigger) {
      logger.debug(
        `Intent ${vaultPubkey.toBase58().slice(0, 8)}... - Price: $${currentPrice.toFixed(4)}, ` +
        `Trigger: ${triggerType} $${(triggerPrice / 1_000_000).toFixed(4)}`
      );
      return;
    }

    logger.info(`🎯 Intent triggered! ${vaultPubkey.toBase58().slice(0, 8)}...`);
    logger.info(`   Current price: $${currentPrice.toFixed(4)}, Trigger: $${(triggerPrice / 1_000_000).toFixed(4)}`);

    // Execute the intent
    await this.executeIntent(vaultPubkey, vault, currentPriceContract);
  }

  private async executeIntent(
    vaultPubkey: PublicKey,
    vault: IntentVault,
    currentPrice: number
  ) {
    try {
      const tx = await program.methods
        .executeIntent({ currentPrice: new BN(currentPrice) })
        .accounts({
          keeper: config.keeperKeypair.publicKey,
          intentVault: vaultPubkey,
          vaultInputToken: vault.inputVault,
        })
        .signers([config.keeperKeypair])
        .rpc();

      logger.success(`Intent executed! TX: ${tx}`);
      logger.info(`Explorer: ${getExplorerUrl(tx)}`);

    } catch (error: any) {
      if (error.message?.includes('TriggerConditionNotMet')) {
        logger.debug('Trigger condition not met (price changed)');
      } else if (error.message?.includes('IntentExpired')) {
        logger.warn(`Intent ${vaultPubkey.toBase58().slice(0, 8)}... has expired`);
      } else {
        throw error;
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const intentMonitor = new IntentMonitor();
