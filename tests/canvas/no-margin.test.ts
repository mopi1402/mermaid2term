import { describe, expect, it } from "vitest";
import { render, renderThemed } from "../../src/index.js";
import { THREE_PANES } from "../support/drawn.js";
import { ESC } from "../../src/paint/escapes.js";

const CLASS_BODIES = {
  "two classes": "    class Animal {\n        +name\n    }\n    Animal <|-- Dog\n",
  "a namespace": "    namespace Zoo {\n        class Cage\n    }\n    Cage --> Keeper\n",
  "a note": "    class Duck\n    note for Duck \"can fly\"\n    Duck --> Pond\n",
  "a lollipop": "    Ordering ()-- OrderService\n",
  "labels on both sides": "    F --> G : creates the order\n    F ..> G : reads the order\n    F --> G : third\n",
};

const OTHERS = {
  block: "block-beta\n  a b\n",
  "gitGraph LR": "gitGraph LR:\n  commit\n  branch dev\n  commit\n",
  "gitGraph TB": "gitGraph TB:\n  commit\n  branch dev\n  commit\n",
  pie: "pie\n  \"A\" : 60\n  \"B\" : 40\n",
  packet: "packet-beta\n  0-15: \"Source\"\n",
  journey: "journey\n  section S\n    Go: 5: Me\n",
  sequence: "sequenceDiagram\n  Alice->>Bob: hi\n",
};

// A drawing spends no page on a margin: something stands on its first row, and something on its first column. A
// chip's blank is ink too, the ground of a name tag standing on the edge.
const GROUND_FIRST = new RegExp(`^${ESC}\\[[0-9;]*\\b48;`, "u");
const startsOnTheEdge = (drawing: string, painted = ""): void => {
  const rows = drawing.split("\n");
  expect(rows[0].trim(), drawing).not.toBe("");
  const grounded = painted.split("\n").some((row) => GROUND_FIRST.test(row));
  expect(grounded || rows.some((row) => row.length > 0 && row[0] !== " "), drawing).toBe(true);
};

const BORDERS = ["default", "padless", "borderless"] as const;

describe("a drawing starts on the first row and the first column", () => {
  for (const [what, body] of Object.entries(CLASS_BODIES)) {
    it.each(["TB", "LR"])(`a class diagram with ${what}, direction %s`, (direction) => {
      for (const borders of BORDERS) {
        for (const width of THREE_PANES) startsOnTheEdge(render(`classDiagram\n    direction ${direction}\n${body}`, { width, borders }));
      }
    });
  }

  it.each(Object.entries(OTHERS))("%s", (_, source) => {
    for (const borders of BORDERS) {
      for (const width of THREE_PANES) {
        startsOnTheEdge(render(source, { width, borders }), renderThemed(source, { width, borders, background: "light" }, "default"));
      }
    }
  });
});
