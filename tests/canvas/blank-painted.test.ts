import { describe, expect, it } from "vitest";
import { blankPainted } from "../../src/paint/blanks.js";
import { LABEL, NOTE_FILL, STATIC_LABEL_KEY, SUBGRAPH_FILL } from "../../src/canvas/keys.js";

describe("the one rule both painters read for a blank cell", () => {
  it("paints a ground key's blank over a colour or reverse video", () => {
    expect(blankPainted(NOTE_FILL, "on #ffd633")).toBe(true);
    expect(blankPainted(NOTE_FILL, "reverse")).toBe(true);
    expect(blankPainted(SUBGRAPH_FILL, "on #202020")).toBe(true);
  });

  it("leaves a blank bare where its style shows nothing on it", () => {
    expect(blankPainted(SUBGRAPH_FILL, "dim magenta")).toBe(false);
    expect(blankPainted(LABEL, "on #ffd633")).toBe(false);
  });

  it("runs a static member's underline across its blanks", () => {
    expect(blankPainted(STATIC_LABEL_KEY, "underline")).toBe(true);
  });
});
