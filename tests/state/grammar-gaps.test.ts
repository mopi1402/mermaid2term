import { describe, expect, it } from "vitest";

import { parseStateDiagram, render, renderThemed } from "../../src/index.js";
import { NodeShape } from "../../src/graph/shapes.js";
import { Direction } from "../../src/graph/model.js";
import { declaredType } from "../../src/index.js";

const ids = (source: string): string[] => [...parseStateDiagram(source).nodes.keys()];
const label = (source: string, id: string): string | undefined => parseStateDiagram(source).nodes.get(id)?.label;

describe("state statements mermaid accepts that used to be dropped or read as a state", () => {
  it("styles a state with `style`, one id or a comma list, as the state grammar's own STYLE_IDS does", () => {
    const one = parseStateDiagram("stateDiagram-v2\n  style A fill:#0f0\n  A --> B");
    expect(one.nodeStyles.get("A")?.get("fill")).toBe("#0f0");
    const listed = parseStateDiagram("stateDiagram-v2\n  style A,B fill:#f0f,stroke:#00f\n  A --> B");
    expect(listed.nodeStyles.get("A")?.get("fill")).toBe("#f0f");
    expect(listed.nodeStyles.get("B")?.get("stroke")).toBe("#00f");
    expect(renderThemed("stateDiagram-v2\n  style A fill:#0f0\n  A --> B", { width: 60 }, "default")).toContain("48;2;0;255;0");
  });

  it("links a state with `click`, both spellings, whatever order the source writes them in", () => {
    const quoted = parseStateDiagram('stateDiagram-v2\n  A --> B\n  click A "https://ex.com" "a tip"');
    expect(quoted.nodes.get("A")?.link).toBe("https://ex.com");
    const href = parseStateDiagram('stateDiagram-v2\n  click B href "https://ex.com"\n  A --> B');
    expect(href.nodes.get("B")?.link).toBe("https://ex.com");
  });

  it("reads the bracket stereotypes beside the angled ones", () => {
    for (const spelling of ["<<fork>>", "[[fork]]", "<<join>>", "[[join]]"]) {
      expect(parseStateDiagram(`stateDiagram-v2\n  state f ${spelling}\n  A --> f`).nodes.get("f")?.shape).toBe(NodeShape.FORK_JOIN);
    }
    for (const spelling of ["<<choice>>", "[[choice]]"]) {
      expect(parseStateDiagram(`stateDiagram-v2\n  state c ${spelling}\n  A --> c`).nodes.get("c")?.shape).toBe(NodeShape.CHOICE_STATE);
    }
  });

  it("takes the keyword in any case, the header's and the statement's, mermaid's lexer being case-blind", () => {
    expect(declaredType("STATEDIAGRAM-V2\n  A --> B")).toBe("stateDiagram");
    expect(parseStateDiagram("STATEDIAGRAM-V2\n  A --> B").nodes.size).toBe(2);
    expect(parseStateDiagram("stateDiagram-v2\n  STATE f <<fork>>\n  A --> f").nodes.get("f")?.shape).toBe(NodeShape.FORK_JOIN);
    expect(parseStateDiagram('stateDiagram-v2\n  State "Long name" as L\n  L --> B').nodes.get("L")?.label).toBe("Long name");
    const composite = parseStateDiagram("stateDiagram-v2\n  STATE Comp {\n    a --> b\n  }\n  Comp --> Z");
    expect(composite.subgraphs.map((sg) => sg.id)).toEqual(["Comp"]);
  });

  it("names the cluster when the alias and the body ride one statement", () => {
    const graph = parseStateDiagram('stateDiagram-v2\n  state "Named thing" as N {\n    a --> b\n  }\n  N --> Out');
    expect(graph.subgraphs.map((sg) => [sg.id, sg.label])).toEqual([["N", "Named thing"]]);
    expect(graph.subgraphs[0].nodeIds).toEqual(["a", "b"]);
    expect(ids('stateDiagram-v2\n  state "Named thing" as N {\n    a --> b\n  }\n  N --> Out')).toEqual(["a", "b", "Out"]);
  });

  it("closes a composite whose brace pair sits on one line, instead of swallowing the source that follows", () => {
    const graph = parseStateDiagram("stateDiagram-v2\n  state Empty { }\n  A --> B");
    // A and B belong to the drawing, not to the box, which holds only the blank that keeps its room.
    expect(graph.subgraphs[0]?.nodeIds.filter((id) => !id.startsWith("\0"))).toEqual([]);
    expect(ids("stateDiagram-v2\n  state Empty { }\n  A --> B").filter((id) => !id.startsWith("\0"))).toEqual(["A", "B"]);
    expect(parseStateDiagram("stateDiagram-v2\n  state Inline { a --> b }\n  C --> D").subgraphs[0].nodeIds).toEqual(["a", "b"]);
  });

  it("reads a direction wherever it stands on the line, as mermaid's `.*direction\\s+TB` rule does", () => {
    expect(parseStateDiagram("stateDiagram-v2\n  foo direction TB\n  A --> B").direction).toBe(Direction.TB);
    expect(parseStateDiagram("stateDiagram-v2\n  foo direction TB\n  A --> B").directionDeclared).toBe(true);
  });
});

describe("a line break in a state's text is one break, and the box is measured on the lines it makes", () => {
  it("breaks a quoted alias on `<br>`", () => {
    expect(label('stateDiagram-v2\n  state "alias<br>two" as A\n  A --> B', "A")).toBe("alias\\ntwo");
  });

  it("keeps the break of a description out of the box's width", () => {
    const drawn = render("stateDiagram-v2\n  s1 : first<br>second<br>third\n  s1 --> s2", { width: 64 });
    const top = drawn.split("\n").find((line) => line.includes("╭")) ?? "";
    // Six columns of text and its padding, never the width of the three lines laid end to end.
    expect((/╭(─+)╮/u.exec(top)?.[1] ?? "").length).toBe(10);
    expect(drawn).toContain("first");
    expect(drawn).toContain("second");
    expect(drawn).toContain("third");
  });

  it("keeps the breaks a block note was written with, and measures the note on its longest line", () => {
    const drawn = render("stateDiagram-v2\n  A --> B\n  note right of A\n    one\n    two\n  end note", { width: 60 });
    const note = drawn.split("\n").find((line) => line.includes("┌")) ?? "";
    expect((/┌(─+)┐/u.exec(note)?.[1] ?? "").length).toBe(7);
    expect(drawn).toContain("one");
    expect(drawn).toContain("two");
  });
});

// Each measured on mermaid 12 headless (2026-09-29).
describe("state statements mermaid 12 reads that were dropped", () => {
  const rowOf = (drawn: string, word: string): number => drawn.split("\n").findIndex((row) => row.includes(word));

  it("reads the statement written on the header line", () => {
    for (const header of ["stateDiagram-v2", "stateDiagram"]) {
      expect(ids(`${header} A --> B\n`)).toEqual(["A", "B"]);
    }
    for (const direction of ["TB", "LR"]) {
      const drawn = render(`stateDiagram-v2 A --> B\n  direction ${direction}\n`, { width: 60 });
      if (direction === "LR") expect(rowOf(drawn, "A")).toBe(rowOf(drawn, "B"));
      else expect(rowOf(drawn, "A")).toBeLessThan(rowOf(drawn, "B"));
    }
  });

  it("reads a bare id made of any character but a blank, a colon or a dash, as mermaid's ID token does", () => {
    expect(ids("stateDiagram-v2\n  a.b\n  x#y : desc\n  1abc\n")).toEqual(["a.b", "x#y", "1abc"]);
    expect(label("stateDiagram-v2\n  x#y : desc\n", "x#y")).toBe("desc");
    for (const direction of ["TB", "LR"]) {
      const drawn = render(`stateDiagram-v2\n  direction ${direction}\n  a.b\n  x#y : desc\n  a.b --> x#y\n`, { width: 60 });
      expect(drawn).toContain("a.b");
      expect(drawn).toContain("desc");
    }
  });

  it("frames an empty composite, and an empty flowchart subgraph alike, an edge to it reaching the frame", () => {
    for (const direction of ["TB", "LR"]) {
      for (const source of [
        `stateDiagram-v2\n  direction ${direction}\n  state Empty {\n  }\n  A --> Empty\n`,
        `stateDiagram-v2\n  direction ${direction}\n  state Empty\n  {\n  }\n  A --> Empty\n`,
        `flowchart ${direction}\n  subgraph Empty\n  end\n  A --> Empty\n`,
      ]) {
        const drawn = render(source, { width: 60 });
        const title = rowOf(drawn, "Empty");
        expect(title).toBeGreaterThan(-1);
        // The title sits inside a frame: a wall on its row, a lid above it.
        expect(drawn.split("\n")[title]).toMatch(/│\s*Empty\s*│/u);
        expect(drawn).toMatch(/[⏵⏷]/u);
      }
    }
  });

  it("opens a composite whose brace stands on the next line", () => {
    const graph = parseStateDiagram("stateDiagram-v2\n  state X\n  {\n    a --> b\n  }\n");
    expect(graph.subgraphs.map((sg) => [sg.id, sg.nodeIds])).toEqual([["X", ["a", "b"]]]);
    expect(ids("stateDiagram-v2\n  state X\n  {\n    a --> b\n  }\n")).not.toContain("{");
    for (const direction of ["TB", "LR"]) {
      const drawn = render(`stateDiagram-v2\n  direction ${direction}\n  state X\n  {\n    a --> b\n  }\n`, { width: 60 });
      expect(rowOf(drawn, "X")).toBeLessThan(rowOf(drawn, "a"));
    }
  });
});

describe("a `classDef` written twice, merged as mermaid's `addStyleClass` merges it", () => {
  it.each(["TB", "LR"])("keeps the first one's properties under the second's, direction %s", (direction) => {
    const twice = `stateDiagram-v2\n  direction ${direction}\n  classDef x fill:#ff0000\n  classDef x font-weight:bold\n  A:::x --> B\n`;
    const once = `stateDiagram-v2\n  direction ${direction}\n  classDef x fill:#ff0000,font-weight:bold\n  A:::x --> B\n`;
    expect([...(parseStateDiagram(twice).classDefs.get("x") ?? new Map())]).toEqual([["fill", "#ff0000"], ["font-weight", "bold"]]);
    for (const width of [40, 120]) expect(renderThemed(twice, { width }, "default")).toBe(renderThemed(once, { width }, "default"));
  });
});
