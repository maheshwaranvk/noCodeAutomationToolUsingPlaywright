import * as fs from 'fs';
import * as path from 'path';
import { CLIAdapter } from './CLIAdapter';
import { PlaywrightBrowserExecutor } from '@adapters/outbound/playwright';
import { MCPAIInterpreter } from '@adapters/outbound/ai';
import { PlaywrightCodeGenerator } from '@adapters/outbound/codegen';
import { FileSystemArtifactStore } from '@adapters/outbound/filesystem';
import { ConsoleLogger } from '@infrastructure/logging';

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let featureText = '';
  let retryCount = 2;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--feature' && i + 1 < args.length) {
      featureText = args[i + 1];
      i++;
    } else if (args[i] === '--retry' && i + 1 < args.length) {
      retryCount = parseInt(args[i + 1], 10);
      i++;
    } else if (args[i] === '--file' && i + 1 < args.length) {
      const filePath = args[i + 1];
      featureText = fs.readFileSync(filePath, 'utf-8');
      i++;
    }
  }

  if (!featureText) {
    console.error(
      'Usage: npx nocode-ui run --feature "<feature text>" [--retry 2] [--file path/to/feature.gherkin]'
    );
    process.exit(1);
  }

  // Initialize adapters
  const logger = new ConsoleLogger();
  const browserExecutor = new PlaywrightBrowserExecutor(logger);
  const aiInterpreter = new MCPAIInterpreter(logger);
  const codeGenerator = new PlaywrightCodeGenerator(logger);
  const artifactStore = new FileSystemArtifactStore(logger);

  // Create and run CLI adapter
  const cli = new CLIAdapter(
    browserExecutor,
    aiInterpreter,
    codeGenerator,
    artifactStore,
    logger
  );

  await cli.run(featureText, retryCount);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
