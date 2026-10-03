import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { paintedRowWith, stripSgr } from "../support/ansi.js";

// mermaid 12 lays a `color` on the label alone: a node's outline and an edge's path keep the theme's stroke
// (measured headless on 2026-09-29), only `stroke` changes them.
const RED = "38;2;255;0;0";
const walls = (drawn: string): string[] => drawn.split("\n").filter((row) => /[┌└╭╰]/u.test(stripSgr(row)));

describe.each(["TD", "LR"])("a `color` inks the words, never the lines (%s)", (direction) => {
  it("keeps a flowchart node's outline in the theme's stroke and reddens its label", () => {
    const drawn = renderThemed(`flowchart ${direction}\n  A --> B\n  style A color:#f00`, { width: 80 }, "default");
    expect(walls(drawn).join("\n")).not.toContain(`${RED}m`);
    expect(paintedRowWith(drawn, "A")).toMatch(new RegExp(`${RED}(;48;2;[0-9;]+)?mA`, "u"));
  });

  it("keeps a state's outline in the theme's stroke and reddens its label", () => {
    const drawn = renderThemed(`stateDiagram-v2\n  direction ${direction}\n  A --> B\n  style A color:#f00`, { width: 80 }, "default");
    expect(walls(drawn).join("\n")).not.toContain(`${RED}m`);
    expect(paintedRowWith(drawn, "A")).toMatch(new RegExp(`${RED}(;48;2;[0-9;]+)?mA`, "u"));
  });

  it("keeps a linkStyle's path in the theme's line and reddens the edge's label", () => {
    const drawn = renderThemed(`flowchart ${direction}\n  A -->|lab| B\n  linkStyle 0 color:#f00`, { width: 80 }, "default");
    expect(drawn.replace(/\u001b\[[0-9;]*m(lab)/gu, "$1")).not.toMatch(new RegExp(`${RED}m[│─⏷⏵]`, "u"));
    expect(drawn).toMatch(new RegExp(`${RED}(;48;2;[0-9;]+)?m ?lab`, "u"));
  });
});
