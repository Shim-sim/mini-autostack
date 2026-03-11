import { describe, it, expect } from "vitest";
import { tsxToLayoutTree } from "@mini-autostack/compilers";

describe("tsxToLayoutTree", () => {
  it("should parse simple TSX to layout tree", () => {
    const tsx = `
import React from 'react';
export default function App() {
  return (
    <div className="flex flex-col">
      <header className="bg-blue-500 p-4">
        <h1>Title</h1>
      </header>
      <main className="p-4">
        <p>Content</p>
      </main>
    </div>
  );
}`;

    const tree = tsxToLayoutTree(tsx);

    expect(tree.tag).toBe("div");
    expect(tree.className).toBe("flex flex-col");
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].tag).toBe("header");
    expect(tree.children[0].className).toBe("bg-blue-500 p-4");
    expect(tree.children[1].tag).toBe("main");
  });

  it("should handle nested elements", () => {
    const tsx = `
export default function Card() {
  return (
    <div className="card">
      <div className="card-header">
        <span>Title</span>
      </div>
      <div className="card-body">
        <p>Text</p>
      </div>
    </div>
  );
}`;

    const tree = tsxToLayoutTree(tsx);

    expect(tree.tag).toBe("div");
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].children[0].tag).toBe("span");
  });

  it("should extract attributes", () => {
    const tsx = `
export default function Form() {
  return (
    <form>
      <input type="text" placeholder="Enter name" />
      <button type="submit">Submit</button>
    </form>
  );
}`;

    const tree = tsxToLayoutTree(tsx);

    expect(tree.tag).toBe("form");
    expect(tree.children).toHaveLength(2);
    expect(tree.children[0].attributes.type).toBe("text");
    expect(tree.children[0].attributes.placeholder).toBe("Enter name");
  });

  it("should handle JSX expressions (map)", () => {
    const tsx = `
export default function List() {
  const items = [1, 2, 3];
  return (
    <ul>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}`;

    const tree = tsxToLayoutTree(tsx);

    expect(tree.tag).toBe("ul");
    expect(tree.children.length).toBeGreaterThanOrEqual(1);
    expect(tree.children[0].tag).toBe("li");
  });

  it("should return empty node for tsx without JSX", () => {
    const tsx = `export const value = 42;`;
    const tree = tsxToLayoutTree(tsx);
    expect(tree.tag).toBe("empty");
  });
});
