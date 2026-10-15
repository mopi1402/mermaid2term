import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const HEADS = /[⏵⏴⏷⏶]/gu;
const headsOf = (drawing: string): number => drawing.match(HEADS)?.length ?? 0;
const labelRow = (drawing: string, word: string): string | undefined =>
  drawing.split("\n").find((line) => new RegExp(`│\\s+${word}\\s+│`, "u").test(line));
const pipeline = readFileSync("fixtures/block/render-pipeline.mmd", "utf8");

describe("block links", () => {
  it.each([3, 4])("go round a block standing between their ends, across a row (columns %i)", (columns) => {
    const drawing = render(`block-beta\n  columns ${columns}\n  a b c\n  a --> c\n`);
    expect(drawing).not.toContain("┼");
    expect(labelRow(drawing, "b")).toMatch(/│\s+b\s+│/u);
    expect(labelRow(drawing, "b")).not.toMatch(/─\s*b|b\s*─/u);
    expect(headsOf(drawing)).toBe(1);
  });

  it.each([1, 2])("go round a block standing between their ends, down a column (columns %i)", (columns) => {
    const blocks = columns === 1 ? "a b c" : "a x b y c z";
    const drawing = render(`block-beta\n  columns ${columns}\n  ${blocks}\n  a --> c\n`);
    expect(drawing).not.toContain("┼");
    expect(drawing.split("\n").filter((line) => /│\s+b\s+│/u.test(line))).toHaveLength(1);
    expect(headsOf(drawing)).toBe(1);
  });

  it.each([80, 40])("never lose a head under a later line, the pipeline at %i columns", (width) => {
    const drawing = render(pipeline, { width });
    expect(drawing).not.toContain("┼");
    expect(headsOf(drawing)).toBe(5);
  });

  it.each([2, 3])("keep every head where lines meet (columns %i)", (columns) => {
    const blocks = columns === 2 ? "a b c d" : "a b x c d y";
    const drawing = render(`block-beta\n  columns ${columns}\n  ${blocks}\n  a --> b\n  b --> c\n  c --> d\n`);
    expect(drawing).not.toContain("┼");
    expect(headsOf(drawing)).toBe(3);
  });

  it.each([2, 3])("reach a narrower block under a spanning one, not the gap beside it (columns %i)", (columns) => {
    const lines = render(`block-beta\n  columns ${columns}\n  a:${columns}\n  ${columns === 2 ? "b c" : "b x c"}\n  a --> c\n`).split("\n");
    const row = lines.findIndex((line) => /│\s+c\s+│/u.test(line));
    const at = lines[row].indexOf(" c ");
    const [left, right] = [lines[row].lastIndexOf("│", at), lines[row].indexOf("│", at)];
    const heads = lines.flatMap((line, r) => [...line].flatMap((ch, c) => (/[⏵⏴⏷⏶]/u.test(ch) ? [[r, c]] : [])));
    expect(heads).toHaveLength(1);
    const [[hr, hc]] = heads;
    const onTop = hc > left && hc < right && lines[hr + 1][hc] === "─";
    const onSide = Math.abs(hr - row) <= 1 && (hc === left - 1 || hc === right + 1);
    expect(onTop || onSide).toBe(true);
  });

  it.each([2, 3])("keep both heads of a link and its reverse (columns %i)", (columns) => {
    const drawing = render(`block-beta\n  columns ${columns}\n  a b\n  a --> b\n  b --> a\n`);
    expect(headsOf(drawing)).toBe(2);
  });
});
