/**
 * Vision Agent 관련 타입 정의
 */

/** 스크린샷에서 감지된 컴포넌트 힌트 */
export interface ComponentHint {
  role: "page" | "section" | "component" | "element";
  name: string;
  description: string;
  bounds?: { x: number; y: number; width: number; height: number };
  layout?: "flex-row" | "flex-col" | "grid" | "absolute";
  children?: ComponentHint[];
}

/** 스크린샷에서 추론된 데이터 엔티티 */
export interface EntityHint {
  name: string;
  description: string;
  fields: EntityFieldHint[];
  relations?: EntityRelationHint[];
}

export interface EntityFieldHint {
  name: string;
  type: "string" | "number" | "boolean" | "date" | "enum" | "json";
  description: string;
  isRequired: boolean;
  isUnique?: boolean;
  enumValues?: string[];
}

export interface EntityRelationHint {
  targetEntity: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
  description: string;
}

/** 색상 팔레트 */
export interface ColorPalette {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
  accent?: string;
  [key: string]: string | undefined;
}

/** Vision Agent 전체 분석 결과 */
export interface VisionAnalysis {
  components: ComponentHint[];
  entities: EntityHint[];
  palette: ColorPalette;
  layoutType: "dashboard" | "form" | "list" | "detail" | "landing" | "mixed";
  description: string;
}
