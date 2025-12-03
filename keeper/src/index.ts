import { config, connection } from './config';
import { logger } from './logger';
import { dcaExecutor } from './dca-executor';
import { intentMonitor } from './intent-monitor';

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   🔐 KRYPTOS KEEPER SERVICE                               ║
║   Privacy-focused DCA & Intent Execution                  ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Check connection
  try {
    const slot = await connection.getSlot();
    logger.success(`Connected to Solana (slot: ${slot})`);
  } catch (error) {
    logger.error('Failed to connect to Solana RPC');
    process.exit(1);
  }

  // Check keeper balance
  const balance = await connection.getBalance(config.keeperKeypair.publicKey);
  const solBalance = balance / 1e9;
  logger.info(`Keeper balance: ${solBalance.toFixed(4)} SOL`);

  if (solBalance < 0.1) {
    logger.warn('Low keeper balance! Consider adding more SOL for transaction fees.');
  }

  // Start services
  logger.info('Starting keeper services...');
  
  // Start DCA Executor
  dcaExecutor.start();
  
  // Start Intent Monitor
  intentMonitor.start();

  logger.success('All services started! Keeper is now running.');
  logger.info(`DCA check interval: ${config.dcaCheckInterval}s`);
  logger.info(`Intent check interval: ${config.intentCheckInterval}s`);
  logger.info('Press Ctrl+C to stop.\n');

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('\nShutting down...');
    dcaExecutor.stop();
    intentMonitor.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('\nShutting down...');
    dcaExecutor.stop();
    intentMonitor.stop();
    process.exit(0);
  });

  // Keep process running
  await new Promise(() => {});
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
