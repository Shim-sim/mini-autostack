import type {
  CompilerDiagnostic,
  ValidationResult,
} from "../types/validation.js";

/**
 * Validation Feedback Stringify
 *
 * 에러를 "// ERROR: ..." 주석 형태로 원본 코드에 삽입하여
 * 에이전트가 직관적으로 수정 위치와 방법을 파악할 수 있도록 한다.
 *
 * @see https://autobe.dev/docs/roadmap/delta/#23-validation-feedback-stringify
 */
export function stringifyValidationFeedback(
  originalCode: string,
  diagnostics: CompilerDiagnostic[],
): string {
  const lines = originalCode.split("\n");

  const errorsByLine = new Map<number, CompilerDiagnostic[]>();
  for (const diag of diagnostics) {
    const line = diag.location?.line ?? -1;
    if (!errorsByLine.has(line)) {
      errorsByLine.set(line, []);
    }
    errorsByLine.get(line)!.push(diag);
  }

  const annotatedLines = lines.map((line, idx) => {
    const lineNum = idx + 1;
    const errors = errorsByLine.get(lineNum);
    if (errors && errors.length > 0) {
      const errorComments = errors
        .map(
          (e) =>
            `  // ERROR: ${e.message}${e.suggestion ? ` → ${e.suggestion}` : ""}`,
        )
        .join("\n");
      return `${line}${errorComments}`;
    }
    return line;
  });

  const globalErrors = errorsByLine.get(-1) ?? [];
  if (globalErrors.length > 0) {
    annotatedLines.push("");
    annotatedLines.push("// ── GLOBAL ERRORS ──");
    for (const e of globalErrors) {
      annotatedLines.push(
        `// ERROR: ${e.message}${e.suggestion ? ` → ${e.suggestion}` : ""}`,
      );
    }
  }

  return annotatedLines.join("\n");
}

/**
 * ValidationResult를 사람이 읽기 좋은 요약으로 변환
 */
export function summarizeValidation(result: ValidationResult): string {
  if (result.success) {
    return `Validation passed: ${result.data.message}`;
  }

  const errorCount = result.errors.filter(
    (e) => e.severity === "error",
  ).length;
  const warnCount = result.errors.filter(
    (e) => e.severity === "warning",
  ).length;
  return `Validation failed: ${errorCount} error(s), ${warnCount} warning(s)\n${result.feedback}`;
}
