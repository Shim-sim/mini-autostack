import type {
  EntityHint,
  SchemaGenerationResult,
  TableSummary,
  RelationSummary,
  ValidationResult,
} from "@mini-autostack/core";
import {
  ClaudeClient,
  TypedEventEmitter,
  stringifyValidationFeedback,
} from "@mini-autostack/core";
import { SCHEMA_SYSTEM_PROMPT, SCHEMA_HEAL_PROMPT } from "./prompts.js";
import { SCHEMA_TOOLS } from "./functions.js";

/**
 * Schema Agent
 *
 * EntityHint[]로부터 Prisma 스키마를 생성한다.
 * Self-Healing Loop: 검증 실패 시 피드백을 받아 자동 수정.
 */
export class SchemaAgent {
  constructor(
    private claude: ClaudeClient,
    private emitter: TypedEventEmitter,
  ) {}

  async generate(
    entities: EntityHint[],
    validate: (schema: string) => Promise<ValidationResult>,
    maxAttempts: number = 3,
  ): Promise<SchemaGenerationResult> {
    this.emitter.emit("schema:start", { entities });

    // 초기 생성
    let prismaSchema = await this.callSchemaGeneration(entities);
    this.emitter.emit("schema:generate:complete", { prismaSchema });

    // Self-Healing Loop
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.emitter.emit("schema:validate:start", { prismaSchema });
      const result = await validate(prismaSchema);

      if (result.success) {
        const parsed = this.parseSchema(prismaSchema);
        this.emitter.emit("schema:validate:pass", {
          tableCount: parsed.tables.length,
          relationCount: parsed.relations.length,
        });
        this.emitter.emit("schema:complete", {
          prismaSchema,
          tables: parsed.tables.map((t) => t.name),
        });
        return { prismaSchema, ...parsed };
      }

      // 검증 실패 → 피드백 기반 재생성
      this.emitter.emit("schema:validate:fail", { errors: result.errors });

      if (attempt >= maxAttempts) {
        this.emitter.emit("schema:error", {
          error: `Schema validation failed after ${maxAttempts} attempts`,
        });
        throw new Error(
          `Schema validation failed after ${maxAttempts} attempts:\n${result.feedback}`,
        );
      }

      // Feedback Stringify → 에이전트에게 전달
      const feedback = stringifyValidationFeedback(
        prismaSchema,
        result.errors,
      );
      this.emitter.emit("schema:heal:start", { attempt, feedback });

      prismaSchema = await this.callSchemaHeal(prismaSchema, feedback);
      this.emitter.emit("schema:heal:complete", { prismaSchema });
    }

    // unreachable but TypeScript needs it
    throw new Error("Schema generation failed");
  }

  private async callSchemaGeneration(
    entities: EntityHint[],
  ): Promise<string> {
    const entitiesDescription = entities
      .map((e) => {
        const fields = e.fields
          .map(
            (f) =>
              `  - ${f.name}: ${f.type}${f.isRequired ? " (required)" : ""}${f.isUnique ? " (unique)" : ""}`,
          )
          .join("\n");
        const relations = e.relations
          ?.map((r) => `  - → ${r.targetEntity} (${r.type})`)
          .join("\n");
        return `${e.name}: ${e.description}\nFields:\n${fields}${relations ? `\nRelations:\n${relations}` : ""}`;
      })
      .join("\n\n");

    const { result } = await this.claude.callWithTools<{ schema: string }>(
      SCHEMA_SYSTEM_PROMPT,
      `Generate a Prisma schema for the following entities:\n\n${entitiesDescription}`,
      SCHEMA_TOOLS,
      { type: "tool", name: "generate_prisma_schema" },
    );

    return result.schema;
  }

  private async callSchemaHeal(
    originalSchema: string,
    feedback: string,
  ): Promise<string> {
    const { result } = await this.claude.callWithTools<{ schema: string }>(
      SCHEMA_HEAL_PROMPT,
      `Fix the following Prisma schema. Errors are annotated inline:\n\n${feedback}`,
      SCHEMA_TOOLS,
      { type: "tool", name: "generate_prisma_schema" },
    );

    return result.schema;
  }

  /** 간단한 Prisma 스키마 파서 — 모델명과 필드 추출 */
  private parseSchema(schema: string): {
    tables: TableSummary[];
    relations: RelationSummary[];
  } {
    const tables: TableSummary[] = [];
    const relations: RelationSummary[] = [];

    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match: RegExpExecArray | null;

    while ((match = modelRegex.exec(schema)) !== null) {
      const modelName = match[1];
      const body = match[2];
      const fields: string[] = [];

      const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
      for (const line of lines) {
        // Skip comments and decorators-only lines
        if (line.startsWith("//") || line.startsWith("@@")) continue;

        const fieldMatch = line.match(/^(\w+)\s+(\w+[\[\]?]*)/);
        if (fieldMatch) {
          fields.push(fieldMatch[1]);

          // Detect relations
          const relType = fieldMatch[2].replace("[]", "").replace("?", "");
          if (relType[0] === relType[0].toUpperCase() && relType !== "String" &&
              relType !== "Int" && relType !== "Float" && relType !== "Boolean" &&
              relType !== "DateTime" && relType !== "Json" && relType !== "Decimal" &&
              relType !== "BigInt" && relType !== "Bytes") {
            const isArray = fieldMatch[2].includes("[]");
            relations.push({
              from: modelName,
              to: relType,
              type: isArray ? "one-to-many" : "one-to-one",
              foreignKey: `${fieldMatch[1]}Id`,
            });
          }
        }
      }

      tables.push({
        name: modelName,
        fieldCount: fields.length,
        fields,
      });
    }

    return { tables, relations };
  }
}
