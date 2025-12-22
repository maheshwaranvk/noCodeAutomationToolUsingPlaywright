import express, { Express } from 'express';
import { createFeatureExecutionRouter } from '@adapters/inbound/api';
import { BrowserExecutorPort, AIInterpreterPort, CodeGeneratorPort, ArtifactStorePort, LoggerPort } from '@domain/ports';

export function setupExpressServer(
  browserExecutor: BrowserExecutorPort,
  aiInterpreter: AIInterpreterPort,
  codeGenerator: CodeGeneratorPort,
  artifactStore: ArtifactStorePort,
  logger: LoggerPort
): Express {
  const app = express();

  // Middleware
  app.use(express.json());

  // Request logging middleware
  app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`, {
      ip: req.ip,
    });
    next();
  });

  // Routes
  const featureRouter = createFeatureExecutionRouter(
    browserExecutor,
    aiInterpreter,
    codeGenerator,
    artifactStore,
    logger
  );

  app.use('/', featureRouter);

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    logger.error(`Unhandled error: ${err.message}`);
    res.status(500).json({
      error: 'Internal server error',
    });
  });

  return app;
}
