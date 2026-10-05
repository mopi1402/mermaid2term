import { type ClassDiagram, type Layout, type Namespace } from "./model.js";

import { must } from "../../must.js";
import { Direction, isHorizontal } from "../../graph/model.js";

import { BT, RL } from "./metrics.js";
import { held, layoutScope } from "./scopes.js";
import { packed } from "./packing.js";
import { partsOf } from "../@common/parts.js";
import { mirrorAt } from "../../graph/render/mirror.js";
import { compartmentsOf } from "./class-box.js";
import { nestPlans } from "./nests.js";

function compacted(namespaces: Namespace[]): Namespace[] {
  const flat: Namespace[] = [];
  const walk = (ns: Namespace, nearest: Namespace | undefined): void => {
    let own = nearest;
    if (ns.explicit) {
      own = { id: ns.id, label: ns.id, explicit: true, classes: [...ns.classes], children: [] };
      flat.push(own);
    } else if (own !== undefined) own.classes.push(...ns.classes);
    for (const child of ns.children) walk(child, own);
  };
  for (const ns of namespaces) walk(ns, undefined);
  return flat;
}

export function computeLayout(
  diagram: ClassDiagram,
  paddingX: number,
  gap: number,
  hierarchical: boolean,
  hideEmpty: boolean,
  airyLabels: boolean,
  budget?: number
): Layout {
  const namespaces = hierarchical ? diagram.namespaces : compacted(diagram.namespaces);
  const framed = new Set(namespaces.flatMap(held));
  const loose = [...diagram.classes.keys()].filter((name) => !framed.has(name));
  const laid = spread(diagram, loose, namespaces, paddingX, gap, hideEmpty, airyLabels, budget);
  const rules = new Map([...diagram.classes].map(([name, cls]) => [name, compartmentsOf(cls, hideEmpty).map(({ rule }) => rule)]));
  return { ...mirrored(laid, diagram.direction), rules, nests: nestPlans(diagram, paddingX, hideEmpty) };
}

// Drawn across the page, classes joined to nothing hang under one another and the width goes to waste. Each part is
// laid out on its own and the parts are then set side by side, the drawing wrapping onto a new row where the budget
// runs out. A framed diagram keeps the single scope: a namespace holds its classes wherever the layout puts them.
function spread(
  diagram: ClassDiagram,
  loose: string[],
  namespaces: Namespace[],
  paddingX: number,
  gap: number,
  hideEmpty: boolean,
  airyLabels: boolean,
  budget: number | undefined
): Layout {
  const whole = (): Layout => layoutScope(diagram, loose, namespaces, paddingX, gap, { next: 0 }, hideEmpty, airyLabels);
  if (budget === undefined || !isHorizontal(diagram.direction) || namespaces.length > 0) return whole();
  const parts = partsOf(loose, diagram.relationships.map((rel): [string, string] => [rel.source, rel.target]));
  if (parts.length < 2) return whole();
  const key = { next: 0 };
  return packed(parts.map((part) => layoutScope(diagram, part, [], paddingX, gap, key, hideEmpty, airyLabels)), budget);
}

function mirrored(layout: Layout, direction: Direction): Layout {
  if (direction !== RL && direction !== BT) return layout;
  const flipX = direction === RL;
  const positions = new Map<string, [number, number]>();
  for (const [name, [x, y]] of layout.positions) {
    const [w, h] = must(layout.sizes.get(name));
    positions.set(name, flipX ? [mirrorAt(x, w, layout.width), y] : [x, mirrorAt(y, h, layout.height)]);
  }
  const frames = layout.frames.map((frame) =>
    flipX
      ? { ...frame, x: mirrorAt(frame.x, frame.width, layout.width) }
      : { ...frame, y: mirrorAt(frame.y, frame.height, layout.height) }
  );
  const loops = flipX ? new Map([...layout.loops].map(([name, side]) => [name, -side])) : layout.loops;
  return { ...layout, positions, frames, loops };
}
