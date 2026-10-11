import { describe, expect, it } from "vitest";
import { parsePacket } from "../../src/diagrams/packet/parser.js";

const labels = (source: string): string[] => parsePacket(source).fields.map((field) => field.label);

describe("a packet block mermaid throws on is dropped, the rest drawn", () => {
  it("one that ends before it starts", () => {
    expect(labels('packet-beta\n  0-7: "a"\n  15-8: "c"\n  8-15: "d"\n')).toEqual(["a", "d"]);
  });

  it("one that runs back over the block before", () => {
    expect(labels('packet-beta\n  0-10: "a"\n  5-12: "c"\n  11: "d"\n')).toEqual(["a", "d"]);
  });

  it("a gap is still drawn", () => {
    expect(labels('packet-beta\n  0-7: "a"\n  16-31: "b"\n')).toEqual(["a", "b"]);
  });
});
