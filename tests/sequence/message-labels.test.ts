import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { must } from "../../src/must.js";
import { widest } from "../support/drawn.js";

describe("a message that draws a MARK keeps the whole of its label, where the mark was drawn over the tail of it", () => {
  const long = "please hold the line";
  const created =
    `sequenceDiagram\n    participant A as Agent\n    create participant C as Customer Service Desk\n    A->>C: ${long}\n`;
  const destroyed =
    "sequenceDiagram\n    participant A as Agent\n    participant C as Customer Service Desk\n" +
    `    A->>C: hi\n    destroy C\n    A->>C: ${long}\n`;

  it("keeps it whole against a created participant's mark", () => {
    expect(render(created, { width: 120 })).toContain(long);
  });

  it("keeps it whole against the foot box of a destroy", () => {
    expect(render(destroyed, { width: 120 })).toContain(long);
  });

  it("leaves a column of air between the last word and the wall, and asks for no more", () => {
    for (const source of [created, destroyed]) {
      const row = must(render(source, { width: 120 })
        .split("\n")
        .find((line) => line.includes(long)));
      expect(row).toMatch(/line ╭/u);
    }
  });

  it("spends nothing on a message that draws no mark, whose label keeps the room it always had", () => {
    const plain = render(`sequenceDiagram\n    participant A as Agent\n    participant C as Customer Service Desk\n    A->>C: ${long}\n`, {
      width: 120,
    });
    const marked = must(render(created, { width: 120 }).split("\n").find((line) => line.includes(long)));
    expect(plain.split("\n")[0]?.length).toBeLessThan(marked.length);
  });
});

describe("a message label broken where its `<br>` says, as a note's already was", () => {
  const source =
    "sequenceDiagram\n    participant Api as Risk API\n    participant Portal as Risk Console\n" +
    "    Api-->>Portal: Return approve/hold<br>recommendation\n    Portal->>Portal: note<br/>to<br />self\n";

  it("stacks the lines over the arrow, the tag spelled none of the three ways", () => {
    const drawn = render(source, { width: 80 });
    expect(drawn).not.toContain("<br");
    const rows = drawn.split("\n");
    const arrow = rows.findIndex((row) => row.includes("⏵"));
    expect(rows[arrow - 1]).toContain("recommendation");
    expect(rows[arrow - 2]).toContain("Return approve/hold");
  });

  it("asks the columns for the longest line alone, the unbroken spelling wider", () => {
    const broken = render(source, { width: 200 });
    const whole = render(source.replace(/<br\s*\/?>/gu, " "), { width: 200 });
      expect(widest(broken)).toBeLessThan(widest(whole));
  });
});

describe("a message label folded for the budget instead of pushing the lifelines apart", () => {
  const source =
    "sequenceDiagram\n    participant User as Fraud Analyst\n    participant Portal as Risk Console\n" +
    "    participant Api as Risk API\n    participant Queue as Decision Queue\n" +
    "    User->>Portal: Open charge review\n    Portal->>Api: Fetch order + customer context\n" +
    "    Api->>Queue: Queue secondary scoring\n    Api-->>Portal: Return approve/hold recommendation\n";

  it("folds what binds and comes in under the budget, every head and every word kept", () => {
    const drawn = render(source, { width: 100 });
    expect(widest(drawn)).toBeLessThanOrEqual(100);
    expect((drawn.match(/[⏴⏵]/gu) ?? []).length).toBe(4);
    for (const word of ["Return", "approve/hold", "recommendation"]) expect(drawn).toContain(word);
    expect(drawn).toContain("Open charge review");
  });

  it("leaves a drawing that fits alone, every label on the one line the author wrote", () => {
    const roomy = render(source, { width: 200 });
    expect(roomy).toContain("Fetch order + customer context");
    expect(roomy).toContain("Return approve/hold recommendation");
  });

  it("gives back the rows the fold over-spent, a gap opened by one label seating the other", () => {
    const full =
      "sequenceDiagram\n    participant User as Fraud Analyst\n    participant Portal as Risk Console\n" +
      "    participant Api as Risk API\n    participant Queue as Decision Queue\n" +
      "    participant Worker as Scoring Worker\n    participant Store as Ledger Store\n" +
      "    User->>Portal: Open charge review\n    Portal->>Api: Fetch order + customer context\n" +
      "    Api->>Queue: Queue secondary scoring\n    Queue->>Worker: Recompute risk profile\n" +
      "    Worker->>Store: Persist case evidence\n    Store-->>Api: Store versioned result\n" +
      "    Api-->>Portal: Return approve/hold recommendation\n" +
      "    Portal-->>User: Display reviewer action panel\n";
    const drawn = render(full, { width: 110 });
    expect(widest(drawn)).toBeLessThanOrEqual(110);
    expect(drawn).toContain("Open charge");
    expect(drawn).not.toMatch(/\bOpen\s*│/u);
    expect(drawn).toContain("reviewer action");
  });

  it("folds a NOTE for the budget too, the span it is written over being its room", () => {
    const notes =
      "sequenceDiagram\n    participant A as Alice\n    participant B as Bob\n    A->>B: Hello\n" +
      "    Note right of B: Thinking...\n    B-->>A: Hi there!\n    Note over A,B: Conversation started\n";
    const tight = render(notes, { width: 40 });
    expect(widest(tight)).toBeLessThanOrEqual(40);
    for (const word of ["Conversation", "started", "Thinking..."]) expect(tight).toContain(word);
    expect(tight).not.toContain("Conversation started");
    expect(render(notes, { width: 200 })).toContain("Conversation started");
  });

  it("spends no clear row on a note, above it or under it", () => {
    const rows = render(
      "sequenceDiagram\n    A->>B: Hello\n    Note over A,B: one\n    B-->>A: Hi\n    Note over A,B: two\n",
      { width: 200 }
    ).split("\n");
    for (const word of ["one", "two"]) {
      const at = rows.findIndex((row) => row.includes(`  ${word}  `));
      expect(at).toBeGreaterThan(0);
      expect(rows[at - 2]).toMatch(/[⏵⏴]/u);
    }
  });

  it("leaves a note its `<br>` and never buys a row with a column the budget did not grant", () => {
    const broken = render("sequenceDiagram\n    A->>B: go\n    Note over A,B: first<br>second\n", { width: 200 });
    expect(broken).toContain("first");
    expect(broken).toContain("second");
    expect(broken).not.toContain("first second");
  });

  it("never buys a row with a column the budget did not grant", () => {
    const tight = render(source, { width: 40 });
    expect(widest(tight)).toBeLessThanOrEqual(widest(render(source, { width: 100 })));
  });
});
