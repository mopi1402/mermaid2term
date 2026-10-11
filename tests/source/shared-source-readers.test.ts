import { describe, expect, it } from "vitest";
import { Direction, directionOf } from "../../src/graph/model.js";
import { keywordRest, statementsOf } from "../../src/source/lines.js";
import { splitOutsideQuotes, unfenced } from "../../src/source/quotes.js";
import { cssLineOf, readClassDef } from "../../src/source/css.js";
import { nestByIndent } from "../../src/diagrams/@common/nest.js";
import { braceBody } from "../../src/diagrams/@common/box-diagram.js";
import { applyRules, type LineRule } from "../../src/diagrams/@common/rules.js";
import { parseQuadrant } from "../../src/diagrams/quadrant/parser.js";

describe("the source readers every kind shares keep each kind's own reading", () => {
  it("a direction word folds `TD` into `TB` only where the kind asks it to", () => {
    expect(directionOf("td")).toBe(Direction.TD);
    expect(directionOf("td", true)).toBe(Direction.TB);
    expect(directionOf("sideways")).toBeUndefined();
  });

  it("a keyword takes any blank after it, or the kind's own stop", () => {
    expect(keywordRest("Title\tA", "title")).toBe("A");
    expect(keywordRest("title\tA", "title", / /u)).toBeUndefined();
    expect(parseQuadrant("quadrantChart\n  x-axis Low --> High\n  quadrant-1 Win\n")).toMatchObject({ xLabel: "Low -> High", quadrant1: "Win" });
  });

  it("a split skips quotes, and brackets only where the kind's lexer does", () => {
    expect(splitOutsideQuotes('a;"b;c";[d;e]', ";")).toEqual(["a", '"b;c"', "[d", "e]"]);
    expect(statementsOf('a;"b;c";[d;e]')).toEqual(["a", '"b;c"', "[d;e]"]);
    expect(unfenced('"`**x**`"')).toBe("**x**");
    expect(unfenced('"x"')).toBe("x");
  });

  it("a `classDef` merges into what the class held, a quadrant's replaces it", () => {
    const defs = new Map<string, Map<string, string>>();
    expect(readClassDef(defs, "classDef c fill:#f00")).toBe(true);
    expect(readClassDef(defs, "classDef c color:#fff")).toBe(true);
    expect(readClassDef(defs, "class a c")).toBe(false);
    expect([...(defs.get("c") ?? [])]).toEqual([["fill", "#f00"], ["color", "#fff"]]);
    expect(cssLineOf("classDef a,b fill:#f00")).toEqual({ names: "a,b", props: new Map([["fill", "#f00"]]) });
    const chart = parseQuadrant("quadrantChart\n  classDef c color: #ff0000\n  classDef c radius: 2\n  P:::c: [0.5, 0.5]\n");
    expect(chart.points[0].color).toBeUndefined();
  });

  it("an item hangs from the last one read at a smaller indent", () => {
    const parentOf = nestByIndent<string>();
    expect(["a", "b", "c", "d"].map((item, i) => parentOf([0, 2, 4, 2][i], item))).toEqual([undefined, "a", "b", "a"]);
  });

  it("a brace body skips its blank rows and ends past its `}`", () => {
    expect(braceBody(["A {", "  x", "", "  y", "}", "B"], 1)).toEqual({ rows: ["x", "y"], next: 5 });
    expect(braceBody(["A {", "  x"], 1)).toEqual({ rows: ["x"], next: 2 });
  });

  it("the first rule that matches and holds reads the line", () => {
    const read: string[] = [];
    const rules: ReadonlyArray<LineRule<{ open: boolean }>> = [
      { pattern: /^end$/u, when: (reading) => reading.open, apply: () => read.push("closed") },
      { pattern: /^\w+$/u, apply: (_reading, found) => read.push(found[0]) },
    ];
    expect(applyRules(rules, { open: false }, "end")).toBe(true);
    expect(applyRules(rules, { open: true }, "end")).toBe(true);
    expect(applyRules(rules, { open: true }, "a b")).toBe(false);
    expect(read).toEqual(["end", "closed"]);
  });
});
