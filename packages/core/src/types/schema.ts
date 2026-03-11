/**
 * Schema Agent 관련 타입 정의
 * AutoBe의 AutoBeDatabase.IApplication 패턴을 참고
 */

export interface SchemaGenerationResult {
  prismaSchema: string;
  tables: TableSummary[];
  relations: RelationSummary[];
}

export interface TableSummary {
  name: string;
  fieldCount: number;
  fields: string[];
}

export interface RelationSummary {
  from: string;
  to: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
  foreignKey: string;
}
