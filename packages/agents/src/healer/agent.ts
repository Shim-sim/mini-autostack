import type { LayoutDiff, GeneratedComponent } from "@mini-autostack/core";
import { ClaudeClient, TypedEventEmitter } from "@mini-autostack/core";

const HEAL_SYSTEM_PROMPT = `You are a React component repair agent.
Given a TSX component and a layout diff report showing mismatches between the expected and actual structure, fix the component to better match the expected layout.

Rules:
1. Fix structural mismatches (missing/extra elements)
2. Fix className mismatches (wrong TailwindCSS classes)
3. Preserve the component's functionality and data flow
4. Return the COMPLETE fixed TSX code

Respond ONLY by calling the provided tool.`;

const HEAL_TOOLS = [
  {
    name: "fix_component",
    description: "Return the fixed TSX component code",
    input_schema: {
      type: "object" as const,
      properties: {
        tsx: {
          type: "string",
          description: "Complete fixed TSX code",
        },
      },
      required: ["tsx"],
    },
  },
] as const;

/**
 * Healer Agent (Self-Healing)
 *
 * Layout Diff 결과를 기반으로 TSX 코드를 수정한다.
 */
export class HealerAgent {
  constructor(
    private claude: ClaudeClient,
    private emitter: TypedEventEmitter,
  ) {}

  async heal(
    componentName: string,
    originalTsx: string,
    diff: LayoutDiff,
    attempt: number,
  ): Promise<string> {
    this.emitter.emit("heal:start", {
      component: componentName,
      attempt,
      diff,
    });

    const mismatchReport = diff.mismatches
      .map(
        (m) =>
          `- [${m.severity}] ${m.path}: ${m.type}${m.expected ? ` (expected: ${m.expected})` : ""}${m.actual ? ` (actual: ${m.actual})` : ""}`,
      )
      .join("\n");

    const { result } = await this.claude.callWithTools<{ tsx: string }>(
      HEAL_SYSTEM_PROMPT,
      `Fix this component. Current similarity: ${(diff.similarity * 100).toFixed(1)}%

## Mismatches
${mismatchReport}

## Current TSX
\`\`\`tsx
${originalTsx}
\`\`\`

Fix all mismatches and return the complete TSX code.`,
      [...HEAL_TOOLS],
      { type: "tool", name: "fix_component" },
    );

    this.emitter.emit("heal:complete", {
      component: componentName,
      newTsx: result.tsx,
    });

    return result.tsx;
  }
}
