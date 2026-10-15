import { charsetOf } from "../../canvas/charsets.js";
import { declaredIn, kind, onCanvas } from "../@common/kind.js";
import { DIRECTIVE } from "../../source/lines.js";
import { parseGitGraph } from "./parser.js";
import { renderGitGraph } from "./render.js";

const GIT_GRAPH = "gitGraph";
const INIT_DIRECTIVE = `${DIRECTIVE}init`;

export const GITGRAPH = kind(
  GIT_GRAPH,
  (text, o, budget) => onCanvas(renderGitGraph(parseGitGraph(text, declaredIn(o)), charsetOf(o.charset), budget, o.roundedEdges ?? true)),
  {
    titled: true,
    declares: (text) => text.startsWith(GIT_GRAPH) || (text.startsWith(INIT_DIRECTIVE) && text.includes(GIT_GRAPH)),
  }
);
