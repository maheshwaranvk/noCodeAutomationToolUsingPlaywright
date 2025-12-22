import { v4 as uuidv4 } from 'uuid';
import { Scenario } from './Feature';
import { AgentDecision } from './AgentDecision';
import { TestArtifact } from './TestArtifact';

export interface StepExecution {
  stepId: string;
  stepDescription: string;
  status: 'passed' | 'failed';
  executedAt: Date;
  duration: number;
  agentDecision: AgentDecision;
  screenshot?: string;
  errorMessage?: string;
}

export class ExecutionResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  status: 'passed' | 'failed';
  startedAt: Date;
  completedAt: Date;
  duration: number;
  stepExecutions: StepExecution[];
  agentDecisions: AgentDecision[];
  artifacts: TestArtifact[];
  generatedCode?: string;
  retryCount: number;
  errorSummary?: string;

  constructor(
    scenario: Scenario,
    id: string = uuidv4()
  ) {
    this.id = id;
    this.scenarioId = scenario.id;
    this.scenarioName = scenario.name;
    this.status = 'failed';
    this.startedAt = new Date();
    this.completedAt = new Date();
    this.duration = 0;
    this.stepExecutions = [];
    this.agentDecisions = [];
    this.artifacts = [];
    this.retryCount = 0;
  }

  addStepExecution(stepExecution: StepExecution): void {
    this.stepExecutions.push(stepExecution);
  }

  addAgentDecision(decision: AgentDecision): void {
    this.agentDecisions.push(decision);
  }

  addArtifact(artifact: TestArtifact): void {
    this.artifacts.push(artifact);
  }

  markAsCompleted(status: 'passed' | 'failed'): void {
    this.status = status;
    this.completedAt = new Date();
    this.duration = this.completedAt.getTime() - this.startedAt.getTime();
  }
}
