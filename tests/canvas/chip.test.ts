import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { ESC } from "../../src/paint/escapes.js";

// Every run of text a ground is laid under, as the words it holds.
const grounded = (drawn: string): string[] =>
  [...drawn.matchAll(new RegExp(`${ESC}\\[[0-9;]*\\b48;2;[0-9;]+m([^${ESC}]+)`, "gu"))].map((found) => found[1]);
const painted = (source: string, width = 80): string[] => grounded(renderThemed(source, { width, background: "light" }, "default"));

describe("a name tag is one drawing wherever it stands: its words between one blank each side, on its ground", () => {
  const GIT = ' commit id: "init"\n branch develop\n commit id: "work"\n checkout main\n merge develop';

  it.each(["LR", "TB", "BT"])("pads a gitGraph's branch names and commit ids, %s", (direction) => {
    const runs = painted(`gitGraph ${direction}:\n${GIT}`);
    for (const name of ["main", "develop", "init", "work"]) expect(runs, name).toContain(` ${name} `);
  });

  it("pads every mindmap node, the last on its row included, drawn two-sided", () => {
    const runs = painted("mindmap\n  Root\n    Left one\n    A\n    B\n    C\n    D\n    E\n    Last\n");
    for (const name of ["Root", "Left one", "A", "Last"]) expect(runs, name).toContain(` ${name} `);
  });

  it("pads every mindmap node turned into a tree", () => {
    const runs = painted("mindmap\n  Cloud\n    Region\n      Zone\n        Cluster\n          Node pool\n    Edge\n", 30);
    for (const name of ["Cloud", "Region", "Node pool", "Edge"]) expect(runs, name).toContain(` ${name} `);
  });
});
