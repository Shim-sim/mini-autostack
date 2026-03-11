/**
 * Mini AutoStack 파이프라인 이벤트 시스템
 *
 * AutoBe의 65개+ 이벤트 타입 패턴을 미러링한다.
 * 모든 이벤트는 Discriminated Union으로 정의하여
 * 컴파일 타임에 타입 안전성을 보장한다.
 *
 * @see https://autobe.dev/docs/agent/event/
 */

import type {
  ComponentHint,
  EntityHint,
  ColorPalette,
  VisionAnalysis,
} from "./vision.js";
import type { ComponentSpec, GeneratedComponent } from "./codegen.js";
import type { EndpointSummary } from "./api.js";
import type { CompilerDiagnostic, LayoutDiff } from "./validation.js";
import type { FinalOutput } from "./index.js";

export type PipelinePhase =
  | "vision"
  | "schema"
  | "api"
  | "codegen"
  | "validate"
  | "heal";

export type PipelineEvent =
  // ── Vision Phase ──
  | { type: "vision:start"; payload: { imageSource: string } }
  | {
      type: "vision:analyze:components";
      payload: { components: ComponentHint[] };
    }
  | { type: "vision:analyze:entities"; payload: { entities: EntityHint[] } }
  | { type: "vision:analyze:palette"; payload: { colors: ColorPalette } }
  | { type: "vision:complete"; payload: VisionAnalysis }
  | { type: "vision:error"; payload: { error: string } }

  // ── Schema Phase (백엔드 - DB) ──
  | { type: "schema:start"; payload: { entities: EntityHint[] } }
  | { type: "schema:generate:complete"; payload: { prismaSchema: string } }
  | { type: "schema:validate:start"; payload: { prismaSchema: string } }
  | {
      type: "schema:validate:pass";
      payload: { tableCount: number; relationCount: number };
    }
  | {
      type: "schema:validate:fail";
      payload: { errors: CompilerDiagnostic[] };
    }
  | {
      type: "schema:heal:start";
      payload: { attempt: number; feedback: string };
    }
  | { type: "schema:heal:complete"; payload: { prismaSchema: string } }
  | {
      type: "schema:complete";
      payload: { prismaSchema: string; tables: string[] };
    }
  | { type: "schema:error"; payload: { error: string } }

  // ── API Phase (백엔드 - OpenAPI) ──
  | { type: "api:start"; payload: { tables: string[] } }
  | { type: "api:generate:complete"; payload: { openApiSpec: string } }
  | { type: "api:validate:start"; payload: { openApiSpec: string } }
  | {
      type: "api:validate:pass";
      payload: { endpointCount: number; schemaCount: number };
    }
  | { type: "api:validate:fail"; payload: { errors: CompilerDiagnostic[] } }
  | {
      type: "api:heal:start";
      payload: { attempt: number; feedback: string };
    }
  | { type: "api:heal:complete"; payload: { openApiSpec: string } }
  | {
      type: "api:complete";
      payload: { openApiSpec: string; endpoints: EndpointSummary[] };
    }
  | { type: "api:error"; payload: { error: string } }

  // ── Codegen Phase (프론트엔드) ──
  | { type: "codegen:start"; payload: { componentSpecs: ComponentSpec[] } }
  | {
      type: "codegen:generate:component";
      payload: { name: string; tsx: string };
    }
  | {
      type: "codegen:complete";
      payload: { components: GeneratedComponent[]; totalTokens: number };
    }
  | { type: "codegen:error"; payload: { error: string } }

  // ── Validate Phase ──
  | { type: "validate:start"; payload: { componentCount: number } }
  | { type: "validate:ast:pass"; payload: { component: string } }
  | {
      type: "validate:ast:fail";
      payload: { component: string; errors: string[] };
    }
  | { type: "validate:layout:start"; payload: { component: string } }
  | {
      type: "validate:layout:pass";
      payload: { component: string; similarity: number };
    }
  | {
      type: "validate:layout:fail";
      payload: { component: string; similarity: number; diff: LayoutDiff };
    }
  | {
      type: "validate:complete";
      payload: { passCount: number; failCount: number };
    }

  // ── Heal Phase ──
  | {
      type: "heal:start";
      payload: { component: string; attempt: number; diff: LayoutDiff };
    }
  | { type: "heal:complete"; payload: { component: string; newTsx: string } }
  | {
      type: "heal:give-up";
      payload: {
        component: string;
        attempts: number;
        lastSimilarity: number;
      };
    }

  // ── Pipeline ──
  | {
      type: "pipeline:start";
      payload: { imageSource: string; startedAt: string };
    }
  | {
      type: "pipeline:phase:transition";
      payload: { from: PipelinePhase; to: PipelinePhase };
    }
  | { type: "pipeline:complete"; payload: FinalOutput }
  | { type: "pipeline:error"; payload: { error: string; phase: PipelinePhase } };

/** 이벤트 타입에서 type 문자열만 추출하는 유틸리티 타입 */
export type PipelineEventType = PipelineEvent["type"];

/** 특정 이벤트 타입의 payload를 추출하는 유틸리티 타입 */
export type EventPayload<T extends PipelineEventType> = Extract<
  PipelineEvent,
  { type: T }
>["payload"];
