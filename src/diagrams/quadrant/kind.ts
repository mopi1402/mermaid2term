import { charsetOf } from "../../canvas/charsets.js";
import { declaredIn, kind, onCanvas } from "../@common/kind.js";
import { parseQuadrant } from "./parser.js";
import { renderQuadrant } from "./render.js";

export const QUADRANT = kind(
  "quadrantChart",
  (text, o, budget) => onCanvas(renderQuadrant(parseQuadrant(text, declaredIn(o)), charsetOf(o.charset), budget)),
  { titled: true }
);
