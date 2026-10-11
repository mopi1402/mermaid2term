import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { TWO_PANES } from "../support/drawn.js";
import { withConfig } from "../support/frontmatter.js";

const lines = (source: string, width: number): string[] => render(source, { width }).split("\n").map((row) => row.trimEnd());
const drawn = (source: string, width: number): string => lines(source, width).join("\n");
const widest = (source: string, width: number): number => Math.max(...lines(source, width).map((row) => [...row].length));
const strips = (source: string, width: number): number => lines(source, width).filter((row) => row.trimStart().startsWith("╭")).length;
const labelsOf = (source: string, width: number): string[] =>
  lines(source, width).filter((row) => row.trimStart().startsWith("│")).flatMap((row) => row.split("│").map((cell) => cell.trim()).filter((cell) => cell !== ""));

// Every behaviour below measured on mermaid 12.0.0 headless, 2026-09-29.
describe.each([120, 60])("a packet's grammar at width %i", (width) => {
  it("draws the `title` statement centred under the last row, last one winning", () => {
    const rows = lines('packet\ntitle One\n0-15: "A"\n16-31: "B"\ntitle   My    Packet', width);
    const at = rows.findIndex((row) => row.includes("My Packet"));
    const lastStrip = rows.map((row) => row.trimStart().startsWith("╰")).lastIndexOf(true);
    expect(at).toBeGreaterThan(lastStrip);
    expect(drawn('packet\ntitle One\n0-31: "A"\ntitle Two', width)).not.toContain("One");
    const middle = Math.floor(widest('packet\n0-31: "A"', width) / 2);
    expect(Math.abs(rows[at].indexOf("My Packet") + 4 - middle)).toBeLessThanOrEqual(1);
  });

  it("drops a trailing comment off the title", () => {
    const out = drawn('packet\ntitle T %% c\n0-31: "A"', width);
    expect(out).toMatch(/^\s*T$/mu);
    expect(out).not.toContain("%%");
  });

  it("lets a body `title` overwrite the frontmatter one", () => {
    const out = drawn('---\ntitle: FM\n---\npacket\ntitle Body\n0-31: "A"', width);
    expect(out).toContain("Body");
    expect(out).not.toContain("FM");
  });

  it("reads `+ 8` with a space after the plus", () => {
    expect(labelsOf('packet\n0-7: "A"\n+ 8: "C"\n+16: "D"', width)).toEqual(expect.arrayContaining(["A", "C", "D"]));
  });

  it("keeps every row of a last block ending on a later row, its label on each piece", () => {
    expect(labelsOf('packet\n0-95: "Big"', width).filter((label) => label === "Big").length).toBe(strips('packet\n0-95: "Big"', width));
    expect(strips('packet\n0-95: "Big"', width)).toBe(width >= 97 ? 3 : 6);
    expect(drawn('packet\n0-7: "A"\n8-71: "Across rows"', width)).toContain(width >= 97 ? "71" : "71");
  });

  it("unquotes single-quoted labels and reads escapes as mermaid's `convertString`", () => {
    expect(labelsOf("packet\n0-15: 'A'\n16-31: \"B\"", width)).toEqual(["A", "B"]);
    expect(labelsOf('packet\n0-15: "a \\"b\\" c"', width)).toEqual(['a "b" c']);
    expect(labelsOf('packet\n0-15: "a\\tb\\nc"', width)).toEqual(["a b c"]);
    expect(labelsOf("packet\n0-15: 'it\\'s'", width)).toEqual(["it's"]);
  });

  it("honours `bitsPerRow` from the frontmatter and the init directive", () => {
    const source = withConfig({ packet: { bitsPerRow: 16 } }, 'packet\n0-15: "A"\n16-31: "B"\n32-39: "C"');
    expect(strips(source, width)).toBe(3);
    expect(strips('%%{init: {"packet": {"bitsPerRow": 8}}}%%\npacket\n0-15: "A"\n16-23: "B"', width)).toBe(3);
  });

  it("hides every bit number under `showBits: false`", () => {
    const source = withConfig({ packet: { showBits: false } }, 'packet\n0-15: "A"\n16-31: "B"');
    expect(drawn(source, width)).not.toMatch(/\d/u);
    expect(labelsOf(source, width).length).toBeGreaterThan(0);
  });
});

describe("a packet under a width budget", () => {
  it.each([40, 60, 80])("folds to fewer bits per row to fit %i columns", (width) => {
    const source = 'packet\ntitle A rather long packet title for the header\n0-15: "Source Port"\n16-31: "Destination Port"\n32-63: "Length"';
    expect(widest(source, width)).toBeLessThanOrEqual(width);
    expect(drawn(source, width)).toContain("63");
  });

  it.each([100, 120])("keeps 32 bits per row at %i columns", (width) => {
    expect(widest('packet\n0-31: "A"', width)).toBe(97);
  });

  const TCP = 'packet\n0-15: "Source Port"\n96-99: "Data Offset"\n100-105: "Reserved"\n106: "URG"\n107: "ACK"\n112-127: "Window"';

  it.each([30, 40])("writes a folded row's legend whole at %i columns", (width) => {
    const out = lines(TCP, width);
    expect(out).toContain("Data Offs… = Data Offset [96-99]");
    expect(out.some((row) => row.startsWith("Res… = Reserved [100-105]"))).toBe(true);
  });

  it.each([30, 40])("keeps a blank between two bit numbers of a folded row at %i columns", (width) => {
    const numbers = lines(TCP, width).filter((row) => /^\d/u.test(row));
    expect(numbers.length).toBeGreaterThan(0);
    for (const row of numbers) expect(row).not.toMatch(/\d{4}/u);
  });
});

// Measured on mermaid 12.0.0 headless, 2026-09-29: the whole `accDescr { }` block is the description.
describe.each(TWO_PANES)("a field-shaped line inside `accDescr { }` at width %i", (width) => {
  it("is part of the description, never a field", () => {
    const source = 'packet-beta\n  accDescr {\n0-7: "x"\n}\n  0-7: "real"\n';
    expect(labelsOf(source, width)).toEqual(["real"]);
    expect(lines(source, width).filter((row) => /^\d/u.test(row))).toEqual([expect.stringMatching(/^0\s+7$/u)]);
  });
});
