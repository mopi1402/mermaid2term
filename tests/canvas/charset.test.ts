import { describe, expect, it } from "vitest";
import { CHARSETS, CHARSET_NAMES, COMPAT, DEFAULT_CHARSET, UNICODE, charsetOf, render } from "../../src/index.js";
import { HEADS } from "../../src/canvas/glyphs.js";
import { Canvas } from "../../src/canvas/canvas.js";
import { piercedHeads } from "../invariants/geometry.js";
import { must } from "../../src/must.js";
import { withConfig } from "../support/frontmatter.js";

const SOURCE = "graph LR\n  A --> B\n";
const strings = (v: unknown): string[] =>
  typeof v === "string" ? [v] : Array.isArray(v) ? v.flatMap(strings) : v && typeof v === "object" ? Object.values(v).flatMap(strings) : [];

describe("a charset is named", () => {
  it("registers unicode and compat, unicode first and by default", () => {
    expect(CHARSET_NAMES).toEqual(["unicode", "compat"]);
    expect(DEFAULT_CHARSET).toBe("unicode");
    expect(charsetOf()).toBe(UNICODE);
    expect(charsetOf("compat")).toBe(COMPAT);
    for (const [name, cs] of CHARSETS) expect(cs.name).toBe(name);
  });
  it("refuses a name it does not know, naming the ones it does", () => {
    expect(() => charsetOf("bogus")).toThrow(/bogus.*unicode, compat/u);
    expect(() => render(SOURCE, { charset: "ascii" })).toThrow(/ascii/u);
  });
});

describe("a drawing takes the charset it is asked for", () => {
  it("draws unicode when nothing is said and compat when asked, the heads telling the two apart", () => {
    expect(render(SOURCE)).toContain("⏵");
    const compat = render(SOURCE, { charset: "compat" });
    expect(compat).toContain("▶");
    expect(compat).not.toContain("⏵");
    expect(compat).toContain("┌");
  });
  it("reads the name off a frontmatter's config block, for a flowchart as for any other diagram", () => {
    const framed = (body: string): string => withConfig({ m2t_charset: "compat" }, body);
    expect(render(framed(SOURCE))).toContain("▶");
    expect(render(framed("sequenceDiagram\n  autonumber\n  A->>B: hi\n"))).toContain("①");
  });
  it("hands the architecture parser the set's icons", () => {
    const source = "architecture-beta\n  service db(database)[Database]\n";
    expect(render(source)).toContain("\u{1f5c4}");
    expect(render(source, { charset: "compat" })).toContain("■ Database");
  });
});

describe("compat spends no glyph a monospace font may lack", () => {
  const SAFE: readonly (readonly [number, number])[] = [
    [0x20, 0x7e],
    [0xa0, 0xff],
    [0x2022, 0x2026],
    [0x2039, 0x203a],
    [0x2190, 0x21ff],
    [0x2299, 0x2299],
    [0x22c8, 0x22c8],
    [0x239b, 0x23ad],
    [0x2460, 0x2473],
    [0x24ea, 0x24ea],
    [0x2500, 0x259f],
    [0x25a0, 0x25ff],
    [0x2605, 0x2605],
    [0x2716, 0x2716],
  ];
  const safe = (cp: number): boolean => SAFE.some(([a, b]) => cp >= a && cp <= b);
  it("every glyph of the compat set falls in a safe block", () => {
    const { name: _name, ...glyphs } = COMPAT;
    for (const g of strings(glyphs)) for (const ch of g) expect(safe(must(ch.codePointAt(0))), `${g} U+${(must(ch.codePointAt(0))).toString(16)}`).toBe(true);
  });
  it("the unicode set alone reaches the transport buttons, the Powerline area, the omission brackets and the emoji", () => {
    const risky = (g: string): boolean => [...g].some((ch) => { const cp = must(ch.codePointAt(0)); return (cp >= 0x23f0 && cp <= 0x23ff) || (cp >= 0xe000 && cp <= 0xf8ff) || (cp >= 0x2e00 && cp <= 0x2e7f) || cp >= 0x1f000; });
    expect(strings(UNICODE).some(risky)).toBe(true);
    expect(strings(COMPAT).some(risky)).toBe(false);
  });
  it("differs from unicode on the risky fields alone, the box drawing shared", () => {
    const compat = new Map(Object.entries(COMPAT));
    const differing = Object.entries(UNICODE).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(compat.get(k))).map(([k]) => k);
    expect(differing).toContain("arrowRight");
    expect(differing).toContain("faces");
    expect(differing).not.toContain("horizontal");
    expect(differing).not.toContain("topLeft");
    expect(differing).not.toContain("band");
    expect(COMPAT.medallions).toHaveLength(20);
    expect(COMPAT.discDigits).toHaveLength(10);
  });
  it("the head oracle knows the heads of every set", () => {
    for (const cs of CHARSETS.values()) {
      expect(HEADS.get(cs.arrowDown)).toMatchObject({ dr: -1, dc: 0 });
      expect(HEADS.get(cs.arrowUp)).toMatchObject({ dr: 1, dc: 0 });
      expect(HEADS.get(cs.arrowRight)).toMatchObject({ dr: 0, dc: -1 });
      expect(HEADS.get(cs.arrowLeft)).toMatchObject({ dr: 0, dc: 1 });
    }
  });
});

describe("a set varies the glyphs it names and nothing of the lines: every guard that assumed otherwise is gone (2026-09-11)", () => {
  const heads = (drawn: string): string => drawn.replace(/[⏵⏴⏷⏶]/gu, (h) => must(({ "⏵": "▶", "⏴": "◀", "⏷": "▼", "⏶": "▲" })[h]));

  it("gives a styled box in `compat` the heavy and the dashed border Unicode draws, where `restyleBox` drew none", () => {
    const source = "flowchart LR\n  A[thick] --> B[dashed]\n  style A stroke-width:4px\n  style B stroke-dasharray:3";
    const compat = render(source, { charset: "compat" });
    expect(compat).toBe(heads(render(source)));
    expect(compat).toContain("┏");
    expect(compat).toMatch(/[╌┄┈]/u);
  });

  it("dashes a class's dividers in `compat` as in Unicode", () => {
    const source = "classDiagram\n  class Animal {\n    +name\n    +speak()\n  }\n  style Animal stroke-dasharray:3";
    const compat = render(source, { charset: "compat" });
    expect(compat).toBe(heads(render(source)));
    expect(compat).toMatch(/[╌┄┈]/u);
  });

  it("draws a bidirectional sequence arrow in `compat` with the set's own heads, not Unicode's", () => {
    const source = "sequenceDiagram\n  Alice<<->>Bob: ping";
    const compat = render(source, { charset: "compat" });
    expect(compat).toMatch(/[◀▶]/u);
    expect(compat).not.toMatch(/[⏴⏵]/u);
  });

  it("lets the head oracle see a pierced head of ANY set, where it knew the Unicode heads alone", () => {
    for (const cs of CHARSETS.values()) {
      const canvas = new Canvas(3, 3);
      canvas.put(0, 1, "│");
      canvas.put(1, 1, cs.arrowRight);
      canvas.put(2, 1, "│");
      expect(piercedHeads(canvas), cs.name).toHaveLength(1);
    }
  });
});
