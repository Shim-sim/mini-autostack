import * as fs from "node:fs";
import * as path from "node:path";
import type { VisionAnalysis } from "@mini-autostack/core";
import { ClaudeClient, TypedEventEmitter } from "@mini-autostack/core";
import { VISION_SYSTEM_PROMPT, VISION_USER_PROMPT } from "./prompts.js";
import { VISION_TOOLS } from "../schema/functions.js";

/**
 * Vision Agent
 *
 * 스크린샷을 분석하여 컴포넌트 구조, 데이터 엔티티, 색상 팔레트를 추출한다.
 * Claude Vision API + Function Calling으로 구조화된 결과를 생성.
 */
export class VisionAgent {
  constructor(
    private claude: ClaudeClient,
    private emitter: TypedEventEmitter,
  ) {}

  async analyze(imagePath: string): Promise<VisionAnalysis> {
    this.emitter.emit("vision:start", { imageSource: imagePath });

    try {
      const { base64, mediaType } = this.loadImage(imagePath);

      // Claude Vision + Function Calling
      const response = await this.claude.analyzeImage(
        base64,
        mediaType,
        VISION_SYSTEM_PROMPT,
        VISION_USER_PROMPT,
      );

      // Vision API는 텍스트로 응답하므로, Function Calling으로 재호출
      const { result } = await this.claude.callWithTools<VisionAnalysis>(
        VISION_SYSTEM_PROMPT,
        `Here is the analysis of the screenshot:\n\n${response}\n\nNow call the analyze_screenshot tool with the structured data.`,
        VISION_TOOLS,
        { type: "tool", name: "analyze_screenshot" },
      );

      // 단계별 이벤트 emit
      this.emitter.emit("vision:analyze:components", {
        components: result.components,
      });
      this.emitter.emit("vision:analyze:entities", {
        entities: result.entities,
      });
      this.emitter.emit("vision:analyze:palette", {
        colors: result.palette,
      });
      this.emitter.emit("vision:complete", result);

      return result;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);
      this.emitter.emit("vision:error", { error: message });
      throw error;
    }
  }

  private loadImage(imagePath: string): {
    base64: string;
    mediaType: "image/png" | "image/jpeg" | "image/webp";
  } {
    const absolutePath = path.resolve(imagePath);
    const buffer = fs.readFileSync(absolutePath);
    const base64 = buffer.toString("base64");

    const ext = path.extname(imagePath).toLowerCase();
    const mediaTypeMap: Record<
      string,
      "image/png" | "image/jpeg" | "image/webp"
    > = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    };

    const mediaType = mediaTypeMap[ext];
    if (!mediaType) {
      throw new Error(
        `Unsupported image format: ${ext}. Use PNG, JPG, or WebP.`,
      );
    }

    return { base64, mediaType };
  }
}
