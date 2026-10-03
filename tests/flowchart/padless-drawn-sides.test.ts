// A padless box takes its form from the sides its links meet. Those sides are guessed before routing; where the
// routing met them elsewhere, the form follows the drawing. Two links back into Notify were guessed onto its right
// wall and drawn into its floor: Notify kept five rows and turned its frame for side runs it never got.

import { describe, expect, it } from "vitest";

import { render } from "../../src/index.js";

const PIPELINE = `flowchart TD
    A[Push] --> B[Build]
    B --> C[Test]
    C --> D{Pass?}
    D -->|Yes| E[Deploy Staging]
    D -->|No| F[Notify]
    E --> G{Approve?}
    G -->|Yes| H[Deploy Prod]
    G -->|No| F
    H --> I{Healthy?}
    I -->|Yes| J[Done]
    I -->|No| F
`;

const GATES = `flowchart LR
    A[Tests] --> B{Result?}
    B -->|pass| C[Build]
    B -->|fail| D[Alert]
    B -->|flaky| E[Retry]
    E --> A
    C --> F{Deploy?}
    F -->|yes| G[Production]
    F -->|no| D
`;

// The glyphs on the rows just above and below a label, at the label's first column.
const around = (drawn: string, label: string): [above: string, below: string] => {
  const rows = drawn.split("\n").map((line) => [...line]);
  const row = rows.findIndex((cells) => cells.join("").includes(label));
  const column = rows[row].join("").indexOf(label);
  return [rows[row - 1][column], rows[row + 1][column]];
};

describe("a padless box's form follows the sides its links were drawn on", () => {
  it("closes up a box whose links all meet its roof and floor (TD)", () => {
    const drawn = render(PIPELINE, { width: 80, borders: "padless" });
    expect(around(drawn, "Notify")).toEqual(around(drawn, "Deploy Staging"));
    expect(around(drawn, "Notify")).toEqual(["▔", "▁"]);
  });

  it("frames a box met on both walls like its walled neighbours (LR)", () => {
    const drawn = render(GATES, { width: 80, borders: "padless" });
    expect(around(drawn, "Alert")).toEqual(around(drawn, "Build"));
  });
});
