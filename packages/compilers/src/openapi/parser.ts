import YAML from "yaml";

/** OpenAPI 명세에서 경로 목록 추출 */
export function extractPaths(spec: string): string[] {
  try {
    const parsed = YAML.parse(spec);
    return parsed?.paths ? Object.keys(parsed.paths) : [];
  } catch {
    return [];
  }
}

/** OpenAPI 명세에서 스키마 이름 목록 추출 */
export function extractSchemaNames(spec: string): string[] {
  try {
    const parsed = YAML.parse(spec);
    return parsed?.components?.schemas
      ? Object.keys(parsed.components.schemas)
      : [];
  } catch {
    return [];
  }
}
