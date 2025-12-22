import { Step } from '@domain/models';
import { AIInterpreterPort } from '@domain/ports';
import { LoggerPort } from '@domain/ports';

export class StepInterpretationService {
  constructor(
    private aiInterpreter: AIInterpreterPort,
    private logger: LoggerPort
  ) {}

  async interpretStep(
    step: Step,
    pageContent: string,
    pageTitle: string,
    previousScreenshot?: string,
    executionHistory?: string[]
  ) {
    try {
      this.logger.info(`Interpreting step: "${step.description}"`);

      const interpretation = await this.aiInterpreter.interpretStep({
        step,
        pageContent,
        pageTitle,
        previousScreenshot,
        executionHistory,
      });

      this.logger.info(`Step interpretation complete`, {
        stepId: step.id,
        actionType: interpretation.actionType,
        confidenceScore: interpretation.confidenceScore,
      });

      return interpretation;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to interpret step`, {
        stepId: step.id,
        error: errorMessage,
      });
      throw error;
    }
  }
}
