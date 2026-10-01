import { restyled } from "./themecss/restyle.js";
import { Canvas } from "../canvas/canvas.js";
import {
  ACTOR, ACTOR_INDEXED, CHIP_TAIL, DEFAULT_STYLE, FAINT, GANTT_INSIDE_PREFIX, LIFELINE, OUT_TAIL, RIM_TAIL,
  STATIC_LABEL_KEY, WALL_TAIL, isChip,
} from "../canvas/keys.js";
import { type Painting, painting } from "./painting.js";
import { SPACE } from "../text/chars.js";
import { bandStyle, baseKey, inkOff, rimFirst, pageOf, themeBandResolved, readKey, keyStyle, fadedStyle, shownFill } from "./mix.js";
import { linked } from "./labels.js";
import { hasGround } from "./style.js";
import { EMPTY, UNDERLINE } from "./tokens.js";
import { actorInks, layActivationKeys, layActorKeys } from "./frames.js";
import { trimmedLines } from "./trim.js";
import { cellStyles, paintedCells } from "./plane.js";
import { blankPainted } from "./blanks.js";
import { keepsOwnGround, laidOnBand, overFills } from "./band.js";
import { clusterStyles } from "./clusters.js";
import { getTheme } from "./catalogue.js";
import { gradientOf, inkGradients, neoFramed } from "./gradient.js";
import { canvasPalette, laid } from "./canvas-palette.js";
import { type Theme } from "./theme-model.js";
import { sectionsNamed } from "./sections.js";
import { journeySectionStyles } from "./journey.js";
import { pieStyles } from "./pie.js";
import { gitStyles } from "./git.js";
import { ganttStyles } from "./gantt.js";
import { treemapStyles } from "./treemap.js";
import { xyChartStyles } from "./xychart.js";

// A box whose source states its own stroke is drawn under a key of its own, which is never marked for the gradient.
const NO_OWN_STROKE: ReadonlySet<string> = new Set();

export function paintCanvas(canvas: Canvas, theme: string | Theme = DEFAULT_STYLE, look?: string, asked?: boolean): Painting {
  const th: Theme = neoFramed(getTheme(theme), look);
  const palette = canvasPalette(th);
  const styleMap = new Map<string, string>(palette.head);
  const overFill = overFills();

  const styledPairs = canvas.toStyledPairs();
  const keys = new Set<string>();
  for (const row of styledPairs) for (const [, key] of row) keys.add(key);
  const numbered = new Set<number>();
  for (const key of keys) {
    if (!key.startsWith(ACTOR_INDEXED)) continue;
    const index = Number.parseInt(key.slice(ACTOR_INDEXED.length), 10);
    if (Number.isInteger(index) && !numbered.has(index)) {
      numbered.add(index);
      layActorKeys(styleMap, `${ACTOR_INDEXED}${index}`, actorInks(th, index));
    }
  }
  laid(styleMap, palette.middle);
  const pageGround = pageOf(th);
  layActivationKeys(styleMap, th, keys);
  for (let i = 0; i < sectionsNamed(keys, th.sectionColors.length); i++) laid(styleMap, palette.section(i));
  laid(styleMap, palette.root);

  for (const [key, style] of pieStyles(th, keys)) styleMap.set(key, style);
  for (const [key, style] of xyChartStyles(th, keys)) styleMap.set(key, style);
  for (const [key, style] of gitStyles(th, keys, styleMap)) styleMap.set(key, style);
  for (const [key, style] of ganttStyles(th, keys, styleMap)) styleMap.set(key, style);
  for (const [key, style] of treemapStyles(th, keys)) styleMap.set(key, style);
  for (const [key, style] of journeySectionStyles(th, keys)) styleMap.set(key, style);
  restyled(styleMap, th.restyles ?? []);

  const onCluster = clusterStyles(th, styleMap);
  const fills = palette.fills;
  for (const row of styledPairs) {
    for (let at = 0; at < row.length; at++) {
      const [ch, key] = row[at];
      const resolved = themeBandResolved(key, fills);
      if (resolved !== key) row[at] = [ch, resolved];
    }
  }
  const gradient = gradientOf(th, look, asked);
  if (gradient !== undefined) inkGradients(styledPairs, gradient, NO_OWN_STROKE);
  const linkRows = canvas.toLinkRows();
  const lines = trimmedLines(styledPairs, true, (key) => {
    const known = styleMap.get(baseKey(key)) ?? styleMap.get(baseKey(key).replace(CHIP_TAIL, EMPTY));
    return known !== undefined && hasGround(known);
  }, (key) => {
    const { band } = readKey(key);
    return band !== undefined && hasGround(bandStyle(band, styleMap));
  });
  const styleOf = cellStyles((paintedKey, ch, url) => {
    const rawKey = rimFirst(paintedKey);
    // A key the palette knows is kept whole: `subgraph@wall` is the cluster's own border on its ground, and stripping
    // the tail read it back as a bare border on the page.
    // It is looked up without its band: a note's wall inside a filled box is still `note@rim`.
    const unbanded = baseKey(rawKey);
    const fullKey =
      rawKey.startsWith(ACTOR) || styleMap.has(unbanded) || styleMap.has(inkOff(unbanded)[0]) || (isChip(unbanded) && onCluster(inkOff(unbanded)[0]) !== undefined)
        ? rawKey
        : rawKey.replace(OUT_TAIL, EMPTY).replace(RIM_TAIL, EMPTY).replace(WALL_TAIL, EMPTY).replace(CHIP_TAIL, EMPTY);
    // A chip's blanks are its ground: the padding a name tag stands in.
    const chip = isChip(rawKey);
    const read = readKey(fullKey);
    const { key: styleKey, ink } = read;
    const shown = (said: string): string => fadedStyle(said, read.fade, pageGround);
    const tail = read.band ?? EMPTY;
    const band = read.band === undefined ? EMPTY : bandStyle(tail, styleMap);
    const style = keyStyle(read, styleMap.get(styleKey) ?? onCluster(styleKey), ch, true);
    // A key that brings its own ground keeps it over the section's band: a fill tail, or a name inside a gantt bar.
    const ownGround = keepsOwnGround(style, tail) || (style !== undefined && hasGround(style) && styleKey.startsWith(GANTT_INSIDE_PREFIX));
    if (band && !ownGround) {
      // A static member's blanks carry its underline across the words, on a fill as on the page.
      const laid = laidOnBand(overFill, style, ch, shownFill(tail, read.fade, pageGround), band, ink !== undefined, styleKey === FAINT || styleKey === LIFELINE, styleKey === STATIC_LABEL_KEY);
      return shown(linked(laid, url));
    }
    if (style && (ch !== SPACE || blankPainted(styleKey, style, chip))) return shown(linked(style, url));
    return url === undefined ? undefined : UNDERLINE;
  });

  return painting(lines, (text) => {
    for (const { ch, key, from, to, url } of paintedCells(styledPairs, lines, linkRows)) text.lay(key, url, styleOf(key, ch, url), from, to);
  });
}
