import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { NEWLINE } from "../../src/text/chars.js";
import { TWO_PANES, widest } from "../support/drawn.js";

describe("a budget fold is kept only where the drawing ends narrower with it, flowchart and sequence alike", () => {
  const flowchart = [
    "flowchart TD",
    "  A[start here] --> B[charge the customer card now]",
    "  A --> C[put the whole order on backorder]",
    "  B --> D[pick and pack the parcel today]",
    "  C --> D",
  ].join(NEWLINE);

  for (const width of [28, 32]) {
    it(`folds two side-by-side boxes that only narrow the drawing together, at ${width}`, () => {
      expect(widest(render(flowchart, { width }))).toBeLessThanOrEqual(width);
    });
  }

  const sequence = [
    "sequenceDiagram",
    "  participant User as Fraud Analyst",
    "  participant Portal as Risk Console",
    "  participant Api as Risk API",
    "  participant Queue as Decision Queue",
    "  participant Worker as Scoring Worker",
    "  participant Store as Ledger Store",
    "  User->>Portal: Open charge review",
    "  Portal->>Api: Fetch order + customer context",
    "  Api->>Queue: Queue secondary scoring",
    "  Queue->>Worker: Recompute risk profile",
    "  Worker->>Store: Persist case evidence",
    "  Store-->>Api: Store versioned result",
    "  Api-->>Portal: Return approve/hold recommendation",
    "  Portal-->>User: Display reviewer action panel",
  ].join(NEWLINE);

  for (const width of TWO_PANES) {
    it(`undoes a message fold that did not narrow the drawing, at ${width}`, () => {
      const rows = render(sequence, { width }).split(NEWLINE).map((row) => row.trim());
      expect(rows.some((row) => row.includes("Fetch order +"))).toBe(true);
    });
  }
});
