import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

describe("an attribute's cells written as mermaid 12 writes them", () => {
  const source = (direction: string): string =>
    `erDiagram\n    direction ${direction}\n    CUSTOMER {\n        string email UK "primary contact"\n` +
    `        Map~string,int~ counts "first<br>second"\n    }\n    CUSTOMER ||--o{ ORDER : places\n`;

  for (const direction of ["TB", "LR"]) {
    it(`drops the quotes round a comment, on each of its rows, under ${direction}`, () => {
      const drawn = render(source(direction), { width: 80 });
      expect(drawn).toContain("primary contact");
      expect(drawn).toContain("first");
      expect(drawn).toContain("second");
      expect(drawn).not.toContain('"');
    });

    it(`brackets a generic a comma splits under ${direction}`, () => {
      const drawn = render(source(direction), { width: 80 });
      expect(drawn).toContain("Map<string,int>");
      expect(drawn).not.toContain("~");
    });
  }
});
