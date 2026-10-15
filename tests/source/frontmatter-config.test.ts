import { describe, it, expect } from "vitest";

import { render } from "../../src/index.js";
import { withConfig } from "../support/frontmatter.js";

const WIDTH = 70;
const drawn = (source: string): string => render(source, { width: WIDTH });

const SEQUENCE = "sequenceDiagram\n    participant A\n    participant B\n    A->>B: one fairly long message\n    B-->>A: back\n";
const GANTT = "gantt\n    dateFormat YYYY-MM-DD\n    section S\n    One :a, 2026-03-02, 3d\n";
const XY = 'xychart-beta\n    x-axis [a, b, c]\n    y-axis "n" 0 --> 10\n    bar [3, 7, 5]\n';
const ER = "erDiagram\n    A ||--o{ B : has\n    B ||--o{ C : holds\n";
const GIT = "gitGraph\n    commit\n    branch dev\n    commit\n";

// mermaid states a key per diagram, under the section its own kind owns, and the seven below are the ones whose
// drawing this already knew how to make: the config says what a statement of the body would have said.
describe("the `config.<kind>` block a source writes for its own kind", () => {
  const keys: Array<[name: string, config: string, body: string]> = [
    ["sequence.mirrorActors", "  sequence:\n    mirrorActors: true\n", SEQUENCE],
    ["sequence.showSequenceNumbers", "  sequence:\n    showSequenceNumbers: true\n", SEQUENCE],
    ["sequence.wrap", "  sequence:\n    wrap: true\n", SEQUENCE],
    ["gantt.axisFormat", "  gantt:\n    axisFormat: '%d/%m'\n", GANTT],
    ["gantt.tickInterval", "  gantt:\n    tickInterval: 1week\n", GANTT],
    ["gantt.weekday", "  gantt:\n    weekday: monday\n", "gantt\n    dateFormat YYYY-MM-DD\n    tickInterval 1week\n    section S\n    One :a, 2026-03-02, 9d\n"],
    ["xyChart.chartOrientation", "  xyChart:\n    chartOrientation: horizontal\n", XY],
    ["er.layoutDirection", "  er:\n    layoutDirection: TB\n", ER],
    ["gitGraph.mainBranchName", "  gitGraph:\n    mainBranchName: trunk\n", GIT],
  ];

  it.each(keys)("%s moves the drawing", (_name, config, body) => {
    expect(drawn(withConfig(config, body))).not.toBe(drawn(body));
  });

  it("numbers every message under `showSequenceNumbers`, as an `autonumber` statement would", () => {
    const numbered = drawn(withConfig({ sequence: { showSequenceNumbers: true } }, SEQUENCE));
    expect(numbered).toBe(drawn(`sequenceDiagram\n    participant A\n    participant B\n    autonumber\n    A->>B: one fairly long message\n    B-->>A: back\n`));
  });

  it("names the trunk from `mainBranchName`, which a gitGraph has no statement for", () => {
    expect(drawn(withConfig({ gitGraph: { mainBranchName: "trunk" } }, GIT))).toContain("trunk");
  });

  it("lays an er out the way `layoutDirection` asks, and keeps the fitting from turning it back", () => {
    const stood = drawn(withConfig({ er: { layoutDirection: "TB" } }, ER));
    expect(stood).toBe(drawn(`erDiagram\n    direction TB\n    A ||--o{ B : has\n    B ||--o{ C : holds\n`));
  });

  it("turns a chart on its side under `chartOrientation`, as the header word does", () => {
    expect(drawn(withConfig({ xyChart: { chartOrientation: "horizontal" } }, XY))).toBe(
      drawn('xychart-beta horizontal\n    x-axis [a, b, c]\n    y-axis "n" 0 --> 10\n    bar [3, 7, 5]\n')
    );
  });

  // mermaid reads a key under the name of the diagram it belongs to, so a name written under another kind is a
  // key for that other kind and says nothing here. The flat regexes this used to read with saw them all alike.
  it("says nothing when a key is written under another kind's section", () => {
    expect(drawn(withConfig({ class: { hideEmptyMembersBox: true } }, SEQUENCE))).toBe(drawn(SEQUENCE));
    expect(drawn(withConfig({ sequence: { mirrorActors: true } }, GANTT))).toBe(drawn(GANTT));
  });

  // The body has the last word: mermaid applies the config to the db and then parses over it.
  it("lets a statement of the body win over the same key in the config", () => {
    const both = withConfig({ gantt: { axisFormat: "'%d/%m'" } }, "gantt\n    dateFormat YYYY-MM-DD\n    axisFormat %b %d\n    section S\n    One :a, 2026-03-02, 3d\n");
    expect(drawn(both)).toBe(drawn("gantt\n    dateFormat YYYY-MM-DD\n    axisFormat %b %d\n    section S\n    One :a, 2026-03-02, 3d\n"));
  });

  // `%%{init: {...}}%%` says what the frontmatter says and says it LAST (`cleanAndMerge`, 11.17.0).
  it("lets an init directive win over the frontmatter for the same key", () => {
    const both = withConfig({ gitGraph: { mainBranchName: "trunk" } }, `%%{init: {"gitGraph": {"mainBranchName": "backbone"}} }%%\n${GIT}`);
    const said = drawn(both);
    expect(said).toContain("backbone");
    expect(said).not.toContain("trunk");
  });
});
