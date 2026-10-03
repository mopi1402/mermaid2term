// Layers laid one after another from `start`, each as thick as its thickest box with every box centred across it,
// `gapAfter` between two layers and `end` past the last. `seat` takes each box's offset; the far edge is returned.
export function stackLayered(
  layers: readonly string[][],
  thicknessOf: (name: string) => number,
  seat: (name: string, offset: number) => void,
  gapAfter: (index: number) => number,
  start: number,
  end: number
): number {
  let deep = start;
  layers.forEach((layer, index) => {
    const thickness = Math.max(...layer.map(thicknessOf));
    for (const name of layer) seat(name, deep + Math.floor((thickness - thicknessOf(name)) / 2));
    deep += thickness + (index === layers.length - 1 ? end : gapAfter(index));
  });
  return deep;
}
