import { describe, it, expect } from "vitest";
import { renderThemedText } from "../../src/index.js";

const TD = 'graph TD\n    A["Start"] --> B{"Decision"}\n    B -->|"Yes"| C["Process"]\n    B -->|"No"| D["End"]\n    C --> D\n';
const LR = 'graph LR\n    A["Start"] --> B{"Decision"}\n    B -->|"Yes"| C["Process"]\n    B -->|"No"| D["End"]\n    C --> D\n';

const decisionBox = (source: string, width: number): string => {
  const lines = renderThemedText(source, { width, borders: "padless" }, "default").plain.split("\n");
  const row = lines.find((line) => line.includes("Decision"));
  const box = row?.match(/[▏▕][^▏▕]*Decision[^▏▕]*[▏▕]/u)?.[0];
  if (box === undefined) throw new Error(`no Decision box at ${width}: ${row ?? "(no row)"}`);
  return box;
};

describe("a rhombus says itself beside its name, the marks seated by the wall on that side (`padless`)", () => {
  it("down the page: hugging walls keep a blank off the marks, then the marks close on the name, never on the wall", () => {
    expect(decisionBox(TD, 80)).toBe("▕ ◆ Decision ◆ ▏");
    expect(decisionBox(TD, 38)).toBe("▕ ◆ Decision ◆ ▏");
    expect(decisionBox(TD, 29)).toBe("▕ ◆ Decision ◆ ▏");
    expect(decisionBox(TD, 28)).toBe("▕ ◆Decision◆ ▏");
    expect(decisionBox(TD, 26)).toBe("▕ ◆Decision◆ ▏");
  });

  it("across the page: far walls take the marks against themselves before the marks close on the name", () => {
    expect(decisionBox(LR, 200)).toBe("▏ ◆ Decision ◆ ▕");
    expect(decisionBox(LR, 47)).toBe("▏ ◆ Decision ◆ ▕");
    expect(decisionBox(LR, 46)).toBe("▏◆ Decision ◆▕");
    expect(decisionBox(LR, 44)).toBe("▏◆ Decision ◆▕");
    expect(decisionBox(LR, 41)).toBe("▏◆ Decision ◆▕");
    expect(decisionBox(LR, 40)).toBe("▏◆Decision◆▕");
    expect(decisionBox(LR, 36)).toBe("▏◆Decision◆▕");
  });

  it("stays symmetric at every rung of the ladder, on both axes", () => {
    for (const [source, widths] of [
      [TD, [80, 60, 44, 38, 36, 32, 30, 26]],
      [LR, [200, 60, 50, 44, 40, 36, 32]],
    ] as const) {
      for (const width of widths) {
        const inside = decisionBox(source, width).slice(1, -1);
        const leftBlanks = inside.length - inside.trimStart().length;
        const rightBlanks = inside.length - inside.trimEnd().length;
        expect(leftBlanks, `at ${width}: ${inside}`).toBe(rightBlanks);
      }
    }
  });
});
