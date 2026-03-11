# Mini AutoStack vs AutoBe/AutoView

## 패키지 구조 대응

| Mini AutoStack | AutoBe | AutoView | 역할 |
|----------------|--------|----------|------|
| `@mini-autostack/core` | `@autobe/interface` | `@autoview/interface` | 공유 타입 |
| `@mini-autostack/agents` | `@autobe/agent` | `@autoview/agent` | AI 에이전트 |
| `@mini-autostack/compilers` | `@autobe/compiler` | `@autoview/compiler` | 검증기 |
| `@mini-autostack/cli` | playground | website | 진입점 |

## 공통 패턴

### 1. Compiler Strategy
- **AutoBe**: Prisma Compiler + OpenAPI Compiler + TypeScript Compiler
- **AutoView**: TypeScript Compiler + Babel AST
- **Mini AutoStack**: Prisma CLI + YAML 파서 + Babel AST (3가지 모두 포함)

### 2. Self-Healing Loop
- **AutoBe**: 생성 → 컴파일러 검증 → 실패 시 피드백 → 재생성
- **AutoView**: 코드 생성 → Layout Diff → 유사도 수렴까지 반복
- **Mini AutoStack**: 동일 패턴, 백엔드(Prisma/OpenAPI) + 프론트엔드(Layout Diff) 모두 적용

### 3. Discriminated Union
- **AutoBe**: 65개+ 이벤트 타입, `IAutoBeDatabaseValidation` 등
- **Mini AutoStack**: 45+ 이벤트 타입, `ValidationResult` DU

### 4. Dynamic Function Calling Schema
- **AutoBe Delta**: 존재하는 리소스만 enum으로 참조 가능
- **Mini AutoStack**: `buildApiTools(existingTables)` — 동일 패턴

### 5. Validation Feedback Stringify
- **AutoBe Delta**: 에러를 인라인 주석으로 변환하여 에이전트에게 전달
- **Mini AutoStack**: `stringifyValidationFeedback()` — 동일 패턴

## 차이점

| 항목 | AutoBe/AutoView | Mini AutoStack |
|------|----------------|----------------|
| 규모 | 프로덕션 수준 | 포트폴리오 미니 버전 |
| 입력 | Figma API / 텍스트 요구사항 | 스크린샷 1장 |
| 출력 | 개별 코드 파일 | 실행 가능한 Vite 프로젝트 |
| 워터폴 단계 | 요구사항→DB→API→테스트→구현 | Vision→Schema→API→Codegen |
| LLM | 다양한 모델 지원 | Claude 전용 |
| 타입 검증 | typia 기반 정적 분석 | Babel AST 파싱 |

## Mini AutoStack만의 추가 기능

- **Vision Agent**: 스크린샷에서 직접 컴포넌트/엔티티/팔레트 추출
- **Scaffold Generator**: 생성 결과를 `npm run dev`로 실행 가능한 프로젝트로 조립
- **Mock API**: 실제 백엔드 없이 fetch 인터셉트로 동작하는 프론트엔드
