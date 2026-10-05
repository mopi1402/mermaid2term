import { Canvas } from "../../canvas/canvas.js";
import { padBoxes, type PaddedBox } from "../../canvas/fit-frame.js";
import { PROP_STROKE_DASHARRAY } from "../../source/css.js";
import { boxSize, compartmentsOf } from "./class-box.js";
import { type ClassDiagram } from "./model.js";
import { noteBoxSize } from "./notes.js";
import { boxProps } from "../@common/box-diagram.js";
import { slabBorders, type SlabbedBox } from "../@common/borderless.js";
import { type CharSet } from "../../canvas/model.js";
import { NODE, NOTE } from "../../canvas/keys.js";

// The borders moved onto the cell edges, once everything else is drawn: the engine's own fitters run over the
// frames already on the canvas, a box hugging its content (a namespace moves with its ground). Each one is
// tightened under the ink it already wears, so a `style` line's colour survives the move.
export function padClassBorders(
  canvas: Canvas,
  diagram: ClassDiagram,
  positions: ReadonlyMap<string, [number, number]>,
  notes: ReadonlyArray<[number, number]>,
  paddingX: number,
  hideEmpty: boolean
): void {
  const boxes: PaddedBox[] = [];
  for (const [name, cls] of diagram.classes) {
    const at = positions.get(name);
    if (at === undefined || cls.lollipop) continue;
    const [x, y] = at;
    const [w, h] = boxSize(cls, paddingX, hideEmpty);
    const rules = compartmentsOf(cls, hideEmpty).map(({ rule }) => y + rule);
    boxes.push({ x, y, w, h, rules, dashed: boxProps(diagram, cls)?.has(PROP_STROKE_DASHARRAY) === true });
  }
  diagram.notes.forEach((note, index) => {
    const at = notes[index];
    if (at === undefined) return;
    const [w, h] = noteBoxSize(note);
    boxes.push({ x: at[0], y: at[1], w, h, rules: [], dashed: false });
  });
  padBoxes(canvas, boxes);
}

// borderless: every class box, on a theme that lays their grounds, and every note laid as a slab of its ground, as
// the graph engine lays its nodes and notes; the outermost namespaces too.
export function slabClassBorders(
  canvas: Canvas,
  diagram: ClassDiagram,
  positions: ReadonlyMap<string, [number, number]>,
  notes: ReadonlyArray<[number, number]>,
  frames: ReadonlyArray<{ x: number; y: number; width: number; height: number }>,
  cs: CharSet,
  paddingX: number,
  hideEmpty: boolean,
  filled: boolean
): void {
  const boxes: SlabbedBox[] = [];
  for (const [name, cls] of diagram.classes) {
    const at = positions.get(name);
    if (!filled || at === undefined || cls.lollipop) continue;
    const [w, h] = boxSize(cls, paddingX, hideEmpty);
    boxes.push({ x: at[0], y: at[1], w, h, key: NODE, props: boxProps(diagram, cls) });
  }
  diagram.notes.forEach((note, index) => {
    const at = notes[index];
    if (at === undefined) return;
    const [w, h] = noteBoxSize(note);
    boxes.push({ x: at[0], y: at[1], w, h, key: NOTE, props: undefined });
  });
  slabBorders(canvas, cs, boxes, filled ? frames.map((f) => ({ x: f.x, y: f.y, w: f.width, h: f.height })) : []);
}
