import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";

const dashed = (direction: string): string =>
  `stateDiagram-v2\n    direction ${direction}\n    classDef dash stroke-dasharray: 4\n    state Outer {\n        A --> B\n    }\n    class Outer dash\n`;

describe("a dashed composite state keeps its doubled floor solid, where mermaid dashes both bottom lines", () => {
  for (const direction of ["TB", "LR"]) {
    for (const borders of ["default", "padless"] as const) {
      it(`${direction}, ${borders}: dashed walls over a solid double floor`, () => {
        const rows = render(dashed(direction), { width: 80, borders }).split("\n").filter((row) => row.trim() !== "");
        const floor = rows[rows.length - 1].trim();
        expect(floor).toMatch(/^╘═+╛$/);
        expect(rows.some((row) => row.trim().startsWith("╎"))).toBe(true);
      });
    }
  }
});
