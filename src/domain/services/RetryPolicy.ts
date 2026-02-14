import { Scenario } from '../models/Feature';
import { ExecutionResult } from '../models/ExecutionResult';
import { LoggerPort } from '../ports';

export interface RetryPolicy {
  maxRetries: number;
  shouldRetry(result: ExecutionResult): boolean;
}

export class DefaultRetryPolicy implements RetryPolicy {
  maxRetries: number;

  constructor(maxRetries: number = 2, private logger?: LoggerPort) {
    this.maxRetries = maxRetries;
    this.logger?.info('[DefaultRetryPolicy] Initialized', { maxRetries });
  }

  shouldRetry(result: ExecutionResult): boolean {
    const shouldRetry = result.status === 'failed' && result.retryCount < this.maxRetries;
    this.logger?.debug('[DefaultRetryPolicy] Evaluating retry', {
      status: result.status,
      retryCount: result.retryCount,
      maxRetries: this.maxRetries,
      shouldRetry,
    });
    return shouldRetry;
  }
}
