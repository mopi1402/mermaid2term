import { cellId } from "../../canvas/geometry.js";
import { Canvas } from "../../canvas/canvas.js";
import { BLOCK, DOWN_RUNS } from "../../canvas/alphabet.js";
import { type Graph } from "../model.js";
import { NodeShape } from "../shapes.js";
import { type CharSet } from "../../canvas/model.js";
import { cellsOfPath, type RoutedEdge } from "../routing/routed.js";
import { type GridLayout } from "../layout/grid.js";
import { drumExtent } from "../layout/padless.js";
import { DrumRim } from "../layout/laid.js";
import { ARROWHEADS, type PlacedLabel, type Point } from "../../canvas/cells.js";
import { labelLines, widestLabelLine } from "../../text/labels.js";
import { centredOffset } from "../../text/width.js";

import { type Foreign, HOME, LABEL_SEARCH, ON_THE_PAGE, REACHES, type Reach, blocksLabel, findLastTurn, fittedLabel, labelFits, labelOverlaps, seatLabel, tryPlaceLabel } from "./label-seats.js";
const MIN_VERTICAL_SEGMENT = 2;

// Whether a run that is not the label's own, standing at a cell over, under or at either end of it, would be read as
// named by it.
export type Misread = (cell: string) => boolean;
const NO_MISREAD: Misread = () => false;

// Whether a label at (row, col) would be misread as another run's.
type Crowds = (row: number, col: number) => boolean;
const UNCROWDED: Crowds = () => false;

function crowdsOf(label: string, own: ReadonlySet<string>, misread: Misread): Crowds {
  const length = widestLabelLine(label);
  const height = labelLines(label);
  const touched = (r: number, c: number): boolean => !own.has(cellId(c, r)) && misread(cellId(c, r));
  return (row, col) => {
    for (let c = col; c < col + length; c++) if (touched(row - 1, c) || touched(row + height, c)) return true;
    for (let r = row; r < row + height; r++) if (touched(r, col - 1) || touched(r, col + length)) return true;
    return false;
  };
}

function tryPlaceOnSegment(
  canvas: Canvas,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  placed: PlacedLabel[],
  prev: Point | undefined,
  preferLeft: boolean,
  biasTarget: boolean,
  head: Point,
  key: string,
  air: number,
  reach: Reach = HOME,
  foreign: Foreign = ON_THE_PAGE,
  crowds: Crowds = UNCROWDED
): boolean {
  const labelLength = widestLabelLine(label);
  const height = labelLines(label);
  const clearOfHead = (top: number): boolean => head[1] < top || head[1] >= top + height;
  // A label beside a shaft keeps off a box's ink on either end, where it would read as part of the box.
  const clearOfBoxes = (top: number, col: number): boolean => {
    for (let r = top; r < top + height; r++) if (canvas.isProtected(r, col - 1) || canvas.isProtected(r, col + labelLength)) return false;
    return true;
  };

  if (x1 === x2 && Math.abs(y2 - y1) >= MIN_VERTICAL_SEGMENT) {
    const low = Math.min(y1, y2);
    const high = Math.max(y1, y2);
    const midY = biasTarget ? y1 + Math.trunc(((y2 - y1) * 2) / 3) : Math.floor((low + high) / 2);
    if (midY === head[1]) return false;
    const midTop = midY - Math.floor((height - 1) / 2);

    let left = preferLeft;
    if (!left && prev !== undefined) {
      const [px, py] = prev;
      if (py === y1 && px !== x1) left = px > x1;
    }

    const sides: Array<[number, number]> = left
      ? [
          [midTop, x1 - labelLength - air],
          [midTop, x1 + 1 + air],
        ]
      : [
          [midTop, x1 + 1 + air],
          [midTop, x1 - labelLength - air],
        ];

    const seats: Array<[number, number]> = [...sides];
    for (let offset = 1; offset < LABEL_SEARCH; offset++) for (const [row, col] of sides) seats.push([row - offset, col], [row + offset, col]);
    const free = ([row, col]: [number, number]): boolean =>
      row >= 0 && col >= 0 && clearOfHead(row) && !crowds(row, col) && !labelOverlaps(row, col, col + labelLength, placed, height) && labelFits(canvas, row, col, label, reach, foreign);
    const first = seats.find(free);
    if (first === undefined) return false;
    // Flush against a box, a label takes a clear seat beside its shaft, its own side first, or stays where it was.
    const clear = ([row, col]: [number, number]): boolean => row >= low && row + height - 1 <= high && clearOfBoxes(row, col) && free([row, col]);
    const [row, col] = clearOfBoxes(first[0], first[1]) ? first : ([...seats.filter(([, c]) => c === first[1]), ...seats].find(clear) ?? first);
    return tryPlaceLabel(canvas, row, col, label, placed, key, reach, foreign);
  }

  if (y1 === y2) {
    const length = Math.abs(x2 - x1);
    if (length >= labelLength + 2) {
      const from = Math.min(x1, x2) + 1;
      const to = Math.max(x1, x2) - 1;
      const runCentre = (from + to) / 2;
      const freeAt = (row: number, c: number): boolean => {
        for (let r = row; r < row + height; r++) if (r < canvas.height && blocksLabel(canvas, r, c, reach, foreign)) return false;
        return true;
      };
      const placeOnRow = (row: number): boolean => {
        const windows: Array<[number, number]> = [];
        let open = -1;
        for (let c = from; c <= to + 1; c++) {
          const free = c <= to && freeAt(row, c);
          if (free && open < 0) open = c;
          if (!free && open >= 0) {
            windows.push([open, c - 1]);
            open = -1;
          }
        }
        const roomy = windows.filter(([a, b]) => b - a + 1 >= labelLength);
        roomy.sort(
          (w, v) => Math.abs((w[0] + w[1]) / 2 - runCentre) - Math.abs((v[0] + v[1]) / 2 - runCentre)
        );
        const place = (col: number): boolean => !crowds(row, col) && tryPlaceLabel(canvas, row, col, label, placed, key, reach, foreign);
        for (const [a, b] of roomy) {
          const mid = a + centredOffset(b - a + 1, labelLength);
          const last = b - labelLength + 1;
          if (place(mid)) return true;
          for (let offset = 1; mid - offset >= a || mid + offset <= last; offset++) {
            if (mid - offset >= a && place(mid - offset)) return true;
            if (mid + offset <= last && place(mid + offset)) return true;
          }
        }
        return false;
      };
      for (let away = 1; away <= LABEL_SEARCH; away++) {
        if (y1 - away - height + 1 >= 0 && placeOnRow(y1 - away - height + 1)) return true;
        if (placeOnRow(y1 + away)) return true;
      }
      return false;
    }
  }

  return false;
}

export function pierceDrumHairline(
  canvas: Canvas,
  graph: Graph,
  layout: GridLayout,
  nodeId: string,
  path: Array<[number, number]>,
  end: number,
  key: string,
  cs: CharSet
): boolean {
  const node = graph.nodes.get(nodeId);
  const seat = layout.drums.get(nodeId);
  const p = layout.placements.get(nodeId);
  if (node?.shape !== NodeShape.CYLINDER || seat === undefined || p === undefined) return false;
  const [x, y] = path[end];
  const inward = end === 0 ? 1 : end - 1;
  const [nx, ny] = path[inward];
  if (nx !== x || ny === y) return false;
  const glyph = canvas.get(y, x);
  const { top, rows } = drumExtent(seat, p.drawY, p.drawHeight);
  const hairlineRow = seat.rim === DrumRim.ABOVE ? top : top + rows - 1;
  const onHairline = y === hairlineRow && x > p.drawX && x < p.drawX + p.drawWidth - 1 && DOWN_RUNS.has(glyph);
  const facesAway = (glyph === BLOCK.upperEighth && ny > y) || (glyph === BLOCK.lowerEighth && ny < y) || (onHairline && (ny < y) === (seat.rim === DrumRim.ABOVE));
  if (!facesAway) return false;
  const further = path.length > 2 ? (path[end === 0 ? 2 : end - 2]) : undefined;
  const seen = further === undefined ? "" : canvas.get(further[1], further[0]);
  const stroke = DOWN_RUNS.has(seen) ? seen : cs.vertical;
  const ay = ny < y ? y - 1 : y + 1;
  const beside = canvas.get(ay, x);
  if (ARROWHEADS.has(beside)) {
    canvas.recast(y, x, beside);
    canvas.setStyle(y, x, canvas.getStyle(ay, x));
    canvas.put(ay, x, stroke, false, key);
    return true;
  }
  canvas.recast(y, x, stroke);
  canvas.setStyle(y, x, key);
  return true;
}

function headCell(path: Array<[number, number]>): Point {
  const end = path[path.length - 1];
  const before = path[path.length - 2];
  if (before === undefined) return end;
  return [end[0] + Math.sign(before[0] - end[0]), end[1] + Math.sign(before[1] - end[1])];
}

// A loop leaves the lid, rides over, turns down and comes back to the wall: four runs.
const SELF_LOOP_RUNS = 4;

export interface LabelSeat {
  ownRight: boolean;
  air: number;
}

export const PLAIN_SEAT: LabelSeat = { ownRight: false, air: 0 };

// A lone loop's label stands under its return, past its box's ink, on the side away from its ride, when a ring of air
// round it holds nothing but the loop itself: no run there can be taken for the one it names.
function seatUnderReturn(canvas: Canvas, re: RoutedEdge, placed: PlacedLabel[], key: string, foreign: Foreign): boolean {
  const path = re.drawPath;
  const label = re.label;
  const [rideY, turnX, backY] = [path[1][1], path[3][0], path[3][1]];
  const [headX] = headCell(path);
  const height = labelLines(label);
  const width = widestLabelLine(label);
  const away = Math.sign(backY - rideY);
  const toward = Math.sign(turnX - path[4][0]);
  if (away === 0 || toward === 0) return false;
  const row = away > 0 ? backY + 1 : backY - height;
  const inked = (c: number): boolean => canvas.get(row, c).trim() !== "";
  let edge = headX;
  while (edge >= 0 && edge < canvas.width && inked(edge)) edge += toward;
  const col = toward > 0 ? edge + 1 : edge - width;
  const own = cellsOfPath(path);
  for (let r = row - 1; r <= row + height; r++) {
    for (let c = col - 1; c <= col + width; c++) {
      if (r < 0 || c < 0 || r >= canvas.height || c >= canvas.width || own.has(cellId(c, r))) continue;
      if (blocksLabel(canvas, r, c, HOME, foreign) || labelOverlaps(r, c, c, placed)) return false;
    }
  }
  return tryPlaceLabel(canvas, row, col, label, placed, key, HOME, foreign);
}

export function drawEdgeLabel(
  canvas: Canvas,
  re: RoutedEdge,
  placed: PlacedLabel[],
  key: string,
  seat: LabelSeat,
  foreign: Foreign = ON_THE_PAGE,
  lone = false,
  misread: Misread = NO_MISREAD
): void {
  const label = re.label;
  if (label === "") return;
  const height = labelLines(label);
  const path = re.drawPath;
  const segments = path.length - 1;
  if (segments <= 0) return;

  const loop = re.edge.source === re.edge.target && segments === SELF_LOOP_RUNS;
  if (loop && lone && seatUnderReturn(canvas, re, placed, key, foreign)) return;
  const head = headCell(path);
  const lastTurn = findLastTurn(path);
  const order: number[] = [];
  // A loop's label stands beside its turn, the one run a loop nested round it leaves free, or past the turn below.
  if (loop) order.push(2);
  else if (lastTurn >= 0) {
    for (let i = lastTurn; i < segments; i++) order.push(i);
    for (let i = lastTurn - 1; i >= 0; i--) order.push(i);
  } else {
    for (let i = 0; i < segments; i++) order.push(i);
  }

  const straight = lastTurn < 0;
  const preferLeft = straight && !seat.ownRight;

  // At each reach, a seat touching no run but its own first, anywhere along the path; only then one beside another run.
  const uncrowded = crowdsOf(label, cellsOfPath(path), misread);
  for (const reach of REACHES) {
    for (const crowds of [uncrowded, UNCROWDED]) {
      for (const i of order) {
        const [x1, y1] = path[i];
        const [x2, y2] = path[i + 1];
        const prev = i > 0 ? (path[i - 1]) : undefined;
        if (tryPlaceOnSegment(canvas, x1, y1, x2, y2, label, placed, prev, preferLeft, straight, head, key, seat.air, reach, foreign, crowds)) return;
      }
    }
  }

  const [mx, my] = path[Math.floor(path.length / 2)];
  // A loop's label stands past its turn, away from its box: mirrored across the page, that is before the turn.
  const before = re.edge.source === re.edge.target && path[path.length - 1][0] > mx;
  const col = before ? mx - widestLabelLine(label) : mx + 1;
  const rows: number[] = [my - height];
  for (let off = 1; off <= LABEL_SEARCH; off++) rows.push(my - height - off, my - height + off);

  for (const reach of REACHES) {
    for (const row of rows) {
      if (row < 0 || labelOverlaps(row, col, col + widestLabelLine(label), placed, height)) continue;
      if (!labelFits(canvas, row, col, label, reach, foreign)) continue;
      seatLabel(canvas, row, col, label, key, placed);
      return;
    }
  }
  for (const row of rows) {
    if (row < 0) continue;
    const shown = fittedLabel(canvas, row, col, label);
    if (shown === "" || labelOverlaps(row, col, col + widestLabelLine(shown), placed, height)) continue;
    seatLabel(canvas, row, col, shown, key, placed);
    return;
  }
}
