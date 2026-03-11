import type Anthropic from "@anthropic-ai/sdk";

/**
 * Dynamic Function Calling Schema for API Agent
 *
 * AutoBe Delta 로드맵의 핵심 패턴:
 * 존재하는 테이블만 참조 가능하도록 enum으로 제한.
 *
 * @see https://autobe.dev/docs/roadmap/delta/#21-dynamic-function-calling-schema
 */
export function buildApiTools(existingTables: string[]): Anthropic.Tool[] {
  return [
    {
      name: "generate_openapi_spec",
      description:
        "Generate a complete OpenAPI 3.1 specification in YAML format",
      input_schema: {
        type: "object" as const,
        properties: {
          spec: {
            type: "string",
            description:
              "Complete OpenAPI 3.1 specification in YAML format. Must be valid YAML.",
          },
          referencedTables: {
            type: "array",
            description:
              "List of database tables referenced by this API. MUST only include tables that exist in the Prisma schema.",
            items: {
              type: "string",
              enum: existingTables.length > 0 ? existingTables : ["_empty_"],
            },
          },
          endpoints: {
            type: "array",
            description: "Summary of generated endpoints",
            items: {
              type: "object",
              properties: {
                method: {
                  type: "string",
                  enum: ["GET", "POST", "PUT", "PATCH", "DELETE"],
                },
                path: { type: "string" },
                operationId: { type: "string" },
                description: { type: "string" },
              },
              required: ["method", "path", "operationId", "description"],
            },
          },
        },
        required: ["spec", "referencedTables", "endpoints"],
      },
    },
  ];
}
