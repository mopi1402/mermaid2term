import { TREEMAP_LEAF_MARK, TREEMAP_PARTS, TREEMAP_SEAT_JOIN, treemapKeyParts, type TreemapPart } from "../canvas/keys.js";
import { themeRgb } from "../colour/colours.js";
import { RULE_RATIO, readableStyle } from "../colour/contrast.js";
import { formatHex, type RGB } from "../colour/rgb.js";
import { inked } from "./style.js";
import { mixRGB } from "../colour/palette.js";
import { laidOn, pageOf } from "./mix.js";
import { BACKGROUND, EMPTY } from "./tokens.js";
import { type Theme, seatIn } from "./theme-model.js";

// mermaid's treemap renderer: a section's rect at `fill-opacity` 0.6 stroked its `cScalePeer` seat at
// `stroke-opacity` 0.4, a leaf's at 0.3 in its parent's `cScale` seat, stroked with it whole.
const SECTION_FILL_OPACITY = 0.6;
const LEAF_FILL_OPACITY = 0.3;
const SECTION_STROKE_OPACITY = 0.4;

// Fill seat 0 is mermaid's `transparent`; seat N past it is the scale's seat N - 1.
const scaleSeat = (scale: readonly string[], seat: number): RGB | undefined => (seat === 0 ? undefined : themeRgb(scale[seat - 1]));

interface Ground {
  readonly rgb: RGB | undefined;
  // The fill seat the cell's box is dressed from: a section's own, a leaf's parent's.
  readonly seat: number;
}

// A seat as the drawing names it, `3`, or `3#FF0000` where a `classDef` fill takes the seat's colour's place.
interface Seat {
  readonly seat: number;
  readonly fill: string | undefined;
}

const SEAT_RE = /^(\d*)(#[0-9A-F]{6})?$/iu;
const seatOf = (token: string): Seat => {
  const found = SEAT_RE.exec(token) ?? undefined;
  return { seat: Number(found?.[1] ?? 0), fill: found?.[2] };
};

function groundOf(th: Theme, id: string): Ground {
  const leafAt = id.indexOf(TREEMAP_LEAF_MARK);
  const seats = (leafAt === -1 ? id : id.slice(0, leafAt)).split(TREEMAP_SEAT_JOIN).map(seatOf);
  const page = pageOf(th);
  const laid = (under: RGB | undefined, { seat, fill }: Seat, by: number): RGB | undefined => {
    const rgb = fill === undefined ? scaleSeat(th.variables.cScale, seat) : themeRgb(fill);
    return rgb === undefined ? under : mixRGB(under ?? page, rgb, by);
  };
  const sections = seats.reduce<RGB | undefined>((under, seat) => laid(under, seat, SECTION_FILL_OPACITY), undefined);
  const seat = seats[seats.length - 1]?.seat ?? 0;
  if (leafAt === -1) return { rgb: sections, seat };
  // A leaf is filled its parent's seat, or its own class's fill.
  return { rgb: laid(sections, { seat, fill: seatOf(id.slice(leafAt + TREEMAP_LEAF_MARK.length)).fill }, LEAF_FILL_OPACITY), seat };
}

// The ground a box stands on: its id less its last seat, or less the leaf mark and what follows it.
const parentOf = (id: string): string => {
  const leafAt = id.indexOf(TREEMAP_LEAF_MARK);
  return leafAt !== -1 ? id.slice(0, leafAt) : id.slice(0, Math.max(0, id.lastIndexOf(TREEMAP_SEAT_JOIN)));
};

const on = (style: string, ground: RGB | undefined): string => (ground === undefined ? style : inked(style, BACKGROUND + formatHex(ground)));

function inkOf(th: Theme, part: TreemapPart, ground: Ground, text: number | undefined, said: RGB | undefined): string {
  const page = ground.rgb ?? pageOf(th);
  const rule = (weight: string, ink: RGB): string => readableStyle(inked(weight, formatHex(ink)), page, RULE_RATIO, RULE_RATIO);
  if (part === "blank" || part === "slab") return EMPTY;
  if (part === "frame") {
    // A padless rim names the section's own seat, its ground being the parent's.
    const peer = said ?? scaleSeat(th.variables.cScalePeer, text ?? ground.seat);
    return peer === undefined ? laidOn(th.subgraph, page) : rule(th.weights.subgraph, mixRGB(page, peer, SECTION_STROKE_OPACITY));
  }
  if (part === "box") {
    const stroke = said ?? scaleSeat(th.variables.cScale, ground.seat);
    return stroke === undefined ? th.node : rule(th.weights.node, stroke);
  }
  const weight = part === "label" ? th.weights.label : th.weights.edgeLabel;
  // A class's `color` is the source's own word, written as it stands.
  if (said !== undefined) return inked(weight, formatHex(said));
  // A seat the theme leaves unwritten falls to `.treemapLabel` and `.treemapValue`, both `textColor`.
  const labels = th.variables.cScaleLabel;
  const ink = (text === undefined || labels.length === 0 ? undefined : seatIn(labels, text)) ?? th.variables.textColor;
  if (ink === undefined) return part === "label" ? th.label : th.edgeLabel;
  const written = inked(weight, ink);
  return text !== undefined && th.namedLabels.has(text) ? written : readableStyle(written, page);
}

// Every treemap key the drawing names, its ink weighed on the ground its boxes lay under it.
export function treemapStyles(th: Theme, keys: Iterable<string>): Array<[string, string]> {
  const styles: Array<[string, string]> = [];
  for (const key of keys) {
    const [name, id, text, said] = treemapKeyParts(key) ?? [];
    const part = TREEMAP_PARTS.find((known) => known === name);
    if (part === undefined || id === undefined) continue;
    const ground = groundOf(th, id);
    if (part === "slab") {
      const own = ground.rgb ?? pageOf(th);
      styles.push([key, on(formatHex(own), groundOf(th, parentOf(id)).rgb)]);
      continue;
    }
    const seat = text === undefined || text === EMPTY ? undefined : Number(text);
    const style = on(inkOf(th, part, ground, seat, said === undefined ? undefined : themeRgb(said)), ground.rgb);
    if (style !== EMPTY) styles.push([key, style]);
  }
  return styles;
}
