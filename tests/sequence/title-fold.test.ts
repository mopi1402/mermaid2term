import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { headOf, rowsOf, TWO_PANES, widest } from "../support/drawn.js";

const LONG = "A rather long diagram title that cannot fit on a single forty column line at all, nor on eighty however it is put";
const source = (title: string): string => `sequenceDiagram\n title ${title}\n Alice->>Bob: Hi\n Bob-->>Alice: Hello`;

describe("a sequence title wider than its budget", () => {
  it.each(TWO_PANES)("folds on words inside width %i, every word kept, the actors drawn as without it", (width) => {
    const drawn = render(source(LONG), { width });
    expect(widest(drawn)).toBeLessThanOrEqual(width);
    expect(headOf(drawn).map((row) => row.trim()).join(" ")).toBe(LONG);
    const untitled = render(source("T"), { width }).split("\n").slice(2).join("\n");
    expect(rowsOf(drawn).slice(headOf(drawn).length + 1).join("\n")).toBe(untitled);
  });
});
