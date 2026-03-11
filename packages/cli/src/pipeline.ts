import type {
  FinalOutput,
  PipelineConfig,
  PipelinePhase,
  VisionAnalysis,
  GeneratedComponent,
} from "@mini-autostack/core";
import {
  TypedEventEmitter,
  ClaudeClient,
  attachLogger,
  DEFAULT_CONFIG,
} from "@mini-autostack/core";
import { VisionAgent, SchemaAgent, ApiAgent, CodegenAgent, HealerAgent } from "@mini-autostack/agents";
import {
  PrismaValidator,
  OpenApiValidator,
  AstValidator,
  tsxToLayoutTree,
  compareLayouts,
} from "@mini-autostack/compilers";

/**
 * 파이프라인 오케스트레이터
 *
 * Vision → Schema → API → Codegen → Validate → Heal 순서로 에이전트를 실행하며,
 * 각 단계에서 검증 → Self-Healing Loop를 수행한다.
 */
export class Pipeline {
  private emitter: TypedEventEmitter;
  private claude: ClaudeClient;
  private config: PipelineConfig;
  private currentPhase: PipelinePhase = "vision";

  constructor(config: Partial<PipelineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.emitter = new TypedEventEmitter();
    this.claude = new ClaudeClient(this.config.model);

    if (this.config.verbose) {
      attachLogger(this.emitter);
    }
  }

  async run(imagePath: string): Promise<{ output: FinalOutput; vision: VisionAnalysis }> {
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    this.emitter.emit("pipeline:start", { imageSource: imagePath, startedAt });

    try {
      // ── Phase 1: Vision ──
      this.transition("vision");
      const visionAgent = new VisionAgent(this.claude, this.emitter);
      const vision = await visionAgent.analyze(imagePath);

      // ── Phase 2: Schema ──
      this.transition("schema");
      const schemaAgent = new SchemaAgent(this.claude, this.emitter);
      const prismaValidator = new PrismaValidator();
      const schemaResult = await schemaAgent.generate(
        vision.entities,
        (schema) => prismaValidator.validate(schema),
        this.config.maxHealAttempts,
      );

      // ── Phase 3: API ──
      this.transition("api");
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
      this.transition("codegen");
      const codegenAgent = new CodegenAgent(this.claude, this.emitter);
      let components = await codegenAgent.generate(
        vision,
        apiResult.openApiSpec,
        apiResult.endpoints,
      );

      // ── Phase 5: Validate + Heal ──
      this.transition("validate");
      const { validated, iterations } = await this.validateAndHeal(
        components,
        vision,
      );
      components = validated;

      // ── 완료 ──
      const tokens = this.claude.getTokenUsage();
      const elapsedMs = Date.now() - startMs;

      const output: FinalOutput = {
        prismaSchema: schemaResult.prismaSchema,
        openApiSpec: apiResult.openApiSpec,
        components,
        iterations,
        totalTokens: tokens,
        events: [...this.emitter.getEventLog()],
        elapsedMs,
      };

      this.emitter.emit("pipeline:complete", output);
      return { output, vision };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.emitter.emit("pipeline:error", {
        error: message,
        phase: this.currentPhase,
      });
      throw error;
    }
  }

  /**
   * AST 검증 + Layout Diff + Self-Healing Loop
   */
  private async validateAndHeal(
    components: GeneratedComponent[],
    vision: VisionAnalysis,
  ): Promise<{ validated: GeneratedComponent[]; iterations: number }> {
    const astValidator = new AstValidator();
    const healerAgent = new HealerAgent(this.claude, this.emitter);

    this.emitter.emit("validate:start", { componentCount: components.length });

    let totalIterations = 0;
    const validated: GeneratedComponent[] = [];

    for (const comp of components) {
      let currentTsx = comp.tsx;
      let healed = false;

      // AST 검증
      const astResult = astValidator.validate(currentTsx, comp.name);
      if (astResult.success) {
        this.emitter.emit("validate:ast:pass", { component: comp.name });
      } else {
        this.emitter.emit("validate:ast:fail", {
          component: comp.name,
          errors: astResult.errors.map((e) => e.message),
        });
      }

      // Layout Diff (Vision의 컴포넌트 힌트와 비교)
      if (astResult.success) {
        try {
          const actualTree = tsxToLayoutTree(currentTsx);
          const expectedHint = vision.components.find(
            (c) => c.name === comp.name,
          );

          if (expectedHint) {
            // Vision 힌트를 간이 LayoutNode로 변환
            const expectedTree = hintToLayoutNode(expectedHint);

            this.emitter.emit("validate:layout:start", {
              component: comp.name,
            });

            const diff = compareLayouts(expectedTree, actualTree);

            if (diff.similarity >= this.config.similarityThreshold) {
              this.emitter.emit("validate:layout:pass", {
                component: comp.name,
                similarity: diff.similarity,
              });
            } else {
              this.emitter.emit("validate:layout:fail", {
                component: comp.name,
                similarity: diff.similarity,
                diff,
              });

              // Self-Healing Loop
              for (
                let attempt = 1;
                attempt <= this.config.maxHealAttempts;
                attempt++
              ) {
                this.transition("heal");
                totalIterations++;

                try {
                  currentTsx = await healerAgent.heal(
                    comp.name,
                    currentTsx,
                    diff,
                    attempt,
                  );
                  healed = true;

                  // 재검증
                  const newTree = tsxToLayoutTree(currentTsx);
                  const newDiff = compareLayouts(expectedTree, newTree);

                  if (newDiff.similarity >= this.config.similarityThreshold) {
                    this.emitter.emit("validate:layout:pass", {
                      component: comp.name,
                      similarity: newDiff.similarity,
                    });
                    break;
                  }

                  if (attempt >= this.config.maxHealAttempts) {
                    this.emitter.emit("heal:give-up", {
                      component: comp.name,
                      attempts: attempt,
                      lastSimilarity: newDiff.similarity,
                    });
                  }
                } catch {
                  // Heal 실패 시 원본 유지
                  break;
                }
              }
            }
          }
        } catch {
          // Layout diff 실패 시 무시 — AST 통과했으면 OK
        }
      }

      validated.push({
        ...comp,
        tsx: currentTsx,
      });
    }

    const passCount = validated.length;
    const failCount = components.length - passCount;
    this.emitter.emit("validate:complete", { passCount, failCount });

    return { validated, iterations: totalIterations };
  }

  private transition(to: PipelinePhase): void {
    const from = this.currentPhase;
    this.currentPhase = to;
    this.emitter.emit("pipeline:phase:transition", { from, to });
  }

  getEmitter(): TypedEventEmitter {
    return this.emitter;
  }
}

/** Vision ComponentHint → 간이 LayoutNode 변환 */
function hintToLayoutNode(
  hint: import("@mini-autostack/core").ComponentHint,
  depth: number = 0,
): import("@mini-autostack/core").LayoutNode {
  const layoutClassMap: Record<string, string> = {
    "flex-row": "flex flex-row",
    "flex-col": "flex flex-col",
    grid: "grid",
    absolute: "absolute",
  };

  return {
    tag: "div",
    className: layoutClassMap[hint.layout ?? "flex-col"],
    attributes: { "data-component": hint.name },
    children: (hint.children ?? []).map((child) =>
      hintToLayoutNode(child, depth + 1),
    ),
    depth,
  };
}
