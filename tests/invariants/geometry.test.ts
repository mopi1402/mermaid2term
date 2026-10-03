import { describe, it, expect } from "vitest";
import { badlyFedHeads, mergedCells, piercedHeads, rungOf, type Drawing } from "./geometry.js";
import { PENDING, isPending, type Check } from "../../scripts/pending.js";
import { SOURCES, drawingsOf, type Source } from "../../scripts/sources.js";

const why = (name: string, check: Check): string =>
  isPending(name, check) ? ` (pending: ${PENDING.get(name)?.why})` : "";

const testFor =
  (name: string, check: Check) =>
  (title: string, body: () => void): void => {
    if (isPending(name, check)) it.fails(title, body);
    else it(title, body);
  };

const everyDrawing = (source: Source, check: Check, read: (d: Drawing) => string[]): void => {
  for (const d of drawingsOf(source)) expect(read(d), `${source.name} ${rungOf(d)} (${check})`).toEqual([]);
};

describe("two edges are NEVER one line: a cell an edge runs through along an axis is that edge's alone, a second edge on it the same way is a merge no reader can follow back to its box, and only a right-angle crossing, ─┼─, leaves two lines two", () => {
  for (const source of SOURCES) {
    testFor(source.name, "merges")(`${source.name}: no cell shared along one axis at any rung, padless or default${why(source.name, "merges")}`, () => {
      everyDrawing(source, "merges", (d) => mergedCells(d));
    });
  }
});

describe("every arrowhead is fed STRAIGHT: the cell behind a head continues the head's own direction, so the corner of the last turn stands beside the head and is never eaten by it, ──╮ over ▼ and never ───▼", () => {
  for (const source of SOURCES) {
    testFor(source.name, "arrows")(`${source.name}: every head fed by a line its own way at any rung, padless or default${why(source.name, "arrows")}`, () => {
      everyDrawing(source, "arrows", (d) => badlyFedHeads(d.canvas));
    });
  }
});

describe("a head's cell is INVIOLABLE: no other run passes through an arrowhead, ⏷─⏷ being a line the reader cannot tell from two heads, whatever the merge and feeding rules say of it", () => {
  for (const source of SOURCES) {
    testFor(source.name, "pierced")(`${source.name}: no line through a head at any rung, padless or default${why(source.name, "pierced")}`, () => {
      everyDrawing(source, "pierced", (d) => piercedHeads(d.canvas));
    });
  }
});
