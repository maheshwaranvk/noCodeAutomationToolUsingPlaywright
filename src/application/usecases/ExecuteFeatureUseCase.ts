import { ExecuteFeatureRequest, ExecuteFeatureResponse } from '@application/dto';
import { Feature, ExecutionResult, TestArtifact } from '@domain/models';
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
    this.scenarioExecutionService = new ScenarioExecutionService(
      browserExecutor,
      aiInterpreter,
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
        targetUrl: request.targetUrl || 'Not specified',
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
        targetUrl: request.targetUrl,
      });

      const retryPolicy = new DefaultRetryPolicy(request.retryCount || 2, this.logger);
      const executionResult = await this.scenarioExecutionService.executeScenario(scenario, request.targetUrl, retryPolicy);
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
        targetUrl: request.targetUrl,
      });
      executionResult.generatedCode = codeGenResponse.code;
      this.logger.info('[ExecuteFeatureUseCase] Test code generated', {
        filename: codeGenResponse.filename,
        codeLength: codeGenResponse.code.length,
      });

      // Create screenshot artifacts from all step executions (passed and failed)
      this.logger.info('[ExecuteFeatureUseCase] Creating screenshot artifacts...', {
        stepCount: executionResult.stepExecutions.length,
      });
      
      for (let i = 0; i < executionResult.stepExecutions.length; i++) {
        const stepExecution = executionResult.stepExecutions[i];
        this.logger.debug('[ExecuteFeatureUseCase] Checking screenshot for step', {
          stepIndex: i + 1,
          hasScreenshot: !!stepExecution.screenshot,
          screenshotLength: stepExecution.screenshot?.length || 0,
        });
        
        if (stepExecution.screenshot) {
          const screenshotArtifact = new TestArtifact(
            executionResult.id,
            'screenshot',
            `step-${i + 1}-${stepExecution.status}.png`,
            stepExecution.screenshot // base64 content stored in path
          );
          executionResult.addArtifact(screenshotArtifact);
          this.logger.debug('[ExecuteFeatureUseCase] Screenshot artifact created', {
            stepId: stepExecution.stepId,
            status: stepExecution.status,
            filename: screenshotArtifact.filename,
          });
        }
      }

      // Capture video artifact if video recording was enabled
      this.logger.info('[ExecuteFeatureUseCase] Checking for video artifact...');
      try {
        const videoPath = await this.browserExecutor.getVideoPath();
        if (videoPath) {
          this.logger.info('[ExecuteFeatureUseCase] Video artifact detected', { videoPath });
          const videoArtifact = new TestArtifact(
            executionResult.id,
            'video',
            `execution-recording.webm`,
            videoPath // store the file path so artifact store can copy it
          );
          executionResult.addArtifact(videoArtifact);
          this.logger.debug('[ExecuteFeatureUseCase] Video artifact created', {
            filename: videoArtifact.filename,
          });
        } else {
          this.logger.debug('[ExecuteFeatureUseCase] No video artifact found');
        }
      } catch (videoError) {
        const videoErrorMsg = videoError instanceof Error ? videoError.message : String(videoError);
        this.logger.warn('[ExecuteFeatureUseCase] Failed to capture video artifact', { error: videoErrorMsg });
      }

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
        errorMessage: se.errorMessage,
      }));

      // Add artifacts to response (screenshots, videos, etc.)
      // Use execution ID + filename to create the correct API path
      response.artifacts = executionResult.artifacts.map(artifact => ({
        type: artifact.type,
        filename: artifact.filename,
        path: `${executionResult.id}/${artifact.filename}`, // API will serve from /artifacts/{executionId}/{filename}
      }));

      this.logger.info('[ExecuteFeatureUseCase] Response artifacts', {
        count: response.artifacts.length,
        artifacts: response.artifacts.map(a => ({ type: a.type, filename: a.filename, path: a.path })),
      });

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
    } finally {
      // Close browser after execution to ensure fresh state for next execution
      try {
        this.logger.info('[ExecuteFeatureUseCase] Closing browser for clean state');
        await this.browserExecutor.close();
      } catch (closeError) {
        const closeErrorMsg = closeError instanceof Error ? closeError.message : String(closeError);
        this.logger.warn('[ExecuteFeatureUseCase] Error closing browser', {
          error: closeErrorMsg,
        });
      }
    }
  }
}
