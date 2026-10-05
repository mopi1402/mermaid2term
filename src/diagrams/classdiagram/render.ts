import { DEFAULT_GAP } from "../../options.js";
import {
  type ClassDef,
  type ClassDiagram,
  type Relationship,
} from "./model.js";
import { widestLabelLine } from "../../text/labels.js";
import { centredAt, truncateToWidth } from "../../text/width.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import { must } from "../../must.js";
import {
  NODE,
  NODE_FAINT,
  SUBGRAPH,
} from "../../canvas/keys.js";
import { markBoxes, type StrokedBox } from "../../canvas/gradient.js";
import { BT, CLASS_PAD, MARGIN, RL, exitRuns } from "./metrics.js";
import { isHorizontal } from "../../graph/model.js";
import { boxSize, drawClassBox, drawLollipop } from "./class-box.js";
import { bandClassBox, styleClassBox } from "./styling.js";
import { boxClassProps, boxProps } from "../@common/box-diagram.js";
import { computeLayout } from "./layout.js";
import { grownForNests } from "./nests.js";
import { computeBendRanks, computeEndOffsets, detourRanks, detoursOf, heldOnRideFace, midAlong, rideRoomOf, rideRoomToward } from "./geometry.js";
import { CrossingCut } from "../../canvas/crossings.js";
import { drawRelationship, drawRelationshipLabel, selfLoopFloor, selfLoopRoom, type Ends } from "./relationships.js";
import { bandNoteBox, drawNoteBox, drawNoteTether, layoutNotes } from "./notes.js";
import { padClassBorders, slabClassBorders } from "./padless.js";
import { groundFrames } from "../@common/frames.js";
import { namesLabel } from "../../source/css.js";
import { pierceRing, seatTitle } from "../../canvas/frame-style.js";
import { slotted, type ColorSlots } from "../../paint/color-slots.js";
import { clusterFrame } from "../../canvas/shape-frame.js";

export function renderClassDiagram(
  source: ClassDiagram,
  cs: CharSet = UNICODE,
  paddingX = CLASS_PAD,
  gap = DEFAULT_GAP,
  hierarchicalNamespaces = true,
  hideEmpty = false,
  padless = false,
  budget: number | undefined = undefined,
  airyLabels = true,
  gradient = false,
  rounded = true,
  colorSlots: ColorSlots | undefined = undefined,
  borderless = false,
  filled = false
): Canvas {
  const diagram = grownForNests(source, paddingX, hideEmpty);
  const laid = computeLayout(diagram, paddingX, gap, hierarchicalNamespaces, hideEmpty, airyLabels, budget);
  if (laid.width <= 1 && diagram.notes.length === 0) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);

  const placed = layoutNotes(diagram, laid.positions, laid.sizes, gap);
  const anchor = [...laid.positions.keys()][0];
  const before = anchor === undefined ? [0, 0] : (must(laid.positions.get(anchor)));
  const after = anchor === undefined ? [0, 0] : (must(placed.positions.get(anchor)));
  const frames = laid.frames.map((frame) => ({ ...frame, x: frame.x + after[0] - before[0], y: frame.y + after[1] - before[1] }));
  const isLR = isHorizontal(diagram.direction);
  const placedLayout = { ...laid, positions: placed.positions };
  const ranks = detourRanks(diagram.relationships, laid.layerOf, (name) => (placed.positions.has(name) ? midAlong(placedLayout, name, isLR) : undefined));
  const roomed = { ...placedLayout, detours: new Map(), rideRoom: rideRoomOf(ranks, laid.layerOf, isLR) };
  const held = ranks.size === 0 ? new Map() : heldOnRideFace(diagram, roomed, isLR, ...computeEndOffsets(diagram, roomed, isLR));
  const detours = detoursOf(ranks, roomed, isLR, diagram.direction === RL || diagram.direction === BT ? -1 : 1, held);
  const layout = { ...roomed, detours };
  let width = placed.width;
  for (const frame of frames) width = Math.max(width, frame.x + frame.width + MARGIN);
  let height = Math.max(placed.height, ...frames.map((frame) => frame.y + frame.height + MARGIN));

  for (const rel of diagram.relationships) {
    if (rel.source === rel.target) {
      width = Math.max(width, selfLoopRoom(rel, layout) + MARGIN);
      height = Math.max(height, selfLoopFloor(rel, layout) + MARGIN);
      continue;
    }
    const source = layout.positions.get(rel.source);
    const target = layout.positions.get(rel.target);
    if (rel.label === "" || source === undefined || target === undefined) continue;
    const [sw] = must(layout.sizes.get(rel.source));
    const [tw] = must(layout.sizes.get(rel.target));
    const sourceMid = source[0] + Math.floor(sw / 2);
    const targetMid = target[0] + Math.floor(tw / 2);
    width = Math.max(width, Math.max(sourceMid, targetMid) + 2 + widestLabelLine(rel.label) + MARGIN);
  }

  for (const [rel, detour] of detours) {
    const far = detour.ride + (isLR && rel.label !== "" ? widestLabelLine(rel.label) + 2 : 0);
    if (isLR) width = Math.max(width, far + MARGIN);
    else height = Math.max(height, detour.ride + MARGIN);
  }

  const [offsets, arrivals] = computeEndOffsets(diagram, layout, isLR);
  const bends = computeBendRanks(diagram, layout, offsets);
  const canvas = new Canvas(width, height);
  const runs = exitRuns(diagram.relationships);
  const ends: Ends = { padless, rounded, walled: (name) => diagram.classes.get(name)?.lollipop !== true, cut: new CrossingCut() };

  for (const box of frames) clusterFrame(canvas, box.x, box.y, box.width, box.height, cs, SUBGRAPH);

  // Across the page, a relation leaving a layer turns only once past the detours riding beside it.
  const exitRun = (rel: Relationship): number => (runs.get(rel.source) ?? 2) + (isLR ? rideRoomToward(layout, rel.source, rel.target) : 0);
  diagram.relationships.forEach((rel, index) => {
    drawRelationship(canvas, rel, layout, cs, Math.trunc(offsets.get(index) ?? 0), isLR, exitRun(rel), Math.trunc(arrivals.get(index) ?? 0), bends.get(index), ends);
  });
  for (const frame of frames) pierceRing(canvas, { x: frame.x, y: frame.y, w: frame.width, h: frame.height }, cs);

  diagram.relationships.forEach((rel, index) => {
    drawRelationshipLabel(canvas, rel, layout, cs, Math.trunc(offsets.get(index) ?? 0), isLR, exitRun(rel), Math.trunc(arrivals.get(index) ?? 0), bends.get(index));
  });

  for (const frame of frames) {
    const label = truncateToWidth(frame.label, frame.width - 2);
    seatTitle(canvas, [[frame.y + 1, frame.x + centredAt(frame.width, label), label]], frame.x + 1, frame.x + frame.width - 1, true);
  }

  for (const [name, cls] of diagram.classes) {
    const at = layout.positions.get(name);
    if (at === undefined) continue;
    if (!cls.lollipop) {
      drawClassBox(canvas, at[0], at[1], cls, cs, paddingX, hideEmpty);
      continue;
    }
    const own = layout.layerOf.get(name) ?? 0;
    const partner = diagram.relationships.find((rel) => rel.source === name || rel.target === name);
    const other = partner === undefined ? name : partner.source === name ? partner.target : partner.source;
    const beside = (layout.layerOf.get(other) ?? own) === own;
    const ringAt = isLR !== beside ? "middle" : (layout.layerOf.get(other) ?? own) < own ? "first" : "last";
    drawLollipop(canvas, at[0], at[1], cls, cs, ringAt);
  }

  diagram.notes.forEach((note, index) => {
    const at = placed.notes[index];
    if (at === undefined) return;
    drawNoteBox(canvas, at[0], at[1], note, cs);
    drawNoteTether(canvas, at, note, layout.positions.get(note.target), layout.sizes.get(note.target)?.[0] ?? 0, cs);
  });

  // A colour theme's slot is the class's place among them, as mermaid's `colorIndex`, laid under its own `style`. A
  // lollipop's interface is no class in mermaid and takes none.
  const boxed = [...diagram.classes].filter(([, cls]) => !cls.lollipop);
  const slots = new Map(boxed.map(([name], at) => [name, at]));
  const dressed = (name: string, cls: ClassDef): ReadonlyMap<string, string> | undefined => slotted(colorSlots, slots.get(name), boxProps(diagram, cls));

  // The `style` lines LAST: a ground goes under what is already drawn, and the ring is recast once the edges have cut it.
  for (const [name, cls] of diagram.classes) {
    const at = layout.positions.get(name);
    const props = dressed(name, cls);
    if (at === undefined || cls.lollipop || props === undefined) continue;
    // mermaid's `classBox` lays the whole style on the words when it names none of a label's properties.
    const classed = namesLabel(props) ? boxClassProps(diagram, cls) : props;
    styleClassBox(canvas, at[0], at[1], cls, props, classed, cs, paddingX, hideEmpty);
  }

  if (padless) padClassBorders(canvas, diagram, layout.positions, placed.notes, paddingX, hideEmpty);

  // The ground LAST of all, the padless fitter included: the band has to sit at the end of a cell's key.
  for (const [name, cls] of diagram.classes) {
    const at = layout.positions.get(name);
    if (at !== undefined) bandClassBox(canvas, at[0], at[1], cls, dressed(name, cls), paddingX, hideEmpty, padless);
  }
  diagram.notes.forEach((note, index) => {
    const at = placed.notes[index];
    if (at !== undefined) bandNoteBox(canvas, at[0], at[1], note, padless);
  });

  // A slab replaces its cell's key, band and all, and stands on the ground laid around it as a graph node's does.
  if (borderless) slabClassBorders(canvas, diagram, layout.positions, placed.notes, frames, cs, paddingX, hideEmpty, filled);

  // A namespace is a cluster, so it takes the ground a subgraph takes, laid by the same pass and last of all.
  groundFrames(canvas, frames.map((frame) => ({ x: frame.x, y: frame.y, w: frame.width, h: frame.height })), padless);

  // mermaid's `neo` look: every class and every namespace stroked with a gradient of its own, over what is finished.
  // Its dividers are paths of the node, so they take it too: `neo-line` keeps them plain only where no gradient is on.
  if (gradient) {
    const boxes: StrokedBox[] = frames.map((frame) => ({ ...frame, owners: [SUBGRAPH] }));
    for (const [name, cls] of diagram.classes) {
      const at = layout.positions.get(name);
      if (at === undefined) continue;
      const [w, h] = cls.lollipop ? boxSize(cls, 0) : boxSize(cls, paddingX, hideEmpty);
      boxes.push({ x: at[0], y: at[1], width: w, height: h, owners: [NODE, NODE_FAINT] });
    }
    markBoxes(canvas, boxes);
  }
  return canvas;
}
