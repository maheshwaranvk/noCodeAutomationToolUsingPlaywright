import { ExecutionResult } from '../models/ExecutionResult';

export interface CodeGenerationRequest {
  executionResult: ExecutionResult;
  featureText: string;
  targetUrl?: string; // The target URL used during execution
}

export interface CodeGenerationResponse {
  code: string;
  language: 'typescript' | 'javascript';
  filename: string;
}

export interface CodeGeneratorPort {
  generate(request: CodeGenerationRequest): Promise<CodeGenerationResponse>;
}
