import type {
  PipelineEvent,
  PipelineEventType,
  EventPayload,
} from "../types/events.js";

/**
 * 타입 안전한 이벤트 이미터
 *
 * emit/on 시 이벤트 타입과 payload가 컴파일 타임에 검증된다.
 *
 * @example
 * ```typescript
 * const emitter = new TypedEventEmitter();
 * emitter.on("schema:validate:pass", (payload) => {
 *   console.log(payload.tableCount); // number로 추론
 * });
 * ```
 */
export class TypedEventEmitter {
  private listeners = new Map<string, Set<(payload: any) => void>>();
  private eventLog: PipelineEvent[] = [];

  on<T extends PipelineEventType>(
    type: T,
    listener: (payload: EventPayload<T>) => void,
  ): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);

    return () => {
      this.listeners.get(type)?.delete(listener);
    };
  }

  emit<T extends PipelineEventType>(
    type: T,
    payload: EventPayload<T>,
  ): void {
    const event = { type, payload } as PipelineEvent;
    this.eventLog.push(event);

    this.listeners.get(type)?.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`Event listener error for ${type}:`, error);
      }
    });
  }

  getEventLog(): readonly PipelineEvent[] {
    return this.eventLog;
  }

  clearLog(): void {
    this.eventLog = [];
  }
}
