import { charsetOf } from "../../canvas/charsets.js";
import { DEFAULT_RENDER } from "../../options.js";
import { declaredIn, kind, onCanvas } from "../@common/kind.js";
import { parseTreemap } from "./parser.js";
import { renderTreemap } from "./render.js";

export const TREEMAP = kind(
  "treemap",
  (text, o, budget, _direction, painting) =>
    onCanvas(renderTreemap(parseTreemap(text, declaredIn(o)), charsetOf(o.charset), o.borders ?? DEFAULT_RENDER.borders, painting !== undefined, budget)),
  { titled: true }
);
