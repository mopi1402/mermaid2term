import { charsetOf } from "../../canvas/charsets.js";
import { declaredIn, kind, onCanvas } from "../@common/kind.js";
import { parseGantt } from "./parser.js";
import { renderGantt } from "./render.js";

export const GANTT = kind("gantt", (text, o, budget) =>
  onCanvas(renderGantt(parseGantt(text, declaredIn(o)), charsetOf(o.charset), budget, o.displayMode === "compact"))
,
  { titled: true }
);
