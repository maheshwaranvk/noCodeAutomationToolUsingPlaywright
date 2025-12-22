import { ExecuteFeatureUseCase } from '@application/usecases';
import { ExecuteFeatureRequest } from '@application/dto';
import { BrowserExecutorPort, AIInterpreterPort, CodeGeneratorPort, ArtifactStorePort, LoggerPort } from '@domain/ports';

export class CLIAdapter {
  constructor(
    private browserExecutor: BrowserExecutorPort,
    private aiInterpreter: AIInterpreterPort,
    private codeGenerator: CodeGeneratorPort,
    private artifactStore: ArtifactStorePort,
    private logger: LoggerPort
  ) {}

  async run(featureText: string, retryCount: number = 2): Promise<void> {
    try {
      this.logger.info('CLI Adapter: Starting feature execution');

      const useCase = new ExecuteFeatureUseCase(
        this.browserExecutor,
        this.aiInterpreter,
        this.codeGenerator,
        this.artifactStore,
        this.logger
      );

      const request = new ExecuteFeatureRequest(featureText, retryCount);
      const response = await useCase.execute(request);

      // Output results
      console.log('\n========== EXECUTION RESULTS ==========');
      console.log(`Execution ID: ${response.executionId}`);
      console.log(`Status: ${response.status.toUpperCase()}`);
      console.log(`Duration: ${response.duration}ms`);
      console.log(`Steps: ${response.stepResults.length}`);

      if (response.generatedCode) {
        console.log('\n========== GENERATED CODE ==========');
        console.log(response.generatedCode);
      }

      if (response.errorSummary) {
        console.log(`\nError: ${response.errorSummary}`);
      }

      console.log('\n========== END EXECUTION ==========\n');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`CLI Error: ${errorMessage}`);
      process.exit(1);
    }
  }
}
