import { MERMAID_WRAPPING, engineOrientation, type GraphKind } from "../@common/kind.js";
import { declaresFlowchart, parseFlowchart } from "./parser.js";

export const FLOWCHART: GraphKind = {
  prefix: "flowchart",
  section: "flowchart",
  declares: declaresFlowchart,
  parse: parseFlowchart,
  defaults: MERMAID_WRAPPING,
  orientation: (text, options) => engineOrientation(parseFlowchart(text), options),
};
