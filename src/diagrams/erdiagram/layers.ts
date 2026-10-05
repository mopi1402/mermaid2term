import {
  type ERDiagram,
} from "./model.js";
import { must } from "../../must.js";
import { KEY_SEP } from "./metrics.js";
import { pairKey } from "../@common/box-diagram.js";
import { tightenLayers } from "./tighten.js";

export function assignLayers(diagram: ERDiagram): string[][] {
  const names = [...diagram.entities.keys()];
  if (names.length === 0) return [];

  const children = new Map<string, string[]>(names.map((name) => [name, []]));
  const hasParent = new Set<string>();
  for (const rel of diagram.relationships) {
    children.get(rel.entity1)?.push(rel.entity2);
    hasParent.add(rel.entity2);
  }

  const neighbours = new Map<string, Set<string>>(names.map((name) => [name, new Set<string>()]));
  for (const rel of diagram.relationships) {
    if (rel.entity1 === rel.entity2) continue;
    if (!neighbours.has(rel.entity1) || !neighbours.has(rel.entity2)) continue;
    neighbours.get(rel.entity1)?.add(rel.entity2);
    neighbours.get(rel.entity2)?.add(rel.entity1);
  }

  const componentOf = new Map<string, number>();
  const components: string[][] = [];
  for (const name of names) {
    if (componentOf.has(name)) continue;
    const component: string[] = [];
    const stack = [name];
    componentOf.set(name, components.length);
    while (stack.length > 0) {
      const node = must(stack.pop());
      component.push(node);
      for (const other of neighbours.get(node) ?? []) {
        if (!componentOf.has(other)) {
          componentOf.set(other, components.length);
          stack.push(other);
        }
      }
    }
    components.push(component);
  }

  const depth = new Map<string, number>();
  const onPath = new Set<string>();
  const sink = (node: string, at: number): void => {
    const known = depth.get(node);
    if (known !== undefined && known >= at) return;
    depth.set(node, at);
    onPath.add(node);
    for (const child of children.get(node) ?? []) {
      if (!onPath.has(child)) sink(child, at + 1);
    }
    onPath.delete(node);
  };

  const walkFrom = (end: string): string[] => {
    const walk = [end];
    let previous = "";
    let current = end;
    for (;;) {
      const next = [...(neighbours.get(current) ?? [])].find((name) => name !== previous);
      if (next === undefined) return walk;
      walk.push(next);
      previous = current;
      current = next;
    }
  };
  const forwardOf = (walk: string[]): number => {
    const at = new Map(walk.map((name, index) => [name, index]));
    let count = 0;
    for (const rel of diagram.relationships) {
      const a = at.get(rel.entity1);
      const b = at.get(rel.entity2);
      if (a !== undefined && b !== undefined && a < b) count += 1;
    }
    return count;
  };

  const walkAround = (component: string[], start: string, blocked: string): string[] => {
    const walk = [start];
    let previous = blocked;
    let current = start;
    while (walk.length < component.length) {
      const next = [...(neighbours.get(current) ?? [])].find((name) => name !== previous);
      if (next === undefined) break;
      walk.push(next);
      previous = current;
      current = next;
    }
    return walk;
  };

  for (const component of components) {
    const ends = component.filter((name) => neighbours.get(name)?.size === 1);
    const isPath =
      component.length >= 2 && ends.length === 2 && component.every((name) => (neighbours.get(name)?.size ?? 0) <= 2);
    if (isPath) {
      const one = walkFrom(ends[0]);
      const other = walkFrom(ends[1]);
      const inside = diagram.relationships.filter((rel) => rel.entity1 !== rel.entity2 && component.includes(rel.entity1) && component.includes(rel.entity2)).length;
      const walk = forwardOf(one) >= forwardOf(other) ? one : other;
      if (forwardOf(walk) === inside) {
        walk.forEach((name, index) => depth.set(name, index));
        continue;
      }
    }
    const isCycle = component.length >= 3 && component.every((name) => neighbours.get(name)?.size === 2);
    if (isCycle) {
      const members = new Set(component);
      const cuts = new Set<string>();
      let best: string[] | undefined;
      for (const rel of diagram.relationships) {
        if (rel.entity1 === rel.entity2 || !members.has(rel.entity1) || !members.has(rel.entity2)) continue;
        const key = pairKey(rel.entity1, rel.entity2);
        if (cuts.has(key)) continue;
        cuts.add(key);
        for (const walk of [walkAround(component, rel.entity1, rel.entity2), walkAround(component, rel.entity2, rel.entity1)]) {
          if (walk.length !== component.length) continue;
          if (best === undefined || forwardOf(walk) > forwardOf(best)) best = walk;
        }
      }
      if (best !== undefined) {
        best.forEach((name, index) => depth.set(name, index));
        continue;
      }
    }
    if (component.length === 1 && (neighbours.get(component[0])?.size ?? 0) === 0) continue;
    let roots = component.filter((name) => !hasParent.has(name));
    if (roots.length === 0) roots = [component[0]];
    for (const root of roots) sink(root, 0);
  }

  tightenLayers(diagram, names, neighbours, depth);

  const deepest = Math.max(0, ...depth.values());
  const layers: string[][] = Array.from({ length: deepest + 1 }, () => []);
  for (const name of names) {
    const at = depth.get(name);
    if (at !== undefined) layers[at]?.push(name);
  }

  const loose = names.filter((name) => !depth.has(name));
  if (loose.length > 0) layers.push(loose);
  if (layers.some((layer) => layer.length === 0)) {
    const filled = layers.filter((layer) => layer.length > 0);
    layers.length = 0;
    layers.push(...filled);
  }

  const layerOf = new Map<string, number>();
  layers.forEach((layer, index) => {
    for (const name of layer) layerOf.set(name, index);
  });

  const riders = new Set<string>();
  for (const rel of diagram.relationships) {
    const a = layerOf.get(rel.entity1);
    const b = layerOf.get(rel.entity2);
    if (a === undefined || b === undefined) continue;
    if (Math.abs(a - b) >= 2) {
      riders.add(rel.entity1);
      riders.add(rel.entity2);
    }
  }

  const seat = new Map<string, number>();
  const ordered = layers.map((layer, index) => {
    const pull = (name: string): number => {
      const seats: number[] = [];
      for (const rel of diagram.relationships) {
        const other = rel.entity1 === name ? rel.entity2 : rel.entity2 === name ? rel.entity1 : undefined;
        if (other === undefined) continue;
        const at = seat.get(other);
        if (at !== undefined && (layerOf.get(other) ?? index) < index) seats.push(at);
      }
      if (seats.length === 0) return layer.indexOf(name);
      return seats.reduce((sum, s) => sum + s, 0) / seats.length;
    };
    const keyed = layer.map((name, born) => ({ name, born, rider: riders.has(name) ? 0 : 1, pull: pull(name) }));
    keyed.sort((a, b) => a.rider - b.rider || a.pull - b.pull || a.born - b.born);
    const arranged = orderForAdjacency(
      keyed.map((k) => k.name),
      diagram,
      layerOf,
    );
    arranged.forEach((name, at) => seat.set(name, at));
    return arranged;
  });
  return ordered;
}

function orderForAdjacency(layer: string[], diagram: ERDiagram, layerOf: Map<string, number>): string[] {
  const within = new Map<string, string[]>(layer.map((name) => [name, []]));
  for (const rel of diagram.relationships) {
    if (rel.entity1 === rel.entity2) continue;
    if (layerOf.get(rel.entity1) !== layerOf.get(rel.entity2)) continue;
    if (!within.has(rel.entity1) || !within.has(rel.entity2)) continue;
    within.get(rel.entity1)?.push(rel.entity2);
    within.get(rel.entity2)?.push(rel.entity1);
  }

  const ordered: string[] = [];
  const seen = new Set<string>();
  for (const name of layer) {
    if (seen.has(name)) continue;
    const chain = [name];
    seen.add(name);
    while (chain.length > 0) {
      const current = must(chain.shift());
      ordered.push(current);
      for (const partner of within.get(current) ?? []) {
        if (!seen.has(partner)) {
          seen.add(partner);
          chain.unshift(partner);
        }
      }
    }
  }
  return ordered;
}

export function laysFlat(diagram: ERDiagram, layers: string[][], layerOf: Map<string, number>): boolean {
  if (layers.length < 2) return false;
  const faces = new Map<string, number>();
  const claim = (name: string, face: string): boolean => {
    const key = `${name}${KEY_SEP}${face}`;
    const count = (faces.get(key) ?? 0) + 1;
    faces.set(key, count);
    return count <= 1;
  };
  for (const rel of diagram.relationships) {
    if (rel.entity1 === rel.entity2) return false;
    const a = layerOf.get(rel.entity1);
    const b = layerOf.get(rel.entity2);
    if (a === undefined || b === undefined) return false;
    if (a === b) {
      if (!claim(rel.entity1, "vertical") || !claim(rel.entity2, "vertical")) return false;
    } else if (Math.abs(a - b) >= 2) {
      if (!claim(rel.entity1, "vertical") || !claim(rel.entity2, "vertical")) return false;
      if (!claim(`${a}`, "corridor of column") || !claim(`${b}`, "corridor of column")) return false;
    } else {
      const [earlier, later] = a < b ? [rel.entity1, rel.entity2] : [rel.entity2, rel.entity1];
      if (!claim(earlier, "right") || !claim(later, "left")) return false;
    }
  }
  return true;
}
