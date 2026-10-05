import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const RULE_RE = /[├┤┼]─{6,}[├┤┼]/g;

// Every attribute rule the drawing holds, ends included.
const rulesOf = (source: string, width: number): string[] =>
  render(source, { width, charset: "unicode" })
    .split("\n")
    .flatMap((line) => line.match(RULE_RE) ?? []);

const ONE_ATTRIBUTE = "  p[Person] {\n    string name\n  }\n";

describe("an ER relation never stands on an entity's attribute rule, the rule keeping both its tees", () => {
  it.each([40, 80])("a crow's foot beside, LR at width %i", (width) => {
    const rules = rulesOf(`erDiagram\n  direction LR\n${ONE_ATTRIBUTE}  CAR\n  p one or many to zero or one CAR : owns\n`, width);
    expect(rules).toHaveLength(1);
    for (const rule of rules) expect(rule).toMatch(/^├─+┤$/);
  });

  it.each([40, 80])("two ends on one face, LR at width %i", (width) => {
    const source = "erDiagram\n  direction LR\n  CUSTOMER {\n    string name\n    int id\n  }\n  ORDER {\n    int id\n  }\n  CUSTOMER ||--o{ ORDER : places\n  CUSTOMER ||--|| ADDRESS : has\n";
    const rules = rulesOf(source, width);
    expect(rules).toHaveLength(2);
    for (const rule of rules) expect(rule).toMatch(/^├─+┤$/);
  });

  it.each([40, 80])("the corridor of a run skipping a layer, TB at width %i", (width) => {
    const source = "erDiagram\n  direction TB\n  A {\n    int id\n  }\n  A ||--o{ B : x\n  B ||--o{ C : y\n  A ||--o{ C : z\n";
    const rules = rulesOf(source, width);
    expect(rules).toHaveLength(1);
    for (const rule of rules) expect(rule).toMatch(/^├─+┤$/);
  });

  it.each(["TB", "LR"])("a self-loop, %s", (direction) => {
    const rules = rulesOf(`erDiagram\n  direction ${direction}\n  A {\n    int id\n  }\n  A ||--o{ A : self\n`, 80);
    expect(rules).toHaveLength(1);
    for (const rule of rules) expect(rule).toMatch(/^├─+┤$/);
  });
});
