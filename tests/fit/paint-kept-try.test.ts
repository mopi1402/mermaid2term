import { afterEach, describe, expect, it, vi } from "vitest";
import { printToConsole, renderThemedText } from "../../src/index.js";
import { Text } from "../../src/paint/text.js";
import { renderCells } from "../../src/paint/emit.js";
import { NEWLINE } from "../../src/text/chars.js";

const WIDE_FLOWCHART = `flowchart LR
  A[a first rather long label] --> B[a second rather long label] --> C[a third rather long label]
  C --> D[a fourth rather long label]`;

const WIDE_SEQUENCE = `sequenceDiagram
  participant Alice as Alice the first rather long actor
  participant Bob as Bob the second rather long actor
  Alice->>Bob: a message long enough to be folded
  Note over Alice,Bob: a note across both`;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the fit weighs every try by its text and paints only the one it keeps", () => {
  const KINDS: ReadonlyArray<readonly [string, string]> = [
    ["graph engine drawn LR", WIDE_FLOWCHART],
    ["graph engine drawn TD", WIDE_FLOWCHART.replace("flowchart LR", "flowchart TD")],
    ["canvas kind", WIDE_SEQUENCE],
  ];
  for (const [kind, source] of KINDS) {
    it(`lays the styles once for a ${kind} that climbs the ladder, whatever the number of tries`, () => {
      const laid = vi.spyOn(Text.prototype, "bridgeUnderlines");
      const text = renderThemedText(source, { width: 40, background: "dark" }, "dracula");
      expect(laid).toHaveBeenCalledTimes(1);
      expect(text.plain.length).toBeGreaterThan(0);
    });
  }
});

describe("the console print reads each style once for the whole drawing", () => {
  it("prints every folded row as the row rendered alone prints it", () => {
    const text = renderThemedText(WIDE_FLOWCHART, { width: 80, background: "dark" }, "dracula");
    const alone = text.wrap(30).map((cells) => renderCells(cells)).join(NEWLINE) + NEWLINE;
    expect(printToConsole(text, 30)).toBe(alone);
  });
});
