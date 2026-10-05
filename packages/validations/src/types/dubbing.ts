import type { DubOutput } from '../schema/dubbing.schema';

/** A finished dub as the new-dub page shows it: one entry per language. */
export interface DubbedResult {
  projectId: string;
  outputs: DubOutput[];
}

export interface DubbingProgress {
  state: "idle" | "uploading" | "processing" | "completed" | "failed";
  progress: number;
  message: string;
  creditsUsed?: number;
  finished?: boolean;
}
