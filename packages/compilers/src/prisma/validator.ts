import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type {
  ValidationResult,
  CompilerDiagnostic,
} from "@mini-autostack/core";
import { stringifyValidationFeedback } from "@mini-autostack/core";

const execFileAsync = promisify(execFile);

/**
 * Prisma Schema Validator
 *
 * Compiler Strategy: Prisma CLI의 `prisma validate`로 스키마를 검증.
 * 직접 검증하지 않고 컴파일러 진단 결과를 활용한다.
 *
 * @see https://autobe.dev/docs/concepts/compiler/
 */
export class PrismaValidator {
  /**
   * Prisma 스키마 문자열의 유효성을 검증한다.
   *
   * 1. 임시 디렉토리에 schema.prisma 파일 생성
   * 2. `prisma validate` CLI 실행
   * 3. 결과 파싱 → ValidationResult 반환
   */
  async validate(prismaSchema: string): Promise<ValidationResult> {
    // 기본 구조 검증 (prisma CLI 호출 전 빠른 실패)
    const quickErrors = this.quickCheck(prismaSchema);
    if (quickErrors.length > 0) {
      const feedback = stringifyValidationFeedback(prismaSchema, quickErrors);
      return { success: false, errors: quickErrors, feedback };
    }

    // 임시 디렉토리에 스키마 파일 작성
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "prisma-validate-"));
    const schemaPath = path.join(tmpDir, "schema.prisma");

    try {
      fs.writeFileSync(schemaPath, prismaSchema, "utf-8");

      // prisma validate 실행
      const prismaPath = this.findPrismaBinary();
      await execFileAsync(prismaPath, ["validate", "--schema", schemaPath], {
        timeout: 30000,
        env: {
          ...process.env,
          PRISMA_HIDE_UPDATE_MESSAGE: "true",
          // 검증 전용: 실제 DB 연결 불필요, 더미 URL로 env() 참조 해소
          DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://dummy:dummy@localhost:5432/dummy",
        },
      });

      // 성공
      const modelCount = (prismaSchema.match(/^model\s+/gm) ?? []).length;
      const relationCount = (prismaSchema.match(/@relation/g) ?? []).length;

      return {
        success: true,
        data: {
          message: `Schema is valid: ${modelCount} models, ${relationCount} relations`,
          stats: { models: modelCount, relations: relationCount },
        },
      };
    } catch (error: unknown) {
      // prisma validate 실패 → 에러 파싱
      const stderr =
        error instanceof Error && "stderr" in error
          ? (error as { stderr: string }).stderr
          : String(error);

      const diagnostics = this.parsePrismaErrors(stderr, prismaSchema);
      const feedback = stringifyValidationFeedback(prismaSchema, diagnostics);

      return { success: false, errors: diagnostics, feedback };
    } finally {
      // 임시 파일 정리
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  /** 빠른 구조 검증 (prisma CLI 없이) */
  private quickCheck(schema: string): CompilerDiagnostic[] {
    const errors: CompilerDiagnostic[] = [];

    // datasource 블록 확인
    if (!schema.includes("datasource")) {
      errors.push({
        severity: "error",
        message: "Missing datasource block",
        suggestion:
          'Add: datasource db { provider = "postgresql" url = env("DATABASE_URL") }',
      });
    }

    // generator 블록 확인
    if (!schema.includes("generator")) {
      errors.push({
        severity: "warning",
        message: "Missing generator block",
        suggestion:
          'Add: generator client { provider = "prisma-client-js" }',
      });
    }

    // 최소 1개 모델 확인
    if (!schema.match(/^model\s+/m)) {
      errors.push({
        severity: "error",
        message: "No models defined in schema",
      });
    }

    return errors;
  }

  /** Prisma CLI 에러 출력을 CompilerDiagnostic[]으로 파싱 */
  private parsePrismaErrors(
    stderr: string,
    schema: string,
  ): CompilerDiagnostic[] {
    const diagnostics: CompilerDiagnostic[] = [];

    // Prisma error format: "error: ..." with optional line numbers
    const errorPattern = /error:?\s*(.+?)(?:\n|$)/gi;
    let match: RegExpExecArray | null;

    while ((match = errorPattern.exec(stderr)) !== null) {
      const message = match[1].trim();
      if (!message) continue;

      // 라인 번호 추출 시도
      const lineMatch = stderr
        .slice(match.index)
        .match(/-->.*?:(\d+)/);
      const line = lineMatch ? parseInt(lineMatch[1], 10) : undefined;

      diagnostics.push({
        severity: "error",
        message,
        location: line ? { line } : undefined,
      });
    }

    // 에러를 파싱하지 못한 경우 전체 stderr를 하나의 에러로
    if (diagnostics.length === 0 && stderr.trim()) {
      diagnostics.push({
        severity: "error",
        message: stderr.trim().slice(0, 500),
      });
    }

    return diagnostics;
  }

  private findPrismaBinary(): string {
    // cwd부터 상위로 올라가며 node_modules/.bin/prisma 탐색
    const searchRoots = [process.cwd(), __dirname];
    for (const root of searchRoots) {
      let dir = root;
      for (let i = 0; i < 10; i++) {
        const candidate = path.join(dir, "node_modules", ".bin", "prisma");
        if (fs.existsSync(candidate)) return candidate;
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
    return "prisma";
  }
}
