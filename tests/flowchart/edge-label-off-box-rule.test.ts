import { describe, expect, it } from "vitest";

import { BORDER_MODES, render } from "../../src/index.js";

// The rules and corners of a box in every border mode; a label flush against one reads as part of the box.
const BOX_INK = new Set([..."┌┐└┘▔▁▏▕▗▖▝▘▄▀▐▌"]);

const TWO_LANES = "flowchart LR\n  A[Start] -->|high| B[Fast]\n  A -->|low| C[Slow]";
const DECISION = "flowchart LR\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Process]\n  B -->|No| D[End]\n  C --> D";

function touchesBox(drawing: string, label: string): string | undefined {
  for (const row of drawing.split("\n")) {
    const cells = [...row];
    const text = cells.join("");
    const at = text.indexOf(label);
    if (at < 0) continue;
    const start = [...text.slice(0, at)].length;
    const before = cells[start - 1] ?? " ";
    const after = cells[start + [...label].length] ?? " ";
    if (BOX_INK.has(before) || BOX_INK.has(after)) return row;
  }
  return undefined;
}

describe("a label beside a turning shaft keeps off a box's rule", () => {
  const cases: ReadonlyArray<readonly [string, string, readonly string[]]> = [
    ["two lanes out of Start", TWO_LANES, ["low", "high"]],
    ["two lanes out of Start, right to left", TWO_LANES.replace("LR", "RL"), ["low", "high"]],
    ["a decision's two lanes", DECISION, ["No", "Yes"]],
    ["a decision's two lanes, right to left", DECISION.replace("LR", "RL"), ["No", "Yes"]],
    ["two lanes out of Start, down the page", TWO_LANES.replace("LR", "TD"), ["low", "high"]],
    ["a decision's two lanes, down the page", DECISION.replace("LR", "TD"), ["No", "Yes"]],
  ];
  for (const [name, source, labels] of cases) {
    for (const borders of BORDER_MODES) {
      for (const width of [40, 80, 120]) {
        it(`${name}, ${borders} at ${width}`, () => {
          const drawing = render(source, { width, borders });
          for (const label of labels) {
            expect(drawing).toContain(label);
            expect(touchesBox(drawing, label)).toBeUndefined();
          }
        });
      }
    }
  }
});
