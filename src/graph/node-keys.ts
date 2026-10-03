import { Graph, nodeProps } from "./model.js";
import { must } from "../must.js";
import { colourToHex, themeRgb } from "../colour/colours.js";
import { QUIET_RATIO, inkedStyle, readableStyle } from "../colour/contrast.js";
import { formatHex, parseHex } from "../colour/rgb.js";
import { fillOf, fontWordsOf, opacitiesOf, PROP_COLOR, PROP_STROKE_DASHARRAY, PROP_STROKE_WIDTH } from "../source/css.js";
import { mixRGB } from "../colour/palette.js";
import { SPACE } from "../text/chars.js";
import { CLASS_PREFIX, FILL_TAIL, FOLD_TAIL, MARK_TAIL, NODE, NODE_STYLE_PREFIX, OUT_TAIL, RIM_TAIL, SLAB_TAIL, NOTCH_TAIL } from "../canvas/keys.js";
import { type CssProps, strokeStyleOf } from "../paint/css.js";
import { faintOf, labelKeys } from "../paint/labels.js";
import { BACKGROUND, EMPTY } from "../paint/tokens.js";
import { pageOf, slabInk } from "../paint/mix.js";
import { type Theme } from "../paint/theme-model.js";

export function nodeKeyStyles(
  styleMap: Map<string, string>,
  graph: Graph,
  th: Theme,
  borderless: boolean,
  erasedKeys: Set<string>
): void {
  // `font-weight`, `font-style` and `text-decoration` name a font the terminal owns; `opacity` fades the whole node
  // at paint (`fadeBox`). A style that asks for none leaves the label exactly as the theme painted it.
  const propsOf = new Map<string, CssProps>();
  const weighted = (key: string, ink: string): string => {
    const asked = propsOf.get(key);
    const weight = asked === undefined ? "" : fontWordsOf(asked).join(SPACE);
    return weight === "" ? ink : `${weight} ${ink}`.trim();
  };

  // A `color` of its own inks the words with or without a `fill`, as mermaid lays it on the label itself.
  const ownInk = (props: CssProps | undefined): string => {
    const named = props?.get(PROP_COLOR);
    const inkHex = named ? colourToHex(named) : undefined;
    return inkHex !== undefined ? inkedStyle(th.label, inkHex) : th.label;
  };

  const nodeStyles = (key: string, props: CssProps): void => {
    const fill = fillOf(props);
    const color = fill ? colourToHex(fill) : undefined;
    const stroke = strokeStyleOf(props);
    // A fill alone keeps the theme's outline, as mermaid's `nodeBorder` stays under a `fill`; only a drawing asked
    // borderless drops it, the way it drops the frame of every node that states no stroke.
    const bordered =
      stroke !== undefined || props.has(PROP_STROKE_DASHARRAY) || props.has(PROP_STROKE_WIDTH);
    if (!bordered && color !== undefined && borderless) erasedKeys.add(key);
    styleMap.set(key, stroke ?? th.node);
    if (color === undefined) return;
    const bg = BACKGROUND + color;
    styleMap.set(key + FILL_TAIL, bg);
    // The words are weighed on the ground as it shows, its fill mixed with the page by the share `fadeBox` keeps.
    const asked = parseHex(color);
    const ground = asked === undefined ? undefined : mixRGB(pageOf(th), asked, opacitiesOf(props, undefined)?.ground ?? 1);
    const base = ownInk(props);
    const ink = ground !== undefined ? readableStyle(base, ground) : base;
    labelKeys(styleMap, key, weighted(key, ink), bg);
  };

  for (const [className, props] of graph.classDefs) propsOf.set(CLASS_PREFIX + className, props);
  const styled = new Map<string, CssProps>();
  for (const nodeId of graph.nodeStyles.keys()) styled.set(nodeId, must(nodeProps(graph, nodeId, graph.nodes.get(nodeId)?.styleClasses ?? [])));
  for (const [nodeId, props] of styled) propsOf.set(NODE_STYLE_PREFIX + nodeId, props);
  for (const [className, props] of graph.classDefs) nodeStyles(CLASS_PREFIX + className, props);
  for (const [nodeId, props] of styled) nodeStyles(NODE_STYLE_PREFIX + nodeId, props);

  const themeFill = themeRgb(th.variables.mainBkg);
  const nodeKeys = [
    NODE,
    ...[...graph.classDefs.keys()].map((name) => CLASS_PREFIX + name),
    ...[...graph.nodeStyles.keys()].map((id) => NODE_STYLE_PREFIX + id),
  ];
  for (const key of nodeKeys) {
    if (styleMap.has(key + FILL_TAIL)) continue;
    const bg = themeFill === undefined ? EMPTY : BACKGROUND + formatHex(themeFill);
    if (themeFill !== undefined) styleMap.set(key + FILL_TAIL, bg);
    const base = ownInk(propsOf.get(key));
    const ink = themeFill === undefined ? base : readableStyle(base, themeFill);
    labelKeys(styleMap, key, weighted(key, ink), bg);
  }
  for (const key of nodeKeys) {
    const stroke = styleMap.get(key) ?? EMPTY;
    styleMap.set(`${key}${OUT_TAIL}`, stroke);
    const fill = styleMap.get(key + FILL_TAIL);
    styleMap.set(`${key}${RIM_TAIL}`, fill === undefined ? stroke : `${stroke} ${fill}`.trim());
    styleMap.set(`${key}${SLAB_TAIL}`, slabInk(fill, stroke));
    styleMap.set(`${key}${NOTCH_TAIL}`, fill === undefined ? stroke : `${formatHex(pageOf(th))} ${fill}`.trim());
    styleMap.set(`${key}${FOLD_TAIL}`, `${faintOf(th)} ${fill ?? EMPTY}`.trim());
    // A single glyph in the stroke's ink sinks into a fill a whole frame reads well against: lifted to a quiet ratio.
    const ground = fill?.startsWith(BACKGROUND) === true ? parseHex(fill.slice(BACKGROUND.length)) : undefined;
    styleMap.set(`${key}${MARK_TAIL}`, ground === undefined ? stroke : `${readableStyle(stroke, ground, QUIET_RATIO, QUIET_RATIO)} ${fill}`.trim());
  }
}


// The keys whose style or class states its own `stroke`: an inline stroke wins over the look's gradient.
export function strokedKeys(graph: Graph): Set<string> {
  const stroked = new Set<string>();
  for (const [className, props] of graph.classDefs) if (strokeStyleOf(props) !== undefined) stroked.add(CLASS_PREFIX + className);
  for (const nodeId of graph.nodeStyles.keys()) {
    const props = nodeProps(graph, nodeId, graph.nodes.get(nodeId)?.styleClasses ?? []);
    if (props !== undefined && strokeStyleOf(props) !== undefined) stroked.add(NODE_STYLE_PREFIX + nodeId);
  }
  return stroked;
}
