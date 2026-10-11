import { charsetOf } from "../../canvas/charsets.js";
import { DEFAULT_RENDER } from "../../options.js";
import { declaredIn, kind, onCanvas, overridden, padlessIn } from "../@common/kind.js";
import { parsePacket } from "./parser.js";
import { renderPacket } from "./render.js";

export const PACKET = kind(
  "packet",
  (text, o, budget, _direction, painting) =>
    onCanvas(
      painting === undefined
        ? renderPacket(parsePacket(text, declaredIn(o)), charsetOf(o.charset), o.roundedEdges ?? true, overridden(o.paddingY, DEFAULT_RENDER.paddingY), budget, padlessIn(o))
        : renderPacket(parsePacket(text, declaredIn(o)), charsetOf(o.charset), undefined, undefined, budget, padlessIn(o))
    ),
  { titled: true }
);
