import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const WALL = "▏";
const RUN = "│";

const source = (direction: string): string =>
  `flowchart ${direction}\n  subgraph S1\n    a1\n  end\n  subgraph S2\n    a2\n  end\n  a1 --> a2\n  S2 --- S1`;

// A padless frame stands three cells off its content, and the run back around both frames took its right wall over.
describe("a run between two frames, back around them", () => {
  for (const direction of ["TB", "BT"]) {
    for (const width of [40, 80, 120]) {
      it(`keeps both right walls whole and runs a cell off them, padless ${direction} at ${width}`, () => {
        const rows = render(source(direction), { width, borders: "padless" }).split("\n").map((row) => [...row]);
        const wall = rows[0].lastIndexOf(WALL);
        const framed = rows.filter((row) => row[0] === "▕");
        expect(framed.every((row) => row[wall] === WALL)).toBe(true);
        expect(rows.filter((row) => row[wall + 2] === RUN).length).toBeGreaterThan(framed.length / 2);
      });
    }
  }
});
