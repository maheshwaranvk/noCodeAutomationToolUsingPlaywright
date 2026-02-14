import { ArtifactStorePort } from '@domain/ports';
import { TestArtifact } from '@domain/models';
import { LoggerPort } from '@domain/ports';
import * as fs from 'fs/promises';
import * as fsSynced from 'fs';
import * as path from 'path';

export class FileSystemArtifactStore implements ArtifactStorePort {
  private storePath: string;

  constructor(
    private logger: LoggerPort,
    storePath: string = './artifacts'
  ) {
    this.storePath = storePath;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async saveArtifact(artifact: TestArtifact): Promise<void> {
    try {
      const dirPath = path.join(this.storePath, artifact.executionId);
      await fs.mkdir(dirPath, { recursive: true });

      const filePath = path.join(dirPath, artifact.filename);
      
      if (artifact.type === 'video' && artifact.content) {
        // For videos, the content field contains the source file path
        // Copy the video file from source to artifact directory with retry
        await this.copyVideoFileWithRetry(artifact.content, filePath, artifact.id);
      } else if (artifact.content) {
        // For other artifacts (screenshots), write directly
        await fs.writeFile(filePath, artifact.content, 'utf-8');
      }

      this.logger.info(`Artifact saved`, {
        artifactId: artifact.id,
        filename: artifact.filename,
        path: filePath,
        type: artifact.type,
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

  private async copyVideoFileWithRetry(
    sourceFile: string,
    destinationFile: string,
    artifactId: string,
    maxRetries: number = 5,
    delayMs: number = 500
  ): Promise<void> {
    let lastError: Error | null = null;

    // Give Playwright a moment to finish writing the video file
    await this.delay(1000);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Check if source file exists and is accessible
        await fs.access(sourceFile);
        
        // Copy the file
        await fs.copyFile(sourceFile, destinationFile);
        
        this.logger.info(`Video artifact copied successfully`, {
          artifactId,
          sourceFile,
          destinationFile,
          attempt,
        });
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const errorMsg = lastError.message;
        
        this.logger.debug(`Video copy attempt ${attempt}/${maxRetries} failed`, {
          artifactId,
          sourceFile,
          error: errorMsg,
          nextRetryIn: attempt < maxRetries ? `${delayMs}ms` : 'no more retries',
        });

        // Wait before retrying
        if (attempt < maxRetries) {
          await this.delay(delayMs);
        }
      }
    }

    // All retries failed
    this.logger.warn(`Failed to copy video file after ${maxRetries} attempts`, {
      artifactId,
      sourceFile,
      destinationFile,
      lastError: lastError?.message,
    });

    // Don't throw - allow the process to continue even if video copy fails
    // The video file still exists in the root artifacts directory
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
