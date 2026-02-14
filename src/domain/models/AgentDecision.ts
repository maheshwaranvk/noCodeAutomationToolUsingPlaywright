import { v4 as uuidv4 } from 'uuid';

export class AgentDecision {
  id: string;
  stepId: string;
  decision: string;
  reasoning: string;
  confidenceScore: number;
  selectedElement?: string;
  elementSelector?: string; // CSS or XPath selector
  actionValue?: string; // Value to use for type, select, etc.
  elementDescription?: string; // Description of the element
  actionType: string;
  timestamp: Date;

  constructor(
    stepId: string,
    decision: string,
    reasoning: string,
    actionType: string,
    confidenceScore: number = 1.0,
    id: string = uuidv4(),
    elementSelector?: string,
    actionValue?: string,
    elementDescription?: string
  ) {
    this.id = id;
    this.stepId = stepId;
    this.decision = decision;
    this.reasoning = reasoning;
    this.actionType = actionType;
    this.confidenceScore = confidenceScore;
    this.elementSelector = elementSelector;
    this.actionValue = actionValue;
    this.elementDescription = elementDescription;
    this.timestamp = new Date();
  }
}
