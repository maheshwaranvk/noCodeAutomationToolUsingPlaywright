import { v4 as uuidv4 } from 'uuid';

export class Step {
  id: string;
  type: 'Given' | 'When' | 'Then';
  description: string;
  executedAt?: Date;
  status?: 'pending' | 'executing' | 'passed' | 'failed';
  errorMessage?: string;
  screenshot?: string;

  constructor(
    type: 'Given' | 'When' | 'Then',
    description: string,
    id: string = uuidv4()
  ) {
    this.id = id;
    this.type = type;
    this.description = description;
    this.status = 'pending';
  }
}

export class Scenario {
  id: string;
  name: string;
  description?: string;
  steps: Step[];
  status?: 'pending' | 'executing' | 'passed' | 'failed';
  retryCount: number;
  executedAt?: Date;
  completedAt?: Date;

  constructor(name: string, steps: Step[] = [], id: string = uuidv4()) {
    this.id = id;
    this.name = name;
    this.steps = steps;
    this.status = 'pending';
    this.retryCount = 0;
  }

  addStep(step: Step): void {
    this.steps.push(step);
  }
}

export class Feature {
  id: string;
  name: string;
  description?: string;
  scenarios: Scenario[];
  createdAt: Date;

  constructor(name: string, scenarios: Scenario[] = [], id: string = uuidv4()) {
    this.id = id;
    this.name = name;
    this.scenarios = scenarios;
    this.createdAt = new Date();
  }

  addScenario(scenario: Scenario): void {
    this.scenarios.push(scenario);
  }
}
