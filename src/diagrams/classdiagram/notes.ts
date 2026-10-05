import {
  type ClassDiagram,
  type Note,
} from "./model.js";
import { writeRich } from "../../canvas/rich.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { must } from "../../must.js";
import { SPACE } from "../../text/chars.js";
import {
  EDGE,
  NOTE,
  NOTE_FILL,
  NOTE_LABEL,
} from "../../canvas/keys.js";
import { fillInterior, frame } from "../../canvas/shape-frame.js";
import { layBoxBand } from "../../canvas/fit-frame.js";
import { cornersOf } from "../../canvas/corners.js";
import { MARGIN, MIN_BOX_WIDTH, NOTE_PAD, NOTE_ROOM, NOTE_TETHER, noteLines } from "./metrics.js";
import { widestShown } from "../../source/markdown.js";

export function noteBoxSize(note: Note): [number, number] {
  const lines = noteLines(note);
  return [Math.max(widestShown(lines) + NOTE_PAD * 2, MIN_BOX_WIDTH), lines.length + 2];
}

export function drawNoteBox(canvas: Canvas, x: number, y: number, note: Note, cs: CharSet): void {
  const [width, height] = noteBoxSize(note);
  frame(canvas, x, y, width, height, cs, NOTE, cornersOf(cs, false));
  noteLines(note).forEach((line, index) => writeRich(canvas, y + 1 + index, x + NOTE_PAD, line, NOTE_LABEL));
  fillInterior(canvas, x, y, width, height, NOTE_FILL);
}

// The note's own ground, laid over its frame too: a rule carrying the page instead of the slab reads as a blank line
// cut through the note. Under `borders: padless` the side columns keep the page, as a class box's do.
export function bandNoteBox(canvas: Canvas, x: number, y: number, note: Note, padless: boolean): void {
  const [width, height] = noteBoxSize(note);
  layBoxBand(canvas, y, y + height - 1, x, x + width - 1, NOTE, padless);
}

export function drawNoteTether(
  canvas: Canvas,
  at: readonly [number, number],
  note: Note,
  target: readonly [number, number] | undefined,
  targetWidth: number,
  cs: CharSet
): void {
  if (target === undefined) return;
  const [nx, ny] = at;
  const [width] = noteBoxSize(note);
  const row = ny + 1;
  const onLeft = nx < target[0];
  const wall = onLeft ? target[0] - 1 : target[0] + targetWidth;
  const from = onLeft ? nx + width : wall;
  const to = onLeft ? wall : nx - 1;
  for (let col = from; col <= to; col++) {
    if (canvas.get(row, col) === SPACE) canvas.put(row, col, cs.lineDottedH, false, EDGE);
  }
  // A note pushed off its class's row to keep clear of a neighbour reaches it by an elbow: along its own top row to
  // the wall column, then down or up it.
  const arrival = target[1] + 1;
  if (arrival === row || wall < 0) return;
  const step = arrival > row ? 1 : -1;
  canvas.put(row, wall, onLeft ? (step > 0 ? cs.topRight : cs.bottomRight) : step > 0 ? cs.topLeft : cs.bottomLeft, false, EDGE);
  for (let r = row + step; r !== arrival; r += step) {
    if (canvas.get(r, wall) === SPACE) canvas.put(r, wall, cs.lineDottedV, false, EDGE);
  }
  if (canvas.get(arrival, wall) === SPACE) canvas.put(arrival, wall, cs.lineDottedV, false, EDGE);
}

export function layoutNotes(
  diagram: ClassDiagram,
  positions: Map<string, [number, number]>,
  sizes: Map<string, [number, number]>,
  gap: number
): { notes: Array<[number, number]>; positions: Map<string, [number, number]>; width: number; height: number } {
  const bounds = (placed: Map<string, [number, number]>): [number, number] => {
    let right = 0;
    let bottom = 0;
    for (const [name, [x, y]] of placed) {
      const [w, h] = must(sizes.get(name));
      right = Math.max(right, x + w);
      bottom = Math.max(bottom, y + h);
    }
    return [right, bottom];
  };

  if (diagram.notes.length === 0) {
    const [right, bottom] = bounds(positions);
    return { notes: [], positions, width: right + MARGIN, height: bottom + MARGIN };
  }

  const targeted: Array<[number, Note]> = [];
  const floating: Array<[number, Note]> = [];
  diagram.notes.forEach((note, index) => {
    if (note.target !== "" && positions.has(note.target)) targeted.push([index, note]);
    else floating.push([index, note]);
  });

  const shiftY = floating.length === 0 ? 0 : Math.max(...floating.map(([, note]) => noteBoxSize(note)[1])) + NOTE_ROOM;
  const shiftX = targeted.length === 0 ? 0 : Math.max(...targeted.map(([, note]) => noteBoxSize(note)[0])) + NOTE_TETHER;

  const adjusted = new Map<string, [number, number]>();
  for (const [name, [x, y]] of positions) adjusted.set(name, [x + shiftX, y + shiftY]);

  const notes: Array<[number, number]> = diagram.notes.map(() => [-1, -1]);
  let floatX = MARGIN;
  for (const [index, note] of floating) {
    notes[index] = [floatX, MARGIN];
    floatX += noteBoxSize(note)[0] + gap;
  }
  // A note is laid beside its class, and a class with a neighbour on its left has no room there: the note would be
  // drawn straight over that neighbour, which is how a class used to vanish from the drawing. Anything already on
  // those cells, a class box or a note placed before, pushes this one down until the rows it wants are its own.
  const taken: Array<[number, number, number, number]> = [];
  for (const [index, note] of floating) {
    const [nw, nh] = noteBoxSize(note);
    taken.push([notes[index][0], notes[index][1], nw, nh]);
  }
  const overlaps = (x: number, y: number, w: number, h: number): boolean => {
    for (const [name, [bx, by]] of adjusted) {
      const [bw, bh] = must(sizes.get(name));
      if (x < bx + bw && x + w > bx && y < by + bh && y + h > by) return true;
    }
    return taken.some(([tx, ty, tw, th]) => x < tx + tw && x + w > tx && y < ty + th && y + h > ty);
  };
  for (const [index, note] of targeted) {
    const [nw, nh] = noteBoxSize(note);
    const [tx, ty] = must(adjusted.get(note.target));
    const [tw] = must(sizes.get(note.target));
    const left = Math.max(MARGIN, tx - nw - NOTE_TETHER);
    const right = tx + tw + NOTE_TETHER;
    // The near side first, then the far one, and only then down: the two sides cost columns a terminal has, where a
    // note pushed down lands in the rows the edges run through.
    let [x, y] = overlaps(left, ty, nw, nh) ? (overlaps(right, ty, nw, nh) ? [left, ty] : [right, ty]) : [left, ty];
    while (overlaps(x, y, nw, nh)) y += 1;
    notes[index] = [x, y];
    taken.push([x, y, nw, nh]);
  }

  let [right, bottom] = bounds(adjusted);
  diagram.notes.forEach((note, index) => {
    const [nx, ny] = notes[index];
    const [nw, nh] = noteBoxSize(note);
    right = Math.max(right, nx + nw);
    bottom = Math.max(bottom, ny + nh);
  });

  return { notes, positions: adjusted, width: right + MARGIN, height: bottom + MARGIN };
}
