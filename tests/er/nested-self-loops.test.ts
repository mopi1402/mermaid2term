import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const DIRECTIONS = ["TB", "BT", "LR", "RL"] as const;
const BORDERS = ["default", "padless"] as const;
const ATTRIBUTES = "A {\n    int id PK\n    string name\n  }";

const loops = (count: number): string[] => Array.from({ length: count }, (_, k) => `rel${k + 1}`);
const source = (direction: string, labels: string[], attributes: boolean): string =>
  [`erDiagram`, `direction ${direction}`, ...labels.map((label) => `A ||--o{ A : ${label}`), `A ||--|| B : has`, ...(attributes ? [ATTRIBUTES] : [])].join("\n  ") + "\n";

// Each loop's crow's foot back on the face it returns through, below the box or above it.
const heads = (drawn: string): number => (drawn.match(/╰●╯|╭●╮/gu) ?? []).length;
// The single bars: one per loop on the flank it leaves, two more for `has` when it runs across the page.
const bars = (drawn: string): number => (drawn.match(/╫/gu) ?? []).length;

// Several self relations on one entity nest round it, as mermaid draws one loop per relation: each keeps its own run,
// its marks at both ends and its whole label, none crossing or merging with another nor with `has`.
describe.each([2, 5])("%i self relations on one entity", (count) => {
  it.each(DIRECTIONS.flatMap((direction) => BORDERS.flatMap((borders) => [false, true].map((attributes) => [direction, borders, attributes] as const))))(
    "nest (%s, %s, attributes %s)",
    (direction, borders, attributes) => {
      const labels = loops(count);
      const drawn = render(source(direction, labels, attributes), { width: 80, borders });
      for (const label of labels) expect(drawn).toMatch(new RegExp(`[─ ]${label}[─ ]`, "u"));
      expect(drawn).toContain("has");
      expect(drawn).not.toContain("…");
      expect(heads(drawn)).toBe(count);
      expect(bars(drawn)).toBe(count + (direction === "LR" || direction === "RL" ? 2 : 0));
      expect(drawn).not.toMatch(/─│─|┼/u);
    }
  );
});
