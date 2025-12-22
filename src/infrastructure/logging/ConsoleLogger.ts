import { LoggerPort, LogLevel, LogEntry } from '../../domain/ports/LoggerPort';

export class ConsoleLogger implements LoggerPort {
  private logs: LogEntry[] = [];

  debug(message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: 'debug',
      message,
      timestamp: new Date(),
      context,
    };
    this.logs.push(entry);
    console.debug(`[DEBUG] ${message}`, context || '');
  }

  info(message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: 'info',
      message,
      timestamp: new Date(),
      context,
    };
    this.logs.push(entry);
    console.info(`[INFO] ${message}`, context || '');
  }

  warn(message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: 'warn',
      message,
      timestamp: new Date(),
      context,
    };
    this.logs.push(entry);
    console.warn(`[WARN] ${message}`, context || '');
  }

  error(message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level: 'error',
      message,
      timestamp: new Date(),
      context,
    };
    this.logs.push(entry);
    console.error(`[ERROR] ${message}`, context || '');
  }

  getLogHistory(): LogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}
