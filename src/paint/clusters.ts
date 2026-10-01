import { themeRgb } from "../colour/colours.js";
import {
  ALT_TAIL, BODY_TAIL, CLASS_PREFIX, CLUSTER_TAIL, COMPOSITE_ALT_FILL, COMPOSITE_BODY_FILL, COMPOSITE_FRAME, COMPOSITE_TITLE_FILL, NODE,
  NODE_STYLE_PREFIX, OUT_TAIL, SLAB_TAIL, SUBGRAPH, SUBGRAPH_FILL, TITLE_TAIL, WALL_TAIL, isChip,
} from "../canvas/keys.js";
import { formatHex, type RGB } from "../colour/rgb.js";
import { readableStyle } from "../colour/contrast.js";
import { BACKGROUND } from "./tokens.js";
import { laidOn, pageOf, slabInk } from "./mix.js";
import { hasGround } from "./style.js";
import { type Theme } from "./theme-model.js";

// The theme's `clusterBkg` and `clusterBorder`, read the same way for every frame a kind draws around its boxes: a
// flowchart subgraph and a class namespace are one cluster, so one place says what a cluster is dressed in. A
// composite state's grounds stand beside it, read the same way: its name band on `compositeTitleBackground`, its body
// on `compositeBackground`, and a body nested a level down on `altBackground`.
export function clusterStyles(th: Theme, styleMap: Map<string, string>): (key: string) => string | undefined {
  const read = themeRgb;
  const cluster = read(th.variables.clusterBkg);
  const grounds: ReadonlyArray<readonly [string, string, RGB | undefined]> = [
    [TITLE_TAIL, COMPOSITE_TITLE_FILL, read(th.variables.compositeTitleBackground)],
    [BODY_TAIL, COMPOSITE_BODY_FILL, read(th.variables.compositeBackground)],
    [ALT_TAIL, COMPOSITE_ALT_FILL, read(th.variables.altBackground)],
  ];
  for (const [, fill, ground] of grounds) if (ground !== undefined) styleMap.set(fill, BACKGROUND + formatHex(ground));
  if (cluster !== undefined) styleMap.set(SUBGRAPH_FILL, BACKGROUND + formatHex(cluster));
  styleMap.set(`${SUBGRAPH}${SLAB_TAIL}`, slabInk(styleMap.get(SUBGRAPH_FILL), laidOn(th.subgraph, pageOf(th))));
  styleMap.set(`${COMPOSITE_FRAME}${SLAB_TAIL}`, slabInk(styleMap.get(SUBGRAPH_FILL), laidOn(th.composite, pageOf(th))));
  // A frame glyph stands ON the cluster's ground, whatever ink the kind draws it in: a subgraph takes the theme's
  // cluster border, a composite state the node's own stroke, which is the fallback mermaid gives `compositeBorder`.
  const onGround = (ink: string): string =>
    cluster === undefined ? laidOn(ink, pageOf(th)) : `${laidOn(ink, cluster)} ${BACKGROUND}${formatHex(cluster)}`.trim();
  styleMap.set(`${SUBGRAPH}${WALL_TAIL}`, onGround(th.subgraph));
  styleMap.set(`${COMPOSITE_FRAME}${WALL_TAIL}`, onGround(th.composite));
  const isFrame = (key: string): boolean =>
    key === NODE ||
    key === SUBGRAPH ||
    key === COMPOSITE_FRAME ||
    key.startsWith(CLASS_PREFIX) ||
    key.startsWith(NODE_STYLE_PREFIX) ||
    key.endsWith(OUT_TAIL) ||
    key.endsWith(SLAB_TAIL);
  const laidOnGround = (key: string, tail: string, ground: RGB | undefined): string | undefined => {
    const own = key.slice(0, -tail.length);
    const base = styleMap.get(own);
    if (base === undefined) return undefined;
    // A chip with a ground of its own keeps it on any other; a bare one shows the ground under it.
    if (isChip(own) && hasGround(base)) {
      styleMap.set(key, base);
      return base;
    }
    const frame = own === SUBGRAPH && ground !== undefined ? laidOn(th.subgraph, ground) : base;
    const laid =
      ground === undefined
        ? base
        : `${isFrame(own) ? frame : readableStyle(base, ground)} ${BACKGROUND}${formatHex(ground)}`.trim();
    styleMap.set(key, laid);
    return laid;
  };
  return (key: string): string | undefined => {
    if (key.endsWith(CLUSTER_TAIL)) return laidOnGround(key, CLUSTER_TAIL, cluster);
    const own = grounds.find(([tail]) => key.endsWith(tail));
    return own === undefined ? undefined : laidOnGround(key, own[0], own[2]);
  };
}
