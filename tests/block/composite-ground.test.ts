import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { runsOf } from "../support/ansi.js";

// mermaid's `.node .cluster` fills a composite block with `clusterBkg`, #FFFFDE on `default`; a block keeps `mainBkg`.
const CLUSTER = "48;2;255;255;222";
const NODE = "48;2;236;236;255";

const groups = "block-beta\n  columns 2\n  block:outer:2\n    columns 2\n    one two\n    three\n  end\n  left right\n";

// mermaid labels a composite with its written label only, `""` when none is written, never with its id.
describe("a composite block written with an id alone", () => {
  it.each([40, 80])("draws no caption at width %i", (width) => {
    const lines = render(groups, { width }).split("\n");
    expect(lines.some((line) => line.includes("outer"))).toBe(false);
    expect(lines[1]).toMatch(/^│ +│$/);
  });

  it("still titles a composite with the label it is written with", () => {
    expect(render(groups.replace("block:outer:2", 'block:outer["Outer"]:2'))).toContain("Outer");
  });
});

describe.each(["default", "padless"] as const)("a composite block on mermaid's cluster ground (%s borders)", (borders) => {
  const lines = renderThemed(groups, { width: 80, background: "light", borders }, "default").split("\n");
  const row = (word: string): ReturnType<typeof runsOf> => runsOf(lines.find((line) => line.includes(word)) ?? "");

  it("lays clusterBkg between the frame and the blocks it holds", () => {
    expect(row("one").some(([codes, text]) => text.trim() === "" && codes.includes(CLUSTER))).toBe(true);
    expect(row("three").some(([codes, text]) => text.trim() === "" && codes.includes(CLUSTER))).toBe(true);
  });

  it("keeps each block inside on its own fill", () => {
    expect(row("one").some(([codes, text]) => text === "one" && codes.includes(NODE))).toBe(true);
  });

  it("leaves the blocks outside it on the page", () => {
    expect(row("left").some(([codes]) => codes.includes(CLUSTER))).toBe(false);
  });
});
