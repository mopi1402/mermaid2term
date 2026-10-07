import { charsetOf } from "../../canvas/charsets.js";
import { DEFAULT_RENDER } from "../../options.js";
import { declaredIn, kind, onCanvas, overridden, padlessIn } from "../@common/kind.js";
import { parseSequenceDiagram } from "./parser.js";
import { renderSequence } from "./render.js";

const SECTION = "sequence";

export const SEQUENCE = kind("sequenceDiagram", (text, o, budget, _direction, painting) =>
  onCanvas(
    renderSequence(
      parseSequenceDiagram(text, declaredIn(o)),
      charsetOf(o.charset),
      overridden(o.paddingX, DEFAULT_RENDER.paddingX),
      overridden(o.gap, DEFAULT_RENDER.gap),
      o.wrapLabels === true ? budget : undefined,
      (o.borders ?? DEFAULT_RENDER.borders) === "borderless",
      o.mirrorActors ?? DEFAULT_RENDER.mirrorActors,
      painting?.heavyLifeline,
      painting?.actorsFilled,
      padlessIn(o),
      budget,
      o.roundedEdges ?? DEFAULT_RENDER.roundedEdges
    )
  ),
  { titled: true, section: SECTION }
);
