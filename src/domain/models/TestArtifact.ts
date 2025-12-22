import { v4 as uuidv4 } from 'uuid';

export class TestArtifact {
  id: string;
  executionId: string;
  type: 'screenshot' | 'video' | 'log' | 'code' | 'summary';
  filename: string;
  path: string;
  content?: string;
  mimeType?: string;
  createdAt: Date;

  constructor(
    executionId: string,
    type: 'screenshot' | 'video' | 'log' | 'code' | 'summary',
    filename: string,
    path: string,
    id: string = uuidv4()
  ) {
    this.id = id;
    this.executionId = executionId;
    this.type = type;
    this.filename = filename;
    this.path = path;
    this.createdAt = new Date();
  }
}
