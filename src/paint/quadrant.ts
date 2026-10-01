import {
  QUADRANT_AXIS, QUADRANT_BORDER, QUADRANT_FILL, QUADRANT_POINT, QUADRANT_POINT_TEXT, QUADRANT_TEXT, QUADRANT_TITLE, QUADRANT_X_LABEL, QUADRANT_Y_LABEL,
  indexed,
} from "../canvas/keys.js";
import { themeRgb } from "../colour/colours.js";
import { readableStyle } from "../colour/contrast.js";
import { inked } from "./style.js";
import { pageOf } from "./mix.js";
import { textOnPage } from "./sections.js";
import { BACKGROUND } from "./tokens.js";
import { type Theme } from "./theme-model.js";

const QUADRANTS = [1, 2, 3, 4] as const;

// mermaid's quadrant chart: each quadrant's `quadrantNFill`, its name in `quadrantNTextFill`, a point and its label
// on the quadrant they stand in, the axes and the frame on their border strokes, the title and axis labels on theirs.
export function quadrantStyles(th: Theme): Array<[string, string]> {
  const v = th.variables;
  const fills: Record<(typeof QUADRANTS)[number], string | undefined> = { 1: v.quadrant1Fill, 2: v.quadrant2Fill, 3: v.quadrant3Fill, 4: v.quadrant4Fill };
  const texts: Record<(typeof QUADRANTS)[number], string | undefined> = { 1: v.quadrant1TextFill, 2: v.quadrant2TextFill, 3: v.quadrant3TextFill, 4: v.quadrant4TextFill };
  const on = (ink: string | undefined, quadrant: (typeof QUADRANTS)[number]): string =>
    [ink, fills[quadrant] === undefined ? undefined : BACKGROUND + fills[quadrant]].filter((word) => word !== undefined).join(" ");
  const readOn = (ink: string | undefined, quadrant: (typeof QUADRANTS)[number]): string =>
    on(ink === undefined || themeRgb(ink) === undefined ? ink : readableStyle(ink, themeRgb(fills[quadrant]) ?? pageOf(th)), quadrant);
  const onPage = (ink: string | undefined, weight: string): string => textOnPage(th, ink, weight) ?? inked(weight, ink);
  return [
    ...QUADRANTS.flatMap((q): Array<[string, string]> => [
      [indexed(QUADRANT_FILL, q), on(undefined, q)],
      [indexed(QUADRANT_TEXT, q), readOn(texts[q], q)],
      [indexed(QUADRANT_POINT, q), on(v.quadrantPointFill, q)],
      [indexed(QUADRANT_POINT_TEXT, q), readOn(v.quadrantPointTextFill, q)],
    ]),
    [QUADRANT_AXIS, inked(th.weights.edge, v.quadrantInternalBorderStrokeFill)],
    [QUADRANT_BORDER, inked(th.weights.edge, v.quadrantExternalBorderStrokeFill)],
    [QUADRANT_TITLE, onPage(v.quadrantTitleFill, th.weights.label)],
    [QUADRANT_X_LABEL, onPage(v.quadrantXAxisTextFill, th.weights.edgeLabel)],
    [QUADRANT_Y_LABEL, onPage(v.quadrantYAxisTextFill, th.weights.edgeLabel)],
  ];
}
