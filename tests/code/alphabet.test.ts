import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ACROSS_RUNS, ACROSS_STROKES, ARC, ARCS, BLOCK, BOX, CROSSINGS, DASH, DOWN_RUNS, DOWN_STROKES, armsOf, heavier, quadrantInside, stubOf, thickStub } from "../../src/canvas/alphabet.js";
import { HEAVY, LIGHT, NONE, weightedGlyph } from "../../src/canvas/arms.js";
import { CHARSETS } from "../../src/canvas/charsets.js";
import { Canvas, DOWN, LEFT, RIGHT, UP } from "../../src/canvas/canvas.js";
import { HEAVY_DASH_ACROSS, HEAVY_DASH_DOWN, LIGHT_DASH_ACROSS, LIGHT_DASH_DOWN } from "../../src/canvas/strokes.js";
import { ROOT, quotedIn, sources } from "../support/sources.js";
import { must } from "../../src/must.js";

const unescape = (literal: string): string => literal.replace(/\\u\{?([0-9a-fA-F]{4,6})\}?/gu, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)));
const isLine = (ch: string): boolean => {
  const code = must(ch.codePointAt(0));
  return (code >= 0x2500 && code <= 0x2570) || (code >= 0x2574 && code <= 0x257f);
};
const isBlock = (ch: string): boolean => {
  const code = must(ch.codePointAt(0));
  return code >= 0x2580 && code <= 0x259f;
};

describe("the alphabet is the one source: no box-drawing literal anywhere else in `src`", () => {
  const strayLiterals = (refuses: (ch: string) => boolean): string[] => {
    const offenders: string[] = [];
    for (const file of sources(join(ROOT, "src"))) {
      if (file.endsWith("/alphabet.ts") || file.endsWith("/arms.ts")) continue;
      for (const literal of quotedIn(readFileSync(file, "utf8"), file)) {
        const text = unescape(literal);
        if ([...text].some(refuses)) offenders.push(`${file.slice(ROOT.length + 1)}: ${literal}`);
      }
    }
    return offenders;
  };

  it("finds every line glyph of the code in the alphabet and nowhere else", () => {
    expect(strayLiterals(isLine)).toEqual([]);
  });

  it("finds every block element of the code in the alphabet and nowhere else", () => {
    expect(strayLiterals(isBlock)).toEqual([]);
  });

  it("gives every registered set nothing but alphabet glyphs where it names a line, so the canvas merges all of them", () => {
    const flat = (value: unknown): string[] =>
      typeof value === "string" ? [value] : Array.isArray(value) ? value.flatMap(flat) : typeof value === "object" && value ? Object.values(value).flatMap(flat) : [];
    for (const cs of CHARSETS.values()) {
      const strays = flat(cs).flatMap((s) => [...s].filter(isLine)).filter((ch) => armsOf(ch) === undefined);
      expect(strays, cs.name).toEqual([]);
    }
  });
});

describe("the merge reads its directions off the alphabet: the table `canvas.ts` kept, as the specification", () => {
  const dirs = (ch: string): number => {
    const arms = armsOf(ch);
    if (arms === undefined) return 0;
    return (arms[0] ? LEFT : 0) | (arms[1] ? RIGHT : 0) | (arms[2] ? UP : 0) | (arms[3] ? DOWN : 0);
  };
  const TABLE: ReadonlyArray<readonly [string, number]> = [
    ["─", LEFT | RIGHT], ["│", UP | DOWN], ["┌", RIGHT | DOWN], ["┐", LEFT | DOWN], ["└", RIGHT | UP], ["┘", LEFT | UP],
    ["├", UP | DOWN | RIGHT], ["┤", UP | DOWN | LEFT], ["┬", LEFT | RIGHT | DOWN], ["┴", LEFT | RIGHT | UP], ["┼", LEFT | RIGHT | UP | DOWN],
    ["╭", RIGHT | DOWN], ["╮", LEFT | DOWN], ["╰", RIGHT | UP], ["╯", LEFT | UP],
    ["═", LEFT | RIGHT], ["║", UP | DOWN], ["╔", RIGHT | DOWN], ["╗", LEFT | DOWN], ["╚", RIGHT | UP], ["╝", LEFT | UP],
    ["━", LEFT | RIGHT], ["┃", UP | DOWN], ["┏", RIGHT | DOWN], ["┓", LEFT | DOWN], ["┗", RIGHT | UP], ["┛", LEFT | UP], ["╋", LEFT | RIGHT | UP | DOWN],
    ["┰", LEFT | RIGHT | DOWN], ["┸", LEFT | RIGHT | UP], ["┝", UP | DOWN | RIGHT], ["┥", UP | DOWN | LEFT],
    ["┳", LEFT | RIGHT | DOWN], ["┻", LEFT | RIGHT | UP], ["┣", UP | DOWN | RIGHT], ["┫", UP | DOWN | LEFT],
    ["╌", LEFT | RIGHT], ["╎", UP | DOWN], ["╍", LEFT | RIGHT], ["╏", UP | DOWN], ["┄", LEFT | RIGHT], ["┆", UP | DOWN],
    ["┅", LEFT | RIGHT], ["┇", UP | DOWN], ["┈", LEFT | RIGHT], ["┊", UP | DOWN], ["┉", LEFT | RIGHT], ["┋", UP | DOWN],
  ];
  it("carries the same directions for every glyph the old table named", () => {
    for (const [glyph, expected] of TABLE) expect(dirs(glyph), glyph).toBe(expected);
  });
  it("merges two lines on one cell into the junction, the four elbows into a cross, as it always did", () => {
    const canvas = new Canvas(3, 3);
    canvas.put(1, 0, "─"); canvas.put(1, 1, "─"); canvas.put(1, 2, "─");
    canvas.put(0, 1, "│"); canvas.put(1, 1, "│"); canvas.put(2, 1, "│");
    expect(canvas.get(1, 1)).toBe("┼");
    const elbow = new Canvas(1, 1);
    elbow.put(0, 0, "┌"); elbow.put(0, 0, "┘");
    expect(elbow.get(0, 0)).toBe("┼");
    const tee = new Canvas(1, 1);
    tee.put(0, 0, "─"); tee.put(0, 0, "╯");
    expect(tee.get(0, 0)).toBe("┴");
  });
});

describe("the strokes a run is drawn with are ONE set, the ladders `strokes.ts` lays them from included", () => {
  it("holds exactly what the dash ladders can lay, the half strokes of the coarsest level included, and no double rule", () => {
    expect(ACROSS_STROKES).toEqual(new Set([...LIGHT_DASH_ACROSS, ...HEAVY_DASH_ACROSS]));
    expect(DOWN_STROKES).toEqual(new Set([...LIGHT_DASH_DOWN, ...HEAVY_DASH_DOWN]));
    expect([...ACROSS_RUNS].filter((g) => !ACROSS_STROKES.has(g))).toEqual([BOX.doubleAcross]);
    expect([...DOWN_RUNS].filter((g) => !DOWN_STROKES.has(g))).toEqual([BOX.doubleDown]);
  });
  it("spells the ladders as `strokes.ts` did, level by level", () => {
    expect(LIGHT_DASH_ACROSS).toEqual(["─", "┈", "┄", "╌", "╴"]);
    expect(LIGHT_DASH_DOWN).toEqual(["│", "┊", "┆", "╎", "╵"]);
    expect(HEAVY_DASH_ACROSS).toEqual(["━", "┉", "┅", "╍", "╸"]);
    expect(HEAVY_DASH_DOWN).toEqual(["┃", "┋", "┇", "╏", "╹"]);
  });
  it("names the crossings `draw.ts` listed, light and heavy in every mix, and the plus of the ASCII set no more", () => {
    expect(CROSSINGS).toEqual(new Set([..."┼┽┾┿╀╁╂╃╄╅╆╇╈╉╊╋"]));
  });
  it("spells the named glyphs and the arcs as the renderers had them", () => {
    expect([BOX.across, BOX.down, BOX.heavyAcross, BOX.heavyDown, BOX.doubleAcross, BOX.doubleDown].join("")).toBe("─│━┃═║");
    expect([BOX.topLeft, BOX.topRight, BOX.bottomLeft, BOX.bottomRight].join("")).toBe("┌┐└┘");
    expect([BOX.heavyTopLeft, BOX.heavyTopRight, BOX.heavyBottomLeft, BOX.heavyBottomRight].join("")).toBe("┏┓┗┛");
    expect([BOX.doubleTopLeft, BOX.doubleTopRight, BOX.doubleBottomLeft, BOX.doubleBottomRight].join("")).toBe("╔╗╚╝");
    expect([BOX.teeRight, BOX.teeLeft, BOX.teeDown, BOX.teeUp, BOX.cross].join("")).toBe("├┤┬┴┼");
    expect([BOX.lightUpHeavyDown, BOX.heavyUpLightDown].join("")).toBe("╽╿");
    expect([ARC.topLeft, ARC.topRight, ARC.bottomLeft, ARC.bottomRight].join("")).toBe("╭╮╰╯");
    expect(ARCS.size).toBe(4);
    expect(DASH.across.light.triple).toBe("┄");
    expect(DASH.down.light.quadruple).toBe("┊");
    expect([BLOCK.lowerHalf, BLOCK.upperHalf, BLOCK.rightHalf, BLOCK.leftHalf, BLOCK.full].join("")).toBe("▄▀▐▌█");
    expect([BLOCK.lightShade, BLOCK.mediumShade, BLOCK.darkShade].join("")).toBe("░▒▓");
    expect([BLOCK.lowerQuarter, BLOCK.leftQuarter].join("")).toBe("▂▎");
    expect([BLOCK.lowerEighth, BLOCK.upperEighth, BLOCK.leftEighth, BLOCK.rightEighth].join("")).toBe("▁▔▏▕");
    expect([BLOCK.upperLeft, BLOCK.upperRight, BLOCK.lowerLeft, BLOCK.lowerRight].join("")).toBe("▘▝▖▗");
    expect([BLOCK.fallingPair, BLOCK.risingPair].join("")).toBe("▚▞");
    expect([BLOCK.lessUpperLeft, BLOCK.lessUpperRight, BLOCK.lessLowerLeft, BLOCK.lessLowerRight].join("")).toBe("▟▙▜▛");
  });
});

describe("what the renderers derived by table is derived by rule: each old table, entry by entry", () => {
  it("makes a border heavier the way `strokes.ts`'s table did, the stub of a tee keeping its weight", () => {
    const TABLE: ReadonlyArray<readonly [string, string]> = [
      ["─", "━"], ["│", "┃"], ["┌", "┏"], ["┐", "┓"], ["└", "┗"], ["┘", "┛"], ["├", "┠"], ["┤", "┨"], ["┬", "┯"], ["┴", "┷"],
      ["┰", "┳"], ["┸", "┻"], ["┝", "┣"], ["┥", "┫"], ["┼", "╋"],
    ];
    for (const [from, to] of TABLE) expect(heavier(from), from).toBe(to);
    expect(heavier("╭")).toBeUndefined();
  });
  it("thickens a tee's stub as `draw.ts`'s table did, and nothing that is not a tee", () => {
    for (const [from, to] of [["┬", "┰"], ["┴", "┸"], ["├", "┝"], ["┤", "┥"]]) expect(thickStub(from), from).toBe(to);
    for (const glyph of ["─", "┼", "┌", "╭"]) expect(thickStub(glyph), glyph).toBeUndefined();
  });
  it("reads a tee as a hole the way `draw.ts`'s table did: the stub's side and the stroke of its weight", () => {
    const TABLE: ReadonlyArray<readonly [string, string, string]> = [
      ["┬", "down", "│"], ["┰", "down", "┃"], ["┴", "up", "│"], ["┸", "up", "┃"],
      ["├", "right", "─"], ["┝", "right", "━"], ["┤", "left", "─"], ["┥", "left", "━"],
    ];
    for (const [glyph, side, stroke] of TABLE) expect(stubOf(glyph), glyph).toEqual([side, stroke]);
    expect(stubOf("┠")).toEqual(["right", "─"]);
    for (const glyph of ["─", "┼", "┌", "╭"]) expect(stubOf(glyph), glyph).toBeUndefined();
  });
  it("finds the quadrant inside a corner as the two slab tables did, the composite state's double feet included", () => {
    const TABLE: ReadonlyArray<readonly [string, string]> = [["┌", "▗"], ["┐", "▖"], ["└", "▝"], ["┘", "▘"], ["╘", "▝"], ["╛", "▘"]];
    for (const [corner, block] of TABLE) expect(quadrantInside(corner), corner).toBe(block);
    expect(quadrantInside("╭")).toBe("▗");
    for (const glyph of ["─", "┼", "├"]) expect(quadrantInside(glyph), glyph).toBeUndefined();
  });
  it("gives the family's glyph for any plain arms, and the arms back for any glyph, arcs and dashes included", () => {
    expect(weightedGlyph([LIGHT, LIGHT, NONE, NONE])).toBe("─");
    expect(weightedGlyph([HEAVY, LIGHT, NONE, NONE])).toBe("╾");
    expect(armsOf("╭")).toEqual([NONE, LIGHT, NONE, LIGHT]);
    expect(armsOf("╍")).toEqual([HEAVY, HEAVY, NONE, NONE]);
    expect(armsOf("x")).toBeUndefined();
  });
});
