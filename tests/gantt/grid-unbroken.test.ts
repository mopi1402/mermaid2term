import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { THREE_PANES } from "../support/drawn.js";

const SOURCE =
  "gantt\n  dateFormat YYYY-MM-DD\n  section Build\n    Design :a1, 2024-01-01, 5d\n    Code :a2, after a1, 10d\n" +
  "    Ship :milestone, m1, after a2, 0d\n  section Test\n    QA :t1, after a1, 7d\n";

const GAPS = new Set([" ", "╎", "╌"]);

describe("a gantt tick line runs unbroken, stopped only by what stands for a task", () => {
  it.each(THREE_PANES)("crosses the rule between sections and never leaves a hole, width %i", (width) => {
    for (const borders of ["default", "padless", "borderless"] as const) {
      const rows = render(SOURCE, { width, borders }).split("\n").map((row) => [...row]);
      const axis = rows.findIndex((row) => row.includes("└"));
      const ticks = rows[axis].flatMap((ch, c) => (ch === "┬" && c > rows[axis].indexOf("└") + 1 ? [c] : []));
      expect(ticks.length).toBeGreaterThan(0);
      for (const c of ticks) {
        for (let r = 0; r < axis; r++) expect(GAPS.has(rows[r][c] ?? " "), `${r}:${c}\n${rows.map((row) => row.join("")).join("\n")}`).toBe(false);
      }
    }
  });

  it.each(THREE_PANES)("draws a `vert` marker heavy, apart from the tick lines without a colour, width %i", (width) => {
    const rows = render(`${SOURCE}    Review :vert, rv, 2024-01-09, 0d\n`, { width }).split("\n").map((row) => [...row]);
    const foot = rows.findIndex((row) => row.includes("┴"));
    const col = rows[foot].indexOf("┴");
    const line = rows.slice(0, foot).map((row) => row[col]).filter((ch) => ch !== " " && ch !== undefined);
    expect(line.length).toBeGreaterThan(0);
    for (const ch of line) expect("┃█▇◆").toContain(ch);
  });

  it("lays mermaid's grid colour at `.grid .tick`'s 0.8 opacity over the page", () => {
    const painted = renderThemed(SOURCE, { width: 80, background: "dark" }, "default");
    expect(painted).toContain("\u001b[38;2;169;169;169m│");
  });
});
