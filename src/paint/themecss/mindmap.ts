import { EDGE, SECTION_FOREGROUND_PREFIX, SECTION_PREFIX, SECTION_ROOT, SHAPE_ELEMENTS, elementKey, indexAfter, indexed } from "../../canvas/keys.js";
import { SECTION_SEATS } from "../theme-model.js";
import { type KindSelector } from "./model.js";

const edge = (key: string): boolean => key === EDGE || indexAfter(key, SECTION_FOREGROUND_PREFIX) !== undefined;

// A node's shape takes `.<section> rect`, `path`, `polygon` or `circle` as the element mermaid draws it with, its
// HTML words `span`'s `color` whatever its shape.
const shapes = (section: string, base: string): KindSelector[] => [
  ...SHAPE_ELEMENTS.map((element): KindSelector => ({
    selectors: [`${section} ${element}`],
    keys: (key) => key === elementKey(base, element),
    fill: "ground",
  })),
  { selectors: [`${section} span`], keys: (key) => SHAPE_ELEMENTS.some((element) => key === elementKey(base, element)), fill: "html" },
];

// `.section-N` is the root's child N's branch, painted on the `cScale` seat after it.
const sections = (n: number): KindSelector[] => [
  ...shapes(`.section-${n}`, indexed(SECTION_PREFIX, n + 1)),
  { selectors: [`.section-edge-${n}`], keys: (key) => key === indexed(SECTION_FOREGROUND_PREFIX, n + 1), fill: "none" },
];

// Measured on mermaid 12.0.0 headless: a square or rounded shape is a `rect`, a cloud, a bang or the default one a
// `path`, a hexagon a `polygon` and a circle a `circle`, the root's as a branch's; `.edge` strokes every edge; mermaid's
// own `.section-N` rules outrank `.node`, `.mindmap-node`, `.label-container` and `.node-bkg`.
export const MINDMAP_SELECTORS: readonly KindSelector[] = [
  ...Array.from({ length: SECTION_SEATS - 1 }, (_, n) => sections(n)).flat(),
  ...shapes(".section-root", SECTION_ROOT),
  { selectors: [".edge"], keys: edge, fill: "none" },
];
