import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const QUADRANT = 'quadrantChart\n  x-axis "😀 low" --> "high"\n  y-axis "😀 down" --> "up"\n  A: [0.3, 0.6]\n';
const flowchart = (direction: string): string => `flowchart ${direction}\n  A -->|"😀 hi"| B\n`;

describe("an astral character inside quotes keeps the mask on the source's code units", () => {
  it("reads each quadrant axis on its arrow, the quotes off both ends", () => {
    const drawing = render(QUADRANT, { width: 60 });
    expect(drawing).toContain("😀 low -> high");
    expect(drawing).toContain("😀 down -> up");
    expect(drawing).not.toContain('"');
  });

  it.each(["TD", "LR"])("flowchart %s: the edge label is the quoted text, the quotes off", (direction) => {
    const drawing = render(flowchart(direction), { width: 60 });
    expect(drawing).toContain("😀 hi");
    expect(drawing).not.toContain('"');
    expect(drawing).not.toContain("|");
  });
});
