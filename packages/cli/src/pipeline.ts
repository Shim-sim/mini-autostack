import type {
  FinalOutput,
  PipelineConfig,
  VisionAnalysis,
} from "@mini-autostack/core";
import {
  TypedEventEmitter,
  ClaudeClient,
  attachLogger,
  DEFAULT_CONFIG,
} from "@mini-autostack/core";
import { VisionAgent, SchemaAgent, ApiAgent, CodegenAgent } from "@mini-autostack/agents";
import { PrismaValidator, OpenApiValidator } from "@mini-autostack/compilers";

/**
 * 파이프라인 오케스트레이터
 *
 * Vision → Schema → API → Codegen 순서로 에이전트를 실행하며,
 * 각 단계에서 검증 → Self-Healing Loop를 수행한다.
 */
export class Pipeline {
  private emitter: TypedEventEmitter;
  private claude: ClaudeClient;
  private config: PipelineConfig;

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.emitter = new TypedEventEmitter();
    this.claude = new ClaudeClient(this.config.model);

    if (this.config.verbose) {
      attachLogger(this.emitter);
    }
  }

  async run(imagePath: string): Promise<FinalOutput> {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    this.emitter.emit("pipeline:start", { imageSource: imagePath, startedAt });

    try {
      // ── Phase 1: Vision ──
      this.emitter.emit("pipeline:phase:transition", {
        from: "vision",
        to: "vision",
      });
      const visionAgent = new VisionAgent(this.claude, this.emitter);
      const vision = await visionAgent.analyze(imagePath);

      // ── Phase 2: Schema ──
      this.emitter.emit("pipeline:phase:transition", {
        from: "vision",
        to: "schema",
      });
      const schemaAgent = new SchemaAgent(this.claude, this.emitter);
      const prismaValidator = new PrismaValidator();
      const schemaResult = await schemaAgent.generate(
        vision.entities,
        (schema) => prismaValidator.validate(schema),
        this.config.maxHealAttempts,
      );

      // ── Phase 3: API ──
      this.emitter.emit("pipeline:phase:transition", {
        from: "schema",
        to: "api",
      });
      const apiAgent = new ApiAgent(this.claude, this.emitter);
      const openApiValidator = new OpenApiValidator();
      const apiResult = await apiAgent.generate(
        schemaResult.prismaSchema,
        schemaResult.tables.map((t) => t.name),
        vision,
        (spec) =>
          openApiValidator.validate(
            spec,
            schemaResult.tables.map((t) => t.name),
          ),
        this.config.maxHealAttempts,
      );

      // ── Phase 4: Codegen ──
      this.emitter.emit("pipeline:phase:transition", {
        from: "api",
        to: "codegen",
      });
      const codegenAgent = new CodegenAgent(this.claude, this.emitter);
      const components = await codegenAgent.generate(
        vision,
        apiResult.openApiSpec,
        apiResult.endpoints,
      );

      // ── 완료 ──
      const tokens = this.claude.getTokenUsage();
      const elapsedMs = Date.now() - startMs;

      const output: FinalOutput = {
        prismaSchema: schemaResult.prismaSchema,
        openApiSpec: apiResult.openApiSpec,
        components,
        iterations: 0, // Phase 4에서 Layout Diff loop 카운트 추가
        totalTokens: tokens,
        events: [...this.emitter.getEventLog()],
        elapsedMs,
      };

      this.emitter.emit("pipeline:complete", output);
      return output;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.emitter.emit("pipeline:error", {
        error: message,
        phase: "vision", // 실제로는 현재 phase 추적 필요
      });
      throw error;
    }
  }

  getEmitter(): TypedEventEmitter {
    return this.emitter;
  }
}
