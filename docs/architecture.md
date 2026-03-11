# Architecture

## 파이프라인 흐름

```
Screenshot (PNG/JPG)
       │
       ▼
┌─────────────┐
│ Vision Agent │  Claude Vision API → 컴포넌트/엔티티/팔레트 분석
└──────┬──────┘
       ▼
┌──────────────┐     ┌────────────────┐
│ Schema Agent │────▶│ Prisma Compiler│──── Self-Healing Loop (max 3)
└──────┬───────┘     └────────────────┘
       ▼
┌──────────────┐     ┌────────────────┐
│  API Agent   │────▶│OpenAPI Compiler│──── Self-Healing Loop (max 3)
└──────┬───────┘     └────────────────┘
       ▼
┌──────────────┐     ┌─────────────────┐
│Codegen Agent │────▶│AST + Layout Diff│──── Self-Healing Loop (max 3)
└──────┬───────┘     └─────────────────┘
       ▼
┌──────────────┐
│  Scaffold    │  Vite + React + TailwindCSS 프로젝트 생성
└──────┬───────┘
       ▼
  output/
  ├── package.json, vite.config.ts, ...
  ├── src/components/*.tsx
  ├── src/api/mock.ts
  ├── schema.prisma
  └── openapi.yaml
```

## 모노레포 구조

```
packages/
├── core/        공유 타입 + 이벤트 시스템 + Claude 클라이언트
├── agents/      5개 AI 에이전트 (Vision, Schema, API, Codegen, Healer)
├── compilers/   3개 검증기 (Prisma, OpenAPI, AST/Layout)
└── cli/         파이프라인 오케스트레이터 + Scaffold 생성기
```

## Self-Healing Loop

각 생성 단계에서 동일한 패턴을 따른다:

1. **Agent가 코드 생성** (Claude Function Calling)
2. **Compiler가 검증** (Prisma CLI / YAML 파서 / Babel AST)
3. **실패 시**: Validation Feedback Stringify로 에러를 코드에 인라인 주석 삽입
4. **Agent가 피드백 기반 재생성** (최대 3회)
5. **성공 시**: 다음 단계로 진행

## 이벤트 시스템

`TypedEventEmitter`가 전 과정을 45+ 이벤트 타입으로 추적한다.
Discriminated Union 패턴으로 `type` 필드에 따라 `payload` 타입이 자동 추론된다.

## Mock API

생성된 프로젝트는 실제 백엔드 없이 동작한다.
`window.fetch`를 가로채서 Vision에서 추출한 엔티티 기반 샘플 데이터를 반환한다.
