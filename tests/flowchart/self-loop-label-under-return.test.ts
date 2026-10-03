import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const HEADS = new Set(["⏴", "⏵", "⏶", "⏷"]);

// A lone loop's label once stood in the gap between its turn and a sibling box, where a run coming down passed it:
// it stands under the loop's return, against its box, where nothing else is near.
describe("a lone loop's label stands under its return", () => {
  const cases = ["TB", "BT", "LR", "RL"].flatMap((direction) => (["default", "padless"] as const).map((borders) => [direction, borders] as const));

  it.each(cases)("direction %s, borders %s", (direction, borders) => {
    const drawn = render(`flowchart ${direction}\n  C --> A\n  C --> B\n  A -- again --> A\n`, { width: 80, borders });
    const rows = drawn.split("\n");
    const row = rows.findIndex((line) => line.includes("again"));
    expect(row, drawn).toBeGreaterThanOrEqual(0);
    const start = [...rows[row]].join("").indexOf("again");
    const end = start + "again".length - 1;
    const beside = [rows[row - 1], rows[row + 1]].some((line) =>
      [...(line ?? "")].some((glyph, x) => HEADS.has(glyph) && Math.min(Math.abs(x - start), Math.abs(x - end)) <= 2)
    );
    expect(beside, drawn).toBe(true);
  });
});
