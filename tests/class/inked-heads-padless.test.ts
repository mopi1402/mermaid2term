import { describe, expect, it } from "vitest";

import { renderThemed } from "../../src/index.js";

const source = (direction: string): string => `classDiagram\n  direction ${direction}\n  class Animal {\n    +String name\n  }\n  Animal <|-- Dog\n  Animal <|-- Cat\n`;

const glyphs = (drawn: string): string => drawn.replace(/\u001b\[[0-9;]*m/gu, "");

// `redux-color` inks each relation with its class's colour: under padless the head still takes the wall's cell.
describe("a class relation inked by its class under padless", () => {
  it.each([
    ["LR", "◁"],
    ["TB", "△"],
  ])("keeps its head (%s)", (direction, head) => {
    const drawn = glyphs(renderThemed(source(direction), { width: 80, borders: "padless" }, "redux-color"));
    expect(drawn.split(head).length - 1).toBe(2);
  });
});
