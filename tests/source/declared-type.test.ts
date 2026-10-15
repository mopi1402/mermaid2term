import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { declaredType } from "../../src/index.js";

const ROOT = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const FIXTURES = path.join(ROOT, "fixtures");
const SOURCE_EXT = ".mmd";

describe("what a source declares", () => {
  it("names the routed prefix for every specialised type", () => {
    expect(declaredType("sequenceDiagram\n  A->>B: hi\n")).toBe("sequenceDiagram");
    expect(declaredType("gantt\n  title t\n")).toBe("gantt");
    expect(declaredType("xychart-beta\n  bar [1]\n")).toBe("xychart");
    expect(declaredType("block-beta\n  a b\n")).toBe("block");
  });

  it("reads a gitGraph out of its init directive, the one type that may not lead with its own word", () => {
    expect(declaredType('%%{init: {"gitGraph": {}} }%%\ngitGraph\n  commit\n')).toBe("gitGraph");
  });

  it("names stateDiagram for both spellings, the route parse() takes before the fallback", () => {
    expect(declaredType("stateDiagram\n  [*] --> A\n")).toBe("stateDiagram");
    expect(declaredType("stateDiagram-v2\n  [*] --> A\n")).toBe("stateDiagram");
  });

  it("names flowchart for either header word, whatever its case, the way the parser reads its own header", () => {
    expect(declaredType("flowchart TD\n  A --> B\n")).toBe("flowchart");
    expect(declaredType("graph LR\n  A --> B\n")).toBe("flowchart");
    expect(declaredType("GRAPH TD\n  A --> B\n")).toBe("flowchart");
  });

  it("skips what the flowchart parser skips: a comment or a blank above the header hides nothing", () => {
    expect(declaredType("%% a comment\n\nflowchart TD\n  A --> B\n")).toBe("flowchart");
  });

  it("reads the header UNDER a comment for every family, not the one that scans its whole source", () => {
    expect(declaredType("%% a note\ngantt\n  dateFormat YYYY-MM-DD\n")).toBe("gantt");
    expect(declaredType("%% a note\npie title Pets\n  \"Dogs\" : 3\n")).toBe("pie");
    expect(declaredType("%% a note\nsequenceDiagram\n  A->>B: hi\n")).toBe("sequenceDiagram");
    expect(declaredType("   %% indented\n\n%% and another\ngantt\n  dateFormat D\n")).toBe("gantt");
    expect(declaredType("---\ntitle: t\n---\n%% a note\ngantt\n  dateFormat D\n")).toBe("gantt");
  });

  it("leaves `%%{` where it stands, a directive being no comment", () => {
    expect(declaredType('%%{init: {"gitGraph": {}} }%%\ngitGraph\n  commit\n')).toBe("gitGraph");
    expect(declaredType('%% a note\n%%{init: {"gitGraph": {}} }%%\ngitGraph\n  commit\n')).toBe("gitGraph");
  });

  it("drops YAML frontmatter before reading, the way every render does", () => {
    expect(declaredType("---\ntitle: t\n---\nsequenceDiagram\n  A->>B: hi\n")).toBe("sequenceDiagram");
  });

  it("answers undefined for a type this renderer does not know, which the dispatch would draw as a flowchart of nonsense", () => {
    expect(declaredType("sankey-beta\n  A,B,10\n")).toBeUndefined();
    expect(declaredType("radar\n  axis a, b, c\n")).toBeUndefined();
  });

  it("answers undefined for prose and for nothing at all, neither of which declares anything", () => {
    expect(declaredType("ceci est une phrase, pas un diagramme.\n")).toBeUndefined();
    expect(declaredType("")).toBeUndefined();
  });

  it("does not read a WORD OPENING ON a header keyword as the header: the first word matches whole or not at all", () => {
    expect(declaredType("graphique\n  A --> B\n")).toBeUndefined();
  });

  it("declares a known type for every fixture of the corpus, or the fixture exercises a source this would refuse", () => {
    const sources = fs.readdirSync(FIXTURES).filter((name) => name.endsWith(SOURCE_EXT));
    for (const name of sources) {
      const text = fs.readFileSync(path.join(FIXTURES, name), "utf8");
      expect(declaredType(text), name).not.toBeUndefined();
    }
  });
});
