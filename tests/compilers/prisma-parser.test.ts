import { describe, it, expect } from "vitest";
import { extractModelNames, extractModelFields } from "@mini-autostack/compilers";

const SAMPLE_SCHEMA = `
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id    Int    @id
  email String @unique
  name  String?
  posts Post[]
}

model Post {
  id       Int    @id
  title    String
  content  String?
  author   User   @relation(fields: [authorId], references: [id])
  authorId Int
}
`;

describe("extractModelNames", () => {
  it("should extract all model names", () => {
    const names = extractModelNames(SAMPLE_SCHEMA);
    expect(names).toEqual(["User", "Post"]);
  });

  it("should return empty array for schema without models", () => {
    const names = extractModelNames("datasource db {}");
    expect(names).toEqual([]);
  });
});

describe("extractModelFields", () => {
  it("should extract fields for a specific model", () => {
    const fields = extractModelFields(SAMPLE_SCHEMA, "User");
    expect(fields).toContain("id");
    expect(fields).toContain("email");
    expect(fields).toContain("name");
    expect(fields).toContain("posts");
  });

  it("should return empty array for non-existent model", () => {
    const fields = extractModelFields(SAMPLE_SCHEMA, "Comment");
    expect(fields).toEqual([]);
  });
});
