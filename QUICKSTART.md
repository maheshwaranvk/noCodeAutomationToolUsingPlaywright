# Quick Start Guide

## Installation

```bash
cd "s:\AI TL\VS Projects\myNoCode"
npm install
npm run build
```

## Running the Application

### Via REST API (Default)

```bash
npm start
```

Server will start on `http://localhost:3000`

**POST /execute** - Execute a feature test

```bash
curl -X POST http://localhost:3000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "featureText": "Feature: Login\nScenario: User logs in\nGiven I navigate to login page\nWhen I enter credentials\nThen I should see dashboard",
    "retryCount": 2
  }'
```

**GET /health** - Health check

```bash
curl http://localhost:3000/health
```

### Via CLI

```bash
npx ts-node src/adapters/inbound/cli/cli.ts --feature "Feature: Login\nScenario: Test\nGiven I navigate to login"
```

Or from a file:

```bash
npx ts-node src/adapters/inbound/cli/cli.ts --file path/to/feature.gherkin --retry 2
```

## Project Structure

```
src/
├─ domain/          Pure business logic (no framework imports)
├─ application/     Use cases and orchestration
├─ adapters/        Framework implementations (pluggable)
├─ infrastructure/  Express server, logging
└─ config/          Configuration
```

## Key Files

- `src/index.ts` - Main entry point (REST API server)
- `src/adapters/inbound/cli/cli.ts` - CLI entry point
- `src/application/usecases/ExecuteFeatureUseCase.ts` - Main execution logic
- `src/domain/models/` - Domain entities (Feature, Scenario, Step, ExecutionResult)
- `src/domain/ports/` - Interface contracts
- `src/domain/services/` - Business logic services

## Development

Watch mode with auto-recompile:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

## Architecture

Following **Clean Architecture** + **Hexagonal Architecture**:

1. **Domain Layer**: Pure TypeScript, business rules only
2. **Application Layer**: Use cases coordinating domain services
3. **Ports**: Interfaces defining adapter contracts
4. **Adapters**: Framework-specific implementations (Playwright, Express, AI)
5. **Infrastructure**: Server setup, logging, configuration

## Next Implementation Tasks

1. [ ] Implement Playwright browser executor
2. [ ] Connect MCP + AI integration
3. [ ] Implement code generation from execution results
4. [ ] Add end-to-end test scenarios
5. [ ] Implement retry mechanism
6. [ ] Add comprehensive logging

## Environment Variables

See `.env` file:
- `NODE_ENV` - Environment mode (development/production)
- `PORT` - Server port (default 3000)
- `ARTIFACT_PATH` - Where to store test artifacts (default ./artifacts)

## Troubleshooting

**TypeScript errors after changes?**
```bash
npm run build
```

**Port 3000 already in use?**
```bash
PORT=3001 npm start
```

**Need to see logs?**
Check console output when running via CLI or see Express logs in API mode.

## File Organization

- Models are in `domain/models/` (pure entities)
- Business logic is in `domain/services/` (orchestration)
- Framework code is in `adapters/` (replaceable)
- Interfaces are in `domain/ports/` (contracts)
- Use cases are in `application/usecases/` (orchestration layer)

This architecture ensures:
- ✅ Frameworks are replaceable
- ✅ Domain logic is testable
- ✅ Clean separation of concerns
- ✅ Extensibility for Phase 2 frontend
