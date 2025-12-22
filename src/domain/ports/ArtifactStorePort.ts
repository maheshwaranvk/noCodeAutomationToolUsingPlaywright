import { TestArtifact } from '../models/TestArtifact';

export interface ArtifactStorePort {
  saveArtifact(artifact: TestArtifact): Promise<void>;
  retrieveArtifact(artifactId: string): Promise<TestArtifact | null>;
  listArtifacts(executionId: string): Promise<TestArtifact[]>;
  deleteArtifact(artifactId: string): Promise<void>;
}
