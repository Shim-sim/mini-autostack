import type { PipelineEvent } from "../types/events.js";
import { TypedEventEmitter } from "./emitter.js";

/**
 * 이벤트를 콘솔에 로깅하는 헬퍼
 */
export function attachLogger(emitter: TypedEventEmitter): void {
  const allEventTypes: PipelineEvent["type"][] = [
    "pipeline:start",
    "pipeline:phase:transition",
    "pipeline:complete",
    "pipeline:error",
    "vision:start",
    "vision:complete",
    "vision:error",
    "schema:start",
    "schema:generate:complete",
    "schema:validate:pass",
    "schema:validate:fail",
    "schema:heal:start",
    "schema:complete",
    "schema:error",
    "api:start",
    "api:generate:complete",
    "api:validate:pass",
    "api:validate:fail",
    "api:heal:start",
    "api:complete",
    "api:error",
    "codegen:start",
    "codegen:generate:component",
    "codegen:complete",
    "codegen:error",
    "validate:start",
    "validate:ast:pass",
    "validate:ast:fail",
    "validate:layout:pass",
    "validate:layout:fail",
    "validate:complete",
    "heal:start",
    "heal:complete",
    "heal:give-up",
  ];

  for (const eventType of allEventTypes) {
    emitter.on(eventType as any, (payload: any) => {
      const timestamp = new Date().toISOString().slice(11, 23);
      const [phase, action] = eventType.split(":") as [string, string];
      console.log(
        `[${timestamp}] ${phase.toUpperCase().padEnd(9)} ${action?.padEnd(12) ?? ""} ${JSON.stringify(payload).slice(0, 120)}`,
      );
    });
  }
}
