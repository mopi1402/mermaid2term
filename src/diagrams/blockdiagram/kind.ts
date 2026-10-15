import { charsetOf } from "../../canvas/charsets.js";
import { DEFAULT_RENDER } from "../../options.js";
import { saysPadding } from "../../source/source.js";
import { declaredIn, kind, onCanvas, overridden } from "../@common/kind.js";
import { parseBlockDiagram } from "./parser.js";
import { renderBlockDiagram } from "./render.js";

export const BLOCK = kind("block", (text, o, _budget, _direction, painting) =>
  onCanvas(
    renderBlockDiagram(
      parseBlockDiagram(text),
      charsetOf(o.charset),
      saysPadding(declaredIn(o)) ? o.paddingX : overridden(o.paddingX, DEFAULT_RENDER.paddingX),
      overridden(o.gap, DEFAULT_RENDER.gap),
      painting?.colorSlots,
      o.roundedEdges ?? DEFAULT_RENDER.roundedEdges,
      o.borders ?? DEFAULT_RENDER.borders,
      painting !== undefined
    )
  )
);
