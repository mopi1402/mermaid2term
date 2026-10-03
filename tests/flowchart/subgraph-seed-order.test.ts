import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

// Where a label's first letter stands: its row, and its column in that row.
const seat = (drawing: string, label: string): readonly [number, number] => {
  const rows = drawing.split("\n");
  const row = rows.findIndex((line) => line.includes(label));
  return [row, [...rows[row]].join("").indexOf(label)];
};

// Across the flow: the column in TD, the row in LR.
const across = (drawing: string, label: string, direction: string): number => seat(drawing, label)[direction === "LR" ? 0 : 1];

// mermaid hands dagre every subgraph before any vertex, the last one closed first, and a subgraph no link leaves is
// laid out as one node where it was handed over (read off mermaid 12 itself, rendered headless).
describe("the order a rank starts from, as mermaid hands its nodes over", () => {
  for (const direction of ["TD", "LR"]) {
    it(`puts a subgraph no link leaves before the vertices beside it, ${direction}`, () => {
      const drawn = render(`flowchart ${direction}\n  subgraph outer\n    A --> B\n    subgraph inner\n      C --> D\n    end\n  end`, { width: 120 });
      expect(across(drawn, " C ", direction)).toBeLessThan(across(drawn, " A ", direction));
    });

    it(`puts the last of two lone sibling subgraphs first, ${direction}`, () => {
      const drawn = render(`flowchart ${direction}\n  subgraph S1\n    a1\n  end\n  subgraph S2\n    a2\n  end`, { width: 120 });
      expect(across(drawn, "a2", direction)).toBeLessThan(across(drawn, "a1", direction));
    });

    it(`leaves a subgraph a link leaves in its vertices' own order, ${direction}`, () => {
      const drawn = render(`flowchart ${direction}\n  X --> a1\n  Y\n  subgraph S1\n    a1\n  end`, { width: 120 });
      expect(across(drawn, " X ", direction)).toBeLessThan(across(drawn, " Y ", direction));
    });
  }
});
