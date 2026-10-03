// A node's `style` is laid over its `classDef` property by property, as mermaid compiles both: a `style` naming
// only the stroke kept neither the class's fill nor its ink before.

import { describe, expect, it } from "vitest";

import { renderThemedText } from "../../src/index.js";

const ESC = String.fromCharCode(27);
const RED_GROUND = `${ESC}[48;2;255;0;0m`;
const BLUE_STROKE = `${ESC}[38;2;0;0;255m`;

describe.each(["TD", "LR"])("a node wearing a classDef and a style, %s", (direction) => {
  const source = (style: string) =>
    `flowchart ${direction}\n  A[One]:::hot --> B[Two]\n  classDef hot fill:#ff0000\n  ${style}`;

  it("keeps the class's fill under a style that names only the stroke", () => {
    const ansi = renderThemedText(source("style A stroke:#0000ff"), { width: 80 }, "default").toAnsi("dark");
    expect(ansi).toContain(RED_GROUND);
    expect(ansi).toContain(BLUE_STROKE);
  });

  it("lets the style win the property both name", () => {
    const ansi = renderThemedText(source("style A fill:#0000ff"), { width: 80 }, "default").toAnsi("dark");
    expect(ansi).not.toContain(RED_GROUND);
    expect(ansi).toContain(`${ESC}[48;2;0;0;255m`);
  });
});
