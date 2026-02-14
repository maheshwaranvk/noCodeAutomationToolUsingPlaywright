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
  // Promise used to serialize initialization to avoid concurrent launches
  private initializing: Promise<void> | null = null;

  constructor(private logger: LoggerPort) {
    this.logger.info('[PlaywrightBrowserExecutor] Playwright Agent initialized');
  }

  private isBrowserStillValid(): boolean {
    // Check if browser is connected
    if (!this.browser || !this.browser.isConnected()) {
      this.logger.debug('[PlaywrightBrowserExecutor] Browser not connected or missing');
      return false;
    }

    // Check if context still exists
    if (!this.context) {
      this.logger.debug('[PlaywrightBrowserExecutor] Context missing');
      return false;
    }

    // Check if page still exists (may have been closed by user)
    if (!this.page) {
      this.logger.debug('[PlaywrightBrowserExecutor] Page missing');
      return false;
    }

    // Try to check if page is still accessible (user might have closed it)
    try {
      // A quick check - if page is closed, this will throw or return false
      const pageUrl = this.page.url();
      if (!pageUrl) {
        this.logger.debug('[PlaywrightBrowserExecutor] Page URL not accessible');
        return false;
      }
    } catch (e) {
      this.logger.debug('[PlaywrightBrowserExecutor] Page validation failed', {
        error: e instanceof Error ? e.message : String(e),
      });
      return false;
    }

    return true;
  }

  private async ensureBrowserInitialized(): Promise<void> {
    // Quick check: if everything looks good, return immediately
    if (this.isInitialized && this.isBrowserStillValid()) {
      this.logger.debug('[PlaywrightBrowserExecutor] Browser already initialized and valid');
      return;
    }

    // If another call is already initializing the browser, wait for it.
    if (this.initializing) {
      this.logger.debug('[PlaywrightBrowserExecutor] Waiting for concurrent initialization');
      await this.initializing;
      // After waiting, re-check validity
      if (this.isInitialized && this.isBrowserStillValid()) {
        return;
      }
    }

    // Serialize initialization so concurrent calls don't launch multiple browsers
    this.initializing = (async () => {
      this.logger.info('[PlaywrightBrowserExecutor] Launching Playwright Agent...');

      try {
        // Clean up any dead resources
        try {
          if (this.page) {
            this.logger.debug('[PlaywrightBrowserExecutor] Closing existing page');
            await this.page.close().catch(() => {});
            this.page = null;
          }
          if (this.context) {
            this.logger.debug('[PlaywrightBrowserExecutor] Closing existing context');
            await this.context.close().catch(() => {});
            this.context = null;
          }
          if (this.browser) {
            this.logger.debug('[PlaywrightBrowserExecutor] Closing existing browser');
            await this.browser.close().catch(() => {});
            this.browser = null;
          }
          
          // Give cleanup time to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (cleanupError) {
          this.logger.warn('[PlaywrightBrowserExecutor] Error during cleanup', {
            error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
          });
        }

        const launchOptions: any = {
          headless: process.env.HEADLESS !== 'false',
        };

        // Allow using the system Chrome via PLAYWRIGHT_CHANNEL or CHROME_PATH
        const channel = process.env.PLAYWRIGHT_CHANNEL; // e.g. 'chrome'
        const exe = process.env.CHROME_PATH; // full path to chrome executable
        if (channel) {
          launchOptions.channel = channel;
          this.logger.info('[PlaywrightBrowserExecutor] Launching browser with channel', { channel });
        } else if (exe) {
          launchOptions.executablePath = exe;
          this.logger.info('[PlaywrightBrowserExecutor] Launching browser with executablePath', { exe });
        } else {
          this.logger.info('[PlaywrightBrowserExecutor] Launching Playwright-managed Chromium');
        }

        this.browser = await chromium.launch(launchOptions);
        this.logger.info('[PlaywrightBrowserExecutor] Chromium browser launched successfully', {
          isConnected: this.browser.isConnected(),
        });

        // Enable video recording for the context (recorded per execution)
        const videoPath = process.env.ARTIFACT_PATH || './artifacts';
        this.logger.debug('[PlaywrightBrowserExecutor] Creating context with video recording', { videoPath });
        
        try {
          // Only record video if explicitly enabled
          const shouldRecordVideo = process.env.RECORD_VIDEO === 'true';
          if (shouldRecordVideo) {
            this.context = await this.browser.newContext({
              recordVideo: { dir: videoPath },
            });
            this.logger.info('[PlaywrightBrowserExecutor] Browser context created with video recording', { videoPath });
          } else {
            this.context = await this.browser.newContext();
            this.logger.info('[PlaywrightBrowserExecutor] Browser context created without video recording');
          }
        } catch (contextError) {
          this.logger.warn('[PlaywrightBrowserExecutor] Failed to create context with video, retrying without video', {
            error: contextError instanceof Error ? contextError.message : String(contextError),
          });
          // Fallback: create context without video recording
          this.context = await this.browser.newContext();
          this.logger.info('[PlaywrightBrowserExecutor] Browser context created without video recording');
        }

        this.page = await this.context.newPage();
        this.logger.info('[PlaywrightBrowserExecutor] Playwright Agent ready', {
          browserConnected: this.browser.isConnected(),
          pageCreated: !!this.page,
        });

        this.isInitialized = true;
      } catch (error) {
        this.isInitialized = false;
        this.page = null;
        this.context = null;
        this.browser = null;
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error('[PlaywrightBrowserExecutor] Failed to launch agent', {
          error: errorMessage,
          stack: error instanceof Error ? error.stack : 'no stack',
        });
        throw error;
      }
    })();

    try {
      await this.initializing;
    } finally {
      this.initializing = null;
    }
  }

  /**
   * Execute action using Playwright's Agent-based approach
   * Leverages intelligent element discovery via accessibility roles and auto-waiting
   */
  async execute(request: BrowserExecutionRequest): Promise<BrowserExecutionResponse> {
    let screenshot = '';
    const startTime = Date.now();
    let message = '';
    let actionError: Error | null = null;

    // Check if this is a navigate action - if so, close and reinitialize browser for fresh state
    const isNavigateStep = request.actionType === 'navigate';
    if (isNavigateStep) {
      this.logger.debug('[PlaywrightBrowserExecutor] Navigate step detected, closing old browser instance for fresh state');
      try {
        if (this.page) await this.page.close().catch(() => {});
        if (this.context) await this.context.close().catch(() => {});
        if (this.browser) await this.browser.close().catch(() => {});
        this.page = null;
        this.context = null;
        this.browser = null;
        this.isInitialized = false;
        this.initializing = null;
        this.logger.debug('[PlaywrightBrowserExecutor] Old browser instance closed');
      } catch (closeError) {
        this.logger.warn('[PlaywrightBrowserExecutor] Error closing old browser', {
          error: closeError instanceof Error ? closeError.message : String(closeError),
        });
      }
    }

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

      // Execute using Playwright's intelligent agent capabilities
      try {
        message = await this.agentExecuteAction(
          request.actionType,
          request.elementSelector,
          request.actionValue,
          request.step.description
        );
      } catch (error) {
        // Capture error but don't throw yet - we want to capture screenshot first
        actionError = error instanceof Error ? error : new Error(String(error));
      }

      // Capture visual result regardless of success or failure
      try {
        if (this.page && this.browser && this.browser.isConnected()) {
          const screenshotBuffer = await this.page.screenshot({ fullPage: false });
          screenshot = screenshotBuffer.toString('base64');
          this.logger.debug('[PlaywrightBrowserExecutor] Screenshot captured', {
            stepId: request.step.id,
            hasError: !!actionError,
          });
        } else {
          this.logger.warn('[PlaywrightBrowserExecutor] Cannot capture screenshot - page/browser not available', {
            stepId: request.step.id,
            pageExists: !!this.page,
            browserConnected: this.browser?.isConnected(),
          });
        }
      } catch (screenshotError) {
        this.logger.warn('[PlaywrightBrowserExecutor] Screenshot capture failed', {
          stepId: request.step.id,
          error: screenshotError instanceof Error ? screenshotError.message : String(screenshotError),
        });
      }

      const duration = Date.now() - startTime;

      // If there was an action error, throw it now after screenshot is captured
      if (actionError) {
        this.logger.error('[PlaywrightBrowserExecutor] Agent action failed', {
          stepId: request.step.id,
          error: actionError.message,
          duration: `${duration}ms`,
          screenshotCaptured: !!screenshot,
        });
        throw actionError;
      }

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
      const duration = Date.now() - startTime;
      
      this.logger.error('[PlaywrightBrowserExecutor] Agent execution failed', {
        stepId: request.step.id,
        error: errorMessage,
        duration: `${duration}ms`,
        screenshotCaptured: !!screenshot,
      });
      
      // Attach screenshot to error for downstream handling
      const err = error as any;
      err.screenshot = screenshot;
      throw err;
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
        let url = (actionValue || selector || '').trim();

        // If AI did not provide a URL, try environment mappings or heuristics
        if (!url) {
          const envUrl = process.env.LEAFTAPS_URL || process.env.APP_BASE_URL || '';
          if (envUrl) {
            url = envUrl;
            this.logger.info('[PlaywrightBrowserExecutor] Inferred navigate URL from env', { urlSource: 'env', url });
          } else if (/leaftaps/i.test(instruction)) {
            // Best-effort default for Leaftaps when user did not supply a URL
            url = 'https://www.leaftaps.com';
            this.logger.info('[PlaywrightBrowserExecutor] Inferring Leaftaps URL as fallback', { url });
          } else {
            // No URL available — log and navigate to about:blank to keep behavior predictable
            url = 'about:blank';
            this.logger.warn('[PlaywrightBrowserExecutor] No URL provided or inferred; navigating to about:blank', { instruction });
          }
        }

        this.logger.info('[PlaywrightBrowserExecutor] Agent navigating', { url });
        
        try {
          // Double-check page is valid before navigation
          if (!this.page) {
            throw new Error('Page is null before navigation');
          }
          
          this.logger.debug('[PlaywrightBrowserExecutor] Page state before goto', {
            pageExists: !!this.page,
            contextExists: !!this.context,
            browserConnected: this.browser?.isConnected(),
          });
          
          await this.page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
          
          this.logger.info('[PlaywrightBrowserExecutor] Navigation completed', { 
            url,
            pageTitle: await this.page.title(),
          });
          return `Navigated to ${url}`;
        } catch (navError) {
          const errorMsg = navError instanceof Error ? navError.message : String(navError);
          this.logger.error('[PlaywrightBrowserExecutor] Navigation failed', {
            url,
            error: errorMsg,
            pageExists: !!this.page,
            contextExists: !!this.context,
            browserConnected: this.browser?.isConnected(),
          });
          throw navError;
        }
      }

      case 'click': {
        this.logger.info('[PlaywrightBrowserExecutor] Agent clicking', { instruction, selector: selector || 'auto-detect' });
        
        // Ensure page is stable before clicking
        try {
          await this.page.waitForLoadState('networkidle');
          this.logger.debug('[PlaywrightBrowserExecutor] Page reached networkidle before click');
        } catch (e) {
          this.logger.warn('[PlaywrightBrowserExecutor] Page networkidle timeout before click, continuing');
        }

        // Give the page a moment to settle
        await this.page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));

        let lastError: Error | null = null;
        const clickStrategies = [
          // Strategy 1: Use provided selector if available
          ...(selector ? [{ name: 'provided-selector', locator: () => this.page!.locator(selector) }] : []),
          // Strategy 2: Try finding by text match from instruction
          { name: 'text-match-button', locator: () => {
            const textMatch = instruction.match(/['"](.*?)['"]/) ? RegExp.$1 : 
                            instruction.match(/(?:click|press|hit)\s+(?:the\s+)?([^,\.\?]+)/i) ? RegExp.$1 : '';
            return textMatch 
              ? this.page!.getByRole('button', { name: new RegExp(textMatch.trim(), 'i') })
              : this.page!.getByRole('button').first();
          }},
          // Strategy 3: Use intelligent element discovery
          { name: 'intelligent-discover', locator: () => this.intelligentFindElement('button', instruction) },
          // Strategy 4: Fallback to any clickable element
          { name: 'any-clickable', locator: () => this.page!.locator('button, a, [role="button"], [onclick]').first() },
        ];

        for (const strategy of clickStrategies) {
          try {
            this.logger.debug('[PlaywrightBrowserExecutor] Trying click strategy', { strategy: strategy.name });
            const locator = strategy.locator();
            
            // Check if element exists
            const count = await locator.count();
            if (count === 0) {
              this.logger.debug('[PlaywrightBrowserExecutor] Strategy found 0 elements', { strategy: strategy.name });
              lastError = new Error(`No elements found with ${strategy.name}`);
              continue;
            }

            this.logger.debug('[PlaywrightBrowserExecutor] Found element(s)', { strategy: strategy.name, count });
            
            // Scroll into view and click
            await locator.first().scrollIntoViewIfNeeded({ timeout: 3000 });
            await locator.first().click({ timeout: 5000 });
            
            this.logger.info('[PlaywrightBrowserExecutor] Successfully clicked', { strategy: strategy.name, instruction });
            return `Clicked element for: ${instruction}`;
          } catch (e) {
            lastError = e instanceof Error ? e : new Error(String(e));
            this.logger.debug('[PlaywrightBrowserExecutor] Click strategy failed', { 
              strategy: strategy.name, 
              error: lastError.message 
            });
            // Continue to next strategy
          }
        }

        // All strategies exhausted
        this.logger.error('[PlaywrightBrowserExecutor] All click strategies exhausted', { 
          instruction,
          lastError: lastError?.message
        });
        throw new Error(`Failed to click element. Instruction: "${instruction}". Error: ${lastError?.message || 'unknown'}`);
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

            // Check if element is visible (important for forms with multiple hidden fields)
            const isVisible = await locator.isVisible().catch(() => false);
            if (!isVisible) {
              this.logger.debug('[PlaywrightBrowserExecutor] Found element but it is not visible, skipping', { sel });
              lastError = new Error(`Element found but not visible: ${sel}`);
              continue;
            }

            this.logger.debug('[PlaywrightBrowserExecutor] Found visible input element', { sel, count });
            
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
          // Filter for visible elements to avoid hidden forms
          const byLabel = this.page.getByLabel(new RegExp(textMatch, 'i'));
          const byPlaceholder = this.page.getByPlaceholder(new RegExp(textMatch, 'i'));
          const byNameOrAriaLabel = this.page.locator(`[aria-label*="${textMatch}"], [name*="${textMatch}"]`);
          
          // Combine and filter for visible elements
          return byLabel.or(byPlaceholder).or(
            byNameOrAriaLabel.filter({ has: this.page.locator('body') })
          );
        }
        // Multi-strategy fallback for finding input fields - filter for visible ones
        const textboxes = this.page.getByRole('textbox');
        const textInputs = this.page.locator('input[type="text"], textarea, [contenteditable="true"], [role="searchbox"]');
        const searchInputs = this.page.locator('input[type="search"]');
        
        // Create a combined locator that will prefer visible elements
        return textboxes.or(textInputs).or(searchInputs);

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

  async getVideoPath(): Promise<string | null> {
    try {
      if (!this.page || !this.context) {
        this.logger.debug('[PlaywrightBrowserExecutor] No page or context available for video');
        return null;
      }
      // Try to get the video path - it's recorded during the context lifetime
      const video = this.page.video();
      if (!video) {
        this.logger.debug('[PlaywrightBrowserExecutor] No video object available');
        return null;
      }
      const videoPath = await video.path();
      if (videoPath) {
        this.logger.info('[PlaywrightBrowserExecutor] Video path retrieved', { videoPath });
        return videoPath;
      }
      return null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn('[PlaywrightBrowserExecutor] Failed to get video path', { error: errorMessage });
      return null;
    }
  }

  async close(): Promise<void> {
    let videoPath: string | null = null;
    try {
      this.logger.info('[PlaywrightBrowserExecutor] Closing agent...');
      
      // Try to capture video path before closing
      if (this.page && this.page.video()) {
        try {
          const pathResult = await this.page.video()?.path();
          videoPath = pathResult || null;
          if (videoPath) {
            this.logger.info('[PlaywrightBrowserExecutor] Video captured at path', { videoPath });
          }
        } catch (e) {
          this.logger.debug('[PlaywrightBrowserExecutor] Could not capture video path', { error: e instanceof Error ? e.message : String(e) });
        }
      }
      
      if (this.page) {
        try {
          await this.page.close().catch(() => {});
        } catch (e) {
          this.logger.debug('[PlaywrightBrowserExecutor] Error closing page', { error: e instanceof Error ? e.message : String(e) });
        }
        this.page = null;
      }
      if (this.context) {
        try {
          await this.context.close().catch(() => {});
        } catch (e) {
          this.logger.debug('[PlaywrightBrowserExecutor] Error closing context', { error: e instanceof Error ? e.message : String(e) });
        }
        this.context = null;
      }
      if (this.browser) {
        try {
          await this.browser.close().catch(() => {});
        } catch (e) {
          this.logger.debug('[PlaywrightBrowserExecutor] Error closing browser', { error: e instanceof Error ? e.message : String(e) });
        }
        this.browser = null;
      }
      this.isInitialized = false;
      this.initializing = null;
      this.logger.info('[PlaywrightBrowserExecutor] Agent closed and state reset', { videoPath });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('[PlaywrightBrowserExecutor] Close failed', { error: errorMessage });
      // Force reset state even if close fails
      this.isInitialized = false;
      this.initializing = null;
      this.page = null;
      this.context = null;
      this.browser = null;
    }
  }
}
