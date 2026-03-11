import YAML from "yaml";
import type {
  ValidationResult,
  CompilerDiagnostic,
} from "@mini-autostack/core";
import { stringifyValidationFeedback } from "@mini-autostack/core";

/**
 * OpenAPI Specification Validator
 *
 * Compiler Strategy: OpenAPI 명세의 구조적 유효성을 검증한다.
 * - YAML 파싱 가능 여부
 * - OpenAPI 3.x 필수 필드 존재 여부
 * - $ref 참조 무결성
 * - 경로/메서드 구조 검증
 */
export class OpenApiValidator {
  async validate(
    specString: string,
    existingTables?: string[],
  ): Promise<ValidationResult> {
    const diagnostics: CompilerDiagnostic[] = [];

    // 1. YAML 파싱
    let spec: Record<string, any>;
    try {
      spec = YAML.parse(specString);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      diagnostics.push({
        severity: "error",
        message: `YAML parse error: ${message}`,
      });
      const feedback = stringifyValidationFeedback(specString, diagnostics);
      return { success: false, errors: diagnostics, feedback };
    }

    if (!spec || typeof spec !== "object") {
      diagnostics.push({
        severity: "error",
        message: "Parsed YAML is not an object",
      });
      const feedback = stringifyValidationFeedback(specString, diagnostics);
      return { success: false, errors: diagnostics, feedback };
    }

    // 2. 필수 필드 검증
    this.validateRequiredFields(spec, diagnostics);

    // 3. Paths 구조 검증
    this.validatePaths(spec, diagnostics);

    // 4. $ref 참조 무결성
    this.validateRefs(spec, diagnostics);

    // 5. 테이블 참조 검증 (존재하는 테이블만 참조하는지)
    if (existingTables) {
      this.validateTableRefs(spec, existingTables, diagnostics);
    }

    if (diagnostics.some((d) => d.severity === "error")) {
      const feedback = stringifyValidationFeedback(specString, diagnostics);
      return { success: false, errors: diagnostics, feedback };
    }

    // 성공
    const pathCount = spec.paths ? Object.keys(spec.paths).length : 0;
    const schemaCount = spec.components?.schemas
      ? Object.keys(spec.components.schemas).length
      : 0;

    return {
      success: true,
      data: {
        message: `OpenAPI spec is valid: ${pathCount} paths, ${schemaCount} schemas`,
        stats: { paths: pathCount, schemas: schemaCount },
      },
    };
  }

  private validateRequiredFields(
    spec: Record<string, any>,
    diagnostics: CompilerDiagnostic[],
  ): void {
    if (!spec.openapi) {
      diagnostics.push({
        severity: "error",
        message: "Missing 'openapi' version field",
        suggestion: "Add: openapi: '3.1.0'",
      });
    } else if (
      typeof spec.openapi === "string" &&
      !spec.openapi.startsWith("3.")
    ) {
      diagnostics.push({
        severity: "error",
        message: `Unsupported OpenAPI version: ${spec.openapi}`,
        suggestion: "Use OpenAPI 3.0.x or 3.1.x",
      });
    }

    if (!spec.info) {
      diagnostics.push({
        severity: "error",
        message: "Missing 'info' object",
        suggestion: "Add: info: { title: 'API', version: '1.0.0' }",
      });
    } else {
      if (!spec.info.title) {
        diagnostics.push({
          severity: "error",
          message: "Missing 'info.title'",
        });
      }
      if (!spec.info.version) {
        diagnostics.push({
          severity: "error",
          message: "Missing 'info.version'",
        });
      }
    }

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      diagnostics.push({
        severity: "error",
        message: "Missing or empty 'paths' object",
        suggestion: "Add at least one API path",
      });
    }
  }

  private validatePaths(
    spec: Record<string, any>,
    diagnostics: CompilerDiagnostic[],
  ): void {
    if (!spec.paths) return;

    const validMethods = [
      "get",
      "post",
      "put",
      "patch",
      "delete",
      "options",
      "head",
      "trace",
    ];

    for (const [pathKey, pathItem] of Object.entries(spec.paths)) {
      if (!pathKey.startsWith("/")) {
        diagnostics.push({
          severity: "error",
          message: `Path must start with '/': ${pathKey}`,
        });
      }

      if (!pathItem || typeof pathItem !== "object") continue;

      for (const [method, operation] of Object.entries(
        pathItem as Record<string, any>,
      )) {
        if (method === "parameters" || method === "$ref") continue;

        if (!validMethods.includes(method)) {
          diagnostics.push({
            severity: "warning",
            message: `Unknown HTTP method '${method}' in ${pathKey}`,
          });
          continue;
        }

        if (!operation || typeof operation !== "object") continue;

        if (!(operation as any).responses) {
          diagnostics.push({
            severity: "error",
            message: `Missing 'responses' in ${method.toUpperCase()} ${pathKey}`,
            suggestion: "Add at least one response (e.g., 200)",
          });
        }
      }
    }
  }

  private validateRefs(
    spec: Record<string, any>,
    diagnostics: CompilerDiagnostic[],
  ): void {
    const refs = this.collectRefs(spec);
    const definedSchemas = new Set<string>();

    if (spec.components?.schemas) {
      for (const name of Object.keys(spec.components.schemas)) {
        definedSchemas.add(`#/components/schemas/${name}`);
      }
    }

    for (const ref of refs) {
      if (ref.startsWith("#/components/schemas/") && !definedSchemas.has(ref)) {
        diagnostics.push({
          severity: "error",
          message: `Undefined $ref: ${ref}`,
          suggestion: `Define the schema in components.schemas or fix the reference`,
        });
      }
    }
  }

  private collectRefs(obj: any, refs: Set<string> = new Set()): Set<string> {
    if (!obj || typeof obj !== "object") return refs;

    if (typeof obj.$ref === "string") {
      refs.add(obj.$ref);
    }

    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          this.collectRefs(item, refs);
        }
      } else if (typeof value === "object" && value !== null) {
        this.collectRefs(value, refs);
      }
    }

    return refs;
  }

  private validateTableRefs(
    spec: Record<string, any>,
    existingTables: string[],
    diagnostics: CompilerDiagnostic[],
  ): void {
    const tableSet = new Set(existingTables.map((t) => t.toLowerCase()));

    if (spec.components?.schemas) {
      for (const schemaName of Object.keys(spec.components.schemas)) {
        const lower = schemaName.toLowerCase();
        // 허용: 정확히 매치되거나, Create/Update/Response 같은 접미사
        const baseName = lower
          .replace(/(create|update|response|request|input|list|pagination)$/i, "")
          .toLowerCase();

        if (baseName && !tableSet.has(baseName) && !tableSet.has(lower)) {
          diagnostics.push({
            severity: "warning",
            message: `Schema '${schemaName}' may not correspond to any existing table`,
            suggestion: `Available tables: ${existingTables.join(", ")}`,
          });
        }
      }
    }
  }
}
