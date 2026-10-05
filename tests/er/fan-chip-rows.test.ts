import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const source = (label: string): string =>
  `erDiagram\n  direction TB\n  CUSTOMER {\n    string a_rather_long_attribute_name\n  }\n  ORDER {\n    string another_long_attribute_name\n  }\n  CUSTOMER ||--o{ ORDER : "${label}"\n  CUSTOMER ||--o{ ORDER : "${label}"\n`;

// The columns the fan's ends leave the bottom of the first box from.
const exits = (label: string, width: number): number[] => {
  const floor = render(source(label), { width, charset: "unicode" }).split("\n").find((line) => line.startsWith("└")) ?? "";
  return [...floor].flatMap((ch, at) => (ch === "┬" ? [at] : []));
};

describe("an ER fan spreads its ends by the widest row of their labels, a <br> label no wider than its longest line", () => {
  it.each([40, 80])("TB at width %i", (width) => {
    const spread = exits("places<br>many", width);
    expect(spread).toHaveLength(2);
    expect(spread).toEqual(exits("places", width));
  });
});
