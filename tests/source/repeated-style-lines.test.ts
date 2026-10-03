import { describe, expect, it } from "vitest";
import { renderThemed } from "../../src/index.js";
import { paintedRowWith } from "../support/ansi.js";

// mermaid 12's flowDb merges a second `style` line on one node into the first; stateDb sets the state's styles
// outright, so there the last line alone is drawn (measured headless on 2026-09-29).
const GREEN = "38;2;0;255;0";
const BLUE_GROUND = "48;2;0;0;255";

describe.each(["TD", "LR"])("repeated `style` lines on one node (%s)", (direction) => {
  it("keeps both on a flowchart node: the fill of the first and the stroke of the second", () => {
    const drawn = renderThemed(`flowchart ${direction}\n  A --> C\n  style C fill:#00f\n  style C stroke:#0f0`, { width: 80 }, "default");
    const row = paintedRowWith(drawn, "C");
    expect(row).toContain(`${GREEN}m│`);
    expect(row).toContain(BLUE_GROUND);
  });

  it("keeps the last one alone on a state", () => {
    const drawn = renderThemed(`stateDiagram-v2\n  direction ${direction}\n  A --> C\n  style C fill:#00f\n  style C stroke:#0f0`, { width: 80 }, "default");
    const row = paintedRowWith(drawn, "C");
    expect(row).toContain(`${GREEN}m│`);
    expect(row).not.toContain(BLUE_GROUND);
  });
});
