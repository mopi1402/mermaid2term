import { charsetOf } from "../../canvas/charsets.js";
import { declaredIn, kind, onCanvas } from "../@common/kind.js";
import { parseXYChart } from "./parser.js";
import { renderXYChart } from "./render.js";
import { QUOTE } from "../../source/quotes.js";

export const XY_CHART = kind("xychart", (text, o, budget) =>
  onCanvas(renderXYChart(parseXYChart(text, declaredIn(o)), charsetOf(o.charset), o.roundedEdges ?? true, budget))
,
  // Its lexer reads `title` as a keyword anywhere on a line, so the text goes between quotes where it can.
  { titled: true, section: "xyChart", titleStatement: (title) => (title.includes(QUOTE) ? `title ${title}` : `title ${QUOTE}${title}${QUOTE}`) }
);
