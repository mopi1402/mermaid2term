import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { type BorderMode } from "../../src/options.js";

const MODES: readonly BorderMode[] = ["default", "padless"];

const ER = (direction: string): string => `erDiagram
  direction ${direction}
  subgraph outer
    CAR ||--o{ DRIVER : allows
    subgraph inner
      PERSON {
        string name
        int age
      }
    end
  end
  style inner stroke-dasharray: 5 5`;

// The cells either side of a frame's title: its two walls on that row.
const wallsBeside = (drawing: string, title: string): string[] => {
  const row = drawing.split("\n").find((line) => line.includes(title)) ?? "";
  const glyphs = [...row];
  const at = glyphs.indexOf(title[0]);
  const left = glyphs.slice(0, at).reverse().find((ch) => ch !== " ") ?? "";
  const right = glyphs.slice(at + title.length).find((ch) => ch !== " ") ?? "";
  return [left, right];
};

describe("a dashed frame in padless", () => {
  for (const direction of ["TB", "LR"]) {
    for (const borders of MODES) {
      it(`keeps its walls dashed, ${direction}, ${borders}`, () => {
        const drawing = render(ER(direction), { width: 120, borders });
        expect(wallsBeside(drawing, "inner")).toEqual(["╵", "╵"]);
      });
    }
  }
});
