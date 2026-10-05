export interface DubbingProgress {
  state: "idle" | "uploading" | "processing" | "completed" | "failed";
  progress: number;
  message: string;
  creditsUsed?: number;
  finished?: boolean;
}
