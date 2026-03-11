import type { LayoutNode, LayoutDiff, LayoutMismatch } from "@mini-autostack/core";

/**
 * 두 LayoutTree를 비교하여 차이점 산출
 *
 * AutoView의 "Landmark + Semantic Inventory" 알고리즘의 간소화 버전.
 *
 * 유사도 = (구조 점수 * 0.6) + (속성 점수 * 0.3) + (개수 점수 * 0.1)
 */
export function compareLayouts(
  expected: LayoutNode,
  actual: LayoutNode,
): LayoutDiff {
  const mismatches: LayoutMismatch[] = [];

  // 구조 점수: 태그 시퀀스, 깊이, 형제 관계
  const structureScore = compareStructure(expected, actual, "root", mismatches);

  // 속성 점수: className, data-* 속성
  const attributeScore = compareAttributes(expected, actual, "root", mismatches);

  // 개수 점수: 전체 노드 수
  const expectedCount = countNodes(expected);
  const actualCount = countNodes(actual);
  const countScore =
    expectedCount === 0 && actualCount === 0
      ? 1
      : 1 - Math.abs(expectedCount - actualCount) / Math.max(expectedCount, actualCount);

  const similarity = structureScore * 0.6 + attributeScore * 0.3 + countScore * 0.1;

  return {
    similarity: Math.max(0, Math.min(1, similarity)),
    mismatches,
  };
}

function compareStructure(
  expected: LayoutNode,
  actual: LayoutNode,
  path: string,
  mismatches: LayoutMismatch[],
): number {
  // 태그 일치?
  if (expected.tag !== actual.tag) {
    mismatches.push({
      path,
      type: "type-mismatch",
      expected: expected.tag,
      actual: actual.tag,
      severity: "critical",
    });
    return 0.3; // 태그 다르면 0.3점만 (일부 구조는 유사할 수 있음)
  }

  if (expected.children.length === 0 && actual.children.length === 0) {
    return 1;
  }

  // 자식 비교
  const maxLen = Math.max(expected.children.length, actual.children.length);
  if (maxLen === 0) return 1;

  let childScore = 0;

  for (let i = 0; i < maxLen; i++) {
    const childPath = `${path} > ${expected.children[i]?.tag ?? actual.children[i]?.tag ?? "?"}:${i}`;

    if (i >= expected.children.length) {
      mismatches.push({
        path: childPath,
        type: "extra",
        actual: actual.children[i].tag,
        severity: "minor",
      });
      childScore += 0.2;
    } else if (i >= actual.children.length) {
      mismatches.push({
        path: childPath,
        type: "missing",
        expected: expected.children[i].tag,
        severity: "critical",
      });
      childScore += 0;
    } else {
      childScore += compareStructure(
        expected.children[i],
        actual.children[i],
        childPath,
        mismatches,
      );
    }
  }

  return childScore / maxLen;
}

function compareAttributes(
  expected: LayoutNode,
  actual: LayoutNode,
  path: string,
  mismatches: LayoutMismatch[],
): number {
  let score = 0;
  let count = 0;

  // className 비교
  if (expected.className || actual.className) {
    count++;
    if (expected.className === actual.className) {
      score += 1;
    } else if (expected.className && actual.className) {
      // 부분 일치 계산 (Tailwind 클래스 단위)
      const expClasses = new Set(expected.className.split(/\s+/));
      const actClasses = new Set(actual.className.split(/\s+/));
      const intersection = [...expClasses].filter((c) => actClasses.has(c));
      const union = new Set([...expClasses, ...actClasses]);
      score += union.size > 0 ? intersection.length / union.size : 0;

      if (intersection.length < expClasses.size) {
        mismatches.push({
          path,
          type: "attribute-mismatch",
          expected: expected.className,
          actual: actual.className,
          severity: "minor",
        });
      }
    } else {
      score += 0;
    }
  }

  // 자식들도 재귀 비교
  const minLen = Math.min(expected.children.length, actual.children.length);
  for (let i = 0; i < minLen; i++) {
    const childPath = `${path} > ${expected.children[i].tag}:${i}`;
    const childAttrScore = compareAttributes(
      expected.children[i],
      actual.children[i],
      childPath,
      mismatches,
    );
    score += childAttrScore;
    count++;
  }

  return count > 0 ? score / count : 1;
}

function countNodes(node: LayoutNode): number {
  let count = 1;
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}
