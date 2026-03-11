# Mini AutoStack

Figma 스크린샷 하나를 입력받아 **실행 가능한 풀스택 웹 애플리케이션을 자동 생성**하는 AI 파이프라인 CLI 도구.

뤼튼테크놀로지스의 [AutoView](https://github.com/wrtnlabs/autoview)(프론트엔드) + [AutoBe](https://github.com/wrtnlabs/autobe)(백엔드) 시스템의 핵심 파이프라인을 미니 버전으로 재현한다.

## Demo

```bash
# 스크린샷 하나로 실행 가능한 웹앱 생성
npm run dev -- --image ./screenshot.png

# 결과물 실행
cd output
npm install
npm run dev
# → http://localhost:5173 에서 확인
```

## Architecture

```
Screenshot (PNG/JPG)
       │
       ▼
┌─────────────┐     ┌──────────────┐     ┌────────────┐     ┌──────────────┐
│   Vision     │────▶│   Schema     │────▶│    API     │────▶│   Codegen    │
│   Agent      │     │   Agent      │     │   Agent    │     │    Agent     │
│ (Screenshot) │     │ (Prisma DB)  │     │ (OpenAPI)  │     │  (React TSX) │
└─────────────┘     └──────┬───────┘     └─────┬──────┘     └──────┬───────┘
                           │                    │                    │
                    ┌──────▼───────┐     ┌─────▼──────┐     ┌──────▼───────┐
                    │   Prisma     │     │  OpenAPI    │     │     AST      │
                    │  Compiler    │     │  Compiler   │     │  Compiler    │
                    └──────┬───────┘     └─────┬──────┘     └──────┬───────┘
                           │                    │                    │
                           ▼                    ▼                    ▼
                    Self-Healing Loop    Self-Healing Loop    Layout Diff Loop
                           │                    │                    │
                           └────────────┬───────┘                    │
                                        ▼                            │
                                ┌──────────────┐                     │
                                │   Scaffold   │◀────────────────────┘
                                │  Generator   │
                                └──────┬───────┘
                                       ▼
                                output/
                                ├── package.json
                                ├── src/components/*.tsx
                                ├── src/api/mock.ts     ← fetch 인터셉트
                                ├── schema.prisma
                                └── openapi.yaml
```

## Design Decisions

### Discriminated Union
모든 파이프라인 이벤트(`PipelineEvent`), 검증 결과(`ValidationResult`)를 Discriminated Union으로 정의.
`type` 필드로 분기하면 TypeScript가 payload 타입을 자동 추론한다.

### Self-Healing Loop (Compiler Strategy)
코드를 직접 검증하지 않고 **컴파일러 진단 결과**를 에이전트에게 피드백한다.
- Prisma Compiler → Schema Agent
- OpenAPI Compiler → API Agent
- Babel AST + Layout Diff → Codegen Agent / Healer Agent

### Validation Feedback Stringify
에러를 `// ERROR: ...` 주석으로 원본 코드에 삽입하여 에이전트가 수정 위치를 직관적으로 파악.

### Dynamic Function Calling Schema
이전 Phase에서 생성된 리소스(테이블명 등)를 `enum`으로 제한하여, 존재하지 않는 리소스 참조를 차단.

### Mock API Layer
생성된 프로젝트는 실제 백엔드 없이 동작한다. `window.fetch`를 인터셉트하여 Vision에서 추출한 엔티티 기반 샘플 데이터를 반환.

## Monorepo Structure

| Package | Role | Mirrors |
|---------|------|---------|
| `@mini-autostack/core` | 공유 타입 + 이벤트 시스템 | `@autoview/interface`, `@autobe/interface` |
| `@mini-autostack/agents` | 5개 AI 에이전트 | `@autoview/agent`, `@autobe/agent` |
| `@mini-autostack/compilers` | 3개 검증기 | `@autoview/compiler`, `@autobe/compiler` |
| `@mini-autostack/cli` | CLI + Scaffold 생성기 | - |

## Usage

```bash
# Install
npm install

# Type check
npm run typecheck

# Test (41 tests)
npm test

# Generate (requires ANTHROPIC_API_KEY)
cp .env.example .env
# Edit .env with your API key
npm run dev -- --image ./screenshot.png

# Run generated app
cd output && npm install && npm run dev
```

## Tech Stack
- TypeScript (strict mode)
- Claude API (Vision + Function Calling)
- npm workspaces monorepo
- Vitest (41 tests)
- Babel AST for TSX parsing
- Generated output: Vite + React 19 + TailwindCSS 3

## Docs
- [Architecture](docs/architecture.md)
- [Type Design](docs/type-design.md)
- [AutoBe/AutoView Comparison](docs/autostack-vs-autobe.md)
