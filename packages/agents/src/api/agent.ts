import type {
  VisionAnalysis,
  EndpointSummary,
  ValidationResult,
} from "@mini-autostack/core";
import {
  ClaudeClient,
  TypedEventEmitter,
  stringifyValidationFeedback,
} from "@mini-autostack/core";
import { API_SYSTEM_PROMPT, API_HEAL_PROMPT } from "./prompts.js";
import { buildApiTools } from "./functions.js";

interface ApiToolResult {
  spec: string;
  referencedTables: string[];
  endpoints: EndpointSummary[];
}

/**
 * API Agent
 *
 * Prisma 스키마 + VisionAnalysis로부터 OpenAPI 3.1 명세를 생성한다.
 * Dynamic Function Calling Schema: 존재하는 테이블만 enum으로 참조 가능.
 * Self-Healing Loop: 검증 실패 시 피드백 기반 자동 수정.
 */
export class ApiAgent {
  constructor(
    private claude: ClaudeClient,
    private emitter: TypedEventEmitter,
  ) {}

  async generate(
    prismaSchema: string,
    tables: string[],
    vision: VisionAnalysis,
    validate: (spec: string) => Promise<ValidationResult>,
    maxAttempts: number = 3,
  ): Promise<{ openApiSpec: string; endpoints: EndpointSummary[] }> {
    this.emitter.emit("api:start", { tables });

    // Dynamic Function Calling Schema — 존재하는 테이블만 참조 가능
    const tools = buildApiTools(tables);

    let openApiSpec = await this.callApiGeneration(
      prismaSchema,
      tables,
      vision,
      tools,
    );
    this.emitter.emit("api:generate:complete", { openApiSpec });

    let endpoints: EndpointSummary[] = [];

    // Self-Healing Loop
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      this.emitter.emit("api:validate:start", { openApiSpec });
      const result = await validate(openApiSpec);

      if (result.success) {
        // 성공 시 엔드포인트 파싱
        endpoints = this.parseEndpoints(openApiSpec);
        this.emitter.emit("api:validate:pass", {
          endpointCount: endpoints.length,
          schemaCount: tables.length,
        });
        this.emitter.emit("api:complete", { openApiSpec, endpoints });
        return { openApiSpec, endpoints };
      }

      // 검증 실패
      this.emitter.emit("api:validate:fail", { errors: result.errors });

      if (attempt >= maxAttempts) {
        this.emitter.emit("api:error", {
          error: `API spec validation failed after ${maxAttempts} attempts`,
        });
        throw new Error(
          `API spec validation failed after ${maxAttempts} attempts:\n${result.feedback}`,
        );
      }

      const feedback = stringifyValidationFeedback(
        openApiSpec,
        result.errors,
      );
      this.emitter.emit("api:heal:start", { attempt, feedback });

      openApiSpec = await this.callApiHeal(openApiSpec, feedback, tools);
      this.emitter.emit("api:heal:complete", { openApiSpec });
    }

    throw new Error("API spec generation failed");
  }

  private async callApiGeneration(
    prismaSchema: string,
    tables: string[],
    vision: VisionAnalysis,
    tools: ReturnType<typeof buildApiTools>,
  ): Promise<string> {
    const userPrompt = `Generate an OpenAPI 3.1 specification for the following system:

## Prisma Schema
\`\`\`prisma
${prismaSchema}
\`\`\`

## Available Tables
${tables.join(", ")}

## UI Context
- Layout type: ${vision.layoutType}
- Description: ${vision.description}
- Components: ${vision.components.map((c) => c.name).join(", ")}

Generate RESTful CRUD endpoints for each model. Include proper schemas, pagination, and error responses.`;

    const { result } = await this.claude.callWithTools<ApiToolResult>(
      API_SYSTEM_PROMPT,
      userPrompt,
      tools,
      { type: "tool", name: "generate_openapi_spec" },
    );

    return result.spec;
  }

  private async callApiHeal(
    originalSpec: string,
    feedback: string,
    tools: ReturnType<typeof buildApiTools>,
  ): Promise<string> {
    const { result } = await this.claude.callWithTools<ApiToolResult>(
      API_HEAL_PROMPT,
      `Fix the following OpenAPI specification. Errors are annotated inline:\n\n${feedback}`,
      tools,
      { type: "tool", name: "generate_openapi_spec" },
    );

    return result.spec;
  }

  /** OpenAPI YAML에서 엔드포인트 목록을 간단히 파싱 */
  private parseEndpoints(spec: string): EndpointSummary[] {
    const endpoints: EndpointSummary[] = [];
    const pathRegex =
      /^\s{2}(\/[^\s:]+):\s*$/gm;
    const methodRegex =
      /^\s{4}(get|post|put|patch|delete):\s*$/gm;

    let currentPath = "";
    const lines = spec.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Path detection
      const pathMatch = line.match(/^\s{2}(\/\S+):\s*$/);
      if (pathMatch) {
        currentPath = pathMatch[1];
        continue;
      }

      // Method detection
      const methodMatch = line.match(
        /^\s{4}(get|post|put|patch|delete):\s*$/,
      );
      if (methodMatch && currentPath) {
        const method = methodMatch[1].toUpperCase() as EndpointSummary["method"];

        // Look ahead for operationId and description
        let operationId = `${methodMatch[1]}${currentPath.replace(/[/{}]/g, "_")}`;
        let description = "";

        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          const opMatch = lines[j].match(/operationId:\s*(\S+)/);
          if (opMatch) operationId = opMatch[1];

          const descMatch = lines[j].match(
            /(?:summary|description):\s*(.+)/,
          );
          if (descMatch) description = descMatch[1].replace(/^['"]|['"]$/g, "");

          // Stop at next method or path
          if (lines[j].match(/^\s{2,4}\S/) && j > i + 1) break;
        }

        endpoints.push({
          method,
          path: currentPath,
          operationId,
          description,
        });
      }
    }

    return endpoints;
  }
}
