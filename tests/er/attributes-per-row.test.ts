import { describe, expect, it } from "vitest";
import { parseERDiagram } from "../../src/diagrams/erdiagram/parser.js";

const namesOf = (source: string): string[] => [...parseERDiagram(source).entities.values()].flatMap((entity) => entity.attributes.map((one) => one.name));

describe("an ER row holds as many attributes as it has type-name pairs, as mermaid's block state reads it", () => {
  it.each(["TB", "LR"])("block rows, direction %s", (direction) => {
    const source = `erDiagram\n  direction ${direction}\n  A {\n    string name string email\n    int age PK "the age" int b\n  }\n`;
    expect(namesOf(source)).toEqual(["name", "email", "age", "b"]);
  });

  it("a one-line block", () => {
    expect(namesOf("erDiagram\n  A { string name string email }\n")).toEqual(["name", "email"]);
  });

  it("a row not read to its end gives none", () => {
    expect(namesOf("erDiagram\n  A {\n    string name dangling\n  }\n")).toEqual([]);
  });
});
