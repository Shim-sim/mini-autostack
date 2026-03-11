/**
 * Prisma 스키마 파싱 유틸리티
 */

/** 스키마에서 모델 이름 목록 추출 */
export function extractModelNames(schema: string): string[] {
  const matches = schema.matchAll(/^model\s+(\w+)\s*\{/gm);
  return Array.from(matches, (m) => m[1]);
}

/** 스키마에서 특정 모델의 필드 목록 추출 */
export function extractModelFields(
  schema: string,
  modelName: string,
): string[] {
  const modelRegex = new RegExp(
    `model\\s+${modelName}\\s*\\{([^}]+)\\}`,
    "s",
  );
  const match = schema.match(modelRegex);
  if (!match) return [];

  return match[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("@@"))
    .map((l) => {
      const fieldMatch = l.match(/^(\w+)/);
      return fieldMatch ? fieldMatch[1] : "";
    })
    .filter(Boolean);
}
