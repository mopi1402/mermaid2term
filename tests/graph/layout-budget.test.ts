import { describe, it, expect } from "vitest";
import { render, renderThemedText, renderThemedTextTimed } from "../../src/index.js";
import { widest } from "../support/drawn.js";

describe("a chain WRAPPED into bands where the budget cannot hold it, which nothing else here does", () => {
  const six = "flowchart LR\n    A[un] --> B[deux]\n    B --> C[trois]\n    C --> D[quatre]\n    D --> E[cinq]\n    E --> F[six]";
  const rowOf = (drawn: string, text: string): number => drawn.split("\n").findIndex((row) => row.includes(text));
  const colOf = (drawn: string, text: string): number => {
    const row = drawn.split("\n").find((line) => line.includes(text)) ?? "";
    return row.indexOf(text);
  };

  it("runs the second band back the other way, under the first", () => {
    const drawn = render(six, { width: 40 });
    expect(rowOf(drawn, "un")).toBe(rowOf(drawn, "trois"));
    expect(rowOf(drawn, "quatre")).toBe(rowOf(drawn, "six"));
    expect(rowOf(drawn, "quatre")).toBeGreaterThan(rowOf(drawn, "un"));
    expect(colOf(drawn, "quatre")).toBeGreaterThan(colOf(drawn, "six"));
  });

  it("steps down at the END of the band, the two nodes standing in one column", () => {
    const drawn = render(six, { width: 40 });
    expect(Math.abs(colOf(drawn, "trois") - colOf(drawn, "quatre"))).toBeLessThanOrEqual(1);
  });

  it("wraps only what does not fit", () => {
    const roomy = render(six, { width: 120 });
    expect(rowOf(roomy, "un")).toBe(rowOf(roomy, "six"));
    expect(roomy.split("\n").length).toBe(5);
  });

  it("takes fewer bands as the budget grows, and never more", () => {
    const bands = [30, 40, 60, 80, 120].map((width) => render(six, { width }).split("\n").length);
    for (let at = 1; at < bands.length; at++) expect(bands[at]).toBeLessThanOrEqual(bands[at - 1]);
  });

  it("is weighed against what the LADDER won, and not against the drawing it started from", () => {
    const three = "flowchart LR\n    a[une etiquette bien longue] --> b[boite] --> c[autre]";
    for (const width of [20, 22, 24, 26]) {
      const widest = Math.max(...render(three, { width }).split("\n").map((row) => [...row].length));
      expect(widest).toBeLessThanOrEqual(width);
    }
  });

  it("folds a chain of INVISIBLE links straight, every band running the same way", () => {
    const six = "flowchart LR\n" + ["un", "deux", "trois", "quatre", "cinq", "six"]
      .map((name, at) => `    ${at === 0 ? "" : `n${at} ~~~ `}n${at + 1}[${name}]`)
      .join("\n");
    const drawn = render(six, { width: 40 });
    for (const [first, second] of [["un", "deux"], ["trois", "quatre"], ["cinq", "six"]] as const) {
      expect(rowOf(drawn, first)).toBe(rowOf(drawn, second));
      expect(colOf(drawn, first)).toBeLessThan(colOf(drawn, second));
    }
    expect(rowOf(drawn, "un")).toBeLessThan(rowOf(drawn, "trois"));
    expect(rowOf(drawn, "trois")).toBeLessThan(rowOf(drawn, "cinq"));
  });

  it("keeps the turn where ONE link is drawn, the run being what a turn saves", () => {
    const mixed = "flowchart LR\n    a[un] ~~~ b[deux]\n    b ~~~ c[trois]\n    c --> d[quatre]\n    d ~~~ e[cinq]\n    e ~~~ f[six]";
    const drawn = render(mixed, { width: 40 });
    expect(colOf(drawn, "quatre")).toBeGreaterThan(colOf(drawn, "six"));
  });

  it("refuses the fold where the graph is not one path", () => {
    for (const source of [
      "flowchart LR\n    A --> B\n    A --> C\n    B --> D\n    C --> D",
      "flowchart LR\n    A --> B\n    B --> C\n    A --> C",
      "flowchart LR\n    subgraph S\n      A --> B\n    end\n    B --> C",
    ]) {
      expect(render(source, { width: 20, bands: 3 })).toBe(render(source, { width: 20 }));
    }
  });
});

describe("a budget with room to spare SPENT on the drawing, never only compacted", () => {
  const source = "flowchart LR\n    A[capteur un] --> C[collecteur]\n    B[capteur deux] --> C\n";
  const heads = (drawn: string): number => (drawn.match(/\u23f5/gu) ?? []).length;
  
  const chain = "flowchart LR\n    A[capteur un] --> B[collecteur] --> C[sortie]\n";
  const tight = (): number => widest(render(chain, { compact: false }));
  const aired = (): number => widest(render(chain, { width: 200, compact: false }));

  it("gives each arrival a head of its own where the budget covers the column", () => {
    expect(heads(render(source, { width: 80 }))).toBe(2);
  });

  it("spends nothing where no budget was announced at all", () => {
    expect(tight()).toBeLessThan(aired());
  });

  it("spends the column on the drawing and not on the budget, however wide it is", () => {
    expect(widest(render(source, { width: 80 }))).toBe(widest(render(source, { width: 200 })));
  });

  it("keeps the tight drawing where the aerated one would overflow by a single column", () => {
    expect(widest(render(chain, { width: aired() - 1, compact: false }))).toBe(tight());
    expect(widest(render(chain, { width: aired(), compact: false }))).toBe(aired());
  });

  it("spends nothing on a drawing the ladder has to compact to fit", () => {
    expect(widest(render(chain, { width: tight() - 10 }))).toBeLessThan(tight());
  });

  it("leaves a gap the caller NAMED exactly where it was put", () => {
    expect(render(source, { width: 80, gap: 3 })).toBe(render(source, { gap: 3 }));
  });

  it("leaves a renderer of its own alone, `gap` being its own number there", () => {
    const block = "block-beta\n    columns 2\n    A[\"un\"] B[\"deux\"]\n";
    expect(render(block, { width: 80 })).toBe(render(block));
  });
});

describe("a height announced beside the width", () => {
  const tall = "flowchart TD\n    A[un] --> B[deux]\n    B --> C[trois]\n    C --> D[quatre]\n";
  const rows = (drawn: string): number => drawn.split("\n").length;
  const cols = (drawn: string): number =>
    Math.max(...drawn.split("\n").map((row) => [...row].length));

  it("spends the padding down to bring the rows under the ceiling", () => {
    const free = rows(render(tall, { width: 80 }));
    const held = rows(render(tall, { width: 80, height: free - 4 }));
    expect(held).toBeLessThan(free);
    expect(held).toBeLessThanOrEqual(free - 4);
  });

  it("leaves a drawing that already fits exactly as it was", () => {
    const free = render(tall, { width: 80 });
    expect(render(tall, { width: 80, height: rows(free) })).toBe(free);
    expect(render(tall, { width: 80, height: rows(free) + 20 })).toBe(free);
  });

  it("never spends a height it was not given", () => {
    expect(render(tall, { width: 80, height: undefined })).toBe(render(tall, { width: 80 }));
  });

  it("hands back the shortest it can reach, rather than nothing, where no step is enough", () => {
    const held = render(tall, { width: 80, height: 3 });
    expect(rows(held)).toBeGreaterThan(3);
    expect(rows(held)).toBeLessThan(rows(render(tall, { width: 80 })));
    expect(held).toContain("quatre");
  });

  it("keeps the width the ladder won while it shortens", () => {
    const wide = "flowchart LR\n" + [1, 2, 3, 4, 5].map((n) => `    N${n}[etape numero ${n}] --> M${n}[fin ${n}]`).join("\n");
    for (const height of [30, 20, 12, 6]) {
      const held = render(wide, { width: 50, height });
      expect(cols(held)).toBeLessThanOrEqual(50);
    }
  });

  it("works on a height alone, no width announced", () => {
    const free = rows(render(tall));
    expect(rows(render(tall, { height: free - 4 }))).toBeLessThan(free);
  });

  it("starts below a paddingY the caller NAMED, an instruction being no default", () => {
    expect(render(tall, { width: 80, height: 4, paddingY: 0 })).toBe(render(tall, { width: 80, paddingY: 0 }));
  });

  it("shortens both candidates before it chooses between them", () => {
    const bare = "flowchart\n    A[alpha] --> B[beta]\n    A --> C[gamma]\n    B --> D[delta]\n    C --> D\n";
    const free = render(bare, { width: 60 });
    const held = render(bare, { width: 60, height: rows(free) - 2 });
    expect(rows(held)).toBeLessThan(rows(free));
    expect(cols(held)).toBeLessThanOrEqual(60);
  });

  it("spends NO row on a width, however tight the ladder had to squeeze", () => {
    const fan = "flowchart\n    A{binaire present} -->|oui| B[dessine]\n    A -->|non| C[texte brut]\n";
    const free = rows(render(fan));
    for (const width of [22, 30, 35, 42, 50, 80]) {
      const held = render(fan, { width });
      expect(rows(held)).toBe(free);
      expect(held).not.toContain("─│");
    }
  });

  it("never INFLATES a drawing that has room to spare, on either axis", () => {
    const drawn = render(tall, { width: 200, height: 200 });
    expect(cols(drawn)).toBeLessThan(30);
    expect(drawn).toBe(render(tall, { width: 200 }));
  });
});

describe("a drawing can be asked what it COST to make", () => {
  const SOURCE = "flowchart LR\n    A[un] --> B[deux]\n    A --> C[trois]\n";

  it("hands back the SAME drawing, byte for byte, as the untimed call", () => {
    const timed = renderThemedTextTimed(SOURCE, { width: 40 }, "neon");
    const plain = renderThemedText(SOURCE, { width: 40 }, "neon");
    expect(timed.text.plain).toBe(plain.plain);
    expect(timed.text.toAnsi()).toBe(plain.toAnsi());
  });

  it("reports a real number of milliseconds, never a negative one and never an infinity", () => {
    const { elapsed } = renderThemedTextTimed(SOURCE, { width: 40 });
    expect(Number.isFinite(elapsed)).toBe(true);
    expect(elapsed).toBeGreaterThanOrEqual(0);
  });

  it("times each call on its OWN, a second render never inheriting the first one's clock", () => {
    const first = renderThemedTextTimed(SOURCE, { width: 40 });
    const second = renderThemedTextTimed(SOURCE, { width: 40 });
    expect(second.elapsed).toBeLessThan(first.elapsed + second.elapsed + 1);
    expect(second.text.plain).toBe(first.text.plain);
  });

  it("carries the OPTIONS through, a width being a width whether the call is timed or not", () => {
    const narrow = renderThemedTextTimed(SOURCE, { width: 24 }).text.plain;
    expect(narrow).toBe(renderThemedText(SOURCE, { width: 24 }).plain);
    for (const row of narrow.split("\n")) expect(row.length).toBeLessThanOrEqual(24);
  });
});
