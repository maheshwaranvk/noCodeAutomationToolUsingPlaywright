import { Router, Request, Response } from 'express';
import { ExecuteFeatureUseCase } from '@application/usecases';
import { ExecuteFeatureRequest } from '@application/dto';
import { BrowserExecutorPort, AIInterpreterPort, CodeGeneratorPort, ArtifactStorePort, LoggerPort } from '@domain/ports';

export function createFeatureExecutionRouter(
  browserExecutor: BrowserExecutorPort,
  aiInterpreter: AIInterpreterPort,
  codeGenerator: CodeGeneratorPort,
  artifactStore: ArtifactStorePort,
  logger: LoggerPort
): Router {
  const router = Router();

  router.post('/execute', async (req: Request, res: Response) => {
    try {
      const { featureText, retryCount = 2, targetUrl, url } = req.body;
      
      // Support both 'url' and 'targetUrl' parameters
      const resolvedUrl = url || targetUrl;

      if (!featureText) {
        return res.status(400).json({
          error: 'featureText is required',
        });
      }

      if (!resolvedUrl) {
        return res.status(400).json({
          error: 'url (or targetUrl) is required. Provide the target URL for feature execution.',
        });
      }

      logger.info('[FeatureExecutionController] POST /execute received', {
        featureLength: featureText.length,
        retryCount,
        hasTargetUrl: !!resolvedUrl,
      });

      const useCase = new ExecuteFeatureUseCase(
        browserExecutor,
        aiInterpreter,
        codeGenerator,
        artifactStore,
        logger
      );

      const request = new ExecuteFeatureRequest(featureText, retryCount, resolvedUrl);
      logger.info('[FeatureExecutionController] Executing feature', { targetUrl: resolvedUrl });
      const response = await useCase.execute(request);

      logger.info('[FeatureExecutionController] Execution complete', {
        status: response.status,
        artifacts: response.artifacts.length,
      });
      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[FeatureExecutionController] API Error: ${errorMessage}`);
      res.status(500).json({
        error: errorMessage,
      });
    }
  });

  router.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  return router;
}
