import { type Graph, type Node } from "../model.js";
import { computeLayout } from "../layout/passes.js";
import { contentWidthOf, labelWidthWithin, markdownWrapOf } from "../layout/boxes.js";
import { wrapOf } from "../../text/wrap.js";
import { NodeShape } from "../shapes.js";
import { DEFAULT_RENDER, type RenderOptions } from "../../options.js";
import { LITERAL_NEWLINE, labelRowsOf, titleLines, widestLabelLine } from "../../text/labels.js";
import { type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { longestWord, widestLine } from "../../text/width.js";
import { type Foldable, foldUntil } from "../../text/fold.js";

// The boxes' labels and the frames' titles a width budget folds, each keyed by its own id.
export interface FoldedLabels {
  readonly labels: ReadonlyMap<string, string>;
  readonly titles: ReadonlyMap<string, string>;
}

// The folds live on this scratch layout's labels, never on the graph: the caller hands them to the final layout, with
// the drawing of the last folds tried when they are the ones kept.
export function foldForBudget<T extends Folding>(
  graph: Graph,
  options: Partial<RenderOptions>,
  budget: number,
  draw: (folds: FoldedLabels) => T,
  titles: ReadonlyMap<string, string>
): { folds: FoldedLabels; drawing: T | undefined } {
  const { paddingX, paddingY, gap, nodeGap, rankGap, bands, borders, airyLabels, snugFrames, config } = { ...DEFAULT_RENDER, ...options };
  const padless = borders === "padless";
  const layout = computeLayout(graph, { paddingX, paddingY, gap, nodeGap, rankGap, bands, padless, airyLabels, snugFrames, wrap: wrapOf(config), markdownWrap: markdownWrapOf(config) });
  const folds = layout.labels;
  const columns = new Map<number, Node[]>();
  for (const [id, placement] of layout.placements) {
    const node = graph.nodes.get(id);
    if (node === undefined) continue;
    const at = columns.get(placement.grid.col);
    if (at === undefined) columns.set(placement.grid.col, [node]);
    else at.push(node);
  }

  const held: Array<Foldable & { node: Node; peers: Node[] }> = [];
  for (const peers of columns.values()) {
    for (const node of peers) {
      if (node.label === "" || node.shape === NodeShape.JUNCTION) continue;
      held.push({
        node,
        peers,
        original: layout.labelOf(node),
        room: 0,
        notch: 1,
        read: () => layout.labelOf(node),
        write: (text) => folds.set(node.id, text),
      });
    }
  }

  const roomOf = (h: (typeof held)[number]): number => {
    let width = 0;
    for (const peer of h.peers) {
      if (peer !== h.node) width = Math.max(width, contentWidthOf(peer, paddingX, padless, layout));
    }
    return Math.max(1, labelWidthWithin(h.node, width, paddingX, padless, layout));
  };

  // The search comes back to folds it has drawn, each undone fold among them: one drawing per set of folds.
  const widths = new Map<string, number>();
  const keyOf = (): string => JSON.stringify([...folds.values()]);
  let last: { key: string; drawing: T } | undefined;
  const measure = (): number => {
    const key = keyOf();
    const known = widths.get(key);
    if (known !== undefined) return known;
    const drawing = draw({ labels: folds, titles });
    const wide = widestLine(drawing.canvas.toString());
    widths.set(key, wide);
    last = { key, drawing };
    return wide;
  };
  foldUntil(held, budget, measure, LITERAL_NEWLINE, roomOf);
  return { folds: { labels: folds, titles }, drawing: last?.key === keyOf() ? last.drawing : undefined };
}

// What a fold redraws: the drawing's text and the frames it was laid out with.
export interface Folding {
  readonly canvas: { toString(): string };
  readonly layout: GridLayout;
}

const TITLE_ROUNDS = 6;

// The frames whose title pushes their neighbours right fold theirs first, then the frame standing furthest right: each
// on words by the cells the drawing overruns, rows balanced and never narrower than its longest word, until the budget
// holds; a fold is kept only where the drawing narrows, so a frame its boxes hold wide keeps its title on one row.
export function foldTitles<T extends Folding>(whole: T, budget: number, labels: ReadonlyMap<string, string>, draw: (folds: FoldedLabels) => T | undefined): { drawing: T; titles: ReadonlyMap<string, string> } {
  let best = whole;
  let titles: ReadonlyMap<string, string> = new Map();
  let wide = widestLine(best.canvas.toString());
  for (let round = 0; round < TITLE_ROUNDS && wide > budget; round++) {
    const { layout } = best;
    const rightOf = (sb: SubgraphBounds): number => sb.x + sb.width;
    const rightmost = Math.max(...layout.subgraphBounds.map(rightOf), ...[...layout.placements.values()].map((p) => p.drawX + p.drawWidth));
    const foldsBy = (cutOf: (sb: SubgraphBounds) => number | undefined): Map<string, string> => {
      const next = new Map(titles);
      for (const sb of layout.subgraphBounds) {
        const original = sb.subgraph.label;
        const cut = cutOf(sb);
        if (original === "" || cut === undefined) continue;
        const now = widestLabelLine(layout.titleOf(sb.subgraph));
        const whole = widestLabelLine(original);
        const rows = Math.ceil(whole / Math.max(1, now - cut));
        const foldedAt = (room: number): string[] => labelRowsOf(original).flatMap((line) => titleLines(line, room));
        let room = Math.max(longestWord(original), Math.ceil(whole / rows));
        while (room < now && foldedAt(room).length > rows) room += 1;
        if (room < now) next.set(sb.subgraph.id, foldedAt(room).join(LITERAL_NEWLINE));
      }
      return next;
    };
    const same = (next: ReadonlyMap<string, string>): boolean => [...next].every(([id, title]) => titles.get(id) === title);
    const pushed = foldsBy((sb) => {
      const spill = layout.spills.get(sb.subgraph.id);
      return rightOf(sb) < rightmost && spill !== undefined ? Math.min(spill, wide - budget) : undefined;
    });
    const next = same(pushed) ? foldsBy((sb) => (rightOf(sb) < rightmost ? undefined : Math.min(wide, rightmost) - budget)) : pushed;
    if (next.size === 0 || same(next)) break;
    const tried = draw({ labels, titles: next });
    if (tried === undefined) break;
    const narrower = widestLine(tried.canvas.toString());
    if (narrower >= wide) break;
    best = tried;
    titles = next;
    wide = narrower;
  }
  return { drawing: best, titles };
}
