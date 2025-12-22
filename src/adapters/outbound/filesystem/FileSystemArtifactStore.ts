import { ArtifactStorePort } from '@domain/ports';
import { TestArtifact } from '@domain/models';
import { LoggerPort } from '@domain/ports';
import * as fs from 'fs/promises';
import * as path from 'path';

export class FileSystemArtifactStore implements ArtifactStorePort {
  private storePath: string;

  constructor(
    private logger: LoggerPort,
    storePath: string = './artifacts'
  ) {
    this.storePath = storePath;
  }

  async saveArtifact(artifact: TestArtifact): Promise<void> {
    try {
      const dirPath = path.join(this.storePath, artifact.executionId);
      await fs.mkdir(dirPath, { recursive: true });

      const filePath = path.join(dirPath, artifact.filename);
      if (artifact.content) {
        await fs.writeFile(filePath, artifact.content, 'utf-8');
      }

      this.logger.info(`Artifact saved`, {
        artifactId: artifact.id,
        filename: artifact.filename,
        path: filePath,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to save artifact`, {
        artifactId: artifact.id,
        error: errorMessage,
      });
      throw error;
    }
  }

  async retrieveArtifact(artifactId: string): Promise<TestArtifact | null> {
    // TODO: Implement artifact retrieval
    return null;
  }

  async listArtifacts(executionId: string): Promise<TestArtifact[]> {
    try {
      const dirPath = path.join(this.storePath, executionId);
      const files = await fs.readdir(dirPath);
      return files.map(
        filename =>
          new TestArtifact(
            executionId,
            'log',
            filename,
            path.join(dirPath, filename)
          )
      );
    } catch (error) {
      this.logger.warn(`Could not list artifacts`, { executionId });
      return [];
    }
  }

  async deleteArtifact(artifactId: string): Promise<void> {
    // TODO: Implement
  }
}
