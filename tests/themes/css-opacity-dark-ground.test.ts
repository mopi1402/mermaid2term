// A faded node on a dark page: every cell of it faded, padless walls included; its words weighed on the ground as
// it shows rather than on the fill it asked for; and words faded by a `classDef` mixed over that ground, the way
// mermaid's label sits at its own opacity over the faded shape.

import { describe, expect, it } from "vitest";

import { renderThemedText } from "../../src/index.js";
import { contrastRatio, PLAIN_RATIO } from "../../src/colour/contrast.js";
import { parseHex } from "../../src/colour/rgb.js";
import { must } from "../../src/must.js";

const STYLE = "fill:#ffd6d6,stroke:#e03131";
const UNFADED_RE = /#e03131|#ffd6d6/iu;
const PAIR_RE = /(#[0-9a-f]{6}) on (#[0-9a-f]{6})/iu;

const KINDS: ReadonlyArray<readonly [string, readonly string[], (direction: string, style: string) => string]> = [
  ["flowchart", ["TD", "LR"], (d, s) => `flowchart ${d}\n  A[Order] --> B[Invoice]\n  style A ${s}`],
  ["state", ["TB", "LR"], (d, s) => `stateDiagram-v2\n  direction ${d}\n  Order --> Invoice\n  style Order ${s}`],
  ["er", ["TB", "LR"], (d, s) => `erDiagram\n  direction ${d}\n  Order {\n    int id\n  }\n  Order ||--o{ Invoice : bills\n  style Order ${s}`],
  ["block", ["1", "2"], (d, s) => `block-beta\n  columns ${d}\n  a["Order"] b["Invoice"]\n  style a ${s}`],
];

const drawn = (source: string, borders: "default" | "padless") => renderThemedText(source, { width: 80, borders, background: "dark" }, "default").rows;

const wordPair = (source: string): readonly [string, string] => {
  for (const row of drawn(source, "default")) {
    const at = row.map((cell) => cell.ch).join("").indexOf("Order");
    if (at < 0) continue;
    const found = PAIR_RE.exec(row[at].style) ?? undefined;
    if (found !== undefined) return [found[1].toUpperCase(), found[2].toUpperCase()];
  }
  return ["", ""];
};

describe.each(KINDS)("a faded %s node on a dark page", (_kind, directions, source) => {
  it.each(directions)("fades every cell of it under padless, its walls too, %s", (direction) => {
    const unfaded = drawn(source(direction, `${STYLE},opacity:0.4`), "padless").flat().filter((cell) => UNFADED_RE.test(cell.style));
    expect(unfaded.map((cell) => `${cell.ch} ${cell.style}`)).toEqual([]);
  });

  it.each(directions.flatMap((direction) => ["opacity:0.4", "fill-opacity:0.3"].map((fade) => [direction, fade] as const)))("weighs its words on the ground as it shows, %s, %s", (direction, fade) => {
    const [ink, ground] = wordPair(source(direction, `${STYLE},${fade}`));
    expect(contrastRatio(must(parseHex(ink)), must(parseHex(ground)))).toBeGreaterThanOrEqual(PLAIN_RATIO);
  });
});

describe("words a classDef fades", () => {
  it.each(["TD", "LR"])("are mixed over the faded ground, not the page, %s", (direction) => {
    expect(wordPair(`flowchart ${direction}\n  A[Order] --> B[Invoice]\n  classDef gone opacity:50%\n  class A gone`)).toEqual(["#6E6E6E", "#101010"]);
  });
});
