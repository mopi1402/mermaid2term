import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

describe("an edge label, kept out of the box next door and costing no arrowhead", () => {
  const SOURCE = "graph TD\n    A --> B\n    A -.-> C\n    A ==> D\n    B -->|label| C\n";

  it.each(TWO_PANES)("keeps every arrowhead at width %i", (width) => {
    const drawn = render(SOURCE, { width });
    expect([...drawn].filter((c) => c === "⏷")).toHaveLength(3);
  });

  it.each(TWO_PANES)("still draws the label at width %i", (width) => {
    expect(render(SOURCE, { width })).toContain("label");
  });

  it("keeps the label out of every node's box", () => {
    const rows = render(SOURCE, { width: 80 }).split("\n");
    const tops = rows.find((line) => line.includes("┌")) ?? "";
    const interiors: Array<[number, number]> = [];
    for (let c = 0; c < tops.length; c++) {
      if (tops[c] !== "┌") continue;
      const close = tops.indexOf("┐", c);
      if (close > c) interiors.push([c + 1, close - 1]);
    }
    expect(interiors.length).toBeGreaterThan(0);

    for (const row of rows) {
      const at = row.indexOf("label");
      if (at < 0) continue;
      for (const [from, to] of interiors) {
        expect(at > to || at + "label".length - 1 < from).toBe(true);
      }
    }
  });
});

describe("the two spellings of a labelled link, one line as mermaid calls it", () => {
  const pairs: ReadonlyArray<readonly [string, string]> = [
    ["A-- text ---B", "A---|text|B"],
    ["A-- text -->B", "A-->|text|B"],
    ["A-. text .-B", "A-.-|text|B"],
    ["A== text ===B", "A===|text|B"],
    ["A-- text ----->B", "A----->|text|B"],
  ];

  it("draws the two spellings of one link to the same byte, at every style and length", () => {
    for (const [split, piped] of pairs) {
      const one = render(`flowchart LR\n    ${split}`, { width: 80 });
      const other = render(`flowchart LR\n    ${piped}`, { width: 80 });
      expect(one).toBe(other);
      expect(one).toContain("text");
    }
  });

  it("leaves an OPEN link open, the head being the whole of what it is not", () => {
    for (const source of ["A-- text ---B", "A---|text|B", "A== text ===B", "A===|text|B"]) {
      expect(render(`flowchart LR\n    ${source}`, { width: 80 })).not.toContain("⏵");
    }
  });

  it("keeps the mark a piped arrow SPELLS, which is the reason the head was ever put there", () => {
    expect(render("flowchart LR\n    A-->|text|B", { width: 80 })).toContain("⏵");
    expect(render("flowchart LR\n    A--o|text|B", { width: 80 })).toContain("●");
    expect(render("flowchart LR\n    A--x|text|B", { width: 80 })).toContain("×");
    expect(render("flowchart LR\n    A--|text|B", { width: 80 })).toContain("⏵");
  });

  it("measures a labelled link on the run written AFTER the text, and not on both halves", () => {
    const ranks = [
      ["A-- text ---B", "A---|text|B"],
      ["A-- text ----B", "A----|text|B"],
      ["A-- text -----B", "A-----|text|B"],
    ] as const;
    let previous = 0;
    for (const [split, piped] of ranks) {
      const drawn = render(`flowchart LR\n    ${split}`, { width: 200 });
      expect(drawn).toBe(render(`flowchart LR\n    ${piped}`, { width: 200 }));
      const width = drawn.split("\n")[0]?.length ?? 0;
      expect(width).toBeGreaterThanOrEqual(previous);
      previous = width;
    }
    expect(render("flowchart LR\n    A-- text ---B", { width: 200 }).split("\n")[0]?.length ?? 0).toBeLessThan(
      render("flowchart LR\n    A----|text|B", { width: 200 }).split("\n")[0]?.length ?? 0
    );
  });
});

describe("an edge label left in the theme's colour, whatever its edge's stroke", () => {
  const SOURCE =
    "graph LR\n    A[Start] --> B{Check}\n    B -->|ok| C[Work]\n    B -->|ko| A\n" +
    "    linkStyle 1 stroke:#22c55e\n    linkStyle 2 stroke:#ef4444\n";

  // mermaid 12 hands a label its `linkStyle`'s text properties alone (`isLabelStyle`): the stroke stays on the line.
  it("never writes a label in the stroke its own edge is drawn with", () => {
    const painted = renderThemed(SOURCE, { width: 80 }, "classic");
    expect(painted).not.toMatch(/\u001b\[[0-9;]*38;2;239;68;68[0-9;]*m\s*ko/u);
    expect(painted).not.toMatch(/\u001b\[[0-9;]*38;2;34;197;94[0-9;]*m\s*ok/u);
    expect(painted).toContain("38;2;239;68;68m");
  });

  it("leaves the labels of an uncoloured edge to the theme", () => {
    const painted = renderThemed("graph LR\n    A[un] -->|passe| B[deux]\n", { width: 80, look: "classic" }, "classic");
    expect(painted).not.toContain("38;2;");
  });
});

describe("a row refused to a second label, which pushes it off the run it names", () => {
  const gates =
    "graph LR\n    A[Push] --> B[Build]\n    B --> C{Pass?}\n    C -->|Yes| D[Stage]\n    C -->|No| F[Notify]\n" +
    "    D --> G{Approve?}\n    G -->|Yes| H[Prod]\n    G -->|No| F\n    H --> I{Healthy?}\n" +
    "    I -->|Yes| J[Done]\n    I -->|No| F\n";

  it("writes every label the author wrote", () => {
    const drawn = render(gates, { width: 80 });
    expect((drawn.match(/\bNo\b/gu) ?? []).length).toBe(3);
    expect((drawn.match(/\bYes\b/gu) ?? []).length).toBe(3);
  });

  it("keeps each one against a mark of its own edge, never alone on the canvas", () => {
    const rows = render(gates, { width: 80 }).split("\n");
    rows.forEach((row, at) => {
      for (const found of row.matchAll(/\b(?:No|Yes)\b/gu)) {
        const from = Math.max(0, (found.index) - 1);
        const to = (found.index) + found[0].length + 1;
        const around = [rows[at - 1], row, rows[at + 1]].map((line) => (line ?? "").slice(from, to)).join("");
        expect(around).toMatch(/[│┃┄─━┤├⏶⏷⏴⏵╭╮╰╯┬┴┼]/u);
      }
    });
  });

  it("draws every arrival at a node three edges fall back on, running DOWN as well", () => {
    const drawn = render(
      "graph TD\n    A[Push] --> B[Build]\n    B --> C{Pass?}\n    C -->|Yes| D[Stage]\n    C -->|No| E[Notify]\n" +
        "    D --> F{Approve?}\n    F -->|Yes| G[Prod]\n    F -->|No| E\n    G --> H{Healthy?}\n" +
        "    H -->|Yes| I[Done]\n    H -->|No| E\n",
      { width: 80 }
    );
    expect((drawn.match(/\bNo\b/gu) ?? []).length).toBe(3);
    const heads = (drawn.match(/[⏷⏶⏴⏵]/gu) ?? []).length;
    expect(heads).toBeGreaterThanOrEqual(9);
  });

  it("centres a label on the run it names, and never writes it flush against its own head", () => {
    const drawn = render(
      "graph LR\n    A[Start] --> B{Check}\n    B -->|ok| C[Work]\n    B -->|ko| A\n" +
        "    C --> D{Again?}\n    D -->|yes| B\n    D -->|no| E[End]\n",
      { width: 80 }
    );
    const rows = drawn.split("\n");
    expect(rows.some((row) => row.includes(" ok ") && row.includes(" no "))).toBe(true);
    for (const row of rows) expect(row).not.toMatch(/[A-Za-z][⏶⏷⏴⏵]|[⏶⏷⏴⏵][A-Za-z]/u);
  });

  it("still keeps two labels a blank apart, so the pair never reads as one word", () => {
    const drawn = render(gates, { width: 80 });
    expect(drawn).not.toMatch(/(?:No|Yes)(?:No|Yes)/u);
  });
});
