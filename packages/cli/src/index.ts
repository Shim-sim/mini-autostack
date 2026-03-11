import * as fs from "node:fs";
import * as path from "node:path";
import { Pipeline } from "./pipeline.js";
import { scaffoldProject } from "./scaffold.js";

async function main() {
  const args = process.argv.slice(2);

  const imageIndex = args.indexOf("--image");
  if (imageIndex === -1 || !args[imageIndex + 1]) {
    console.error("Usage: mini-autostack --image <path-to-screenshot>");
    console.error("");
    console.error("Options:");
    console.error("  --image <path>    Path to Figma screenshot (PNG/JPG/WebP)");
    console.error("  --output <dir>    Output directory (default: ./output)");
    process.exit(1);
  }

  const imagePath = args[imageIndex + 1];
  if (!fs.existsSync(imagePath)) {
    console.error(`File not found: ${imagePath}`);
    process.exit(1);
  }

  const outIndex = args.indexOf("--output");
  const outDir = path.resolve(
    outIndex !== -1 && args[outIndex + 1] ? args[outIndex + 1] : "./output",
  );

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
          if (!process.env[key]) process.env[key] = value;
        }
      }
    }
  } catch {
    // best-effort
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "ANTHROPIC_API_KEY not set. Create a .env file or set the environment variable.",
    );
    process.exit(1);
  }

  console.log("\n  Mini AutoStack\n");
  console.log(`  Image:  ${imagePath}`);
  console.log(`  Output: ${outDir}\n`);

  const pipeline = new Pipeline({ verbose: true });

  try {
    const { output, vision } = await pipeline.run(imagePath);

    // Scaffold: Vite + React + TailwindCSS 프로젝트 생성
    console.log("\n  Scaffolding project...\n");
    scaffoldProject(outDir, output, vision);

    console.log("  ========== DONE ==========\n");
    console.log(`  Prisma Schema : ${output.prismaSchema.split("\n").length} lines`);
    console.log(`  OpenAPI Spec  : ${output.openApiSpec.split("\n").length} lines`);
    console.log(`  Components    : ${output.components.map((c) => c.name).join(", ")}`);
    console.log(`  Heal attempts : ${output.iterations}`);
    console.log(`  Tokens        : ${output.totalTokens.input} in / ${output.totalTokens.output} out`);
    console.log(`  Time          : ${(output.elapsedMs / 1000).toFixed(1)}s`);
    console.log(`  Events        : ${output.events.length}`);
    console.log(`\n  Run your app:\n`);
    console.log(`    cd ${outDir}`);
    console.log(`    npm install`);
    console.log(`    npm run dev\n`);
  } catch (error) {
    console.error("\n  Pipeline failed:", error);
    process.exit(1);
  }
}

main();
