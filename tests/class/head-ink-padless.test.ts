import { describe, expect, it } from "vitest";

import { renderThemed } from "../../src/index.js";

const source = (direction: string): string =>
  `---\nconfig:\n  theme: redux-color\n---\nclassDiagram\n  direction ${direction}\n  class Animal {\n    +String name\n  }\n  Animal <|-- Dog\n`;

// The last colour set before a glyph.
const inkBefore = (drawn: string, glyph: string): string | undefined => {
  const at = drawn.indexOf(glyph);
  return [...drawn.slice(0, at).matchAll(/\u001b\[([0-9;]*)m/gu)].at(-1)?.[1];
};

// mermaid inks a relation's head as its line, never in the class's colour: padless seating it on the wall changes nothing.
describe("a class relation's head on a padless wall under redux-color", () => {
  it("takes the relation's ink, as the head off the wall does (LR against TB)", () => {
    const options = { width: 80, borders: "padless" } as const;
    const across = inkBefore(renderThemed(source("LR"), options, "redux-color"), "◁");
    const down = inkBefore(renderThemed(source("TB"), options, "redux-color"), "△");
    expect(across).toBeDefined();
    expect(across).toBe(down);
  });
});
