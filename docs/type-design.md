# Type Design Decisions

## 1. Discriminated Union for Events

```typescript
type PipelineEvent =
  | { type: "vision:start"; payload: { imageSource: string } }
  | { type: "schema:validate:fail"; payload: { errors: CompilerDiagnostic[] } }
  | ...;
```

**왜?**
- `switch(event.type)` 시 TypeScript가 payload 타입을 자동 narrowing
- 새 이벤트 추가 시 handler에서 exhaustive check 가능
- AutoBe가 65개+ 이벤트를 이 패턴으로 관리하는 것과 동일

## 2. Discriminated Union for Validation

```typescript
type ValidationResult =
  | { success: true; data: { message: string } }
  | { success: false; errors: CompilerDiagnostic[]; feedback: string };
```

**왜?**
- `if (result.success)` 한 줄로 성공/실패 분기 + 타입 안전
- AutoBe의 `IAutoBeDatabaseValidation` 패턴과 동일

## 3. Dynamic Function Calling Schema

```typescript
function buildApiTools(existingTables: string[]): Anthropic.Tool[] {
  return [{
    name: "generate_openapi_spec",
    input_schema: {
      properties: {
        referencedTables: {
          items: { type: "string", enum: existingTables }
        }
      }
    }
  }];
}
```

**왜?**
- 이전 Phase에서 생성된 테이블만 참조 가능 (환각 방지)
- AutoBe Delta 로드맵의 핵심 패턴
- 런타임에 스키마를 동적 구성하여 LLM의 출력 공간을 제한

## 4. Validation Feedback Stringify

```
model User {
  id    String  // ERROR: Primary key must be Int with @id
  posts Post[]  // ERROR: Related model 'Post' does not exist
}
```

**왜?**
- 구조화된 에러 객체보다 인라인 주석이 LLM에게 더 직관적
- 수정 위치와 원인을 한눈에 파악 가능
- AutoBe가 실제로 이 방식을 채택한 이유와 동일

## 5. 유틸리티 타입

```typescript
type PipelineEventType = PipelineEvent["type"];
type EventPayload<T extends PipelineEventType> = Extract<PipelineEvent, { type: T }>["payload"];
```

- `EventPayload<"schema:validate:pass">` → `{ tableCount: number; relationCount: number }`
- TypedEventEmitter의 `on`/`emit` 메서드에서 타입 추론의 핵심
