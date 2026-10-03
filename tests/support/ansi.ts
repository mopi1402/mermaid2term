import { formatHex, type RGB } from "../../src/colour/rgb.js";
import { must } from "../../src/must.js";
import { ESC } from "../../src/paint/escapes.js";
import { NEWLINE } from "../../src/text/chars.js";

// One SGR sequence, its codes captured.
export const SGR_RE = new RegExp(`${ESC}\\[([0-9;]*)m`, "gu");
// One SGR sequence and the text it paints, up to the next escape.
const RUN_RE = new RegExp(`${ESC}\\[([0-9;]*)m([^${ESC}]+)`, "gu");

export type Run = readonly [codes: string, text: string];

export const stripSgr = (painted: string): string => painted.replace(SGR_RE, "");

// The painted row whose text shows `word`.
export const paintedRowWith = (painted: string, word: string): string => must(painted.split(NEWLINE).find((row) => stripSgr(row).includes(word)), word);

export const runsOf = (painted: string): Run[] => [...painted.matchAll(RUN_RE)].map(([, codes, text]): Run => [codes, text]);

// The codes of the first run whose text holds `word`, or "" when none does.
export const runOf = (painted: string, word: string): string => runsOf(painted).find(([, text]) => text.includes(word))?.[0] ?? "";

export const INK = "38";
export const GROUND = "48";

type Lead = typeof INK | typeof GROUND;

// The true colour a run's codes lay as ink or ground.
export const rgbOf = (codes: string, lead: Lead): RGB | undefined => {
  const found = new RegExp(`(?:^|;)${lead};2;(\\d+);(\\d+);(\\d+)`, "u").exec(codes) ?? undefined;
  return found === undefined ? undefined : { r: Number(found[1]), g: Number(found[2]), b: Number(found[3]) };
};

// The same colour as `#rrggbb`, lower case.
export const hexOf = (codes: string, lead: Lead): string | undefined => {
  const rgb = rgbOf(codes, lead);
  return rgb === undefined ? undefined : formatHex(rgb).toLowerCase();
};
