export class ExecuteFeatureRequest {
  featureText: string;
  retryCount: number;
  executionId?: string;

  constructor(featureText: string, retryCount: number = 2, executionId?: string) {
    this.featureText = featureText;
    this.retryCount = retryCount;
    this.executionId = executionId;
  }
}

export class ExecuteFeatureResponse {
  executionId: string;
  scenarioId: string;
  status: 'passed' | 'failed';
  stepResults: Array<{
    stepId: string;
    description: string;
    status: 'passed' | 'failed';
    duration: number;
  }>;
  generatedCode?: string;
  artifacts: Array<{
    type: string;
    filename: string;
    path: string;
  }>;
  duration: number;
  errorSummary?: string;

  constructor(executionId: string, scenarioId: string) {
    this.executionId = executionId;
    this.scenarioId = scenarioId;
    this.status = 'failed';
    this.stepResults = [];
    this.artifacts = [];
    this.duration = 0;
  }
}
