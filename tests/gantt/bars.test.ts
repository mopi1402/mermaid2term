import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { parseHex } from "../../src/colour/rgb.js";
import { must } from "../../src/must.js";
import { ESC } from "../../src/paint/escapes.js";

describe("a chip that keeps its OWN ground inside a filled box, where the fill had covered it over", () => {
  const source =
    "sequenceDiagram\n    box Purple Group\n    participant A\n    participant B\n    end\n" +
    "    A->>B: go\n    Note over A,B: a note\n";
  const FILLS: Record<string, string> = {
    Purple: "#800080",
    yellow: "#ffff00",
    silver: "#c0c0c0",
    grey: "#808080",
  };
  const firstGround = (fill: string): string => {
    const rgb = must(parseHex(FILLS[fill]));
    return `48;2;${rgb.r};${rgb.g};${rgb.b}`;
  };

  it("leaves the note the colour of its own chip under a box that named one", () => {
    const drawn = renderThemed(source, { width: 60 }, "neon");
    expect(drawn).toContain("48;2;128;0;128");
    expect(drawn).toContain("48;2;255;214;51");
  });

  it("still bands a gantt's own sections, whose cells are the very ground the band is for", () => {
    const gantt =
      "gantt\n    title T\n    section One\n    a :a1, 2024-01-01, 3d\n    section Two\n    b :b1, 2024-01-04, 2d\n";
    expect(renderThemed(gantt, { width: 70 }, "neon")).toContain("48;2;");
  });

  it("edges the slab with an ink of its own, standing on the slab as it does outside a box", () => {
    const SLAB = "48;2;255;214;51";
    const RULES = "\u250c\u2510\u2514\u2518\u2500";
    for (const fill of ["Purple", "yellow", "silver", "grey"]) {
      const rows = renderThemed(source.replace("Purple", fill), { width: 60 }, "classic").split("\n");
      const top = rows.findIndex((row) => row.includes(SLAB));
      const bottom = rows.length - 1 - [...rows].reverse().findIndex((row) => row.includes(SLAB));
      expect(top).toBeGreaterThan(0);
      const edges = new Set<string>();
      for (const row of [rows[top], rows[bottom]]) {
        for (const run of row.matchAll(new RegExp(ESC + "\\[([0-9;]*)m([^" + ESC + "])", "gu"))) {
          if (RULES.includes(run[2])) edges.add(run[1]);
        }
      }
      const amber = [...edges];
      expect(amber.length).toBeGreaterThan(0);
      for (const code of amber) {
        expect(code).toContain(SLAB);
        expect(code).not.toContain(firstGround(fill));
        const ink = must(/^38;2;(\d+);(\d+);(\d+)/u.exec(code) ?? undefined);
        const rgb = { r: Number(ink[1]), g: Number(ink[2]), b: Number(ink[3]) };
        expect(rgb.r).toBeGreaterThan(rgb.b);
        expect(rgb.g).toBeGreaterThan(rgb.b);
      }
    }
  });

});

describe("a gantt told `displayMode: compact` seats what it can on one row and names each bar in place", () => {
  const BODY = [
    "gantt",
    "    title A Gantt Diagram",
    "    dateFormat  YYYY-MM-DD",
    "",
    "    section Section",
    "    A task           :a1, 2014-01-01, 30d",
    "    Another task     :a2, 2014-01-20, 25d",
    "    Another one      :a3, 2014-02-10, 20d",
    "",
  ].join("\n");
  const COMPACT = `---\ndisplayMode: compact\n---\n${BODY}`;

  const barRows = (drawing: string): string[] =>
    drawing.split("\n").filter((line) => {
      const spine = line.indexOf("│");
      // A bar row carries a glyph of a bar or a task's name; the section's own row carries only the tick lines.
      return spine >= 0 && /[█▇◆\p{L}]/u.test(line.slice(spine + 1));
    });
  const chartOf = (line: string): string => line.slice(line.indexOf("│") + 1);

  it("leaves a diagram that does not ask for it EXACTLY as it was drawn", () => {
    expect(render(`---\ndisplayMode: default\n---\n${BODY}`, { width: 80 })).toBe(render(BODY, { width: 80 }));
    expect(barRows(render(BODY, { width: 80 }))).toHaveLength(3);
    expect(render(BODY, { width: 80 })).toContain("Another task │");
  });

  it("seats the tasks that do not overlap on ONE row, and the one that does on its own", () => {
    const rows = barRows(render(COMPACT, { width: 80 }));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain("A task");
    expect(rows[0]).toContain("Another one");
    expect(rows[1]).toContain("Another task");
  });

  it("gives the margin back to the chart: only the section is named there, never a task", () => {
    const compact = render(COMPACT, { width: 80 });
    for (const line of compact.split("\n")) {
      const margin = line.slice(0, line.indexOf("│"));
      if (line.includes("│")) expect(margin.trim() === "" || margin.trim() === "Section").toBe(true);
    }
  });

  it("writes a name that fits INSIDE its bar, on the bar's own ground", () => {
    const rows = barRows(render(COMPACT, { width: 80 }));
    expect(rows[0]).toMatch(/ {2,}A task {2,}/u);
    expect(rows[0]).not.toContain("─");
  });

  it("parts two bars that TOUCH by a half cell, so they never read as one long bar", () => {
    const chain = [
      "---",
      "displayMode: compact",
      "---",
      "gantt",
      "    dateFormat YYYY-MM-DD",
      "    section Backend",
      "        Schema  :done,   b1, 2026-02-02, 8d",
      "        API     :done,   b2, after b1, 10d",
      "",
    ].join("\n");
    const row = chartOf(barRows(render(chain, { width: 80 }))[0]);
    expect(row).toMatch(/^ + Schema +▌ + API /u);
    expect(row).not.toContain("││");
    expect(row).not.toMatch(/[█▇]/u);
  });

  it("never writes over a MILESTONE, and sends a name with no room beside it under the dates, whole", () => {
    const source = [
      "---",
      "displayMode: compact",
      "---",
      "gantt",
      "    dateFormat YYYY-MM-DD",
      "    section S",
      "    Build                :b1, 2026-01-05, 20d",
      "    Functionality added  :milestone, m1, 2026-01-27, 0d",
      "",
    ].join("\n");
    const drawn = render(source, { width: 80 });
    const rows = drawn.split("\n");
    const row = must(rows.find((line) => line.includes("◆")));
    expect(row).not.toContain("Func");
    expect(row).not.toMatch(/[.]◆|◆[.]/u);
    expect(rows[rows.length - 1]).toContain("Functionality added");
    const col = [...row].indexOf("◆");
    expect("┼┤├").toContain([...must(rows.find((line) => line.includes("└")))][col]);
  });

  it("lets two bars TOUCH, so a chain of `after` comes out on one row and not on every other one", () => {
    const chain = [
      "---",
      "displayMode: compact",
      "---",
      "gantt",
      "    dateFormat YYYY-MM-DD",
      "    section Backend",
      "        Schema  :done,   b1, 2026-02-02, 8d",
      "        API     :done,   b2, after b1, 10d",
      "        Workers :active, b3, after b2, 9d",
      "        Cache   :        b4, after b3, 7d",
      "",
    ].join("\n");
    const rows = barRows(render(chain, { width: 80 }));
    expect(rows).toHaveLength(1);
    for (const name of ["Schema", "API", "Workers", "Cache"]) expect(rows[0]).toContain(name);
  });

  it("still never lets two bars OVERLAP, which is what a seat is for", () => {
    const rows = barRows(render(COMPACT, { width: 80 }));
    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain("Another task");
  });

  it("still cuts a name it cannot fit, rather than dropping the task or overrunning its neighbour", () => {
    const narrow = render(COMPACT, { width: 40 });
    expect(narrow.split("\n").some((line) => line.includes("…"))).toBe(true);
    expect(Math.max(...narrow.split("\n").map((line) => line.length))).toBeLessThanOrEqual(40);
  });
});

describe("a gantt task says its STATE in COLOUR, which is where mermaid says it", () => {
  const STATES = [
    "gantt",
    "    dateFormat YYYY-MM-DD",
    "    section S",
    "        Done     :done, a, 2026-01-01, 10d",
    "        Active   :active, b, after a, 10d",
    "        Plain    :c, after b, 10d",
    "        Crit     :crit, d, after c, 10d",
    "        DoneCrit :done, crit, e, after d, 10d",
    "",
  ].join("\n");
  const COMPACT_STATES = `---\ndisplayMode: compact\n---\n${STATES}`;
  const ink = (row: string, glyph: string): string => {
    const at = row.indexOf(glyph);
    return row.slice(row.lastIndexOf("\u001b[", at), at);
  };
  const WIDE = 110;
  const rowNamed = (source: string, theme: string, word: string): string =>
    renderThemed(source, { width: WIDE }, theme).split("\n")[
      render(source, { width: WIDE }).split("\n").findIndex((line) => line.includes(word))
    ];

  it("gives the four states four different inks, on one solid glyph", () => {
    const inks = ["Done", "Active", "Plain", "Crit"].map((name) => ink(rowNamed(STATES, "classic", name), "█"));
    expect(new Set(inks).size).toBe(4);
    expect(inks[0]).toContain("128;128;128");
  });

  it("says the state by its ink alone, as mermaid does: no texture, every bar one solid glyph", () => {
    const drawn = render(STATES, { width: 110 });
    expect(drawn).not.toMatch(/[░▒▓]/u);
    expect(drawn).toContain("█");
  });

  it("lightens the theme's own primary for a task in flight, rather than picking a colour of its own", () => {
    for (const theme of ["neon", "phosphor", "nord"]) {
      const active = ink(rowNamed(STATES, theme, "Active"), "█");
      const plain = ink(rowNamed(STATES, theme, "Plain"), "█");
      expect(active).not.toBe(plain);
      expect(active).toContain("1;38;2;");
    }
  });

  it("composes `crit` with the state as a cell bar does: no stroke to wear it, so the whole bar wears `critBorderColor`", () => {
    const cells = rowNamed(COMPACT_STATES, "classic", "DoneCrit").split("\u001b[0m");
    expect(cells.find((cell) => cell.includes("DoneCrit"))).toContain("48;2;229;72;77");
    expect(cells.find((cell) => cell.includes("Done ") && !cell.includes("Crit"))).toContain("48;2;128;128;128");
  });
});
