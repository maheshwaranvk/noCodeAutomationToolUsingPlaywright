
# 🧠 No-Code UI Automation Tool – Architecture Instructions

## Project Overview

**Goal**  
Build a no-code UI automation backend that:
- Accepts **Feature File text** as input
- Executes tests using **Playwright Agents + MCP**
- Runs **deterministically** on local machine
- Generates **human-readable Playwright + TypeScript code after execution**
- Targets **non-technical testers**
- Is **API-first**, future-ready for UI (Phase 2)

---

## Phase Scope

### Phase 1 (Current)
- Backend only
- CLI + REST API
- Local execution
- No database persistence (MongoDB placeholder only)
- No parallel execution
- Playwright only

### Phase 2 (Future)
- Frontend UI
- Retry configuration via UI
- Feature file input via text box
- Visualization of logs and artifacts

---

## Architectural Philosophy

Follow **Martin Fowler–aligned best practices**:

- Clean Architecture
- Hexagonal Architecture (Ports & Adapters)
- Domain-first design
- Frameworks are replaceable
- Deterministic execution
- API-first approach
- Extensibility through interfaces, not conditionals

> ❗ Express, Playwright, MCP, and AI SDKs must NOT leak into domain logic.

---

## High-Level Flow

```
Feature File Text
        ↓
CLI / REST API
        ↓
Feature Parser
        ↓
Scenario Orchestrator
        ↓
Playwright Agent Engine (via MCP)
        ↓
Browser Execution (Deterministic)
        ↓
Execution Artifacts
    ├─ Agent reasoning logs
    ├─ Screenshots / Videos
    ├─ Execution summary
    └─ Generated Playwright TypeScript code
```

---

## System Boundaries

### Inside the System
- Feature file parsing (Gherkin)
- Natural language → UI action mapping (AI)
- Deterministic browser execution
- Retry handling
- Artifact generation
- Code generation after execution

### Outside the System
- Frontend UI
- Cloud execution
- Parallel execution
- Mobile / API automation
- DB persistence (Phase 1)

---

## Entry Points

### CLI (Mandatory – Phase 1)

```bash
npx nocode-ui run --feature "<feature file text>"
```

### REST API (For Phase 2 UI)

```http
POST /execute
Content-Type: application/json

{
  "featureText": "...",
  "retryCount": 2
}
```

> CLI must internally call the same application use case as the REST API.

---

## Layered Architecture

### 1. Domain Layer (Pure)

**Purpose**
- Business rules
- No framework or tool dependencies

**Contains**
- Models
- Domain services
- Ports (interfaces)

❌ No Express  
❌ No Playwright  
❌ No AI SDK  

#### Domain Models
- Feature
- Scenario
- Step
- ExecutionResult
- AgentDecision
- TestArtifact

#### Domain Services
- ScenarioExecutionService
- StepInterpretationService
- RetryPolicy

---

### 2. Application Layer

**Purpose**
- Orchestrates use cases
- Coordinates domain + adapters

#### Use Cases
- ExecuteFeatureUseCase
- GenerateCodeUseCase
- RetryScenarioUseCase

Responsibilities:
- Accept feature text
- Coordinate execution
- Handle retries
- Collect artifacts
- Trigger code generation **after execution**

---

### 3. Ports (Interfaces)

#### Inbound Ports
- ExecuteFeatureCommand
- ExecutionRequest

#### Outbound Ports
- BrowserExecutorPort
- AIInterpreterPort
- CodeGeneratorPort
- ArtifactStorePort
- LoggerPort

> Ports must be pure TypeScript interfaces.

---

### 4. Adapters

#### Inbound Adapters
- CLI Adapter
- Express REST Controller

#### Outbound Adapters
- Playwright Adapter
- MCP Adapter
- AI Interpretation Adapter
- File System Artifact Store
- Console / File Logger

---

## Playwright Agents & MCP Design

### Agent Responsibilities
- Interpret natural language steps
- Identify UI elements dynamically
- Heal broken locators
- Execute actions deterministically
- Explain **why** each action was taken

### MCP Responsibilities
- Maintain execution context
- Share DOM memory between steps
- Coordinate agent tools
- Enforce deterministic execution

> All agent decisions must be logged.

---

## Deterministic Execution Rules

- Same input must always produce same output
- No randomness
- AI decisions must be:
  - Logged
  - Reproducible
- Retries reuse the same interpretation unless execution fails

---

## Feature File Handling

### Supported
- Standard Gherkin
- Any Given / When / Then combinations
- Multi-page flows
- Natural language steps only

### Example
```gherkin
When I login with valid credentials
Then I should see the dashboard
```

UI elements are resolved via **AI mapping**, not selectors.

---

## Retry Strategy

- Retry count is configurable
- Retry at **scenario level**
- Hard fail if interpretation fails repeatedly
- Retry decisions must be logged

---

## Code Generation Strategy

### When
- After successful execution

### Output
- Playwright + TypeScript
- Simple test file (no POM for now)
- Human readable
- Editable
- Overwrites previous generated code

### Purpose
- Reuse for future execution
- Executable documentation

---

## Observability & Artifacts

### Logs
- Step execution logs
- Agent reasoning logs
- Retry logs

### Artifacts
- Screenshots
- Videos
- Generated code
- Execution summary JSON

---

## Persistence (Phase 1)

- File system only
- MongoDB interfaces defined as placeholders
- No actual DB usage

---

## Folder Structure (Mandatory)

```
src/
 ├─ domain/
 │   ├─ models/
 │   ├─ services/
 │   └─ ports/
 ├─ application/
 │   ├─ usecases/
 │   └─ dto/
 ├─ adapters/
 │   ├─ inbound/
 │   │   ├─ cli/
 │   │   └─ api/
 │   └─ outbound/
 │       ├─ playwright/
 │       ├─ mcp/
 │       ├─ ai/
 │       ├─ codegen/
 │       └─ filesystem/
 ├─ infrastructure/
 │   ├─ express/
 │   └─ logging/
 ├─ config/
 └─ index.ts
```

---

## API-First Rule

- Every capability must be accessible via API
- CLI is only a thin adapter
- Enables UI without backend refactor

---

## Testing Strategy

- Unit test domain services
- Mock all ports
- No Playwright in unit tests
- Generate Postman collection for API testing once APIs are stable

---

## Definition of Phase 1 Success

✅ Feature file text provided  
✅ UI test executes locally  
✅ Uses Playwright Agents + MCP  
✅ Deterministic execution  
✅ Generates readable Playwright TypeScript code  
✅ No manual automation coding required  

---

## Final Instruction for GitHub Copilot

> Follow this architecture strictly.  
> Do not mix framework code into domain or application layers.  
> Introduce all new behavior via ports and adapters only.
