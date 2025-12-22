import { ExecuteFeatureRequest, ExecuteFeatureResponse } from '@application/dto';
import { Feature, ExecutionResult } from '@domain/models';
import {
  BrowserExecutorPort,
  AIInterpreterPort,
  CodeGeneratorPort,
  ArtifactStorePort,
  LoggerPort,
} from '@domain/ports';
import { ScenarioExecutionService, StepInterpretationService, DefaultRetryPolicy } from '@domain/services';
import { GherkinFeatureParser } from './GherkinFeatureParser';

export class ExecuteFeatureUseCase {
  private featureParser: GherkinFeatureParser;
  private scenarioExecutionService: ScenarioExecutionService;
  private stepInterpretationService: StepInterpretationService;

  constructor(
    private browserExecutor: BrowserExecutorPort,
    private aiInterpreter: AIInterpreterPort,
    private codeGenerator: CodeGeneratorPort,
    private artifactStore: ArtifactStorePort,
    private logger: LoggerPort
  ) {
    this.featureParser = new GherkinFeatureParser(logger);
    const retryPolicy = new DefaultRetryPolicy(2);
    this.scenarioExecutionService = new ScenarioExecutionService(
      browserExecutor,
      aiInterpreter,
      retryPolicy,
      logger
    );
    this.stepInterpretationService = new StepInterpretationService(aiInterpreter, logger);
  }

  async execute(request: ExecuteFeatureRequest): Promise<ExecuteFeatureResponse> {
    const startTime = Date.now();
    try {
      this.logger.info('[ExecuteFeatureUseCase] Execution started', {
        retryCount: request.retryCount,
        featureLength: request.featureText.length,
      });

      // Parse feature file
      this.logger.info('[ExecuteFeatureUseCase] Parsing feature file...');
      const feature: Feature = this.featureParser.parse(request.featureText);
      this.logger.info('[ExecuteFeatureUseCase] Feature parsed successfully', {
        scenarioCount: feature.scenarios.length,
        featureName: feature.name,
      });

      // Execute first scenario for now (Phase 1)
      if (feature.scenarios.length === 0) {
        throw new Error('Feature has no scenarios');
      }

      const scenario = feature.scenarios[0];
      this.logger.info('[ExecuteFeatureUseCase] Executing scenario', {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        stepCount: scenario.steps.length,
      });

      const executionResult = await this.scenarioExecutionService.executeScenario(scenario);
      this.logger.info('[ExecuteFeatureUseCase] Scenario execution completed', {
        status: executionResult.status,
        stepCount: executionResult.stepExecutions.length,
        duration: `${executionResult.duration}ms`,
      });

      // Generate code after execution
      this.logger.info('[ExecuteFeatureUseCase] Generating test code...');
      const codeGenResponse = await this.codeGenerator.generate({
        executionResult,
        featureText: request.featureText,
      });
      executionResult.generatedCode = codeGenResponse.code;
      this.logger.info('[ExecuteFeatureUseCase] Test code generated', {
        filename: codeGenResponse.filename,
        codeLength: codeGenResponse.code.length,
      });

      // Save artifacts
      this.logger.info('[ExecuteFeatureUseCase] Saving artifacts...', {
        artifactCount: executionResult.artifacts.length,
      });
      for (const artifact of executionResult.artifacts) {
        await this.artifactStore.saveArtifact(artifact);
        this.logger.debug('[ExecuteFeatureUseCase] Artifact saved', {
          artifactId: artifact.id,
          type: artifact.type,
        });
      }

      // Build response
      const response = new ExecuteFeatureResponse(executionResult.id, scenario.id);
      response.status = executionResult.status;
      response.duration = executionResult.duration;
      response.generatedCode = executionResult.generatedCode;
      response.errorSummary = executionResult.errorSummary;
      response.stepResults = executionResult.stepExecutions.map(se => ({
        stepId: se.stepId,
        description: se.stepDescription,
        status: se.status,
        duration: se.duration,
      }));

      const totalDuration = Date.now() - startTime;
      this.logger.info('[ExecuteFeatureUseCase] Execution completed successfully', {
        executionId: response.executionId,
        status: response.status,
        totalDuration: `${totalDuration}ms`,
        stepCount: response.stepResults.length,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const totalDuration = Date.now() - startTime;
      this.logger.error('[ExecuteFeatureUseCase] Execution failed', {
        error: errorMessage,
        duration: `${totalDuration}ms`,
      });
      throw error;
    }
  }
}
