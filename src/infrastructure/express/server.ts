import express, { Express } from 'express';
import path from 'path';
import fs from 'fs';
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
  app.use(express.urlencoded({ extended: true }));

  // Enable CORS for frontend communication
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  logger.info('[ExpressServer] Backend API server initialized', {
    port: process.env.PORT || 3001,
  });

  // Serve frontend static files
  const frontendPath = path.resolve(__dirname, '../../..', 'frontend', 'public');
  const publicPath = path.resolve(__dirname, '../../..', 'public');
  
  if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    logger.info('[ExpressServer] Serving frontend from', { path: frontendPath });
  } else if (fs.existsSync(publicPath)) {
    app.use(express.static(publicPath));
    logger.info('[ExpressServer] Serving frontend from', { path: publicPath });
  }

  // Serve artifacts
  const artifactPath = process.env.ARTIFACT_PATH || './artifacts';
  const artifactDir = path.resolve(artifactPath);
  if (!fs.existsSync(artifactDir)) {
    fs.mkdirSync(artifactDir, { recursive: true });
  }
  app.use('/artifacts', express.static(artifactPath));
  logger.info('[ExpressServer] Serving artifacts from', { path: artifactDir });

  // Request logging middleware (skip artifacts)
  app.use((req, res, next) => {
    if (!req.path.startsWith('/artifacts')) {
      logger.info(`[ExpressServer] ${req.method} ${req.path}`, {
        ip: req.ip,
      });
    }
    next();
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'backend-api' });
  });

  // Feature execution routes
  const featureRouter = createFeatureExecutionRouter(
    browserExecutor,
    aiInterpreter,
    codeGenerator,
    artifactStore,
    logger
  );

  app.use('/', featureRouter);

  // 404 handler
  app.use((req, res) => {
    logger.warn('[ExpressServer] 404 - Route not found', { path: req.path, method: req.method });
    res.status(404).json({
      error: 'Route not found',
      path: req.path,
    });
  });

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    logger.error(`[ExpressServer] Unhandled error: ${err.message}`, { stack: err.stack });
    res.status(500).json({
      error: 'Internal server error',
      message: err.message,
    });
  });

  return app;
}
