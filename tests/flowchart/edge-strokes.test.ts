import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { EdgeStyle, type Edge } from "../../src/graph/model.js";
import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";

describe("a dotted run LENGTHENED by its dots, still an arrow", () => {
  const linked = (arrow: string): Edge | undefined => parseFlowchart(`flowchart LR\n  A ${arrow} B`).edges[0];

  it("draws the edge at all, where the second dot dropped it", () => {
    for (const arrow of ["-.-", "-..-", "-...-", "-....-"]) {
      expect([arrow, linked(arrow) !== undefined]).toEqual([arrow, true]);
    }
  });

  it("counts a rank per dot, the way a solid run counts one per dash", () => {
    expect([linked("-.-")?.minLength, linked("-..-")?.minLength, linked("-...-")?.minLength]).toEqual([1, 2, 3]);
    expect([linked("---")?.minLength, linked("----")?.minLength, linked("-----")?.minLength]).toEqual([1, 2, 3]);
  });

  it("stays a DOTTED link with no head at either end", () => {
    const edge = linked("-...-");
    expect(edge?.style).toBe(EdgeStyle.DOTTED);
    expect([edge?.hasArrowStart, edge?.hasArrowEnd]).toEqual([false, false]);
  });

  it("leaves every spelling that already ends in a MARK reading as it did", () => {
    const held: Array<readonly [string, boolean, boolean]> = [
      ["-..->", false, true],
      ["<-..->", true, true],
      ["o-..-o", true, true],
      ["x-...-x", true, true],
      ["-..-o", false, true],
      ["-..-x", false, true],
    ];
    for (const [arrow, start, end] of held) {
      const edge = linked(arrow);
      expect([arrow, edge?.hasArrowStart, edge?.hasArrowEnd]).toEqual([arrow, start, end]);
      expect([arrow, edge?.style]).toEqual([arrow, EdgeStyle.DOTTED]);
    }
  });

  it("swallows a mark at the START of a run ending on none, as mermaid's reader looks at the last character alone", () => {
    for (const [arrow, plain] of [["<-.-", "-.-"], ["<---", "---"], ["<===", "==="], ["o---", "---"], ["x-.-", "-.-"]]) {
      const graph = parseFlowchart(`flowchart LR\n  A[Rectangle] ${arrow} B(Rounded)`);
      const edge = graph.edges[0];
      expect([arrow, [...graph.nodes.keys()]]).toEqual([arrow, ["A", "B"]]);
      expect([arrow, edge?.style, edge?.hasArrowStart, edge?.hasArrowEnd]).toEqual([arrow, linked(plain)?.style, false, false]);
    }
    expect(linked("<---")?.minLength).toBe(linked("--->")?.minLength);
    expect([...parseFlowchart("flowchart LR\n  Ax---B").nodes.keys()]).toEqual(["Ax", "B"]);
  });

  it("carries a label either way it is written, and lengthens under it", () => {
    expect(linked("-...-|non|")?.label).toBe("non");
    expect(linked("-...-|non|")?.minLength).toBe(3);
    expect(linked("-. oui ..->")?.label).toBe("oui");
    expect(linked("-. oui ..->")?.minLength).toBe(2);
  });

  it("draws the two ladders the same shape, one dotted and one solid", () => {
    const solid = render("flowchart LR\n  A ----- B", { width: 80 });
    const dotted = render("flowchart LR\n  A -...- B", { width: 80 });
    expect(dotted.replace(/\u2504/gu, "\u2500")).toBe(solid);
  });
});

describe("the two axes of a DASHED line depaired, which drew the same dash count on both", () => {
  const H = "\u2504";
  const V = "\u250a";
  const HEAVY_H = "\u254d";
  const HEAVY_V = "\u250b";
  const OLD_V = "\u2506";

  it("carries a DIFFERENT dash count on each axis, the vertical the denser of the two", () => {
    const down = render("flowchart TD\n    A[un] -.-> B[deux]\n", { width: 60 });
    const across = render("flowchart LR\n    A[un] -.-> B[deux]\n", { width: 60 });
    expect(down).toContain(V);
    expect(across).toContain(H);
    expect(down).not.toContain(OLD_V);
  });

  it("depairs a DASHARRAY border the same way: the wall one level denser than the lid, at every level", () => {
    const fine = render("flowchart TD\n    A[Comment]\n    style A stroke-dasharray:2\n", { width: 60 });
    expect(fine).toContain(`┌${H}`);
    expect(fine.split("\n").some((row) => row.startsWith(V))).toBe(true);
    const gras = render("flowchart TD\n    A[Comment]\n    style A stroke-dasharray:3,stroke-width:4px\n", { width: 60 });
    expect(gras).toContain(`┏${HEAVY_H}`);
    expect(gras.split("\n").some((row) => row.startsWith("\u2507"))).toBe(true);
    expect(gras).not.toContain(HEAVY_V);
  });

  it("reads the dasharray's FIRST number as the level: 1 the finest, 4 the coarsest glyph, 5 and more every other cell", () => {
    const lid = (dash: string): string => render(`flowchart TD\n    A[Comment]\n    style A stroke-dasharray:${dash}\n`, { width: 60 }).split("\n")[0];
    expect(lid("1 9")).toMatch(/^┌\u2508+┐$/u);
    expect(lid("2")).toMatch(/^┌\u2504+┐$/u);
    expect(lid("3 3")).toMatch(/^┌\u254c+┐$/u);
    expect(lid("4")).toMatch(/^┌\u2574+┐$/u);
    expect(lid("5 5")).toMatch(/^┌─( ─)+ ?┐$/u);
    expect(lid("12")).toMatch(/^┌─( ─)+ ?┐$/u);
    expect(lid("0")).toMatch(/^┌─+┐$/u);
    expect(lid("none")).toMatch(/^┌─+┐$/u);
  });

  it("holds a sequence diagram's own dotted lines to it, loop and frame alike", () => {
    const drawn = render("sequenceDiagram\n    A<<-->>A: sync\n", { width: 80 });
    expect(drawn).toContain(V);
    expect(drawn).not.toContain(OLD_V);
  });

  it("keeps the COMPACTION, which a stroke it does not know would have taken out in silence", () => {
    const chain = (arrow: string): string =>
      `flowchart TD\n    A[un] ${arrow} B[deux]\n    A ${arrow} C[trois]\n    B ${arrow} D[quatre]\n` +
      `    C ${arrow} D\n    A ${arrow} D\n`;
    const solid = render(chain("-->"), { width: 60 }).split("\n").length;
    const dotted = render(chain("-.->"), { width: 60 }).split("\n").length;
    expect(dotted).toBe(solid);
  });
});

describe("a THICK run's own weight carried onto the TEE it cuts, which broke on the border", () => {
  const DOWN = "\u2530";
  const UP = "\u2538";
  const RIGHT = "\u251d";
  const LEFT = "\u2525";
  const HEAVY_DOWN = "\u2533";

  it("cuts the tee its own weight leaving a box, down the page and across it", () => {
    expect(render("flowchart TD\n    A[un] ==> B[deux]\n", { width: 60 })).toContain(DOWN);
    expect(render("flowchart LR\n    A[un] ==> B[deux]\n", { width: 60 })).toContain(RIGHT);
  });

  it("leaves a hairline run the hairline tee, on the very same drawing", () => {
    const drawn = render("flowchart TD\n    A[un] --> B[deux]\n    A ==> C[trois]\n", { width: 60 });
    expect(drawn).toContain("\u252c");
    expect(drawn).toContain(DOWN);
  });

  it("carries the weight through a mirror, the stub trading ends with the drawing", () => {
    expect(render("flowchart BT\n    A[un] ==> B[deux]\n", { width: 60 })).toContain(UP);
    expect(render("flowchart RL\n    A[un] ==> B[deux]\n", { width: 60 })).toContain(LEFT);
  });

  it("goes heavy the whole way round where the BORDER is thick as well", () => {
    const drawn = render("flowchart TD\n    A[un] ==> B[deux]\n    style A stroke-width:4px\n", { width: 60 });
    expect(drawn).toContain(HEAVY_DOWN);
    expect(drawn).not.toContain(DOWN);
  });

  it("keeps the LIGHT stub a hairline run cuts into a thick border, which was already right", () => {
    const drawn = render("flowchart TD\n    A[un] --> B[deux]\n    style A stroke-width:4px\n", { width: 60 });
    expect(drawn).toContain("\u252f");
    expect(drawn).not.toContain(HEAVY_DOWN);
  });
});

describe("an INVISIBLE link marking nothing at all, no tee cut into either box", () => {
  it("leaves both borders whole, no tee on either end", () => {
    const drawn = render("flowchart LR\n    A ~~~ B", { width: 80 });
    expect(drawn).not.toContain("├");
    expect(drawn).not.toContain("┤");
    expect(drawn).toContain("│  A  │");
    expect(drawn).toContain("│  B  │");
  });

  it("does the same downwards, where the tees were a `┬` and a `┴`", () => {
    const drawn = render("flowchart TD\n    A ~~~ B", { width: 80 });
    expect(drawn).not.toContain("┬");
    expect(drawn).not.toContain("┴");
  });

  it("turns no visible corner where it has to dodge", () => {
    const drawn = render("flowchart TD\n    A ~~~ B\n    A ~~~ C\n", { width: 80 });
    for (const corner of ["╭", "╮", "╰", "╯"]) expect(drawn).not.toContain(corner);
  });

  it("still holds the nodes apart, which is the whole of what it is for", () => {
    const held = render("flowchart LR\n    A ~~~ B", { width: 80 }).split("\n")[2];
    const alone = render("flowchart LR\n    A\n    B", { width: 80 }).split("\n")[2];
    expect(held.length).toBeGreaterThan(0);
    expect(held).toContain("A");
    expect(held).toContain("B");
    expect(alone).not.toBe(held);
  });

  it("leaves the visible edges beside it untouched", () => {
    const drawn = render("flowchart LR\n    A ~~~ B\n    B --> C", { width: 80 });
    expect(drawn).toMatch(/│  A  │\s+│  B  ├─+⏵│  C  │/u);
  });
});

describe("a circle or a cross on a thick or a dotted edge, read as the edge's end and not as text", () => {
  const both: ReadonlyArray<readonly [string, string, string]> = [
    ["o==o", "●", "━"],
    ["x==x", "×", "━"],
    ["o-.-o", "●", "┄"],
    ["x-.-x", "×", "┄"],
  ];

  it.each(both)("draws %s as its own mark at either end of its own stroke", (arrow, mark, stroke) => {
    const drawn = render(`graph LR\n    A[un] ${arrow} B[deux]\n`, { width: 80 });
    expect(drawn).toMatch(new RegExp(`${mark}${stroke}+${mark}`, "u"));
    expect(drawn).not.toContain(arrow);
    expect(drawn).toContain("un");
    expect(drawn).toContain("deux");
  });

  const one: ReadonlyArray<readonly [string, string, string]> = [
    ["==o", "●", "━"],
    ["==x", "×", "━"],
    ["-.-o", "●", "┄"],
    ["-.-x", "×", "┄"],
  ];

  it.each(one)("draws %s as one mark, the stroke saying which edge it is", (arrow, mark, stroke) => {
    const drawn = render(`graph LR\n    A[un] ${arrow} B[deux]\n`, { width: 80 });
    expect(drawn).toMatch(new RegExp(`${stroke}+${mark}`, "u"));
    expect(drawn).not.toContain(arrow);
  });

  it("reads the same endings on an arrow carrying its label between its halves", () => {
    const drawn = render("graph LR\n    A[un] o== texte ==o B[deux]\n", { width: 80 });
    expect(drawn).toContain("texte");
    expect(drawn).toMatch(/●━+●/u);
  });

  it("reads them on an arrow carrying its label between pipes", () => {
    const drawn = render("graph LR\n    A[un] -.-o|texte| B[deux]\n", { width: 80 });
    expect(drawn).toContain("texte");
    expect(drawn).toMatch(/┄+●/u);
    expect(drawn).not.toContain("⏵");
  });
});
