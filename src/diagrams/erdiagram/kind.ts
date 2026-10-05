import { charsetOf } from "../../canvas/charsets.js";
import { Direction } from "../../graph/model.js";
import { DEFAULT_RENDER, rowsPastGap } from "../../options.js";
import { borderlessIn, declaredIn, kind, onCanvas, overridden, padlessIn, STILL } from "../@common/kind.js";
import { parseERDiagram } from "./parser.js";
import { renderERDiagram } from "./render.js";

const PREFIX = "erDiagram";
const SECTION = "er";

export const ER_DIAGRAM = kind(
  PREFIX,
  (text, o, _budget, direction, painting) =>
    onCanvas(
      renderERDiagram(
        parseERDiagram(text, declaredIn(o)),
        charsetOf(o.charset),
        overridden(o.paddingX, DEFAULT_RENDER.paddingX),
        overridden(o.nodeGap ?? o.gap, DEFAULT_RENDER.gap),
        direction !== Direction.TB,
        o.bands ?? DEFAULT_RENDER.bands,
        padlessIn(o),
        painting?.gradient === true,
        {
          gap: o.rankGap ?? o.gap ?? DEFAULT_RENDER.gap,
          rankRows: rowsPastGap(o.rankGap ?? DEFAULT_RENDER.gap),
          stackRows: rowsPastGap(o.nodeGap ?? DEFAULT_RENDER.gap),
        },
        painting?.colorSlots,
        o.roundedEdges ?? DEFAULT_RENDER.roundedEdges,
        borderlessIn(o) && painting !== undefined
      )
    ),
  {
    section: SECTION,
    orientation: (text, options) =>
      parseERDiagram(text, declaredIn(options)).directionDeclared ? STILL : { start: undefined, turns: options.autoRotate ?? DEFAULT_RENDER.autoRotate },
  }
);
