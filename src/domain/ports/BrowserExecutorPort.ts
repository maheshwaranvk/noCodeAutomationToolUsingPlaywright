import { ExecutionResult } from '../models/ExecutionResult';
import { Step } from '../models/Feature';

export interface BrowserExecutionRequest {
  step: Step;
  previousStepScreenshot?: string;
  actionType: string;
  elementSelector?: string;
  actionValue?: string;
}

export interface BrowserExecutionResponse {
  success: boolean;
  screenshot: string;
  message: string;
  error?: string;
  timestamp: Date;
}

export interface BrowserExecutorPort {
  execute(request: BrowserExecutionRequest): Promise<BrowserExecutionResponse>;
  getPageTitle(): Promise<string>;
  getPageContent(): Promise<string>;
  navigateTo(url: string): Promise<void>;
  close(): Promise<void>;
}
