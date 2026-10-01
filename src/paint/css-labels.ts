import { PROP_BACKGROUND_COLOR, PROP_COLOR } from "../source/css.js";
import { colourToHex } from "../colour/colours.js";
import { type CssRules } from "./css-rules.js";

export const EDGE_LABEL_SELECTORS = [".edgeLabel", ".edgeLabel .label", ".edgeLabel p"];
export const NODE_LABEL_SELECTORS = [".node .label", ".nodeLabel", ".node .nodeLabel"];

const colourOf = (
  rules: CssRules,
  selectors: readonly string[],
  prop: string
): string | undefined => {
  for (const selector of selectors) {
    const hex = colourToHex(rules.get(selector)?.get(prop) ?? "");
    if (hex !== undefined) return hex;
  }
  return undefined;
};

export interface LabelsFromCss {
  readonly label?: string;
  readonly edgeLabel?: string;
  readonly edgeLabelGround?: string;
  readonly subgraphLabel?: string;
}

// Where a label rule shows past mermaid 12's own sheet, kind by kind (measured headless): the selectors above whose
// `color` misses the words, those whose `background-color` is not hidden under mermaid's `.edgeLabel p` ground, and
// those that ink a composite state's title too.
interface LabelReach {
  readonly misses: ReadonlySet<string>;
  readonly grounds: readonly string[];
  readonly titles?: readonly string[];
}

const LABEL_REACH: ReadonlyMap<string, LabelReach> = new Map([
  ["flowchart", { misses: new Set([".node .label", ".edgeLabel .label"]), grounds: [".edgeLabel p"] }],
  ["state", { misses: new Set([".node .label", ".edgeLabel", ".edgeLabel .label"]), grounds: [".edgeLabel p"], titles: [".nodeLabel"] }],
  ["class", { misses: new Set([".node .label", ".edgeLabel .label"]), grounds: [".edgeLabel p"] }],
  ["er", { misses: new Set<string>(), grounds: [".edgeLabel", ".edgeLabel p"] }],
  ["block", { misses: new Set([".node .label", ".edgeLabel .label"]), grounds: [".edgeLabel", ".edgeLabel p"] }],
]);

export function labelsOf(rules: CssRules, section: string | undefined): LabelsFromCss {
  const reach = section === undefined ? undefined : LABEL_REACH.get(section);
  if (reach === undefined) return {};
  const reaching = (selectors: readonly string[]): string[] => selectors.filter((selector) => !reach.misses.has(selector));
  const label = colourOf(rules, reaching(NODE_LABEL_SELECTORS), PROP_COLOR);
  const edgeLabel = colourOf(rules, reaching(EDGE_LABEL_SELECTORS), PROP_COLOR);
  const edgeLabelGround = colourOf(rules, reach.grounds, PROP_BACKGROUND_COLOR);
  const subgraphLabel = colourOf(rules, reach.titles ?? [], PROP_COLOR);
  return {
    ...(label === undefined ? {} : { label }),
    ...(edgeLabel === undefined ? {} : { edgeLabel }),
    ...(edgeLabelGround === undefined ? {} : { edgeLabelGround }),
    ...(subgraphLabel === undefined ? {} : { subgraphLabel }),
  };
}
