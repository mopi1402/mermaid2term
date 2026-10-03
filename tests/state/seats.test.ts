import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { must } from "../../src/must.js";
import { UNICODE } from "../../src/canvas/charsets.js";
import { TWO_PANES } from "../support/drawn.js";

describe("an edge label written through another edge's line, which costs the drawing a third edge", () => {
  const source = "graph TD\n    A --> B\n    A -.-> C\n    A ==> D\n    B -->|label| C\n";

  it("leaves the thick trunk whole, junction included", () => {
    const drawn = render(source, { width: 80 });
    expect(drawn).toContain("label");
    const trunk = drawn.split("\n").find((row) => row.includes("━")) ?? "";
    expect(trunk).not.toContain("label");
    expect(trunk).toMatch(/━{5,}/u);
  });

  it("never writes a label into a cell an edge already drew", () => {
    const drawn = render("stateDiagram-v2\n    [*] --> Closed\n    Closed --> Connecting : connect()\n" +
      "    Connecting --> Open : connected\n    Open --> Closing : close()\n    Closing --> Closed : done\n" +
      "    Connecting --> [*] : timeout\n", { width: 80 });
    for (const row of drawn.split("\n")) {
      expect(row).not.toMatch(/[─━┄]{2}[A-Za-z][A-Za-z()]*[─━┄]{2}/u);
    }
  });
});

describe("a label centred on the box's own axis, on an even width too", () => {
  const axis = (drawn: string, mark: string): number => {
    const row = drawn.split("\n").find((r) => r.includes(mark)) ?? "";
    return [...row].indexOf(mark);
  };

  it.each(TWO_PANES)("puts each mark on the axis of the arrow it meets, at width %i", (width) => {
    const drawn = render("stateDiagram-v2\n    direction TB\n    [*] --> Idle\n    Idle --> [*]\n", { width });
    const rows = drawn.split("\n");
    const heads = rows.filter((r) => r.includes("⏷")).map((r) => [...r].indexOf("⏷"));
    expect(heads).toHaveLength(2);
    expect(axis(drawn, "●")).toBe(heads[0]);
    expect(axis(drawn, UNICODE.framedCircle)).toBe(heads[1]);
  });

  it("puts the stem of the arrow leaving the box under its own middle too", () => {
    const rows = render("stateDiagram-v2\n    direction TB\n    [*] --> Idle\n    Idle --> [*]\n", { width: 80 }).split("\n");
    const bas = rows.findIndex((r) => r.includes("╰"));
    expect([...(rows[bas + 1])].indexOf("│")).toBe([...(rows[bas])].indexOf("┬"));
  });

  it("centres a label of either parity in a box of either parity", () => {
    for (const name of ["ab", "abc", "abcd", "abcde"]) {
      for (const width of [40, 60, 80]) {
        const rows = render(`flowchart TD\n    A[${name}] --> B[fin]\n`, { width }).split("\n");
        const row = must(rows.find((r) => r.includes(name)));
        const cells = [...row];
        const left = cells.indexOf(name[0]);
        const gauche = left - cells.indexOf("│") - 1;
        const droite = cells.lastIndexOf("│") - (left + name.length);
        expect(Math.abs(gauche - droite)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("an arrival moved along a border taking its corner with it", () => {
  const source = "stateDiagram-v2\n    [*] --> Closed\n    Closed --> Connecting : connect()\n" +
    "    Connecting --> Open : connected\n    Connecting --> Closed : timeout\n    Open --> Closing : close()\n" +
    "    Open --> Open : send/receive\n    Closing --> Closed : done\n    Closed --> [*]\n";

  const ARMS: ReadonlyMap<string, readonly [boolean, boolean, boolean, boolean]> = new Map([
    ["┤", [true, true, true, false]],
    ["├", [true, true, false, true]],
    ["┬", [false, true, true, true]],
    ["┴", [true, false, true, true]],
    ["┼", [true, true, true, true]],
  ]);
  const VERS_LE_BAS = "│┃┆┊╭╮┌┐┬├┤┼┿╂╽";
  const VERS_LE_HAUT = "│┃┆┊╰╯└┘┴├┤┼┿╂╿";

  it.each(TWO_PANES)("leaves no arm of a junction pointing at nothing, at width %i", (width) => {
    const rows = render(source, { width }).split("\n").map((r) => [...r]);
    const at = (r: number, c: number): string => rows[r]?.[c] ?? " ";
    for (let r = 0; r < rows.length; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        const arms = ARMS.get(at(r, c));
        if (arms === undefined) continue;
        if (arms[0]) expect(VERS_LE_BAS).toContain(at(r - 1, c));
        if (arms[1]) expect(VERS_LE_HAUT).toContain(at(r + 1, c));
      }
    }
  });

  it.each(TWO_PANES)("leaves no hole in a run it draws, at width %i", (width) => {
    const rows = render(source, { width }).split("\n").map((r) => [...r]);
    for (let r = 1; r < rows.length - 1; r++) {
      for (let c = 0; c < rows[r].length; c++) {
        if (rows[r][c] !== " ") continue;
        const dessus = rows[r - 1]?.[c] ?? " ";
        const dessous = rows[r + 1]?.[c] ?? " ";
        expect(VERS_LE_BAS.includes(dessus) && VERS_LE_HAUT.includes(dessous)).toBe(false);
      }
    }
  });
});

describe("a border owing seats to what comes HOME, which counted its forward edges alone", () => {
  const lifecycle =
    "stateDiagram-v2\n    [*] --> Closed\n    Closed --> Connecting : connect()\n" +
    "    Connecting --> Open : connected\n    Connecting --> Closed : timeout\n    Open --> Closing : close()\n" +
    "    Open --> Open : send/receive\n    Closing --> Closed : done\n    Closed --> [*]\n";

  it("gives every edge of the lifecycle its own head, one per edge written", () => {
    const drawn = render(lifecycle, { width: 120 });
    expect((drawn.match(/[⏴⏵⏶⏷]/gu) ?? []).length).toBe(8);
  });

  it("keeps a loop's label whole beside the turn, which had no cell reserved for it", () => {
    expect(render(lifecycle, { width: 120 })).toContain("send/receive");
  });
});

describe("two concurrent regions side by side, each with labels beside its own runs", () => {
  const source = [
    "stateDiagram-v2",
    "    direction TB",
    "    state Active {",
    "        [*] --> NumLockOff",
    "        NumLockOff --> NumLockOn : EvNumLockPressed",
    "        NumLockOn --> NumLockOff : EvNumLockPressed",
    "        --",
    "        [*] --> CapsLockOff",
    "        CapsLockOff --> CapsLockOn : EvCapsLockPressed",
    "        CapsLockOn --> CapsLockOff : EvCapsLockPressed",
    "    }",
  ].join("\n");

  it("puts the regions ONE blank cell apart, the labels' spill counted to the cell", () => {
    const rows = render(source, { width: 120 }).split("\n");
    const lid = must(rows.find((row) => row.includes("┐") && row.includes("┌┄")));
    const seam = /┘?┐(\s+)┌┄/u.exec(lid.slice(lid.indexOf("┐") + 1)) ?? /┐(\s+)┌/u.exec(lid);
    expect(seam).not.toBeUndefined();
    const between = must(seam ?? undefined)[1];
    expect(between).toBe(" ");
  });

  it("stands a region's lid one blank row over its start mark, as over a node", () => {
    const rows = render(source, { width: 120 }).split("\n");
    const lid = rows.findIndex((row) => row.includes("┌┄"));
    const mark = rows.findIndex((row, i) => i > lid && row.includes("●"));
    expect(mark).toBe(lid + 2);
  });
});
