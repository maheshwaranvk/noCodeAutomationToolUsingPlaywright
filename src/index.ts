import dotenv from 'dotenv';
dotenv.config();

import { setupExpressServer } from '@infrastructure/express';
import { PlaywrightBrowserExecutor } from '@adapters/outbound/playwright';
import { MCPAIInterpreter } from '@adapters/outbound/ai';
import { PlaywrightCodeGenerator } from '@adapters/outbound/codegen';
import { FileSystemArtifactStore } from '@adapters/outbound/filesystem';
import { ConsoleLogger } from '@infrastructure/logging';
import { config } from '@config/index';

async function main() {
  try {
    // Initialize logger first
    const logger = new ConsoleLogger();

    logger.info('Starting nocode-ui-automation server', {
      nodeEnv: config.nodeEnv,
      port: config.port,
    });

    // Initialize adapters
    const browserExecutor = new PlaywrightBrowserExecutor(logger);
    const aiInterpreter = new MCPAIInterpreter(logger);
    const codeGenerator = new PlaywrightCodeGenerator(logger);
    const artifactStore = new FileSystemArtifactStore(logger, config.artifactPath);

    // Setup Express server
    const app = setupExpressServer(
      browserExecutor,
      aiInterpreter,
      codeGenerator,
      artifactStore,
      logger
    );

    // Start server
    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`, {
        url: `http://localhost:${config.port}`,
      });
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Fatal error: ${errorMessage}`);
    process.exit(1);
  }
}

main();
