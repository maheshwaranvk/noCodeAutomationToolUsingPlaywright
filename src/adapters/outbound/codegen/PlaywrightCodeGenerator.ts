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
    const { executionResult, featureText, targetUrl } = request;
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
        const selector = decision.elementSelector || 'unknown';
        const value = decision.actionValue || '';

        switch (actionType) {
          case 'navigate':
            const url = targetUrl || 'https://example.com';
            code += `    await page.goto('${url}');\n`;
            break;
          case 'click':
            if (selector && selector !== 'unknown') {
              code += `    await page.click('${this.escapeSelector(selector)}');\n`;
            } else {
              code += `    // TODO: Click action - selector not found\n`;
              code += `    // await page.click('${decision.elementDescription || 'button'}');\n`;
            }
            break;
          case 'type': {
            const typeValue = value || this.extractValueFromDescription(step.stepDescription);
            if (selector && selector !== 'unknown') {
              code += `    await page.fill('${this.escapeSelector(selector)}', '${this.escapeString(typeValue)}');\n`;
            } else {
              code += `    // TODO: Type action - selector not found for "${typeValue}"\n`;
              code += `    // await page.fill('input', '${this.escapeString(typeValue)}');\n`;
            }
            break;
          }
          case 'select': {
            const selectValue = value || this.extractValueFromDescription(step.stepDescription);
            if (selector && selector !== 'unknown') {
              code += `    await page.selectOption('${this.escapeSelector(selector)}', '${this.escapeString(selectValue)}');\n`;
            } else {
              code += `    // TODO: Select action - selector not found for "${selectValue}"\n`;
              code += `    // await page.selectOption('select', '${this.escapeString(selectValue)}');\n`;
            }
            break;
          }
          case 'check':
            if (selector && selector !== 'unknown') {
              code += `    await page.check('${this.escapeSelector(selector)}');\n`;
            } else {
              code += `    // TODO: Check action - selector not found\n`;
              code += `    // await page.check('input[type="checkbox"]');\n`;
            }
            break;
          case 'uncheck':
            if (selector && selector !== 'unknown') {
              code += `    await page.uncheck('${this.escapeSelector(selector)}');\n`;
            } else {
              code += `    // TODO: Uncheck action - selector not found\n`;
              code += `    // await page.uncheck('input[type="checkbox"]');\n`;
            }
            break;
          case 'hover':
            if (selector && selector !== 'unknown') {
              code += `    await page.hover('${this.escapeSelector(selector)}');\n`;
            } else {
              code += `    // TODO: Hover action - selector not found\n`;
              code += `    // await page.hover('element');\n`;
            }
            break;
          case 'scroll':
            code += `    await page.evaluate(() => window.scrollBy(0, window.innerHeight));\n`;
            break;
          case 'wait':
            code += `    await page.waitForLoadState('networkidle');\n`;
            break;
          case 'extract':
            code += `    const content = await page.textContent('body');\n`;
            break;
          default:
            code += `    // TODO: Implement ${actionType} action\n`;
        }
      }

      code += `\n`;
    });

    code += `  });\n});
`;

    return code;
  }

  private escapeSelector(selector: string): string {
    // Escape single quotes in selector
    return selector.replace(/'/g, "\\'");
  }

  private escapeString(str: string): string {
    // Escape single quotes and backslashes
    return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  private extractValueFromDescription(description: string): string {
    // Try to extract value from common patterns like: "I enter X as 'value'" or "I enter 'value'"
    const patterns = [
      /(?:as|with)\s+['""]([^'""]*)["']/i,
      /['""]([^'""]*)["']/,
    ];

    for (const pattern of patterns) {
      const match = description.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return '';
  }
}

