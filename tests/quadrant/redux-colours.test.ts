import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

// mermaid 12 strokes a quadrant chart's frame and axes on `primaryBorderColor`, which redux-color's file resolves to
// `mkBorder("#28253D")`, #171717 as khroma's `toHex` rounds it, as redux does.
const BODY = "quadrantChart\n  title Reach\n  x-axis Low --> High\n  y-axis Low --> High\n  quadrant-1 Expand\n  quadrant-2 Promote\n  quadrant-3 Wait\n  quadrant-4 Improve\n  Campaign A: [0.3, 0.6]";

const byOwner = (theme: string, side: "light" | "dark", width: number): ReadonlyMap<string, string> => {
  const found = new Map<string, string>();
  for (const cell of renderThemedText(BODY, { width, background: side }, theme).rows.flat()) {
    if (cell.owner !== undefined && cell.ch.trim() !== "") found.set(cell.owner, cell.style.toLowerCase());
  }
  return found;
};

describe.each(TWO_PANES)("a quadrant chart under the redux themes, at width %i", (width) => {
  it.each(["redux", "redux-color"])("strokes %s's frame and axes #171717", (theme) => {
    const styles = byOwner(theme, "light", width);
    expect(styles.get("quadrant_border")).toBe("#171717");
    expect(styles.get("quadrant_axis")).toBe("#171717");
    expect(styles.get("quadrant_text_1")).toBe("#28253d on #ececfe");
    expect(styles.get("quadrant_point_2")).toContain("#28253d");
  });

  it.each(["redux-dark", "redux-dark-color"])("strokes %s's frame and axes #CCCCCC", (theme) => {
    const styles = byOwner(theme, "dark", width);
    expect(styles.get("quadrant_border")).toBe("#cccccc");
    expect(styles.get("quadrant_axis")).toBe("#cccccc");
    expect(styles.get("quadrant_text_1")).toBe("#e0dfdf on #1f2020");
    expect(styles.get("quadrant_point_2")).toContain("#cccccc");
  });
});
