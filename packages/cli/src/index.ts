import * as fs from "node:fs";
import * as path from "node:path";
import { Pipeline } from "./pipeline.js";

async function main() {
  const args = process.argv.slice(2);

  // 간단한 CLI 인자 파싱
  const imageIndex = args.indexOf("--image");
  if (imageIndex === -1 || !args[imageIndex + 1]) {
    console.error("Usage: mini-autostack --image <path-to-screenshot>");
    console.error("Example: mini-autostack --image ./screenshot.png");
    process.exit(1);
  }

  const imagePath = args[imageIndex + 1];
  if (!fs.existsSync(imagePath)) {
    console.error(`File not found: ${imagePath}`);
    process.exit(1);
  }

  // .env 로드
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, "utf-8");
      for (const line of envContent.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const value = trimmed.slice(eqIdx + 1).trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  } catch {
    // .env loading is best-effort
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY not set. Create a .env file or set the environment variable.");
    process.exit(1);
  }

  console.log(`\nMini AutoStack — Generating fullstack code from screenshot\n`);
  console.log(`Image: ${imagePath}\n`);

  const pipeline = new Pipeline({ verbose: true });

  try {
    const result = await pipeline.run(imagePath);

    console.log("\n========== RESULTS ==========\n");
    console.log(`Prisma Schema (${result.prismaSchema.split("\n").length} lines)`);
    console.log(`OpenAPI Spec (${result.openApiSpec.split("\n").length} lines)`);
    console.log(`Components: ${result.components.map((c) => c.name).join(", ")}`);
    console.log(`Tokens: ${result.totalTokens.input} input, ${result.totalTokens.output} output`);
    console.log(`Time: ${(result.elapsedMs / 1000).toFixed(1)}s`);
    console.log(`Events: ${result.events.length}`);

    // 결과 파일 출력
    const outDir = path.resolve(process.cwd(), "output");
    fs.mkdirSync(outDir, { recursive: true });

    fs.writeFileSync(
      path.join(outDir, "schema.prisma"),
      result.prismaSchema,
    );
    fs.writeFileSync(
      path.join(outDir, "openapi.yaml"),
      result.openApiSpec,
    );
    for (const comp of result.components) {
      fs.writeFileSync(path.join(outDir, comp.fileName), comp.tsx);
    }

    console.log(`\nOutput written to: ${outDir}`);
  } catch (error) {
    console.error("\nPipeline failed:", error);
    process.exit(1);
  }
}

main();
