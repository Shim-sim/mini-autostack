import type Anthropic from "@anthropic-ai/sdk";

/** Vision Agent의 Function Calling 도구 정의 */
export const VISION_TOOLS: Anthropic.Tool[] = [
  {
    name: "analyze_screenshot",
    description:
      "Analyze a UI screenshot and return structured component, entity, and palette data",
    input_schema: {
      type: "object" as const,
      properties: {
        components: {
          type: "array",
          description: "Hierarchical component structure",
          items: {
            type: "object",
            properties: {
              role: {
                type: "string",
                enum: ["page", "section", "component", "element"],
              },
              name: { type: "string", description: "PascalCase component name" },
              description: { type: "string" },
              layout: {
                type: "string",
                enum: ["flex-row", "flex-col", "grid", "absolute"],
              },
              children: {
                type: "array",
                description: "Nested child components",
                items: {
                  type: "object",
                  properties: {
                    role: {
                      type: "string",
                      enum: ["page", "section", "component", "element"],
                    },
                    name: { type: "string" },
                    description: { type: "string" },
                    layout: {
                      type: "string",
                      enum: ["flex-row", "flex-col", "grid", "absolute"],
                    },
                  },
                  required: ["role", "name", "description"],
                },
              },
            },
            required: ["role", "name", "description"],
          },
        },
        entities: {
          type: "array",
          description: "Data entities inferred from the UI",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                description: "PascalCase entity name (e.g., User, Post)",
              },
              description: { type: "string" },
              fields: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "camelCase field name" },
                    type: {
                      type: "string",
                      enum: [
                        "string",
                        "number",
                        "boolean",
                        "date",
                        "enum",
                        "json",
                      ],
                    },
                    description: { type: "string" },
                    isRequired: { type: "boolean" },
                    isUnique: { type: "boolean" },
                    enumValues: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["name", "type", "description", "isRequired"],
                },
              },
              relations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    targetEntity: { type: "string" },
                    type: {
                      type: "string",
                      enum: ["one-to-one", "one-to-many", "many-to-many"],
                    },
                    description: { type: "string" },
                  },
                  required: ["targetEntity", "type", "description"],
                },
              },
            },
            required: ["name", "description", "fields"],
          },
        },
        palette: {
          type: "object",
          description: "Color palette extracted from the design",
          properties: {
            primary: { type: "string", description: "Hex color code" },
            secondary: { type: "string" },
            background: { type: "string" },
            surface: { type: "string" },
            text: { type: "string" },
            accent: { type: "string" },
          },
          required: ["primary", "secondary", "background", "surface", "text"],
        },
        layoutType: {
          type: "string",
          enum: ["dashboard", "form", "list", "detail", "landing", "mixed"],
        },
        description: {
          type: "string",
          description: "Brief description of the overall UI",
        },
      },
      required: [
        "components",
        "entities",
        "palette",
        "layoutType",
        "description",
      ],
    },
  },
];

/** Schema Agent의 Function Calling 도구 정의 */
export const SCHEMA_TOOLS: Anthropic.Tool[] = [
  {
    name: "generate_prisma_schema",
    description:
      "Generate a complete Prisma schema string based on entity hints",
    input_schema: {
      type: "object" as const,
      properties: {
        schema: {
          type: "string",
          description:
            "Complete Prisma schema content including datasource, generator, and all models. Must be valid Prisma syntax.",
        },
      },
      required: ["schema"],
    },
  },
];
