import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { THREE_PANES } from "../support/drawn.js";

const SOURCE =
  "---\ndisplayMode: compact\n---\ngantt\n    dateFormat YYYY-MM-DD\n    section Backend\n" +
  "        Schema  :done,   b1, 2026-02-02, 8d\n        API     :crit,   b2, after b1, 10d\n" +
  "        Workers :active, b3, after b2, 9d\n        Cache   :        b4, after b3, 7d\n";

const NAMES = ["Schema", "API", "Workers", "Cache"];

describe("a compact gantt bar is its own ground between its two ends, the name written on it", () => {
  it.each(THREE_PANES)("draws no run across the bar, width %i", (width) => {
    for (const borders of ["default", "padless", "borderless"] as const) {
      const drawn = render(SOURCE, { width, borders });
      const row = drawn.split("\n").find((line) => line.includes("API"));
      expect(row, drawn).toBeDefined();
      expect(row, drawn).not.toContain("─");
    }
  });

  it.each(THREE_PANES)("parts two bars that touch by a half cell and draws no wall, width %i", (width) => {
    for (const borders of ["default", "padless", "borderless"] as const) {
      const drawn = render(SOURCE, { width, borders });
      const row = drawn.split("\n").find((line) => line.includes("API")) ?? "";
      const chart = row.slice(row.indexOf("│") + 1);
      expect(chart.match(/▌/gu) ?? [], drawn).toHaveLength(3);
      expect(chart, drawn).not.toContain("││");
    }
  });

  it("inks the half cell in its bar's fill, the page showing in its other half", () => {
    const row = renderThemed(SOURCE, { width: 120, background: "dark" }, "default").split("\n").find((line) => line.includes("API")) ?? "";
    const cells = row.split("\u001b[0m");
    const api = cells.findIndex((cell) => cell.includes("API"));
    const fill = /48;2;(\d+;\d+;\d+)m/u.exec(cells[api])?.[1];
    expect(cells[api + 1]).toContain(`38;2;${fill};`);
    expect(cells[api + 1]).toContain("▌");
  });

  it.each(["default", "neon"])("lays the bar's ground under each name, theme %s", (theme) => {
    const row = renderThemed(SOURCE, { width: 120, background: "dark" }, theme)
      .split("\n")
      .find((line) => line.includes("Schema"));
    const cells = (row ?? "").split("\u001b[0m");
    for (const name of NAMES) expect(cells.find((cell) => cell.includes(name))).toMatch(/48;2;\d+;\d+;\d+m +\S/u);
  });
});
