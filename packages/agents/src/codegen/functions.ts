import type Anthropic from "@anthropic-ai/sdk";

export const CODEGEN_TOOLS: Anthropic.Tool[] = [
  {
    name: "generate_components",
    description:
      "Generate React + TailwindCSS TSX components based on UI analysis and API spec",
    input_schema: {
      type: "object" as const,
      properties: {
        components: {
          type: "array",
          description: "Generated React components",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "PascalCase component name (e.g., TodoList)",
              },
              fileName: {
                type: "string",
                description:
                  "File name with extension (e.g., TodoList.tsx)",
              },
              tsx: {
                type: "string",
                description:
                  "Complete TSX code for the component including imports",
              },
              imports: {
                type: "array",
                description: "List of external imports used",
                items: { type: "string" },
              },
            },
            required: ["name", "fileName", "tsx", "imports"],
          },
        },
      },
      required: ["components"],
    },
  },
];
