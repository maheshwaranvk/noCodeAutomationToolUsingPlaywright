import { Feature, Scenario, Step } from '@domain/models';
import { LoggerPort } from '@domain/ports';

export class GherkinFeatureParser {
  constructor(private logger: LoggerPort) {}

  parse(featureText: string): Feature {
    try {
      this.logger.info('Parsing Gherkin feature text');

      const lines = featureText.split('\n').filter(line => line.trim());
      let featureName = 'Untitled Feature';
      const scenarios: Scenario[] = [];
      let currentScenario: Scenario | null = null;
      let currentSteps: Step[] = [];

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('Feature:')) {
          featureName = trimmed.replace('Feature:', '').trim();
        } else if (trimmed.startsWith('Scenario:')) {
          // Save previous scenario if exists
          if (currentScenario) {
            currentScenario.steps = currentSteps;
            scenarios.push(currentScenario);
          }
          const scenarioName = trimmed.replace('Scenario:', '').trim();
          currentScenario = new Scenario(scenarioName);
          currentSteps = [];
        } else if (trimmed.match(/^(\*|Given|When|Then|And|But)\s+/)) {
          const match = trimmed.match(/^(\*|Given|When|Then|And|But)\s+(.+)$/);
          if (match) {
            let type = match[1] as 'Given' | 'When' | 'Then';
            const description = match[2];
            
            // Convert 'And', 'But', and '*' to the type of the previous step
            if ((match[1] === 'And' || match[1] === 'But' || match[1] === '*') && currentSteps.length > 0) {
              type = currentSteps[currentSteps.length - 1].type;
            }
            
            currentSteps.push(new Step(type, description));
          }
        }
      }

      // Add last scenario
      if (currentScenario) {
        currentScenario.steps = currentSteps;
        scenarios.push(currentScenario);
      }

      const feature = new Feature(featureName, scenarios);
      this.logger.info(`Parsed feature`, {
        featureName,
        scenarioCount: scenarios.length,
        totalSteps: scenarios.reduce((sum, s) => sum + s.steps.length, 0),
      });

      return feature;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to parse feature text', { error: errorMessage });
      throw error;
    }
  }
}
