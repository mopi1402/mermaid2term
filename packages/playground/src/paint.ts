import { UNICODE } from "@tayomi/mermaid2term";

import { must } from "@/must";

const BLOCKS: ReadonlyMap<string, string> = new Map([
  ["\u2588", "0 0/100% 100%"],
  ["\u2580", "0 0/100% 50%"],
  ["\u2584", "0 100%/100% 50%"],
  ["\u258c", "0 0/50% 100%"],
  ["\u2590", "100% 0/50% 100%"],
  ["\u2596", "0 100%/50% 50%"],
  ["\u2597", "100% 100%/50% 50%"],
  ["\u2598", "0 0/50% 50%"],
  ["\u259d", "100% 0/50% 50%"],
  ["\u2582", "0 100%/100% 25%"],
  ["\u2581", "0 100%/100% 12.5%"],
  ["\u2587", "0 100%/100% 87.5%"],
  ["\u2583", "0 100%/100% 37.5%"],
  ["\u2585", "0 100%/100% 62.5%"],
  ["\u2586", "0 100%/100% 75%"],
  ["\u2594", "0 0/100% 12.5%"],
  ["\u258f", "0 0/12.5% 100%"],
  ["\u258e", "0 0/25% 100%"],
  ["\u258d", "0 0/37.5% 100%"],
  ["\u258b", "0 0/62.5% 100%"],
  ["\u258a", "0 0/75% 100%"],
  ["\u2589", "0 0/87.5% 100%"],
  ["\u2595", "100% 0/12.5% 100%"],
  ["\u259f", "100% 0/50% 100%,0 100%/100% 50%"],
  ["\u2599", "0 0/50% 100%,0 100%/100% 50%"],
  ["\u259c", "100% 0/50% 100%,0 0/100% 50%"],
  ["\u259b", "0 0/50% 100%,0 0/100% 50%"],
]);
const TRIANGLES: ReadonlyMap<string, readonly [towards: string, inkFirst: boolean]> = new Map([
  ["\u25e2", ["bottom right", false]],
  ["\u25e4", ["bottom right", true]],
  ["\u25e3", ["bottom left", false]],
  ["\u25e5", ["bottom left", true]],
]);
const wedge = (ink: string, tip: string, axis: number, alpha: string, geometry: string): string =>
  `conic-gradient(from calc(${axis}deg - ${alpha}) at ${tip},${ink} 0 calc(2 * ${alpha}),transparent 0) ${geometry} no-repeat`;
const POWERLINES: ReadonlyMap<string, readonly [tip: string, axis: number]> = new Map([
  ["\ue0b0", ["100% 50%", 270]],
  ["\ue0b2", ["0 50%", 90]],
]);
// A banner's rounded caps: half an ellipse filling the cell, its flat side where the ground goes on.
const CAPS: ReadonlyMap<string, string> = new Map([
  ["\ue0b4", "0 50%"],
  ["\ue0b6", "100% 50%"],
]);
const cap = (ink: string, centre: string): string =>
  `radial-gradient(ellipse 100% 50% at ${centre},${ink} 98%,transparent 100%) 0 0/100% 100% no-repeat`;
const powerline = (ink: string, [tip, axis]: readonly [string, number]): string =>
  wedge(ink, tip, axis, "atan2(0.5lh, 1ch)", "0 0/100% 100%");
const HEAD_ACROSS = { length: 80, base: 50 };
const HEAD_ALONG = { length: 40, base: 100 };
const HEADS: ReadonlyMap<string, readonly [sideways: boolean, tip: string, axis: number]> = new Map([
  ["\u23f5", [true, "100% 50%", 270]],
  ["\u23f4", [true, "0 50%", 90]],
  ["\u23f7", [false, "50% 100%", 0]],
  ["\u23f6", [false, "50% 0", 180]],
]);
const PERCENT = 100;
const head = (ink: string, [sideways, tip, axis]: readonly [boolean, string, number]): string => {
  const { length, base } = sideways ? HEAD_ACROSS : HEAD_ALONG;
  const alpha = sideways
    ? `atan2(${base / 2 / PERCENT}lh, ${length / PERCENT}ch)`
    : `atan2(${base / 2 / PERCENT}ch, ${length / PERCENT}lh)`;
  const size = sideways ? `${length}% ${base}%` : `${base}% ${length}%`;
  return wedge(ink, tip, axis, alpha, `50% 50%/${size}`);
};
const RING_INNER = "0.3ch";
const RING_OUTER = "0.42ch";
const CORE = "0.17ch";
// A ring the mono lacks would spill from its fallback face into the next cell, so the cell draws it instead.
export const RING = UNICODE.circleMarkFilled;
export const SMALL_RING = UNICODE.smallCircle;
export const CORED_RING = UNICODE.framedCircle;
const RINGS: ReadonlyMap<string, string | undefined> = new Map([
  [RING, undefined],
  [SMALL_RING, undefined],
  [CORED_RING, CORE],
]);
const band = (ink: string): string =>
  `radial-gradient(circle at 50% 50%,transparent ${RING_INNER},${ink} ${RING_INNER},${ink} ${RING_OUTER},transparent ${RING_OUTER}) 0 0/100% 100% no-repeat`;
const ring = (ink: string, core: string | undefined): string =>
  core === undefined
    ? band(ink)
    : `radial-gradient(circle at 50% 50%,${ink} ${core},transparent ${core}) 0 0/100% 100% no-repeat,${band(ink)}`;
export const isBlock = (segment: string): boolean =>
  BLOCKS.has(segment) || TRIANGLES.has(segment) || POWERLINES.has(segment) || CAPS.has(segment) || HEADS.has(segment) || RINGS.has(segment);
const INK_RE = /(?:^|;)color:([^;]+)/u;
const GROUND_RE = /background-color:([^;]+)/u;

export const blockCss = (segment: string, css: string): string => {
  const ink = INK_RE.exec(css)?.[1] ?? "currentColor";
  const ground = GROUND_RE.exec(css)?.[1];
  const triangle = TRIANGLES.get(segment);
  const point = POWERLINES.get(segment);
  const rounded = CAPS.get(segment);
  const arrow = HEADS.get(segment);
  const layer =
    RINGS.has(segment)
      ? ring(ink, RINGS.get(segment))
      : arrow !== undefined
      ? head(ink, arrow)
      : point !== undefined
      ? powerline(ink, point)
      : rounded !== undefined
      ? cap(ink, rounded)
      : triangle === undefined
      ? must(BLOCKS.get(segment))
          .split(",")
          .map((geometry) => `linear-gradient(${ink},${ink}) ${geometry} no-repeat`)
          .join(",")
      : `linear-gradient(to ${triangle[0]},${triangle[1] ? `${ink} 50%,transparent 50%` : `transparent 50%,${ink} 50%`})`;
  const layers = `${layer}${ground === undefined ? "" : `,${ground}`}`;
  return `background:${layers}`;
};

