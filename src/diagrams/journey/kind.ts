import { charsetOf } from "../../canvas/charsets.js";
import { DEFAULT_RENDER } from "../../options.js";
import { kind, onCanvas, overridden } from "../@common/kind.js";
import { parseJourney } from "./parser.js";
import { renderJourney } from "./render.js";

export const JOURNEY = kind("journey", (text, o, budget, _direction, painting) =>
  onCanvas(
    renderJourney(
      parseJourney(text),
      charsetOf(o.charset),
      overridden(o.paddingX, DEFAULT_RENDER.paddingX),
      overridden(o.gap, DEFAULT_RENDER.gap),
      o.roundedEdges ?? true,
      budget,
      o.autoWrap ?? DEFAULT_RENDER.autoWrap,
      o.borders ?? DEFAULT_RENDER.borders,
      painting !== undefined
    )
  ),
  { titled: true, fitsItself: true }
);
