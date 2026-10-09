import { charsetOf } from "../../canvas/charsets.js";
import { DEFAULT_RENDER } from "../../options.js";
import { declaredIn, kind, onCanvas } from "../@common/kind.js";
import { parseTimeline } from "./parser.js";
import { renderTimeline } from "./render.js";

export const TIMELINE = kind("timeline", (text, o, budget) =>
  onCanvas(
    renderTimeline(
      parseTimeline(text, declaredIn(o)),
      charsetOf(o.charset),
      budget,
      o.autoRotate ?? DEFAULT_RENDER.autoRotate,
      o.autoWrap ?? DEFAULT_RENDER.autoWrap
    )
  ),
  { titled: true }
);
