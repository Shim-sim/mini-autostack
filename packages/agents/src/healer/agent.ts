import type { LayoutDiff } from "@mini-autostack/core";
import { ClaudeClient, TypedEventEmitter } from "@mini-autostack/core";

/**
 * Healer Agent (Self-Healing)
 *
 * 검증 실패 시 피드백을 기반으로 코드를 수정한다.
 * Phase 4에서 프론트엔드 Layout Diff 기반 수정에 사용.
 */
export class HealerAgent {
  constructor(
    private claude: ClaudeClient,
    private emitter: TypedEventEmitter,
  ) {}

  async heal(
    componentName: string,
    originalTsx: string,
    diff: LayoutDiff,
    attempt: number,
  ): Promise<string> {
    this.emitter.emit("heal:start", {
      component: componentName,
      attempt,
      diff,
    });

    // Phase 4에서 구현
    throw new Error("HealerAgent not yet implemented — Phase 4");
  }
}
