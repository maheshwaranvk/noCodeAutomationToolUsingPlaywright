import { Scenario, ExecutionResult } from '@domain/models';
import { ScenarioExecutionService } from '@domain/services';
import { BrowserExecutorPort, LoggerPort } from '@domain/ports';

export class RetryScenarioUseCase {
  constructor(
    private scenarioExecutionService: ScenarioExecutionService,
    private browserExecutor: BrowserExecutorPort,
    private logger: LoggerPort
  ) {}

  async execute(
    scenario: Scenario,
    previousResult: ExecutionResult
  ): Promise<ExecutionResult> {
    try {
      this.logger.info('RetryScenarioUseCase started', {
        scenarioId: scenario.id,
        previousRetryCount: previousResult.retryCount,
      });

      scenario.retryCount++;
      const newResult = await this.scenarioExecutionService.executeScenario(scenario);
      newResult.retryCount = previousResult.retryCount + 1;

      this.logger.info('RetryScenarioUseCase completed', {
        scenarioId: scenario.id,
        status: newResult.status,
        retryCount: newResult.retryCount,
      });

      return newResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('RetryScenarioUseCase failed', { error: errorMessage });
      throw error;
    }
  }
}
