import { describe, it, expect } from "vitest";
import { renderThemed } from "../../src/index.js";

const LIGHT = { width: 80, background: "light" } as const;

const er = (direction: string, variables = ""): string =>
  `---\nconfig:\n  theme: base\n${variables}---\nerDiagram\n  direction ${direction}\n  CUSTOMER {\n    string name\n    string email\n    int age\n  }\n  CUSTOMER ||--o{ ORDER : places\n`;

const rowOf = (drawn: string, word: string): string => drawn.split("\n").find((line) => line.includes(word)) ?? "";

describe("an ER entity's rows on mermaid's base theme, `rowOdd` and `rowEven` off the box's fill", () => {
  it.each(["TB", "LR"])("bands the rows white and #FFFCF6 by turns, %s", (direction) => {
    const drawn = renderThemed(er(direction), LIGHT, "mono");
    expect(rowOf(drawn, "name")).toContain("48;2;255;255;255");
    expect(rowOf(drawn, "email")).toContain("48;2;255;252;246");
  });

  it.each(["TB", "LR"])("darkens them off the fill under `darkMode: True`, a string mermaid reads as on, %s", (direction) => {
    const drawn = renderThemed(er(direction, "  themeVariables:\n    darkMode: True\n"), LIGHT, "mono");
    expect(rowOf(drawn, "name")).toContain("48;2;255;236;195");
  });
});

describe("a CSS colour written with spaces, as khroma reads `rgb(255 0 0)`", () => {
  it.each(["TD", "LR"])("fills a styled node, %s", (direction) => {
    const drawn = renderThemed(`flowchart ${direction}\n  A --> B\n  style A fill:rgb(255 0 0)\n`, LIGHT, "mono");
    expect(drawn).toContain("48;2;255;0;0");
  });
});

describe("a git tag's rim, on mermaid's `tagLabelBorder`", () => {
  it.each(["LR", "TB"])("strokes the rim the source writes, %s", (direction) => {
    const source = `---\nconfig:\n  theme: base\n  themeVariables:\n    tagLabelBorder: "#ff0000"\n---\ngitGraph ${direction}:\n  commit id: "a" tag: "v1"\n  commit\n`;
    expect(renderThemed(source, LIGHT, "mono")).toContain("38;2;255;0;0");
  });
});
