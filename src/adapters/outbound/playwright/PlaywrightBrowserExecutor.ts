import { Browser, BrowserContext, Page, Locator, chromium } from 'playwright';
import { BrowserExecutorPort, BrowserExecutionRequest, BrowserExecutionResponse } from '@domain/ports';
import { LoggerPort } from '@domain/ports';

/**
 * PlaywrightBrowserExecutor using Playwright Agent Pattern
 * Uses Playwright's intelligent element discovery and role-based selectors
 * instead of hardcoded CSS selectors. Delegates element finding to Playwright's
 * built-in accessibility and role-based locators (Agent behavior).
 */
export class PlaywrightBrowserExecutor implements BrowserExecutorPort {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private isInitialized = false;
  private lastBrowserCheckTime = 0;
  private readonly browserCheckInterval = 5000; // Check every 5 seconds

  constructor(private logger: LoggerPort) {
    this.logger.info('[PlaywrightBrowserExecutor] Playwright Agent initialized');
  }

  private isBrowserStillValid(): boolean {
    // Check if browser is connected
    if (!this.browser || !this.browser.isConnected()) {
      return false;
    }

    // Check if context still exists
    if (!this.context) {
      return false;
    }

    // Check if page still exists (may have been closed by user)
    if (!this.page) {
      return false;
    }

    return true;
  }

  private async ensureBrowserInitialized(): Promise<void> {
    // Quick check: if everything looks good, return immediately
    if (this.isInitialized && this.isBrowserStillValid()) {
      return;
    }

    this.logger.info('[PlaywrightBrowserExecutor] Launching Playwright Agent...');

    try {
      // Clean up any dead resources
      try {
        if (this.page) {
          await this.page.close().catch(() => {});
        }
        if (this.context) {
          await this.context.close().catch(() => {});
        }
        if (this.browser) {
          await this.browser.close().catch(() => {});
        }
      } catch {
        // Ignore cleanup errors
      }

      this.browser = await chromium.launch({
        headless: process.env.HEADLESS !== 'false',
      });
      this.logger.info('[PlaywrightBrowserExecutor] Chromium browser launched');

      this.context = await this.browser.newContext();
      this.logger.info('[PlaywrightBrowserExecutor] Browser context created');

      this.page = await this.context.newPage();
      this.logger.info('[PlaywrightBrowserExecutor] Playwright Agent ready');

      this.isInitialized = true;
    } catch (error) {
      this.isInitialized = false;
      this.page = null;
      this.context = null;
      this.browser = null;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[PlaywrightBrowserExecutor] Failed to launch agent', {
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Execute action using Playwright's Agent-based approach
   * Leverages intelligent element discovery via accessibility roles and auto-waiting
   */
  async execute(request: BrowserExecutionRequest): Promise<BrowserExecutionResponse> {
    try {
      await this.ensureBrowserInitialized();

      if (!this.page) {
        throw new Error('Playwright Agent page is not initialized');
      }

      this.logger.info('[PlaywrightBrowserExecutor] Agent executing', {
        stepId: request.step.id,
        action: request.actionType,
        task: request.step.description,
      });

      const startTime = Date.now();
      let screenshot = '';
      let message = '';

      // Execute using Playwright's intelligent agent capabilities
      message = await this.agentExecuteAction(
        request.actionType,
        request.elementSelector,
        request.actionValue,
        request.step.description
      );

      // Capture visual result
      try {
        const screenshotBuffer = await this.page.screenshot({ fullPage: false });
        screenshot = screenshotBuffer.toString('base64');
        this.logger.debug('[PlaywrightBrowserExecutor] Screenshot captured');
      } catch (screenshotError) {
        this.logger.warn('[PlaywrightBrowserExecutor] Screenshot failed', {
          error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError),
        });
      }

      const duration = Date.now() - startTime;
      this.logger.info('[PlaywrightBrowserExecutor] Agent action succeeded', {
        stepId: request.step.id,
        duration: `${duration}ms`,
      });

      return {
        success: true,
        screenshot,
        message,
        timestamp: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[PlaywrightBrowserExecutor] Agent action failed', {
        stepId: request.step.id,
        error: errorMessage,
      });
      throw error;
    }
  }

  /**
   * Agent-based intelligent action execution
   * Uses Playwright's locators with role-based discovery
   */

  private async agentExecuteAction(
    actionType: string,
    selector: string | undefined,
    actionValue: string | undefined,
    instruction: string
  ): Promise<string> {
    // Ensure browser/page is open before every action
    if (!this.page || !this.browser || !this.browser.isConnected()) {
      this.logger.warn('[PlaywrightBrowserExecutor] Page or browser was closed before action, reinitializing...');
      await this.ensureBrowserInitialized();
    }
    if (!this.page) {
      throw new Error('Page not initialized after reinitialization');
    }

    this.logger.info('[PlaywrightBrowserExecutor] Agent resolving action', {
      actionType,
      instruction,
    });

    switch (actionType) {
      case 'navigate': {
        const url = actionValue || selector || 'about:blank';
        this.logger.info('[PlaywrightBrowserExecutor] Agent navigating', { url });
        await this.page.goto(url, { waitUntil: 'networkidle' });
        return `Navigated to ${url}`;
      }

      case 'click': {
        const locator = selector 
          ? this.page.locator(selector)
          : this.intelligentFindElement('button', instruction);
        this.logger.info('[PlaywrightBrowserExecutor] Agent clicking', { instruction });
        await locator.click({ timeout: 5000 });
        return `Clicked element for: ${instruction}`;
      }

      case 'type': {
        this.logger.info('[PlaywrightBrowserExecutor] Agent typing', { instruction, value: actionValue });

        // Ensure page is ready before typing
        try {
          await this.page.waitForLoadState('networkidle');
          this.logger.debug('[PlaywrightBrowserExecutor] Page reached networkidle');
        } catch (e) {
          this.logger.warn('[PlaywrightBrowserExecutor] Page networkidle timeout, continuing anyway');
        }

        // Dismiss any popups/modals that might be blocking the search input
        try {
          // Try clicking escape key to close any modal dialogs
          await this.page.keyboard.press('Escape');
          this.logger.debug('[PlaywrightBrowserExecutor] Pressed Escape to dismiss popups');
          await this.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
        } catch (e) {
          // ignore
        }

        // Look for and close "Choose browser" or similar popups
        const popupCloseSelectors = [
          'button[aria-label="Close"]',
          'button[aria-label*="close" i]',
          '[role="dialog"] button[aria-label*="close" i]',
          '[role="alertdialog"] button',
          '.modal-close',
          '[data-dismiss="modal"]',
          'button.close',
        ];

        for (const closeBtn of popupCloseSelectors) {
          try {
            const btn = this.page.locator(closeBtn).first();
            const count = await btn.count();
            if (count > 0) {
              this.logger.debug('[PlaywrightBrowserExecutor] Found and clicking popup close button', { selector: closeBtn });
              await btn.click({ timeout: 2000 });
              await this.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));
              break;
            }
          } catch (e) {
            // ignore and continue
          }
        }

        // Wait a bit for dynamic content to load (Google search input)
        await this.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

        // Try multiple selector strategies in order
        const candidates = selector ? [selector] : [
          'input[name="q"]',
          'input[title="Search"]',
          '[role="searchbox"]',
          'input[aria-label*="search" i]',
          'input[placeholder*="search" i]',
          'input[type="search"]',
          'input[type="text"]',
          'textarea',
          'input',
        ];

        let lastError: Error | null = null;
        for (const sel of candidates) {
          try {
            this.logger.debug('[PlaywrightBrowserExecutor] Trying type selector', { sel });
            const locator = this.page.locator(sel).first();
            
            // Check if element exists
            const count = await locator.count();
            if (count === 0) {
              this.logger.debug('[PlaywrightBrowserExecutor] Selector found 0 elements', { sel });
              continue;
            }

            this.logger.debug('[PlaywrightBrowserExecutor] Found input element', { sel, count });
            
            // Scroll into view and focus
            await locator.scrollIntoViewIfNeeded({ timeout: 2000 });
            await locator.focus({ timeout: 2000 });
            
            // Fill the input
            await locator.fill(actionValue || '', { timeout: 3000 });
            
            this.logger.info('[PlaywrightBrowserExecutor] Successfully typed', { sel, value: actionValue });
            return `Typed "${actionValue}" into element (${sel}) for: ${instruction}`;
          } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
            this.logger.debug('[PlaywrightBrowserExecutor] Type selector failed', { sel, error: lastError.message });
            // Continue to next selector
          }
        }

        // All candidates failed
        this.logger.error('[PlaywrightBrowserExecutor] All type selectors exhausted', { 
          instruction,
          candidates,
          lastError: lastError?.message
        });
        throw new Error(`Could not find input element for: ${instruction}. Error: ${lastError?.message || 'unknown'}`);
      }

      case 'select': {
        const locator = selector
          ? this.page.locator(selector)
          : this.page.getByRole('combobox').first();
        this.logger.info('[PlaywrightBrowserExecutor] Agent selecting option', { value: actionValue });
        await locator.selectOption(actionValue || '');
        return `Selected: ${actionValue}`;
      }

      case 'hover': {
        const locator = selector
          ? this.page.locator(selector)
          : this.intelligentFindElement('hoverable', instruction);
        this.logger.info('[PlaywrightBrowserExecutor] Agent hovering', { instruction });
        await locator.hover({ timeout: 5000 });
        return `Hovered over element for: ${instruction}`;
      }

      case 'scroll': {
        this.logger.info('[PlaywrightBrowserExecutor] Agent scrolling');
        await this.page.press('body', 'PageDown');
        return 'Page scrolled down';
      }

      case 'wait': {
        this.logger.info('[PlaywrightBrowserExecutor] Agent waiting');
        await this.page.waitForLoadState('networkidle');
        return 'Wait completed - page stable';
      }

      case 'extract': {
        this.logger.info('[PlaywrightBrowserExecutor] Agent extracting content');
        const content = await this.page.content();
        return `Extracted ${content.length} characters`;
      }

      case 'check': {
        const locator = selector
          ? this.page.locator(selector)
          : this.page.getByRole('checkbox').first();
        this.logger.info('[PlaywrightBrowserExecutor] Agent checking');
        await locator.check();
        return 'Checkbox checked';
      }

      case 'uncheck': {
        const locator = selector
          ? this.page.locator(selector)
          : this.page.getByRole('checkbox').first();
        this.logger.info('[PlaywrightBrowserExecutor] Agent unchecking');
        await locator.uncheck();
        return 'Checkbox unchecked';
      }

      default:
        this.logger.warn('[PlaywrightBrowserExecutor] Agent using default wait', { actionType });
        await this.page.waitForLoadState('networkidle');
        return 'Default action (wait) executed';
    }
  }

  /**
   * Intelligent element discovery using Playwright's accessibility locators
   * This is the "Agent" behavior - finding elements without explicit selectors
   */
  private intelligentFindElement(elementType: string, instruction: string): any {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    this.logger.debug('[PlaywrightBrowserExecutor] Agent intelligently discovering element', {
      type: elementType,
      instruction,
    });

    const textMatch = instruction.match(/['"](.*?)['"]/) ? RegExp.$1 : '';

    switch (elementType) {
      case 'button':
        if (textMatch) {
          return this.page.getByRole('button', { name: new RegExp(textMatch, 'i') });
        }
        return this.page.getByRole('button').or(
          this.page.locator('[role="button"]').or(
            this.page.locator('button, a, [onclick]').first()
          )
        );

      case 'input':
        if (textMatch) {
          // Try matching by label, placeholder, aria-label, or name
          return this.page.getByLabel(new RegExp(textMatch, 'i')).or(
            this.page.getByPlaceholder(new RegExp(textMatch, 'i')).or(
              this.page.locator(`[aria-label*="${textMatch}"], [name*="${textMatch}"]`).first()
            )
          );
        }
        // Multi-strategy fallback for finding input fields
        return this.page.getByRole('textbox').first().or(
          this.page.locator('input[type="text"], textarea, [contenteditable="true"], [role="searchbox"]').first().or(
            this.page.locator('input[type="search"]').first()
          )
        );

      case 'hoverable':
        return this.page.locator('button, a, [role="button"], [onclick]').first();

      default:
        return this.page.locator('body').first();
    }
  }

  async getPageTitle(): Promise<string> {
    try {
      await this.ensureBrowserInitialized();
      if (!this.page) return '';
      const title = await this.page.title();
      this.logger.debug('[PlaywrightBrowserExecutor] Title retrieved', { title });
      return title;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[PlaywrightBrowserExecutor] Title retrieval failed', { error: errorMessage });
      return '';
    }
  }

  async getPageContent(): Promise<string> {
    try {
      await this.ensureBrowserInitialized();
      if (!this.page) return '';
      const content = await this.page.content();
      this.logger.debug('[PlaywrightBrowserExecutor] Content retrieved', { length: content.length });
      return content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[PlaywrightBrowserExecutor] Content retrieval failed', { error: errorMessage });
      return '';
    }
  }

  async navigateTo(url: string): Promise<void> {
    try {
      await this.ensureBrowserInitialized();
      if (!this.page) throw new Error('Page not initialized');
      this.logger.info('[PlaywrightBrowserExecutor] Agent navigating', { url });
      await this.page.goto(url, { waitUntil: 'networkidle' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[PlaywrightBrowserExecutor] Navigation failed', { url, error: errorMessage });
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      this.logger.info('[PlaywrightBrowserExecutor] Closing agent...');
      if (this.page) await this.page.close();
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
      this.isInitialized = false;
      this.logger.info('[PlaywrightBrowserExecutor] Agent closed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[PlaywrightBrowserExecutor] Close failed', { error: errorMessage });
    }
  }
}
