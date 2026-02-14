// React App - No-Code UI Automation Frontend
// Using vanilla JavaScript with DOM manipulation (no JSX, no transpilation needed)
const API_BASE_URL = 'http://localhost:3001';

// Logger utility with console output
class UILogger {
  constructor() {
    this.logs = [];
    this.listeners = [];
  }

  log(message, type = 'info', data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, message, type, data };
    this.logs.push(entry);
    const prefix = `[${timestamp}] [${type.toUpperCase()}]`;
    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
    this.listeners.forEach(listener => listener(entry));
  }

  info(message, data) { this.log(message, 'info', data); }
  error(message, data) { this.log(message, 'error', data); }
  success(message, data) { this.log(message, 'success', data); }
  clear() {
    this.logs = [];
    this.listeners.forEach(listener => listener({ clear: true }));
  }
  subscribe(listener) { this.listeners.push(listener); }
  getLogs() { return this.logs; }
}

const logger = new UILogger();

// Simple state management
let appState = {
  activeTab: 'input',
  targetUrl: '',
  featureText: '',
  retryCount: 2,
  isExecuting: false,
  executionStatus: null,
  logs: [],
  screenshots: [],
  videoPath: '',
  generatedCode: '',
  stepResults: [],
  progress: 0
};

let renderListeners = [];

function setState(updates) {
  appState = { ...appState, ...updates };
  renderListeners.forEach(listener => listener());
  render();
}

function subscribeToRender(listener) {
  renderListeners.push(listener);
}

// Event handlers
async function handleExecute() {
  if (!appState.featureText.trim()) {
    logger.error('Feature text is required');
    return;
  }

  if (!appState.targetUrl.trim()) {
    logger.error('Target URL is required');
    return;
  }

  logger.clear();
  setState({
    isExecuting: true,
    executionStatus: 'running',
    screenshots: [],
    videoPath: '',
    generatedCode: '',
    stepResults: [],
    progress: 0,
    logs: []
  });

  logger.info('Starting execution', {
    targetUrl: appState.targetUrl || 'Not specified',
    steps: appState.featureText.split('\n').filter(l => l.trim()).length,
    retries: appState.retryCount,
  });

  try {
    const payload = {
      featureText: appState.featureText.trim(),
      retryCount: parseInt(appState.retryCount),
      url: appState.targetUrl.trim(),
    };

    logger.info('Sending request to backend', {
      url: `${API_BASE_URL}/execute`,
      payloadSize: JSON.stringify(payload).length,
    });

    const response = await fetch(`${API_BASE_URL}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const result = await response.json();

    logger.success('Execution completed', {
      status: result.status,
      duration: result.duration,
      stepCount: result.stepResults?.length || 0,
      artifacts: result.artifacts?.length || 0,
    });

    const screenshots = (result.artifacts || []).filter(a => a.type === 'screenshot');
    const videos = (result.artifacts || []).filter(a => a.type === 'video');

    logger.info('Artifacts retrieved', {
      screenshots: screenshots.length,
      videos: videos.length,
    });

    setState({
      executionStatus: result.status,
      stepResults: result.stepResults || [],
      generatedCode: result.generatedCode || '',
      screenshots: screenshots.map(s => ({
        filename: s.filename,
        url: `${API_BASE_URL}/artifacts/${s.path}`,
      })),
      videoPath: videos.length > 0 ? `${API_BASE_URL}/artifacts/${videos[0].path}` : '',
      progress: 100,
      isExecuting: false,
      activeTab: 'results'
    });

    if (videos.length > 0) {
      logger.success('Video ready', { file: videos[0].filename });
    }
    logger.info('Results available in Results tab');
  } catch (error) {
    logger.error('Execution failed', { message: error.message });
    setState({ executionStatus: 'failed', progress: 0, isExecuting: false });
  }
}

function handleCopyCode() {
  navigator.clipboard.writeText(appState.generatedCode);
  logger.success('Code copied to clipboard');
}

function handleClearLogs() {
  logger.clear();
}

// Subscribe to logger updates
logger.subscribe((entry) => {
  if (entry.clear) {
    setState({ logs: [] });
  } else {
    setState({ logs: [...appState.logs, entry] });
  }
});

// Render function
function render() {
  const root = document.getElementById('root');
  
  root.innerHTML = `
    <header>
      <div class="container">
        <h1>🤖 No-Code UI Automation</h1>
        <p>Execute Gherkin features with Playwright agents • Local execution • Real-time logs</p>
      </div>
    </header>

    <div class="container">
      <div class="tabs">
        <button class="tab-button ${appState.activeTab === 'input' ? 'active' : ''}" onclick="setState({activeTab: 'input'})">
          ⚙️ Input
        </button>
        <button class="tab-button ${appState.activeTab === 'progress' ? 'active' : ''}" onclick="setState({activeTab: 'progress'})">
          📋 Progress
        </button>
        <button class="tab-button ${appState.activeTab === 'results' ? 'active' : ''}" onclick="setState({activeTab: 'results'})" ${!appState.executionStatus ? 'disabled' : ''}>
          📸 Results
        </button>
        <button class="tab-button ${appState.activeTab === 'video' ? 'active' : ''}" onclick="setState({activeTab: 'video'})" ${!appState.videoPath ? 'disabled' : ''}>
          🎥 Video
        </button>
        <button class="tab-button ${appState.activeTab === 'code' ? 'active' : ''}" onclick="setState({activeTab: 'code'})" ${!appState.generatedCode ? 'disabled' : ''}>
          💻 Generated Code
        </button>
      </div>

      <!-- Input Tab -->
      <div class="tab-content ${appState.activeTab === 'input' ? 'active' : ''}">
        <div class="hint">
          💡 Backend API running at: <strong>${API_BASE_URL}</strong>
        </div>

        <div class="form-group">
          <label>Target URL <span style="color: #ff6b6b;">*</span></label>
          <input type="text" id="targetUrl" placeholder="https://www.leaftaps.com/opentaps/control/main"
            value="${appState.targetUrl}">
          <p style="font-size: 12px; color: #999; margin-top: 5px;">
            The URL on which feature steps will be executed. Required.
          </p>
        </div>

        <div class="form-group">
          <label>Feature File Content</label>
          <textarea id="featureText" placeholder="Feature: Login Test
  Scenario: User login
    Given I navigate to the application
    When I enter username as &quot;user&quot;
    And I enter password as &quot;pass&quot;
    Then I should see the dashboard">${appState.featureText}</textarea>
        </div>

        <div class="form-group">
          <label>Retry Count</label>
          <input type="number" id="retryCount" min="1" max="10" value="${appState.retryCount}">
        </div>

        <div class="button-group">
          <button class="btn-primary" onclick="handleExecute()" ${appState.isExecuting || !appState.featureText.trim() || !appState.targetUrl.trim() ? 'disabled' : ''}>
            ${appState.isExecuting ? '⏳ Executing...' : '▶️ Execute'}
          </button>
        </div>
      </div>

      <!-- Progress Tab -->
      <div class="tab-content ${appState.activeTab === 'progress' ? 'active' : ''}">
        ${appState.isExecuting ? `
          <div style="margin-bottom: 20px;">
            <p style="margin-bottom: 10px; font-weight: 600;">
              <span class="status-badge status-running">RUNNING</span>
            </p>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${appState.progress}%"></div>
            </div>
          </div>
        ` : ''}

        ${appState.executionStatus ? `
          <div style="margin-bottom: 20px;">
            <p style="margin-bottom: 10px; font-weight: 600;">
              <span class="status-badge ${appState.executionStatus === 'passed' ? 'status-passed' : 'status-failed'}">
                ${appState.executionStatus.toUpperCase()}
              </span>
            </p>
          </div>
        ` : ''}

        <div style="margin-bottom: 15px;">
          <button class="btn-secondary" onclick="handleClearLogs()">Clear Logs</button>
        </div>

        <div class="log-container">
          ${appState.logs.length === 0 ? 
            '<div style="color: #999; font-style: italic;">No logs yet. Execute a feature to see logs here.</div>' :
            appState.logs.map((log, idx) => `
              <div class="log-entry ${log.type}">
                <span style="color: #888;">[${log.timestamp}]</span>
                <span style="color: #668;">[${log.type.toUpperCase()}]</span>
                ${log.message}
                ${log.data ? `<span style="color: #999; font-size: 11px;"> ${JSON.stringify(log.data)}</span>` : ''}
              </div>
            `).join('')
          }
          <div id="logs-end"></div>
        </div>
      </div>

      <!-- Results Tab -->
      <div class="tab-content ${appState.activeTab === 'results' ? 'active' : ''}">
        ${!appState.executionStatus ? `
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <h3>No execution yet</h3>
            <p>Execute a feature in the Input tab to see results here.</p>
          </div>
        ` : `
          <h2 style="margin-bottom: 20px; font-size: 20px;">
            Execution Results
            <span class="status-badge ${appState.executionStatus === 'passed' ? 'status-passed' : 'status-failed'}" style="margin-left: 15px;">
              ${appState.executionStatus.toUpperCase()}
            </span>
          </h2>

          ${appState.stepResults.length > 0 ? `
            <h3 style="margin-bottom: 15px; font-size: 16px;">Step Results & Screenshots</h3>
            <div class="steps-list">
              ${appState.stepResults.map((step, idx) => {
                const stepScreenshots = appState.screenshots.filter(ss => 
                  ss.filename.includes('step-' + (idx + 1))
                );
                return `
                <div class="step-item ${step.status}">
                  <div class="step-description">Step ${idx + 1}: ${step.description}</div>
                  <div class="step-meta">Status: <strong>${step.status.toUpperCase()}</strong> • Duration: ${step.duration}ms</div>
                  ${step.errorMessage ? `<div class="step-error" style="margin-top: 8px; padding: 8px; background-color: #fee; border-left: 3px solid #f66; color: #c33; font-size: 13px; border-radius: 2px;"><strong>Error:</strong> ${step.errorMessage}</div>` : ''}
                  
                  ${stepScreenshots.length > 0 ? `
                    <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(0,0,0,0.1);">
                      <div style="margin-bottom: 8px; font-size: 12px; font-weight: 600; color: #666;">Screenshot:</div>
                      <div class="step-screenshots">
                        ${stepScreenshots.map(ss => `
                          <div class="step-screenshot-container">
                            <img src="${ss.url}" alt="Step ${idx + 1} Screenshot" style="max-width: 100%; border-radius: 4px; cursor: pointer;" onclick="this.style.maxWidth = this.style.maxWidth === '100%' ? 'none' : '100%';">
                          </div>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>
                `;
              }).join('')}
            </div>
          ` : ''}

          ${appState.screenshots.length > 0 ? `
            <h3 style="margin-bottom: 15px; margin-top: 30px; font-size: 16px;">
              All Screenshots (${appState.screenshots.length})
            </h3>
            <div class="screenshots-grid">
              ${appState.screenshots.map((ss, idx) => `
                <div class="screenshot-card">
                  <img src="${ss.url}" alt="Screenshot ${idx + 1}">
                  <div class="screenshot-label">${ss.filename}</div>
                </div>
              `).join('')}
            </div>
          ` : '<p style="color: #999; margin-top: 20px;">No screenshots captured.</p>'}
        `}
      </div>

      <!-- Video Tab -->
      <div class="tab-content ${appState.activeTab === 'video' ? 'active' : ''}">
        ${!appState.videoPath ? `
          <div class="empty-state">
            <div class="empty-state-icon">🎬</div>
            <h3>No video available</h3>
            <p>Execute a feature to record a video.</p>
          </div>
        ` : `
          <h2 style="margin-bottom: 20px; font-size: 20px;">Execution Video</h2>
          <div class="video-container">
            <video controls>
              <source src="${appState.videoPath}" type="video/webm">
              Your browser does not support the video tag.
            </video>
          </div>
          <p style="color: #666; font-size: 12px;">Video: ${appState.videoPath}</p>
        `}
      </div>

      <!-- Generated Code Tab -->
      <div class="tab-content ${appState.activeTab === 'code' ? 'active' : ''}">
        ${!appState.generatedCode ? `
          <div class="empty-state">
            <div class="empty-state-icon">📄</div>
            <h3>No code generated yet</h3>
            <p>Execute a feature to generate Playwright code.</p>
          </div>
        ` : `
          <h2 style="margin-bottom: 20px; font-size: 20px;">Generated Playwright Code</h2>
          <button class="copy-button" onclick="handleCopyCode()">📋 Copy to Clipboard</button>
          <pre style="background-color: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 5px; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 13px; line-height: 1.5;"><code style="color: #d4d4d4;">${appState.generatedCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>
        `}
      </div>
    </div>
  `;

  // Attach event listeners after rendering
  const targetUrlInput = document.getElementById('targetUrl');
  const featureTextInput = document.getElementById('featureText');
  const retryCountInput = document.getElementById('retryCount');

  if (targetUrlInput) {
    targetUrlInput.addEventListener('change', (e) => {
      setState({targetUrl: e.target.value});
      logger.info('Target URL updated', {url: e.target.value || 'cleared'});
    });
  }

  if (featureTextInput) {
    featureTextInput.addEventListener('change', (e) => {
      setState({featureText: e.target.value});
      logger.info('Feature text updated', {lines: e.target.value.split('\n').length});
    });
  }

  if (retryCountInput) {
    retryCountInput.addEventListener('change', (e) => {
      setState({retryCount: e.target.value});
      logger.info('Retry count updated', {count: e.target.value});
    });
  }

  // Scroll to bottom of logs
  setTimeout(() => {
    const logsEnd = document.getElementById('logs-end');
    if (logsEnd) {
      logsEnd.scrollIntoView({ behavior: 'smooth' });
    }
  }, 0);
}

// Initial render when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM ready, rendering app');
    render();
  });
} else {
  render();
}

console.log('✅ No-Code UI Automation Frontend loaded');
