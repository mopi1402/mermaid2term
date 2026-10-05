import { DEFAULT_GAP } from "../../options.js";
import { makeEntity, makeERDiagram, type Cardinality, type EntityGroup, type ERDiagram, type Relationship, type Block, type Spot, type PinnedEnds } from "./model.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import { must } from "../../must.js";
import { Direction } from "../../graph/model.js";
import {
  NODE,
  NODE_FAINT,
  SUBGRAPH,
} from "../../canvas/keys.js";
import { NO_RANK_SPACING, PAD, type RankSpacing } from "./metrics.js";
import { drawEntityBox, weldEnd } from "./entity-box.js";
import { computeLayout } from "./layout.js";
import { planRouting, relationshipGeometry } from "./geometry.js";
import { drawRelationship, drawRelationshipLabel } from "./relationships.js";
import { CrossingCut } from "../../canvas/crossings.js";
import { drawSelfLoop } from "./self-loop.js";
import { bandEntityBoxes, dressGroupFrames, padEntityBoxes, shapeGroupFrames, slabEntityBorders, styleEntityBoxes } from "./styling.js";
import { drawPierces, planPierces } from "./pierce.js";
import { grownCanvasSize } from "./canvas-size.js";
import { framedPanel, seatPanelTitle } from "./panel.js";
import { groundFrames } from "../@common/frames.js";
import { markBoxes, type StrokedBox } from "../../canvas/gradient.js";
import { type ColorSlots } from "../../paint/color-slots.js";

export function renderERDiagram(
  diagram: ERDiagram,
  cs: CharSet = UNICODE,
  paddingX = PAD,
  gap = DEFAULT_GAP,
  lieFlat = true,
  bands = 1,
  padless = false,
  gradient = false,
  ranks: RankSpacing = NO_RANK_SPACING,
  slots?: ColorSlots,
  rounded = true,
  slabbed = false
): Canvas {
  if (diagram.groups.length === 0) {
    const drawn = renderScope(diagram, EMPTY_BLOCKS, undefined, cs, paddingX, gap, lieFlat, ranks, rounded, bands);
    styleEntityBoxes(drawn.canvas, drawn.spots, diagram, cs, slots);
    if (padless) padEntityBoxes(drawn.canvas, drawn.spots, diagram);
    bandEntityBoxes(drawn.canvas, drawn.spots, diagram, slots, padless);
    if (slabbed) slabEntityBorders(drawn, diagram, cs);
    return stroked(drawn, gradient);
  }

  const trailOfGroup = new Map<EntityGroup, EntityGroup[]>();
  const trailOfEntity = new Map<string, EntityGroup[]>();
  const byId = new Map<string, EntityGroup>();
  const walk = (groups: EntityGroup[], trail: EntityGroup[]): void => {
    for (const group of groups) {
      byId.set(group.id, group);
      trailOfGroup.set(group, trail);
      for (const name of group.entities) if (!trailOfEntity.has(name)) trailOfEntity.set(name, [...trail, group]);
      walk(group.children, [...trail, group]);
    }
  };
  walk(diagram.groups, []);
  const trailOf = (name: string): EntityGroup[] => {
    const asGroup = byId.get(name);
    if (asGroup !== undefined && !diagram.entities.has(name)) return must(trailOfGroup.get(asGroup));
    return trailOfEntity.get(name) ?? [];
  };

  interface ScopedRel {
    rel: Relationship;
    one: string | undefined;
    two: string | undefined;
  }
  const relsOf = new Map<EntityGroup | undefined, ScopedRel[]>();
  for (const rel of diagram.relationships) {
    const a = trailOf(rel.entity1);
    const b = trailOf(rel.entity2);
    let depth = 0;
    while (depth < a.length && depth < b.length && a[depth] === b[depth]) depth += 1;
    const seen = (name: string, trail: EntityGroup[]): string =>
      trail.length > depth ? trail[depth].id : name;
    const entity1 = seen(rel.entity1, a);
    const entity2 = seen(rel.entity2, b);
    if (entity1 === entity2 && rel.entity1 !== rel.entity2) continue;
    const scope = depth === 0 ? undefined : (a[depth - 1]);
    const held = relsOf.get(scope) ?? [];
    held.push({
      rel: { ...rel, entity1, entity2 },
      one: entity1 !== rel.entity1 && diagram.entities.has(rel.entity1) ? rel.entity1 : undefined,
      two: entity2 !== rel.entity2 && diagram.entities.has(rel.entity2) ? rel.entity2 : undefined,
    });
    relsOf.set(scope, held);
  }

  const renderGroup = (group: EntityGroup, parentDirection: Direction, parentDeclared: boolean): Block => {
    const direction = group.direction ?? parentDirection;
    const declared = group.direction !== undefined || parentDeclared;
    const blocks = new Map<string, Block>();
    for (const child of group.children) blocks.set(child.id, renderGroup(child, direction, declared));
    const sub = makeERDiagram();
    sub.direction = direction;
    sub.directionDeclared = declared;
    for (const name of group.entities) {
      const entity = diagram.entities.get(name);
      if (entity !== undefined) sub.entities.set(name, entity);
    }
    for (const child of group.children) sub.entities.set(child.id, makeEntity(child.id));
    const scoped = relsOf.get(group) ?? [];
    sub.relationships = scoped.map((held) => held.rel);
    return framedPanel(renderScope(sub, blocks, scoped, cs, paddingX, gap, lieFlat, ranks, rounded), group.title, cs);
  };

  const rootBlocks = new Map<string, Block>();
  for (const group of diagram.groups) {
    rootBlocks.set(group.id, renderGroup(group, diagram.direction, diagram.directionDeclared));
  }
  const root = makeERDiagram();
  root.direction = diagram.direction;
  root.directionDeclared = diagram.directionDeclared;
  for (const [name, entity] of diagram.entities) if (!trailOfEntity.has(name)) root.entities.set(name, entity);
  for (const group of diagram.groups) root.entities.set(group.id, makeEntity(group.id));
  const scoped = relsOf.get(undefined) ?? [];
  root.relationships = scoped.map((held) => held.rel);
  const drawn = renderScope(root, rootBlocks, scoped, cs, paddingX, gap, lieFlat, ranks, rounded);
  styleEntityBoxes(drawn.canvas, drawn.spots, diagram, cs, slots);
  shapeGroupFrames(drawn.canvas, drawn.frames, diagram, cs);
  if (padless) padEntityBoxes(drawn.canvas, drawn.spots, diagram);
  bandEntityBoxes(drawn.canvas, drawn.spots, diagram, slots, padless);
  if (slabbed) slabEntityBorders(drawn, diagram, cs);
  groundFrames(drawn.canvas, [...drawn.frames.values()], padless);
  dressGroupFrames(drawn.canvas, drawn.frames, diagram);
  return stroked(drawn, gradient);
}

// mermaid's `neo` look: every entity and every group stroked with a gradient of its own, over what is finished.
function stroked(drawn: { canvas: Canvas; spots: Map<string, Spot>; frames: Map<string, Spot> }, gradient: boolean): Canvas {
  if (!gradient) return drawn.canvas;
  const box = (...owners: string[]) => (spot: Spot): StrokedBox => ({ x: spot.x, y: spot.y, width: spot.w, height: spot.h, owners });
  markBoxes(drawn.canvas, [...[...drawn.spots.values()].map(box(NODE, NODE_FAINT)), ...[...drawn.frames.values()].map(box(SUBGRAPH))]);
  return drawn.canvas;
}

const EMPTY_BLOCKS: Map<string, Block> = new Map();

function renderScope(
  diagram: ERDiagram,
  blocks: Map<string, Block>,
  buried: Array<{ one: string | undefined; two: string | undefined }> | undefined,
  cs: CharSet,
  paddingX: number,
  gap: number,
  lieFlat: boolean,
  ranks: RankSpacing,
  rounded: boolean,
  bands = 1
): { canvas: Canvas; spots: Map<string, Spot>; frames: Map<string, Spot> } {
  const blockSizes =
    blocks.size === 0
      ? undefined
      : new Map([...blocks].map(([name, held]) => [name, [held.panel.width, held.panel.height] satisfies [number, number]]));
  let pinned: Map<number, PinnedEnds> | undefined;
  if (buried !== undefined && buried.length > 0) {
    pinned = new Map();
    buried.forEach((ends, index) => {
      const rel = diagram.relationships[index];
      const oneSpot = ends.one === undefined ? undefined : (blocks.get(rel.entity1)?.spots.get(ends.one) ?? undefined);
      const twoSpot = ends.two === undefined ? undefined : (blocks.get(rel.entity2)?.spots.get(ends.two) ?? undefined);
      const one = oneSpot === undefined ? undefined : { spot: oneSpot, name: must(ends.one) };
      const two = twoSpot === undefined ? undefined : { spot: twoSpot, name: must(ends.two) };
      if (one !== undefined || two !== undefined) (must(pinned)).set(index, { one, two });
    });
    if (pinned.size === 0) pinned = undefined;
  }
  const layout = computeLayout(diagram, paddingX, gap, lieFlat, bands, blockSizes, pinned, ranks);
  if (layout.width <= 1) return { canvas: new Canvas(EMPTY_SIZE, EMPTY_SIZE), spots: new Map(), frames: new Map() };

  const isLR = layout.isLR;
  const offsets = layout.offsets;
  const plan = planRouting(diagram, layout, offsets, isLR);

  if (pinned !== undefined) pinned = planPierces(diagram, blocks, layout, offsets, plan, pinned, isLR);

  const [width, height] = grownCanvasSize(diagram, layout, offsets, pinned, isLR);
  // Lines before boxes, so a box always covers the line reaching it.
  const canvas = new Canvas(width, height);
  const cut = new CrossingCut();

  diagram.relationships.forEach((rel, index) => {
    const pin = pinned?.get(index);
    drawRelationship(
      canvas,
      rel,
      index,
      layout,
      plan,
      offsets,
      cs,
      rounded,
      isLR,
      { one: (pin?.one ?? undefined) !== undefined, two: (pin?.two ?? undefined) !== undefined },
      pin ?? undefined,
      cut
    );
  });

  diagram.relationships.forEach((rel, index) => {
    drawRelationshipLabel(canvas, rel, index, layout, plan, offsets, isLR, pinned?.get(index) ?? undefined);
  });

  for (const [name, entity] of diagram.entities) {
    const at = layout.positions.get(name);
    if (at === undefined) continue;
    const held = blocks.get(name);
    if (held !== undefined) canvas.stamp(held.panel, at[1], at[0]);
    else drawEntityBox(canvas, at[0], at[1], entity, cs, paddingX, gap, layout.airy, layout.sizes.get(name));
  }

  diagram.relationships.forEach((rel, index) => {
    if (rel.entity1 === rel.entity2)
      drawSelfLoop(canvas, rel, index, layout, diagram, cs, rounded, blocks.has(rel.entity1) ? SUBGRAPH : NODE);
  });

  if (pinned !== undefined) drawPierces(canvas, diagram, layout, offsets, plan, pinned, isLR, cs);

  diagram.relationships.forEach((rel, index) => {
    const pin = pinned?.get(index);
    const g = relationshipGeometry(rel, index, layout, plan, offsets, isLR, pin ?? undefined);
    if (g === undefined) return;
    const skip1 = (pin?.one ?? undefined) !== undefined;
    const skip2 = (pin?.two ?? undefined) !== undefined;
    const tintOf = (name: string): string => (blocks.has(name) ? SUBGRAPH : NODE);
    const weld = (row: number, col: number, tee: string, card: Cardinality, tint: string): void => weldEnd(canvas, cs, row, col, tee, card, tint, true);
    if (g.corridor !== undefined) {
      if (g.horizontal) {
        if (!skip1) weld(g.startRow + 1, g.startCol, cs.teeUp, rel.card1, tintOf(rel.entity1));
        if (!skip2) weld(g.endRow + 1, g.endCol, cs.teeUp, rel.card2, tintOf(rel.entity2));
      } else {
        if (!skip1) weld(g.startRow, g.startCol + 1, cs.teeLeft, rel.card1, tintOf(rel.entity1));
        if (!skip2) weld(g.endRow, g.endCol + 1, cs.teeLeft, rel.card2, tintOf(rel.entity2));
      }
      return;
    }
    if (g.horizontal) {
      if (!skip1) weld(g.startRow, g.forward ? g.startCol - 1 : g.startCol + 1, g.forward ? cs.teeRight : cs.teeLeft, rel.card1, tintOf(rel.entity1));
      if (!skip2) weld(g.endRow, g.forward ? g.endCol + 1 : g.endCol - 1, g.forward ? cs.teeLeft : cs.teeRight, rel.card2, tintOf(rel.entity2));
    } else {
      if (!skip1) weld(g.forward ? g.startRow - 1 : g.startRow + 1, g.startCol, g.forward ? cs.teeDown : cs.teeUp, rel.card1, tintOf(rel.entity1));
      if (!skip2) weld(g.forward ? g.endRow + 1 : g.endRow - 1, g.endCol, g.forward ? cs.teeUp : cs.teeDown, rel.card2, tintOf(rel.entity2));
    }
  });

  for (const [name, held] of blocks) {
    const at = layout.positions.get(name);
    if (at !== undefined) seatPanelTitle(canvas, held, at[0], at[1]);
  }

  const spots = new Map<string, Spot>();
  const frames = new Map<string, Spot>();
  for (const name of diagram.entities.keys()) {
    const at = layout.positions.get(name);
    if (at === undefined) continue;
    const [w, h] = must(layout.sizes.get(name));
    const held = blocks.get(name);
    if (held === undefined) {
      spots.set(name, { x: at[0], y: at[1], w, h });
      continue;
    }
    frames.set(name, { x: at[0], y: at[1], w, h });
    for (const [inner, spot] of held.spots) spots.set(inner, { ...spot, x: spot.x + at[0], y: spot.y + at[1] });
    for (const [inner, spot] of held.frames) frames.set(inner, { ...spot, x: spot.x + at[0], y: spot.y + at[1] });
  }
  return { canvas, spots, frames };
}
