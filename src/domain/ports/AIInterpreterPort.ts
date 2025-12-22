import { Step } from '../models/Feature';
import { AgentDecision } from '../models/AgentDecision';

export interface AIInterpretationRequest {
  step: Step;
  pageContent: string;
  pageTitle: string;
  previousScreenshot?: string;
  executionHistory?: string[];
}

export interface AIInterpretationResponse {
  actionType: string;
  elementDescription: string;
  elementSelector?: string;
  actionValue?: string;
  reasoning: string;
  confidenceScore: number;
}

export interface AIInterpreterPort {
  interpretStep(request: AIInterpretationRequest): Promise<AIInterpretationResponse>;
}
