import { describe, expect, it } from "vitest";
import { parseSequenceDiagram } from "../../src/diagrams/sequence/parser.js";

describe("blanks around a central connection's `()` belong to no actor, `()` being a token of its own in mermaid", () => {
  it.each([
    ["at the source", "A ()->> B: x"],
    ["at the target", "A->>() B: y"],
    ["both", "A () ->> () B: z"],
  ])("%s", (_, message) => {
    const diagram = parseSequenceDiagram(`sequenceDiagram\n  participant A\n  participant B\n  ${message}\n`);
    expect(diagram.participants.map((one) => one.id)).toEqual(["A", "B"]);
  });
});
