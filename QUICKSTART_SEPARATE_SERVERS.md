# 🤖 No-Code UI Automation

Run Gherkin feature files with AI-powered Playwright agents. Frontend and backend run independently.

## Architecture

```
Frontend (React)        Backend (Node.js)       Browser (Playwright)
Port 3000              Port 3001               Chrome/Chromium
http-server            Express API             
├─ UI Tabs             ├─ /execute             ├─ Video Recording
├─ Form Input          ├─ /artifacts           ├─ Screenshots
└─ Log Display         └─ Logging              └─ Agent Execution
```

## Quick Start

### 1. Backend Setup & Start

```bash
# Install backend dependencies (from root)
npm install

# Build TypeScript
npm run build

# Start backend server (port 3001)
npm start
```

The backend API will be available at `http://localhost:3001`

Check health: `curl http://localhost:3001/health`

### 2. Frontend Setup & Start (Separate Terminal)

```bash
# Navigate to frontend folder
cd frontend

# Install frontend dependencies
npm install

# Start frontend server (port 3000)
npm start
```

The frontend UI will be available at `http://localhost:3000`

### 3. Open in Browser

Visit **http://localhost:3000** in your browser

## Features

### Input Tab
- Enter target URL (optional - will auto-detect from feature)
- Paste Gherkin feature text
- Set retry count (1-10)
- Click Execute

### Progress Tab
- Real-time execution logs with timestamps
- Step-by-step progress tracking
- Status indicator (RUNNING, PASSED, FAILED)

### Results Tab
- Step-by-step execution results
- Grid view of screenshots from each step
- Execution status and timings

### Video Tab
- Full browser recording of execution
- WebM format, playable inline
- Auto-recorded for every run

### Generated Code Tab
- Playwright/TypeScript code equivalent
- Copy to clipboard button
- Can be used for CI/CD pipelines

## Environment Variables

Create a `.env` file in the root directory:

```env
# App Configuration
PORT=3001
NODE_ENV=development

# Playwright
HEADLESS=false                           # Set to true to hide browser

# Target Application
LEAFTAPS_URL=https://www.leaftaps.com/opentaps/control/main
APP_BASE_URL=https://www.leaftaps.com

# AI Model
GROQ_API_KEY=your_groq_key_here

# Logging
LOG_LEVEL=info

# Artifacts
ARTIFACT_PATH=./artifacts
```

## API Endpoints

### POST /execute
Execute a Gherkin feature

**Request:**
```json
{
  "featureText": "Feature: Login\n  Scenario: ...",
  "retryCount": 2,
  "targetUrl": "https://www.example.com"
}
```

**Response:**
```json
{
  "status": "passed|failed",
  "duration": 5000,
  "stepResults": [
    {
      "description": "I click the login button",
      "status": "passed|failed|skipped",
      "duration": 100
    }
  ],
  "artifacts": [
    {
      "type": "screenshot|video",
      "filename": "screenshot-1.png"
    }
  ],
  "generatedCode": "const { test, expect } = require('@playwright/test');"
}
```

### GET /artifacts/:filename
Retrieve captured screenshots or video

### GET /health
Health check endpoint

## File Structure

```
.
├── src/
│   ├── index.ts                 # Backend entry point
│   ├── adapters/                # Inbound/outbound adapters
│   ├── application/             # Use cases & DTOs
│   ├── domain/                  # Core business logic
│   └── infrastructure/          # Express server, logging
│
├── frontend/                    # Separate frontend package
│   ├── package.json             # Frontend dependencies (http-server)
│   ├── public/
│   │   ├── index.html           # React app HTML
│   │   └── app.js               # React components
│   └── README.md
│
├── artifacts/                   # Generated screenshots/videos
├── dist/                        # Compiled JavaScript (after npm run build)
├── package.json                 # Backend dependencies
├── tsconfig.json
└── README.md (this file)
```

## Troubleshooting

### Frontend Blank Page
- Verify backend is running: `curl http://localhost:3001/health`
- Check browser console (F12) for errors
- Ensure `frontend/public/app.js` exists
- Restart http-server: `cd frontend && npm start`

### Multiple Browser Windows Opening
- This is fixed in current version via serialized initialization
- Check backend logs for "Chromium browser launched" (should appear once)

### API Connection Errors
- Verify both servers running on correct ports
- Check browser console for CORS issues (unlikely on localhost)
- Confirm `API_BASE_URL = 'http://localhost:3001'` in `frontend/public/app.js`

### No Screenshots/Video Captured
- Check `./artifacts/` directory exists
- Verify Playwright is installed: `npm ls playwright`
- Check backend logs for recorder setup

### AI API Rate Limits
- Set `GROQ_API_KEY` in `.env`
- Check Groq dashboard for rate limit status
- Implement backoff in retry policy if needed

## Development

### Running Backend in Dev Mode
```bash
npm run dev    # Uses ts-node, auto-reload with Ctrl+C
```

### Running Backend CLI
```bash
npm run cli -- --feature "path/to/file.feature" --target-url "https://..."
```

### Building for Production
```bash
npm run build
NODE_ENV=production PORT=3001 npm start
```

## Performance Tips

1. **Headless Mode**: Set `HEADLESS=true` to skip rendering (faster)
2. **Video Recording**: Disable if not needed (edit `PlaywrightBrowserExecutor.ts`)
3. **Screenshot Frequency**: Adjust in `agentExecuteAction` handler
4. **Concurrent Executions**: Backend supports one at a time (queue in frontend)

## Logging

### Backend Logs
- All components prefixed with `[ComponentName]`
- Timestamps in ISO format
- Structured logging with context

### Frontend Logs
- Real-time display in Progress tab
- UILogger class with `log()`, `info()`, `success()`, `error()` methods
- Browser console also shows all logs

## Common Gherkin Steps

```gherkin
Feature: Test Example
  Scenario: Login and verify
    Given I navigate to the application
    When I enter username as "admin"
    And I enter password as "password"
    And I click the login button
    Then I should see "Welcome"
```

## FAQ

**Q: Why separate frontend and backend?**
A: Allows independent scaling, different hosting, cleaner separation of concerns.

**Q: Can I run this in a VM/remote?**
A: Yes - change `API_BASE_URL` in `frontend/public/app.js` and start servers with `--host 0.0.0.0`

**Q: Does it support other browsers?**
A: Currently Chromium. Can add Firefox/WebKit by modifying `PlaywrightBrowserExecutor.ts`

**Q: Is video required?**
A: No - disable in `.env` or code for faster execution. Screenshots are always captured.

## Next Steps

- [ ] Add dark mode toggle
- [ ] Implement execution queue for multiple features
- [ ] Add authentication to API
- [ ] Export results as PDF reports
- [ ] CI/CD pipeline integration examples
- [ ] Docker containerization

## License

MIT
