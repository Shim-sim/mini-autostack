import { describe, it, expect } from "vitest";
import { PrismaValidator } from "@mini-autostack/compilers";

const VALID_SCHEMA = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
`;

const INVALID_SCHEMA_NO_DATASOURCE = `
model User {
  id    Int    @id
  email String
}
`;

const INVALID_SCHEMA_BAD_RELATION = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id    Int    @id @default(autoincrement())
  posts Post[]
}

model Post {
  id       Int  @id @default(autoincrement())
  author   User @relation(fields: [authorId], references: [id])
}
`;

describe("PrismaValidator", () => {
  const validator = new PrismaValidator();

  it("should pass for a valid schema", async () => {
    const result = await validator.validate(VALID_SCHEMA);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toContain("valid");
      expect(result.data.stats?.models).toBe(2);
    }
  }, 30000);

  it("should fail for schema without datasource (quick check)", async () => {
    const result = await validator.validate(INVALID_SCHEMA_NO_DATASOURCE);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.some((e) => e.message.includes("datasource"))).toBe(
        true,
      );
      expect(result.feedback).toContain("ERROR");
    }
  });

  it("should fail for schema with broken relation", async () => {
    const result = await validator.validate(INVALID_SCHEMA_BAD_RELATION);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.feedback).toBeTruthy();
    }
  }, 30000);

  it("should fail for empty schema", async () => {
    const result = await validator.validate("");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errors.length).toBeGreaterThan(0);
    }
  });

  it("should include feedback string on failure", async () => {
    const result = await validator.validate(INVALID_SCHEMA_NO_DATASOURCE);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(typeof result.feedback).toBe("string");
      expect(result.feedback.length).toBeGreaterThan(0);
    }
  });
});
