/**
 * 검증 결과 타입 — Discriminated Union
 *
 * AutoBe의 IAutoBeDatabaseValidation 패턴을 미러링.
 * 성공(ISuccess) 또는 실패(IFailure) 중 하나.
 *
 * @see https://autobe.dev/docs/concepts/compiler/
 */

export type ValidationResult =
  | ValidationResult.ISuccess
  | ValidationResult.IFailure;

export namespace ValidationResult {
  export interface ISuccess {
    success: true;
    data: {
      message: string;
      stats?: Record<string, number>;
    };
  }

  export interface IFailure {
    success: false;
    errors: CompilerDiagnostic[];
    /**
     * 에이전트가 이해할 수 있는 형태로 변환된 피드백.
     * AutoBe Delta의 Validation Feedback Stringify 패턴.
     *
     * @see https://autobe.dev/docs/roadmap/delta/#23-validation-feedback-stringify
     */
    feedback: string;
  }
}

export interface CompilerDiagnostic {
  severity: "error" | "warning";
  message: string;
  location?: {
    file?: string;
    line?: number;
    column?: number;
  };
  suggestion?: string;
}

/** Layout Diff 결과 */
export interface LayoutDiff {
  similarity: number;
  mismatches: LayoutMismatch[];
}

export interface LayoutMismatch {
  path: string;
  type: "missing" | "extra" | "type-mismatch" | "attribute-mismatch";
  expected?: string;
  actual?: string;
  severity: "critical" | "minor";
}

/** AST에서 추출한 레이아웃 트리 */
export interface LayoutNode {
  tag: string;
  className?: string;
  attributes: Record<string, string>;
  children: LayoutNode[];
  depth: number;
}
