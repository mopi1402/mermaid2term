import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const LABEL = "no creating message";
const SOURCES: Record<string, string> = {
  "the first participant": `sequenceDiagram\n  box Grp\n  participant A\n  participant B\n  end\n  A->>A: ${LABEL}\n  A->>B: hi`,
  "the last participant": `sequenceDiagram\n  box Grp\n  participant A\n  participant B\n  end\n  B->>B: ${LABEL}\n  A->>B: hi`,
  "a box that is not first": `sequenceDiagram\n  participant Z\n  box Grp\n  participant A\n  participant B\n  end\n  A->>A: ${LABEL}\n  A->>B: hi`,
};

describe("a self message inside a box", () => {
  for (const [name, source] of Object.entries(SOURCES)) {
    for (const width of [60, 80]) {
      it(`keeps the box walls and the whole label, on ${name}, at ${width}`, () => {
        const rows = render(source, { width }).split("\n").map((row) => [...row]);
        const top = rows.findIndex((row) => row.includes("╔"));
        const bottom = rows.findIndex((row) => row.includes("╚"));
        const left = rows[top].indexOf("╔");
        const right = rows[top].indexOf("╗");
        expect(top).toBeGreaterThanOrEqual(0);
        expect(bottom).toBeGreaterThan(top);
        for (let at = top + 1; at < bottom; at++) {
          expect(rows[at][left], `row ${at}`).toBe("║");
          expect(rows[at][right], `row ${at}`).toBe("║");
        }
        const labelled = rows.find((row) => row.join("").includes(LABEL));
        expect(labelled).toBeDefined();
        const start = (labelled ?? []).join("").indexOf(LABEL);
        expect(start).toBeGreaterThan(left);
        expect(start + LABEL.length).toBeLessThan(right);
      });
    }
  }
});
