import { MERMAID_WRAPPING, engineOrientation, type GraphKind } from "../@common/kind.js";
import { parseStateDiagram } from "./parser.js";

const STATE_DIAGRAM_PREFIX = "stateDiagram";

export const STATE_DIAGRAM: GraphKind = {
  prefix: STATE_DIAGRAM_PREFIX,
  section: "state",
  // mermaid's whole lexer is case-insensitive, its header rule included: `STATEDIAGRAM-V2` opens a state diagram.
  declares: (text) => text.toLowerCase().startsWith(STATE_DIAGRAM_PREFIX.toLowerCase()),
  parse: parseStateDiagram,
  defaults: MERMAID_WRAPPING,
  orientation: (text, options) => engineOrientation(parseStateDiagram(text), options),
};
