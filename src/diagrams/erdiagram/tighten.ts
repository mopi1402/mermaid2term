import { type ERDiagram } from "./model.js";
import { must } from "../../must.js";

export function tightenLayers(
  diagram: ERDiagram,
  names: string[],
  neighbours: Map<string, Set<string>>,
  depth: Map<string, number>
): void {
for (;;) {
  const group = new Map<string, number>();
  let groups = 0;
  for (const name of names) {
    if (!depth.has(name) || group.has(name)) continue;
    const members = [name];
    group.set(name, groups);
    while (members.length > 0) {
      const node = must(members.pop());
      for (const other of neighbours.get(node) ?? []) {
        if (group.has(other) || !depth.has(other)) continue;
        if (Math.abs((must(depth.get(other))) - (must(depth.get(node)))) <= 1) {
          group.set(other, groups);
          members.push(other);
        }
      }
    }
    groups += 1;
  }
  let moved = false;
  for (let g = 0; g < groups && !moved; g++) {
    let down = 0;
    let up = 0;
    let slide = Infinity;
    for (const rel of diagram.relationships) {
      if (rel.entity1 === rel.entity2) continue;
      const ga = group.get(rel.entity1);
      const gb = group.get(rel.entity2);
      if (ga === undefined || gb === undefined || (ga === g) === (gb === g)) continue;
      const inside = ga === g ? rel.entity1 : rel.entity2;
      const outside = ga === g ? rel.entity2 : rel.entity1;
      const gap = (must(depth.get(outside))) - (must(depth.get(inside)));
      if (gap > 1) {
        down += 1;
        slide = Math.min(slide, gap - 1);
      } else up += 1;
    }
    if (down > up && slide !== Infinity) {
      for (const [name, at] of group) if (at === g) depth.set(name, (must(depth.get(name))) + slide);
      moved = true;
    }
  }
  if (!moved) break;
}
}
