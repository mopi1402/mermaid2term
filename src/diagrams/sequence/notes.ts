import { type Note, type SequenceDiagram, LEFT_OF, OVER, RIGHT_OF } from "./model.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import {
  NOTE as STYLE_NOTE,
  NOTE_FILL,
  NOTE_LABEL,
  NOTE_RIM,
} from "../../canvas/keys.js";
import { NOTE_FRAME_ROWS, NOTE_OFFSET, NOTE_PAD, participantIndex, noteLines, noteWidth } from "./metrics.js";
import { drawRectangle } from "../../graph/render/boxes.js";
import { BLOCK } from "../../canvas/alphabet.js";
import { fillInterior, putCentredLines } from "../../canvas/shape-frame.js";
import { clearRect, keyBlanks } from "../../canvas/cells.js";
import { edgesOf, ringCells } from "../../canvas/extent.js";

export function drawNote(
  canvas: Canvas,
  note: Note,
  row: number,
  colCenters: number[],
  diagram: SequenceDiagram,
  cs: CharSet,
  borderless = false,
  padless = false
): void {
  const lines = noteLines(note);
  let width = noteWidth(note);
  const height = lines.length + (borderless || padless ? 0 : NOTE_FRAME_ROWS);
  let x: number;

  if (note.position === RIGHT_OF || note.position === LEFT_OF) {
    const at = participantIndex(diagram, note.participants[0]);
    if (at < 0) return;
    x =
      note.position === RIGHT_OF
        ? (colCenters[at]) + NOTE_OFFSET
        : (colCenters[at]) - NOTE_OFFSET - width;
  } else if (note.position === OVER) {
    let centre: number;
    if (note.participants.length === 2) {
      const first = participantIndex(diagram, note.participants[0]);
      const second = participantIndex(diagram, note.participants[1]);
      if (first < 0 || second < 0) return;
      centre = Math.floor(((colCenters[first]) + (colCenters[second])) / 2);
      width = Math.max(width, Math.abs((colCenters[first]) - (colCenters[second])) + NOTE_PAD);
    } else {
      const at = participantIndex(diagram, note.participants[0]);
      if (at < 0) return;
      centre = colCenters[at];
    }
    x = centre - Math.floor(width / 2);
  } else {
    return;
  }

  x = Math.max(0, x);
  clearRect(canvas, row, x, height, width);
  // The text first, its blanks then laid on the note's ground: a space between two words wears the label's key,
  // which paints no ground, and would break the band.
  const unframed = (): void => {
    putCentredLines(canvas, row, x, width, lines, NOTE_LABEL);
    keyBlanks(canvas, row, x, height, width, NOTE_FILL);
  };
  if (borderless) {
    unframed();
    return;
  }
  if (padless) {
    // No frame row at all: the walls ink the OUTER edge of the text row's own end cells, so a note of one line
    // stands one line tall and its ink closes the fill it carries instead of standing a sliver inside it.
    unframed();
    for (let r = row; r < row + height; r++) {
      canvas.recast(r, x, BLOCK.leftEighth);
      canvas.setStyle(r, x, NOTE_RIM);
      canvas.recast(r, x + width - 1, BLOCK.rightEighth);
      canvas.setStyle(r, x + width - 1, NOTE_RIM);
    }
    return;
  }
  drawRectangle(canvas, x, row, width, height, note.text, cs, STYLE_NOTE, NOTE_LABEL);
  // The frame stands on the note's own ground, as it does in a graph drawing and in a class diagram: no page
  // shows between the fill and the line around it, the way mermaid strokes a rect it has filled.
  for (const [r, c] of ringCells(edgesOf({ x, y: row, w: width, h: height }))) canvas.setStyle(r, c, NOTE_RIM);
  fillInterior(canvas, x, row, width, height, NOTE_FILL);
}
