import { PROP_FILL, PROP_STROKE } from "../source/css.js";
import { definitionWords } from "../colour/style-words.js";
import { type WeightsFromCss } from "./theme-css.js";

const DIM_OPACITY = "0.6";

const rule = (selector: string, props: ReadonlyArray<readonly [string, string]>): string =>
  `${selector} { ${props.map(([name, value]) => `${name}: ${value};`).join(" ")} }`;

const propsOfWeight = (weight: string): Array<readonly [string, string]> => {
  const words = new Set(definitionWords(weight));
  const props: Array<readonly [string, string]> = [];
  if (words.has("bold")) props.push(["font-weight", "bold"]);
  if (words.has("italic")) props.push(["font-style", "italic"]);
  if (words.has("dim")) props.push(["opacity", DIM_OPACITY]);
  return props;
};

export function cssOfTheme(
  weights: Required<WeightsFromCss>,
  arrowheadColor: string | undefined,
  frameOpacity?: number
): string {
  const rules: string[] = [];
  if (arrowheadColor !== undefined) rules.push(rule(".marker", [[PROP_FILL, arrowheadColor], [PROP_STROKE, arrowheadColor]]));
  if (frameOpacity !== undefined) rules.push(rule(".loopLine", [["opacity", String(frameOpacity)]]));
  const roles: ReadonlyArray<readonly [string, string]> = [
    [".flowchart-link", weights.edge],
    [".edgeLabel", weights.edgeLabel],
    [".node .label", weights.label],
    [".cluster rect", weights.subgraph],
    [".cluster .label", weights.subgraphLabel],
  ];
  for (const [selector, weight] of roles) {
    const props = propsOfWeight(weight);
    if (props.length > 0) rules.push(rule(selector, props));
  }
  return rules.join(" ");
}
