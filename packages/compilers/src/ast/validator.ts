import type { ValidationResult, CompilerDiagnostic } from "@mini-autostack/core";
import { stringifyValidationFeedback } from "@mini-autostack/core";
import { parse } from "@babel/parser";

/**
 * TSX AST Validator
 *
 * Babel 파서로 TSX 코드의 문법적 유효성을 검증한다.
 */
export class AstValidator {
  validate(tsx: string, componentName: string = "Component"): ValidationResult {
    const diagnostics: CompilerDiagnostic[] = [];

    // 빈 코드 체크
    if (!tsx.trim()) {
      diagnostics.push({
        severity: "error",
        message: "Empty TSX code",
      });
      return {
        success: false,
        errors: diagnostics,
        feedback: stringifyValidationFeedback(tsx, diagnostics),
      };
    }

    // Babel 파싱 시도
    try {
      parse(tsx, {
        sourceType: "module",
        plugins: ["typescript", "jsx"],
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const lineMatch = message.match(/\((\d+):(\d+)\)/);
      const line = lineMatch ? parseInt(lineMatch[1], 10) : undefined;
      const column = lineMatch ? parseInt(lineMatch[2], 10) : undefined;

      diagnostics.push({
        severity: "error",
        message: `TSX parse error: ${message}`,
        location: line ? { file: `${componentName}.tsx`, line, column } : undefined,
      });
    }

    // 기본 구조 체크
    if (!tsx.includes("export")) {
      diagnostics.push({
        severity: "warning",
        message: "No export statement found",
        suggestion: "Add 'export default' to the main component",
      });
    }

    if (!tsx.includes("return")) {
      diagnostics.push({
        severity: "warning",
        message: "No return statement found — component may not render anything",
      });
    }

    if (diagnostics.some((d) => d.severity === "error")) {
      return {
        success: false,
        errors: diagnostics,
        feedback: stringifyValidationFeedback(tsx, diagnostics),
      };
    }

    return {
      success: true,
      data: {
        message: `${componentName}.tsx parsed successfully`,
        stats: { lines: tsx.split("\n").length },
      },
    };
  }
}
