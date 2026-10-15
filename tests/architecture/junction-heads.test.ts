// A head written on a junction's own end points into it, as mermaid 12 draws it: the junction is kept for it, its
// four arms meeting on a real `┼`, where folding it away lost both heads and cut the crossing.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const SERVICES = `architecture-beta
    service left(server)[Left]
    service right(server)[Right]
    service top(database)[Top]
    service bottom(disk)[Bottom]
    junction hub`;

const rowOf = (drawn: string, mark: string): string => drawn.split("\n").find((line) => line.includes(mark)) ?? "";

describe("an architecture junction a head points into", () => {
  const drawn = render(`${SERVICES}\n    left:R --> L:hub\n    hub:R --> L:right\n    top:B --> T:hub\n    hub:B --> T:bottom`, { width: 80 });

  it("keeps the heads written on its end, beside a real joint", () => {
    expect(rowOf(drawn, "Left")).toMatch(/─⏵┼─+⏵/u);
    const lines = drawn.split("\n");
    const joint = lines.findIndex((line) => line.includes("┼"));
    const column = [...(lines[joint] ?? "")].indexOf("┼");
    expect([...(lines[joint - 1] ?? "")][column]).toBe("⏷");
  });

  it("still folds a junction no head points into, its runs cut where they cross", () => {
    const folded = render(`${SERVICES}\n    left:R -- L:hub\n    hub:R --> L:right\n    top:B -- T:hub\n    hub:B --> T:bottom`, { width: 80 });
    expect(folded).not.toContain("┼");
    expect(rowOf(folded, "Left")).toMatch(/├─+│─+⏵/u);
  });
});
