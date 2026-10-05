import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { THREE_PANES } from "../support/drawn.js";

const CROSS = /[┼╋]/u;
const directed = (source: string, direction: string): string =>
  source.replace(/^(flowchart|graph)\b[^\n]*/mu, `$1 ${direction}`).replace(/^(\s*)direction\s+\w+/gmu, `$1direction ${direction}`);
const fixture = (name: string): string => readFileSync(`fixtures/${name}.mmd`, "utf8");
const DIRECTIONS = ["TD", "LR"];

describe("an edge through a subgraph's wall cuts the wall and runs on", () => {
  it.each(DIRECTIONS)("the overlapping subgraphs, %s", (direction) => {
    for (const width of THREE_PANES) {
      const drawing = render(directed(fixture("flowchart/subgraph-overlap"), direction), { width });
      expect(drawing).not.toMatch(CROSS);
      expect(drawing).toMatch(/╰─+⏵│  b1/u);
    }
  });
});

describe("two edges never turn on one cell", () => {
  const fulfilment = readFileSync("fixtures/flowchart/order-fulfilment.mmd", "utf8");
  it.each(DIRECTIONS)("the order fulfilment, %s", (direction) => {
    for (const width of THREE_PANES) {
      for (const borders of ["default", "padless"] as const) expect(render(directed(fulfilment, direction), { width, borders })).not.toMatch(CROSS);
    }
  });
});

const classIn =(source: string, direction: string): string =>
  source.replace(/^(\s*)direction\s+\w+\n/gmu, "").replace(/^classDiagram\b/mu, `classDiagram\n    direction ${direction}`);
const namespaces = readFileSync("fixtures/class/namespaces.mmd", "utf8");

describe("a relation through a namespace's wall cuts the wall and runs on", () => {
  it.each(["TB", "LR"])("the nested namespaces, %s", (direction) => {
    for (const width of THREE_PANES) expect(render(classIn(namespaces, direction), { width })).not.toMatch(CROSS);
  });
});

describe("an ER relation meeting an entity on its rule cuts the rule, never a crossing", () => {
  const sources: Record<string, string> = {
    TB: "erDiagram\n    A ||--o{ B : x\n    A ||--o{ C : y\n    B ||--|| C : z\n    B {\n        string name\n    }\n",
    LR: "erDiagram\n    direction LR\n    p[Person] {\n        string name\n    }\n    CAR\n    p one or many to zero or one CAR : owns\n",
  };
  const wedged = /[─━]┼|┼[─━]/u;
  it.each(["TB", "LR"])("a one-attribute entity, %s", (direction) => {
    for (const width of THREE_PANES) {
      for (const borders of ["default", "padless", "borderless"] as const) {
        const rows = render(sources[direction], { width, borders }).split("\n");
        // A one-mark `┼` stands against a wall's tee, or a padless wall stepped in behind the stroke it leaves on the
        // wall's cell; a rule wedged into a wall crosses a line.
        expect(rows.filter((row) => wedged.test(row.replace(/[├┤]┼|┼[├┤]|[▕▏]─┼|┼─[▕▏]/gu, "")))).toEqual([]);
      }
    }
  });
});

describe("a relation never leaves a class on a compartment rule", () => {
  const wedged = /[├┤]─+┼|┼─+[├┤]/u;
  it.each(["TB", "LR"])("the cardinalities, %s", (direction) => {
    for (const width of THREE_PANES) {
      const drawing = render(classIn(fixture("class/relation-cardinalities"), direction), { width });
      expect(drawing).not.toMatch(CROSS);
      expect(drawing).not.toMatch(wedged);
    }
  });
  it.each(["TB", "LR"])("a relation to a neighbour whose middle is its rule, %s", (direction) => {
    const source = `classDiagram\n    direction ${direction}\n    class B["Bee<br>Line"] {\n        <<interface>>\n        +int id\n        +go()\n    }\n    class C {\n        +int id\n    }\n    A --> B\n    A --> C\n    B -- C\n`;
    for (const width of THREE_PANES) {
      const drawing = render(source, { width });
      expect(drawing).not.toMatch(CROSS);
      expect(drawing).not.toMatch(wedged);
    }
  });
});
