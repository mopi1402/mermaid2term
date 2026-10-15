import { describe, expect, it } from "vitest";
import { parseSequenceDiagram } from "../../src/diagrams/sequence/parser.js";
import { parseArchitecture } from "../../src/diagrams/architecture/parser.js";

describe("a statement written on the header line is read, as mermaid's grammars do", () => {
  it("sequence: `sequenceDiagram A->>B: hi`", () => {
    const diagram = parseSequenceDiagram("sequenceDiagram A->>B: hi\n  B->>C: two\n");
    expect(diagram.participants.map((one) => one.id)).toEqual(["A", "B", "C"]);
  });

  it("architecture: `architecture-beta service a(server)[A]`", () => {
    const graph = parseArchitecture("architecture-beta service a(server)[A]\n  service b(server)[B]\n");
    expect([...graph.nodes.keys()]).toEqual(["a", "b"]);
  });

  it("a bare header line still reads as none", () => {
    expect(parseSequenceDiagram("sequenceDiagram\n  A->>B: hi\n").participants.map((one) => one.id)).toEqual(["A", "B"]);
  });
});
