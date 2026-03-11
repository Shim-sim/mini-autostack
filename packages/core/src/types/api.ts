/**
 * API Agent 관련 타입 정의
 * AutoBe의 AutoBeOpenApi.IDocument 패턴을 참고
 */

export interface EndpointSummary {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  operationId: string;
  description: string;
  requestBodySchema?: string;
  responseSchema?: string;
}

/**
 * Dynamic Function Calling Schema
 *
 * AutoBe Delta 로드맵의 핵심 패턴:
 * 존재하는 테이블/엔드포인트만 참조 가능하도록 enum으로 제한.
 *
 * @see https://autobe.dev/docs/roadmap/delta/#21-dynamic-function-calling-schema
 */
export type DynamicTableRef<Tables extends string> = {
  type: "getTableSchema";
  tableNames: [Tables, ...Tables[]];
};

export type DynamicEndpointRef<Endpoints extends string> = {
  type: "getEndpointSpec";
  endpoints: [Endpoints, ...Endpoints[]];
};
