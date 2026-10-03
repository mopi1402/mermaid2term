import { Canvas, DEFAULT_STYLE } from "../../canvas/canvas.js";
import { ARCS, BOX } from "../../canvas/alphabet.js";

import { type CharSet } from "../../canvas/model.js";

import { frameRoom, type GridLayout, type SubgraphBounds } from "../layout/grid.js";
import { TightAxis } from "../layout/laid.js";
import { LIGHT } from "../../canvas/arms.js";
import { BLANK_CELL, edgeKeyOutside, edgeStrokeOutside, type PlacedLabel, type Point } from "../../canvas/cells.js";
import { SLAB_LEFT, SLAB_RIGHT, facingInside, slabRing } from "./slabs.js";
import { ringCells } from "../../canvas/extent.js";
import { drawTightFrame, groundedBorders } from "./tight.js";
import { PAD_RULES } from "../../canvas/pad-glyphs.js";
import { fillBand, fillCluster } from "../../canvas/cluster.js";
import {
  ALT_TAIL, BODY_TAIL, COMPOSITE_ALT_FILL, COMPOSITE_BODY_FILL, COMPOSITE_FRAME, COMPOSITE_TITLE_FILL, SLAB_TAIL, SUBGRAPH as STYLE_SUBGRAPH,
  BAND_MARK, INK_MARK, TITLE_TAIL, inkApart,
} from "../../canvas/keys.js";
import { centredAt, displayWidth } from "../../text/width.js";
import { must } from "../../must.js";
import { labelRowsOf } from "../../text/labels.js";
import { fillFrames, inkFrame, inkRing, pierceRing, reshapeFrame, seatTitle, type FrameBox } from "../../canvas/frame-style.js";
import { slotInks, slotted, type ColorSlots } from "../../paint/color-slots.js";
import { dividerRow, frame } from "../../canvas/shape-frame.js";
import { clusterCornersOf } from "../../canvas/corners.js";

// A rule inside a padless frame keeps one blank cell between itself and the first cell the frame holds.
const TIGHT_RULE_AIR = 1;

// How far the frame's ground stands off each pair of borders. A padless border inks ONE edge of its cell: pushed
// OUT, the rest of that cell lies inside the frame and the ground reaches it; pulled IN, the cell's body is outside
// and the ground stops short. `drawTightFrame` pushes the walls out on HORIZONTAL and the rules out on VERTICAL,
// so the two insets simply swap, and a frame drawn on whole glyphs keeps its ground off both.
function groundInsets(layout: GridLayout, id: string): { walls: number; rules: number } {
  // A cluster drawn on whole glyphs inks the middle of its border cell, and its ground stops before it on both axes:
  // a frame is not a box, and nothing of the cluster shows behind the line.
  if (!tightFrame(layout, id)) return { walls: 1, rules: 1 };
  const kept = groundedBorders(layout.tightAxes.get(id) ?? TightAxis.HORIZONTAL);
  return { walls: kept.walls ? 0 : 1, rules: kept.rules ? 0 : 1 };
}

// How deep a frame stands among the frames around it, a concurrent region counting as one: mermaid flips a
// composite's body between `compositeBackground` and `altBackground` at every `doc` it reads, a region's included.
function depthOf(sb: SubgraphBounds): number {
  let depth = 0;
  for (let at = sb.subgraph.parent; at !== undefined; at = at.parent) depth++;
  return depth;
}

export function fillSubgraphs(canvas: Canvas, layout: GridLayout): void {
  // The innermost frame first: each ground is laid where no other stands yet, so a nested body keeps its own.
  const inmostFirst = [...layout.subgraphBounds].sort((a, b) => depthOf(b) - depthOf(a));
  for (const sb of inmostFirst) {
    const { walls, rules } = groundInsets(layout, sb.subgraph.id);
    fillTitleBand(canvas, sb, layout, walls, rules);
    const { subgraph } = sb;
    if (!subgraph.composite && !subgraph.concurrent) {
      fillCluster(canvas, sb.x, sb.y, sb.width, sb.height, walls, rules);
      continue;
    }
    // A concurrent region is mermaid's `divider` rect, filled as the name's band is; a composite's body is its
    // inner rect, one level on `compositeBackground` and the next on `altBackground`.
    const [fill, tail] = subgraph.concurrent
      ? [COMPOSITE_TITLE_FILL, TITLE_TAIL]
      : depthOf(sb) % 2 === 0
        ? [COMPOSITE_BODY_FILL, BODY_TAIL]
        : [COMPOSITE_ALT_FILL, ALT_TAIL];
    const left = Math.max(0, sb.x);
    const top = Math.max(0, sb.y);
    fillBand(canvas, left + walls, left + sb.width - 1 - walls, top + rules, top + sb.height - 1 - rules, fill, tail);
  }
}

// mermaid gives a composite state's name its own ground, `compositeTitleBackground`, where a flowchart subgraph's
// name stands on the cluster's: the band runs from the frame's lid down to the divider under the name, which is
// where mermaid's inner rect begins.
function fillTitleBand(canvas: Canvas, sb: SubgraphBounds, layout: GridLayout, walls: number, rules: number): void {
  const { subgraph, width, height } = sb;
  if (!subgraph.composite || subgraph.concurrent || subgraph.label === "") return;
  const { labelRow, titleRows } = frameRoom(subgraph, layout);
  if (width <= 2 || height <= labelRow + titleRows + 2) return;
  const left = Math.max(0, sb.x) + walls;
  const top = Math.max(0, sb.y);
  fillBand(canvas, left, left + width - 1 - walls * 2, top + rules, top + labelRow + titleRows, COMPOSITE_TITLE_FILL, TITLE_TAIL);
}

export function pierceSubgraphBorders(canvas: Canvas, layout: GridLayout, cs: CharSet): void {
  for (const sb of layout.subgraphBounds) pierceRing(canvas, frameBox(sb), cs);
}

export function drawSubgraphBorders(canvas: Canvas, layout: GridLayout, cs: CharSet): void {
  for (const sb of layout.subgraphBounds) {
    const w = sb.width;
    const h = sb.height;
    if (w <= 0 || h <= 0) continue;
    const x = Math.max(0, sb.x);
    const y = Math.max(0, sb.y);
    const dashed = sb.subgraph.concurrent;
    const across = dashed ? cs.lineDottedH : cs.sgHorizontal;
    const down = dashed ? cs.lineDottedV : cs.sgVertical;
    const composite = sb.subgraph.composite && !dashed;
    // A composite state is not a cluster in mermaid: its frame takes `compositeBorder`, which falls back on the
    // node's own stroke, where a subgraph takes the cluster's. A concurrent region is a composite too.
    const key = sb.subgraph.composite ? COMPOSITE_FRAME : STYLE_SUBGRAPH;

    const { tight, labelRow, titleRows } = frameRoom(sb.subgraph, layout);
    const rule = y + labelRow + titleRows;
    if (tight) {
      drawTightFrame(canvas, y, y + h - 1, x, x + w - 1, key, composite, tightVertical(layout, sb.subgraph.id));
      // The band the name stands on is ruled off from the body, the rule kept off the walls the way the
      // compartment line of a padless box is: the frame closes on its cells and the rule never touches them.
      // The rule is inked on the BOTTOM edge of the band's last row, never through the middle of it: the band's
      // ground then ends ON the line and the body's begins under it, where a centred `─` left half a cell of the
      // band showing below the rule.
      const inset = groundInsets(layout, sb.subgraph.id).walls + TIGHT_RULE_AIR;
      if (composite && sb.subgraph.label !== "" && h > labelRow + titleRows + 1 && w > inset * 2) {
        for (let c = x + inset; c < x + w - inset; c++) {
          canvas.put(rule, c, must(PAD_RULES.get(LIGHT))[0], true, key);
        }
      }
      continue;
    }

    const corners = composite ? [cs.roundTopLeft, cs.roundTopRight, cs.floorLeft, cs.floorRight] as const : clusterCornersOf(cs);
    frame(canvas, x, y, w, h, cs, key, corners, [down, down], { rules: [across, composite ? cs.dblHorizontal : across] });

    if (composite && sb.subgraph.label !== "" && h > labelRow + titleRows + 1) {
      dividerRow(canvas, rule, x, w, key, [cs.teeRight, cs.teeLeft], cs.sgHorizontal);
    }
  }
}

// A head lands ON a padless rule only where the rule is inked on the OUTER edge of its row, the head then standing
// on the free side of it. Pulled IN, the row's free side is the frame's own inside, and a head there reads as a mark
// dropped within the frame: it stops on the cell before, the way it stops before a box drawn the same way.
export function onTightRule(layout: GridLayout, id: string, isSubgraph: boolean, at: Point): boolean {
  if (!isSubgraph || !tightFrame(layout, id) || tightVertical(layout, id)) return false;
  const sb = must(layout.frameOf(id));
  const y = Math.max(0, sb.y);
  return at[1] === y || at[1] === y + sb.height - 1;
}

export function tightFrame(layout: GridLayout, id: string): boolean {
  const sb = layout.frameOf(id);
  return sb !== undefined && frameRoom(sb.subgraph, layout).tight;
}

function tightVertical(layout: GridLayout, id: string): boolean {
  return layout.tightAxes.get(id) === TightAxis.VERTICAL;
}

// mermaid centres a cluster's title over its rect, a subgraph's as a composite state's; an architecture group's
// stands at its left.
function subgraphLabelCol(sb: SubgraphBounds, layout: GridLayout, line: string): number {
  const { side } = frameRoom(sb.subgraph, layout);
  return Math.max(0, sb.x) + (sb.subgraph.titleLeft ? side : Math.max(side, centredAt(sb.width, line)));
}

// Each row of a frame's title, where it is written.
function titleLines(sb: SubgraphBounds, layout: GridLayout): Array<readonly [number, number, string]> {
  const top = subgraphLabelRow(sb, layout);
  return labelRowsOf(layout.titleOf(sb.subgraph)).map((line, at) => [top + at, subgraphLabelCol(sb, layout, line), line]);
}

function subgraphLabelRow(sb: SubgraphBounds, layout: GridLayout): number {
  return Math.max(0, sb.y) + frameRoom(sb.subgraph, layout).labelRow;
}

export function subgraphLabelSpans(layout: GridLayout): PlacedLabel[] {
  const spans: PlacedLabel[] = [];
  for (const sb of layout.subgraphBounds) {
    if (sb.width <= 0 || sb.height <= 0) continue;
    if (sb.subgraph.label === "") continue;
    for (const [row, col, line] of titleLines(sb, layout)) spans.push([row, col, col + displayWidth(line)]);
  }
  return spans;
}

export function drawSubgraphLabels(canvas: Canvas, layout: GridLayout): void {
  for (const sb of layout.subgraphBounds) {
    if (sb.width <= 0 || sb.height <= 0) continue;
    if (sb.subgraph.label === "") continue;
    const x = Math.max(0, sb.x);
    seatTitle(canvas, titleLines(sb, layout), x + 1, x + sb.width - 1, false);
  }
}

const COMPOSITE_FLOOR = BOX.doubleAcross;

export function dropSubgraphBorders(canvas: Canvas, layout: GridLayout): void {
  for (const sb of layout.subgraphBounds) {
    if (sb.width <= 0 || sb.height <= 0 || sb.subgraph.concurrent || sb.subgraph.parent !== undefined) continue;
    const key = sb.subgraph.composite ? COMPOSITE_FRAME : STYLE_SUBGRAPH;
    const slab = `${key}${SLAB_TAIL}`;
    const left = Math.max(0, sb.x);
    const top = Math.max(0, sb.y);
    const right = left + sb.width - 1;
    const bottom = top + sb.height - 1;
    const edges = { top, bottom, left, right };
    const facing = facingInside(edges);
    slabRing(canvas, ringCells(edges), {
      slabOf: (r, c) => (canvas.getStyle(r, c) !== key || canvas.isText(r, c) ? undefined : slab),
      settle: (r, c, ch) => {
        if (ARCS.has(ch)) {
          canvas.recast(r, c, BLANK_CELL);
          canvas.setStyle(r, c, DEFAULT_STYLE);
          return true;
        }
        const rule = r === top || r === bottom;
        const hole =
          (c === left && ch === BOX.teeLeft) || (c === right && ch === BOX.teeRight)
            ? BOX.across
            : rule && (ch === BOX.teeDown || ch === BOX.teeUp)
              ? BOX.down
              : undefined;
        if (hole === undefined) return false;
        canvas.recast(r, c, edgeStrokeOutside(canvas, r, c, top, bottom, left, right, hole));
        canvas.setStyle(r, c, edgeKeyOutside(canvas, r, c, top, bottom, left, right));
        return true;
      },
      half: (r, c, ch) =>
        c === left && ch === BOX.teeRight
          ? SLAB_LEFT
          : c === right && ch === BOX.teeLeft
            ? SLAB_RIGHT
            : ch === COMPOSITE_FLOOR
              ? facing.across(r, c)
              : undefined,
      ...facing,
    });
  }
}

const frameBox = (sb: SubgraphBounds): FrameBox => ({ x: Math.max(0, sb.x), y: Math.max(0, sb.y), w: sb.width, h: sb.height });

// What a subgraph's `style` and `class` lines dress it in, as mermaid dresses the cluster rect: its dashes and weight
// while its corners are still the box's own, its inks and its fill once the cluster's ground is laid.
export function reshapeSubgraphs(canvas: Canvas, layout: GridLayout, cs: CharSet): void {
  for (const sb of layout.subgraphBounds) {
    const { props } = sb.subgraph;
    if (props === undefined) continue;
    // A composite's body is mermaid's inner rect, dashed and weighted like the outer one: its lid is the divider, and
    // it goes first, while that divider still hangs from plain tees.
    const body = strokedBox(sb, layout);
    if (body.y !== frameBox(sb).y) reshapeFrame(canvas, body, props, cs);
    reshapeFrame(canvas, frameBox(sb), props, cs);
  }
}

// A composite state's `stroke` reaches its inner rect alone, the body under the divider: the band the name stands on
// is the outer rect, which mermaid's theme keeps in its own border.
function strokedBox(sb: SubgraphBounds, layout: GridLayout): FrameBox {
  const box = frameBox(sb);
  const { subgraph } = sb;
  if (!subgraph.composite || subgraph.concurrent || subgraph.label === "") return box;
  const divider = subgraphLabelRow(sb, layout) + frameRoom(subgraph, layout).titleRows;
  return divider >= box.y + box.h - 1 ? box : { ...box, y: divider, h: box.y + box.h - divider };
}

// mermaid's state `genColor` under a colour theme: a composite's two rects and a region's divider stroked in the
// slot's border, the name's band and a region's ground in its tint. A frame inside keeps its own, the inmost first.
function slotComposites(canvas: Canvas, layout: GridLayout, slots: ColorSlots): void {
  const claimed = new Set<number>();
  for (const sb of [...layout.subgraphBounds].sort((a, b) => depthOf(b) - depthOf(a))) {
    const box = frameBox(sb);
    const { colorIndex, composite, concurrent } = sb.subgraph;
    const inks = colorIndex === undefined || (!composite && !concurrent) ? undefined : slotInks(slots, colorIndex);
    const divider = strokedBox(sb, layout).y;
    if (inks !== undefined) inkRing(canvas, box, inks.stroke);
    if (inks !== undefined && divider !== box.y) {
      for (let c = box.x + 1; c < box.x + box.w - 1; c++) canvas.setStyle(divider, c, canvas.getStyle(divider, c) + INK_MARK + inks.stroke);
    }
    const tintBottom = concurrent ? box.y + box.h - 1 : divider;
    for (let r = box.y; r < Math.min(box.y + box.h, canvas.height); r++) {
      for (let c = box.x; c < Math.min(box.x + box.w, canvas.width); c++) {
        const at = r * canvas.width + c;
        if (claimed.has(at)) continue;
        claimed.add(at);
        const key = canvas.getStyle(r, c);
        const [base, ink] = inkApart(key);
        if (inks?.fill === undefined || r > tintBottom) continue;
        if (key === COMPOSITE_TITLE_FILL) canvas.setStyle(r, c, DEFAULT_STYLE + BAND_MARK + inks.fill);
        else if (base.endsWith(TITLE_TAIL)) canvas.setStyle(r, c, base.slice(0, -TITLE_TAIL.length) + ink + BAND_MARK + inks.fill);
      }
    }
  }
}

// An edge crossing a frame keeps its own ink, drawn over the cluster in mermaid.
const ownsFrame = (key: string): boolean => key.startsWith(STYLE_SUBGRAPH);

// A plain cluster's slot is laid under its own props; a composite or a region takes it in `slotComposites`.
const dressedFrame = (sb: SubgraphBounds, slots: ColorSlots | undefined): ReadonlyMap<string, string> | undefined => {
  const { colorIndex, composite, concurrent, props } = sb.subgraph;
  return composite || concurrent ? props : slotted(slots, colorIndex, props);
};

export function inkSubgraphs(canvas: Canvas, layout: GridLayout, slots?: ColorSlots): void {
  if (slots !== undefined) slotComposites(canvas, layout, slots);
  for (const sb of layout.subgraphBounds) {
    const props = dressedFrame(sb, slots);
    if (props !== undefined) inkFrame(canvas, strokedBox(sb, layout), props, subgraphLabelRow(sb, layout), ownsFrame);
  }
  fillFrames(canvas, layout.subgraphBounds.map((sb) => ({ box: frameBox(sb), fill: dressedFrame(sb, slots), ...groundInsets(layout, sb.subgraph.id) })));
}
