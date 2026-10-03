import { describe, expect, it } from "vitest";

import { parseFlowchart, parseStateDiagram, render } from "../../src/index.js";
import { drawGraph } from "../../src/graph/render/draw.js";
import { DEFAULT_RENDER } from "../../src/options.js";
import { cellId, pathCells } from "../../src/canvas/geometry.js";
import { type Graph } from "../../src/graph/model.js";

const DIRECTIONS = ["TB", "BT", "LR", "RL"] as const;
const BORDERS = ["default", "padless"] as const;

interface Case {
  readonly name: string;
  readonly source: (direction: string) => string;
  readonly parse: (source: string) => Graph;
  readonly labels: readonly string[];
  readonly heads: number;
}

const CASES: readonly Case[] = [
  { name: "a loop beside a sibling run", source: (d) => `flowchart ${d}\n  C --> A\n  C --> B\n  A -- again --> A\n`, parse: parseFlowchart, labels: ["again"], heads: 3 },
  { name: "a loop on each sibling", source: (d) => `flowchart ${d}\n  C --> A\n  C --> B\n  A -- again --> A\n  B -- more --> B\n`, parse: parseFlowchart, labels: ["again", "more"], heads: 4 },
  { name: "two nested loops beside a sibling run", source: (d) => `flowchart ${d}\n  C --> A\n  C --> B\n  A -- again --> A\n  A -- more --> A\n`, parse: parseFlowchart, labels: ["again", "more"], heads: 4 },
  { name: "a loop under three runs", source: (d) => `flowchart ${d}\n  X --> A\n  Y --> A\n  Z --> A\n  A -- again --> A\n`, parse: parseFlowchart, labels: ["again"], heads: 4 },
  { name: "a state loop beside a sibling run", source: (d) => `stateDiagram-v2\n  direction ${d}\n  C --> A\n  C --> B\n  A --> A : again\n`, parse: parseStateDiagram, labels: ["again"], heads: 3 },
];

const HEADS = /[⏴⏵⏶⏷]/gu;

// A self loop keeps its own run: no cell of it, corner or stretch, is ridden or crossed by any other run.
function loopTangles(graph: Graph, borders: (typeof BORDERS)[number]): string[] {
  const drawn = drawGraph(graph, { ...DEFAULT_RENDER, borders });
  if (drawn === undefined) return ["nothing drawn"];
  const owners = new Map<string, Set<number>>();
  for (const re of drawn.routed) {
    for (const [x, y] of pathCells(re.drawPath)) {
      const key = cellId(x, y);
      owners.set(key, (owners.get(key) ?? new Set()).add(re.index));
    }
  }
  const tangles: string[] = [];
  for (const re of drawn.routed) {
    if (re.edge.source !== re.edge.target) continue;
    for (const [x, y] of pathCells(re.drawPath)) {
      const others = [...(owners.get(cellId(x, y)) ?? [])].filter((index) => index !== re.index);
      if (others.length > 0) tangles.push(`${re.edge.source} loop at ${x},${y} shared with edge ${others.join(",")}`);
    }
  }
  return tangles;
}

describe.each(CASES)("$name", ({ source, parse, labels, heads }) => {
  it.each(DIRECTIONS.flatMap((direction) => BORDERS.map((borders) => [direction, borders] as const)))("keeps clear of every other run (%s, %s)", (direction, borders) => {
    expect(loopTangles(parse(source(direction)), borders)).toEqual([]);
    const drawn = render(source(direction), { width: 80, borders });
    for (const label of labels) expect(drawn).toContain(label);
    expect(drawn).not.toContain("…");
    expect(drawn.match(HEADS)?.length).toBe(heads);
  });
});
