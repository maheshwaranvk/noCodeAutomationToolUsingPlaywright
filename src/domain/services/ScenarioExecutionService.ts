import { Scenario } from '@domain/models';
import { ExecutionResult, StepExecution, AgentDecision } from '@domain/models';
import { BrowserExecutorPort, AIInterpreterPort } from '@domain/ports';
import { LoggerPort } from '@domain/ports';
import { RetryPolicy } from './RetryPolicy';

export class ScenarioExecutionService {
  constructor(
    private browserExecutor: BrowserExecutorPort,
    private aiInterpreter: AIInterpreterPort,
    private retryPolicy: RetryPolicy,
    private logger: LoggerPort
  ) {}

  async executeScenario(scenario: Scenario): Promise<ExecutionResult> {
    const result = new ExecutionResult(scenario);
    const startTime = Date.now();

    try {
      this.logger.info(`[ScenarioExecutionService] Starting scenario execution`, {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        stepCount: scenario.steps.length,
      });

      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        this.logger.info(`[ScenarioExecutionService] Executing step ${i + 1}/${scenario.steps.length}`, {
          stepId: step.id,
          description: step.description,
        });

        try {
          const stepStartTime = Date.now();

          // Step 1: Interpret the natural language step using Groq AI
          this.logger.info(`[ScenarioExecutionService] Interpreting step with AI`, {
            stepId: step.id,
            description: step.description,
          });

          // Get page context for AI interpretation
          const pageTitle = await this.browserExecutor.getPageTitle();
          const pageContent = await this.browserExecutor.getPageContent();

          const aiResponse = await this.aiInterpreter.interpretStep({
            step,
            pageContent: pageContent || '',
            pageTitle: pageTitle || 'Unknown',
          });
          
          this.logger.info(`[ScenarioExecutionService] Step interpreted by AI`, {
            stepId: step.id,
            actionType: aiResponse.actionType,
            confidence: aiResponse.confidenceScore,
          });

          // Step 2: Execute the action using Playwright browser executor
          this.logger.info(`[ScenarioExecutionService] Executing action in browser`, {
            stepId: step.id,
            actionType: aiResponse.actionType,
          });

          const executionResponse = await this.browserExecutor.execute({
            step,
            actionType: aiResponse.actionType,
            elementSelector: aiResponse.elementSelector,
            actionValue: aiResponse.actionValue,
          });

          const duration = Date.now() - stepStartTime;

          // Create AgentDecision from AI response
          const agentDecision = new AgentDecision(
            step.id,
            aiResponse.reasoning,
            aiResponse.reasoning,
            aiResponse.actionType,
            aiResponse.confidenceScore
          );

          const stepExecution: StepExecution = {
            stepId: step.id,
            stepDescription: step.description,
            status: executionResponse.success ? 'passed' : 'failed',
            executedAt: new Date(),
            duration,
            agentDecision,
          };

          result.addStepExecution(stepExecution);

          this.logger.info(`[ScenarioExecutionService] Step executed successfully`, {
            stepId: step.id,
            duration: `${duration}ms`,
            message: executionResponse.message,
          });
        } catch (stepError) {
          const errorMessage = stepError instanceof Error ? stepError.message : String(stepError);
          this.logger.error(`[ScenarioExecutionService] Step execution failed`, {
            stepId: step.id,
            error: errorMessage,
          });

          const agentDecision = new AgentDecision(
            step.id,
            'Step failed',
            errorMessage,
            'failed'
          );

          const stepExecution: StepExecution = {
            stepId: step.id,
            stepDescription: step.description,
            status: 'failed',
            executedAt: new Date(),
            duration: Date.now() - startTime,
            agentDecision,
            errorMessage,
          };

          result.addStepExecution(stepExecution);
          throw stepError;
        }
      }

      const totalDuration = Date.now() - startTime;
      result.duration = totalDuration;
      result.markAsCompleted('passed');

      this.logger.info(`[ScenarioExecutionService] Scenario execution completed successfully`, {
        scenarioId: scenario.id,
        status: 'passed',
        duration: `${totalDuration}ms`,
        stepCount: result.stepExecutions.length,
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const totalDuration = Date.now() - startTime;
      result.duration = totalDuration;
      result.errorSummary = errorMessage;
      result.markAsCompleted('failed');

      this.logger.error(`[ScenarioExecutionService] Scenario execution failed`, {
        scenarioId: scenario.id,
        error: errorMessage,
        duration: `${totalDuration}ms`,
        stepCount: result.stepExecutions.length,
      });

      return result;
    }
  }

  canRetry(result: ExecutionResult): boolean {
    return this.retryPolicy.shouldRetry(result);
  }
}
