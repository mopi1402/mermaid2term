import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { displayWidth } from "../../src/text/width.js";
import { THREE_PANES } from "../support/drawn.js";

// Weekly ticks, the last one standing short of the chart's right edge.
const SOURCE =
  "gantt\n    dateFormat YYYY-MM-DD\n    axisFormat %m-%d\n    tickInterval 1week\n    weekday monday\n" +
  "    section Build\n        Groundwork :done, gw, 2024-01-01, 9d\n        Feature work :active, fw, after gw, 12d\n" +
  "    section Ship\n        Hardening :hd, after fw, 5d\n        Release :milestone, rel, after hd, 0d\n";

const plain = (row: string): string => row.replace(/\x1b\[[0-9;]*m/gu, "");

describe("a gantt section's band runs the full chart width, past the last tick", () => {
  it.each(THREE_PANES)("ends every section row where the separator ends, width %i", (width) => {
    const rows = renderThemed(SOURCE, { width, background: "dark" }, "default").split("\n").map(plain);
    const separator = rows.find((row) => row.includes("╌"));
    expect(separator).toBeDefined();
    const edge = displayWidth(separator ?? "");
    const axis = rows.findIndex((row) => row.includes("└"));
    const sectionRows = rows.slice(0, axis).filter((row) => row.includes("│") && !row.includes("╌"));
    expect(sectionRows.length).toBe(6);
    for (const row of sectionRows) expect(displayWidth(row), rows.join("\n")).toBe(edge);
  });
});
