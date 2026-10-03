import { Canvas } from "../../canvas/canvas.js";
import { SOLID_ACROSS, armsOf } from "../../canvas/alphabet.js";
import { DOUBLE, HEAVY, LIGHT, NONE, weightedGlyph, type Weight } from "../../canvas/arms.js";
import { EdgeStyle, type Graph } from "../model.js";
import { NodeShape } from "../shapes.js";
import { type RoutedEdge } from "../routing/routed.js";
import { midCol, midRow, type GridLayout } from "../layout/grid.js";
import { } from "../../canvas/cells.js";
import { cellId } from "../../canvas/geometry.js";
export function spaceWideMarks(canvas: Canvas, graph: Graph, layout: GridLayout): void {
  const strokes = SOLID_ACROSS;
  for (const [id, p] of layout.placements) {
    if (graph.nodes.get(id)?.shape !== NodeShape.CHOICE_STATE) continue;
    const row = midRow(p);
    const col = midCol(p) + 1;
    if (strokes.has(canvas.get(row, col))) canvas.clearChar(row, col);
  }
}

export function weighMarkFans(canvas: Canvas, layout: GridLayout, routed: RoutedEdge[]): void {
  for (const [id, placement] of layout.placements) {
    if (!placement.mark) continue;
    const leaving = routed.filter(
      (re) => re.edge.source === id && re.edge.target !== id && re.edge.style !== EdgeStyle.INVISIBLE && re.drawPath.length >= 2
    );
    if (leaving.length < 2) continue;
    const shared: Weight = leaving.length === 2 ? DOUBLE : HEAVY;

    const counts = new Map<string, [number, number, number, number]>();
    const spared = new Set<string>();
    const key = cellId;
    const bump = (x: number, y: number, dx: number, dy: number): void => {
      const k = key(x, y);
      const held = counts.get(k) ?? [0, 0, 0, 0];
      const arm = dx < 0 ? 0 : dx > 0 ? 1 : dy < 0 ? 2 : 3;
      held[arm] += 1;
      counts.set(k, held);
    };
    const mx = midCol(placement);
    const my = midRow(placement);
    spared.add(key(mx, my));
    for (const re of leaving) {
      const path = re.drawPath;
      const last = path.length - 1;
      const [ex, ey] = path[last];
      const [bx, by] = path[last - 1];
      spared.add(key(ex, ey));
      spared.add(key(ex - Math.sign(ex - bx), ey - Math.sign(ey - by)));
      const [sx, sy] = path[0];
      bump(sx, sy, Math.sign(mx - sx), Math.sign(my - sy));
      for (let i = 0; i < last; i++) {
        const [ax, ay] = path[i];
        const [tx, ty] = path[i + 1];
        const dx = Math.sign(tx - ax);
        const dy = Math.sign(ty - ay);
        if (dx === 0 && dy === 0) continue;
        let x = ax;
        let y = ay;
        while (x !== tx || y !== ty) {
          bump(x, y, dx, dy);
          x += dx;
          y += dy;
          bump(x, y, -dx, -dy);
        }
      }
    }

    const cells: Array<[number, number, [number, number, number, number]]> = [];
    for (const [k, held] of counts) {
      if (spared.has(k)) continue;
      if (!held.some((n) => n >= 2)) continue;
      const [x, y] = k.split(",").map(Number);
      const current = armsOf(canvas.get(y, x));
      if (current === undefined) continue;
      if (current.some((w, i) => w !== NONE && (held[i]) === 0)) continue;
      cells.push([x, y, held]);
    }
    const glyphsAt = (weight: Weight): Array<string | undefined> => {
      const armOf = (n: number): Weight => (n === 0 ? NONE : n === 1 ? LIGHT : weight);
      return cells.map(([, , [l, r, u, d]]) => weightedGlyph([armOf(l), armOf(r), armOf(u), armOf(d)]));
    };
    let glyphs = glyphsAt(shared);
    if (glyphs.includes(undefined)) glyphs = glyphsAt(HEAVY);
    cells.forEach(([x, y], i) => {
      const glyph = glyphs[i];
      if (glyph !== undefined && glyph !== undefined) canvas.recast(y, x, glyph);
    });
  }
}
