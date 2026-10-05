import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";
import { must } from "../../src/must.js";

const LABELLED = "classDiagram\n    direction LR\n    A --> B : draws\n    B --> C : painted in\n";

const CARDS = 'classDiagram\n    direction LR\n    Customer "0..1" --> "1..*" Ticket\n';

const rowWith = (drawn: string, mark: string): string => must(drawn.split("\n").find((row) => row.includes(mark)));

describe("a class diagram running out of width across the page", () => {
  it("keeps the comfortable gap while the page is wide enough for it", () => {
    const row = rowWith(render(LABELLED, { width: 200 }), "draws");
    // Every gap is the widest relation's, so the short label is carried in the same run as the long one.
    expect(row).toMatch(/├─{5} draws ─{5}⏵│/u);
    expect(row).toMatch(/├─{2} painted in ─{3}⏵│/u);
  });

  it("drops the comfort to one run cell on each side of the label instead of turning the drawing down the page", () => {
    const drawn = render(LABELLED, { width: 80 });
    // Each gap now takes its OWN label's room, one stroke standing on each side of the chip and the head past it.
    expect(rowWith(drawn, "draws")).toMatch(/├─ draws ─⏵│\s+├─ painted in ─⏵│/u);
    expect(drawn.split("\n").filter((row) => row.includes("┌─"))).toHaveLength(1);
  });

  it("stands each cardinal ON its own wall, the two of them three cells apart, and two once the width runs out", () => {
    expect(render(CARDS, { width: 200 })).toContain("┤0..1   1..*├");
    expect(render(CARDS, { width: 43 })).toContain("┤0..1   1..*├");
    expect(render(CARDS, { width: 42 })).toContain("┤0..1  1..*├");
  });
});
