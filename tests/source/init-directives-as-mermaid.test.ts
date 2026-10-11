import { describe, expect, it } from "vitest";

import { render, renderThemed } from "../../src/index.js";
import { initConfig } from "../../src/source/directives.js";
import { sourceConfig } from "../../src/source/config.js";
import { readFrontmatterCss, themeAsked } from "../../src/paint/frontmatter.js";

const SEQUENCE = "sequenceDiagram\n    participant A\n    participant B\n    A->>B: one fairly long message\n    B-->>A: back\n";
const framed = (config: string, body: string): string => `---\nconfig:\n${config}---\n${body}`;
const RED = "38;2;255;0;0";

// mermaid 12.0.0's `detectInit`, read in dist/mermaid.js and checked with `mermaid.parse(...).config`, 2026-09-30.
describe("several init directives, merged as mermaid 12 merges them", () => {
  it("merges two blocks for one section key by key, the later winning, rather than the later replacing the block", () => {
    const text = '%%{init: {"sequence": {"mirrorActors": true, "wrap": false}}}%%\n%%{init: {"sequence": {"wrap": true}, "theme": "dark"}}%%\n' + SEQUENCE;
    expect(initConfig(text)).toEqual({ sequence: { mirrorActors: true, wrap: true }, theme: "dark" });
    expect(sourceConfig(text, "sequence").section("sequence")).toEqual({ mirrorActors: "true", wrap: "true" });
  });

  it("draws two directives the way one frontmatter holding both keys draws", () => {
    const split = '%%{init: {"sequence": {"mirrorActors": true}}}%%\n%%{init: {"sequence": {"showSequenceNumbers": true}}}%%\n' + SEQUENCE;
    expect(render(split, { width: 70 })).toBe(render(framed("  sequence:\n    mirrorActors: true\n    showSequenceNumbers: true\n", SEQUENCE), { width: 70 }));
  });

  it("reads `initialize` as `init`", () => {
    expect(initConfig('%%{initialize: {"theme": "forest"}}%%\n' + SEQUENCE)).toEqual({ theme: "forest" });
  });

  it("loses every init directive when one of them is no JSON", () => {
    expect(initConfig('%%{init: {"theme": "forest"}}%%\n%%{init: {theme: dark}}%%\n' + SEQUENCE)).toBeUndefined();
  });

  it("reads single quotes as double ones", () => {
    expect(initConfig("%%{init: {'theme': 'forest'}}%%\n" + SEQUENCE)).toEqual({ theme: "forest" });
  });

  it("reads the directives past the frontmatter, never inside it", () => {
    const inside = `---\ntitle: '%%{init: {"theme": "forest"}}%%'\n---\n${SEQUENCE}`;
    expect(sourceConfig(inside).config["theme"]).toBeUndefined();
  });
});

describe("an init directive's `config`, renamed to the diagram's id", () => {
  it("lands on the section of a diagram whose id is the section's name, replacing what the directive says there", () => {
    const text = '%%{init: {"sequence": {"wrap": true}, "config": {"mirrorActors": true}}}%%\n' + SEQUENCE;
    expect(sourceConfig(text, "sequence").section("sequence")).toEqual({ mirrorActors: "true" });
    expect(render(text, { width: 70 })).toBe(render(framed("  sequence:\n    mirrorActors: true\n", SEQUENCE), { width: 70 }));
  });

  it("lands nowhere for a class, a state or an xychart, whose ids are classDiagram, stateDiagram and xychart", () => {
    for (const [section, header] of [["class", "classDiagram"], ["state", "stateDiagram-v2"], ["xyChart", "xychart"]] as const) {
      const text = `%%{init: {"config": {"layout": "dagre"}}}%%\n${header}\n`;
      expect([section, sourceConfig(text, section).section(section)]).toEqual([section, {}]);
    }
  });

  it("lands nowhere under a `flowchart-elk` header, whose id mermaid never renames", () => {
    const text = '%%{init: {"config": {"curve": "linear"}}}%%\nflowchart-elk TD\n  A --> B\n';
    expect(sourceConfig(text, "flowchart").section("flowchart")).toEqual({});
    expect(sourceConfig('%%{init: {"config": {"curve": "linear"}}}%%\nflowchart TD\n  A --> B\n', "flowchart").section("flowchart")).toEqual({ curve: "linear" });
  });

  it("lands on no other section than the diagram's own", () => {
    const text = '%%{init: {"config": {"curve": "linear"}}}%%\nstateDiagram-v2\n  a --> b\n';
    expect(sourceConfig(text, "state").section("flowchart")).toEqual({});
  });

  it("is dropped when several directives are merged, mermaid's sanitizer knowing no `config` key", () => {
    const text = '%%{init: {"config": {"mirrorActors": true}}}%%\n%%{init: {"theme": "dark"}}%%\n' + SEQUENCE;
    expect(initConfig(text)).toEqual({ theme: "dark" });
    expect(sourceConfig(text, "sequence").section("sequence")).toEqual({});
  });
});

describe("a `themeCSS` written in an init directive", () => {
  const CSS = ".marker { fill: #ff0000; }";

  it("is read as the frontmatter's would be", () => {
    expect(readFrontmatterCss(`%%{init: {"themeCSS": "${CSS}"}}%%\nflowchart TD\n  A --> B\n`)).toBe(CSS);
    expect(themeAsked(`%%{init: {"themeCSS": "${CSS}"}}%%\nflowchart TD\n  A --> B\n`, "mono").variables.arrowheadColor).toBe("#ff0000");
  });

  it.each(["TD", "LR"])("recolours the arrowheads of a flowchart %s", (direction) => {
    const drawn = renderThemed(`%%{init: {"themeCSS": "${CSS}"}}%%\nflowchart ${direction}\n  A --> B\n`, {}, "mono");
    expect(drawn).toContain(RED);
    expect(renderThemed(`flowchart ${direction}\n  A --> B\n`, {}, "mono")).not.toContain(RED);
  });
});
