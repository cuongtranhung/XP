/**
 * Centralized logger that can be disabled in production
 */

const isDevelopment = import.meta.env.DEV;
const enableDebug = import.meta.env.VITE_ENABLE_DEBUG === 'true';

class Logger {
  private enabled: boolean;

  constructor() {
    this.enabled = isDevelopment && enableDebug;
  }

  log(...args: any[]) {
    if (this.enabled) {
      console.log(...args);
    }
  }

  warn(...args: any[]) {
    if (this.enabled) {
      console.warn(...args);
    }
  }

  error(...args: any[]) {
    // Always log errors
    console.error(...args);
  }

  debug(...args: any[]) {
    if (this.enabled) {
      console.debug(...args);
    }
  }

  info(...args: any[]) {
    if (this.enabled) {
      console.info(...args);
    }
  }

  table(data: any) {
    if (this.enabled) {
      console.table(data);
    }
  }

  time(label: string) {
    if (this.enabled) {
      console.time(label);
    }
  }

  timeEnd(label: string) {
    if (this.enabled) {
      console.timeEnd(label);
    }
  }
}

export const logger = new Logger();
export default logger;