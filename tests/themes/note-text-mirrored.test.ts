// A note's text on a mirrored theme: neutral writes #fff on a #666 note, and on the dark page the note is held near
// the page while the text would be turned dark with it. The text keeps the ink that reads on the note it sits on.

import { describe, expect, it } from "vitest";

import { renderThemedText } from "../../src/index.js";
import { contrastRatio, PLAIN_RATIO } from "../../src/colour/contrast.js";
import { parseHex } from "../../src/colour/rgb.js";
import { must } from "../../src/must.js";
import { TWO_PANES } from "../support/drawn.js";

const HEX_RE = /#[0-9a-f]{6}/giu;
const LETTER_RE = /\p{L}/u;

const SEQUENCE = `sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello
    Note right of B: Thinking
    Note over A,B: Conversation started`;

const state = (direction: string): string => `stateDiagram-v2
    direction ${direction}
    [*] --> Ready
    Ready --> Done
    note right of Ready : Important information`;

const CLASS = `classDiagram
    note "From Duck till Zebra"
    Animal <|-- Duck
    note for Duck "can fly"`;

// The lowest ratio any letter of the drawing reads at on the fill it is written on.
const lowestOnFill = (source: string, width: number): number => {
  let lowest = Number.POSITIVE_INFINITY;
  for (const cell of renderThemedText(source, { width, background: "dark" }, "neutral").rows.flat()) {
    if (!LETTER_RE.test(cell.ch)) continue;
    const [ink, ground] = [...cell.style.matchAll(HEX_RE)].map((hex) => must(parseHex(hex[0])));
    if (ink === undefined || ground === undefined) continue;
    lowest = Math.min(lowest, contrastRatio(ink, ground));
  }
  return lowest;
};

describe.each(TWO_PANES)("a note's text reads on neutral's dark page, at width %i", (width) => {
  it.each([
    ["a sequence", SEQUENCE],
    ["a top-down state diagram", state("TB")],
    ["a left-right state diagram", state("LR")],
    ["a class diagram", CLASS],
  ])("in %s", (_, source) => {
    expect(lowestOnFill(source, width)).toBeGreaterThanOrEqual(PLAIN_RATIO);
  });
});
