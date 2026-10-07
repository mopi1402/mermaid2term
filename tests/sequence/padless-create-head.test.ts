// Under padless a box's wall rides the inner edge of its cell, so a head stopping one cell short of it stands a cell
// of air away. The message that creates a box seats its head on the wall instead, the wall tightening past it.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const lineOf = (drawing: string, label: string): string => {
  const rows = drawing.split("\n");
  return rows[rows.findIndex((row) => row.includes(label)) + 1] ?? "";
};

describe("a created box under padless", () => {
  it("takes the head of the message that creates it against its wall", () => {
    const drawn = render("sequenceDiagram\n  participant A\n  participant B\n  A->>B: hi\n  create participant C\n  A->>C: make\n", { borders: "padless" });
    expect(lineOf(drawn, "make")).toMatch(/─⏵▏ C {2}▏$/u);
  });

  it("keeps its wall whole when it sends the message itself", () => {
    const drawn = render("sequenceDiagram\n  participant A\n  participant B\n  B->>A: hi\n  create participant C\n  C->>A: born\n", { borders: "padless" });
    expect(lineOf(drawn, "born")).toMatch(/─▕ {2}C {2}▏$/u);
  });
});
