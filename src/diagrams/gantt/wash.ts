import { EXCLUDED_BAND } from "../../canvas/keys.js";
import { excludedColumns } from "./excluded.js";
import { sectionBand } from "./ink.js";
import { layBand } from "../../canvas/band.js";
import type { Scene } from "./scene.js";
import type { Gantt } from "./model.js";

// Laid once the gridlines are up, or a tick drawn through a band resets the band's own key on that column.
export function washBands(scene: Scene, diagram: Gantt, bands: ReadonlyArray<[number, number, number]>, axisRow: number): void {
  const { canvas, scale } = scene;
  const excluded = excludedColumns(
    diagram,
    scale.earliest,
    scale.latest,
    scale.columnOf,
    scale.marginLeft + 1,
    scale.marginLeft + scale.chartWidth
  );
  for (const c of excluded) layBand(canvas, scene.chartTop, axisRow - 1, c, c, EXCLUDED_BAND);
  // An excluded day's band is already laid and stays over the section's.
  // Every band runs to the chart's last column, where its rule and the axis stop.
  for (const [si, top, bottom] of bands) layBand(canvas, top, bottom - 1, 0, scale.marginLeft + scale.chartWidth - 1, sectionBand(si), true);
}
