import Groq from 'groq-sdk';
import { AIInterpreterPort, AIInterpretationRequest, AIInterpretationResponse } from '@domain/ports';
import { LoggerPort } from '@domain/ports';

export class MCPAIInterpreter implements AIInterpreterPort {
  private groq: Groq | null = null;
  private model: string;

  constructor(private logger: LoggerPort) {
    this.model = process.env.GROQ_MODEL || 'mixtral-8x7b-32768';
    this.logger.info('[MCPAIInterpreter] Initialized with Groq', { model: this.model });
  }

  private getGroqClient(): Groq {
    if (!this.groq) {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error('GROQ_API_KEY environment variable is not set');
      }
      this.groq = new Groq({ apiKey });
      this.logger.info('[MCPAIInterpreter] Groq client initialized');
    }
    return this.groq;
  }

  async interpretStep(request: AIInterpretationRequest): Promise<AIInterpretationResponse> {
    try {
      this.logger.info(`[MCPAIInterpreter] Interpreting step via Groq`, {
        stepId: request.step.id,
        stepDescription: request.step.description,
        pageTitle: request.pageTitle ? 'provided' : 'none',
      });

      const systemPrompt = `You are a web automation AI agent. Your job is to interpret natural language web automation steps and convert them to specific browser actions.

For each step, return a JSON object with:
- actionType: 'navigate', 'click', 'type', 'select', 'hover', 'scroll', 'wait', 'extract', 'check', 'uncheck'
- elementDescription: plain language description of what element to interact with
- elementSelector: CSS/XPath selector if identifiable (or empty string)
- actionValue: value to type/select (if applicable)
- reasoning: explain why you chose this action
- confidenceScore: 0.0-1.0 confidence in your interpretation

Return ONLY the JSON object, no markdown or extra text.`;

      const userPrompt = `Step to interpret: "${request.step.description}"

Page Title: ${request.pageTitle || 'Unknown'}
${request.pageContent ? `Page content preview:\n${request.pageContent.substring(0, 500)}...` : 'No page content available'}

Based on the step description and page context, determine the automation action needed.`;

      this.logger.debug(`[MCPAIInterpreter] Calling Groq API`, {
        model: this.model,
        stepId: request.step.id,
      });

      const groq = this.getGroqClient();
      const message = await groq.chat.completions.create({
        model: this.model,
        max_tokens: 1024,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      const content = message.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from Groq');
      }

      this.logger.debug(`[MCPAIInterpreter] Groq response received`, {
        finishReason: message.choices[0].finish_reason,
        contentLength: content.length,
      });

      // Clean the content if it contains markdown code blocks
      let cleanContent = content;
      if (content.includes('```json')) {
        cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (content.includes('```')) {
        cleanContent = content.replace(/```\n?/g, '');
      }
      cleanContent = cleanContent.trim();

      this.logger.debug(`[MCPAIInterpreter] Cleaned Groq response`, {
        cleanedContent: cleanContent.substring(0, 200),
      });

      const parsedResponse = JSON.parse(cleanContent);

      const response: AIInterpretationResponse = {
        actionType: parsedResponse.actionType || 'click',
        elementDescription: parsedResponse.elementDescription || 'Unknown element',
        elementSelector: parsedResponse.elementSelector || undefined,
        actionValue: parsedResponse.actionValue || undefined,
        reasoning: parsedResponse.reasoning || 'AI interpretation via Groq',
        confidenceScore: parsedResponse.confidenceScore || 0.8,
      };

      this.logger.info(`[MCPAIInterpreter] Step interpreted successfully`, {
        stepId: request.step.id,
        actionType: response.actionType,
        confidence: response.confidenceScore,
        reasoning: response.reasoning,
      });

      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`[MCPAIInterpreter] AI interpretation failed`, {
        stepId: request.step.id,
        error: errorMessage,
        errorType: error instanceof SyntaxError ? 'JSONParseError' : 'APIError',
      });
      
      // Log more details for debugging
      if (error instanceof SyntaxError) {
        this.logger.error(`[MCPAIInterpreter] JSON parse error - returning default action`, {
          stepId: request.step.id,
        });
        
        // Return a default "wait" action instead of throwing
        return {
          actionType: 'wait',
          elementDescription: 'Default wait action',
          elementSelector: undefined,
          actionValue: undefined,
          reasoning: `AI interpretation failed: ${errorMessage}. Using default wait action.`,
          confidenceScore: 0.0,
        };
      }
      
      throw error;
    }
  }
}
