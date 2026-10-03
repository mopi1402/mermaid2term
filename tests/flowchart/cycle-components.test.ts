import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";

const seatOf = (drawing: string, label: string): [number, number] => {
  const lines = drawing.split("\n");
  const at = lines.findIndex((line) => line.includes(label));
  expect(at, `nothing drawn for ${label}`).toBeGreaterThanOrEqual(0);
  return [at, lines[at].indexOf(label)];
};

const apart = (drawing: string): [number, number] => {
  const [aLine, aCol] = seatOf(drawing, "A");
  const [bLine, bCol] = seatOf(drawing, "B");
  return [Math.sign(bLine - aLine), Math.sign(bCol - aCol)];
};

describe("a cycle-only component is layered even where another component has a root", () => {
  for (const header of ["flowchart TD", "flowchart LR"]) {
    const alone = `${header}\n  A-->B\n  B-->A\n`;

    it(`${header}: the two nodes never share one seat`, () => {
      expect(apart(render(alone, { width: 80 }))).not.toEqual([0, 0]);
    });

    it(`${header}: a plain component beside the cycle does not move it`, () => {
      expect(apart(render(`${alone}  C-->D\n`, { width: 80 }))).toEqual(apart(render(alone, { width: 80 })));
    });

    it(`${header}: a SELF-edge beside the cycle does not move it either`, () => {
      expect(apart(render(`${alone}  C-->C\n`, { width: 80 }))).toEqual(apart(render(alone, { width: 80 })));
    });
  }
});
