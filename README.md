# No-Code UI Automation Tool

A deterministic UI automation backend that converts natural language test scenarios (Gherkin format) into executable Playwright tests using AI-powered step interpretation.

## Architecture

This project follows **Clean Architecture** with **Hexagonal Architecture** (Ports & Adapters):

```
src/
├─ domain/              # Pure business logic (no framework dependencies)
│  ├─ models/           # Domain entities
│  ├─ services/         # Domain services
│  └─ ports/            # Interfaces (contracts)
├─ application/         # Use cases and orchestration
│  ├─ usecases/         # Application services
│  └─ dto/              # Data transfer objects
├─ adapters/            # Framework-specific implementations
│  ├─ inbound/          # CLI, REST API
│  └─ outbound/         # Playwright, AI, CodeGen, Storage
├─ infrastructure/      # Express server, logging
└─ config/              # Configuration
```

## Quick Start

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
npm install
```

### Build

```bash
npm run build
```

### Run REST API Server

```bash
npm start
```

Server runs on http://localhost:3000

### Run CLI

```bash
npx ts-node src/adapters/inbound/cli/cli.ts --feature "Feature: Login\nScenario: User login\nGiven I navigate to login page\nWhen I enter credentials\nThen I should see dashboard"
```

Or read from a Gherkin file:

```bash
npx ts-node src/adapters/inbound/cli/cli.ts --file path/to/feature.gherkin --retry 2
```

## API Endpoints

### POST /execute

Execute a feature test.

**Request:**
```json
{
  "featureText": "Feature: Login\nScenario: User login\nGiven...",
  "retryCount": 2
}
```

**Response:**
```json
{
  "executionId": "uuid",
  "scenarioId": "uuid",
  "status": "passed",
  "stepResults": [...],
  "generatedCode": "...",
  "artifacts": [...],
  "duration": 1234
}
```

### GET /health

Health check endpoint.

## Current Phase (Phase 1)

✅ Backend-only (no UI)  
✅ CLI + REST API  
✅ Local execution  
✅ Domain layer implementation  
✅ Clean architecture setup  
⏳ Playwright integration (in progress)  
⏳ MCP + AI agent integration (in progress)  
⏳ Deterministic execution (in progress)  
⏳ Code generation (in progress)  

## Future (Phase 2)

- Frontend UI with React
- Retry configuration via UI
- Feature file upload
- Execution logs visualization
- Cloud execution support

## Development

Watch mode:
```bash
npm run dev
```

Run tests:
```bash
npm test
```

## Project Structure Notes

- **Domain Layer**: Pure TypeScript, no framework imports
- **Ports**: Interfaces that define contracts between layers
- **Adapters**: Implementations of ports (Playwright, Express, etc.)
- **Use Cases**: Application logic that orchestrates domain services
- **Infrastructure**: Framework setup (Express server, logging)

All new features must:
1. Start in the domain layer (models/services/ports)
2. Be exposed through ports
3. Be implemented in adapters
4. Be orchestrated in use cases
5. Be exposed through inbound adapters (CLI/API)

## Key Concepts

### Deterministic Execution
- Same input produces same output
- All AI decisions are logged
- Retry behavior is predictable

### AI-Powered Step Interpretation
- Natural language steps → Actionable browser commands
- MCP (Model Context Protocol) based agent
- Confidence scoring for each decision

### Code Generation
- Generated after successful execution
- Playwright + TypeScript format
- Human-readable and editable
- Serves as executable documentation

## License

MIT
