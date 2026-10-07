import { describe, expect, it } from "vitest";

import { frontmatterTitle, readFrontmatterTheme, readMermaidTheme, render } from "../../src/index.js";
import { sourceConfig } from "../../src/source/config.js";
import { yamlMap } from "../../src/source/yaml.js";
import { readFrontmatterCss, themeAsked } from "../../src/paint/frontmatter.js";

const SEQUENCE = "sequenceDiagram\n    participant A\n    participant B\n    A->>B: one fairly long message\n    B-->>A: back\n";
const FLOW = (direction: string): string => `flowchart ${direction}\n  A --> B\n`;

// What mermaid 12.0.0's js-yaml reads out of the same blocks, checked with `mermaid.parse(...).config`, 2026-09-30.
describe("the YAML a frontmatter is written in", () => {
  it("reads a one-line `{...}` mapping, nested ones too", () => {
    const read = yamlMap("config: {theme: forest, sequence: {mirrorActors: true}}\n");
    expect(read.get("config")).toEqual(new Map<string, unknown>([["theme", "forest"], ["sequence", new Map([["mirrorActors", "true"]])]]));
    expect(sourceConfig(`---\nconfig: {theme: forest, sequence: {mirrorActors: true}}\n---\n${SEQUENCE}`).section("sequence")).toEqual({ mirrorActors: "true" });
  });

  it("drops a ` #` comment, keeps a `#` glued to a word or inside quotes", () => {
    const read = yamlMap('title: Hello # a note\nconfig:\n  theme: dark # the dark one\n  themeVariables:\n    primaryColor: "#ff0000" # red\n    label: C#\n');
    expect(read.get("title")).toBe("Hello");
    expect(sourceConfig(`---\nconfig:\n  theme: dark # the dark one\n---\n${SEQUENCE}`).config["theme"]).toBe("dark");
    expect(readMermaidTheme('config:\n  themeVariables:\n    primaryColor: "#ff0000" # red\n    label: C#\n').variables).toEqual(
      new Map([["primaryColor", "#ff0000"], ["label", "C#"]])
    );
  });

  it("reads a `|` block as its lines, the block's indent off and one line end kept, `|-` keeping none", () => {
    expect(yamlMap("config:\n  themeCSS: |\n    .marker { fill: red; }\n    .a { b: c; }\n  theme: dark\n").get("config")).toEqual(
      new Map([["themeCSS", ".marker { fill: red; }\n.a { b: c; }\n"], ["theme", "dark"]])
    );
    expect(yamlMap("title: |-\n  Two\n  lines\n").get("title")).toBe("Two\nlines");
  });

  it("reads a `|` block of themeCSS the way a one-line one is read", () => {
    const block = `---\nconfig:\n  themeCSS: |\n    .marker { fill: #ff0000; }\n---\n${FLOW("TD")}`;
    expect(readFrontmatterCss(block)).toBe(".marker { fill: #ff0000; }\n");
    expect(themeAsked(block, "mono").variables.arrowheadColor).toBe("#ff0000");
  });

  it("reads a double-quoted scalar's escapes and a single-quoted one's doubled quote", () => {
    expect(yamlMap('a: "say \\"hi\\""\nb: \'it\'\'s\'\n')).toEqual(new Map([["a", 'say "hi"'], ["b", "it's"]]));
  });
});

describe("the frontmatter title, read by the one reader", () => {
  it("is taken at the block's own level alone, never out of a nested block", () => {
    expect(frontmatterTitle(`---\nconfig:\n  xyChart:\n    title: nested\n---\n${SEQUENCE}`)).toBe("");
    expect(frontmatterTitle(`---\ntitle: 'Quoted one'\n---\n${SEQUENCE}`)).toBe("Quoted one");
  });

  it.each(["TD", "LR"])("drops the ` #` comment of a flowchart %s title", (direction) => {
    const drawn = render(`---\ntitle: Pipeline # draft\n---\n${FLOW(direction)}`, { width: 60 });
    expect(drawn).toContain("Pipeline");
    expect(drawn).not.toContain("draft");
  });
});

// `readFrontmatterTheme` names what `themeAsked` resolves: one reader behind both.
describe("the theme a source names, the same through either door", () => {
  const sources: Array<[label: string, source: string, section: string | undefined]> = [
    ["under config", `---\nconfig:\n  theme: forest\n---\n${FLOW("TD")}`, undefined],
    ["at the root, which mermaid ignores", `---\ntheme: forest\n---\n${FLOW("TD")}`, undefined],
    ["in a directive over the frontmatter", `---\nconfig:\n  theme: forest\n---\n%%{init: {"theme": "dark"}}%%\n${FLOW("TD")}`, undefined],
    ["in a one-line mapping", `---\nconfig: {theme: dark}\n---\n${FLOW("LR")}`, undefined],
    ["under the diagram's own section", `---\nconfig:\n  theme: forest\n  flowchart:\n    theme: dark\n---\n${FLOW("LR")}`, "flowchart"],
  ];

  it.each(sources)("%s", (_label, source, section) => {
    const named = readFrontmatterTheme(source, section);
    expect(themeAsked(source, "mono", undefined, section).name).toBe(named ?? "mono");
  });
});
