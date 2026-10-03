import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const BLANK_INSIDE = /^[▕▏│]\s+[▏▕│]$/u;

// The rows of the frame from its name down, the name's row first.
const fromTitle = (source: string, borders: "padless" | "default"): string[] => {
  const rows = render(source, { width: 80, borders }).split("\n");
  return rows.slice(rows.findIndex((row) => row.includes("Busy")));
};

describe("a composite state keeps a blank row between the rule under its name and what it holds", () => {
  it.each([
    ["TD", "padless"],
    ["LR", "padless"],
    ["TD", "default"],
    ["LR", "default"],
  ] as const)("leaves the row under the rule empty (%s, %s)", (dir, borders) => {
    const rows = fromTitle(`stateDiagram-v2\n  direction ${dir}\n  state Busy {\n    Work\n  }`, borders);
    expect(rows[2]).toMatch(BLANK_INSIDE);
    expect(rows[3]).not.toMatch(BLANK_INSIDE);
  });
});
