import { PIE_LEGEND_TEXT, PIE_SECTION_TEXT, PIE_SLICE_PREFIX, PIE_TITLE, indexAfter } from "../canvas/keys.js";
import { seatOnPage, textOnPage } from "./sections.js";
import { PIE_SEAT_NAMES, type Ink, type Theme, seatIn } from "./theme-model.js";

const textInk = (th: Theme, ink: Ink): string => textOnPage(th, ink, th.weights.label) ?? th.label;

// A seat the theme leaves unfilled keeps the node's own ink, where a browser would paint the path black. A slice past
// the twelfth takes the first seat again, as mermaid's `scaleOrdinal` over `pie1..pie12` does.
export function pieStyles(th: Theme, keys: Iterable<string>): Array<[string, string]> {
  const weight = th.weights.node;
  const styles: Array<[string, string]> = [
    [PIE_TITLE, textInk(th, th.variables.pieTitleTextColor)],
    [PIE_SECTION_TEXT, textInk(th, th.variables.pieSectionTextColor)],
    [PIE_LEGEND_TEXT, textInk(th, th.variables.pieLegendTextColor)],
  ];
  for (const key of keys) {
    const index = indexAfter(key, PIE_SLICE_PREFIX);
    if (index === undefined) continue;
    styles.push([key, seatOnPage(th, th.variables[seatIn(PIE_SEAT_NAMES, index)], weight, th.node)]);
  }
  return styles;
}
