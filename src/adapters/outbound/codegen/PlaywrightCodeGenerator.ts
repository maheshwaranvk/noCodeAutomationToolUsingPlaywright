import { CodeGeneratorPort, CodeGenerationRequest, CodeGenerationResponse } from '@domain/ports';
import { LoggerPort } from '@domain/ports';

export class PlaywrightCodeGenerator implements CodeGeneratorPort {
  constructor(private logger: LoggerPort) {}

  async generate(request: CodeGenerationRequest): Promise<CodeGenerationResponse> {
    try {
      this.logger.info('[PlaywrightCodeGenerator] Generating Playwright code', {
        executionId: request.executionResult.id,
        stepCount: request.executionResult.stepExecutions.length,
        scenarioName: request.executionResult.scenarioName,
      });

      const code = this.generatePlaywrightCode(request);

      this.logger.info('[PlaywrightCodeGenerator] Code generated successfully', {
        executionId: request.executionResult.id,
        codeLength: code.length,
        language: 'typescript',
      });

      return {
        code,
        language: 'typescript',
        filename: `${request.executionResult.scenarioName || 'test'}.spec.ts`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[PlaywrightCodeGenerator] Code generation failed', {
        error: errorMessage,
      });
      throw error;
    }
  }

  private generatePlaywrightCode(request: CodeGenerationRequest): string {
    const { executionResult, featureText } = request;
    const steps = executionResult.stepExecutions;

    // Extract scenario name from feature text or use generic name
    const scenarioMatch = featureText.match(/Scenario:\s*(.+)/i);
    const scenarioName = scenarioMatch ? scenarioMatch[1].trim() : 'Test Scenario';

    let code = `/**
 * Generated Playwright Test - ${scenarioName}
 * 
 * This test was automatically generated from feature execution.
 * Original Feature:
 * ${featureText.split('\n').map(line => ` * ${line}`).join('\n')}
 */

import { test, expect, Page } from '@playwright/test';

test.describe('${scenarioName}', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('${scenarioName}', async () => {
`;

    // Generate test steps from execution result
    steps.forEach((step, index) => {
      code += `    // Step ${index + 1}: ${step.stepDescription}\n`;

      if (step.agentDecision) {
        const decision = step.agentDecision;
        const actionType = decision.actionType || 'unknown';
        const elementDesc = decision.decision || 'element';
        const selector = decision.selectedElement || 'unknown';

        switch (actionType) {
          case 'navigate':
            code += `    await page.goto('https://example.com');\n`;
            break;
          case 'click':
            code += `    await page.click('${selector}'); // ${elementDesc}\n`;
            break;
          case 'type':
            code += `    await page.fill('${selector}', '${decision.reasoning || 'text'}'); // ${elementDesc}\n`;
            break;
          case 'select':
            code += `    await page.selectOption('${selector}', '${decision.reasoning || 'option'}'); // ${elementDesc}\n`;
            break;
          case 'check':
            code += `    await page.check('${selector}'); // ${elementDesc}\n`;
            break;
          case 'uncheck':
            code += `    await page.uncheck('${selector}'); // ${elementDesc}\n`;
            break;
          case 'hover':
            code += `    await page.hover('${selector}'); // ${elementDesc}\n`;
            break;
          case 'scroll':
            code += `    await page.evaluate(() => window.scrollBy(0, window.innerHeight));\n`;
            break;
          case 'wait':
            code += `    await page.waitForSelector('${selector}'); // Wait for ${elementDesc}\n`;
            break;
          case 'extract':
            code += `    const content = await page.textContent('body');\n`;
            break;
          default:
            code += `    // Action: ${actionType} on ${elementDesc}\n`;
        }

        // Add assertion if step indicates a "Then" statement
        if (step.stepDescription.toLowerCase().startsWith('then')) {
          code += `    // Verify: ${step.stepDescription}\n`;
          code += `    // Add appropriate assertion here\n`;
        }
      }

      code += `\n`;
    });

    code += `  });\n});
`;

    this.logger.debug('[PlaywrightCodeGenerator] Generated code', {
      lines: code.split('\n').length,
      steps: steps.length,
    });

    return code;
  }
}
