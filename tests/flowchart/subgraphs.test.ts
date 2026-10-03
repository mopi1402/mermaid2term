import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse, render } from "../../src/index.js";
import { computeLayout } from "../../src/graph/layout/passes.js";
import type { Subgraph } from "../../src/graph/model.js";

const RACINE = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const CHAINE = fs.readFileSync(path.join(RACINE, "fixtures/flowchart/subgraph-chain.mmd"), "utf8");

const BOUCLE = `flowchart LR
    subgraph U
        A --> B
    end
    subgraph D
        B --> C
        C --> A
    end
`;

const LARGE = 163;

const toutes = (subs: Subgraph[]): Subgraph[] => subs.flatMap((sg) => [sg, ...toutes(sg.children)]);

const ancestry = (sg: Subgraph): Subgraph[] => (sg.parent === undefined ? [sg] : [sg, ...ancestry(sg.parent)]);

const nested = (a: Subgraph, b: Subgraph): boolean => ancestry(a).includes(b) || ancestry(b).includes(a);

describe("a node named inside two subgraphs", () => {
  it("belongs to the one that CLOSES first, which is where it was declared", () => {
    const owned = new Map(toutes(parse(CHAINE).subgraphs).map((sg) => [sg.id, sg.nodeIds]));
    expect(owned.get("Intake")).toEqual(["A", "B", "C"]);
    expect(owned.get("Analysis")).toEqual(["D", "E", "F"]);
    expect(owned.get("Response")).toEqual(["G", "H", "I"]);
    expect(owned.get("Learning")).toEqual(["J", "K"]);
  });

  it("is owned ONCE, whatever the diagram", () => {
    for (const source of [CHAINE, BOUCLE]) {
      const seen = new Map<string, string>();
      for (const sg of toutes(parse(source).subgraphs)) {
        for (const id of sg.nodeIds) {
          expect(seen.get(id), `${id} is in ${seen.get(id) ?? ""} and in ${sg.id}`).toBeUndefined();
          seen.set(id, sg.id);
        }
      }
    }
  });

  it("goes to the INNER one when the other is an ancestor still open, which closes last", () => {
    const source = "flowchart TD\n    subgraph Outer\n      A --> B\n      subgraph Inner\n        B --> C\n      end\n    end\n";
    const owned = new Map(toutes(parse(source).subgraphs).map((sg) => [sg.id, sg.nodeIds]));
    expect(owned.get("Inner")).toEqual(["B", "C"]);
    expect(owned.get("Outer")).toEqual(["A"]);
  });
});

describe("the boxes drawn from that ownership", () => {
  it("never share a cell with a box that does not hold them", () => {
    const graph = parse(CHAINE);
    const bounds = computeLayout(graph).subgraphBounds;
    expect(bounds.length).toBe(4);
    for (const a of bounds) {
      for (const b of bounds) {
        if (a === b || nested(a.subgraph, b.subgraph)) continue;
        const apart =
          a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
        expect(apart, `${a.subgraph.id} overlaps ${b.subgraph.id}`).toBe(true);
      }
    }
  });

  it("leaves every edge label whole, the name of a box taking its room before they are placed", () => {
    const drawn = render(CHAINE, { width: LARGE });
    for (const label of ["valid", "noise", "automate", "coordinate"]) expect(drawn).toContain(label);
    for (const name of ["Intake", "Analysis", "Response", "Learning"]) {
      expect(drawn).toContain(name);
      expect(drawn, `${name} is written into`).not.toMatch(new RegExp(`${name}\\S`, "u"));
    }
  });
});
