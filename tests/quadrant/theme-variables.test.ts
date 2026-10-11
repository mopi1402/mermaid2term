import { describe, expect, it } from "vitest";
import { renderThemedText } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";

// mermaid 12 paints a quadrant chart from its own variables (checked headless on 2026-09-28): four fills off
// `primaryColor` stepped 5 per channel, their names off `primaryTextColor` stepped back, a point on the SVG's
// `textColor` until `quadrantPointFill` is written, the frame and the axes on `primaryBorderColor`.
const BODY = "quadrantChart\n  title Reach\n  x-axis Low --> High\n  y-axis Low --> High\n  quadrant-1 Expand\n  quadrant-2 Promote\n  quadrant-3 Wait\n  quadrant-4 Improve\n  Campaign A: [0.3, 0.6]";
const WRITTEN = `---
config:
  themeVariables:
    quadrant1Fill: "#00ff00"
    quadrant1TextFill: "#0000ff"
    quadrantPointFill: "#ff0000"
    quadrantPointTextFill: "#884400"
    quadrantTitleFill: "#aa00aa"
    quadrantXAxisTextFill: "#008888"
    quadrantInternalBorderStrokeFill: "#aaaa00"
    quadrantExternalBorderStrokeFill: "#ff8800"
---
`;

const byOwner = (source: string, width: number): ReadonlyMap<string, string> => {
  const found = new Map<string, string>();
  for (const cell of renderThemedText(source, { width, background: "light" }, "default").rows.flat()) {
    if (cell.owner !== undefined && cell.ch.trim() !== "") found.set(cell.owner, cell.style.toLowerCase());
  }
  return found;
};

describe.each(TWO_PANES)("a quadrant chart's own variables, at width %i", (width) => {
  it("derives every ink as mermaid's default theme does", () => {
    const styles = byOwner(BODY, width);
    expect(styles.get("quadrant_text_1")).toBe("#131300 on #ececff");
    expect(styles.get("quadrant_text_2")).toBe("#0e0e00 on #f1f1ff");
    expect(styles.get("quadrant_text_3")).toBe("#090900 on #f6f6ff");
    expect(styles.get("quadrant_text_4")).toBe("#040400 on #fbfbff");
    expect(styles.get("quadrant_point_2")).toBe("#333333 on #f1f1ff");
    expect(styles.get("quadrant_border")).toBe("#c7c7f1");
    expect(styles.get("quadrant_axis")).toBe("#c7c7f1");
  });

  it("takes each one written", () => {
    const styles = byOwner(WRITTEN + BODY, width);
    expect(styles.get("quadrant_text_1")).toBe("#0000ff on #00ff00");
    expect(styles.get("quadrant_point_2")).toContain("#ff0000");
    expect(styles.get("quadrant_point_text_2")).toContain("#884400");
    expect(styles.get("quadrant_title")).toContain("#aa00aa");
    expect(styles.get("quadrant_x_label")).toContain("#008888");
    expect(styles.get("quadrant_axis")).toBe("#aaaa00");
    expect(styles.get("quadrant_border")).toBe("#ff8800");
  });
});
