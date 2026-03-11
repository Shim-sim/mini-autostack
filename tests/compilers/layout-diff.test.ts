import { describe, it, expect } from "vitest";
import { compareLayouts } from "@mini-autostack/compilers";
import type { LayoutNode } from "@mini-autostack/core";

function node(
  tag: string,
  className?: string,
  children: LayoutNode[] = [],
  depth: number = 0,
): LayoutNode {
  return { tag, className, attributes: {}, children, depth };
}

describe("compareLayouts", () => {
  it("should return similarity 1.0 for identical trees", () => {
    const tree = node("div", "flex", [
      node("header", "bg-blue", [], 1),
      node("main", "p-4", [], 1),
    ]);

    const diff = compareLayouts(tree, tree);
    expect(diff.similarity).toBeCloseTo(1.0, 1);
    expect(diff.mismatches).toHaveLength(0);
  });

  it("should detect tag mismatches", () => {
    const expected = node("div", "flex");
    const actual = node("section", "flex");

    const diff = compareLayouts(expected, actual);
    expect(diff.similarity).toBeLessThan(1.0);
    expect(diff.mismatches.some((m) => m.type === "type-mismatch")).toBe(true);
  });

  it("should detect missing children", () => {
    const expected = node("div", "flex", [
      node("header", "", [], 1),
      node("main", "", [], 1),
      node("footer", "", [], 1),
    ]);
    const actual = node("div", "flex", [
      node("header", "", [], 1),
    ]);

    const diff = compareLayouts(expected, actual);
    expect(diff.similarity).toBeLessThan(0.8);
    expect(diff.mismatches.some((m) => m.type === "missing")).toBe(true);
  });

  it("should detect extra children", () => {
    const expected = node("div", "flex", [
      node("header", "", [], 1),
    ]);
    const actual = node("div", "flex", [
      node("header", "", [], 1),
      node("footer", "", [], 1),
      node("aside", "", [], 1),
    ]);

    const diff = compareLayouts(expected, actual);
    expect(diff.mismatches.some((m) => m.type === "extra")).toBe(true);
  });

  it("should detect className mismatches", () => {
    const expected = node("div", "flex flex-col gap-4");
    const actual = node("div", "flex flex-row gap-2");

    const diff = compareLayouts(expected, actual);
    expect(diff.similarity).toBeLessThan(1.0);
  });

  it("should handle two empty trees", () => {
    const expected = node("div");
    const actual = node("div");

    const diff = compareLayouts(expected, actual);
    expect(diff.similarity).toBeCloseTo(1.0, 1);
  });

  it("should give higher similarity for partially matching structures", () => {
    const expected = node("div", "flex", [
      node("header", "p-4", [], 1),
      node("main", "flex-1", [
        node("section", "grid", [], 2),
      ], 1),
    ]);
    const actual = node("div", "flex", [
      node("header", "p-4", [], 1),
      node("main", "flex-1", [], 1),
    ]);

    const diff = compareLayouts(expected, actual);
    // 대부분 매치, main 아래 section만 빠짐
    expect(diff.similarity).toBeGreaterThan(0.5);
    expect(diff.similarity).toBeLessThan(1.0);
  });
});
