import { describe, it, expect } from "vitest";
import { render } from "../../src/index.js";
import { BORDER_MODES } from "../../src/source/config.js";

describe("a run passing a frame keeps a cell off its wall", () => {
  const source = (direction: string): string =>
    `flowchart ${direction}\n    subgraph gauche\n        A[a1] --> B[a2] --> F[a3]\n    end\n` +
    "    subgraph droite\n        C[b1] --> D[b2]\n    end\n    A --> C\n";
  const cases = ["TD", "LR"].flatMap((direction) =>
    BORDER_MODES.flatMap((borders) => [40, 80, 120].map((width) => ({ direction, borders, width })))
  );

  it.each(cases)("leaves no run against droite's wall, $direction $borders at width $width", ({ direction, borders, width }) => {
    const drawn = render(source(direction), { width, borders });
    expect(drawn).not.toMatch(/│[┌│]|│▁/u);
    const wall = borders === "padless" ? "▏" : "│";
    const walls = drawn.split("\n").filter((row) => row.includes("droite")).map((row) => row.lastIndexOf(wall, row.indexOf("droite")));
    expect(walls.every((col) => col >= 0)).toBe(true);
  });
});
