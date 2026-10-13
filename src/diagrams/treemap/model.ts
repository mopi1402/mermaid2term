export interface TreemapNode {
  label: string;
  value: number;
  children: TreemapNode[];
  // The `:::name` it wears, looked up in the map's `classDef`s once every row is read.
  className?: string;
}

export interface Treemap {
  roots: TreemapNode[];
  title: string;
  classDefs: Map<string, Map<string, string>>;
  // mermaid's `showValues` and `valueFormat`, `,` unless the source says otherwise.
  showValues: boolean;
  valueFormat: string;
}

export const makeTreemap = (): Treemap => ({ roots: [], title: "", classDefs: new Map(), showValues: true, valueFormat: "," });
export const makeTreemapNode = (label: string, value: number, className?: string): TreemapNode => ({
  label,
  value,
  children: [],
  ...(className === undefined ? {} : { className }),
});

export function totalValue(node: TreemapNode): number {
  if (node.children.length > 0) return node.children.reduce((sum, child) => sum + totalValue(child), 0);
  return node.value;
}

export const treemapTotal = (treemap: Treemap): number =>
  treemap.roots.reduce((sum, root) => sum + totalValue(root), 0);
