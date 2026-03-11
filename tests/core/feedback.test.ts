import { describe, it, expect } from "vitest";
import {
  stringifyValidationFeedback,
  summarizeValidation,
} from "@mini-autostack/core";
import type { CompilerDiagnostic, ValidationResult } from "@mini-autostack/core";

describe("stringifyValidationFeedback", () => {
  it("should annotate lines with errors", () => {
    const code = `model User {
  id    String
  email String
  posts Post[]
}`;

    const diagnostics: CompilerDiagnostic[] = [
      {
        severity: "error",
        message: "Primary key must be Int with @id",
        location: { line: 2 },
        suggestion: "Use Int @id @default(autoincrement())",
      },
      {
        severity: "error",
        message: "Related model 'Post' does not exist",
        location: { line: 4 },
      },
    ];

    const result = stringifyValidationFeedback(code, diagnostics);

    expect(result).toContain("id    String");
    expect(result).toContain(
      "// ERROR: Primary key must be Int with @id → Use Int @id @default(autoincrement())",
    );
    expect(result).toContain(
      "// ERROR: Related model 'Post' does not exist",
    );
  });

  it("should handle global errors (no line number)", () => {
    const code = "model User {\n  id Int\n}";
    const diagnostics: CompilerDiagnostic[] = [
      {
        severity: "error",
        message: "Missing datasource block",
      },
    ];

    const result = stringifyValidationFeedback(code, diagnostics);

    expect(result).toContain("// ── GLOBAL ERRORS ──");
    expect(result).toContain("// ERROR: Missing datasource block");
  });

  it("should handle multiple errors on the same line", () => {
    const code = "model User {\n  email String\n}";
    const diagnostics: CompilerDiagnostic[] = [
      {
        severity: "error",
        message: "Missing @unique",
        location: { line: 2 },
      },
      {
        severity: "warning",
        message: "Consider adding @db.VarChar(255)",
        location: { line: 2 },
      },
    ];

    const result = stringifyValidationFeedback(code, diagnostics);
    const line2Errors = result
      .split("\n")
      .filter((l) => l.includes("// ERROR:"));

    expect(line2Errors).toHaveLength(2);
  });

  it("should not modify lines without errors", () => {
    const code = "model User {\n  id Int @id\n  email String\n}";
    const diagnostics: CompilerDiagnostic[] = [];

    const result = stringifyValidationFeedback(code, diagnostics);
    expect(result).toBe(code);
  });
});

describe("summarizeValidation", () => {
  it("should summarize success result", () => {
    const result: ValidationResult = {
      success: true,
      data: { message: "Schema is valid", stats: { tables: 3 } },
    };

    expect(summarizeValidation(result)).toContain("Validation passed");
    expect(summarizeValidation(result)).toContain("Schema is valid");
  });

  it("should summarize failure result", () => {
    const result: ValidationResult = {
      success: false,
      errors: [
        { severity: "error", message: "err1" },
        { severity: "error", message: "err2" },
        { severity: "warning", message: "warn1" },
      ],
      feedback: "annotated code here",
    };

    const summary = summarizeValidation(result);
    expect(summary).toContain("2 error(s)");
    expect(summary).toContain("1 warning(s)");
    expect(summary).toContain("annotated code here");
  });
});
