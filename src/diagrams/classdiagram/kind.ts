import { charsetOf } from "../../canvas/charsets.js";
import { Direction } from "../../graph/model.js";
import { DEFAULT_RENDER } from "../../options.js";
import { borderlessIn, kind, onCanvas, overridden, padlessIn, STILL } from "../@common/kind.js";
import { parseClassDiagram } from "./parser.js";
import { renderClassDiagram } from "./render.js";

const PREFIX = "classDiagram";
const SECTION = "class";

// The direction the fit asked for, honoured only where the source named none of its own.
function headed(text: string, direction: Direction | undefined): ReturnType<typeof parseClassDiagram> {
  const diagram = parseClassDiagram(text);
  if (direction !== undefined && !diagram.directionDeclared) diagram.direction = direction;
  return diagram;
}

export const CLASS_DIAGRAM = kind(PREFIX, (text, o, budget, direction, painting) =>
  onCanvas(
    renderClassDiagram(
      headed(text, direction),
      charsetOf(o.charset),
      overridden(o.paddingX, DEFAULT_RENDER.paddingX),
      overridden(o.gap, DEFAULT_RENDER.gap),
      o.hierarchicalNamespaces ?? true,
      o.hideEmptyMembersBox ?? false,
      padlessIn(o),
      budget,
      o.airyLabels ?? DEFAULT_RENDER.airyLabels,
      painting?.gradient === true,
      o.roundedEdges ?? DEFAULT_RENDER.roundedEdges,
      painting?.colorSlots,
      borderlessIn(o),
      painting !== undefined
    )
  ),
  {
    section: SECTION,
    folds: false,
    orientation: (text, options) =>
      parseClassDiagram(text).directionDeclared ? STILL : { start: undefined, turns: options.autoRotate ?? DEFAULT_RENDER.autoRotate },
  }
);
