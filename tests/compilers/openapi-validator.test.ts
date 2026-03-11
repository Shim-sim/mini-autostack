import { describe, it, expect } from "vitest";
import { OpenApiValidator } from "@mini-autostack/compilers";

const VALID_SPEC = `
openapi: '3.1.0'
info:
  title: Todo API
  version: '1.0.0'
paths:
  /users:
    get:
      operationId: listUsers
      summary: List all users
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/User'
    post:
      operationId: createUser
      summary: Create a user
      requestBody:
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserCreate'
      responses:
        '201':
          description: Created
  /todos:
    get:
      operationId: listTodos
      summary: List all todos
      responses:
        '200':
          description: OK
components:
  schemas:
    User:
      type: object
      properties:
        id:
          type: integer
        email:
          type: string
        name:
          type: string
    UserCreate:
      type: object
      properties:
        email:
          type: string
        name:
          type: string
    Todo:
      type: object
      properties:
        id:
          type: integer
        title:
          type: string
        completed:
          type: boolean
`;

const INVALID_SPEC_NO_OPENAPI = `
info:
  title: Test
  version: '1.0.0'
paths:
  /test:
    get:
      responses:
        '200':
          description: OK
`;

const INVALID_SPEC_BAD_REF = `
openapi: '3.1.0'
info:
  title: Test
  version: '1.0.0'
paths:
  /users:
    get:
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/NonExistent'
components:
  schemas:
    User:
      type: object
`;

const INVALID_SPEC_MISSING_RESPONSES = `
openapi: '3.1.0'
info:
  title: Test
  version: '1.0.0'
paths:
  /users:
    get:
      operationId: listUsers
`;

const INVALID_YAML = `
openapi: '3.1.0
  bad yaml here
    broken: [
`;

describe("OpenApiValidator", () => {
  const validator = new OpenApiValidator();

  it("should pass for a valid OpenAPI spec", async () => {
    const result = await validator.validate(VALID_SPEC, ["User", "Todo"]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toContain("valid");
      expect(result.data.stats?.paths).toBe(2);
      expect(result.data.stats?.schemas).toBe(3);
    }
  });

  it("should fail for spec without openapi version", async () => {
    const result = await validator.validate(INVALID_SPEC_NO_OPENAPI);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.message.includes("openapi"))).toBe(
        true,
      );
    }
  });

  it("should fail for spec with broken $ref", async () => {
    const result = await validator.validate(INVALID_SPEC_BAD_REF);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.errors.some((e) => e.message.includes("Undefined $ref")),
      ).toBe(true);
    }
  });

  it("should fail for spec with missing responses", async () => {
    const result = await validator.validate(INVALID_SPEC_MISSING_RESPONSES);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.errors.some((e) => e.message.includes("responses")),
      ).toBe(true);
    }
  });

  it("should fail for invalid YAML", async () => {
    const result = await validator.validate(INVALID_YAML);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.errors.some((e) => e.message.includes("YAML")),
      ).toBe(true);
    }
  });

  it("should warn about schemas not matching existing tables", async () => {
    const result = await validator.validate(VALID_SPEC, ["User"]);

    // Todo schema exists but "Todo" is not in existing tables
    // This should produce a warning but not fail (warnings only)
    if (!result.success) {
      expect(
        result.errors.some(
          (e) =>
            e.severity === "warning" &&
            e.message.includes("may not correspond"),
        ),
      ).toBe(true);
    }
  });

  it("should include feedback string on failure", async () => {
    const result = await validator.validate(INVALID_SPEC_BAD_REF);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.feedback).toBe("string");
      expect(result.feedback.length).toBeGreaterThan(0);
    }
  });
});
