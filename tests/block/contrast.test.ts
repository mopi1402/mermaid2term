import { describe, it, expect } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { QUIET_RATIO, RULE_RATIO, contrastRatio, readableStyle } from "../../src/colour/contrast.js";
import { colourRange, colourValue, parseHex, type RGB } from "../../src/colour/rgb.js";
import { must } from "../../src/must.js";
import { ESC } from "../../src/paint/escapes.js";

describe("an ink weighed against the FILL it is laid on, a theme and an author having never chosen their colours together", () => {
  const FILL = "#800080";
  const PURPLE = "48;2;128;0;128";
  const AQUA = "#00ffff";
  const BLANK = " ";
  const cells = (drawn: string): Array<readonly [string, string]> =>
    [...drawn.matchAll(new RegExp(ESC + "\\[([0-9;]*)m([^" + ESC + "]*)", "gu"))].flatMap((run) =>
      [...(run[2])].map((ch) => [run[1], ch] as const)
    );
  const inkOf = (codes: string): RGB | undefined => {
    const truecolor = /38;2;(\d+);(\d+);(\d+)/u.exec(codes) ?? undefined;
    if (truecolor === undefined) return undefined;
    return { r: Number(truecolor[1]), g: Number(truecolor[2]), b: Number(truecolor[3]) };
  };
  const shown = (style: string): RGB => {
    const words = style.split(BLANK);
    const value = must(colourValue(must(words.find((word) => colourValue(word) !== undefined))));
    if (!words.includes("dim")) return value;
    const half = (channel: number): number => Math.round(channel / 2);
    return { r: half(value.r), g: half(value.g), b: half(value.b) };
  };
  const source =
    "sequenceDiagram\n    box Purple Both\n    participant A\n    participant B\n    end\n" +
    "    A->>B: hello there\n    B-->>A: and back\n";

  it("leaves nothing drawn on the fill that cannot be read on it", () => {
    const ground = must(parseHex(FILL));
    let weighed = 0;
    for (const theme of ["neon", "classic", "mono", "dracula", "terra"]) {
      for (const [codes, ch] of cells(renderThemed(source, { width: 60 }, theme))) {
        if (!codes.includes(PURPLE) || ch === BLANK) continue;
        const ink = inkOf(codes);
        if (ink === undefined) continue;
        expect(contrastRatio(ink, ground), `${theme}: ${codes}`).toBeGreaterThanOrEqual(RULE_RATIO);
        weighed++;
      }
    }
    expect(weighed).toBeGreaterThan(100);
  });

  it("keeps two levels a theme wrote in ONE hue apart, rather than flattening both onto the floor", () => {
    const ground = must(parseHex(FILL));
    const arrow = readableStyle("dim cyan", ground);
    const label = readableStyle("italic cyan", ground);
    expect(arrow).not.toBe(label);
    expect(contrastRatio(shown(label), ground)).toBeGreaterThan(contrastRatio(shown(arrow), ground));
  });

  it("strokes the box's own rules with the node border, weighed where a pale fill would swallow it", () => {
    const aqua = "sequenceDiagram\n    box Aqua Front\n    participant A\n    participant B\n    end\n    A->>B: hi\n";
    const rule = cells(renderThemed(aqua, { width: 50 }, "neon")).find(([, ch]) => ch === "═");
    expect(rule).toBeDefined();
    const ink = inkOf((must(rule))[0]);
    expect(ink).not.toBeUndefined();
    expect(contrastRatio(must(ink), must(parseHex(AQUA)))).toBeGreaterThanOrEqual(QUIET_RATIO);
    // Every fill leaves the rule an ink, mermaid stroking a `box` with `nodeBorder`; a dark one needs no weighing,
    // where the pale one above moved it.
    const dark = cells(renderThemed(source, { width: 60 }, "neon")).find(([, ch]) => ch === "═");
    const darkInk = inkOf((must(dark))[0]);
    expect(darkInk).not.toBeUndefined();
    expect(darkInk).not.toEqual(ink);
    expect(contrastRatio(must(darkInk), must(parseHex(FILL)))).toBeGreaterThanOrEqual(RULE_RATIO);
  });

  it("weighs a NAME at both ends of its pair, a palette being free to draw it at either", () => {
    expect(colourRange("magenta")).toHaveLength(2);
    expect(readableStyle("bold magenta", must(parseHex(AQUA)))).not.toContain("magenta");
    expect(readableStyle("dim bright_black", must(parseHex(AQUA)))).toBe("dim bright_black");
  });

  it("keeps a RULE under the text and the text under a name, three floors and not one", () => {
    const ground = must(parseHex(FILL));
    const at = (drawn: string, glyph: string): number => {
      const found = cells(drawn).filter(([codes, ch]) => ch === glyph && codes.includes(PURPLE));
      const inks = found.map(([codes]) => inkOf(codes)).filter((ink): ink is RGB => ink !== undefined);
      return Math.min(...inks.map((ink) => contrastRatio(ink, ground)));
    };
    for (const theme of ["neon", "classic"]) {
      const drawn = renderThemed(source, { width: 60 }, theme);
      const lifeline = at(drawn, "│");
      const shaft = at(drawn, "─");
      const name = at(drawn, "A");
      expect(lifeline, theme).toBeLessThan(shaft);
      expect(shaft, theme).toBeLessThan(name);
      expect(lifeline, theme).toBeGreaterThanOrEqual(RULE_RATIO);
    }
  });

  it("leaves the ink of everything OUTSIDE a fill exactly as the theme wrote it", () => {
    const two =
      "sequenceDiagram\n    box Purple One\n    participant A\n    end\n" +
      "    box Two\n    participant B\n    end\n    A->>B: over\n";
    const outside = cells(renderThemed(two, { width: 60 }, "neon")).filter(([codes]) => !codes.includes(PURPLE));
    expect(outside.some(([codes]) => codes === "2;36")).toBe(true);
    expect(outside.every(([codes]) => !codes.includes("38;2;"))).toBe(true);
  });

  it("weighs nothing at all in the drawing a terminal reads without colour", () => {
    expect(render(source, { width: 60 })).not.toContain(ESC);
  });
});
