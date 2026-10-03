import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";

describe("a gap squeezed under what an edge needs, the arrowhead kept", () => {
  const tight = (source: string): string => render(source, { gap: 1 });
  const between = (drawn: string, mark: string): string => {
    const line = drawn.split("\n").find((row) => row.includes(mark)) ?? "";
    return line.slice(line.indexOf(mark) + mark.length).split(/[│┤]/u)[0] ?? "";
  };

  const styles: ReadonlyArray<readonly [string, string, string, string]> = [
    ["solid", "-->", "─", "├"],
    ["dotted", "-.->", "┄", "├"],
    ["thick", "==>", "━", "\u251d"],
  ];

  it.each(styles)("keeps the %s of an arrow readable at the tightest gap", (_name, arrow, stroke, tee) => {
    const drawn = tight(`flowchart LR\n    A[Alpha] ${arrow} B[Beta]\n`);
    expect(between(drawn, tee)).toContain(stroke);
  });

  it.each(styles)("keeps BOTH heads of a two-headed %s edge, and its stroke", (_name, arrow, stroke) => {
    const drawn = tight(`flowchart LR\n    A[Alpha] <${arrow} B[Beta]\n`);
    const run = drawn.split("\n").find((row) => row.includes("⏴")) ?? "";
    expect(run).toContain("⏴");
    expect(run).toContain("⏵");
    expect(run.slice(run.indexOf("⏴"), run.indexOf("⏵"))).toContain(stroke);
  });

  it("keeps both heads down a vertical run, where one alone reads as the other direction", () => {
    const drawn = tight("flowchart TD\n    A[Alpha] <--> B[Beta]\n");
    expect(drawn).toContain("⏶");
    expect(drawn).toContain("⏷");
  });

  it("gives each of TWO edges sharing one gap a row of its own, head, stroke and label", () => {
    const drawn = tight(
      "stateDiagram-v2\n    direction TB\n    [*] --> Active\n    state Active {\n        Ready --> Working : pick\n" +
        "        Working --> Ready : done\n    }\n    Active --> [*]\n"
    );
    const rows = drawn.split("\n");
    const forward = rows.findIndex((row) => row.includes("⏵"));
    const back = rows.findIndex((row) => row.includes("⏴"));
    expect(forward).toBeGreaterThan(0);
    expect(back).toBeGreaterThan(forward);
    const out = rows[forward];
    const home = rows[back];
    expect(out).not.toContain("⏴");
    expect(home).not.toContain("⏵");
    expect(out.slice(out.indexOf("├"), out.indexOf("⏵"))).toContain("─");
    expect(home.slice(home.indexOf("⏴"), home.indexOf("┤"))).toContain("─");
    expect(rows[forward - 1]).toContain("pick");
    expect(rows[back - 1]).toContain("done");
  });

  it("holds the floor against a label short enough to squeeze the arrow out", () => {
    const drawn = tight("flowchart LR\n    A[Alpha] <==>|X| B[Beta]\n");
    const run = drawn.split("\n").find((row) => row.includes("⏴")) ?? "";
    expect(run.slice(run.indexOf("⏴"), run.indexOf("⏵"))).toContain("━");
  });

  it("gives an edge that TURNS a gap to swing in, so its head lands under a corner and its label keeps a line", () => {
    const drawn = tight(
      "graph LR\n    A[Start] --> B[Work]\n    A --> Q[Queue]\n    Q --> R[Run]\n" +
        "    B --> C[Check]\n    C --> Z[End]\n    C -->|redo| Q\n"
    );
    expect(drawn).toContain("redo");
    const rows = drawn.split("\n");
    const arrival = rows.findIndex((row) => row.includes("⏷"));
    expect(arrival).toBeGreaterThan(0);
    const at = rows[arrival].indexOf("⏷");
    expect([...(rows[arrival - 1])][at]).toMatch(/[╭╮]/u);
  });

  it("holds the band a BACK edge comes home through, which it never crosses a gap to reach", () => {
    const drawn = tight(
      "graph LR\n    A[Start] --> B{Check}\n    B -->|ok| C[Work]\n    B -->|ko| A\n" +
        "    C --> D{Again?}\n    D -->|yes| B\n    D -->|no| E[End]\n"
    );
    const heads = drawn.split("\n").filter((row) => row.includes("\u23f6"));
    expect(heads.length).toBeGreaterThan(0);
    for (const row of heads) expect(row).not.toMatch(/\u23f6[\u2500\u2501\u2504]|[\u2500\u2501\u2504]\u23f6/u);
  });

  it("gives each back edge a corner of its own, where two merged read as one line past the node", () => {
    const drawn = tight(
      "graph LR\n    A[Start] --> B{Check}\n    B -->|ok| C[Work]\n    B -->|ko| A\n" +
        "    C --> D{Again?}\n    D -->|yes| B\n    D -->|no| E[End]\n"
    );
    const rows = drawn.split("\n");
    const heads = rows.findIndex((row) => row.includes("\u23f6"));
    expect(heads).toBeGreaterThan(0);
    const below = [...(rows[heads + 1] ?? "")];
    for (const [at, mark] of [...(rows[heads])].entries()) {
      if (mark === "\u23f6") expect(below[at]).toBe("\u2570");
    }
    expect(rows[heads + 1]).not.toContain("\u2534");
  });

  it("feeds every arrowhead STRAIGHT, the corner of its last turn drawn beside it and never under it", () => {
    const fed = (drawn: string): string[] => {
      const rows = drawn.split("\n").map((line) => [...line]);
      const at = (r: number, c: number): string => rows[r]?.[c] ?? " ";
      const down = new Set(["\u2502", "\u2503", "\u2506", "\u250a", "\u256d", "\u256e", "\u252c", "\u253c", "\u251c", "\u2524"]);
      const up = new Set(["\u2502", "\u2503", "\u2506", "\u250a", "\u2570", "\u256f", "\u2534", "\u253c", "\u251c", "\u2524"]);
      const right = new Set(["\u2500", "\u2501", "\u2504", "\u2550", "\u2570", "\u256d", "\u251c", "\u253c", "\u252c", "\u2534"]);
      const left = new Set(["\u2500", "\u2501", "\u2504", "\u2550", "\u256f", "\u256e", "\u2524", "\u253c", "\u252c", "\u2534"]);
      const starving: string[] = [];
      rows.forEach((row, r) =>
        row.forEach((glyph, c) => {
          if (glyph === "\u23f7" && !down.has(at(r - 1, c))) starving.push(`\u23f7@${r},${c}`);
          if (glyph === "\u23f6" && !up.has(at(r + 1, c))) starving.push(`\u23f6@${r},${c}`);
          if (glyph === "\u23f5" && !right.has(at(r, c - 1))) starving.push(`\u23f5@${r},${c}`);
          if (glyph === "\u23f4" && !left.has(at(r, c + 1))) starving.push(`\u23f4@${r},${c}`);
        })
      );
      return starving;
    };

    const crossing =
      "flowchart\n    A[a] --> X[x]\n    A --> Y[y]\n    B[b] --> X\n    B --> Y\n" +
      "    C[c] --> X\n    C --> Z[z]\n    B --> Z\n";
    for (const width of [22, 25, 40, 80]) expect(fed(render(crossing, { width }))).toEqual([]);

    const labelled =
      "flowchart TD\n    A[Entree] -->|premier| B[Milieu]\n    A -->|second| C[Cote]\n" +
      "    A ==>|troisieme| D[Gros]\n    B -.->|quatrieme| D\n";
    expect(fed(render(labelled, { width: 40 }))).toEqual([]);
  });

  it("prices a back edge at what the search paid, so it never crosses to save nothing", () => {
    const drawn = render(
      "stateDiagram-v2\n    Review --> Waiting : missing evidence\n    Waiting --> Review : evidence added\n" +
        "    Review --> Approved : approve\n    Review --> Rejected : reject\n",
      { width: 80 }
    );
    expect(drawn).not.toMatch(/\u2500\u2502\u2500/u);
    const rows = drawn.split("\n");
    const head = rows.findIndex((row) => row.includes("\u23f6"));
    expect(head).toBeGreaterThan(0);
    expect(rows[head - 1]).toContain("\u252c");
  });

  it("gives each of three back edges an arrival of its own on the target", () => {
    const drawn = render(
      "graph LR\n    A[Push] --> B[Build]\n    B --> C{Pass?}\n    C -->|Yes| D[Stage]\n    C -->|No| F[Notify]\n" +
        "    D --> G{Approve?}\n    G -->|Yes| H[Prod]\n    G -->|No| F\n    H --> I{Healthy?}\n" +
        "    I -->|Yes| J[Done]\n    I -->|No| F\n",
      { width: 80 }
    );
    const rows = drawn.split("\n");
    expect(drawn.match(/\bNo\b/gu)).toHaveLength(3);
    const box = rows.findIndex((row) => row.includes("Notify"));
    const label = rows[box];
    const left = label.lastIndexOf("│", label.indexOf("Notify"));
    const right = label.indexOf("│", label.indexOf("Notify"));
    const heads: string[] = [];
    for (let r = box - 2; r <= box + 2; r++) {
      const row = [...(rows[r] ?? "")];
      if (row[left - 1] === "⏵") heads.push(`${r}:left`);
      if (row[right + 1] === "⏴") heads.push(`${r}:right`);
      if (r === box - 2) for (const [c, m] of row.entries()) if (m === "⏷" && c > left && c < right) heads.push(`${r}:top`);
      if (r === box + 2) for (const [c, m] of row.entries()) if (m === "⏶" && c > left && c < right) heads.push(`${r}:bottom`);
    }
    expect(new Set(heads).size).toBe(3);
    expect(heads).toHaveLength(3);
  });

  it("holds it on the side the router really comes back on, which is not always the lower one", () => {
    const drawn = tight(
      "graph LR\n    A[Push] --> B[Build]\n    B --> C{Pass?}\n    C -->|Yes| D[Stage]\n    C -->|No| F[Notify]\n" +
        "    D --> G{Approve?}\n    G -->|Yes| H[Prod]\n    G -->|No| F\n    H --> I{Healthy?}\n" +
        "    I -->|Yes| J[Done]\n    I -->|No| F\n"
    );
    for (const row of drawn.split("\n")) {
      expect(row).not.toMatch(/[\u23f6\u23f7][\u2500\u2501\u2504]|[\u2500\u2501\u2504][\u23f6\u23f7]/u);
    }
  });

  it("counts a turn as a floor of three and not as a row added over the heads", () => {
    const rows = tight("flowchart TD\n    A[entree] <--> B[etape]\n    A --> Z[cote]\n").split("\n");
    const border = rows.findIndex((row) => row.includes("\u2518"));
    const corner = rows.findIndex((row) => row.includes("\u2570"));
    const heads = rows.findIndex((row) => row.includes("\u23f7"));
    expect(corner - border).toBe(2);
    expect(heads - corner).toBe(1);
  });

  it("gives a straight run the two rows it needs and not a blank more", () => {
    const rows = render("flowchart TD\n    A[Push] --> B[Build]\n", { width: 40 }).split("\n");
    const border = rows.findIndex((row) => row.includes("┬"));
    const head = rows.findIndex((row) => row.includes("⏷"));
    expect(head - border).toBe(2);
  });

  it("keeps the row a label needs, and one row for the two that do not stack", () => {
    const straight = render("flowchart TD\n    A[un] -->|passe| B[deux]\n", { width: 40 }).split("\n");
    const border = straight.findIndex((row) => row.includes("┬"));
    expect(straight.findIndex((row) => row.includes("⏷")) - border).toBe(3);
    const forked = render("flowchart TD\n    A{Pass?} -->|Yes| B[oui]\n    A -->|No| C[non]\n", { width: 60 }).split("\n");
    const bande = forked.findIndex((row) => row.includes("⏷")) - forked.findIndex((row) => row.includes("└"));
    expect(bande).toBe(3);
    const nommees = forked.filter((row) => /\bYes\b|\bNo\b/u.test(row));
    expect(nommees).toHaveLength(1);
    expect(nommees[0]).toMatch(/Yes.*No/u);
  });

  it("spends nothing where the drawing already had the room", () => {
    const source = "flowchart LR\n    A[Alpha] --> B[Beta]\n";
    expect(render(source)).toBe(render(source, { gap: 4 }));
  });
});
