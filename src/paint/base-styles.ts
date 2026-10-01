import { ARROW, BOLD_LABEL, COMPOSITE_FRAME, DEFAULT_STYLE, EDGE, EDGE_HEAD, EDGE_LABEL, FAINT, ITALIC_LABEL, LABEL, NODE, PACKET_TITLE, STATE_END, STATE_SPECIAL, SUBGRAPH, SUBGRAPH_LABEL } from "../canvas/keys.js";
import { faintOf, plainLabel } from "./labels.js";
import { BOLD, ITALIC } from "./tokens.js";
import { laidOn, pageOf } from "./mix.js";
import { type Theme } from "./theme-model.js";
import { endStateInk, specialStateInk } from "./section-theme.js";

export const baseStyles = (th: Theme): Array<[string, string]> => [
  [NODE, th.node],
  [EDGE, th.edge],
  [EDGE_HEAD, th.edge],
  [ARROW, th.arrow],
  [SUBGRAPH, laidOn(th.subgraph, pageOf(th))],
  [COMPOSITE_FRAME, laidOn(th.composite, pageOf(th))],
  [SUBGRAPH_LABEL, th.subgraphLabel],
  [LABEL, th.label],
  [PACKET_TITLE, th.heading ?? th.label],
  [EDGE_LABEL, th.edgeLabel],
  [DEFAULT_STYLE, th.default],
  [FAINT, faintOf(th)],
  [BOLD_LABEL, `${BOLD} ${plainLabel(th)}`.trim()],
  [ITALIC_LABEL, `${ITALIC} ${plainLabel(th)}`.trim()],
  [STATE_SPECIAL, specialStateInk(th)],
  [STATE_END, endStateInk(th)],
];
