import { serpentineBands } from "../../graph/layout/passes.js";

export interface FoldedChain {
  layers: string[][];
  slots: Map<string, number>;
}

// A lone chain laid across the page folds into `bands` rows of ceil(n / bands), as the graph's `foldChain` does,
// every other row turned back so each link stays short.
export function foldChainIntoBands(layers: string[][], layerOf: Map<string, number>, bands: number): FoldedChain | undefined {
  const walk = layers.map((layer) => layer[0]);
  if (bands <= 1 || bands >= walk.length) return undefined;
  const slots = new Map<string, number>();
  const folded: string[][] = [];
  for (const band of serpentineBands(walk, Math.ceil(walk.length / bands), true)) {
    band.forEach((name, slot) => {
      if (name !== undefined) slots.set(name, slot);
    });
    folded.push(band.filter((name) => name !== undefined));
  }
  layerOf.clear();
  folded.forEach((layer, index) => {
    for (const name of layer) layerOf.set(name, index);
  });
  return { layers: folded, slots };
}
