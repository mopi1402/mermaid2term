import { charsetOf } from "../../canvas/charsets.js";
import { DEFAULT_RENDER } from "../../options.js";
import { kind, onCanvas, overridden } from "../@common/kind.js";
import { parseKanban } from "./parser.js";
import { renderKanban } from "./render.js";

export const KANBAN = kind("kanban", (text, o, budget, _direction, painting) =>
  onCanvas(
    renderKanban(
      parseKanban(text),
      charsetOf(o.charset),
      overridden(o.paddingX, DEFAULT_RENDER.paddingX),
      overridden(o.gap, DEFAULT_RENDER.gap),
      budget,
      o.borders ?? DEFAULT_RENDER.borders,
      painting !== undefined
    )
  ),
  { fitsItself: true }
);
