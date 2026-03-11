import * as fs from "node:fs";
import * as path from "node:path";
import type {
  FinalOutput,
  VisionAnalysis,
  EntityHint,
} from "@mini-autostack/core";

/**
 * Scaffold Generator
 *
 * 생성된 코드를 Vite + React + TailwindCSS 프로젝트로 조립하여
 * `npm install && npm run dev`로 바로 실행 가능한 형태로 출력한다.
 */
export function scaffoldProject(
  outDir: string,
  output: FinalOutput,
  vision: VisionAnalysis,
): void {
  // 디렉토리 구조 생성
  const dirs = ["src", "src/components", "src/api", "src/types", "public"];
  for (const dir of dirs) {
    fs.mkdirSync(path.join(outDir, dir), { recursive: true });
  }

  // ── 프로젝트 설정 파일 ──
  writePackageJson(outDir);
  writeViteConfig(outDir);
  writeTailwindConfig(outDir);
  writePostCssConfig(outDir);
  writeTsConfig(outDir);
  writeIndexHtml(outDir, vision.description);

  // ── 소스 코드 ──
  writeMainTsx(outDir);
  writeGlobalCss(outDir, vision);
  writeAppTsx(outDir, output, vision);
  writeComponents(outDir, output);
  writeMockApi(outDir, vision);
  writeTypes(outDir, vision);

  // ── Prisma & OpenAPI (참고용) ──
  fs.writeFileSync(path.join(outDir, "schema.prisma"), output.prismaSchema);
  fs.writeFileSync(path.join(outDir, "openapi.yaml"), output.openApiSpec);
}

function writePackageJson(outDir: string) {
  const pkg = {
    name: "mini-autostack-output",
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: {
      dev: "vite",
      build: "tsc -b && vite build",
      preview: "vite preview",
    },
    dependencies: {
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
    devDependencies: {
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
      "@vitejs/plugin-react": "^4.4.0",
      autoprefixer: "^10.4.20",
      postcss: "^8.5.0",
      tailwindcss: "^3.4.0",
      typescript: "^5.6.0",
      vite: "^6.0.0",
    },
  };
  fs.writeFileSync(
    path.join(outDir, "package.json"),
    JSON.stringify(pkg, null, 2),
  );
}

function writeViteConfig(outDir: string) {
  fs.writeFileSync(
    path.join(outDir, "vite.config.ts"),
    `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
  );
}

function writeTailwindConfig(outDir: string) {
  fs.writeFileSync(
    path.join(outDir, "tailwind.config.js"),
    `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
}
`,
  );
}

function writePostCssConfig(outDir: string) {
  fs.writeFileSync(
    path.join(outDir, "postcss.config.js"),
    `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`,
  );
}

function writeTsConfig(outDir: string) {
  const tsconfig = {
    compilerOptions: {
      target: "ES2020",
      useDefineForClassFields: true,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext",
      skipLibCheck: true,
      moduleResolution: "bundler",
      allowImportingTsExtensions: true,
      isolatedModules: true,
      moduleDetection: "force",
      noEmit: true,
      jsx: "react-jsx",
      strict: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
    },
    include: ["src"],
  };
  fs.writeFileSync(
    path.join(outDir, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2),
  );
}

function writeIndexHtml(outDir: string, description: string) {
  fs.writeFileSync(
    path.join(outDir, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${description.slice(0, 60)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  );
}

function writeMainTsx(outDir: string) {
  fs.writeFileSync(
    path.join(outDir, "src/main.tsx"),
    `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
  );
}

function writeGlobalCss(outDir: string, vision: VisionAnalysis) {
  const { palette } = vision;
  fs.writeFileSync(
    path.join(outDir, "src/index.css"),
    `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: ${palette.primary};
  --color-secondary: ${palette.secondary};
  --color-background: ${palette.background};
  --color-surface: ${palette.surface};
  --color-text: ${palette.text};
${palette.accent ? `  --color-accent: ${palette.accent};` : ""}
}

body {
  background-color: var(--color-background);
  color: var(--color-text);
  font-family: system-ui, -apple-system, sans-serif;
  margin: 0;
}
`,
  );
}

function writeAppTsx(
  outDir: string,
  output: FinalOutput,
  vision: VisionAnalysis,
) {
  const imports = output.components
    .map((c) => `import ${c.name} from './components/${c.name}'`)
    .join("\n");

  const renders = output.components
    .map((c) => `      <${c.name} />`)
    .join("\n");

  fs.writeFileSync(
    path.join(outDir, "src/App.tsx"),
    `${imports}

export default function App() {
  return (
    <div className="min-h-screen">
${renders}
    </div>
  )
}
`,
  );
}

function writeComponents(outDir: string, output: FinalOutput) {
  for (const comp of output.components) {
    // fetch() 호출을 mock API로 리다이렉트
    let tsx = comp.tsx;

    // 절대경로 fetch를 상대경로 mock import로 변환
    tsx = tsx.replace(
      /fetch\(['"`](\/\w+)['"`]\)/g,
      "fetch('$1')",
    );

    fs.writeFileSync(path.join(outDir, "src/components", comp.fileName), tsx);
  }
}

function writeMockApi(outDir: string, vision: VisionAnalysis) {
  // 엔티티별 mock 데이터 생성
  const mockData: Record<string, any[]> = {};

  for (const entity of vision.entities) {
    mockData[entity.name.toLowerCase()] = generateMockItems(entity, 5);
  }

  // Mock API 모듈
  fs.writeFileSync(
    path.join(outDir, "src/api/mock.ts"),
    `/**
 * Mock API — 실제 백엔드 없이 정적 데이터로 동작
 * 생성된 엔티티 기반 샘플 데이터
 */

const mockData: Record<string, any[]> = ${JSON.stringify(mockData, null, 2)};

// fetch를 가로채서 mock 데이터 반환
const originalFetch = window.fetch;

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input.toString();

  // API 경로 매칭
  for (const [resource, data] of Object.entries(mockData)) {
    // GET /resource or GET /resources
    if (url.match(new RegExp(\`^/\${resource}s?$\`, 'i')) && (!init?.method || init.method === 'GET')) {
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // GET /resource/:id
    const idMatch = url.match(new RegExp(\`^/\${resource}s?/(\\d+)$\`, 'i'));
    if (idMatch && (!init?.method || init.method === 'GET')) {
      const item = data.find(d => d.id === parseInt(idMatch[1]));
      if (item) {
        return new Response(JSON.stringify(item), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
    }

    // POST /resource
    if (url.match(new RegExp(\`^/\${resource}s?$\`, 'i')) && init?.method === 'POST') {
      const body = init.body ? JSON.parse(init.body as string) : {};
      const newItem = { id: data.length + 1, ...body, createdAt: new Date().toISOString() };
      data.push(newItem);
      return new Response(JSON.stringify(newItem), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // DELETE /resource/:id
    const deleteMatch = url.match(new RegExp(\`^/\${resource}s?/(\\d+)$\`, 'i'));
    if (deleteMatch && init?.method === 'DELETE') {
      const idx = data.findIndex(d => d.id === parseInt(deleteMatch[1]));
      if (idx >= 0) data.splice(idx, 1);
      return new Response(null, { status: 204 });
    }
  }

  // fallback: 원래 fetch
  return originalFetch(input, init);
};

export default mockData;
`,
  );

  // main.tsx에서 mock을 import하도록 (side-effect import)
  const mainPath = path.join(outDir, "src/main.tsx");
  const mainContent = fs.readFileSync(mainPath, "utf-8");
  fs.writeFileSync(
    mainPath,
    `import './api/mock'\n${mainContent}`,
  );
}

function writeTypes(outDir: string, vision: VisionAnalysis) {
  const interfaces = vision.entities
    .map((entity) => {
      const fields = entity.fields
        .map((f) => {
          const tsType = mapFieldType(f.type);
          return `  ${f.name}${f.isRequired ? "" : "?"}: ${tsType};`;
        })
        .join("\n");
      return `export interface ${entity.name} {\n  id: number;\n${fields}\n  createdAt: string;\n  updatedAt: string;\n}`;
    })
    .join("\n\n");

  fs.writeFileSync(
    path.join(outDir, "src/types/index.ts"),
    `${interfaces}\n`,
  );
}

function mapFieldType(type: string): string {
  switch (type) {
    case "string": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "date": return "string";
    case "enum": return "string";
    case "json": return "Record<string, unknown>";
    default: return "unknown";
  }
}

function generateMockItems(entity: EntityHint, count: number): any[] {
  const items: any[] = [];
  for (let i = 1; i <= count; i++) {
    const item: Record<string, any> = { id: i };
    for (const field of entity.fields) {
      item[field.name] = generateMockValue(field.type, field.name, i);
    }
    item.createdAt = new Date(Date.now() - i * 86400000).toISOString();
    item.updatedAt = new Date().toISOString();
    items.push(item);
  }
  return items;
}

function generateMockValue(type: string, fieldName: string, index: number): any {
  const name = fieldName.toLowerCase();

  // 필드명 기반 의미있는 데이터
  if (name.includes("email")) return `user${index}@example.com`;
  if (name.includes("name") || name.includes("title")) return `Sample ${fieldName} ${index}`;
  if (name.includes("description") || name.includes("content"))
    return `This is sample ${fieldName} content for item ${index}.`;
  if (name.includes("url") || name.includes("image"))
    return `https://picsum.photos/seed/${index}/400/300`;
  if (name.includes("price") || name.includes("amount")) return (index * 10.99).toFixed(2);
  if (name.includes("status")) return index % 2 === 0 ? "active" : "inactive";

  switch (type) {
    case "string": return `${fieldName}_${index}`;
    case "number": return index * 10;
    case "boolean": return index % 2 === 0;
    case "date": return new Date(Date.now() - index * 86400000).toISOString();
    case "enum": return `value_${index}`;
    case "json": return { key: `value_${index}` };
    default: return null;
  }
}
