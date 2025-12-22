import { v4 as uuidv4 } from 'uuid';

export class AgentDecision {
  id: string;
  stepId: string;
  decision: string;
  reasoning: string;
  confidenceScore: number;
  selectedElement?: string;
  actionType: string;
  timestamp: Date;

  constructor(
    stepId: string,
    decision: string,
    reasoning: string,
    actionType: string,
    confidenceScore: number = 1.0,
    id: string = uuidv4()
  ) {
    this.id = id;
    this.stepId = stepId;
    this.decision = decision;
    this.reasoning = reasoning;
    this.actionType = actionType;
    this.confidenceScore = confidenceScore;
    this.timestamp = new Date();
  }
}
