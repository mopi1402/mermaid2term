import type { Timeline } from "./model.js";
import { renderTimelineHorizontal } from "./across.js";
import { renderTimelineVertical } from "./down.js";
import { WRAP } from "./metrics.js";
import { Canvas } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import { descendingCaps, narrowerFit } from "../../text/width.js";
import { LABEL } from "../../canvas/keys.js";
import { titledAbove } from "../@common/titled.js";

export { renderTimelineHorizontal } from "./across.js";
export { renderTimelineVertical } from "./down.js";

// Across text folds narrower until the budget holds it, the widest word the floor.
function narrowed(diagram: Timeline, cs: CharSet, budget: number, drawn: Canvas): Canvas {
  return narrowerFit(descendingCaps(WRAP), (cap) => renderTimelineHorizontal(diagram, cs, budget, cap), (canvas) => canvas.width, budget, drawn);
}

export function renderTimeline(diagram: Timeline, cs: CharSet = UNICODE, budget?: number, autoRotate = true, autoWrap = true): Canvas {
  return titledAbove(untitled(diagram, cs, budget, autoRotate, autoWrap), diagram.title, { key: LABEL, left: undefined, budget });
}

function untitled(diagram: Timeline, cs: CharSet, budget: number | undefined, autoRotate: boolean, autoWrap: boolean): Canvas {
  if (diagram.direction === "TD") return renderTimelineVertical(diagram, cs, budget);

  const across = renderTimelineHorizontal(diagram, cs, budget);
  if (budget === undefined || across.width <= budget) return across;
  const folded = autoWrap ? narrowed(diagram, cs, budget, across) : across;
  // Mermaid never turns, so the default turns down only once even the tightest fold overflows.
  if (diagram.direction === "LR" || !autoRotate || folded.width <= budget) return folded;
  return renderTimelineVertical(diagram, cs, budget);
}
