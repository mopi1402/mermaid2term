import { SECTION_SEATS } from "../../paint/theme-model.js";
import { totalValue, type TreemapNode } from "./model.js";

// mermaid's treemap renderer keys its `ordinal` scales by name: the fill's and the outline's run over `transparent`
// then the twelve `cScale` seats, the root's empty name taking the first, the text's over the twelve `cScaleLabel`
// seats. Sections are met breadth first, then the leaves depth first, every level sorted by value as d3 lays it.
export interface TreemapSeats {
  readonly fill: ReadonlyMap<TreemapNode, number>;
  readonly label: ReadonlyMap<TreemapNode, number>;
}

// The fill seat the root takes, `transparent`; seat N past it is `cScale` N - 1.
export const ROOT_SEAT = 0;
const FILL_RANGE = SECTION_SEATS + 1;
const ROOT_NAME = "";

export const byValue = (nodes: readonly TreemapNode[]): TreemapNode[] => [...nodes].sort((a, b) => totalValue(b) - totalValue(a));

const seatOf = (names: Map<string, number>, name: string): number => {
  const known = names.get(name);
  if (known !== undefined) return known;
  names.set(name, names.size);
  return names.size - 1;
};

const leavesOf = (nodes: readonly TreemapNode[]): TreemapNode[] =>
  byValue(nodes).flatMap((node) => (node.children.length > 0 ? leavesOf(node.children) : [node]));

export function treemapSeats(roots: readonly TreemapNode[]): TreemapSeats {
  const sections: TreemapNode[] = [];
  for (let level = byValue(roots); level.length > 0; level = level.flatMap((node) => byValue(node.children))) {
    sections.push(...level.filter((node) => node.children.length > 0));
  }
  const fillNames = new Map([[ROOT_NAME, ROOT_SEAT]]);
  const labelNames = new Map<string, number>();
  const fill = new Map(sections.map((node) => [node, seatOf(fillNames, node.label) % FILL_RANGE]));
  const label = new Map([...sections, ...leavesOf(roots)].map((node) => [node, seatOf(labelNames, node.label) % SECTION_SEATS]));
  return { fill, label };
}
