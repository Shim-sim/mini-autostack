# Mini AutoStack

Figma 스크린샷 하나를 입력받아 **풀스택 애플리케이션 코드를 자동 생성**하는 AI 파이프라인 CLI 도구.

뤼튼테크놀로지스의 [AutoView](https://github.com/wrtnlabs/autoview)(프론트엔드) + [AutoBe](https://github.com/wrtnlabs/autobe)(백엔드) 시스템의 핵심 파이프라인을 미니 버전으로 재현한다.

## Architecture

```
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
                    (max 3 attempts)     (max 3 attempts)     (similarity ≥ 0.7)
```

## Design Decisions

### Discriminated Union
모든 파이프라인 이벤트(`PipelineEvent`), 검증 결과(`ValidationResult`)를 Discriminated Union으로 정의.
`type` 필드로 분기하면 TypeScript가 payload 타입을 자동 추론한다.

### Self-Healing Loop (Compiler Strategy)
코드를 직접 검증하지 않고 **컴파일러 진단 결과**를 에이전트에게 피드백한다.
- Prisma Compiler → Schema Agent
- OpenAPI Compiler → API Agent
- TypeScript AST + Layout Diff → Codegen Agent

### Validation Feedback Stringify
에러를 `// ERROR: ...` 주석으로 원본 코드에 삽입하여 에이전트가 수정 위치를 직관적으로 파악.

### Dynamic Function Calling Schema
이전 Phase에서 생성된 리소스(테이블명 등)를 `enum`으로 제한하여, 존재하지 않는 리소스 참조를 차단.

## Monorepo Structure

| Package | Role | Mirrors |
|---------|------|---------|
| `@mini-autostack/core` | 공유 타입 + 이벤트 시스템 | `@autoview/interface`, `@autobe/interface` |
| `@mini-autostack/agents` | 5개 AI 에이전트 | `@autoview/agent`, `@autobe/agent` |
| `@mini-autostack/compilers` | 3개 검증기 | `@autoview/compiler`, `@autobe/compiler` |
| `@mini-autostack/cli` | CLI 진입점 | - |

## Usage

```bash
# Install
npm install

# Type check
npm run typecheck

# Test
npm test

# Run (requires ANTHROPIC_API_KEY in .env)
cp .env.example .env
# Edit .env with your API key
npm run dev -- --image ./fixtures/screenshots/todo-app.png
```

## Tech Stack
- TypeScript (strict mode)
- Claude API (Vision + Function Calling)
- npm workspaces monorepo
- Vitest for testing
- Babel AST for TSX parsing
