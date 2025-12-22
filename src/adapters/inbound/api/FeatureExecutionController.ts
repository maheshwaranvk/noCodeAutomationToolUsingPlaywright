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
      const { featureText, retryCount = 2 } = req.body;

      if (!featureText) {
        return res.status(400).json({
          error: 'featureText is required',
        });
      }

      const useCase = new ExecuteFeatureUseCase(
        browserExecutor,
        aiInterpreter,
        codeGenerator,
        artifactStore,
        logger
      );

      const request = new ExecuteFeatureRequest(featureText, retryCount);
      const response = await useCase.execute(request);

      res.json(response);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`API Error: ${errorMessage}`);
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
