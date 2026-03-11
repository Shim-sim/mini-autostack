export * from "./events.js";
export * from "./vision.js";
export * from "./schema.js";
export * from "./api.js";
export * from "./codegen.js";
export * from "./validation.js";

/** 최종 파이프라인 출력 */
export interface FinalOutput {
  prismaSchema: string;
  openApiSpec: string;
  components: import("./codegen.js").GeneratedComponent[];
  iterations: number;
  totalTokens: { input: number; output: number };
  events: import("./events.js").PipelineEvent[];
  elapsedMs: number;
}

/** 파이프라인 설정 */
export interface PipelineConfig {
  model: string;
  maxHealAttempts: number;
  similarityThreshold: number;
  verbose: boolean;
}

export const DEFAULT_CONFIG: PipelineConfig = {
  model: "claude-sonnet-4-20250514",
  maxHealAttempts: 3,
  similarityThreshold: 0.7,
  verbose: true,
};
