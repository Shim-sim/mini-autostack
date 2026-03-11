import Anthropic from "@anthropic-ai/sdk";

/**
 * Claude API 클라이언트
 * Vision (이미지 분석) + Function Calling (구조화된 출력) 지원
 */
export class ClaudeClient {
  private client: Anthropic;
  private model: string;
  private totalTokens = { input: 0, output: 0 };

  constructor(model: string = "claude-sonnet-4-20250514") {
    this.client = new Anthropic();
    this.model = model;
  }

  async analyzeImage(
    imageBase64: string,
    mediaType: "image/png" | "image/jpeg" | "image/webp",
    systemPrompt: string,
    userPrompt: string,
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
    });

    this.trackTokens(response.usage);
    return this.extractText(response);
  }

  async callWithTools<T>(
    systemPrompt: string,
    userPrompt: string,
    tools: Anthropic.Tool[],
    toolChoice?: Anthropic.ToolChoice,
  ): Promise<{ result: T; rawResponse: Anthropic.Message }> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      tools,
      tool_choice: toolChoice ?? { type: "auto" },
    });

    this.trackTokens(response.usage);

    const toolUseBlock = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );

    if (!toolUseBlock) {
      throw new Error("No tool use block in response");
    }

    return { result: toolUseBlock.input as T, rawResponse: response };
  }

  async generate(
    systemPrompt: string,
    messages: Anthropic.MessageParam[],
  ): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 8192,
      system: systemPrompt,
      messages,
    });

    this.trackTokens(response.usage);
    return this.extractText(response);
  }

  getTokenUsage() {
    return { ...this.totalTokens };
  }

  private trackTokens(usage: Anthropic.Usage) {
    this.totalTokens.input += usage.input_tokens;
    this.totalTokens.output += usage.output_tokens;
  }

  private extractText(response: Anthropic.Message): string {
    return response.content
      .filter(
        (block): block is Anthropic.TextBlock => block.type === "text",
      )
      .map((block) => block.text)
      .join("\n");
  }
}
