import { Scenario } from '@domain/models';
import { ExecutionResult, StepExecution, AgentDecision } from '@domain/models';
import { BrowserExecutorPort, AIInterpreterPort } from '@domain/ports';
import { LoggerPort } from '@domain/ports';
import { RetryPolicy } from './RetryPolicy';

export class ScenarioExecutionService {
  constructor(
    private browserExecutor: BrowserExecutorPort,
    private aiInterpreter: AIInterpreterPort,
    private logger: LoggerPort
  ) {}

  async executeScenario(scenario: Scenario, targetUrl?: string, retryPolicy?: RetryPolicy): Promise<ExecutionResult> {
    const result = new ExecutionResult(scenario);
    const startTime = Date.now();

    try {
      this.logger.info(`[ScenarioExecutionService] executeScenario called`, {
        scenarioId: scenario.id,
        hasTargetUrl: !!targetUrl,
        targetUrl: targetUrl || 'NOT PROVIDED',
        stepCount: scenario.steps.length,
      });

      // Navigate to target URL if provided
      if (targetUrl) {
        this.logger.info(`[ScenarioExecutionService] Navigating to target URL`, {
          targetUrl,
        });
        await this.browserExecutor.execute({
          step: { id: 'navigate', description: `Navigate to ${targetUrl}`, type: 'Given' },
          actionType: 'navigate',
          elementSelector: '',
          actionValue: targetUrl,
        });
        this.logger.info(`[ScenarioExecutionService] Successfully navigated to target URL`);
      }

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

          // If the step is a navigate action and we have a target URL, use the target URL instead of AI-inferred URL
          let actionValueToUse = aiResponse.actionValue;
          this.logger.info(`[ScenarioExecutionService] Before navigate override check`, {
            stepId: step.id,
            actionType: aiResponse.actionType,
            hasTargetUrl: !!targetUrl,
            targetUrl: targetUrl || 'NONE',
            aiResponseActionValue: aiResponse.actionValue,
          });

          if (aiResponse.actionType === 'navigate' && targetUrl) {
            this.logger.info(`[ScenarioExecutionService] Navigate step detected with target URL provided`, {
              stepId: step.id,
              originalAIUrl: aiResponse.actionValue,
              usingTargetUrl: targetUrl,
              description: step.description,
            });
            actionValueToUse = targetUrl;
          } else if (aiResponse.actionType === 'navigate') {
            this.logger.warn(`[ScenarioExecutionService] Navigate step detected but NO target URL provided`, {
              stepId: step.id,
              aiUrl: aiResponse.actionValue,
              description: step.description,
            });
          }

          this.logger.info(`[ScenarioExecutionService] Action value to use`, {
            stepId: step.id,
            actionType: aiResponse.actionType,
            actionValueToUse,
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
            actionValue: actionValueToUse,
          });

          const duration = Date.now() - stepStartTime;

          // Create AgentDecision from AI response
          const agentDecision = new AgentDecision(
            step.id,
            aiResponse.reasoning,
            aiResponse.reasoning,
            aiResponse.actionType,
            aiResponse.confidenceScore,
            undefined, // id - will be auto-generated
            aiResponse.elementSelector,
            aiResponse.actionValue,
            aiResponse.elementDescription
          );

          const stepExecution: StepExecution = {
            stepId: step.id,
            stepDescription: step.description,
            status: executionResponse.success ? 'passed' : 'failed',
            executedAt: new Date(),
            duration,
            agentDecision,
            screenshot: executionResponse.screenshot,
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

          // Extract screenshot from error if available
          const screenshot = (stepError as any)?.screenshot || '';

          const stepExecution: StepExecution = {
            stepId: step.id,
            stepDescription: step.description,
            status: 'failed',
            executedAt: new Date(),
            duration: Date.now() - startTime,
            agentDecision,
            errorMessage,
            screenshot, // Include screenshot even on failure
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

  canRetry(result: ExecutionResult, retryPolicy?: RetryPolicy): boolean {
    if (!retryPolicy) {
      return false;
    }
    return retryPolicy.shouldRetry(result);
  }
}
