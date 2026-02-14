// React App - No-Code UI Automation Frontend
const { useState, useEffect, useRef } = React;

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

    // Console output
    const prefix = `[${timestamp}] [${type.toUpperCase()}]`;
    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }

    this.listeners.forEach(listener => listener(entry));
  }

  info(message, data) {
    this.log(message, 'info', data);
  }

  error(message, data) {
    this.log(message, 'error', data);
  }

  success(message, data) {
    this.log(message, 'success', data);
  }

  clear() {
    this.logs = [];
    this.listeners.forEach(listener => listener({ clear: true }));
  }

  subscribe(listener) {
    this.listeners.push(listener);
  }

  getLogs() {
    return this.logs;
  }
}

const logger = new UILogger();

function NoCodeAutomationApp() {
  const [activeTab, setActiveTab] = useState('input');
  const [targetUrl, setTargetUrl] = useState('');
  const [featureText, setFeatureText] = useState('');
  const [retryCount, setRetryCount] = useState(2);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionStatus, setExecutionStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [screenshots, setScreenshots] = useState([]);
  const [videoPath, setVideoPath] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [stepResults, setStepResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const logsEndRef = useRef(null);

  useEffect(() => {
    logger.info('App initialized', { version: '1.0.0' });
    
    logger.subscribe((entry) => {
      setLogs(prevLogs => [...prevLogs, entry]);
      setTimeout(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 0);
    });
  }, []);

  const handleExecute = async () => {
    if (!featureText.trim()) {
      logger.error('Feature text is required');
      return;
    }

    if (!targetUrl.trim()) {
      logger.error('Target URL is required');
      return;
    }

    logger.clear();
    setIsExecuting(true);
    setExecutionStatus('running');
    setScreenshots([]);
    setVideoPath('');
    setGeneratedCode('');
    setStepResults([]);
    setProgress(0);

    logger.info('Starting execution', {
      targetUrl: targetUrl || 'Not specified',
      steps: featureText.split('\n').filter(l => l.trim()).length,
      retries: retryCount,
    });

    try {
      const payload = {
        featureText: featureText.trim(),
        retryCount: parseInt(retryCount),
        url: targetUrl.trim(),
      };

      logger.info('Sending request to /execute API', { payloadSize: JSON.stringify(payload).length });

      const response = await fetch('/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      logger.success('Execution completed', {
        status: result.status,
        duration: result.duration,
        stepCount: result.stepResults?.length || 0,
        artifacts: result.artifacts?.length || 0,
      });

      setExecutionStatus(result.status);
      setStepResults(result.stepResults || []);
      setGeneratedCode(result.generatedCode || '');

      // Process artifacts
      if (result.artifacts && Array.isArray(result.artifacts)) {
        const screenshots = result.artifacts.filter(a => a.type === 'screenshot');
        const videos = result.artifacts.filter(a => a.type === 'video');

        logger.info('Artifacts retrieved', {
          screenshots: screenshots.length,
          videos: videos.length,
        });

        setScreenshots(
          screenshots.map(s => ({
            filename: s.filename,
            url: `/artifacts/${s.filename}`,
          }))
        );

        if (videos.length > 0) {
          setVideoPath(`/artifacts/${videos[0].filename}`);
          logger.success('Video ready', { file: videos[0].filename });
        }
      }

      setProgress(100);
      setActiveTab('results');

      logger.info('Results available in Results tab');
    } catch (error) {
      logger.error('Execution failed', { message: error.message });
      setExecutionStatus('failed');
      setProgress(0);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    logger.success('Code copied to clipboard');
  };

  const handleClearLogs = () => {
    logger.clear();
    setLogs([]);
  };

  return (
    <div>
      <header>
        <div className="container">
          <h1>🤖 No-Code UI Automation</h1>
          <p>Execute Gherkin features with Playwright agents • Local execution • Real-time logs</p>
        </div>
      </header>

      <div className="container">
        <div className="tabs">
          <button
            className={`tab-button ${activeTab === 'input' ? 'active' : ''}`}
            onClick={() => setActiveTab('input')}
          >
            ⚙️ Input
          </button>
          <button
            className={`tab-button ${activeTab === 'progress' ? 'active' : ''}`}
            onClick={() => setActiveTab('progress')}
          >
            📋 Progress
          </button>
          <button
            className={`tab-button ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
            disabled={!executionStatus}
          >
            📸 Results
          </button>
          <button
            className={`tab-button ${activeTab === 'video' ? 'active' : ''}`}
            onClick={() => setActiveTab('video')}
            disabled={!videoPath}
          >
            🎥 Video
          </button>
          <button
            className={`tab-button ${activeTab === 'code' ? 'active' : ''}`}
            onClick={() => setActiveTab('code')}
            disabled={!generatedCode}
          >
            💻 Generated Code
          </button>
        </div>

        {/* Input Tab */}
        <div className={`tab-content ${activeTab === 'input' ? 'active' : ''}`}>
          <div className="form-group">
            <label>Target URL <span style={{ color: '#ff6b6b' }}>*</span></label>
            <input
              type="text"
              placeholder="https://www.leaftaps.com/opentaps/control/main"
              value={targetUrl}
              onChange={e => {
                setTargetUrl(e.target.value);
                logger.info('Target URL updated', { url: e.target.value || 'cleared' });
              }}
              required
            />
            <p style={{ fontSize: '12px', color: '#999', marginTop: '5px' }}>
              The URL on which feature steps will be executed. Required.
            </p>
          </div>

          <div className="form-group">
            <label>Feature File Content</label>
            <textarea
              placeholder={`Feature: Login Test
  Scenario: User login
    Given I navigate to the application
    When I enter username as "user"
    And I enter password as "pass"
    Then I should see the dashboard`}
              value={featureText}
              onChange={e => {
                setFeatureText(e.target.value);
                logger.info('Feature text updated', { lines: e.target.value.split('\n').length });
              }}
            />
          </div>

          <div className="form-group">
            <label>Retry Count</label>
            <input
              type="number"
              min="1"
              max="10"
              value={retryCount}
              onChange={e => {
                setRetryCount(e.target.value);
                logger.info('Retry count updated', { count: e.target.value });
              }}
            />
          </div>

          <div className="button-group">
            <button
              className="btn-primary"
              onClick={handleExecute}
              disabled={isExecuting || !featureText.trim() || !targetUrl.trim()}
            >
              {isExecuting ? '⏳ Executing...' : '▶️ Execute'}
            </button>
          </div>
        </div>

        {/* Progress Tab */}
        <div className={`tab-content ${activeTab === 'progress' ? 'active' : ''}`}>
          {isExecuting && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ marginBottom: '10px', fontWeight: 600 }}>
                <span className="status-badge status-running">RUNNING</span>
              </p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progress}%` }}></div>
              </div>
            </div>
          )}

          {executionStatus && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ marginBottom: '10px', fontWeight: 600 }}>
                <span
                  className={`status-badge ${executionStatus === 'passed' ? 'status-passed' : 'status-failed'}`}
                >
                  {executionStatus.toUpperCase()}
                </span>
              </p>
            </div>
          )}

          <div style={{ marginBottom: '15px' }}>
            <button className="btn-secondary" onClick={handleClearLogs}>
              Clear Logs
            </button>
          </div>

          <div className="log-container">
            {logs.length === 0 ? (
              <div style={{ color: '#999', fontStyle: 'italic' }}>No logs yet. Execute a feature to see logs here.</div>
            ) : (
              logs.map((log, idx) => (
                <div key={idx} className={`log-entry ${log.type}`}>
                  <span style={{ color: '#888' }}>[{log.timestamp}]</span>{' '}
                  <span style={{ color: '#668' }}>
                    [{log.type.toUpperCase()}]
                  </span>{' '}
                  {log.message}
                  {log.data && (
                    <span style={{ color: '#999', fontSize: '11px' }}>
                      {' '}
                      {JSON.stringify(log.data)}
                    </span>
                  )}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Results Tab */}
        <div className={`tab-content ${activeTab === 'results' ? 'active' : ''}`}>
          {!executionStatus ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <h3>No execution yet</h3>
              <p>Execute a feature in the Input tab to see results here.</p>
            </div>
          ) : (
            <>
              <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>
                Execution Results
                <span
                  className={`status-badge ${executionStatus === 'passed' ? 'status-passed' : 'status-failed'}`}
                  style={{ marginLeft: '15px' }}
                >
                  {executionStatus.toUpperCase()}
                </span>
              </h2>

              {stepResults.length > 0 && (
                <>
                  <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>Step Results</h3>
                  <div className="steps-list">
                    {stepResults.map((step, idx) => (
                      <div key={idx} className={`step-item ${step.status}`}>
                        <div className="step-description">
                          Step {idx + 1}: {step.description}
                        </div>
                        <div className="step-meta">
                          Status: <strong>{step.status.toUpperCase()}</strong> • Duration: {step.duration}ms
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {screenshots.length > 0 && (
                <>
                  <h3 style={{ marginBottom: '15px', marginTop: '30px', fontSize: '16px' }}>
                    Screenshots ({screenshots.length})
                  </h3>
                  <div className="screenshots-grid">
                    {screenshots.map((ss, idx) => (
                      <div key={idx} className="screenshot-card">
                        <img src={ss.url} alt={`Screenshot ${idx + 1}`} />
                        <div className="screenshot-label">Step {idx + 1} - {ss.filename}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {screenshots.length === 0 && (
                <p style={{ color: '#999', marginTop: '20px' }}>No screenshots captured.</p>
              )}
            </>
          )}
        </div>

        {/* Video Tab */}
        <div className={`tab-content ${activeTab === 'video' ? 'active' : ''}`}>
          {!videoPath ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎬</div>
              <h3>No video available</h3>
              <p>Execute a feature to record a video.</p>
            </div>
          ) : (
            <>
              <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>Execution Video</h2>
              <div className="video-container">
                <video controls>
                  <source src={videoPath} type="video/webm" />
                  Your browser does not support the video tag.
                </video>
              </div>
              <p style={{ color: '#666', fontSize: '12px' }}>
                Video: {videoPath}
              </p>
            </>
          )}
        </div>

        {/* Generated Code Tab */}
        <div className={`tab-content ${activeTab === 'code' ? 'active' : ''}`}>
          {!generatedCode ? (
            <div className="empty-state">
              <div className="empty-state-icon">📄</div>
              <h3>No code generated yet</h3>
              <p>Execute a feature to generate Playwright code.</p>
            </div>
          ) : (
            <>
              <h2 style={{ marginBottom: '20px', fontSize: '20px' }}>Generated Playwright Code</h2>
              <button className="copy-button" onClick={handleCopyCode}>
                📋 Copy to Clipboard
              </button>
              <div className="code-block">
                <code>{generatedCode}</code>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Render React App
ReactDOM.createRoot(document.getElementById('root')).render(<NoCodeAutomationApp />);

console.log('🚀 No-Code UI Automation Frontend loaded');
