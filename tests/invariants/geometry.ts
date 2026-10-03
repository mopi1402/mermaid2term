import { EdgeStyle } from "../../src/graph/model.js";
import { parseFlowchart } from "../../src/diagrams/flowchart/parser.js";
import { type GridLayout } from "../../src/graph/layout/grid.js";
import { type RoutedEdge } from "../../src/graph/routing/routed.js";
import { drawGraph } from "../../src/graph/render/draw.js";
import { DEFAULT_RENDER, type BorderMode } from "../../src/options.js";
import type { Canvas } from "../../src/canvas/canvas.js";
import { PADDING_Y, RUNGS, type Rung } from "./rungs.js";
import { cellId, segmentCells } from "../../src/canvas/geometry.js";
import { ACROSS_RUNS, DOWN_RUNS } from "../../src/canvas/alphabet.js";
import { HEADS, type Feed } from "../../src/canvas/glyphs.js";

export { RUNGS, type Rung } from "./rungs.js";

const CHECKED_BORDERS = ["padless", "default"] as const satisfies readonly BorderMode[];
type Borders = (typeof CHECKED_BORDERS)[number];

export interface Drawing {
  borders: Borders;
  gap: number;
  paddingX: number;
  layout: GridLayout;
  routed: RoutedEdge[];
  canvas: Canvas;
}

export const rungOf = (d: Drawing): string => `${d.borders} gap=${d.gap} paddingX=${d.paddingX}`;

export function* drawings(source: string, rungs: readonly Rung[] = RUNGS): Generator<Drawing> {
  for (const borders of CHECKED_BORDERS) {
    for (const { gap, paddingX } of rungs) {
      let graph;
      try {
        graph = parseFlowchart(source);
      } catch {
        return;
      }
      const drawn = drawGraph(graph, { ...DEFAULT_RENDER, paddingX, paddingY: PADDING_Y, gap, snugFrames: true, borders });
      if (drawn === undefined) continue;
      yield { borders, gap, paddingX, ...drawn };
    }
  }
}

export function mergedCells({ layout, routed }: Drawing): string[] {
  const boxed = new Set<string>();
  for (const p of layout.placements.values()) {
    for (let y = p.drawY; y < p.drawY + p.drawHeight; y++) {
      for (let x = p.drawX; x < p.drawX + p.drawWidth; x++) boxed.add(cellId(x, y));
    }
  }
  const claims = new Map<string, Set<string>>();
  for (const re of routed) {
    if (re.edge.style === EdgeStyle.INVISIBLE) continue;
    const name = `${re.edge.source}->${re.edge.target}`;
    const path = re.drawPath;
    for (let i = 1; i < path.length; i++) {
      const [x1, y1] = path[i - 1];
      const [x2, y2] = path[i];
      const axis = y1 === y2 ? "along the row" : "down the column";
      for (const [x, y] of segmentCells([x1, y1], [x2, y2])) {
        if (boxed.has(cellId(x, y))) continue;
        const key = `cell ${x},${y} ${axis}`;
        const owners = claims.get(key) ?? new Set<string>();
        owners.add(name);
        claims.set(key, owners);
      }
    }
  }
  return [...claims.entries()]
    .filter(([, owners]) => owners.size > 1)
    .map(([key, owners]) => `${key} shared by ${[...owners].join(" and ")}`);
}

function* heads(canvas: Canvas): Generator<{ glyph: string; feed: Feed; r: number; c: number }> {
  for (let r = 0; r < canvas.height; r++) {
    for (let c = 0; c < canvas.width; c++) {
      const glyph = canvas.get(r, c);
      const feed = HEADS.get(glyph);
      if (feed !== undefined) yield { glyph, feed, r, c };
    }
  }
}

export function badlyFedHeads(canvas: Canvas): string[] {
  const out: string[] = [];
  for (const { glyph, feed, r, c } of heads(canvas)) {
    const fed = canvas.get(r + feed.dr, c + feed.dc);
    if (!feed.allowed.has(fed)) out.push(`head ${glyph} at line ${r + 1}, column ${c + 1} is fed by '${fed}'`);
  }
  return out;
}

export function piercedHeads(canvas: Canvas): string[] {
  const out: string[] = [];
  for (const { glyph, feed, r, c } of heads(canvas)) {
    const pierced =
      feed.dc === 0
        ? ACROSS_RUNS.has(canvas.get(r, c - 1)) && ACROSS_RUNS.has(canvas.get(r, c + 1))
        : DOWN_RUNS.has(canvas.get(r - 1, c)) && DOWN_RUNS.has(canvas.get(r + 1, c));
    if (pierced) out.push(`head ${glyph} at line ${r + 1}, column ${c + 1} has a line running through it`);
  }
  return out;
}
