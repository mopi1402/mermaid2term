import { charsetOf } from "../../canvas/charsets.js";
import { kind, onCanvas } from "../@common/kind.js";
import { parsePieChart } from "./parser.js";
import { renderPieChart } from "./render.js";

export const PIE = kind("pie", (text, o, budget) => onCanvas(renderPieChart(parsePieChart(text), charsetOf(o.charset), budget)), {
  titled: true,
});
