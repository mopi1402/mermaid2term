import { restyled } from "../paint/themecss/restyle.js";
import { CHIP_TAIL, DEFAULT_LINK, DEFAULT_STYLE, EDGE_CHIP, LINK_STYLE_PREFIX } from "../canvas/keys.js";
import { Graph } from "./model.js";
import { renderGraphCanvas, type ThemeFills } from "./render/draw.js";
import { type RenderOptions } from "../options.js";
import { type Painting, blankPainting, painting } from "../paint/painting.js";
import { SPACE } from "../text/chars.js";
import { chipPadKey, chipStyle } from "../paint/chips.js";
import { type CssProps, linkLabelStyleOf, linkStyleOf } from "../paint/css.js";
import { noteStyles } from "../paint/frames.js";
import { linked, underlined } from "../paint/labels.js";
import { BACKGROUND, EMPTY } from "../paint/tokens.js";
import { bandStyle, baseKey, fadedStyle, inkOff, keyStyle, melted, pageOf, readKey, shownFill } from "../paint/mix.js";
import { gradientOf, inkGradients, neoFramed } from "../paint/gradient.js";
import { inkedStyle } from "../colour/contrast.js";
import { trimmedLines } from "../paint/trim.js";
import { cellStyles, paintedCells } from "../paint/plane.js";
import { blankPainted } from "../paint/blanks.js";
import { keepsOwnGround, laidOnBand, overFills } from "../paint/band.js";
import { nodeKeyStyles, strokedKeys } from "./node-keys.js";
import { getTheme } from "../paint/catalogue.js";
import { type Theme } from "../paint/theme-model.js";
import { baseStyles } from "../paint/base-styles.js";
import { clusterStyles } from "../paint/clusters.js";
import { colorSlotsOf } from "../paint/color-slots.js";

const themeFills = (th: Theme, look?: string, asked?: boolean): ThemeFills => ({
  node: th.variables.mainBkg !== undefined,
  cluster: th.variables.clusterBkg !== undefined,
  gradient: gradientOf(th, look, asked) !== undefined,
  colorSlots: colorSlotsOf(th),
});

export function paintGraph(
  graph: Graph,
  options: Partial<RenderOptions> = {},
  theme: string | Theme = DEFAULT_STYLE,
  foldBudget?: number
): Painting {
  const th = neoFramed(getTheme(theme), options.look);
  const page = pageOf(th);
  const canvas = renderGraphCanvas(graph, options, foldBudget, themeFills(th, options.look, options.lookAsked));
  if (canvas === undefined) return blankPainting();

  const styleMap = new Map<string, string>([
    ...baseStyles(th),
    [EDGE_CHIP, chipStyle(th, th.edgeLabel)],
  ]);
  const onCluster = clusterStyles(th, styleMap);

  const erasedKeys = new Set<string>();
  // The frame of a note stands on the note's own ground (`groundNoteFrames`), the rule inked over the fill.
  for (const [key, style] of noteStyles(th)) styleMap.set(key, style);

  nodeKeyStyles(styleMap, graph, th, options.borders === "borderless", erasedKeys);

  restyled(styleMap, th.restyles ?? []);

  // A `linkStyle` with no `stroke` keeps the theme's line, and only its `color` reaches the label, on the label's own
  // ground: mermaid hands a label nothing but the text properties (`isLabelStyle`).
  const chip = styleMap.get(EDGE_CHIP) ?? EMPTY;
  const linkStyled = (key: string, props: CssProps): void => {
    const label = linkLabelStyleOf(props);
    styleMap.set(key, linkStyleOf(props) ?? th.edge);
    styleMap.set(`${key}${CHIP_TAIL}`, label === undefined ? chip : chipStyle(th, inkedStyle(th.edgeLabel, label)));
  };
  for (const [index, props] of graph.linkStyles) if (index >= 0) linkStyled(LINK_STYLE_PREFIX + index, props);
  const defaultLinkProps = graph.linkStyles.get(DEFAULT_LINK);
  if (defaultLinkProps !== undefined && defaultLinkProps.size > 0) {
    for (let i = 0; i < graph.edges.length; i++) if (!styleMap.has(LINK_STYLE_PREFIX + i)) linkStyled(LINK_STYLE_PREFIX + i, defaultLinkProps);
  }

  const styledPairs = canvas.toStyledPairs();
  const gradient = gradientOf(th, options.look, options.lookAsked);
  if (gradient !== undefined) inkGradients(styledPairs, gradient, strokedKeys(graph));
  const linkRows = canvas.toLinkRows();
  if (erasedKeys.size > 0) {
    for (const row of styledPairs) {
      for (let i = 0; i < row.length; i++) {
        const [ch, key] = row[i];
        if (ch !== EMPTY && ch !== SPACE && erasedKeys.has(baseKey(inkOff(key)[0]))) row[i] = melted(key);
      }
    }
  }
  const lines = trimmedLines(styledPairs, false, (key) => styleMap.get(inkOff(key)[0])?.includes(BACKGROUND) === true);
  const overFill = overFills();
  // A frame's `fill` is a band laid on the cells it holds (`fillFrames`), read as the canvas painter reads one.
  const styleOf = cellStyles((padded, ch, url) => {
    const read = readKey(padded);
    const { key: styleKey, ink } = read;
    const shown = (said: string): string => fadedStyle(said, read.fade, page);
    const style = keyStyle(read, styleMap.get(styleKey) ?? onCluster(styleKey), ch, false);
    if (read.band !== undefined && !keepsOwnGround(style, read.band)) {
      const tail = read.band;
      const laid = laidOnBand(overFill, style, ch, shownFill(tail, read.fade, page), bandStyle(tail, styleMap), ink !== undefined, false, false);
      return shown(linked(laid, url));
    }
    const paints = ch !== SPACE || (style !== undefined && blankPainted(styleKey, style));
    if (url !== undefined) return shown(underlined(paints ? (style ?? EMPTY) : EMPTY));
    return style && paints ? shown(style) : undefined;
  });

  return painting(lines, (text) => {
    for (const { ch, key: ownKey, row: written, at, from, to, url } of paintedCells(styledPairs, lines, linkRows)) {
      const padded = chipPadKey(written, at, ownKey);
      text.lay(padded, url, styleOf(padded, ch, url), from, to);
    }
  });
}
