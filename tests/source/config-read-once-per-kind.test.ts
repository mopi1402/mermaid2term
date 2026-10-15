import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { parseQuadrant } from "../../src/diagrams/quadrant/parser.js";

const WIDTHS = [40, 80] as const;
const git = (direction: string): string => `gitGraph ${direction}:\n    commit\n    branch dev\n    commit\n`;

// The gitGraph kind reads its config through the shared reader: no init directive read a second time on its own.
describe("a gitGraph's trunk name, read as mermaid 12 reads it", () => {
  it.each(["LR", "TB"])("%s: a root `mainBranchName` in a directive names nothing, mermaid reading it under `gitGraph` alone", (direction) => {
    const drawn = render(`%%{init: {"mainBranchName": "trunk"}}%%\n${git(direction)}`, { width: 70 });
    expect(drawn).not.toContain("trunk");
    expect(drawn).toBe(render(git(direction), { width: 70 }));
  });

  it.each(["LR", "TB"])("%s: `gitGraph.mainBranchName` in a directive names the trunk", (direction) => {
    expect(render(`%%{init: {"gitGraph": {"mainBranchName": "trunk"}}}%%\n${git(direction)}`, { width: 70 })).toContain("trunk");
  });

  it.each(["LR", "TB"])("%s: a directive's `config` lands on the gitGraph section, the diagram's id", (direction) => {
    expect(render(`%%{init: {"config": {"mainBranchName": "trunk"}}}%%\n${git(direction)}`, { width: 70 })).toContain("trunk");
  });
});

// mermaid 12 gives `showTitle` to xyChart and quadrantChart alone.
describe("`showTitle: false`, honoured where mermaid has the key", () => {
  const quadrant = (config: string, body: string): string => `---\ntitle: Front\nconfig:\n  quadrantChart:\n${config}---\nquadrantChart\n${body}`;

  it("takes a quadrant's `title` statement off, not the frontmatter's alone", () => {
    expect(parseQuadrant("quadrantChart\n  title Inner\n", { showTitle: "false" }).title).toBe("");
    expect(parseQuadrant("quadrantChart\n  title Inner\n", { showTitle: "true" }).title).toBe("Inner");
  });

  it.each(WIDTHS)("width %i: draws no quadrant title under `showTitle: false`, the body's nor the frontmatter's", (width) => {
    expect(render(`---\nconfig:\n  quadrantChart:\n    showTitle: false\n---\nquadrantChart\n  title Inner\n  A: [0.3, 0.6]\n`, { width })).not.toContain("Inner");
    expect(render(quadrant("    showTitle: false\n", "  A: [0.3, 0.6]\n"), { width })).not.toContain("Front");
    expect(render(quadrant("    showTitle: true\n", "  A: [0.3, 0.6]\n"), { width })).toContain("Front");
  });

  it.each(WIDTHS)("width %i: keeps a pie's frontmatter title, pie having no `showTitle`", (width) => {
    const drawn = render(`---\ntitle: Pets\nconfig:\n  pie:\n    showTitle: false\n---\npie\n  "Dogs" : 3\n  "Cats" : 2\n`, { width });
    expect(drawn).toContain("Pets");
  });
});
