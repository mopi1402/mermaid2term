import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { THREE_PANES, TWO_PANES } from "../support/drawn.js";
import { withConfig } from "../support/frontmatter.js";

const HEAD = "gantt\n    dateFormat YYYY-MM-DD\n    todayMarker off\n";
const rowsOf = (source: string, width: number): string[] => render(source, { width }).split("\n");
const rowNamed = (rows: readonly string[], name: string): string => rows.find((row) => row.includes(name)) ?? "";
const axisOf = (rows: readonly string[]): string => rows.find((row) => row.includes("└")) ?? "";

describe("a `vert` line over a bar one cell wide leaves the bar seen, as mermaid's line over its rect does", () => {
  const source = HEAD + "    Long :a, 2026-08-01, 30d\n    Short :b, 2026-08-15, 1d\n    Due :vert, v, 2026-08-15, 0d\n";

  it.each(THREE_PANES)("keeps a bar cell on the Short row at width %i", (width) => {
    const rows = rowsOf(source, width);
    expect(rowNamed(rows, "Short")).toMatch(/[█▇]/u);
    expect(rowNamed(rows, "Long")).toContain("│█");
  });

  it("keeps a one-cell milestone under a `vert` at its date", () => {
    const rows = rowsOf(HEAD + "    Long :a, 2026-08-01, 30d\n    Gate :milestone, m, 2026-08-15, 0d\n    Due :vert, v, 2026-08-15, 0d\n", 40);
    expect(rowNamed(rows, "Gate")).toContain("◆");
  });
});

describe("ticks, bars and markers share one column map", () => {
  const source =
    HEAD +
    "    section Planning\n    Requirements :a1, 2024-01-01, 10d\n    Kickoff :milestone, m1, 2024-01-11, 0d\n" +
    "    section Release\n    QA :a3, after m1, 44d\n    Launch :milestone, m3, after a3, 0d\n";

  it.each(THREE_PANES)("stands the last milestone on the axis's last tick at width %i", (width) => {
    const rows = rowsOf(source, width);
    const axis = axisOf(rows);
    const last = axis.lastIndexOf("┬");
    expect(last).toBe(axis.trimEnd().length - 1);
    expect(rowNamed(rows, "Launch").indexOf("◆")).toBe(last);
  });

  it("puts a tick exactly on a bar's first column when a tick date is that bar's start", () => {
    const rows = rowsOf(HEAD + "    A :a1, 2024-01-01, 2d\n    B :b1, 2024-01-03, 2d\n", 60);
    const axis = axisOf(rows);
    const ticks = [...axis].flatMap((ch, at) => (ch === "┬" ? [at] : []));
    expect(ticks).toContain(rowNamed(rows, "B").indexOf("█"));
  });
});

describe("`topAxis` adds the date axis over the chart, the one under it kept", () => {
  const source = "gantt\n    title Plan\n    dateFormat YYYY-MM-DD\n    todayMarker off\n    topAxis\n    A :a1, 2024-01-01, 3d\n    B :b1, after a1, 2d\n";

  it.each(TWO_PANES)("draws both rules and both date rows at width %i", (width) => {
    const rows = rowsOf(source, width);
    const top = rows.findIndex((row) => row.includes("┌"));
    expect(top).toBeGreaterThan(0);
    expect(rows[top - 1]).toContain("2024-01-01");
    expect(rows[top]).toContain("┴");
    expect(rows[top + 1]).toContain("A");
    expect(axisOf(rows)).toContain("┬");
    expect(rows.filter((row) => row.includes("2024-01-01"))).toHaveLength(2);
  });

  it("reads `config.gantt.topAxis` from the frontmatter", () => {
    const framed = withConfig({ gantt: { topAxis: true } }, "gantt\n    dateFormat YYYY-MM-DD\n    A :a1, 2024-01-01, 3d\n");
    expect(rowsOf(framed, 60).some((row) => row.includes("┌"))).toBe(true);
  });

  it("draws no top rule without it", () => {
    expect(rowsOf(source.replace("    topAxis\n", ""), 60).some((row) => row.includes("┌"))).toBe(false);
  });
});

describe("`<br>` in a section name breaks it over rows, as mermaid's `vertLabels` splits it", () => {
  it.each(TWO_PANES)("writes each line on a row of its own at width %i", (width) => {
    const rows = rowsOf(HEAD + "    section Two<br>lines\n    A :a1, 2024-01-01, 3d\n    section One\n    B :b1, after a1, 2d\n", width);
    const at = rows.findIndex((row) => row.startsWith(" Two"));
    expect(rows[at + 1]?.startsWith(" lines")).toBe(true);
    expect(rows[at + 2]).toContain("A");
    expect(rows.join("\n")).not.toContain("<br>");
  });
});
