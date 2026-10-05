import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";

const source = (direction: string): string => `classDiagram
  direction ${direction}
  Animal <|-- Duck
  Animal <|-- Fish
  Animal <|-- Zebra
`;

const ROUND = /[╭╮╰╯]/u;

// A class relation bends as a flowchart edge does: rounded unless `roundedEdges` says otherwise.
describe("a class relation's bends", () => {
  it.each(["TB", "LR"])("follow roundedEdges (%s)", (direction) => {
    expect(render(source(direction), { width: 100 })).toMatch(ROUND);
    expect(render(source(direction), { width: 100, roundedEdges: false })).not.toMatch(ROUND);
  });
});
