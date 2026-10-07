import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { must } from "../../src/must.js";
import { runsOf } from "../support/ansi.js";

const ANIMAL = "classDiagram\n    class Animal {\n        +String name\n        +makeSound()\n    }\n    class Dog {\n        +fetch()\n    }\n    Animal <|-- Dog\n";

const padless = (source: string, width = 80): string[] => render(source, { width, borders: "padless" }).split("\n");

describe("`borders: padless`, a class box's border moved onto the edge of its cells", () => {
  it.each(["TD", "LR"])("hugs the name with its walls and closes the compartments on eighths, direction %s", (direction) => {
    const rows = padless(ANIMAL.replace("classDiagram\n", `classDiagram\n    direction ${direction}\n`));
    const box = rows.filter((row) => row.includes("Animal") || row.trim().startsWith("▕"));
    expect(must(box.find((row) => row.includes("Animal")))).toMatch(/▕\s+Animal\s+▏/u);
    expect(box.some((row) => /▕▔+▏/u.test(row))).toBe(true);
    expect(box.some((row) => /▕▁+▏/u.test(row))).toBe(true);
    expect(rows.join("\n")).not.toMatch(/[┌┐└┘├┤]/u);
  });

  it("keeps every wall's ink in ONE column where a relation meets it, the run taking the cell the wall steps out of", () => {
    const rows = padless(ANIMAL.replace("classDiagram\n", "classDiagram\n    direction LR\n"));
    // Where an eighth inks: `▏` on the left edge of its own cell, `▕` on the right edge of it. The wall steps one
    // cell inside on the row it is met and inks the other edge, which falls in the very column it inked before.
    const inked = (row: string): number[] =>
      [...row].flatMap((glyph, at) => (glyph === "▏" ? [at] : glyph === "▕" ? [at + 1] : []));
    const met = must(rows.find((row) => row.includes("◁")));
    expect(met).toMatch(/▕◁─+▏/u);
    expect(inked(met)).toEqual(inked(must(rows.find((row) => row.includes("+String name")))));
    expect(rows.some((row) => /▕ ─+ ▏/u.test(row))).toBe(true);
  });

  it("leaves the default borders alone, the eighths spent only where the mode asks for them", () => {
    expect(render(ANIMAL, { width: 80 })).toMatch(/┌─+┐/u);
    expect(render(ANIMAL, { width: 80 })).not.toMatch(/[▔▁▕▏]/u);
  });

  it("keeps a DASHED outline in the box alphabet, which has no eighth of its own to move to", () => {
    const rows = padless(`${ANIMAL}    style Dog stroke-dasharray: 5 5\n`);
    expect(rows.some((row) => row.includes("┌─ ─"))).toBe(true);
    expect(must(rows.find((row) => row.includes("Animal")))).toMatch(/▕\s+Animal\s+▏/u);
  });

  it("closes a THICK box's compartment rules on the full blocks its walls are drawn with", () => {
    const rows = padless(`${ANIMAL}    style Animal stroke-width:4px\n`);
    expect(must(rows.find((row) => row.includes("Animal")))).toMatch(/█\s+Animal\s+█/u);
    expect(rows.some((row) => /█ ─+ █/u.test(row))).toBe(true);
    expect(rows.join("\n")).not.toMatch(/[┠┨]/u);
  });

  it("draws a NAMESPACE as the container it is, walls on the outer edge and rules on the inner one", () => {
    const rows = padless("classDiagram\n    namespace Shipping {\n        class Parcel {\n            +weigh()\n        }\n    }\n");
    expect(rows.some((row) => /^\s*▁+\s*$/u.test(row))).toBe(true);
    expect(must(rows.find((row) => row.includes("Shipping")))).toMatch(/▏\s+Shipping\s+▕/u);
    expect(must(rows.find((row) => row.includes("Parcel")))).toMatch(/▏\s+▕\s+Parcel\s+▏\s+▕/u);
  });

  it("tightens a NOTE's box the way it tightens a class's", () => {
    const rows = padless("classDiagram\n    class Duck\n    note for Duck \"can swim\"\n");
    // Its tether is a run like any other, so the wall it lands on faces it too.
    expect(must(rows.find((row) => row.includes("can swim")))).toMatch(/▕\s+can swim\s+▕┄+▏/u);
  });
});

describe("a frame's own border under `padless`, which keeps the ground it stands on", () => {
  // The codes a given glyph is written in, first run only.
  const runOf = (painted: string, ch: string): string => must(runsOf(painted).find(([, text]) => text.startsWith(ch)))[0];

  it("writes a namespace's wall on the cluster's ground, where the wall used to cut a bare column through it", () => {
    const painted = renderThemed(
      "classDiagram\n    direction TB\n    namespace Outer {\n        class Inner\n    }\n",
      { width: 60, borders: "padless" },
      "dark"
    );
    const ground = must(must(/48;2;\d+;\d+;\d+/u.exec(runOf(painted, "O")) ?? undefined)[0]);
    expect(runOf(painted, "▏")).toContain(ground);
  });

  it.each(["TD", "LR"])("inks a filled and stroked class's wall in its stroke, where the rim read into the colour threw, direction %s", (direction) => {
    const painted = renderThemed(
      `classDiagram\n    direction ${direction}\n    class All\n    style All fill:#8ecae6,stroke:#023047\n`,
      { width: 60, borders: "padless" },
      "dark"
    );
    const row = must(painted.split("\n").find((line) => line.includes("All")));
    expect(runOf(row, "▕")).toContain("38;2;2;48;71");
  });

  it("writes a sequence note's rim on the note's own fill, the slab whole from end to end", () => {
    const painted = renderThemed("sequenceDiagram\n  Alice->>Bob: hi\n  note over Alice: thought\n", { width: 60, borders: "padless" }, "dark");
    const row = must(painted.split("\n").find((line) => line.includes("thought")));
    const ground = must(must(/48;2;\d+;\d+;\d+/u.exec(runOf(row, "t")) ?? undefined)[0]);
    for (const rim of ["▕", "▏"]) expect(runOf(row, rim)).toContain(ground);
  });
});
