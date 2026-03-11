import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import type { NodePath } from "@babel/traverse";
import type { JSXElement, JSXOpeningElement } from "@babel/types";
import type { LayoutNode } from "@mini-autostack/core";

// Handle both ESM default and CJS module
const traverse =
  typeof _traverse === "function"
    ? _traverse
    : (_traverse as unknown as { default: typeof _traverse }).default;

/**
 * TSX 코드를 파싱하여 LayoutTree로 변환
 *
 * AutoView의 "Babel AST로 파싱하여 레이아웃 트리를 추출" 패턴을 구현.
 */
export function tsxToLayoutTree(tsx: string): LayoutNode {
  const ast = parse(tsx, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  let rootNode: LayoutNode | null = null;

  traverse(ast, {
    JSXElement(path: NodePath<JSXElement>) {
      if (!rootNode) {
        rootNode = buildLayoutNode(path.node, 0);
        path.skip();
      }
    },
  });

  if (!rootNode) {
    return { tag: "empty", attributes: {}, children: [], depth: 0 };
  }

  return rootNode;
}

function buildLayoutNode(element: JSXElement, depth: number): LayoutNode {
  const opening = element.openingElement;
  const tag = getTagName(opening);
  const className = getClassName(opening);
  const attributes = getAttributes(opening);

  const children: LayoutNode[] = [];
  for (const child of element.children) {
    if (child.type === "JSXElement") {
      children.push(buildLayoutNode(child, depth + 1));
    }
    if (
      child.type === "JSXExpressionContainer" &&
      child.expression.type !== "JSXEmptyExpression"
    ) {
      const nestedElements = findNestedJSXElements(child);
      for (const nested of nestedElements) {
        children.push(buildLayoutNode(nested, depth + 1));
      }
    }
  }

  return { tag, className, attributes, children, depth };
}

function getTagName(opening: JSXOpeningElement): string {
  const name = opening.name;
  if (name.type === "JSXIdentifier") return name.name;
  if (name.type === "JSXMemberExpression") {
    return `${(name.object as any).name}.${name.property.name}`;
  }
  return "unknown";
}

function getClassName(opening: JSXOpeningElement): string | undefined {
  for (const attr of opening.attributes) {
    if (
      attr.type === "JSXAttribute" &&
      attr.name.type === "JSXIdentifier" &&
      attr.name.name === "className"
    ) {
      if (attr.value?.type === "StringLiteral") return attr.value.value;
      if (
        attr.value?.type === "JSXExpressionContainer" &&
        attr.value.expression.type === "StringLiteral"
      ) {
        return attr.value.expression.value;
      }
      return "[dynamic]";
    }
  }
  return undefined;
}

function getAttributes(opening: JSXOpeningElement): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const attr of opening.attributes) {
    if (attr.type === "JSXAttribute" && attr.name.type === "JSXIdentifier") {
      const name = attr.name.name;
      if (name === "className") continue;
      if (!attr.value) attrs[name] = "true";
      else if (attr.value.type === "StringLiteral") attrs[name] = attr.value.value;
      else attrs[name] = "[expression]";
    }
  }
  return attrs;
}

function findNestedJSXElements(node: any): JSXElement[] {
  const elements: JSXElement[] = [];
  function walk(n: any) {
    if (!n || typeof n !== "object") return;
    if (n.type === "JSXElement") { elements.push(n); return; }
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) for (const item of value) walk(item);
      else if (typeof value === "object" && value !== null) walk(value);
    }
  }
  walk(node);
  return elements;
}
