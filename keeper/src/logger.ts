import { config } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = LOG_LEVELS[config.logLevel as LogLevel] || LOG_LEVELS.info;

function getTimestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  debug: (message: string, ...args: any[]) => {
    if (currentLevel <= LOG_LEVELS.debug) {
      console.log(`[${getTimestamp()}] 🔍 DEBUG: ${message}`, ...args);
    }
  },
  
  info: (message: string, ...args: any[]) => {
    if (currentLevel <= LOG_LEVELS.info) {
      console.log(`[${getTimestamp()}] ℹ️  INFO: ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (currentLevel <= LOG_LEVELS.warn) {
      console.warn(`[${getTimestamp()}] ⚠️  WARN: ${message}`, ...args);
    }
  },
  
  error: (message: string, ...args: any[]) => {
    if (currentLevel <= LOG_LEVELS.error) {
      console.error(`[${getTimestamp()}] ❌ ERROR: ${message}`, ...args);
    }
  },
  
  success: (message: string, ...args: any[]) => {
    console.log(`[${getTimestamp()}] ✅ SUCCESS: ${message}`, ...args);
  },
};
