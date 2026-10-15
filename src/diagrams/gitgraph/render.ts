import type { GitGraph } from "./model.js";
import { Canvas, EMPTY_SIZE } from "../../canvas/canvas.js";
import { type CharSet } from "../../canvas/model.js";
import { UNICODE } from "../../canvas/charsets.js";
import { LABEL } from "../../canvas/keys.js";
import { titledAbove } from "../@common/titled.js";
import { drawHorizontal } from "./horizontal.js";
import { drawVertical } from "./vertical.js";

export function renderGitGraph(diagram: GitGraph, cs: CharSet = UNICODE, budget?: number, rounded = true): Canvas {
  if (diagram.commits.length === 0) return new Canvas(EMPTY_SIZE, EMPTY_SIZE);
  const vertical = diagram.direction === "TB" || diagram.direction === "BT";
  const graph = vertical ? drawVertical(diagram, cs, diagram.direction === "BT", rounded) : drawHorizontal(diagram, cs, rounded);
  return titledAbove(graph, diagram.title, { key: LABEL, left: undefined, budget });
}
