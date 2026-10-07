import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { RULE_RATIO, contrastRatio } from "../../src/colour/contrast.js";
import { colourValue } from "../../src/colour/rgb.js";
import { must } from "../../src/must.js";
import { ESC } from "../../src/paint/escapes.js";
import { THEMES } from "../../src/paint/catalogue.js";

describe("a lifeline that CROSSES a block's border uncut", () => {
  const source =
    "sequenceDiagram\n    participant A\n    participant B\n    loop every minute\n        A->>B: ping\n" +
    "        alt is up\n            B-->>A: pong\n        else is down\n            B--xA: timeout\n" +
    "        end\n    end\n";

  it("leaves a HOLE where a border meets a lifeline, the lifeline's own `│` standing in it, on every border of every block", () => {
    const rows = render(source, { width: 80 }).split("\n");
    const first = must(rows.find((row) => (row.match(/│/gu) ?? []).length === 2));
    const columns = [...first].flatMap((ch, at) => (ch === "│" ? [at] : []));
    expect(columns).toHaveLength(2);

    const borders = rows.slice(rows.indexOf(first)).filter((row) => row.includes("┌") || row.includes("└"));
    expect(borders).toHaveLength(4);
    for (const border of borders) for (const at of columns) expect(border.charAt(at)).not.toBe("┄");
    for (const border of borders.filter((row) => row.includes("└"))) {
      for (const at of columns) expect(border.charAt(at)).toBe("│");
    }
  });
});

describe("an activation BAND drawn as the BOX it is, opening on the arrow that arrives", () => {
  const source =
    "sequenceDiagram\n    Alice->>John: Hello John, how are you?\n    activate John\n" +
    "    John-->>Alice: Great!\n    deactivate John\n";
  const columnOf = (drawn: string, glyph = "╖"): string => {
    const rows = drawn.split("\n");
    const at = (must(rows.find((row) => row.includes(glyph)))).indexOf(glyph);
    return rows.map((row) => [...row][at] ?? " ").join("");
  };

  it("caps the band with a LID where the head arrives and a FLOOR where the line leaves", () => {
    const column = columnOf(render(source, { width: 60 }));
    expect(column.replace(/[^╖║╜]/gu, "")).toBe("╖║╜");
    expect(column.indexOf("╖")).toBeLessThan(column.indexOf("╜"));
  });

  it("gives the band the lifeline's cell, the head standing one short of it", () => {
    const rows = render(source, { width: 60 }).split("\n");
    const arrives = must(rows.find((row) => row.includes("⏵")));
    const leaves = must(rows.find((row) => row.includes("⏴")));
    expect(arrives.trimEnd().endsWith("⏵╖")).toBe(true);
    expect(leaves.trimEnd().endsWith("┄╜")).toBe(true);
  });

  it("draws the same band for the `+` and `-` written on the message lines themselves", () => {
    const markers = "sequenceDiagram\n    Alice->>+John: Hello John, how are you?\n    John-->>-Alice: Great!\n";
    expect(render(markers, { width: 60 })).toEqual(render(source, { width: 60 }));
  });

  it("holds every row of a longer call, a message meeting the band hanging its arm off it", () => {
    const long =
      "sequenceDiagram\n    Alice->>John: one\n    activate John\n    John->>Bob: two\n" +
      "    Bob-->>John: three\n    John-->>Alice: four\n    deactivate John\n";
    const column = columnOf(render(long, { width: 60 }));
    expect(column.replace(/[^╖║╟╜]/gu, "")).toBe("╖║╟║╟║╜");
  });

  it("lets a message CROSS a band it neither leaves nor reaches, the line running through it", () => {
    const over = "sequenceDiagram\n    A->>+B: wake\n    A->>C: over B's band\n    B-->>-A: done\n";
    const column = columnOf(render(over, { width: 60 }));
    expect(column.replace(/[^╖║╫╜]/gu, "")).toBe("╖║╫║╜");
  });

  it("runs an activation nobody closed down to the foot of the drawing, floorless", () => {
    const open = "sequenceDiagram\n    A->>+B: fire\n    A->>C: and forget\n";
    const column = columnOf(render(open, { width: 60 }));
    expect(column.endsWith("║")).toBe(true);
    expect(column).not.toContain("╜");
  });

  const inkOf = (drawn: string, glyph: RegExp): string => {
    for (const run of drawn.split(ESC)) {
      const written = /^\[([0-9;:]*)m(.)/u.exec(run) ?? undefined;
      if (written !== undefined && glyph.test(written[2])) return written[1];
    }
    throw new Error(`aucun ${String(glyph)} peint dans cette prise`);
  };

  it("paints the band on the ARROW's own ink at half weight, and on no other key's", () => {
    const amber = renderThemed(source, { width: 60 }, "amber");
    expect(inkOf(amber, /[╖║╜]/u)).toBe("38;2;128;104;64");
    expect(inkOf(amber, /⏵/u)).toBe("1;38;2;255;208;128");
    expect(inkOf(amber, /│/u)).not.toBe(inkOf(amber, /[╖║╜]/u));
    expect(inkOf(amber, /┄/u)).not.toBe(inkOf(amber, /[╖║╜]/u));
  });

  it("keeps the band readable as a RULE against the page, whichever theme names the arrow", () => {
    for (const [name, theme] of THEMES) {
      const page = theme.variables.background;
      const painted = renderThemed(source, { width: 60, ...(page === undefined ? {} : { background: page }) }, name);
      const parts = (inkOf(painted, /[╖║╜]/u)).split(";");
      const at = parts.indexOf("38");
      expect([parts[at + 1], at >= 0]).toEqual(["2", true]);
      const ink = { r: Number(parts[at + 2]), g: Number(parts[at + 3]), b: Number(parts[at + 4]) };
      const ground = (page === undefined ? undefined : colourValue(page)) ?? { r: 0, g: 0, b: 0 };
      if (contrastRatio(ink, ground) < RULE_RATIO) {
        throw new Error(`${name} : la bande tient ${contrastRatio(ink, ground).toFixed(2)} contre le fond`);
      }
    }
  });

  const stacked =
    "sequenceDiagram\n    Alice->>+John: Hello John, how are you?\n    Alice->>+John: John, can you hear me?\n" +
    "    John-->>-Alice: Hi Alice, I can hear you!\n    John-->>-Alice: I feel great!\n";
  const three =
    "sequenceDiagram\n    A->>+B: one\n    A->>+B: two\n    A->>+B: three\n" +
    "    B-->>-A: c\n    B-->>-A: b\n    B-->>-A: a\n";
  const countsOf = (drawn: string): string[] =>
    drawn.split("\n").flatMap((row) => [...row.matchAll(/\+\d/gu)].map((found) => found[0]));

  it("keeps ONE lid and ONE floor whatever stacks inside, the second call hanging an arm and not a lid", () => {
    const column = columnOf(render(stacked, { width: 60 }));
    expect(column.replace(/[^╖║╢█╜]/gu, "")).toBe("╖║╢╢║╜");
  });

  it("seats the NUMBER on the band's own cell, the sign hanging to its left", () => {
    const rows = render(stacked, { width: 60 }).split("\n");
    const lid = must(rows.find((row) => row.includes("╖")));
    const marked = must(rows.find((row) => row.includes("+1")));
    expect(marked.indexOf("+1") + 1).toBe(lid.indexOf("╖"));
  });

  it("counts a stack three deep as it rises and as it falls", () => {
    const drawn = render(three, { width: 60 });
    expect(columnOf(drawn).replace(/[^╖║╢█╜]/gu, "")).toBe("╖║╢╢╢╢║╜");
    expect(countsOf(drawn)).toEqual(["+1", "+2", "+1"]);
  });

  it("FILLS the rows a stack runs through that the count does not sit on", () => {
    const branching =
      "sequenceDiagram\n    A->>+B: one\n    A->>+B: two\n    B->>C: out while stacked\n" +
      "    A->>C: over the stack\n    B-->>-A: inner done\n    B-->>-A: outer done\n";
    const column = columnOf(render(branching, { width: 60 }));
    expect(column).toContain("█");
    expect(column).toContain("╟");
    expect(column).toContain("╫");
    expect(countsOf(render(branching, { width: 60 }))).toEqual(["+1"]);
  });

  it("gives the count up to whatever already stands there, and puts it down on the next free fill", () => {
    const tight =
      "sequenceDiagram\n    A->>+B: one\n    A->>+B: two\n    B->>C: a label reaching under the band\n" +
      "    B-->>-A: three\n    B-->>-A: four\n";
    const drawn = render(tight, { width: 44 });
    expect(drawn.split("\n").some((row) => /[█] [a-z]/u.test(row) || /[a-z]█/u.test(row))).toBe(true);
    expect(countsOf(drawn)).toEqual(["+1"]);
  });

  it("paints the count AND its sign on the band's own ink as a GROUND, `+1` one chip", () => {
    const painted = renderThemed(stacked, { width: 60 }, "amber");
    const band = "38;2;128;104;64";
    expect(inkOf(painted, /[╖║╜]/u)).toBe(band);
    expect(painted).toMatch(/\[[0-9;]*48;2;128;104;64m\+1/u);
  });
});
