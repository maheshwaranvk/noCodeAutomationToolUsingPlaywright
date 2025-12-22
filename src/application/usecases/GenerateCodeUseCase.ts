import { ExecutionResult } from '@domain/models';
import { CodeGeneratorPort } from '@domain/ports';

export class GenerateCodeUseCase {
  constructor(private codeGenerator: CodeGeneratorPort) {}

  async execute(executionResult: ExecutionResult, featureText: string): Promise<string> {
    const response = await this.codeGenerator.generate({
      executionResult,
      featureText,
    });
    return response.code;
  }
}
