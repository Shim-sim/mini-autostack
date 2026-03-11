import type {
  VisionAnalysis,
  EndpointSummary,
  GeneratedComponent,
  ComponentSpec,
} from "@mini-autostack/core";
import { ClaudeClient, TypedEventEmitter } from "@mini-autostack/core";
import { CODEGEN_SYSTEM_PROMPT } from "./prompts.js";
import { CODEGEN_TOOLS } from "./functions.js";

interface CodegenToolResult {
  components: GeneratedComponent[];
}

/**
 * Codegen Agent
 *
 * VisionAnalysis + OpenAPI 명세로부터 React + TailwindCSS TSX 코드를 생성한다.
 * API 엔드포인트와 프론트엔드 컴포넌트 간 매핑을 자동 생성.
 */
export class CodegenAgent {
  constructor(
    private claude: ClaudeClient,
    private emitter: TypedEventEmitter,
  ) {}

  async generate(
    vision: VisionAnalysis,
    openApiSpec: string,
    endpoints: EndpointSummary[],
  ): Promise<GeneratedComponent[]> {
    const componentSpecs = this.buildComponentSpecs(vision, endpoints);
    this.emitter.emit("codegen:start", { componentSpecs });

    const userPrompt = this.buildPrompt(vision, openApiSpec, endpoints);

    const { result } = await this.claude.callWithTools<CodegenToolResult>(
      CODEGEN_SYSTEM_PROMPT,
      userPrompt,
      CODEGEN_TOOLS,
      { type: "tool", name: "generate_components" },
    );

    // 개별 컴포넌트 이벤트
    for (const comp of result.components) {
      this.emitter.emit("codegen:generate:component", {
        name: comp.name,
        tsx: comp.tsx,
      });
    }

    const tokens = this.claude.getTokenUsage();
    this.emitter.emit("codegen:complete", {
      components: result.components,
      totalTokens: tokens.input + tokens.output,
    });

    return result.components;
  }

  private buildComponentSpecs(
    vision: VisionAnalysis,
    endpoints: EndpointSummary[],
  ): ComponentSpec[] {
    return vision.components.map((hint) => {
      // 컴포넌트와 관련된 API 엔드포인트 매핑
      const relatedEndpoints = endpoints
        .filter((ep) => {
          const componentName = hint.name.toLowerCase();
          const pathParts = ep.path.toLowerCase().split("/");
          return pathParts.some((part) => componentName.includes(part.replace(/[{}]/g, "")));
        })
        .map((ep) => `${ep.method} ${ep.path}`);

      return {
        name: hint.name,
        role: hint.role === "element" ? "component" : hint.role,
        description: hint.description,
        layout: {
          type: hint.layout ?? "flex-col",
        },
        apiEndpoints: relatedEndpoints.length > 0 ? relatedEndpoints : undefined,
        children: hint.children?.map((child) => ({
          name: child.name,
          role: child.role === "element" ? "component" : child.role,
          description: child.description,
          layout: { type: child.layout ?? "flex-col" },
        })),
      } satisfies ComponentSpec;
    });
  }

  private buildPrompt(
    vision: VisionAnalysis,
    openApiSpec: string,
    endpoints: EndpointSummary[],
  ): string {
    const componentList = vision.components
      .map((c) => {
        const children = c.children
          ?.map((ch) => `    - ${ch.name}: ${ch.description}`)
          .join("\n");
        return `- ${c.name} (${c.role}, ${c.layout ?? "flex-col"}): ${c.description}${children ? `\n${children}` : ""}`;
      })
      .join("\n");

    const endpointList = endpoints
      .map((ep) => `- ${ep.method} ${ep.path}: ${ep.description}`)
      .join("\n");

    const palette = Object.entries(vision.palette)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `- ${k}: ${v}`)
      .join("\n");

    return `Generate React + TailwindCSS components for the following UI:

## Layout Type
${vision.layoutType}

## Description
${vision.description}

## Component Hierarchy
${componentList}

## Color Palette
${palette}

## API Endpoints
${endpointList}

## OpenAPI Spec (for reference)
\`\`\`yaml
${openApiSpec.slice(0, 3000)}
\`\`\`

Generate a component for each top-level item in the hierarchy.
Include child components inline or as separate components as appropriate.
Use the color palette for theming with TailwindCSS custom colors or closest built-in colors.
Wire up API calls using fetch() to the listed endpoints.`;
  }
}
