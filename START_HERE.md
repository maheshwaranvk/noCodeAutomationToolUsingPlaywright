# 🚀 Quick Start - Backend & Frontend Separate Servers

## Installation (One Time)

### Windows
```bash
setup.bat
```

### Linux/Mac
```bash
bash setup.sh
```

Or manually:
```bash
npm install && npm run build
cd frontend && npm install && cd ..
```

---

## Running the Application

### Terminal 1: Start Backend (Port 3001)
```bash
npm start
```

Expected output:
```
[INFO] Starting nocode-ui-automation server { nodeEnv: 'development', port: 3001 }
[INFO] [PlaywrightBrowserExecutor] Playwright Agent initialized
[INFO] [MCPAIInterpreter] Initialized with Groq
[INFO] [ExpressServer] Backend API server initialized { port: 3001 }
[INFO] [ExpressServer] Serving artifacts from { path: './artifacts' }
[INFO] Server running on port 3001 { url: 'http://localhost:3001' }
```

### Terminal 2: Start Frontend (Port 3000)
```bash
cd frontend
npm start
```

Expected output:
```
Starting up http-server, serving ./public
Available on:
  http://127.0.0.1:3000
  http://[your-ip]:3000
```

### Browser: Open UI
```
http://localhost:3000
```

---

## Architecture

```
Frontend React App        Backend Node.js           Playwright Browser
http://localhost:3000 ←→ http://localhost:3001 ←→ Chromium/Chrome
  - Input Form              - API Routes               - Execution
  - Logs Display            - Artifact Service         - Video Recording
  - Results                 - AI Interpreter           - Screenshots
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/execute` | POST | Execute Gherkin feature |
| `/health` | GET | Health check |
| `/artifacts/:filename` | GET | Retrieve screenshots/video |

---

## Environment Variables

Create `.env` file in root:
```env
PORT=3001
GROQ_API_KEY=your_key_here
LEAFTAPS_URL=https://www.leaftaps.com/opentaps/control/main
HEADLESS=false
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Blank page | F12 → Check console for errors, verify app.js loaded |
| Cannot connect | `curl http://localhost:3001/health` to verify backend |
| Port already in use | Change port in frontend/package.json or backend .env |
| No screenshots | Check `./artifacts/` directory exists and is writable |

---

## Key Files

```
s:\AI TL\VS Projects\myNoCode\
├── src/                          # Backend source
├── frontend/
│   ├── public/
│   │   ├── index.html           # React HTML
│   │   └── app.js               # React components
│   └── package.json
├── package.json                 # Backend package
├── tsconfig.json
├── setup.bat                    # Windows setup
├── setup.sh                     # Linux/Mac setup
└── QUICKSTART_SEPARATE_SERVERS.md
```

---

## Example Usage

1. **Frontend** (http://localhost:3000)
   - Paste Gherkin feature text
   - Enter target URL (optional)
   - Click Execute

2. **Backend** receives request
   - Parse feature
   - Execute with Playwright
   - Capture screenshots/video
   - Generate equivalent code

3. **Frontend** shows results
   - Progress logs in real-time
   - Screenshots in Results tab
   - Video in Video tab
   - Generated code in Code tab

---

## Common Features to Test

```gherkin
Feature: Login
  Scenario: User logs in
    Given I navigate to https://www.leaftaps.com/opentaps/control/main
    When I click on the username field
    And I enter username as "demo"
    And I enter password as "lf"
    And I click the login button
    Then I should see the dashboard
```

---

## Ports

- **Frontend**: 3000 (http-server, React UI)
- **Backend**: 3001 (Express, Playwright, AI)

Both must be running simultaneously.

---

## Build & Deployment

```bash
# Build
npm run build

# Run in production
NODE_ENV=production npm start
```

---

For detailed documentation, see:
- `QUICKSTART_SEPARATE_SERVERS.md` - Full guide
- `SEPARATION_COMPLETE.md` - What was completed
