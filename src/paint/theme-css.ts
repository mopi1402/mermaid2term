import { fontWordsOf, PROP_FILL, PROP_STROKE } from "../source/css.js";
import { labelsOf, EDGE_LABEL_SELECTORS, NODE_LABEL_SELECTORS, type LabelsFromCss } from "./css-labels.js";
import { readCssRules, type CssRules } from "./css-rules.js";

function weightOf(props: ReadonlyMap<string, string>): string {
  const words = fontWordsOf(props);
  const opacity = props.get("opacity");
  if (opacity !== undefined && Number(opacity) < 1) words.push("dim");
  return words.join(" ");
}

// A rule that states no font word, only a colour, leaves the role's weight to the theme.
const FONT_PROPS = ["font-weight", "font-style", "text-decoration", "text-decoration-line", "opacity"];
const weighs = (props: ReadonlyMap<string, string>): boolean => FONT_PROPS.some((prop) => props.has(prop));

export interface WeightsFromCss {
  readonly node?: string;
  readonly edge?: string;
  readonly arrow?: string;
  readonly label?: string;
  readonly edgeLabel?: string;
  readonly subgraph?: string;
  readonly subgraphLabel?: string;
}

interface ColoursFromCss {
  readonly arrowheadColor?: string;
  readonly lineColor?: string;
  readonly actorBorder?: string;
  readonly actorBkg?: string;
  readonly actorLineColor?: string;
  readonly activationBkgColor?: string;
  readonly activationBorderColor?: string;
}

const EDGE_SELECTORS = [".flowchart-link", ".edge-thickness-normal"];
const SUBGRAPH_SELECTORS = [".cluster rect", ".cluster"];
const SUBGRAPH_LABEL_SELECTORS = [".cluster .label", ".cluster-label", ".cluster text"];
const MARKER_SELECTORS = [".marker"];
const ACTOR_SELECTORS = [".actor", "rect.actor", ".actor rect"];
const ACTOR_LINE_SELECTORS = [".actor-line", "line.actor-line"];
const LOOP_LINE_SELECTORS = [".loopLine", "line.loopLine"];
const ACTIVATION_SELECTORS = [".activation0", ".activation1", ".activation2"];

const ruleOf = (
  rules: CssRules,
  selectors: readonly string[]
): ReadonlyMap<string, string> | undefined => {
  for (const selector of selectors) {
    const found = rules.get(selector);
    if (found !== undefined) return found;
  }
  return undefined;
};

export function themeFromCss(
  css: string,
  section?: string
): { weights: WeightsFromCss; colours: ColoursFromCss; labels: LabelsFromCss; frameOpacity?: number } {
  const rules = readCssRules(css);
  const labels = labelsOf(rules, section);
  const weights: Record<string, string> = {};
  const colours: Record<string, string> = {};
  let frameOpacity: number | undefined;
  const loopLine = ruleOf(rules, LOOP_LINE_SELECTORS);
  const opacity = loopLine === undefined ? undefined : Number(loopLine.get("opacity"));
  if (opacity !== undefined && Number.isFinite(opacity) && opacity > 0 && opacity <= 1) frameOpacity = opacity;
  const marker = ruleOf(rules, MARKER_SELECTORS);
  if (marker !== undefined) {
    const ink = marker.get(PROP_FILL) ?? marker.get(PROP_STROKE);
    if (ink !== undefined && ink !== "none") colours.arrowheadColor = ink;
  }
  const edge = ruleOf(rules, EDGE_SELECTORS);
  if (edge !== undefined) {
    if (weighs(edge)) weights.edge = weightOf(edge);
    const stroke = edge.get(PROP_STROKE);
    if (stroke !== undefined && stroke !== "none") colours.lineColor = stroke;
  }
  const roles: ReadonlyArray<readonly [keyof WeightsFromCss, readonly string[]]> = [
    ["edgeLabel", EDGE_LABEL_SELECTORS],
    ["label", NODE_LABEL_SELECTORS],
    ["subgraph", SUBGRAPH_SELECTORS],
    ["subgraphLabel", SUBGRAPH_LABEL_SELECTORS],
  ];
  for (const [role, selectors] of roles) {
    const rule = ruleOf(rules, selectors);
    if (rule !== undefined && weighs(rule)) weights[role] = weightOf(rule);
  }
  const actor = ruleOf(rules, ACTOR_SELECTORS);
  if (actor !== undefined) {
    const stroke = actor.get(PROP_STROKE);
    if (stroke !== undefined && stroke !== "none") colours.actorBorder = stroke;
    const fill = actor.get(PROP_FILL);
    if (fill !== undefined && fill !== "none") colours.actorBkg = fill;
  }
  const actorLine = ruleOf(rules, ACTOR_LINE_SELECTORS);
  if (actorLine !== undefined) {
    const stroke = actorLine.get(PROP_STROKE);
    if (stroke !== undefined && stroke !== "none") colours.actorLineColor = stroke;
  }
  const activation = ruleOf(rules, ACTIVATION_SELECTORS);
  if (activation !== undefined) {
    const fill = activation.get(PROP_FILL);
    if (fill !== undefined && fill !== "none") colours.activationBkgColor = fill;
    const stroke = activation.get(PROP_STROKE);
    if (stroke !== undefined && stroke !== "none") colours.activationBorderColor = stroke;
  }
  return frameOpacity === undefined ? { weights, colours, labels } : { weights, colours, labels, frameOpacity };
}
