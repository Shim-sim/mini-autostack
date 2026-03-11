/**
 * Codegen Agent 관련 타입 정의
 */

export interface ComponentSpec {
  name: string;
  role: "page" | "section" | "component";
  description: string;
  props?: PropSpec[];
  layout: LayoutSpec;
  apiEndpoints?: string[];
  children?: ComponentSpec[];
}

export interface PropSpec {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface LayoutSpec {
  type: "flex-row" | "flex-col" | "grid" | "absolute";
  tailwindClasses?: string[];
}

export interface GeneratedComponent {
  name: string;
  fileName: string;
  tsx: string;
  imports: string[];
}
