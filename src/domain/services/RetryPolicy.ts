import { Scenario } from '../models/Feature';
import { ExecutionResult } from '../models/ExecutionResult';

export interface RetryPolicy {
  maxRetries: number;
  shouldRetry(result: ExecutionResult): boolean;
}

export class DefaultRetryPolicy implements RetryPolicy {
  maxRetries: number;

  constructor(maxRetries: number = 2) {
    this.maxRetries = maxRetries;
  }

  shouldRetry(result: ExecutionResult): boolean {
    return result.status === 'failed' && result.retryCount < this.maxRetries;
  }
}
