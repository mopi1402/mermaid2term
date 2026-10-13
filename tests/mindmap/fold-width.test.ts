import { describe, expect, it } from "vitest";

import { render, renderThemed } from "../../src/index.js";
import { displayWidth } from "../../src/text/width.js";
import { THREE_PANES } from "../support/drawn.js";

const DEEP = "mindmap\n  Cloud\n    Region\n      Zone\n        Cluster\n          Node pool\n            Node\n              Container\n    Edge\n";
const SMALL = "mindmap\n  Root\n    A\n      A1\n    B\n";
const TREE = [
  " Cloud",
  "├─ Region",
  "│  └─ Zone",
  "│     └─ Cluster",
  "│        └─ Node pool",
  "│           └─ Node",
  "│              └─ Container",
  "└─ Edge",
];

const rows = (source: string, width: number): string[] => render(source, { width }).split("\n");
const widest = (drawn: string[]): number => Math.max(...drawn.map(displayWidth));

describe("a mindmap too wide for the budget turns into an indented tree", () => {
  it("keeps the two-sided drawing wherever it fits", () => {
    for (const width of [100, 120]) expect(rows(DEEP, width)).toEqual([expect.stringMatching(/^ Edge ─+ Cloud ─+ Region ─+ .* Container$/u)]);
    for (const width of THREE_PANES) expect(rows(SMALL, width)).toEqual([" B ──────── Root ──────── A ──────── A1"]);
  });

  it("draws the tree, one node a row, when the budget cannot hold it", () => {
    expect(rows(DEEP, 40)).toEqual(TREE);
  });

  it("never turns under `autoRotate: false`", () => {
    const held = render(DEEP, { width: 40, autoRotate: false });
    expect(held.split("\n")).toEqual([expect.stringMatching(/^ Edge ─+ Cloud ─+ Region ─+ .* Container$/u)]);
  });

  it("wraps each label to what the budget leaves, the guides running down its rows", () => {
    const source = "mindmap\n  Root\n    First branch\n      A long label that needs several rows here\n    Last\n";
    const drawn = rows(source, 30);
    expect(widest(drawn)).toBeLessThanOrEqual(30);
    expect(drawn).toEqual([
      " Root",
      "├─ First branch",
      "│  └─ A long label that needs",
      "│     several rows here",
      "└─ Last",
    ]);
  });

  it("keeps icons, line breaks and the markdown ink in the tree", () => {
    const source = "mindmap\n  Root\n    Sky\n    ::icon(fa fa-cloud)\n      Deep **bold** node\n        Leaf\n    Two<br>rows\n";
    expect(rows(source, 30)).toEqual([" Root", "├─ ☁ Sky", "│  └─ Deep bold node", "│     └─ Leaf", "└─ Two", "   rows"]);
    const at = rows(source, 30).findIndex((row) => row.includes("bold"));
    expect(renderThemed(source, { width: 30 }, "classic").split("\n")[at]).toMatch(/\[[0-9;]*\b1\b[0-9;]*m/u);
  });

  it("counts an icon's glyph in the wrap, no row wider than the room it has", () => {
    const source = "mindmap\n  Root\n    Branch\n      Rain and snow data\n      ::icon(fa fa-cloud)\n    Last\n";
    for (const width of [24, 30]) expect(widest(rows(source, width))).toBeLessThanOrEqual(width);
    expect(rows(source, 24)).toEqual([" Root", "├─ Branch", "│  └─ ☁ Rain and snow", "│     data", "└─ Last"]);
    const twoSided = "mindmap\n  Root\n    Weather service data feeds\n    ::icon(fa fa-cloud)\n";
    expect(rows(twoSided, 120)).toEqual([" Root ──────── ☁ Weather service data", "                       feeds"]);
  });
});
