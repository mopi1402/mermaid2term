import { describe, expect, it } from "vitest";
import { render } from "../../src/index.js";
import { HEADS } from "../../src/canvas/glyphs.js";
import { THREE_PANES } from "../support/drawn.js";

// Every head the drawing holds, with what stands right behind it.
const unfed = (drawing: string): string[] => {
  const rows = drawing.split("\n").map((row) => [...row]);
  return rows.flatMap((row, r) =>
    row.flatMap((glyph, c) => {
      const feed = HEADS.get(glyph);
      if (feed === undefined) return [];
      const fed = rows[r + feed.dr]?.[c + feed.dc] ?? " ";
      return feed.allowed.has(fed) ? [] : [`${glyph} at ${r + 1}:${c + 1} fed by '${fed}'`];
    })
  );
};

const CASES: Record<string, Record<"TD" | "LR", string>> = {
  "a bare node pointing at a frame": {
    TD: "flowchart TB\n  A --> TOP\n  subgraph TOP\n    x\n  end\n  TOP --> B\n",
    LR: "flowchart LR\n  A --> TOP\n  subgraph TOP\n    x\n  end\n  TOP --> B\n",
  },
  "an edge inside a subgraph laid against the flow": {
    TD: "flowchart TB\n  subgraph B2\n    direction BT\n    i2 --> f2\n  end\n",
    LR: "flowchart LR\n  subgraph B2\n    direction RL\n    i2 --> f2\n  end\n",
  },
  "a frame pointing at its sibling across the flow": {
    TD: "flowchart LR\n  subgraph TOP\n    direction TB\n    subgraph B1\n      a\n    end\n    subgraph B2\n      b\n    end\n  end\n  B1 --> B2\n",
    LR: "flowchart TB\n  subgraph TOP\n    direction LR\n    subgraph B1\n      a\n    end\n    subgraph B2\n      b\n    end\n  end\n  B1 --> B2\n",
  },
};

describe("no arrow is ever a single cell: every head stands on a shaft of its own", () => {
  for (const [what, sources] of Object.entries(CASES)) {
    it.each(["TD", "LR"] as const)(`${what}, direction %s`, (direction) => {
      for (const borders of ["default", "padless", "borderless"] as const) {
        for (const width of THREE_PANES) expect(unfed(render(sources[direction], { width, borders }))).toEqual([]);
      }
    });
  }

  it("the nested directions of mermaid's gallery, every head carried", () => {
    const source =
      "flowchart TB\n  subgraph TOP\n    direction TB\n    subgraph B1\n        direction RL\n        i1 -->f1\n    end\n    subgraph B2\n        direction BT\n        i2 -->f2\n    end\n  end\n  A --> TOP --> B\n  B1 --> B2\n";
    for (const borders of ["default", "padless", "borderless"] as const) expect(unfed(render(source, { width: 80, borders }))).toEqual([]);
  });
});
